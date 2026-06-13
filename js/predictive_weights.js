// ============================================================
//  PREDICTIVE WEIGHTS — Capa de optimización analítica de Zac
//  Dos variables de anclaje sobre los λ (Expected Goals):
//    1) Forma reciente — últimos 12 partidos oficiales (W/D/L
//       ponderado por recencia).
//    2) Ranking FIFA — diferencia de puestos entre ambos equipos.
//
//  NO toca la API, ni el modelo Poisson/Dixon-Coles, ni las
//  pantallas. Es un ajuste acotado (±15%, "balanceado") sobre λ
//  que se aplica en un único punto de mmAnalyzeMatch().
//
//  Diseñado para enriquecerse luego con el last-12 REAL de
//  API-Football: basta con poblar team.recentForm (y opcionalmente
//  team.recentStats) con datos reales — la fórmula no cambia.
// ============================================================

(function (global) {
  'use strict';

  const PW_CONFIG = {
    cap: 0.15,           // máximo desplazamiento sobre λ (±15% — intensidad "balanceada")
    wForm: 0.5,          // peso de la forma reciente
    wRank: 0.5,          // peso del ranking FIFA
    rankScale: 20,       // 20 puestos de diferencia ≈ tanh(1) ≈ 0.76
    formWindow: 12,      // últimos 12 partidos oficiales
    recencyHalfLife: 6,  // vida media (en partidos) del peso por recencia
  };

  // ── Forma reciente: tasa de rendimiento [0,1] de los últimos N ──
  //   recentForm: array de 'W'|'D'|'L', índice 0 = más reciente.
  //   W=3, D=1, L=0, ponderado por recencia (half-life).
  function teamFormRate(team) {
    const arr = Array.isArray(team && team.recentForm)
      ? team.recentForm.slice(0, PW_CONFIG.formWindow)
      : [];
    if (!arr.length) return { rate: 0.5, n: 0, neutral: true };

    let pSum = 0, wSum = 0;
    for (let i = 0; i < arr.length; i++) {
      const w = Math.pow(0.5, i / PW_CONFIG.recencyHalfLife); // recencia: i=0 → 1
      const r = arr[i];
      const pts = r === 'W' ? 3 : r === 'D' ? 1 : 0;
      pSum += w * pts;
      wSum += w * 3;
    }
    return { rate: wSum > 0 ? pSum / wSum : 0.5, n: arr.length, neutral: false };
  }

  // ── Factor de ranking FIFA: [-1,1], positivo = local mejor rankeado ──
  function rankFactor(homeTeam, awayTeam) {
    const hr = (homeTeam && homeTeam.fifaRanking) || 50;
    const ar = (awayTeam && awayTeam.fifaRanking) || 50;
    return Math.tanh((ar - hr) / PW_CONFIG.rankScale);
  }

  // ── Ajuste principal: devuelve λ ajustadas + desglose transparente ──
  function applyPredictiveWeights(lH, lA, homeTeam, awayTeam, cfg) {
    const C = Object.assign({}, PW_CONFIG, cfg || {});
    const hForm = teamFormRate(homeTeam);
    const aForm = teamFormRate(awayTeam);

    const formDiff = hForm.rate - aForm.rate;          // [-1,1]
    const rankDiff = rankFactor(homeTeam, awayTeam);   // [-1,1]
    const formNeutral = hForm.neutral || aForm.neutral || Math.abs(formDiff) < 1e-9;

    // Si la forma es neutral (sin datos reales), todo el peso va al ranking
    const wForm = formNeutral ? 0 : C.wForm;
    const wRank = formNeutral ? (C.wForm + C.wRank) : C.wRank;

    let combined = wForm * formDiff + wRank * rankDiff;
    combined = Math.max(-1, Math.min(1, combined));
    const shift = C.cap * combined;                    // [-cap, cap]

    const home = Math.max(lH * (1 + shift), 0.05);
    const away = Math.max(lA * (1 - shift), 0.05);

    return {
      home, away,
      breakdown: {
        homeForm: +hForm.rate.toFixed(3), awayForm: +aForm.rate.toFixed(3),
        formDiff: +formDiff.toFixed(3), formNeutral,
        homeRank: (homeTeam && homeTeam.fifaRanking) || null,
        awayRank: (awayTeam && awayTeam.fifaRanking) || null,
        rankDiff: +rankDiff.toFixed(3),
        combined: +combined.toFixed(3),
        shiftPct: +(shift * 100).toFixed(1),
        lambdaHomeBefore: +lH.toFixed(3), lambdaAwayBefore: +lA.toFixed(3),
        lambdaHomeAfter: +home.toFixed(3), lambdaAwayAfter: +away.toFixed(3),
      },
    };
  }

  const api = { PW_CONFIG, teamFormRate, rankFactor, applyPredictiveWeights };

  // Exponer como globales (script clásico) y como módulo (Node/harness)
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) {
    global.PW_CONFIG = PW_CONFIG;
    global.teamFormRate = teamFormRate;
    global.rankFactor = rankFactor;
    global.applyPredictiveWeights = applyPredictiveWeights;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
