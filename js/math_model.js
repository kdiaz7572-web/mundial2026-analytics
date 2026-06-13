// ============================================================
//  MATH_MODEL.JS — Motor Estadístico Completo
//  Distribución de Poisson + Dixon-Coles para todos los
//  mercados: Goles, Corners, Tarjetas, Combos
// ============================================================

'use strict';

// ——— Log-factorial cacheado (estabilidad numérica) ———
const _lfCache = [0];
function _lf(n) {
  if (_lfCache[n] !== undefined) return _lfCache[n];
  _lfCache[n] = _lf(n - 1) + Math.log(n);
  return _lfCache[n];
}

// ——— PMF de Poisson: P(X = k | λ) ———
function mmPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0 || !Number.isInteger(k)) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - _lf(k));
}

// ——— CDF de Poisson: P(X ≤ maxK | λ) ———
function mmCDF(lambda, maxK) {
  let s = 0;
  for (let k = 0; k <= maxK; k++) s += mmPMF(lambda, k);
  return Math.min(s, 1);
}

// ——— Normal CDF (aproximación Abramowitz & Stegun) ———
function _erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t)
    + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function mmNormalCDF(x, mean, std) {
  if (std <= 0) return x >= mean ? 1 : 0;
  return 0.5 * (1 + _erf((x - mean) / (std * Math.SQRT2)));
}

// ============================================================
//  MODELO DE GOLES — Dixon-Coles + Poisson Bivariado
// ============================================================

/**
 * Calcula los Expected Goals (λ) para cada equipo usando
 * fuerza ofensiva/defensiva normalizada por la media de la liga.
 */
function mmLambdas(homeStats, awayStats) {
  const mu = LEAGUE_PARAMS.avg_goals;
  const ha = LEAGUE_PARAMS.home_advantage;

  const hAttk = homeStats.xG_for    / mu;
  const aDefn = awayStats.xG_against / mu;
  const aAttk = awayStats.xG_for    / mu;
  const hDefn = homeStats.xG_against / mu;

  return {
    home: Math.max(hAttk * aDefn * ha * mu, 0.05),
    away: Math.max(aAttk * hDefn * mu, 0.05),
  };
}

/**
 * Construye la matriz de probabilidades P(i, j) para todos los
 * marcadores posibles (i goles local, j goles visitante).
 * Aplica corrección Dixon-Coles para bajos marcadores.
 */
function mmScoreMatrix(lH, lA, max = 10) {
  const m = Array.from({ length: max + 1 }, (_, h) =>
    Array.from({ length: max + 1 }, (__, a) => mmPMF(lH, h) * mmPMF(lA, a))
  );

  // Corrección Dixon-Coles (τ = 0.07)
  const t = 0.07;
  m[0][0] = Math.max(m[0][0] * (1 - lH * lA * t), 1e-9);
  m[1][0] *= (1 + lA * t);
  m[0][1] *= (1 + lH * t);
  m[1][1] = Math.max(m[1][1] * (1 - t), 1e-9);

  // Renormalizar
  const total = m.flat().reduce((s, v) => s + v, 0);
  for (let h = 0; h <= max; h++)
    for (let a = 0; a <= max; a++)
      m[h][a] /= total;

  return m;
}

// ——— 1X2 ———
function mm1X2(matrix) {
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h < matrix.length; h++)
    for (let a = 0; a < matrix[h].length; a++) {
      if (h > a) home += matrix[h][a];
      else if (h === a) draw += matrix[h][a];
      else away += matrix[h][a];
    }
  return { home: _p4(home), draw: _p4(draw), away: _p4(away) };
}

// ——— Doble Oportunidad ———
function mmDoubleChance(r) {
  return { h1X: _p4(r.home + r.draw), hX2: _p4(r.draw + r.away), h12: _p4(r.home + r.away) };
}

// ——— Over/Under Goles (líneas 1.5 / 2.5 / 3.5 / 4.5) ———
function mmOU(matrix) {
  const lines = [1.5, 2.5, 3.5, 4.5];
  const result = {};
  lines.forEach(line => {
    let over = 0;
    for (let h = 0; h < matrix.length; h++)
      for (let a = 0; a < matrix[h].length; a++)
        if (h + a > line) over += matrix[h][a];
    result[String(line)] = { over: _p4(over), under: _p4(1 - over) };
  });
  return result;
}

// ——— BTTS (Ambos Equipos Anotan) ———
function mmBTTS(lH, lA) {
  const yes = (1 - mmPMF(lH, 0)) * (1 - mmPMF(lA, 0));
  return { yes: _p4(yes), no: _p4(1 - yes) };
}

// ——— Goles por equipo (O/U 0.5, 1.5, 2.5) ———
function mmTeamGoals(lH, lA) {
  return {
    home: {
      ou_0_5: { over: _p4(1 - mmPMF(lH, 0)), under: _p4(mmPMF(lH, 0)) },
      ou_1_5: { over: _p4(1 - mmCDF(lH, 1)), under: _p4(mmCDF(lH, 1)) },
      ou_2_5: { over: _p4(1 - mmCDF(lH, 2)), under: _p4(mmCDF(lH, 2)) },
    },
    away: {
      ou_0_5: { over: _p4(1 - mmPMF(lA, 0)), under: _p4(mmPMF(lA, 0)) },
      ou_1_5: { over: _p4(1 - mmCDF(lA, 1)), under: _p4(mmCDF(lA, 1)) },
      ou_2_5: { over: _p4(1 - mmCDF(lA, 2)), under: _p4(mmCDF(lA, 2)) },
    },
  };
}

// ——— Rango de Goles (0-1 / 2-3 / 4-6 / 7+) ———
function mmGoalRange(matrix) {
  let r01 = 0, r23 = 0, r46 = 0, r7p = 0;
  for (let h = 0; h < matrix.length; h++)
    for (let a = 0; a < matrix[h].length; a++) {
      const t = h + a;
      if (t <= 1) r01 += matrix[h][a];
      else if (t <= 3) r23 += matrix[h][a];
      else if (t <= 6) r46 += matrix[h][a];
      else r7p += matrix[h][a];
    }
  return { '0-1': _p4(r01), '2-3': _p4(r23), '4-6': _p4(r46), '7+': _p4(r7p) };
}

// ——— Marcador Exacto (top 12 + "otros") ———
function mmExactScores(matrix) {
  const scores = [];
  for (let h = 0; h < matrix.length; h++)
    for (let a = 0; a < matrix[h].length; a++)
      scores.push({ label: `${h}-${a}`, prob: matrix[h][a] });

  scores.sort((a, b) => b.prob - a.prob);
  const top = scores.slice(0, 12);
  const others = scores.slice(12).reduce((s, x) => s + x.prob, 0);
  top.push({ label: 'Otros', prob: _p4(others) });
  return top;
}

// ============================================================
//  MERCADO DE CÓRNERS
// ============================================================

/**
 * Calcula λ de córners para cada equipo y todos los mercados derivados.
 */
function mmCorners(hExt, aExt) {
  // Lambda de córners: media del ataque de uno y defensa del otro
  const lHC = (hExt.avg_corners_for + aExt.avg_corners_against) / 2;
  const lAC = (aExt.avg_corners_for + hExt.avg_corners_against) / 2;

  // Factor de pressing (equipos que presionan más fuerzan más corners)
  const pf  = 1 + ((hExt.pressing_intensity + aExt.pressing_intensity) - 130) / 1000;
  const lH  = Math.max(lHC * pf, 0.5);
  const lA  = Math.max(lAC * pf, 0.5);
  const lT  = lH + lA;

  // ——— Over/Under total (líneas 8.5–12.5) ———
  const totalOU = {};
  [7.5, 8.5, 9.5, 10.5, 11.5, 12.5].forEach(line => {
    const floor = Math.floor(line);
    totalOU[String(line)] = {
      over:  _p4(1 - mmCDF(lT, floor)),
      under: _p4(mmCDF(lT, floor)),
    };
  });

  // ——— Corners 1X2 (bivariate Poisson) ———
  let cH = 0, cD = 0, cA = 0;
  for (let h = 0; h <= 20; h++)
    for (let a = 0; a <= 20; a++) {
      const p = mmPMF(lH, h) * mmPMF(lA, a);
      if (h > a) cH += p; else if (h === a) cD += p; else cA += p;
    }
  const corners1X2 = { home: _p4(cH), draw: _p4(cD), away: _p4(cA) };

  // ——— Par / Impar (total de córners) ———
  let even = 0, odd = 0;
  for (let k = 0; k <= 30; k++) {
    const p = mmPMF(lT, k);
    if (k % 2 === 0) even += p; else odd += p;
  }
  const oddEven = { even: _p4(even), odd: _p4(odd) };

  // ——— Primera mitad (≈45% del total) ———
  const lT1H = lT * 0.45;
  const firstHalf = {};
  [3.5, 4.5, 5.5].forEach(line => {
    const floor = Math.floor(line);
    firstHalf[String(line)] = {
      over:  _p4(1 - mmCDF(lT1H, floor)),
      under: _p4(mmCDF(lT1H, floor)),
    };
  });

  // ——— Córners por equipo ———
  const homeTeamOU = {
    ou_3_5: { over: _p4(1 - mmCDF(lH, 3)), under: _p4(mmCDF(lH, 3)) },
    ou_4_5: { over: _p4(1 - mmCDF(lH, 4)), under: _p4(mmCDF(lH, 4)) },
    ou_5_5: { over: _p4(1 - mmCDF(lH, 5)), under: _p4(mmCDF(lH, 5)) },
  };
  const awayTeamOU = {
    ou_3_5: { over: _p4(1 - mmCDF(lA, 3)), under: _p4(mmCDF(lA, 3)) },
    ou_4_5: { over: _p4(1 - mmCDF(lA, 4)), under: _p4(mmCDF(lA, 4)) },
    ou_5_5: { over: _p4(1 - mmCDF(lA, 5)), under: _p4(mmCDF(lA, 5)) },
  };

  return {
    lambda_home: _p2(lH),
    lambda_away: _p2(lA),
    lambda_total: _p2(lT),
    total_ou: totalOU,
    corners_1x2: corners1X2,
    odd_even: oddEven,
    first_half: firstHalf,
    home_team: homeTeamOU,
    away_team: awayTeamOU,
  };
}

// ============================================================
//  MERCADO DE TARJETAS
// ============================================================

/**
 * Calcula tarjetas esperadas y todos los mercados derivados,
 * incluyendo el sistema de puntos de DoradoBet (Amarilla=10, Roja=25).
 */
function mmCards(hExt, aExt, referee) {
  const ref = referee || REFEREE_PROFILES.default;
  const leagueAvgFouls = 13.8;

  // Índice de agresividad normalizado (vs. media de 70)
  const hAgg = (hExt.aggression_index || 65) / 70;
  const aAgg = (aExt.aggression_index || 65) / 70;
  const combAgg = (hAgg + aAgg) / 2;

  // Factor de faltas
  const foulFactor = ((hExt.foul_rate + aExt.foul_rate) / 2) / leagueAvgFouls;

  // Lambdas finales
  const lY = ref.avg_yellows * combAgg * foulFactor * ref.strictness;
  const lR = ref.avg_reds    * combAgg * ref.strictness;

  // Desglose por equipo (proporcional a agresividad)
  const hRatio = hAgg / (hAgg + aAgg);
  const lYH = lY * hRatio, lYA = lY * (1 - hRatio);

  // ——— Over/Under Amarillas ———
  const yellowOU = {
    ou_2_5: { over: _p4(1 - mmCDF(lY, 2)), under: _p4(mmCDF(lY, 2)) },
    ou_3_5: { over: _p4(1 - mmCDF(lY, 3)), under: _p4(mmCDF(lY, 3)) },
    ou_4_5: { over: _p4(1 - mmCDF(lY, 4)), under: _p4(mmCDF(lY, 4)) },
    ou_5_5: { over: _p4(1 - mmCDF(lY, 5)), under: _p4(mmCDF(lY, 5)) },
  };

  // ——— Rojas ———
  const anyRed = _p4(1 - mmPMF(lR, 0));
  const redOU = {
    ou_0_5: { over: anyRed, under: _p4(1 - anyRed) },
    ou_1_5: { over: _p4(1 - mmCDF(lR, 1)), under: _p4(mmCDF(lR, 1)) },
  };

  // ——— Tarjetas 1X2 (quién recibe más) ———
  let cH = 0, cD = 0, cA = 0;
  for (let h = 0; h <= 8; h++)
    for (let a = 0; a <= 8; a++) {
      const p = mmPMF(lYH, h) * mmPMF(lYA, a);
      if (h > a) cH += p; else if (h === a) cD += p; else cA += p;
    }
  const cards1X2 = { home: _p4(cH), draw: _p4(cD), away: _p4(cA) };

  // ——— Sistema de Puntos DoradoBet: Amarilla=10, Roja directa=25 ———
  // Esperanza de puntos
  const meanPts = lY * 10 + lR * 25;
  // Varianza (Poisson compuesta)
  const varPts = 100 * lY + 625 * lR;
  const sdPts  = Math.sqrt(varPts);

  // P(puntos > línea) usando Normal CDF con corrección de continuidad
  const pointsOU = {};
  [25.5, 35.5, 45.5, 55.5, 65.5].forEach(line => {
    const over = 1 - mmNormalCDF(line + 0.5, meanPts, sdPts);
    pointsOU[String(line)] = {
      over:  _p4(Math.max(over, 0)),
      under: _p4(Math.max(1 - over, 0)),
    };
  });

  // ——— Primera mitad (≈48% de las tarjetas) ———
  const lY1H = lY * 0.48;
  const firstHalf = {
    ou_1_5: { over: _p4(1 - mmCDF(lY1H, 1)), under: _p4(mmCDF(lY1H, 1)) },
    ou_2_5: { over: _p4(1 - mmCDF(lY1H, 2)), under: _p4(mmCDF(lY1H, 2)) },
  };

  return {
    expected_yellows: _p2(lY),
    expected_reds:    _p2(lR),
    expected_points:  _p2(meanPts),
    yellow_ou:        yellowOU,
    red_ou:           redOU,
    any_red:          anyRed,
    cards_1x2:        cards1X2,
    points_system:    pointsOU,
    first_half:       firstHalf,
  };
}

// ============================================================
//  MERCADOS COMBINADOS (Combos)
// ============================================================

function mmCombos(matrix, lH, lA, corners) {
  // Derivados directamente de la matriz de marcadores → máxima precisión
  let h_btts = 0, d_btts = 0, a_btts = 0;
  let h_ou25  = 0, d_ou25  = 0, a_ou25  = 0;

  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p     = matrix[h][a];
      const btts  = (h >= 1 && a >= 1);
      const over  = (h + a > 2);

      if (h > a) {
        if (btts) h_btts += p;
        if (over) h_ou25  += p;
      } else if (h === a) {
        if (btts) d_btts += p;
        if (over) d_ou25  += p;
      } else {
        if (btts) a_btts += p;
        if (over) a_ou25  += p;
      }
    }
  }

  const r = mm1X2(matrix);
  const bttsYes = mmBTTS(lH, lA).yes;
  const over25  = 1 - mmCDF(lH + lA, 2);

  // Combo 1X2 + Corners (asume independencia entre goles y corners)
  const c95over = corners.total_ou['9.5']?.over ?? 0.5;

  return {
    // 1X2 & BTTS
    h_and_btts: _p4(h_btts),
    d_and_btts: _p4(d_btts),
    a_and_btts: _p4(a_btts),
    no_btts:    _p4(1 - bttsYes),

    // 1X2 & O/U 2.5
    h_and_over25:  _p4(h_ou25),
    d_and_over25:  _p4(d_ou25),
    a_and_over25:  _p4(a_ou25),
    h_and_under25: _p4(r.home - h_ou25),
    d_and_under25: _p4(r.draw - d_ou25),
    a_and_under25: _p4(r.away - a_ou25),

    // 1X2 & Corners +9.5 (independencia)
    h_and_corners95: _p4(r.home * c95over),
    d_and_corners95: _p4(r.draw * c95over),
    a_and_corners95: _p4(r.away * c95over),
  };
}

// ============================================================
//  FUNCIÓN MAESTRA
// ============================================================

/**
 * Corre el análisis completo para un partido.
 * @param {string} homeKey  - shortName del equipo local  (ej: "BRA")
 * @param {string} awayKey  - shortName del equipo visitante
 * @param {string} refType  - "default" | "strict" | "lenient"
 * @returns {Object} análisis completo con todos los mercados
 */
function mmAnalyzeMatch(homeKey, awayKey, refType = 'default') {
  const hTeam = TEAMS.find(t => t.shortName === homeKey);
  const aTeam = TEAMS.find(t => t.shortName === awayKey);

  if (!hTeam || !aTeam) return { error: `Equipo no encontrado: ${!hTeam ? homeKey : awayKey}` };

  const hExt = getExtStats(homeKey);
  const aExt = getExtStats(awayKey);
  // Acepta un perfil de árbitro completo (objeto) O un string 'default'|'strict'|'lenient'
  const ref = (typeof refType === 'object' && refType !== null)
    ? refType
    : (REFEREE_PROFILES[refType] || REFEREE_PROFILES.default);

  let { home: lH, away: lA } = mmLambdas(hExt, aExt);

  // ── Capa de optimización analítica: ranking FIFA + forma 12 partidos ──
  //   Ajuste acotado (±15%, "balanceado") sobre λ. No altera la API ni el
  //   modelo Poisson; solo desplaza los Expected Goals según anclaje.
  let predictiveWeights = null;
  if (typeof applyPredictiveWeights === 'function') {
    const pw = applyPredictiveWeights(lH, lA, hTeam, aTeam);
    lH = pw.home; lA = pw.away;
    predictiveWeights = pw.breakdown;
  }

  const matrix = mmScoreMatrix(lH, lA);
  const r1x2   = mm1X2(matrix);
  const corners = mmCorners(hExt, aExt);

  return {
    meta: {
      home: hTeam, away: aTeam,
      homeKey, awayKey,
      refType, refLabel: ref.label,
      timestamp: new Date().toISOString(),
    },
    lambdas:      { home: _p2(lH), away: _p2(lA), total: _p2(lH + lA) },
    predictive_weights: predictiveWeights,
    result_1x2:   r1x2,
    double_chance: mmDoubleChance(r1x2),
    over_under:   mmOU(matrix),
    btts:         mmBTTS(lH, lA),
    team_goals:   mmTeamGoals(lH, lA),
    goal_range:   mmGoalRange(matrix),
    exact_scores: mmExactScores(matrix),
    corners:      corners,
    cards:        mmCards(hExt, aExt, ref),
    combos:       mmCombos(matrix, lH, lA, corners),
    first_goal:   mmFirstGoal(lH, lA),
  };
}

// ============================================================
//  MERCADO: PRIMER EQUIPO EN MARCAR
// ============================================================

/**
 * Calcula la probabilidad de qué equipo marca primero.
 * Fórmula: P(local primero) = λH/(λH+λA) × (1 - e^(-λH-λA))
 *
 * @param {number} lH - Lambda goles local
 * @param {number} lA - Lambda goles visitante
 * @returns {{ home, away, none }} probabilidades [0..1]
 */
function mmFirstGoal(lH, lA) {
  const p00  = Math.exp(-lH) * Math.exp(-lA);         // P(0-0) = ningún gol
  const pGoal = 1 - p00;                               // P(hay al menos 1 gol)
  const lSum  = lH + lA;
  return {
    home: _p4((lH / lSum) * pGoal),
    away: _p4((lA / lSum) * pGoal),
    none: _p4(p00),
  };
}

// ——— Helpers de formato ———
function _p4(v) { return parseFloat(Math.min(Math.max(v, 0), 1).toFixed(4)); }
function _p2(v) { return parseFloat(v.toFixed(2)); }
function mmPct(v) { return v != null ? (v * 100).toFixed(1) + '%' : '—'; }
