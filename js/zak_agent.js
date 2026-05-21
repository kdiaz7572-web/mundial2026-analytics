// ============================================================
//  ZAK_AGENT.JS — IA-Zak: Agente Analítico Inteligente
//
//  IA-Zak estudia los mercados de DoradoBet, calcula el edge
//  matemático en TODOS los mercados disponibles, rastrea el
//  historial de jugadores y genera recomendaciones con
//  evaluación de riesgo y narrativa detallada.
//
//  Mercados soportados (igual que DoradoBet):
//    Resultado 1X2 · Doble Oportunidad · Empate Anula · HT/FT
//    Hándicap Asiático · Hándicap Europeo
//    Más/Menos Goles (1.5/2.5/3.5/4.5) · BTTS
//    Goles x Equipo · Goles x Mitad · Resultado Correcto
//    Primer Goleador · Último Goleador · Anota en Todo Momento
//    Minuto del Primer Gol · Total Córners · Total Tarjetas
//    Tarjeta Roja · Anota y Gana · Cuota Principal Mejorada
//
//  Modo DEMO: datos históricos + simulación doradobet
//  Modo LIVE: conecta a API-Football + scraped odds
// ============================================================

'use strict';

const ZakAgent = (() => {

  // ── Identidad del agente ───────────────────────────────────
  const NAME    = 'IA-Zak';
  const VERSION = '2.0.0';

  // ── Configuración ──────────────────────────────────────────
  const CFG = {
    DEMO_MODE:        true,
    MIN_EDGE:         0.008,       // 0.8% edge mínimo para recomendar
    MIN_PROB:         0.15,        // Prob mínima del modelo
    MAX_ODDS:         8.00,
    MIN_ODDS:         1.08,
    RISK_EDGE_LOW:    0.04,        // Edge ≥ 4% → BAJO RIESGO
    RISK_EDGE_MED:    0.015,       // Edge ≥ 1.5% → RIESGO MEDIO
    TOP_PICKS:        5,           // Máx picks globales por partido
    COMMUNITY_WEIGHT: 0.15,        // Peso de la "comunidad" en análisis final
    PLAYER_HISTORY_KEY: 'zak_player_history_v1',
    MARKET_LEARN_KEY:   'zak_market_knowledge_v1',
    INSIGHTS_KEY:       'zak_community_v1',
  };

  // ── Persistencia ───────────────────────────────────────────
  const _load  = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
  const _save  = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ── Base de Historial de Jugadores ─────────────────────────
  // { playerName: { team, goals, assists, cards, minsPlayed, matches,
  //                  cornerKicks, foulsCommitted, shotsOnTarget,
  //                  goalsPerGame, assistsPerGame, cardsPerGame,
  //                  lastUpdated, form[] } }
  let _playerDB = _load(CFG.PLAYER_HISTORY_KEY) || {};

  // ── Conocimiento de Mercados (aprendido de DoradoBet) ──────
  let _marketKnowledge = _load(CFG.MARKET_LEARN_KEY) || {
    learnedAt: null,
    markets: _defaultMarketKnowledge(),
    oddsDistributions: {},   // mercado → { min, max, avg, count }
  };

  // ── Insights de Comunidad (DEMO) ───────────────────────────
  let _communityInsights = _load(CFG.INSIGHTS_KEY) || { teams: {}, lastFetch: null };

  // ── Estado del agente ──────────────────────────────────────
  const _state = {
    isRunning: false,
    lastAnalysis: null,
    studyLog: [],          // Log de aprendizaje de DoradoBet
    analysisCache: {},     // matchKey → analysis result
  };

  // ────────────────────────────────────────────────────────────
  //  MERCADOS CONOCIDOS DE DORADOBET (CONOCIMIENTO BASE)
  // ────────────────────────────────────────────────────────────
  function _defaultMarketKnowledge() {
    return {
      // Resultado
      'result_1x2':       { name: 'Resultado 1X2',          category: 'resultado', typicalOdds: [2.4, 3.2, 2.9] },
      'double_chance':    { name: 'Doble Oportunidad',       category: 'resultado', typicalOdds: [1.3, 1.6, 1.5] },
      'draw_no_bet':      { name: 'Empate Anula Apuesta',    category: 'resultado', typicalOdds: [1.6, 2.3] },
      'ht_ft':            { name: 'Resultado Descanso/Final',category: 'resultado', typicalOdds: [] },
      'ht_result':        { name: 'Resultado al Descanso',   category: 'resultado', typicalOdds: [2.6, 3.1, 2.9] },
      // Hándicap
      'asian_hcp':        { name: 'Hándicap Asiático',       category: 'handicap', lines: [-1.5,-1,-0.5,0,0.5,1,1.5] },
      'euro_hcp':         { name: 'Hándicap Europeo',        category: 'handicap', lines: [-2,-1,0,1,2] },
      // Goles
      'goals_ou_15':      { name: 'Más/Menos 1.5 Goles',    category: 'goles',    line: 1.5 },
      'goals_ou_25':      { name: 'Más/Menos 2.5 Goles',    category: 'goles',    line: 2.5 },
      'goals_ou_35':      { name: 'Más/Menos 3.5 Goles',    category: 'goles',    line: 3.5 },
      'goals_ou_45':      { name: 'Más/Menos 4.5 Goles',    category: 'goles',    line: 4.5 },
      'btts':             { name: 'Ambos Anotan (BTTS)',     category: 'goles' },
      'btts_goals_25':    { name: 'BTTS + Más 2.5',         category: 'goles' },
      'goals_home_ou':    { name: 'Goles Local Más/Menos',  category: 'goles',    lines: [0.5,1.5,2.5] },
      'goals_away_ou':    { name: 'Goles Visita Más/Menos', category: 'goles',    lines: [0.5,1.5,2.5] },
      'goals_1h_ou':      { name: 'Goles 1ra Mitad',        category: 'goles',    lines: [0.5,1.5] },
      'goals_2h_ou':      { name: 'Goles 2da Mitad',        category: 'goles',    lines: [0.5,1.5] },
      'exact_score':      { name: 'Resultado Correcto',      category: 'goles' },
      'first_score_team': { name: '1er Equipo en Anotar',   category: 'goles' },
      'score_win':        { name: 'Anota y Gana',            category: 'goles' },
      // Jugadores
      'first_scorer':     { name: 'Primer Goleador',         category: 'jugador' },
      'last_scorer':      { name: 'Último Goleador',         category: 'jugador' },
      'anytime_scorer':   { name: 'Anota en Cualquier Momento', category: 'jugador' },
      'player_assists':   { name: 'Asistencia del Jugador',  category: 'jugador' },
      'player_cards':     { name: 'Tarjeta al Jugador',      category: 'jugador' },
      // Córners
      'corners_ou_85':    { name: 'Córners Más/Menos 8.5',  category: 'corners',  line: 8.5 },
      'corners_ou_95':    { name: 'Córners Más/Menos 9.5',  category: 'corners',  line: 9.5 },
      'corners_ou_105':   { name: 'Córners Más/Menos 10.5', category: 'corners',  line: 10.5 },
      'corners_home_ou':  { name: 'Córners Local',           category: 'corners',  lines: [4.5,5.5] },
      'corners_away_ou':  { name: 'Córners Visita',          category: 'corners',  lines: [3.5,4.5] },
      // Tarjetas
      'cards_ou_35':      { name: 'Tarjetas Más/Menos 3.5', category: 'tarjetas', line: 3.5 },
      'cards_ou_45':      { name: 'Tarjetas Más/Menos 4.5', category: 'tarjetas', line: 4.5 },
      'red_card':         { name: 'Tarjeta Roja en el Partido', category: 'tarjetas' },
      // Tiempo
      'first_goal_time':  { name: 'Minuto 1er Gol',         category: 'tiempo',   lines: [25,35,45] },
      'no_goal_1h':       { name: 'Sin Goles en 1ra Mitad', category: 'tiempo' },
    };
  }

  // ────────────────────────────────────────────────────────────
  //  DEMO COMMUNITY INSIGHTS — DoradoBet-style comentarios
  // ────────────────────────────────────────────────────────────
  const DEMO_COMMUNITY = {
    'BRA': { sentiment: 0.82, trending: ['Vinicius al primer gol', 'Brasil -1.5 hándicap'], hotPick: 'Vinicius JR anota en cualquier momento', avgBettors: 1240 },
    'ARG': { sentiment: 0.78, trending: ['Argentina 1x2', 'Más 2.5 goles'], hotPick: 'Argentina gana + Más 1.5', avgBettors: 1890 },
    'FRA': { sentiment: 0.75, trending: ['Mbappé primer gol', 'Francia -0.5 hándicap'], hotPick: 'Mbappé primer goleador', avgBettors: 980 },
    'ESP': { sentiment: 0.72, trending: ['España + BTTS', 'Más córners 9.5'], hotPick: 'España gana + Más 2.5', avgBettors: 870 },
    'ENG': { sentiment: 0.68, trending: ['Inglaterra 1x2', 'Kane anota'], hotPick: 'Kane anota en cualquier momento', avgBettors: 760 },
    'GER': { sentiment: 0.65, trending: ['Alemania -1', 'Más 3.5 goles'], hotPick: 'Alemania Doble Oportunidad', avgBettors: 650 },
    'POR': { sentiment: 0.70, trending: ['Portugal 1x2', 'Cristiano Ronaldo'], hotPick: 'Portugal + Ambos Anotan', avgBettors: 720 },
    'default': { sentiment: 0.55, trending: ['Más 2.5 goles', 'BTTS Sí'], hotPick: 'Más 2.5 Goles', avgBettors: 320 },
  };

  function _getCommunity(teamKey) {
    if (!teamKey) return DEMO_COMMUNITY.default;
    const k = teamKey.toUpperCase().slice(0,3);
    return DEMO_COMMUNITY[k] || DEMO_COMMUNITY.default;
  }

  // ────────────────────────────────────────────────────────────
  //  PLAYER HISTORY SYSTEM
  // ────────────────────────────────────────────────────────────

  /**
   * Registra o actualiza stats de un jugador tras un partido.
   */
  function recordPlayerMatch(playerName, team, stats = {}) {
    if (!playerName) return;
    const key = playerName.toLowerCase().replace(/\s+/g, '_');
    const existing = _playerDB[key] || {
      name: playerName, team,
      goals: 0, assists: 0, yellowCards: 0, redCards: 0,
      minsPlayed: 0, matches: 0, shots: 0, shotsOnTarget: 0,
      cornerKicks: 0, foulsCommitted: 0, foulsWon: 0,
      form: [], lastUpdated: null,
    };
    existing.goals          += stats.goals          || 0;
    existing.assists        += stats.assists         || 0;
    existing.yellowCards    += stats.yellowCards     || 0;
    existing.redCards       += stats.redCards        || 0;
    existing.minsPlayed     += stats.minsPlayed      || 90;
    existing.matches        += 1;
    existing.shots          += stats.shots           || 0;
    existing.shotsOnTarget  += stats.shotsOnTarget   || 0;
    existing.cornerKicks    += stats.cornerKicks     || 0;
    existing.foulsCommitted += stats.foulsCommitted  || 0;
    existing.foulsWon       += stats.foulsWon        || 0;

    // Form: últimos 5 partidos
    existing.form.push({
      date: new Date().toISOString().slice(0,10),
      goals: stats.goals || 0, assists: stats.assists || 0,
      cards: (stats.yellowCards||0) + (stats.redCards||0),
    });
    if (existing.form.length > 5) existing.form.shift();
    existing.lastUpdated = Date.now();

    // Promedios calculados
    existing.goalsPerGame   = existing.goals / existing.matches;
    existing.assistsPerGame = existing.assists / existing.matches;
    existing.cardsPerGame   = (existing.yellowCards + existing.redCards) / existing.matches;
    existing.shotsPerGame   = existing.shots / existing.matches;
    existing.foulsPerGame   = existing.foulsCommitted / existing.matches;

    _playerDB[key] = existing;
    _save(CFG.PLAYER_HISTORY_KEY, _playerDB);
    return existing;
  }

  /**
   * Obtiene el perfil de un jugador. Si no existe, genera un perfil DEMO
   * usando los squads cargados + promedios históricos del Mundial.
   */
  function getPlayerProfile(playerName, teamKey) {
    const key = playerName.toLowerCase().replace(/\s+/g, '_');
    if (_playerDB[key]) return _playerDB[key];

    // DEMO: generamos un perfil base con datos aproximados
    return _generateDemoPlayer(playerName, teamKey);
  }

  function _generateDemoPlayer(playerName, teamKey) {
    // Jugadores estrella conocidos
    const STARS = {
      'vinicius junior': { goals: 0.52, assists: 0.31, shots: 3.2, cards: 0.18, cornerKicks: 0.2 },
      'vinicius jr':     { goals: 0.52, assists: 0.31, shots: 3.2, cards: 0.18, cornerKicks: 0.2 },
      'rodrygo':         { goals: 0.38, assists: 0.28, shots: 2.1, cards: 0.12 },
      'kylian mbappé':   { goals: 0.65, assists: 0.22, shots: 3.8, cards: 0.15 },
      'kylian mbappe':   { goals: 0.65, assists: 0.22, shots: 3.8, cards: 0.15 },
      'lionel messi':    { goals: 0.55, assists: 0.48, shots: 2.9, cards: 0.10 },
      'erling haaland':  { goals: 0.72, assists: 0.18, shots: 4.1, cards: 0.20 },
      'harry kane':      { goals: 0.58, assists: 0.25, shots: 3.3, cards: 0.14 },
      'cristiano ronaldo':{ goals: 0.48, assists: 0.15, shots: 3.5, cards: 0.22 },
      'pedri':           { goals: 0.22, assists: 0.38, shots: 1.8, cards: 0.18 },
      'lamine yamal':    { goals: 0.30, assists: 0.42, shots: 2.1, cards: 0.10 },
      'jude bellingham': { goals: 0.41, assists: 0.29, shots: 2.5, cards: 0.24 },
      'neymar jr':       { goals: 0.50, assists: 0.42, shots: 3.0, cards: 0.28 },
    };
    const pName  = playerName.toLowerCase();
    const base   = STARS[pName] || { goals: 0.18, assists: 0.12, shots: 1.2, cards: 0.16 };
    const noise  = () => (Math.random() * 0.06) - 0.03; // ±3% ruido

    return {
      name: playerName, team: teamKey || '?',
      goalsPerGame:   +(base.goals   + noise()).toFixed(3),
      assistsPerGame: +(base.assists + noise()).toFixed(3),
      cardsPerGame:   +(base.cards   + noise()).toFixed(3),
      shotsPerGame:   +(base.shots   + noise()).toFixed(3),
      cornerKicksPerGame: +(base.cornerKicks || 0.3),
      foulsPerGame:   0.6,
      matches: 0, goals: 0, assists: 0,
      yellowCards: 0, redCards: 0, minsPlayed: 0,
      form: [], lastUpdated: null,
      _demo: true,
    };
  }

  /**
   * Predicción de comportamiento de jugador para un partido específico.
   * Devuelve propensidades % y narrativa.
   */
  function predictPlayer(playerName, teamKey, opponentKey) {
    const profile = getPlayerProfile(playerName, teamKey);
    // Ajuste por rival
    const oppTeam = (typeof TEAMS !== 'undefined' && Array.isArray(TEAMS))
      ? TEAMS.find(t => t.shortName === opponentKey) : null;
    const oppDefense = oppTeam ? (oppTeam.defensiveStrength || 1.0) : 1.0;

    // Probabilidades ajustadas
    const probGoal    = Math.min(0.95, profile.goalsPerGame   / (0.6 * oppDefense));
    const probAssist  = Math.min(0.90, profile.assistsPerGame / 0.5);
    const probCard    = Math.min(0.70, profile.cardsPerGame   * 1.2);
    const probShot    = Math.min(0.98, profile.shotsPerGame / 3.5);

    // Narrativa basada en historial
    let narrative = `${playerName} promedia **${(profile.goalsPerGame).toFixed(2)} goles/partido**.`;
    if (profile.form && profile.form.length > 0) {
      const recentGoals = profile.form.reduce((s, f) => s + f.goals, 0);
      if (recentGoals >= 2) narrative += ` En forma: ${recentGoals} goles en últimos ${profile.form.length} partidos.`;
    }
    if (profile._demo) narrative += ' *(datos históricos base — sin partidos del torneo aún)*';

    return {
      player: playerName,
      team: teamKey,
      profile,
      predictions: {
        scoreProbability:  +probGoal.toFixed(3),
        assistProbability: +probAssist.toFixed(3),
        cardProbability:   +probCard.toFixed(3),
        shotProbability:   +probShot.toFixed(3),
      },
      narrative,
    };
  }

  // ────────────────────────────────────────────────────────────
  //  MOTOR DE MERCADOS EXTENDIDOS
  // ────────────────────────────────────────────────────────────

  /**
   * Calcula todas las probabilidades para todos los mercados de un partido.
   * @param {string} homeKey  Clave del equipo local (p.ej. 'BRA')
   * @param {string} awayKey  Clave del equipo visitante
   * @returns {Object} marketProbs — probabilidades por mercado
   */
  function calcAllMarkets(homeKey, awayKey) {
    // Obtenemos el análisis base del modelo Poisson
    const analysis = (typeof window.mmAnalyzeMatch === 'function')
      ? window.mmAnalyzeMatch(homeKey, awayKey)
      : null;

    if (!analysis || analysis.error) {
      return { error: `No se pudo analizar ${homeKey} vs ${awayKey}` };
    }

    const lH = analysis.lambdas.home;
    const lA = analysis.lambdas.away;

    // ── Distribución Poisson ─────────────────────────────────
    const P = _poissonMatrix(lH, lA, 6); // matriz 7×7

    // ── Resultado 1X2 ────────────────────────────────────────
    let pHome = 0, pDraw = 0, pAway = 0;
    for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
      if (h > a) pHome += P[h][a];
      else if (h === a) pDraw += P[h][a];
      else pAway += P[h][a];
    }

    // ── Goles Over/Under ─────────────────────────────────────
    const _ou = (line) => {
      let over = 0, under = 0;
      for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
        const g = h + a;
        if (g > line) over += P[h][a];
        else under += P[h][a];
      }
      return { over: +over.toFixed(4), under: +under.toFixed(4) };
    };

    // ── BTTS ─────────────────────────────────────────────────
    let pBttsYes = 0, pBttsNo = 0;
    for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
      if (h > 0 && a > 0) pBttsYes += P[h][a];
      else pBttsNo += P[h][a];
    }

    // ── Goles por equipo ─────────────────────────────────────
    const _ouTeam = (lambda, line) => {
      let over = 0;
      for (let g = Math.ceil(line + 0.01); g <= 8; g++) over += _poissonPMF(lambda, g);
      return { over: +over.toFixed(4), under: +(1 - over).toFixed(4) };
    };

    // ── Resultado al Descanso (usando 50% de los lambdas) ───
    const lH2 = lH * 0.48, lA2 = lA * 0.48;
    const PH = _poissonMatrix(lH2, lA2, 4);
    let htHome = 0, htDraw = 0, htAway = 0;
    for (let h = 0; h <= 4; h++) for (let a = 0; a <= 4; a++) {
      if (h > a) htHome += PH[h][a];
      else if (h === a) htDraw += PH[h][a];
      else htAway += PH[h][a];
    }

    // ── Hándicap Asiático ────────────────────────────────────
    const _ahcp = (line) => {
      // line negativo = equipo local da ventaja
      let homeWin = 0, awayWin = 0, push = 0;
      for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
        const diff = (h - a) + line;
        if (diff > 0) homeWin += P[h][a];
        else if (diff < 0) awayWin += P[h][a];
        else push += P[h][a];
      }
      return { home: +homeWin.toFixed(4), away: +awayWin.toFixed(4), push: +push.toFixed(4) };
    };

    // ── Córners (modelo de Poisson paralelo) ─────────────────
    const corners = analysis.corners || {};
    // Córners: WC avg ~9.5 total. Ajustamos con lambdas de goles como indicador de presión.
    // lH_goal=0.5 → lCH≈4.5; lH_goal=1.5 → lCH≈6.0 (escala razonable)
    const lCH = corners.lambdaHome || +(4.2 + lH * 1.2).toFixed(2);
    const lCA = corners.lambdaAway || +(4.0 + lA * 1.2).toFixed(2);
    const lCT = lCH + lCA;
    const _corOu = (line) => ({
      over:  +_poissonTailOver(lCT, line).toFixed(4),
      under: +_poissonTailUnder(lCT, line).toFixed(4),
    });

    // ── Tarjetas (árbitro engine) ────────────────────────────
    const refProfile = (typeof RefEngine !== 'undefined')
      ? RefEngine.getProfile() : { avgYellow: 4.2, avgRed: 0.22 };
    const lCards = refProfile.avgYellow + refProfile.avgRed * 2;
    const pRedCard = 1 - Math.exp(-refProfile.avgRed);
    const _cardOu = (line) => ({
      over:  +_poissonTailOver(lCards, line).toFixed(4),
      under: +_poissonTailUnder(lCards, line).toFixed(4),
    });

    // ── Minuto del Primer Gol (exponential) ──────────────────
    const ratePerMin = (lH + lA) / 90;
    const _noGoalBy  = (t) => Math.exp(-ratePerMin * t);
    const pFirstGoalBefore35 = +(1 - _noGoalBy(35)).toFixed(4);
    const pFirstGoalBefore45 = +(1 - _noGoalBy(45)).toFixed(4);

    // ── Jugadores estrella de cada equipo ────────────────────
    const homeSquad = _getSquad(homeKey);
    const awaySquad = _getSquad(awayKey);
    const homeStar  = homeSquad[0];
    const awayStar  = awaySquad[0];

    // ── Prob de anota y gana ─────────────────────────────────
    const scoreAndWinHome = pHome * (1 - Math.exp(-lH * 0.8));
    const scoreAndWinAway = pAway * (1 - Math.exp(-lA * 0.8));

    const ou15 = _ou(1.5), ou25 = _ou(2.5), ou35 = _ou(3.5), ou45 = _ou(4.5);
    const ah_m05 = _ahcp(-0.5), ah_m10 = _ahcp(-1.0), ah_m15 = _ahcp(-1.5);
    const ah_p05 = _ahcp(0.5),  ah_p10 = _ahcp(1.0);

    return {
      homeKey, awayKey, lH, lA,
      analysis,
      meta: analysis.meta,

      // 1X2
      result_1x2: { home: +pHome.toFixed(4), draw: +pDraw.toFixed(4), away: +pAway.toFixed(4) },

      // Doble Oportunidad
      double_chance: {
        '1X': +Math.min(0.97, pHome + pDraw).toFixed(4),
        'X2': +Math.min(0.97, pDraw + pAway).toFixed(4),
        '12': +Math.min(0.97, pHome + pAway).toFixed(4),
      },

      // Empate anula apuesta
      draw_no_bet: {
        home: +( pHome / (pHome + pAway) ).toFixed(4),
        away: +( pAway / (pHome + pAway) ).toFixed(4),
      },

      // Hándicap Asiático
      asian_hcp: {
        '-0.5':  ah_m05,  '-1.0':  ah_m10, '-1.5': ah_m15,
        '+0.5':  ah_p05,  '+1.0':  ah_p10,
      },

      // Goles O/U
      goals_ou_15: ou15, goals_ou_25: ou25,
      goals_ou_35: ou35, goals_ou_45: ou45,

      // BTTS
      btts: { yes: +pBttsYes.toFixed(4), no: +pBttsNo.toFixed(4) },
      btts_goals_25: { yes: +( pBttsYes * ou25.over ).toFixed(4) },

      // Goles por equipo
      goals_home_ou: {
        '0.5': _ouTeam(lH, 0.5), '1.5': _ouTeam(lH, 1.5), '2.5': _ouTeam(lH, 2.5),
      },
      goals_away_ou: {
        '0.5': _ouTeam(lA, 0.5), '1.5': _ouTeam(lA, 1.5), '2.5': _ouTeam(lA, 2.5),
      },

      // Mitades
      goals_1h_ou: {
        '0.5': { over: +(1 - _poissonTailUnder(lH2 + lA2, 0.5)).toFixed(4), under: +_poissonTailUnder(lH2 + lA2, 0.5).toFixed(4) },
        '1.5': { over: +_poissonTailOver(lH2 + lA2, 1.5).toFixed(4), under: +_poissonTailUnder(lH2 + lA2, 1.5).toFixed(4) },
      },

      // HT
      ht_result: { home: +htHome.toFixed(4), draw: +htDraw.toFixed(4), away: +htAway.toFixed(4) },

      // Córners
      corners_ou_85: _corOu(8.5), corners_ou_95: _corOu(9.5), corners_ou_105: _corOu(10.5),
      corners_home_ou: {
        '4.5': { over: +_poissonTailOver(lCH, 4.5).toFixed(4), under: +_poissonTailUnder(lCH, 4.5).toFixed(4) },
        '5.5': { over: +_poissonTailOver(lCH, 5.5).toFixed(4), under: +_poissonTailUnder(lCH, 5.5).toFixed(4) },
      },

      // Tarjetas
      cards_ou_35: _cardOu(3.5), cards_ou_45: _cardOu(4.5),
      red_card:   { yes: +pRedCard.toFixed(4), no: +(1 - pRedCard).toFixed(4) },

      // Tiempo del gol
      first_goal_time: {
        before_35: pFirstGoalBefore35,
        before_45: pFirstGoalBefore45,
        after_45:  +(1 - pFirstGoalBefore45).toFixed(4),
      },

      // Anota y gana
      score_win: { home: +scoreAndWinHome.toFixed(4), away: +scoreAndWinAway.toFixed(4) },

      // Jugadores
      players: {
        homeStar: homeStar ? predictPlayer(homeStar, homeKey, awayKey) : null,
        awayStar: awayStar ? predictPlayer(awayStar, awayKey, homeKey) : null,
        homeSquad: homeSquad.slice(0,5).map(p => predictPlayer(p, homeKey, awayKey)),
        awaySquad: awaySquad.slice(0,5).map(p => predictPlayer(p, awayKey, homeKey)),
      },

      // Comunidad DoradoBet
      community: {
        home: _getCommunity(homeKey),
        away: _getCommunity(awayKey),
      },
    };
  }

  // ────────────────────────────────────────────────────────────
  //  GENERADOR DE PICKS CON RIESGO Y NARRATIVA (IA-Zak)
  // ────────────────────────────────────────────────────────────

  /**
   * El cerebro de IA-Zak: genera picks rankeados para un partido
   * con evaluación de riesgo, edge, y narrativa explicativa.
   */
  function generatePicks(homeKey, awayKey, marketOdds = {}) {
    const mkt = calcAllMarkets(homeKey, awayKey);
    if (mkt.error) return { error: mkt.error };

    const picks = [];
    const community = mkt.community;
    const meta = mkt.meta || {};

    const hName = meta.home?.name || homeKey;
    const aName = meta.away?.name || awayKey;
    const hFlag = meta.home?.flag || '🏠';
    const aFlag = meta.away?.flag || '✈️';

    // ── Helper: agregar pick ─────────────────────────────────
    const addPick = (marketId, label, modelProb, odds, extraNarrative = '') => {
      if (!odds || odds < CFG.MIN_ODDS || odds > CFG.MAX_ODDS) return;
      if (modelProb < CFG.MIN_PROB) return;
      const impliedProb = 1 / odds;
      const edge = modelProb - impliedProb;
      if (edge < CFG.MIN_EDGE) return;

      const risk = _calcRisk(edge, modelProb, marketId);
      const stars = _stars(edge, modelProb);
      const narrative = _buildNarrative(marketId, modelProb, edge, mkt, hName, aName, hFlag, aFlag, extraNarrative);

      picks.push({
        marketId, label, modelProb, impliedProb, odds, edge, risk, stars, narrative,
        edgeLabel: `${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)}%`,
        marketName: (_marketKnowledge.markets[marketId] || {}).name || label,
        category: _resolveCategory(marketId),
      });
    };

    // ── Cuotas simuladas DEMO si no vienen de DoradoBet ──────
    const O = _simulateOdds(mkt, marketOdds);

    // ── 1. Resultado 1X2 ──────────────────────────────────────
    addPick('result_1x2_home', `${hFlag} ${hName} Gana`, mkt.result_1x2.home, O.r1x2_home);
    addPick('result_1x2_draw', `Empate`, mkt.result_1x2.draw, O.r1x2_draw);
    addPick('result_1x2_away', `${aFlag} ${aName} Gana`, mkt.result_1x2.away, O.r1x2_away);

    // ── 2. Doble Oportunidad ──────────────────────────────────
    addPick('double_chance_1X', `${hFlag} ${hName} o Empate`, mkt.double_chance['1X'], O.dc_1x);
    addPick('double_chance_X2', `Empate o ${aFlag} ${aName}`, mkt.double_chance['X2'], O.dc_x2);
    addPick('double_chance_12', `${hFlag} Gana Cualquiera`, mkt.double_chance['12'], O.dc_12);

    // ── 3. Goles O/U ─────────────────────────────────────────
    addPick('goals_ou_15_over', `Más de 1.5 Goles`, mkt.goals_ou_15.over, O.ou15_over);
    addPick('goals_ou_25_over', `Más de 2.5 Goles`, mkt.goals_ou_25.over, O.ou25_over);
    addPick('goals_ou_25_under','Menos de 2.5 Goles', mkt.goals_ou_25.under, O.ou25_under);
    addPick('goals_ou_35_over', `Más de 3.5 Goles`, mkt.goals_ou_35.over, O.ou35_over);
    addPick('goals_ou_35_under','Menos de 3.5 Goles', mkt.goals_ou_35.under, O.ou35_under);

    // ── 4. BTTS ───────────────────────────────────────────────
    addPick('btts_yes', `Ambos Equipos Anotan — Sí`, mkt.btts.yes, O.btts_yes);
    addPick('btts_no',  `Ambos Equipos Anotan — No`, mkt.btts.no,  O.btts_no);
    addPick('btts_goals_25', `BTTS + Más 2.5 Goles`, mkt.btts_goals_25.yes, O.btts_ou25);

    // ── 5. Hándicap Asiático ──────────────────────────────────
    const strongerIsHome = mkt.result_1x2.home > mkt.result_1x2.away;
    if (strongerIsHome) {
      addPick('ah_home_m05', `${hFlag} ${hName} -0.5 (HCP)`, mkt.asian_hcp['-0.5'].home, O.ah_home_m05);
      addPick('ah_home_m10', `${hFlag} ${hName} -1.0 (HCP)`, mkt.asian_hcp['-1.0'].home, O.ah_home_m10);
    } else {
      addPick('ah_away_p05', `${aFlag} ${aName} +0.5 (HCP)`, mkt.asian_hcp['+0.5'].away, O.ah_away_p05);
      addPick('ah_away_p10', `${aFlag} ${aName} +1.0 (HCP)`, mkt.asian_hcp['+1.0'].away, O.ah_away_p10);
    }

    // ── 6. HT Resultado ───────────────────────────────────────
    addPick('ht_home',  `${hFlag} ${hName} Gana Descanso`, mkt.ht_result.home, O.ht_home);
    addPick('ht_draw',  `Empate al Descanso`, mkt.ht_result.draw, O.ht_draw);

    // ── 7. Goles por equipo ───────────────────────────────────
    addPick('goals_home_05_over', `${hFlag} ${hName} Marca`, mkt.goals_home_ou['0.5'].over, O.home_goals_05);
    addPick('goals_away_05_over', `${aFlag} ${aName} Marca`, mkt.goals_away_ou['0.5'].over, O.away_goals_05);
    addPick('goals_home_15_over', `${hFlag} ${hName} Más 1.5`, mkt.goals_home_ou['1.5'].over, O.home_goals_15);

    // ── 8. Mitades ────────────────────────────────────────────
    addPick('1h_over_05', `1ra Mitad Más 0.5 Goles`, mkt.goals_1h_ou['0.5'].over, O.h1_ou05);
    addPick('1h_under_15','1ra Mitad Menos 1.5 Goles', mkt.goals_1h_ou['1.5'].under, O.h1_under15);

    // ── 9. Córners ────────────────────────────────────────────
    addPick('corners_85_over',  `Más 8.5 Córners`,  mkt.corners_ou_85.over,  O.cor85_over);
    addPick('corners_95_over',  `Más 9.5 Córners`,  mkt.corners_ou_95.over,  O.cor95_over);
    addPick('corners_95_under', `Menos 9.5 Córners`,mkt.corners_ou_95.under, O.cor95_under);
    addPick('corners_105_over', `Más 10.5 Córners`, mkt.corners_ou_105.over, O.cor105_over);

    // ── 10. Tarjetas ──────────────────────────────────────────
    addPick('cards_35_over',  `Más 3.5 Tarjetas`,  mkt.cards_ou_35.over,  O.cards35_over);
    addPick('cards_35_under', `Menos 3.5 Tarjetas`, mkt.cards_ou_35.under, O.cards35_under);
    addPick('cards_45_over',  `Más 4.5 Tarjetas`,  mkt.cards_ou_45.over,  O.cards45_over);
    addPick('red_card_yes',   `Tarjeta Roja en el Partido`, mkt.red_card.yes, O.red_card);

    // ── 11. Tiempo del primer gol ─────────────────────────────
    addPick('first_goal_b35', `1er Gol Antes del Min 35`, mkt.first_goal_time.before_35, O.fg_b35);
    addPick('first_goal_b45', `1er Gol Antes del Descanso`, mkt.first_goal_time.before_45, O.fg_b45);

    // ── 12. Anota y Gana ──────────────────────────────────────
    addPick('score_win_home', `${hFlag} ${hName} Anota y Gana`, mkt.score_win.home, O.sw_home);
    addPick('score_win_away', `${aFlag} ${aName} Anota y Gana`, mkt.score_win.away, O.sw_away);

    // ── 13. Jugadores ─────────────────────────────────────────
    const hStar = mkt.players.homeStar;
    const aStar = mkt.players.awayStar;
    if (hStar) {
      addPick('anytime_scorer_home', `${hStar.player} Anota`,
        hStar.predictions.scoreProbability, O.star_home_anytime,
        `Historial: ${(hStar.predictions.scoreProbability * 100).toFixed(0)}% prob de gol.`
      );
    }
    if (aStar) {
      addPick('anytime_scorer_away', `${aStar.player} Anota`,
        aStar.predictions.scoreProbability, O.star_away_anytime,
        `Historial: ${(aStar.predictions.scoreProbability * 100).toFixed(0)}% prob de gol.`
      );
    }

    // ── Boost de comunidad ────────────────────────────────────
    const commHome = community.home;
    const commAway = community.away;
    picks.forEach(p => {
      const isHotHome = commHome.hotPick && p.label.toLowerCase().includes(commHome.hotPick.toLowerCase().slice(0,8));
      const isHotAway = commAway.hotPick && p.label.toLowerCase().includes(commAway.hotPick.toLowerCase().slice(0,8));
      if (isHotHome || isHotAway) {
        p.communityBoosted = true;
        p.stars = Math.min(5, p.stars + 1);
      }
    });

    // ── Ordenar por edge × stars × prob ─────────────────────
    picks.sort((a, b) => (b.edge * b.stars * b.modelProb) - (a.edge * a.stars * a.modelProb));

    const topPicks = picks.slice(0, CFG.TOP_PICKS);

    // ── Resumen del análisis ─────────────────────────────────
    const summary = _buildSummary(homeKey, awayKey, mkt, topPicks, hName, aName, hFlag, aFlag);

    return {
      agent: NAME,
      version: VERSION,
      homeKey, awayKey,
      homeName: hName,  awayName: aName,
      homeFlag: hFlag,  awayFlag: aFlag,
      markets: mkt,
      topPicks,
      allPicks: picks,
      summary,
      community: { home: commHome, away: commAway },
      generatedAt: Date.now(),
    };
  }

  // ────────────────────────────────────────────────────────────
  //  CUOTAS SIMULADAS DEMO (estilo DoradoBet)
  // ────────────────────────────────────────────────────────────
  function _simulateOdds(mkt, overrides = {}) {
    // DoradoBet usa márgenes distintos por mercado (modelo simplificado de la casa)
    // El modelo de la casa tiene MENOS precisión que nuestro modelo Poisson →
    // algunos mercados están "mal preciados" → edge positivo para nosotros.
    const _odd = (prob, marketMargin = 0.08) => {
      if (!prob || prob <= 0.01) return null;
      // La casa usa una estimación menos precisa (±12% vs nuestra probabilidad)
      const houseBias  = 1 + (Math.random() * 0.24 - 0.12); // ±12% error de la casa
      const houseProb  = Math.min(0.97, Math.max(0.03, prob * houseBias));
      // La casa aplica su margen sobre su (imprecisa) estimación
      const raw = 1 / (houseProb * (1 + marketMargin));
      return +Math.max(1.05, raw).toFixed(2);
    };
    // Márgenes por categoría (DoradoBet)
    const M = { result: 0.06, ou: 0.07, btts: 0.08, hcp: 0.07, corners: 0.09, cards: 0.10, player: 0.12, time: 0.11 };

    return {
      r1x2_home: overrides.r1x2_home || _odd(mkt.result_1x2.home, M.result),
      r1x2_draw: overrides.r1x2_draw || _odd(mkt.result_1x2.draw, M.result),
      r1x2_away: overrides.r1x2_away || _odd(mkt.result_1x2.away, M.result),
      dc_1x:     _odd(mkt.double_chance['1X'], M.result),
      dc_x2:     _odd(mkt.double_chance['X2'], M.result),
      dc_12:     _odd(mkt.double_chance['12'], M.result),
      ou15_over: _odd(mkt.goals_ou_15.over, M.ou),
      ou25_over: _odd(mkt.goals_ou_25.over, M.ou),
      ou25_under:_odd(mkt.goals_ou_25.under, M.ou),
      ou35_over: _odd(mkt.goals_ou_35.over, M.ou),
      ou35_under:_odd(mkt.goals_ou_35.under, M.ou),
      btts_yes:  _odd(mkt.btts.yes, M.btts),
      btts_no:   _odd(mkt.btts.no, M.btts),
      btts_ou25: _odd(mkt.btts_goals_25.yes, M.btts),
      ah_home_m05: _odd(mkt.asian_hcp['-0.5'].home, M.hcp),
      ah_home_m10: _odd(mkt.asian_hcp['-1.0'].home, M.hcp),
      ah_away_p05: _odd(mkt.asian_hcp['+0.5'].away, M.hcp),
      ah_away_p10: _odd(mkt.asian_hcp['+1.0'].away, M.hcp),
      ht_home:   _odd(mkt.ht_result.home, M.result),
      ht_draw:   _odd(mkt.ht_result.draw, M.result),
      home_goals_05: _odd(mkt.goals_home_ou['0.5'].over, M.ou),
      away_goals_05: _odd(mkt.goals_away_ou['0.5'].over, M.ou),
      home_goals_15: _odd(mkt.goals_home_ou['1.5'].over, M.ou),
      h1_ou05:   _odd(mkt.goals_1h_ou['0.5'].over, M.ou),
      h1_under15:_odd(mkt.goals_1h_ou['1.5'].under, M.ou),
      cor85_over: _odd(mkt.corners_ou_85.over, M.corners),
      cor95_over: _odd(mkt.corners_ou_95.over, M.corners),
      cor95_under:_odd(mkt.corners_ou_95.under, M.corners),
      cor105_over:_odd(mkt.corners_ou_105.over, M.corners),
      cards35_over: _odd(mkt.cards_ou_35.over, M.cards),
      cards35_under:_odd(mkt.cards_ou_35.under, M.cards),
      cards45_over: _odd(mkt.cards_ou_45.over, M.cards),
      red_card:  _odd(mkt.red_card.yes, M.cards),
      fg_b35:    _odd(mkt.first_goal_time.before_35, M.time),
      fg_b45:    _odd(mkt.first_goal_time.before_45, M.time),
      sw_home:   _odd(mkt.score_win.home, M.result),
      sw_away:   _odd(mkt.score_win.away, M.result),
      star_home_anytime: _odd(mkt.players.homeStar?.predictions.scoreProbability || 0.3, M.player),
      star_away_anytime: _odd(mkt.players.awayStar?.predictions.scoreProbability || 0.3, M.player),
    };
  }

  // ────────────────────────────────────────────────────────────
  //  EVALUACIÓN DE RIESGO
  // ────────────────────────────────────────────────────────────
  function _resolveCategory(marketId) {
    const id = marketId.toLowerCase();
    if (id.includes('result') || id.includes('double_chance') || id.includes('draw_no') || id.includes('ht_') || id.includes('score_win')) return 'resultado';
    if (id.includes('goals_ou') || id.includes('btts') || id.includes('goals_home') || id.includes('goals_away') || id.includes('1h_') || id.includes('exact')) return 'goles';
    if (id.includes('ah_') || id.includes('asian_hcp') || id.includes('euro_hcp')) return 'handicap';
    if (id.includes('corner')) return 'corners';
    if (id.includes('card') || id.includes('red_card')) return 'tarjetas';
    if (id.includes('scorer') || id.includes('anytime') || id.includes('player') || id.includes('assist')) return 'jugador';
    if (id.includes('first_goal') || id.includes('time') || id.includes('minute')) return 'tiempo';
    return 'otros';
  }

  function _calcRisk(edge, modelProb, marketId) {
    // Mercados de mayor volatilidad
    const HIGH_VOL_MARKETS = ['exact_score','first_scorer','last_scorer','player_cards','red_card','ht_ft'];
    const MED_VOL_MARKETS  = ['anytime_scorer_home','anytime_scorer_away','cards_ou_35','first_goal_time'];

    const isHighVol = HIGH_VOL_MARKETS.some(m => marketId.startsWith(m));
    const isMedVol  = MED_VOL_MARKETS.some(m => marketId.includes(m));

    let score = 0;
    if (edge >= CFG.RISK_EDGE_LOW)  score += 3;
    else if (edge >= CFG.RISK_EDGE_MED) score += 2;
    else score += 1;

    if (modelProb >= 0.65) score += 2;
    else if (modelProb >= 0.50) score += 1;

    if (isHighVol) score -= 2;
    else if (isMedVol) score -= 1;

    if (score >= 4)      return { level: 'low',    label: '🟢 BAJO RIESGO',   color: 'text-emerald-400', bg: 'bg-emerald-900/40' };
    else if (score >= 2) return { level: 'medium', label: '🟡 RIESGO MEDIO',  color: 'text-amber-400',   bg: 'bg-amber-900/40' };
    else                 return { level: 'high',   label: '🔴 ALTO RIESGO',   color: 'text-red-400',     bg: 'bg-red-900/40' };
  }

  function _stars(edge, modelProb) {
    if (edge >= 0.10 && modelProb >= 0.65) return 5;
    if (edge >= 0.06 && modelProb >= 0.55) return 4;
    if (edge >= 0.035 && modelProb >= 0.45) return 3;
    if (edge >= 0.020 && modelProb >= 0.35) return 2;
    return 1;
  }

  // ────────────────────────────────────────────────────────────
  //  NARRATIVA IA-Zak
  // ────────────────────────────────────────────────────────────
  function _buildNarrative(marketId, prob, edge, mkt, hName, aName, hFlag, aFlag, extra = '') {
    const pct   = (prob * 100).toFixed(1);
    const edgePct = (edge * 100).toFixed(1);
    const lH    = mkt.lH.toFixed(2), lA = mkt.lA.toFixed(2);

    const intros = [
      `📊 Modelo Poisson calcula **${pct}%** de probabilidad real.`,
      `🤖 IA-Zak detecta **edge de ${edgePct}%** vs la casa.`,
      `📈 El mercado sub-valora este resultado: **${pct}%** real vs cuota implícita.`,
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];

    let body = '';
    if (marketId.includes('result_1x2') || marketId.includes('double_chance')) {
      body = `Lambdas: ${hFlag}${hName} λ=${lH} · ${aFlag}${aName} λ=${lA}. El diferencial de ataque/defensa favorece esta selección.`;
    } else if (marketId.includes('goals_ou')) {
      body = `Con λ total de ${(parseFloat(lH) + parseFloat(lA)).toFixed(2)} goles esperados, este Over/Under tiene sólido respaldo estadístico.`;
    } else if (marketId.includes('btts')) {
      body = `Ambos equipos tienen λ>${Math.min(parseFloat(lH), parseFloat(lA)).toFixed(2)}, indicando que los dos tienen capacidad de anotar.`;
    } else if (marketId.includes('corners')) {
      body = `El estilo de presión alta de ambos equipos genera entre 9-11 córners por partido en promedio histórico del Mundial.`;
    } else if (marketId.includes('cards')) {
      body = `El árbitro asignado promedia ${mkt.analysis?.refProfile?.avgYellow?.toFixed(1) || '4.2'} tarjetas/partido. Esta línea es favorable.`;
    } else if (marketId.includes('asian_hcp') || marketId.includes('ah_')) {
      body = `El hándicap asiático elimina el empate y ajusta el edge puro de rendimiento de ambas selecciones.`;
    } else if (marketId.includes('anytime_scorer')) {
      const star = marketId.includes('home') ? mkt.players.homeStar : mkt.players.awayStar;
      if (star) body = `${star.player}: ${(star.predictions.shotsPerGame||2.1).toFixed(1)} disparos/partido. Alta propensión de anotar.`;
    } else if (marketId.includes('first_goal')) {
      body = `Tasa de goles ${((parseFloat(lH) + parseFloat(lA)) / 90 * 100).toFixed(2)}%/min → alta probabilidad de gol tempranero.`;
    } else if (marketId.includes('score_win')) {
      body = `Combina la probabilidad de victoria con la certeza de que el equipo marque.`;
    }

    const communityBoost = (mkt.community?.home?.sentiment > 0.75)
      ? ` 📣 Comunidad DoradoBet apuesta fuerte por ${hFlag}${hName} (${(mkt.community.home.sentiment*100).toFixed(0)}% sentimiento positivo).`
      : '';

    return `${intro} ${body}${extra ? ' ' + extra : ''}${communityBoost}`.trim();
  }

  function _buildSummary(homeKey, awayKey, mkt, picks, hName, aName, hFlag, aFlag) {
    const lH = mkt.lH.toFixed(2), lA = mkt.lA.toFixed(2);
    const favHome = mkt.result_1x2.home > mkt.result_1x2.away;
    const fav = favHome ? `${hFlag} ${hName}` : `${aFlag} ${aName}`;
    const favProb = favHome ? (mkt.result_1x2.home * 100).toFixed(1) : (mkt.result_1x2.away * 100).toFixed(1);
    const totalGoals = (parseFloat(lH) + parseFloat(lA)).toFixed(2);

    const comm = favHome ? mkt.community.home : mkt.community.away;
    const commTrend = comm?.trending?.join(', ') || '—';

    return {
      headline: `${hFlag} ${hName} vs ${aFlag} ${aName}`,
      favorite: fav,
      favoriteProb: favProb + '%',
      expectedGoals: totalGoals,
      lambdas: { home: lH, away: lA },
      outlook: totalGoals > 2.8
        ? `Partido de muchos goles. λ total ${totalGoals} — busca mercados Over y BTTS.`
        : totalGoals > 2.0
        ? `Partido equilibrado. λ total ${totalGoals} — 2.5 goles es la línea clave.`
        : `Partido defensivo. λ total ${totalGoals} — mercados Under y 1X2 tienen más valor.`,
      communityTrends: commTrend,
      topPick: picks[0]
        ? `${picks[0].label} @ ${picks[0].odds?.toFixed(2)} (Edge: ${picks[0].edgeLabel})`
        : 'Sin valor claro',
    };
  }

  // ────────────────────────────────────────────────────────────
  //  POISSON HELPERS
  // ────────────────────────────────────────────────────────────
  function _poissonPMF(lambda, k) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    let logP = -lambda + k * Math.log(lambda);
    for (let i = 1; i <= k; i++) logP -= Math.log(i);
    return Math.exp(logP);
  }

  function _poissonMatrix(lH, lA, maxG) {
    const P = [];
    for (let h = 0; h <= maxG; h++) {
      P[h] = [];
      for (let a = 0; a <= maxG; a++) {
        P[h][a] = _poissonPMF(lH, h) * _poissonPMF(lA, a);
      }
    }
    return P;
  }

  function _poissonTailOver(lambda, line) {
    let p = 0;
    const cap = Math.ceil(line) + 15;
    for (let k = Math.ceil(line + 0.01); k <= cap; k++) p += _poissonPMF(lambda, k);
    return Math.min(0.999, p);
  }

  function _poissonTailUnder(lambda, line) {
    return Math.max(0.001, 1 - _poissonTailOver(lambda, line));
  }

  // ────────────────────────────────────────────────────────────
  //  SQUADS HELPER
  // ────────────────────────────────────────────────────────────
  function _getSquad(teamKey) {
    if (typeof SQUADS === 'undefined') return [];
    const entry = SQUADS[teamKey];
    if (!entry) return [];
    // SQUADS[key] puede ser { coach, players: [...] } o directamente un array
    const players = Array.isArray(entry) ? entry : (entry.players || []);
    const attackers = players.filter(p => ['CF','LW','RW','SS','FW','ST'].some(r => (p.pos||'').includes(r)));
    const mids      = players.filter(p => ['CAM','CM','CDM','AM'].some(r => (p.pos||'').includes(r)));
    const all       = [...attackers, ...mids, ...players];
    // Deduplicar por nombre
    const seen = new Set();
    return all.filter(p => { const n = p.name||p; if (seen.has(n)) return false; seen.add(n); return true; })
      .map(p => p.name || p).slice(0, 5);
  }

  // ────────────────────────────────────────────────────────────
  //  API PÚBLICA
  // ────────────────────────────────────────────────────────────
  return {
    name: NAME,
    version: VERSION,

    // Análisis completo de un partido con picks rankeados
    analyze: generatePicks,

    // Cálculo de todos los mercados (sin filtro de edge)
    calcAllMarkets,

    // Historial de jugadores
    recordPlayerMatch,
    getPlayerProfile,
    predictPlayer,
    getAllPlayers: () => ({ ..._playerDB }),

    // Conocimiento de mercados (aprendido de DoradoBet)
    getMarkets: () => _marketKnowledge.markets,

    // Estado del agente
    getState: () => ({
      agentName: NAME,
      version: VERSION,
      demoMode: CFG.DEMO_MODE,
      playersTracked: Object.keys(_playerDB).length,
      studyLogEntries: _state.studyLog.length,
      lastAnalysis: _state.lastAnalysis,
    }),

    // Llamar desde el UI para refrescar picks del fixture actual
    refreshForFixture(homeKey, awayKey, odds = {}) {
      _state.isRunning = true;
      const result = generatePicks(homeKey, awayKey, odds);
      _state.lastAnalysis = result;
      _state.analysisCache[`${homeKey}-${awayKey}`] = result;
      _state.isRunning = false;

      // Dispatch event para que el UI lo capture
      document.dispatchEvent(new CustomEvent('zak-picks-ready', { detail: result }));
      return result;
    },

    // Log de aprendizaje
    logStudy(msg) {
      _state.studyLog.push({ ts: Date.now(), msg });
      if (_state.studyLog.length > 100) _state.studyLog.shift();
    },

    // Cache de análisis
    getCached: (homeKey, awayKey) => _state.analysisCache[`${homeKey}-${awayKey}`] || null,
  };

})();

// Exportar globalmente
window.ZakAgent = ZakAgent;
console.log(`[${ZakAgent.name} v${ZakAgent.version}] Agente iniciado ✅`);
