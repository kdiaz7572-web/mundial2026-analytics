// ============================================================
//  STATE_MANAGER.JS — Gestor Central de Estado + Pub/Sub
//
//  Centraliza todos los datos de la app en un único singleton.
//  Cualquier módulo puede suscribirse a eventos y recibir
//  notificaciones cuando el estado cambia, sin acoplamiento directo.
// ============================================================

const AppState = (() => {

  // ── Estado interno (no exportado directamente) ──────────────
  const _state = {
    liveMatches:  {},   // { fixtureId: LiveMatchData }
    odds:         {},   // { 'HOME-AWAY': { odds, analysis, fetchedAt } }
    referees:     {},   // { refId: { wc_matches, wc_yellows, wc_reds } }
    picks:        [],   // [ { fixture, picks[] } ] último ciclo generado
    liveCount:    0,    // partidos en vivo ahora mismo
    lastLiveSync: null,
    lastOddsSync: null,
  };

  // ── Sistema de Pub/Sub ───────────────────────────────────────
  const _listeners = {};

  /**
   * Suscribe un callback a un evento.
   * @returns {Function} unsubscribe — llama para cancelar
   */
  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
    // Devuelve función de cancelación
    return () => {
      _listeners[event] = (_listeners[event] || []).filter(cb => cb !== callback);
    };
  }

  /**
   * Emite un evento a todos los suscriptores registrados.
   */
  function emit(event, data) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.warn('[AppState] listener error:', e); }
    });
  }

  // ── Persistencia en localStorage ────────────────────────────
  function persist() {
    try {
      localStorage.setItem('mundial2026_state_v2', JSON.stringify({
        odds:        _state.odds,
        referees:    _state.referees,
        picks:       _state.picks,
        liveMatches: _state.liveMatches,
      }));
    } catch (e) { /* Silenciar errores de cuota de storage */ }
  }

  function hydrate() {
    try {
      const saved = JSON.parse(localStorage.getItem('mundial2026_state_v2') || '{}');
      if (saved.odds)        Object.assign(_state.odds, saved.odds);
      if (saved.referees)    Object.assign(_state.referees, saved.referees);
      if (saved.picks)       _state.picks = saved.picks;
      if (saved.liveMatches) Object.assign(_state.liveMatches, saved.liveMatches);
      console.log('[AppState] Estado hidratado desde localStorage.');
    } catch (e) { console.warn('[AppState] hydrate error:', e); }
  }

  // ── Setters — cada uno notifica a los suscriptores ──────────
  function setLiveMatch(fixtureId, data) {
    _state.liveMatches[fixtureId] = {
      ...(_state.liveMatches[fixtureId] || {}),
      ...data,
      updatedAt: Date.now(),
    };
    persist();
    emit('live-match-update', { fixtureId, data });
    emit('fixtures-changed', null);          // Dispara re-render global
  }

  function setOdds(matchKey, data) {
    _state.odds[matchKey] = { ...data, fetchedAt: Date.now() };
    persist();
    emit('odds-update', { matchKey, data });
  }

  function setRefereeStats(refId, stats) {
    _state.referees[refId] = {
      ...(_state.referees[refId] || {}),
      ...stats,
      updatedAt: Date.now(),
    };
    persist();
    emit('referee-update', { refId, stats });
  }

  function setPicks(picks) {
    _state.picks = picks;
    persist();
    emit('picks-update', picks);
  }

  function setLiveCount(count) {
    _state.liveCount = count;
    emit('live-status', { count, lastPoll: Date.now() });
  }

  // ── Getters ──────────────────────────────────────────────────
  return {
    on, emit,
    persist, hydrate,
    setLiveMatch, setOdds, setRefereeStats, setPicks, setLiveCount,
    getAll:    ()    => _state,
    getOdds:   (key) => _state.odds[key]        || null,
    getRef:    (id)  => _state.referees[id]     || null,
    getPicks:  ()    => _state.picks,
    getLive:   (id)  => _state.liveMatches[id]  || null,
    getLiveCount: () => _state.liveCount,
  };
})();
