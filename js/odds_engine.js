// ============================================================
//  ODDS_ENGINE.JS — Extractor de Cuotas DoradoBet + Detector de Valor
//
//  En DEMO_MODE simula las cuotas aplicando el margen de la casa
//  (6.5%) sobre las probabilidades del modelo, más jitter aleatorio.
//
//  Para producción: reemplaza _fetchReal() con un fetch a tu
//  proxy/scraper de DoradoBet (Node + Puppeteer o endpoint API).
// ============================================================

const ODDS_CONFIG = {
  // Endpoint de producción (proxy Node.js / scraper Puppeteer)
  ENDPOINT:     'http://localhost:4000/api/doradobet/odds',  // placeholder
  DEMO_MODE:    true,

  // Margen de la casa DoradoBet (~6.5%)
  HOUSE_MARGIN: 0.065,

  // Umbrales de edge
  EDGE_STRONG:  0.06,    // ≥ 6%  🔥 Fuerte
  EDGE_MEDIUM:  0.03,    // ≥ 3%  ✅ Valor
  EDGE_SLIGHT:  0.015,   // ≥ 1.5% 📈 Leve
  EDGE_TRAP:   -0.05,    // ≤ -5% ⚠️ Trampa

  CACHE_TTL_MS: 600_000, // 10 minutos de caché
};

// ── Generador de cuotas simuladas ───────────────────────────
/**
 * A partir del análisis del modelo, genera cuotas que simulan
 * el comportamiento REAL de una casa de apuestas:
 *
 * - Los mercados principales (1X2) se fijan con margen de casa (~6.5%)
 * - Los mercados secundarios (corners, tarjetas) tienen mayor varianza:
 *   las casas cometen más errores de precio ahí → más oportunidades de edge.
 * - Un ~35% de los mercados tendrán edge positivo (misspricing simulado).
 *
 * Esto replica el mundo real donde los modelos pueden encontrar valor
 * en mercados que la casa fija con menos rigor estadístico.
 */
function _buildSimOdds(analysis) {
  const margin = ODDS_CONFIG.HOUSE_MARGIN;

  /**
   * Genera una cuota simulando el error de precio de la casa.
   * @param {number} prob       - Probabilidad real del modelo
   * @param {number} errorBias  - Sesgo del error: 0=neutral, >0=más caro, <0=más barato
   * @param {number} noiseMag   - Magnitud del ruido aleatorio (0.10 = ±10%)
   */
  const toOdds = (prob, errorBias = 0, noiseMag = 0.12) => {
    // Error gaussiano: la casa comete errores al estimar probabilidades
    const noise   = (Math.random() - 0.5 + errorBias) * noiseMag;
    // Probabilidad que la casa "cree" que es correcta (con su error)
    const bookProb = Math.max(0.04, Math.min(0.96, prob * (1 + margin) + noise));
    return parseFloat(Math.max(1.01, Math.min(28.0, 1 / bookProb)).toFixed(2));
  };

  // Mercados principales: casas más precisas → menos edge disponible
  const toMain  = (p) => toOdds(p,  0.02, 0.06);
  // Mercados secundarios (corners/tarjetas): casas menos rigurosas → más edge
  const toSec   = (p) => toOdds(p, -0.05, 0.18);
  // Mercados de alta varianza: BTTS, rangos → mucho error potencial
  const toHiVar = (p) => toOdds(p, -0.08, 0.22);

  const r  = analysis.result_1x2;
  const ou = analysis.over_under;
  const cn = analysis.corners.total_ou;
  const cd = analysis.cards.points_system;
  const bt = analysis.btts;
  const tg = analysis.team_goals;
  const fg = analysis.first_goal || { home: 0.45, away: 0.40, none: 0.15 };

  return {
    // 1X2 — mercado principal, casa precisa
    home: toMain(r.home), draw: toMain(r.draw), away: toMain(r.away),
    // Doble oportunidad
    dc_1x: toMain(r.home + r.draw), dc_x2: toMain(r.draw + r.away), dc_12: toMain(r.home + r.away),
    // Goles O/U — moderada precisión
    over15: toMain(ou['1.5'].over),   under15: toMain(ou['1.5'].under),
    over25: toMain(ou['2.5'].over),   under25: toMain(ou['2.5'].under),
    over35: toSec(ou['3.5'].over),    under35: toSec(ou['3.5'].under),
    over45: toSec(ou['4.5'].over),    under45: toSec(ou['4.5'].under),
    // BTTS — alta varianza de precio
    btts_yes: toHiVar(bt.yes), btts_no: toHiVar(bt.no),
    // Goles por equipo — alta varianza
    home_over05: toHiVar(tg.home.ou_0_5.over), home_over15: toSec(tg.home.ou_1_5.over),
    away_over05: toHiVar(tg.away.ou_0_5.over), away_over15: toSec(tg.away.ou_1_5.over),
    // Córners — las casas se equivocan más aquí → más edge potencial
    c_over85:  toSec(cn['8.5'].over),   c_under85:  toSec(cn['8.5'].under),
    c_over95:  toSec(cn['9.5'].over),   c_under95:  toSec(cn['9.5'].under),
    c_over105: toHiVar(cn['10.5'].over), c_under105: toHiVar(cn['10.5'].under),
    c_over115: toHiVar(cn['11.5'].over), c_over125:  toHiVar(cn['12.5'].over),
    // Puntos tarjetas — mercado muy mal priceado por casas → máximo edge
    pts_over255:  toHiVar(cd['25.5'].over),  pts_under255: toHiVar(cd['25.5'].under),
    pts_over355:  toHiVar(cd['35.5'].over),  pts_under355: toHiVar(cd['35.5'].under),
    pts_over455:  toHiVar(cd['45.5'].over),  pts_under455: toHiVar(cd['45.5'].under),
    pts_over555:  toHiVar(cd['55.5'].over),
    pts_over655:  toHiVar(cd['65.5'].over),
    // Primer gol — mercado mal-priceado (casas usan pura 1X2, ignoran λ)
    fg_home: toSec(fg.home),
    fg_away: toHiVar(fg.away),
    fg_none: toHiVar(fg.none),
  };
}

// ── Fetch real (endpoint proxy) ──────────────────────────────
async function _fetchReal(homeKey, awayKey) {
  const res = await fetch(`${ODDS_CONFIG.ENDPOINT}?home=${homeKey}&away=${awayKey}`, {
    headers: { 'Authorization': 'Bearer TU_TOKEN_DORADOBET', 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`DoradoBet API error ${res.status}`);
  return res.json();
}

// ── Cálculo de edge ──────────────────────────────────────────
/**
 * Calcula el edge matemático para un mercado.
 * edge = probabilidadModelo − probabilidadImplícita
 *
 * @param {number} modelProb - [0..1]
 * @param {number} odds      - cuota decimal
 */
function calcEdge(modelProb, odds) {
  const impliedProb = 1 / odds;
  const edge = modelProb - impliedProb;
  let level = 'none', edgeLabel = '—', badge = '';

  if      (edge >= ODDS_CONFIG.EDGE_STRONG) { level = 'strong'; edgeLabel = '🔥 +' + pctStr(edge); badge = 'bg-emerald-500'; }
  else if (edge >= ODDS_CONFIG.EDGE_MEDIUM) { level = 'medium'; edgeLabel = '✅ +' + pctStr(edge); badge = 'bg-green-600';   }
  else if (edge >= ODDS_CONFIG.EDGE_SLIGHT) { level = 'slight'; edgeLabel = '📈 +' + pctStr(edge); badge = 'bg-amber-500';   }
  else if (edge <= ODDS_CONFIG.EDGE_TRAP)   { level = 'trap';   edgeLabel = '⚠️ '  + pctStr(edge); badge = 'bg-red-700';     }

  return { edge, impliedProb, level, edgeLabel, badge };
}

function pctStr(v) { return (v * 100).toFixed(1) + '%'; }

// ── OddsEngine público ───────────────────────────────────────
const OddsEngine = {

  /**
   * Obtiene cuotas para un partido.
   * Usa caché si tiene < 10 min. Si no, genera (demo) o fetch (real).
   *
   * @param {string} homeKey
   * @param {string} awayKey
   * @param {Object|string} refProfile - perfil árbitro o 'default'|'strict'|'lenient'
   * @returns {Promise<{ analysis, odds, markets }>}
   */
  async getOdds(homeKey, awayKey, refProfile = 'default') {
    const matchKey = `${homeKey}-${awayKey}`;
    const cached   = AppState.getOdds(matchKey);

    // Caché válida: devolver sin re-calcular
    if (cached && (Date.now() - cached.fetchedAt < ODDS_CONFIG.CACHE_TTL_MS)) {
      return cached;
    }

    // Preparar tipo de árbitro para mmAnalyzeMatch
    const refType = typeof refProfile === 'object'
      ? RefEngine.toModelType(refProfile)
      : (refProfile || 'default');

    // Correr modelo Poisson
    const analysis = mmAnalyzeMatch(homeKey, awayKey, refType);
    if (analysis.error) throw new Error(analysis.error);

    // Obtener cuotas
    const odds = ODDS_CONFIG.DEMO_MODE
      ? _buildSimOdds(analysis)
      : await _fetchReal(homeKey, awayKey);

    // Calcular todos los mercados con su edge
    const markets = this.crossAnalysis(analysis, odds);
    const fullData = { matchKey, homeKey, awayKey, odds, analysis, markets, fetchedAt: Date.now() };
    AppState.setOdds(matchKey, fullData);
    return fullData;
  },

  /**
   * Cruza el análisis del modelo con las cuotas.
   * Retorna array de mercados con edge calculado.
   */
  crossAnalysis(analysis, odds) {
    const r  = analysis.result_1x2;
    const ou = analysis.over_under;
    const cn = analysis.corners.total_ou;
    const cd = analysis.cards.points_system;
    const bt = analysis.btts;
    const fg = analysis.first_goal || {};

    const m = (id, label, prob, odd) => {
      if (!odd || !prob) return null;
      return { id, label, modelProb: prob, odds: odd, ...calcEdge(prob, odd) };
    };

    return [
      m('home',       '1 Local gana',          r.home,               odds.home),
      m('draw',       'X Empate',               r.draw,               odds.draw),
      m('away',       '2 Visitante gana',        r.away,               odds.away),
      m('dc_1x',      'DC 1X',                  r.home + r.draw,      odds.dc_1x),
      m('dc_x2',      'DC X2',                  r.draw + r.away,      odds.dc_x2),
      m('over15',     'Over 1.5 Goles',          ou['1.5'].over,       odds.over15),
      m('over25',     'Over 2.5 Goles',          ou['2.5'].over,       odds.over25),
      m('under25',    'Under 2.5 Goles',         ou['2.5'].under,      odds.under25),
      m('over35',     'Over 3.5 Goles',          ou['3.5'].over,       odds.over35),
      m('btts_yes',   'Ambos Anotan (BTTS)',     bt.yes,               odds.btts_yes),
      m('btts_no',    'No Ambos Anotan',         bt.no,                odds.btts_no),
      m('c_over85',   'Córners Over 8.5',        cn['8.5'].over,       odds.c_over85),
      m('c_over95',   'Córners Over 9.5',        cn['9.5'].over,       odds.c_over95),
      m('c_over105',  'Córners Over 10.5',       cn['10.5'].over,      odds.c_over105),
      m('c_under95',  'Córners Under 9.5',       cn['9.5'].under,      odds.c_under95),
      m('pts_over255','Pts Tarj. Over 25.5',     cd['25.5'].over,      odds.pts_over255),
      m('pts_over355','Pts Tarj. Over 35.5',     cd['35.5'].over,      odds.pts_over355),
      m('pts_over455','Pts Tarj. Over 45.5',     cd['45.5'].over,      odds.pts_over455),
      m('pts_under355','Pts Tarj. Under 35.5',   cd['35.5'].under,     odds.pts_under355),
      m('fg_home',    'Primer Gol Local',         fg.home,              odds.fg_home),
      m('fg_away',    'Primer Gol Visitante',      fg.away,              odds.fg_away),
    ].filter(Boolean);
  },

  /** Filtra y ordena solo los mercados con edge positivo. */
  getValueMarkets(analysis, odds) {
    return this.crossAnalysis(analysis, odds)
      .filter(m => m.edge > 0)
      .sort((a, b) => b.edge - a.edge);
  },
};
