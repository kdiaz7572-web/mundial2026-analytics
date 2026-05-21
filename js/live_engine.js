// ============================================================
//  LIVE_ENGINE.JS — Motor de Datos en Vivo
//
//  Arquitectura lista para API-Football v3.
//  En DEMO_MODE=true ejecuta un simulador interno que corre
//  los partidos en tiempo real (1 tick = 1 minuto de juego).
//
//  Para producción: pon DEMO_MODE=false y tu API_KEY.
// ============================================================

const LIVE_CONFIG = {
  API_KEY:       'YOUR_API_FOOTBALL_KEY_HERE',
  BASE_URL:      'https://v3.football.api-sports.io',
  LEAGUE_ID:     1,       // FIFA World Cup en API-Football
  SEASON:        2026,
  POLL_LIVE_MS:  30_000,  // Cada 30s cuando hay partidos en vivo
  POLL_SCHED_MS: 300_000, // Cada 5min para el calendario
  DEMO_MODE:     true,    // ← cambiar a false para usar API real
  SIM_TICK_MS:   600,     // Velocidad del simulador (600ms = 1 min simulado)
};

// ── Utilidad: normaliza un fixture crudo de API-Football ─────
function normalizeAPIFixture(apiFix) {
  const { fixture, teams, goals, statistics = [] } = apiFix;
  const homeStats = statistics.find(s => s.team.id === teams.home.id)?.statistics || [];
  const awayStats = statistics.find(s => s.team.id === teams.away.id)?.statistics || [];
  const statVal = (arr, type) => arr.find(s => s.type === type)?.value ?? null;

  return {
    fixtureId:  fixture.id,
    status:     fixture.status.short,   // NS, 1H, HT, 2H, FT...
    elapsed:    fixture.status.elapsed || 0,
    home:       teams.home.name,
    away:       teams.away.name,
    homeGoals:  goals.home,
    awayGoals:  goals.away,
    corners: {
      home: statVal(homeStats, 'Corner Kicks'),
      away: statVal(awayStats, 'Corner Kicks'),
    },
    cards: {
      homeYellow: statVal(homeStats, 'Yellow Cards') || 0,
      awayYellow: statVal(awayStats, 'Yellow Cards') || 0,
      homeRed:    statVal(homeStats, 'Red Cards')    || 0,
      awayRed:    statVal(awayStats, 'Red Cards')    || 0,
    },
  };
}

// ── Fetch real a API-Football ────────────────────────────────
async function fetchLiveFromAPI() {
  const res = await fetch(
    `${LIVE_CONFIG.BASE_URL}/fixtures?live=all&league=${LIVE_CONFIG.LEAGUE_ID}&season=${LIVE_CONFIG.SEASON}`,
    { headers: { 'x-apisports-key': LIVE_CONFIG.API_KEY } }
  );
  if (!res.ok) throw new Error(`API-Football error ${res.status}`);
  const data = await res.json();
  return (data.response || []).map(normalizeAPIFixture);
}

async function fetchFixturesByDate(dateISO) {
  const res = await fetch(
    `${LIVE_CONFIG.BASE_URL}/fixtures?league=${LIVE_CONFIG.LEAGUE_ID}&season=${LIVE_CONFIG.SEASON}&date=${dateISO}`,
    { headers: { 'x-apisports-key': LIVE_CONFIG.API_KEY } }
  );
  if (!res.ok) throw new Error(`API-Football error ${res.status}`);
  const data = await res.json();
  return (data.response || []).map(normalizeAPIFixture);
}

// ══════════════════════════════════════════════════════════════
//  SIMULADOR DEMO
//  Simula un partido completo con probabilidades Poisson por minuto.
// ══════════════════════════════════════════════════════════════
const LiveSimulator = (() => {
  const _sims = {};         // fixtureId → simState
  const _subs = [];         // callbacks de actualización

  function startMatch(fixture) {
    if (_sims[fixture.id]) return;          // Ya corriendo

    // Obtener lambdas del modelo si está disponible
    const hExt = typeof getExtStats === 'function' ? getExtStats(fixture.home) : DEFAULT_TEAM_EXT;
    const aExt = typeof getExtStats === 'function' ? getExtStats(fixture.away) : DEFAULT_TEAM_EXT;
    const lambdas = typeof mmLambdas === 'function'
      ? mmLambdas(hExt, aExt)
      : { home: 1.2, away: 0.9 };

    // Probabilidades por minuto (Distribución de Poisson continua)
    const p = {
      goalH:   lambdas.home                            / 90,
      goalA:   lambdas.away                            / 90,
      cornH:   (hExt.avg_corners_for   || 5.2)         / 90,
      cornA:   (aExt.avg_corners_for   || 4.8)         / 90,
      yellH:   (hExt.avg_yellow_cards  || 2.2)         / 90,
      yellA:   (aExt.avg_yellow_cards  || 2.2)         / 90,
      redH:    (hExt.avg_red_cards     || 0.10)        / 90,
      redA:    (aExt.avg_red_cards     || 0.10)        / 90,
    };

    const state = {
      fixtureId: fixture.id, home: fixture.home, away: fixture.away,
      elapsed: 0, status: 'PRE',
      homeGoals: 0, awayGoals: 0,
      homeCorners: 0, awayCorners: 0,
      homeYellow: 0, awayYellow: 0,
      homeRed: 0,    awayRed: 0,
      interval: null,
    };

    state.interval = setInterval(() => {
      state.elapsed++;

      // Transiciones de estado
      if (state.elapsed === 1)  state.status = '1H';
      if (state.elapsed === 45) state.status = 'HT';
      if (state.elapsed === 46) state.status = '2H';
      if (state.elapsed > 90)  { _finishMatch(state, fixture, p); return; }

      // No generar eventos en medio tiempo
      if (state.status === 'HT') { _notify(state); return; }

      // Eventos aleatorios (Poisson por minuto)
      if (Math.random() < p.goalH) state.homeGoals++;
      if (Math.random() < p.goalA) state.awayGoals++;
      if (Math.random() < p.cornH) state.homeCorners++;
      if (Math.random() < p.cornA) state.awayCorners++;
      if (Math.random() < p.yellH) state.homeYellow++;
      if (Math.random() < p.yellA) state.awayYellow++;
      if (Math.random() < p.redH)  state.homeRed++;
      if (Math.random() < p.redA)  state.awayRed++;

      _notify(state);
    }, LIVE_CONFIG.SIM_TICK_MS);

    _sims[fixture.id] = state;
    console.log(`[Simulator] ⚽ Iniciado: ${fixture.home} vs ${fixture.away} (id=${fixture.id})`);
  }

  function _finishMatch(state, fixture, p) {
    state.status = 'FT';
    clearInterval(state.interval);

    // 1. Actualizar fixture en el array global
    const fx = FIXTURES.find(f => f.id === fixture.id);
    if (fx) {
      fx.homeGoals  = state.homeGoals;
      fx.awayGoals  = state.awayGoals;
      fx.liveStatus = 'FT';
      fx.liveData   = {
        corners: state.homeCorners + state.awayCorners,
        cards:   state.homeYellow  + state.awayYellow,
      };
    }

    // 2. Actualizar perfil dinámico del árbitro
    const refId = FIXTURE_REFEREES[fixture.id] || 'default';
    if (typeof RefEngine !== 'undefined') {
      RefEngine.recordMatch(refId, {
        yellows: state.homeYellow + state.awayYellow,
        reds:    state.homeRed    + state.awayRed,
      });
    }

    _notify(state);
    delete _sims[fixture.id];
    console.log(`[Simulator] 🏁 FT: ${fixture.home} ${state.homeGoals}–${state.awayGoals} ${fixture.away}`);
    console.log(`   Córners: ${state.homeCorners + state.awayCorners} | 🟨: ${state.homeYellow + state.awayYellow} | 🟥: ${state.homeRed + state.awayRed}`);
  }

  function _notify(state) {
    const upd = {
      fixtureId: state.fixtureId,
      status:    state.status,
      elapsed:   state.elapsed,
      homeGoals: state.homeGoals,
      awayGoals: state.awayGoals,
      corners:   { home: state.homeCorners, away: state.awayCorners },
      cards: {
        homeYellow: state.homeYellow, awayYellow: state.awayYellow,
        homeRed:    state.homeRed,    awayRed:    state.awayRed,
      },
    };
    _subs.forEach(cb => { try { cb(upd); } catch (e) { /**/ } });
  }

  return {
    startMatch,
    stopMatch(id)   { const s = _sims[id]; if (s) { clearInterval(s.interval); delete _sims[id]; } },
    stopAll()       { Object.keys(_sims).forEach(id => this.stopMatch(+id)); },
    onUpdate(cb)    { _subs.push(cb); return () => { _subs.splice(_subs.indexOf(cb), 1); }; },
    getRunning()    { return Object.values(_sims); },
    isRunning(id)   { return !!_sims[id]; },
  };
})();

// ══════════════════════════════════════════════════════════════
//  LIVE ENGINE — Coordinador principal
// ══════════════════════════════════════════════════════════════
const LiveEngine = (() => {
  let _timer     = null;
  let _polling   = false;

  /**
   * Ingesta un array de actualizaciones de partidos y
   * aplica los cambios al estado global + fixtures.
   */
  function _ingest(updates) {
    let changed = false;
    updates.forEach(upd => {
      AppState.setLiveMatch(upd.fixtureId, upd);
      const fx = FIXTURES.find(f => f.id === upd.fixtureId);
      if (fx) {
        if (upd.status === 'FT') { fx.homeGoals = upd.homeGoals; fx.awayGoals = upd.awayGoals; }
        fx.liveStatus  = upd.status;
        fx.liveElapsed = upd.elapsed;
        fx.liveData    = { corners: upd.corners, cards: upd.cards };
        changed = true;
      }
    });
    // Actualizar contador LIVE en tiempo real (no esperar al poll)
    const liveNow = LIVE_CONFIG.DEMO_MODE
      ? LiveSimulator.getRunning().filter(s => ['1H','HT','2H'].includes(s.status)).length
      : updates.filter(u => ['1H','HT','2H'].includes(u.status)).length;
    AppState.setLiveCount(liveNow);
    if (changed) AppState.emit('fixtures-changed', null);
  }

  async function _poll() {
    if (_polling) return;
    _polling = true;
    try {
      let updates = [];
      if (LIVE_CONFIG.DEMO_MODE) {
        // En demo, las actualizaciones llegan por suscripción al simulador.
        // Aquí solo sincronizamos el estado actual de los sims corriendo.
        updates = LiveSimulator.getRunning().map(s => ({
          fixtureId: s.fixtureId, status: s.status, elapsed: s.elapsed,
          homeGoals: s.homeGoals, awayGoals: s.awayGoals,
          corners: { home: s.homeCorners, away: s.awayCorners },
          cards: { homeYellow: s.homeYellow, awayYellow: s.awayYellow,
                   homeRed: s.homeRed, awayRed: s.awayRed },
        }));
      } else {
        updates = await fetchLiveFromAPI();
      }
      if (updates.length) _ingest(updates);
      AppState.setLiveCount(
        updates.filter(u => ['1H','HT','2H'].includes(u.status)).length
      );
    } catch (e) {
      console.error('[LiveEngine]', e.message);
      AppState.emit('live-error', e.message);
    } finally {
      _polling = false;
    }
  }

  return {
    /**
     * Inicia el motor: suscribe el simulador y arranca el polling.
     */
    start() {
      if (_timer) return;
      console.log('[LiveEngine] ▶ Iniciado en modo', LIVE_CONFIG.DEMO_MODE ? 'DEMO' : 'API REAL');
      if (LIVE_CONFIG.DEMO_MODE) {
        // El simulador notifica directamente; LiveEngine reenvía a AppState
        LiveSimulator.onUpdate(upd => _ingest([upd]));
      }
      _poll();
      _timer = setInterval(_poll, LIVE_CONFIG.POLL_LIVE_MS);
    },

    stop() {
      if (_timer) { clearInterval(_timer); _timer = null; }
      if (LIVE_CONFIG.DEMO_MODE) LiveSimulator.stopAll();
      console.log('[LiveEngine] ⏹ Detenido');
    },

    /**
     * Inicia la simulación de un partido (solo DEMO_MODE).
     * @param {number} fixtureId
     */
    simulate(fixtureId) {
      if (!LIVE_CONFIG.DEMO_MODE) return console.warn('[LiveEngine] Solo funciona en DEMO_MODE');
      const fx = FIXTURES.find(f => f.id === fixtureId);
      if (!fx) return console.warn('[LiveEngine] Fixture no encontrado:', fixtureId);
      if (fx.homeGoals !== null) return console.warn('[LiveEngine] Partido ya jugado');
      LiveSimulator.startMatch(fx);
    },

    /** Fuerza una sincronización inmediata (al volver a la pestaña). */
    forceSync() { _poll(); },

    isSimulating(id) { return LiveSimulator.isRunning(id); },
  };
})();

// Sincronizar al volver a la pestaña (Page Visibility API)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) LiveEngine.forceSync();
});
