// ============================================================
//  REFEREE_ENGINE.JS — Perfiles Dinámicos de Árbitros
//
//  Base de datos histórica de los árbitros FIFA del Mundial 2026.
//  Tras cada partido dirigido, el sistema recalcula los promedios
//  del árbitro combinando su historial base + los datos del torneo.
// ============================================================

// ── Base de datos histórica (promedios pre-Mundial) ──────────
const REFEREE_DATABASE = {
  marciniak: {
    id: 'marciniak', name: 'Szymon Marciniak', country: 'Polonia', flag: '🇵🇱',
    avg_yellows: 3.2, avg_reds: 0.12, strictness: 0.83, matches: 68,
    label: 'S. Marciniak', notes: 'Final Mundial 2022 — muy controlado, rara vez saca rojas',
  },
  orsato: {
    id: 'orsato', name: 'Daniele Orsato', country: 'Italia', flag: '🇮🇹',
    avg_yellows: 4.1, avg_reds: 0.18, strictness: 1.07, matches: 72,
    label: 'D. Orsato', notes: 'Tendencia a tarjetas en partidos físicos',
  },
  claus: {
    id: 'claus', name: 'Raphael Claus', country: 'Brasil', flag: '🇧🇷',
    avg_yellows: 4.2, avg_reds: 0.16, strictness: 1.09, matches: 54,
    label: 'R. Claus', notes: 'Alto en amarillas, disciplinado con las faltas',
  },
  zwayer: {
    id: 'zwayer', name: 'Felix Zwayer', country: 'Alemania', flag: '🇩🇪',
    avg_yellows: 3.5, avg_reds: 0.14, strictness: 0.91, matches: 61,
    label: 'F. Zwayer', notes: 'Balanceado, evita rojas en general',
  },
  turpin: {
    id: 'turpin', name: 'Clément Turpin', country: 'Francia', flag: '🇫🇷',
    avg_yellows: 3.7, avg_reds: 0.13, strictness: 0.96, matches: 65,
    label: 'C. Turpin', notes: 'Consistente, gestión tranquila del partido',
  },
  taylor: {
    id: 'taylor', name: 'Anthony Taylor', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    avg_yellows: 4.4, avg_reds: 0.20, strictness: 1.14, matches: 58,
    label: 'A. Taylor', notes: 'Alto en ambas tarjetas, enérgico',
  },
  vincic: {
    id: 'vincic', name: 'Slavko Vinčić', country: 'Eslovenia', flag: '🇸🇮',
    avg_yellows: 3.3, avg_reds: 0.11, strictness: 0.86, matches: 49,
    label: 'S. Vinčić', notes: 'Permisivo con el contacto físico',
  },
  makkelie: {
    id: 'makkelie', name: 'Danny Makkelie', country: 'Países Bajos', flag: '🇳🇱',
    avg_yellows: 3.9, avg_reds: 0.15, strictness: 1.01, matches: 55,
    label: 'D. Makkelie', notes: 'Media del torneo, sin sesgo marcado',
  },
  lahoz: {
    id: 'lahoz', name: 'Antonio Mateu Lahoz', country: 'España', flag: '🇪🇸',
    avg_yellows: 5.2, avg_reds: 0.28, strictness: 1.35, matches: 77,
    label: 'A. Lahoz', notes: '⚠️ Muy estricto — historial de controversias y muchas tarjetas',
  },
  ramos: {
    id: 'ramos', name: 'César Arturo Ramos', country: 'México', flag: '🇲🇽',
    avg_yellows: 4.0, avg_reds: 0.17, strictness: 1.04, matches: 47,
    label: 'C. Ramos', notes: 'Sede CONCACAF — árbitro conocido en la zona',
  },
  elfath: {
    id: 'elfath', name: 'Ismail Elfath', country: 'EE.UU.', flag: '🇺🇸',
    avg_yellows: 3.6, avg_reds: 0.13, strictness: 0.94, matches: 38,
    label: 'I. Elfath', notes: 'Bajo en rojas, buena gestión del tiempo',
  },
  barton: {
    id: 'barton', name: 'Ivan Barton', country: 'El Salvador', flag: '🇸🇻',
    avg_yellows: 3.4, avg_reds: 0.14, strictness: 0.88, matches: 35,
    label: 'I. Barton', notes: 'Permisivo con faltas físicas',
  },
  // Árbitro genérico FIFA para partidos sin asignar
  default: {
    id: 'default', name: 'Árbitro FIFA estándar', country: '', flag: '🌍',
    avg_yellows: 3.85, avg_reds: 0.17, strictness: 1.00, matches: 45,
    label: 'Estándar FIFA',
  },
};

// ── Mapeo fixtureId → refId ──────────────────────────────────
// En producción se llenaría desde la API de asignaciones
const FIXTURE_REFEREES = {
  1:'marciniak', 2:'turpin',   3:'orsato',   4:'zwayer',
  5:'claus',     6:'taylor',   7:'vincic',   8:'makkelie',
  9:'ramos',    10:'elfath',  11:'lahoz',   12:'barton',
  13:'marciniak',14:'orsato',  15:'turpin',  16:'zwayer',
  17:'claus',   18:'taylor',  19:'vincic',  20:'makkelie',
  21:'ramos',   22:'elfath',  23:'lahoz',   24:'barton',
  25:'marciniak',26:'orsato', 27:'turpin',  28:'zwayer',
  29:'claus',   30:'taylor',  31:'vincic',  32:'makkelie',
  33:'ramos',   34:'elfath',  35:'lahoz',   36:'barton',
  37:'marciniak',38:'orsato', 39:'turpin',  40:'zwayer',
  41:'claus',   42:'taylor',  43:'vincic',  44:'makkelie',
  45:'ramos',   46:'elfath',  47:'lahoz',   48:'barton',
};

// ── Motor de árbitros ────────────────────────────────────────
const RefEngine = {

  /**
   * Devuelve el perfil EFECTIVO de un árbitro.
   * Fusiona datos base con las estadísticas acumuladas en el Mundial.
   * Así el perfil cambia dinámicamente partido a partido.
   *
   * @param {string} refId
   * @returns {Object} perfil fusionado con promedios recalculados
   */
  getProfile(refId = 'default') {
    const base    = REFEREE_DATABASE[refId] || REFEREE_DATABASE.default;
    const dynamic = AppState.getRef(refId);   // datos del Mundial en AppState
    if (!dynamic || !dynamic.wc_matches) return { ...base };

    // Recalcular promedios ponderados: (base × historial) + (WC acumulado)
    const totalM = base.matches + dynamic.wc_matches;
    const totalY = (base.avg_yellows * base.matches) + (dynamic.wc_yellows || 0);
    const totalR = (base.avg_reds    * base.matches) + (dynamic.wc_reds    || 0);

    const newAvgY = totalY / totalM;
    const newAvgR = totalR / totalM;

    return {
      ...base,
      avg_yellows: parseFloat(newAvgY.toFixed(2)),
      avg_reds:    parseFloat(newAvgR.toFixed(2)),
      // Strictness relativo a la media FIFA
      strictness:  parseFloat((newAvgY / REFEREE_DATABASE.default.avg_yellows).toFixed(3)),
      wc_matches:  dynamic.wc_matches,
      wc_yellows:  dynamic.wc_yellows || 0,
      wc_reds:     dynamic.wc_reds    || 0,
    };
  },

  /**
   * Registra estadísticas de un partido dirigido.
   * Llamado automáticamente por LiveEngine al detectar FT.
   *
   * @param {string} refId
   * @param {{ yellows: number, reds: number }} stats
   */
  recordMatch(refId, { yellows = 0, reds = 0 }) {
    if (!refId || refId === 'default') return;
    const current = AppState.getRef(refId) || { wc_matches: 0, wc_yellows: 0, wc_reds: 0 };
    AppState.setRefereeStats(refId, {
      wc_matches: (current.wc_matches || 0) + 1,
      wc_yellows: (current.wc_yellows || 0) + yellows,
      wc_reds:    (current.wc_reds    || 0) + reds,
    });
    console.log(`[RefEngine] ✅ ${refId} actualizado: +${yellows}🟨 +${reds}🟥 (total WC: ${current.wc_matches + 1} partidos)`);
  },

  /**
   * Obtiene el perfil del árbitro asignado a un fixture.
   */
  getForFixture(fixtureId) {
    const refId = FIXTURE_REFEREES[fixtureId] || 'default';
    return this.getProfile(refId);
  },

  /**
   * Lista todos los árbitros disponibles para el selector UI.
   */
  getList() {
    return Object.values(REFEREE_DATABASE).filter(r => r.id !== 'default');
  },

  /**
   * Mapea un strictness a uno de los 3 tipos del modelo.
   * Permite usar perfiles específicos en mmAnalyzeMatch().
   */
  toModelType(refProfile) {
    if (refProfile.strictness >= 1.20) return 'strict';
    if (refProfile.strictness <= 0.85) return 'lenient';
    return 'default';
  },
};
