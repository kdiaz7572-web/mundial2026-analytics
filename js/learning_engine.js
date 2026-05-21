// ============================================================
//  LEARNING_ENGINE.JS — Agente de Aprendizaje en Tiempo Real
//
//  Estudia los partidos del Mundial 2026 conforme se juegan y
//  actualiza los lambdas del modelo Poisson con un blend:
//
//    λ_blend = 0.70 × λ_histórico + 0.30 × λ_torneo
//
//  En DEMO_MODE simula stats de partidos usando el modelo Poisson.
//  En LIVE_MODE conecta a API-Football v3 con tu API key.
//
//  Ciclo de vida:
//    1. Al terminar cada partido → actualiza form, goles, xG blend
//    2. Cada 15 min durante partido → recalcula lambdas en vivo
//    3. Si jugador estrella ±30% vs histórico → ajusta lambda + genera picks
// ============================================================

const LearningEngine = (() => {

  // ── Configuración ──────────────────────────────────────────
  const CONFIG = {
    DEMO_MODE:       true,      // false = API real
    API_KEY:         '',        // Tu API key de API-Football aquí
    API_BASE:        'https://v3.football.api-sports.io',
    WC_LEAGUE_ID:    1,         // Copa del Mundo en API-Football
    WC_SEASON:       2026,

    BLEND_HISTORICAL: 0.70,     // Peso datos históricos
    BLEND_TOURNAMENT: 0.30,     // Peso datos del torneo
    OUTLIER_THRESHOLD: 0.30,    // ±30% vs histórico → alerta jugador
    LIVE_POLL_MS:    15 * 60 * 1000, // 15 min en ms
    MIN_GP_FOR_BLEND: 1,        // Partidos mínimos para aplicar blend
  };

  // ── Estado interno ──────────────────────────────────────────
  const _state = {
    // Estadísticas acumuladas del torneo por equipo
    // { shortName: { gp, goalsFor, goalsAgainst, xgFor, xgAgainst, form[], playerRatings{} } }
    tournamentStats: {},

    // Lambdas ajustadas por blend { 'HOME-AWAY': { lH, lA, updatedAt } }
    blendedLambdas: {},

    // Alertas de jugadores { shortName: [ {player, delta, direction, generatedAt} ] }
    playerAlerts: {},

    // Estado del polling en vivo
    livePolling: null,
    isPolling: false,
    lastPoll: null,

    // Log de actualizaciones del agente
    updateLog: [],
  };

  // ── Inicializar stats de torneo para todos los equipos ─────
  function _initTeamStats() {
    TEAMS.forEach(t => {
      if (!_state.tournamentStats[t.shortName]) {
        _state.tournamentStats[t.shortName] = {
          gp:            0,
          goalsFor:      0,
          goalsAgainst:  0,
          xgFor:         0.0,
          xgAgainst:     0.0,
          form:          [],           // resultados reales del torneo
          playerRatings: {},           // { playerName: [rating1, rating2, ...] }
          fatigue:       0,            // 0..1 (acumula con cada partido)
          injuries:      [],           // nombres de jugadores lesionados/suspendidos
        };
      }
    });
  }

  // ── Blend lambda: mezcla histórico + torneo ─────────────────
  /**
   * Calcula el lambda blend para un equipo.
   * Si no hay datos de torneo suficientes, usa 100% histórico.
   *
   * @param {string} shortName - código del equipo
   * @param {number} historicalLambda - λ del modelo Poisson pre-torneo
   * @returns {number} λ ajustado
   */
  function blendLambda(shortName, historicalLambda) {
    const ts = _state.tournamentStats[shortName];
    if (!ts || ts.gp < CONFIG.MIN_GP_FOR_BLEND) return historicalLambda;

    // Lambda del torneo: promedio de xG reales por partido
    const tournamentLambda = ts.gp > 0 ? ts.xgFor / ts.gp : historicalLambda;

    // Ajuste de fatiga: -5% de lambda por partido jugado (acumulado máx. -15%)
    const fatigePenalty = Math.min(ts.gp * 0.05, 0.15);

    // Ajuste por lesiones de estrella
    const team = TEAMS.find(t => t.shortName === shortName);
    const starInjured = team && ts.injuries.includes(team.starPlayer);
    const injuryPenalty = starInjured ? 0.12 : 0;

    const raw = CONFIG.BLEND_HISTORICAL * historicalLambda
              + CONFIG.BLEND_TOURNAMENT * tournamentLambda;

    return parseFloat(Math.max(0.3, raw * (1 - fatigePenalty) * (1 - injuryPenalty)).toFixed(3));
  }

  /**
   * Retorna el ratio de blend actual como porcentaje del componente torneo.
   */
  function getBlendRatio() {
    // El blend de torneo crece con los datos disponibles
    const teamsWithData = Object.values(_state.tournamentStats).filter(ts => ts.gp > 0).length;
    if (!teamsWithData) return '0';
    return Math.round(CONFIG.BLEND_TOURNAMENT * 100);
  }

  // ── Procesamiento de resultado de partido ───────────────────
  /**
   * Procesa el resultado de un partido terminado.
   * Actualiza stats de torneo y detona ajuste de lambdas.
   *
   * @param {Object} matchData - { home, away, homeGoals, awayGoals, homeXg, awayXg, playerRatings }
   */
  async function processMatchResult(matchData) {
    const { home, away, homeGoals, awayGoals } = matchData;
    const homeXg = matchData.homeXg || homeGoals * 0.92; // fallback si no hay xG
    const awayXg = matchData.awayXg || awayGoals * 0.92;

    // Actualizar stats de ambos equipos
    _updateTeamStats(home, homeGoals, awayGoals, homeXg, awayXg,
                     homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L',
                     matchData.playerRatings?.[home] || {});

    _updateTeamStats(away, awayGoals, homeGoals, awayXg, homeXg,
                     awayGoals > homeGoals ? 'W' : awayGoals === homeGoals ? 'D' : 'L',
                     matchData.playerRatings?.[away] || {});

    // Detectar outliers de jugadores estrella
    await _detectPlayerOutliers(home, matchData.playerRatings?.[home] || {});
    await _detectPlayerOutliers(away, matchData.playerRatings?.[away] || {});

    // Guardar en AppState
    AppState.emit('learning-update', {
      type: 'match-processed',
      home, away, homeGoals, awayGoals,
      timestamp: Date.now(),
    });

    _log(`✅ Partido procesado: ${home} ${homeGoals}–${awayGoals} ${away}`);
  }

  function _updateTeamStats(shortName, goalsFor, goalsAgainst, xgFor, xgAgainst, result, ratings) {
    const ts = _state.tournamentStats[shortName];
    if (!ts) return;
    ts.gp++;
    ts.goalsFor      += goalsFor;
    ts.goalsAgainst  += goalsAgainst;
    ts.xgFor         += xgFor;
    ts.xgAgainst     += xgAgainst;
    ts.fatigue        = Math.min(1, ts.gp * 0.33);
    ts.form.unshift(result);
    if (ts.form.length > 5) ts.form = ts.form.slice(0, 5);

    // Guardar ratings de jugadores
    Object.entries(ratings).forEach(([player, rating]) => {
      if (!ts.playerRatings[player]) ts.playerRatings[player] = [];
      ts.playerRatings[player].push(rating);
    });

    // Actualizar TEAMS en memoria con la forma del torneo
    const team = TEAMS.find(t => t.shortName === shortName);
    if (team && ts.form.length > 0) {
      // Mezcla la forma del torneo con la forma histórica (últimos 5)
      const blendedForm = [...ts.form, ...team.recentForm].slice(0, 10);
      team.recentForm = blendedForm;

      // Blend de goalsScored / goalsConceded
      if (ts.gp >= 1) {
        const tGoalsScored    = ts.goalsFor  / ts.gp;
        const tGoalsConc      = ts.goalsAgainst / ts.gp;
        team.goalsScored    = parseFloat((CONFIG.BLEND_HISTORICAL * team.goalsScored
                                        + CONFIG.BLEND_TOURNAMENT * tGoalsScored).toFixed(2));
        team.goalsConceded  = parseFloat((CONFIG.BLEND_HISTORICAL * team.goalsConceded
                                        + CONFIG.BLEND_TOURNAMENT * tGoalsConc).toFixed(2));
      }
    }
  }

  // ── Detección de outlier en jugadores estrella ──────────────
  async function _detectPlayerOutliers(shortName, ratings) {
    const team = TEAMS.find(t => t.shortName === shortName);
    if (!team) return;

    const star = team.starPlayer;
    const rating = ratings[star];
    if (rating == null) return;

    // Rating histórico base: starPlayerValue normalizado a escala 0..10
    const historicalRating = team.starPlayerValue / 10;
    const delta = (rating - historicalRating) / historicalRating;

    if (Math.abs(delta) >= CONFIG.OUTLIER_THRESHOLD) {
      const direction = delta > 0 ? 'up' : 'down';
      const alert = {
        team: shortName,
        player: star,
        rating: rating.toFixed(1),
        historicalRating: historicalRating.toFixed(1),
        delta: delta,
        direction,
        generatedAt: Date.now(),
      };

      if (!_state.playerAlerts[shortName]) _state.playerAlerts[shortName] = [];
      _state.playerAlerts[shortName].unshift(alert);
      _state.playerAlerts[shortName] = _state.playerAlerts[shortName].slice(0, 5);

      // Ajustar starPlayerValue del equipo
      team.starPlayerValue = Math.round(Math.min(100, Math.max(20,
        CONFIG.BLEND_HISTORICAL * team.starPlayerValue +
        CONFIG.BLEND_TOURNAMENT * (rating * 10)
      )));

      _log(`⚡ Outlier detectado: ${star} (${shortName}) rating=${rating.toFixed(1)} Δ=${(delta*100).toFixed(0)}%`);

      // Emitir evento y regenerar picks automáticamente
      AppState.emit('player-outlier', alert);
      AppState.emit('learning-update', { type: 'player-outlier', ...alert });

      // Regenerar picks para los próximos partidos de este equipo
      await _regeneratePicksForTeam(shortName);
    }
  }

  async function _regeneratePicksForTeam(shortName) {
    const upcomingForTeam = FIXTURES.filter(f =>
      f.homeGoals === null &&
      (f.home === shortName || f.away === shortName)
    ).slice(0, 3);

    if (!upcomingForTeam.length) return;

    _log(`🔄 Regenerando picks para ${shortName} (${upcomingForTeam.length} partidos próximos)…`);

    try {
      const results = await Promise.allSettled(
        upcomingForTeam.map(f =>
          PicksEngine.generateForMatch(f.home, f.away, f.id)
            .then(picks => ({ fixture: f, picks, refProfile: RefEngine.getForFixture(f.id) }))
        )
      );

      const newPicks = results
        .filter(r => r.status === 'fulfilled' && r.value.picks.length > 0)
        .map(r => r.value);

      if (newPicks.length > 0) {
        // Mezclar con picks existentes (evitar duplicados de mismo fixture)
        const currentPicks = AppState.getPicks();
        const updatedPicks = [
          ...newPicks,
          ...currentPicks.filter(cp =>
            !newPicks.some(np => np.fixture.id === cp.fixture.id)
          ),
        ];
        AppState.setPicks(updatedPicks);
        _log(`✅ ${newPicks.reduce((n, fp) => n + fp.picks.length, 0)} picks nuevos generados para ${shortName}`);
      }
    } catch (e) {
      console.warn('[LearningEngine] _regeneratePicksForTeam:', e);
    }
  }

  // ── Polling en vivo cada 15 min ─────────────────────────────
  function startLivePolling() {
    if (_state.livePolling) return;
    _log('🟢 Live polling iniciado (cada 15 min)');
    _state.isPolling = true;

    const poll = async () => {
      _state.lastPoll = Date.now();
      if (CONFIG.DEMO_MODE) {
        await _demoLivePoll();
      } else {
        await _realLivePoll();
      }
      AppState.emit('learning-update', { type: 'live-poll', timestamp: _state.lastPoll });
    };

    poll(); // primera ejecución inmediata
    _state.livePolling = setInterval(poll, CONFIG.LIVE_POLL_MS);
  }

  function stopLivePolling() {
    if (_state.livePolling) {
      clearInterval(_state.livePolling);
      _state.livePolling = null;
      _state.isPolling = false;
      _log('🔴 Live polling detenido');
    }
  }

  // ── DEMO: simula stats en vivo con Poisson ─────────────────
  async function _demoLivePoll() {
    // Buscar partidos "en vivo" simulados
    const liveFixtures = FIXTURES.filter(f => {
      const ld = AppState.getLive(f.id);
      return ld && ['1H', '2H'].includes(ld.status);
    });

    liveFixtures.forEach(f => {
      const ld = AppState.getLive(f.id);
      if (!ld) return;

      // Calcular xG acumulado real en este momento del partido
      const timeRatio  = Math.min(ld.elapsed / 90, 1);
      const hTeam      = TEAMS.find(t => t.shortName === f.home);
      const aTeam      = TEAMS.find(t => t.shortName === f.away);
      if (!hTeam || !aTeam) return;

      // xG proporcional al tiempo transcurrido + ruido
      const baseXgH = hTeam.goalsScored * timeRatio;
      const baseXgA = aTeam.goalsScored * timeRatio;
      const liveXgH = parseFloat((baseXgH * (0.85 + Math.random() * 0.30)).toFixed(2));
      const liveXgA = parseFloat((baseXgA * (0.85 + Math.random() * 0.30)).toFixed(2));

      // Recalcular lambda en vivo (proyección a 90 min)
      if (ld.elapsed > 10) {
        const projLambdaH = liveXgH / timeRatio;
        const projLambdaA = liveXgA / timeRatio;

        // Almacenar en blendedLambdas para este partido
        const mk = `${f.home}-${f.away}`;
        _state.blendedLambdas[mk] = {
          lH: parseFloat((CONFIG.BLEND_HISTORICAL * hTeam.goalsScored
                         + CONFIG.BLEND_TOURNAMENT * projLambdaH).toFixed(2)),
          lA: parseFloat((CONFIG.BLEND_HISTORICAL * aTeam.goalsScored
                         + CONFIG.BLEND_TOURNAMENT * projLambdaA).toFixed(2)),
          liveXgH, liveXgA, timeRatio,
          updatedAt: Date.now(),
        };

        // Invalidar caché de OddsEngine para este partido → fuerza recálculo
        AppState.setOdds(mk, null);
      }
    });
  }

  // ── REAL: conecta a API-Football ────────────────────────────
  async function _realLivePoll() {
    if (!CONFIG.API_KEY) {
      console.warn('[LearningEngine] API key no configurada. Usa setApiKey().');
      return;
    }
    try {
      const res = await fetch(
        `${CONFIG.API_BASE}/fixtures?league=${CONFIG.WC_LEAGUE_ID}&season=${CONFIG.WC_SEASON}&live=all`,
        { headers: { 'x-apisports-key': CONFIG.API_KEY } }
      );
      if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
      const data = await res.json();

      for (const fixture of (data.response || [])) {
        await _processAPIFixture(fixture);
      }
    } catch (e) {
      console.warn('[LearningEngine] _realLivePoll:', e);
    }
  }

  async function _processAPIFixture(fixture) {
    const homeCode = _mapAPITeam(fixture.teams.home.name);
    const awayCode = _mapAPITeam(fixture.teams.away.name);
    if (!homeCode || !awayCode) return;

    const stats = fixture.statistics || [];
    const getStat = (teamIdx, statType) => {
      const t = stats[teamIdx];
      if (!t) return 0;
      const s = t.statistics.find(x => x.type === statType);
      return s ? (parseFloat(s.value) || 0) : 0;
    };

    const elapsed = fixture.fixture.status.elapsed || 0;
    const homeXg  = getStat(0, 'expected_goals') || getStat(0, 'Total Shots') * 0.09;
    const awayXg  = getStat(1, 'expected_goals') || getStat(1, 'Total Shots') * 0.09;

    if (elapsed > 10) {
      const timeRatio = Math.min(elapsed / 90, 1);
      const projLH = homeXg / timeRatio;
      const projLA = awayXg / timeRatio;
      const hTeam  = TEAMS.find(t => t.shortName === homeCode);
      const aTeam  = TEAMS.find(t => t.shortName === awayCode);
      if (hTeam && aTeam) {
        const mk = `${homeCode}-${awayCode}`;
        _state.blendedLambdas[mk] = {
          lH: parseFloat((CONFIG.BLEND_HISTORICAL * hTeam.goalsScored
                         + CONFIG.BLEND_TOURNAMENT * projLH).toFixed(2)),
          lA: parseFloat((CONFIG.BLEND_HISTORICAL * aTeam.goalsScored
                         + CONFIG.BLEND_TOURNAMENT * projLA).toFixed(2)),
          liveXgH: homeXg, liveXgA: awayXg, elapsed,
          updatedAt: Date.now(),
        };
        AppState.setOdds(mk, null); // invalidar caché
        _log(`📡 λ actualizado en vivo: ${homeCode} ${projLH.toFixed(2)} vs ${awayCode} ${projLA.toFixed(2)} (${elapsed}')`);
      }
    }

    // Si el partido terminó, procesar resultado completo
    if (['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short)) {
      const hGoals = fixture.goals.home;
      const aGoals = fixture.goals.away;

      // Obtener ratings de jugadores de la API
      const ratingsRes = await fetch(
        `${CONFIG.API_BASE}/fixtures/players?fixture=${fixture.fixture.id}`,
        { headers: { 'x-apisports-key': CONFIG.API_KEY } }
      );
      let playerRatings = { [homeCode]: {}, [awayCode]: {} };
      if (ratingsRes.ok) {
        const rData = await ratingsRes.json();
        (rData.response || []).forEach(team => {
          const code = _mapAPITeam(team.team.name);
          if (!code) return;
          team.players.forEach(p => {
            const rating = parseFloat(p.statistics[0]?.games?.rating || 0);
            if (rating > 0) playerRatings[code][p.player.name] = rating;
          });
        });
      }

      await processMatchResult({
        home: homeCode, away: awayCode,
        homeGoals: hGoals, awayGoals: aGoals,
        homeXg, awayXg,
        playerRatings,
      });
    }
  }

  // ── Mapeo nombre API → shortName del sistema ────────────────
  const _apiTeamMap = {
    'Argentina':            'ARG', 'Brazil':            'BRA',
    'France':               'FRA', 'England':           'ENG',
    'Spain':                'ESP', 'Germany':           'GER',
    'Portugal':             'POR', 'Netherlands':       'NED',
    'Croatia':              'CRO', 'Serbia':            'SRB',
    'Uruguay':              'URU', 'Colombia':          'COL',
    'Morocco':              'MAR', 'Senegal':           'SEN',
    'Japan':                'JPN', 'South Korea':       'KOR',
    'United States':        'USA', 'Mexico':            'MEX',
    'Canada':               'CAN', 'Australia':         'AUS',
    'Switzerland':          'SUI', 'Austria':           'AUT',
    'Denmark':              'DEN', 'Turkey':            'TUR',
    'Poland':               'POL', 'Hungary':           'HUN',
    'Ecuador':              'ECU', 'Venezuela':         'VEN',
    'Panama':               'PAN', 'Honduras':          'HON',
    'Costa Rica':           'CRC', 'Iran':              'IRN',
    'Saudi Arabia':         'KSA', 'Iraq':              'IRQ',
    'Jordan':               'JOR', 'Uzbekistan':        'UZB',
    'Nigeria':              'NGA', "Côte d'Ivoire":     'CIV',
    'Ivory Coast':          'CIV', 'Egypt':             'EGY',
    'Senegal':              'SEN', 'Cameroon':          'CMR',
    'Ghana':                'GHA', 'Mali':              'MLI',
    'DR Congo':             'COD', 'South Africa':      'RSA',
    'Tunisia':              'TUN', 'New Zealand':       'NZL',
    'Indonesia':            'IDN', 'Georgia':           'GEO',
  };
  function _mapAPITeam(apiName) { return _apiTeamMap[apiName] || null; }

  // ── Demo: procesar partidos ya finalizados del localStorage ─
  function processExistingResults() {
    const played = FIXTURES.filter(f => f.homeGoals !== null);
    if (!played.length) return;

    played.forEach(f => {
      // Simular xG como ~92% de los goles (simplificación DEMO)
      processMatchResult({
        home: f.home, away: f.away,
        homeGoals: f.homeGoals, awayGoals: f.awayGoals,
        homeXg:    f.homeGoals * 0.92 + Math.random() * 0.5,
        awayXg:    f.awayGoals * 0.92 + Math.random() * 0.5,
        playerRatings: _demoPlayerRatings(f),
      });
    });

    _log(`📥 ${played.length} partidos existentes procesados en modo DEMO`);
  }

  // ── Generador de ratings demo ────────────────────────────────
  function _demoPlayerRatings(fixture) {
    const ratings = {};
    [fixture.home, fixture.away].forEach(code => {
      const team = TEAMS.find(t => t.shortName === code);
      if (!team) return;
      ratings[code] = {};
      // El jugador estrella tiene rating basado en goalsScored del equipo + ruido
      const base = team.starPlayerValue / 10; // 0..10
      const jitter = (Math.random() - 0.5) * 3; // ±1.5
      ratings[code][team.starPlayer] = parseFloat(Math.min(10, Math.max(4, base + jitter)).toFixed(1));
    });
    return ratings;
  }

  // ── Getters públicos ─────────────────────────────────────────
  function getTeamStats(shortName) {
    return _state.tournamentStats[shortName] || null;
  }

  function getBlendedLambdas(homeKey, awayKey) {
    return _state.blendedLambdas[`${homeKey}-${awayKey}`] || null;
  }

  function getPlayerAlerts(shortName) {
    return _state.playerAlerts[shortName] || [];
  }

  function getAllAlerts() {
    return Object.values(_state.playerAlerts).flat()
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, 20);
  }

  function getUpdateLog() { return [..._state.updateLog].slice(0, 30); }
  function isPolling()    { return _state.isPolling; }

  function setApiKey(key) {
    CONFIG.API_KEY  = key;
    CONFIG.DEMO_MODE = false;
    _log(`🔑 API key configurada — modo LIVE activado`);
  }

  function _log(msg) {
    const entry = { msg, ts: new Date().toLocaleTimeString('es-CR') };
    _state.updateLog.unshift(entry);
    if (_state.updateLog.length > 100) _state.updateLog = _state.updateLog.slice(0, 100);
    console.log(`[LearningEngine] ${entry.ts} ${msg}`);
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    _initTeamStats();
    // Procesar resultados ya guardados en FIXTURES
    processExistingResults();
    // Iniciar polling en vivo
    startLivePolling();
    // Suscribirse a eventos de live engine
    AppState.on('live-match-update', ({ fixtureId }) => {
      const ld = AppState.getLive(fixtureId);
      if (ld && ld.status === 'FT') {
        const fx = FIXTURES.find(f => f.id === fixtureId);
        if (fx) {
          processMatchResult({
            home: fx.home, away: fx.away,
            homeGoals: ld.homeGoals, awayGoals: ld.awayGoals,
            homeXg: ld.homeGoals * 0.92 + Math.random() * 0.4,
            awayXg: ld.awayGoals * 0.92 + Math.random() * 0.4,
            playerRatings: _demoPlayerRatings(fx),
          });
        }
      }
    });
    // Suscribirse a cambios de fixtures guardados
    AppState.on('fixtures-changed', () => {
      processExistingResults();
    });
    _log('🚀 LearningEngine inicializado · Modo: ' + (CONFIG.DEMO_MODE ? 'DEMO' : 'LIVE'));
  }

  // ── API pública ──────────────────────────────────────────────
  return {
    init,
    setApiKey,
    processMatchResult,
    startLivePolling,
    stopLivePolling,
    blendLambda,
    getBlendRatio,
    getTeamStats,
    getBlendedLambdas,
    getPlayerAlerts,
    getAllAlerts,
    getUpdateLog,
    isPolling,
  };

})();

// ── Integración con mmAnalyzeMatch ──────────────────────────────
// Parchea mmAnalyzeMatch para usar lambdas blend cuando estén disponibles
// IMPORTANTE: usar window.mmAnalyzeMatch para evitar hoisting que genera recursión infinita
(function _patchMmAnalyze() {
  const _orig = window.mmAnalyzeMatch;
  if (!_orig) return; // guard: math_model.js no cargado aún
  window.mmAnalyzeMatch = function mmAnalyzeMatchBlended(homeKey, awayKey, refType) {
    if (refType === undefined) refType = 'default';
    const raw = _orig(homeKey, awayKey, refType);
    if (!raw || raw.error) return raw;

    // Consultar lambdas blend del LearningEngine
    const blend = LearningEngine.getBlendedLambdas(homeKey, awayKey);
    if (blend && blend.lH && blend.lA) {
      const patched = _orig(homeKey, awayKey, refType);
      if (patched.lambdas) {
        patched.lambdas.home  = blend.lH;
        patched.lambdas.away  = blend.lA;
        patched.lambdas.total = parseFloat((blend.lH + blend.lA).toFixed(2));
      }
      patched._blended    = true;
      patched._blendSource = blend;
      return patched;
    }
    return raw;
  };
})();
