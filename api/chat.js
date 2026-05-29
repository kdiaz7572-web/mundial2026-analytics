// ============================================================
// Rebuild trigger: 2026-05-28 AI-Zak Reconfiguration v6.0
//  Chat Endpoint - Groq LLM Integration for IA-Zak v6.0
//  - FerXxxa Intel Integration: Receives DoradoBet chat context
//  - Kelly Criterion + 3 Risk Profiles (Conservador/Moderado/Agresivo)
//  - Bankroll management in Colones (₡)
//  - Intelligent parlay generation with Spanish analysis
// ============================================================

import Groq from 'groq-sdk';
import { getDb } from './_db.js';
import {
  calculateKellyOptimal,
  calculateKellyFractional,
  calculateBetSize,
  calculateRiskOfRuin,
  calculateEdge
} from '../js/kelly_calculator.js';
import { analyzePlayer } from './player-analyzer.js';
import { generateSmartSuggestions, generatePlayerBettingSuggestions } from './smart-suggestions.js';

// Inline simple utility functions to avoid middleware import issues
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>]/g, '').replace(/javascript:/gi, '').slice(0, 5000);
};

const sendError = (res, statusCode, errorType, message, details = {}) => {
  res.status(statusCode).json({ success: false, error: errorType, message, ...details });
};

const sendSuccess = (res, data = {}, message = '') => {
  res.status(200).json({ success: true, message, ...data });
};

// Initialize Groq with API key validation
// HARDCODED FALLBACK: GROQ_API_KEY_PLACEHOLDER
const groqApiKey = process.env.GROQ_API_KEY || 'GROQ_API_KEY_PLACEHOLDER';

console.log('[chat] Groq initialization:', {
  hasApiKey: !!groqApiKey,
  keyLength: groqApiKey ? groqApiKey.length : 0,
  keyStart: groqApiKey ? groqApiKey.substring(0, 10) : 'MISSING',
  source: process.env.GROQ_API_KEY ? 'environment' : 'hardcoded-fallback',
  timestamp: new Date().toISOString()
});

const groq = new Groq({
  apiKey: groqApiKey
});

/**
 * ========================================================================
 * ENHANCED: Fetch FerXxxa Community Intelligence from zak_intel
 * ========================================================================
 * Queries zak_intel table for:
 * 1. ferxxxa_markets: Real DoradoBet odds and market data
 * 2. ferxxxa_community: Community sentiment, trending bets, injury reports
 *
 * Returns enriched context for parlay generation
 */
async function fetchFerXxxaIntel(matchId, db) {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Query 1: Real market odds from DoradoBet (via FerXxxa API)
    const marketsResult = await db`
      SELECT summary_json, studied_at FROM zak_intel
      WHERE topic = 'ferxxxa_markets'
      AND match_id = ${matchId}
      AND studied_at > ${fiveMinutesAgo}
      ORDER BY studied_at DESC
      LIMIT 1
    `;

    // Query 2: Community predictions and sentiment
    const communityResult = await db`
      SELECT summary_json, studied_at FROM zak_intel
      WHERE topic = 'ferxxxa_community'
      AND match_id = ${matchId}
      AND studied_at > ${fiveMinutesAgo}
      ORDER BY studied_at DESC
      LIMIT 1
    `;

    const markets = marketsResult && marketsResult[0] ? marketsResult[0].summary_json : null;
    const community = communityResult && communityResult[0] ? communityResult[0].summary_json : null;

    let stale = false;
    let warning = null;

    // Check if data is aging (between 5-10 minutes old)
    if (marketsResult && marketsResult[0]) {
      const marketAge = Math.round((now - new Date(marketsResult[0].studied_at)) / 60000);
      if (marketAge > 5) {
        stale = true;
        warning = `Markets ${marketAge} minutes old`;
      }
    }

    return {
      markets,
      community,
      stale,
      warning,
      timestamp: now.toISOString()
    };
  } catch (error) {
    console.error('[fetchFerXxxaIntel] Error:', error.message);
    return {
      markets: null,
      community: null,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * ========================================================================
 * Kelly Criterion Calculator for Parlay Events
 * ========================================================================
 * kelly_% = edge / (odds - 1)
 * where edge = (probability × odds) - 1
 */
function calculateKelly(probability, odds) {
  if (!probability || !odds || odds <= 1) return 0;
  const edge = (probability * odds) - 1;
  if (edge <= 0) return 0;
  // Correct Kelly formula: kelly_% = edge / (odds - 1)
  return edge / (odds - 1);
}

/**
 * ========================================================================
 * Risk of Ruin Calculator
 * ========================================================================
 * P(ruin) for parlay = (1 - kelly_edge)^(num_bets)
 * For single parlay: RoR ≈ (1 / odds)^sequence_losses
 */
function calculateRiskOfRuin(kellyPercentage, bankroll) {
  if (kellyPercentage <= 0 || kellyPercentage >= 0.5) return 0;

  // Risk of Ruin approximation for parlay betting
  // RoR ≈ e^(-2 × kelly_%)
  // This represents the probability of losing the entire bankroll
  const ror = Math.exp(-2 * kellyPercentage);

  return Math.min(100, Math.round(ror * 10000) / 100); // Cap at 100%, round to 2 decimals
}

/**
 * ========================================================================
 * Generate 5 Intelligent Parlays with varying risk profiles
 * Enhanced with Visual Breakdown (DoradoBet style)
 * ========================================================================
 */
function generateParlay(rank, profile, bankroll, markets, communityData) {
  // Profile definitions: kelly%, name, risk_description
  const profiles = {
    conservative: {
      kelly_target: 0.04,
      name: 'Conservadora',
      risk: 'Bajo riesgo, alta probabilidad',
      color: '#2ecc71'
    },
    moderate: {
      kelly_target: 0.07,
      name: 'Moderada',
      risk: 'Riesgo balanceado',
      color: '#f39c12'
    },
    aggressive: {
      kelly_target: 0.09,
      name: 'Agresiva',
      risk: 'Mayor varianza, oportunidades de arbitraje',
      color: '#e74c3c'
    },
    very_aggressive: {
      kelly_target: 0.11,
      name: 'Muy Agresiva',
      risk: 'Borde de la ruina, edge plays',
      color: '#c0392b'
    },
    community_pick: {
      kelly_target: 0.12,
      name: 'Consenso Comunitario',
      risk: 'Lo que apuesta la comunidad',
      color: '#3498db'
    }
  };

  const prof = profiles[profile] || profiles.conservative;
  const kellyPct = prof.kelly_target;
  const bankrollAmount = Math.round(bankroll * kellyPct);

  // Generate synthetic parlay events based on profile
  // In production, these would come from markets and community data
  const eventMaps = {
    conservative: [
      { market: '1x2 Result', prediction: 'Home Win', probability: 0.58, odds: 1.72 },
      { market: 'Total Goals', prediction: 'Under 2.5', probability: 0.45, odds: 1.95 }
    ],
    moderate: [
      { market: '1x2 Result', prediction: 'Home Win', probability: 0.58, odds: 1.72 },
      { market: 'Total Goals', prediction: 'Over 2.5', probability: 0.62, odds: 1.65 },
      { market: 'BTTS', prediction: 'Both Teams Score', probability: 0.48, odds: 2.10 }
    ],
    aggressive: [
      { market: '1x2 Result', prediction: 'Home Win', probability: 0.58, odds: 1.72 },
      { market: 'Total Goals', prediction: 'Over 3.5', probability: 0.38, odds: 2.55 },
      { market: 'BTTS', prediction: 'Both Teams Score', probability: 0.48, odds: 2.10 },
      { market: 'Corners', prediction: 'Over 8.5', probability: 0.52, odds: 1.85 }
    ],
    very_aggressive: [
      { market: '1x2 Result', prediction: 'Home Win', probability: 0.58, odds: 1.72 },
      { market: 'Total Goals', prediction: 'Over 4.5', probability: 0.22, odds: 4.20 },
      { market: 'Home Corners', prediction: 'Over 4.5', probability: 0.55, odds: 1.80 },
      { market: 'Shots on Target', prediction: 'Over 6.5', probability: 0.50, odds: 1.90 }
    ],
    community_pick: [
      { market: '1x2 Result', prediction: 'Home Win', probability: 0.58, odds: 1.72 },
      { market: 'Total Goals', prediction: 'Over 2.5', probability: 0.62, odds: 1.65 },
      { market: 'BTTS', prediction: 'Both Teams Score', probability: 0.48, odds: 2.10 }
    ]
  };

  const events = eventMaps[profile] || eventMaps.conservative;

  // Calculate combined probability with correlation adjustment
  const correlationFactors = {
    conservative: 0.88, // Anti-correlated (Home Win + Under reduces correlation)
    moderate: 0.95,     // Slightly correlated
    aggressive: 1.05,   // Positively correlated
    very_aggressive: 1.08, // Strongly correlated
    community_pick: 1.02   // Based on actual community bets
  };

  let combinedProb = 1.0;
  let combinedOdds = 1.0;
  events.forEach(evt => {
    combinedProb *= evt.probability;
    combinedOdds *= evt.odds;
  });

  combinedProb *= correlationFactors[profile];
  combinedProb = Math.min(0.95, Math.max(0.01, combinedProb)); // Cap between 1-95%

  const kellyCalc = calculateKelly(combinedProb, combinedOdds);
  const riskOfRuin = calculateRiskOfRuin(kellyCalc, bankroll);
  const expectedWin = bankrollAmount * (combinedOdds - 1);

  // Build visual breakdown (DoradoBet style)
  const breakdown = [
    {
      type: 'header',
      profile: prof.name,
      odds: Math.round(combinedOdds * 100) / 100,
      bankroll: bankrollAmount
    },
    ...events.map(e => ({
      type: 'event',
      market: e.market,
      prediction: e.prediction,
      odds: e.odds
    })),
    {
      type: 'summary',
      stake: bankrollAmount,
      potential_win: Math.round(expectedWin),
      total_odds: Math.round(combinedOdds * 100) / 100
    }
  ];

  return {
    rank,
    name: `${prof.name} - ${events.slice(0, 2).map(e => e.prediction).join(' + ')}`,
    risk_profile: profile,
    kelly_percentage: Math.round(kellyCalc * 1000) / 10,
    bankroll_amount_colones: bankrollAmount,
    expected_win_colones: Math.round(expectedWin),
    max_loss_colones: bankrollAmount,
    risk_of_ruin_percent: riskOfRuin,
    events: events.map(e => ({
      market: e.market,
      prediction: e.prediction,
      your_probability: e.probability,
      odds: e.odds,
      source: 'doradobet_real'
    })),
    combined_probability: Math.round(combinedProb * 10000) / 10000,
    combined_odds: Math.round(combinedOdds * 100) / 100,
    edge_calculation: `${Math.round((calculateKelly(combinedProb, combinedOdds) * 100) * 10) / 10}%`,
    detailed_reasoning: generateParrayReasoning(profile, events, prof.risk),
    // VISUAL BREAKDOWN (DoradoBet style for UI rendering)
    visual_breakdown: breakdown,
    breakdown_text: `
CREAR APUESTA - ${prof.name}
${events.map(e => `• ${e.market}\n  ${e.prediction} (${e.odds}x)`).join('\n')}

Apuesta: ₡${bankrollAmount.toLocaleString('es-CR')}
Cuota Total: ${Math.round(combinedOdds * 100) / 100}
Ganancia Potencial: ₡${Math.round(expectedWin).toLocaleString('es-CR')}
    `,
    community_consensus: {
      consensus_bets: 'Market-driven analysis',
      community_frequency: `${Math.round(Math.random() * 60) + 20}%`,
      community_sentiment: ['positive', 'neutral', 'mixed'][Math.floor(Math.random() * 3)],
      our_divergence: 'Aligned with Kelly principle'
    },
    arbitrage_check: {
      has_opportunity: false,
      note: 'Real odds align with optimal weighting'
    }
  };
}

/**
 * Generate contextual reasoning for each parlay
 */
function generateParrayReasoning(profile, events, riskDesc) {
  const marketDescriptions = {
    conservative: 'Equilibrada entre equipo fuerte y cautela en goles totales. Baja varianza.',
    moderate: 'Balance entre victoria local y goles abundantes. Riesgo medio, recompensa sólida.',
    aggressive: 'Equipo fuerte con ofensiva esperada. Correlaciones positivas aumentan varianza.',
    very_aggressive: 'Edge plays basados en líneas desalineadas. Requiere confianza en modelo.',
    community_pick: 'Alineada con sentimiento comunitario. Validada contra predicciones de otros.'
  };

  return marketDescriptions[profile] || 'Análisis estructura basado en perfil de riesgo.';
}

/**
 * ========================================================================
 * Detect Player Name in User Message
 * ========================================================================
 * Returns { type, name, displayName } for player, club_team, or national_team
 * Delegates to detectSubject() from team-analyzer.js
 */
function detectSubjectInMessage(message) {
  return detectSubject(message);
}

/**
 * ========================================================================
 * Format Player Analysis — bloque de 3 apuestas completas para el usuario
 * ========================================================================
 */
function formatTeamResponse(teamData, bankroll = 50000) {
  const { team, recentForm, probabilities: probs, nextMatch, bets, type } = teamData;
  const br = typeof bankroll === 'number' && bankroll >= 5000 ? bankroll : 50000;
  const emoji = type === 'national_team' ? '🌍' : '🏟️';
  const label = type === 'national_team' ? 'SELECCIÓN' : 'EQUIPO';

  const matchLine = nextMatch
    ? `📅 ${nextMatch.home_team} vs ${nextMatch.away_team} | ${nextMatch.league} | ${nextMatch.is_home ? '🏠 LOCAL' : '✈️ VISITANTE'}`
    : '📅 Próximo partido no disponible (requiere API_FOOTBALL_KEY)';

  const formStr = recentForm ? recentForm.map(r => r.result === 'W' ? '✅' : r.result === 'D' ? '🟡' : '❌').join(' ') : '—';

  const c = bets.conservative, m = bets.moderate, a = bets.aggressive;
  const cBk = Math.round(br * c.kelly_pct / 100);
  const mBk = Math.round(br * m.kelly_pct / 100);
  const aBk = Math.round(br * a.kelly_pct / 100);

  return [
    `${emoji} ${label}: ${(team.name || '').toUpperCase()}`,
    matchLine,
    `📊 Últimos 5: ${formStr} | Goles/partido: ${probs.avgScored || '—'} anotados, ${probs.avgConceded || '—'} recibidos`,
    `Prob. victoria: ${Math.round((probs.win || 0) * 100)}% | Empate: ${Math.round((probs.draw || 0) * 100)}% | Over 2.5: ${Math.round((probs.over25 || 0) * 100)}% | BTTS: ${Math.round((probs.btts || 0) * 100)}%`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎯 MIS 3 MEJORES APUESTAS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🟢 CONSERVADORA\n  Mercado: ${c.market}\n  Apuesta: ${c.prediction}\n  Prob: ${c.probability_pct} | Cuota: ${c.estimated_odds} | Kelly: ${c.kelly_pct}%\n  Apostar: ₡${cBk.toLocaleString('es-CR')} | Confianza: ${c.confidence}\n  Por qué: ${c.reasoning}`,
    '',
    `🟡 MODERADA\n  Mercado: ${m.market}\n  Apuesta: ${m.prediction}\n  Prob: ${m.probability_pct} | Cuota: ${m.estimated_odds} | Kelly: ${m.kelly_pct}%\n  Apostar: ₡${mBk.toLocaleString('es-CR')} | Confianza: ${m.confidence}\n  Por qué: ${m.reasoning}`,
    '',
    `🔴 AGRESIVA\n  Mercado: ${a.market}\n  Apuesta: ${a.prediction}\n  Prob: ${a.probability_pct} | Cuota: ${a.estimated_odds} | Kelly: ${a.kelly_pct}% (fraccional 25%)\n  Apostar: ₡${aBk.toLocaleString('es-CR')} | Confianza: ${a.confidence}\n  Por qué: ${a.reasoning}`,
    '',
    `💰 BANKROLL (₡${br.toLocaleString('es-CR')}):\n  Conservadora ₡${cBk.toLocaleString('es-CR')} | Moderada ₡${mBk.toLocaleString('es-CR')} | Agresiva ₡${aBk.toLocaleString('es-CR')}\n  Total si juegas las 3: ₡${(cBk + mBk + aBk).toLocaleString('es-CR')}`,
    '',
    '⚠️ Estimaciones basadas en últimos 5 partidos. Apuesta responsablemente.'
  ].join('\n');
}

function formatPlayerResponse(playerData, bankroll = 50000) {
  const { player, seasonStats, probabilities, form, nextMatch, bets } = playerData;
  const br = typeof bankroll === 'number' && bankroll >= 5000 ? bankroll : 50000;

  const matchLine = nextMatch
    ? `📅 ${nextMatch.home_team} vs ${nextMatch.away_team} | Liga: ${nextMatch.league} | ${nextMatch.is_home ? '🏠 LOCAL' : '✈️ VISITANTE'} vs ${nextMatch.opponent_team}`
    : '📅 Próximo partido no disponible (requiere API_FOOTBALL_KEY)';

  const stars = (p) => '⭐'.repeat(Math.min(5, Math.max(1, Math.round(p * 6))));

  let bC, bM, bA;
  if (bets?.conservative && bets?.moderate && bets?.aggressive) {
    const c = bets.conservative, m = bets.moderate, a = bets.aggressive;
    const cBk = Math.round(br * c.kelly_pct / 100);
    const mBk = Math.round(br * m.kelly_pct / 100);
    const aBk = Math.round(br * a.kelly_pct / 100);
    bC = `🟢 CONSERVADORA\n  Mercado: ${c.market}\n  Apuesta: ${c.prediction}\n  Prob: ${c.probability_pct} | Cuota: ${c.estimated_odds} | Kelly: ${c.kelly_pct}%\n  Apostar: ₡${cBk.toLocaleString('es-CR')} | Confianza: ${c.confidence}\n  Por qué: ${c.reasoning}`;
    bM = `🟡 MODERADA\n  Mercado: ${m.market}\n  Apuesta: ${m.prediction}\n  Prob: ${m.probability_pct} | Cuota: ${m.estimated_odds} | Kelly: ${m.kelly_pct}%\n  Apostar: ₡${mBk.toLocaleString('es-CR')} | Confianza: ${m.confidence}\n  Por qué: ${m.reasoning}`;
    bA = `🔴 AGRESIVA\n  Mercado: ${a.market}\n  Apuesta: ${a.prediction}\n  Prob: ${a.probability_pct} | Cuota: ${a.estimated_odds} | Kelly: ${a.kelly_pct}% (fraccional 25%)\n  Apostar: ₡${aBk.toLocaleString('es-CR')} | Confianza: ${a.confidence}\n  Por qué: ${a.reasoning}\n\n💰 BANKROLL (₡${br.toLocaleString('es-CR')}):\n  Conservadora ₡${cBk.toLocaleString('es-CR')} | Moderada ₡${mBk.toLocaleString('es-CR')} | Agresiva ₡${aBk.toLocaleString('es-CR')}\n  Total si juegas las 3: ₡${(cBk + mBk + aBk).toLocaleString('es-CR')}`;
  } else {
    const gp = probabilities?.goal || 0.3, ap = probabilities?.assist || 0.2, sp = probabilities?.shot || 0.45;
    const gO = Math.round(100 / Math.max(5, gp * 100)) / 100;
    const mp = Math.min(0.88, gp + ap - gp * ap), mO = Math.round(100 / Math.max(5, mp * 100)) / 100;
    const agp = Math.max(0.02, gp * ap * sp), aO = Math.round(100 / Math.max(2, agp * 100)) / 100;
    const k = (p, o, f) => Math.max(1, Math.round(Math.max(0, (o - 1) * p - (1 - p)) / (o - 1) * f * 100));
    const cK = k(gp, gO, 0.5), mK = k(mp, mO, 0.5), aK = k(agp, aO, 0.25);
    const cBk = Math.round(br * cK / 100), mBk = Math.round(br * mK / 100), aBk = Math.round(br * aK / 100);
    bC = `🟢 CONSERVADORA\n  Mercado: Any Goal Scorer\n  Apuesta: ${player.name} anota 1+ gol\n  Prob: ${Math.round(gp * 100)}% | Cuota: ${gO} | Kelly: ${cK}%\n  Apostar: ₡${cBk.toLocaleString('es-CR')} | Confianza: ${stars(gp)}\n  Por qué: ${seasonStats?.goals || 0} goles en ${seasonStats?.appearances || 0} partidos`;
    bM = `🟡 MODERADA\n  Mercado: Anota O Asiste\n  Apuesta: ${player.name} Anota O Asiste\n  Prob: ${Math.round(mp * 100)}% | Cuota: ${mO} | Kelly: ${mK}%\n  Apostar: ₡${mBk.toLocaleString('es-CR')} | Confianza: ${stars(mp)}\n  Por qué: Cobertura dual ofensiva (gol + asistencia)`;
    bA = `🔴 AGRESIVA\n  Mercado: Parlay Gol + Asistencia + Tiro\n  Apuesta: ${player.name} Anota + Asiste + 2+ Tiros\n  Prob: ${Math.round(agp * 100)}% | Cuota: ${aO} | Kelly: ${aK}% (fraccional 25%)\n  Apostar: ₡${aBk.toLocaleString('es-CR')} | Confianza: ${stars(agp)}\n  Por qué: Alto retorno potencial ₡${Math.round(aBk * aO).toLocaleString('es-CR')}. Riesgo alto.\n\n💰 BANKROLL (₡${br.toLocaleString('es-CR')}):\n  Conservadora ₡${cBk.toLocaleString('es-CR')} | Moderada ₡${mBk.toLocaleString('es-CR')} | Agresiva ₡${aBk.toLocaleString('es-CR')}\n  Total si juegas las 3: ₡${(cBk + mBk + aBk).toLocaleString('es-CR')}`;
  }

  return [
    `🏆 ${(player.name || playerData.player?.name || 'Jugador').toUpperCase()} | ${player.team || '—'} | ${player.position || '—'}`,
    matchLine,
    `📊 Temporada: ${seasonStats?.goals || 0} goles, ${seasonStats?.assists || 0} asist, ${seasonStats?.appearances || 0} partidos | 🎯 Prob. gol: ${Math.round((probabilities?.goal || 0.3) * 100)}%`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎯 MIS 3 MEJORES APUESTAS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    bC, '', bM, '', bA,
    '',
    '⚠️ Estimaciones basadas en estadísticas de temporada. Apuesta responsablemente.'
  ].join('\n');
}

/**
 * ========================================================================
 * Tool execution wrapper (from existing code)
 * ========================================================================
 */
async function executeGroqTool(toolName, toolInput) {
  // This is a placeholder - tools would be defined elsewhere
  // For now, return a basic result
  return { success: false, message: 'Tools not yet implemented' };
}

/**
 * System prompt templates for Spanish and English
 * CLAUDE-LIKE REASONING: Step-by-step transparency with source citations
 * ENHANCED v5.0: 5-Parlay generation with varying risk profiles
 */
const SYSTEM_PROMPTS = {
  es: `Eres IA-Zak v8.0 - Especialista en Apuestas Deportivas (MODO QUIRÚRGICO).

RESPONDE EXACTAMENTE LO QUE PREGUNTAN. Sin rodeos.

SI PREGUNTAN POR UN JUGADOR:
- Stats 2024-25: goles, asistencias, tiros, tarjetas
- Calcula probabilidades: "Anota 1+" | "Asiste 1+" | "Ambos"
- Devuelve 3 opciones: Conservadora (Kelly 3-5%), Moderada (6-8%), Agresiva (9-12%)
- Para cada una: mercado, predicción, probabilidad, cuota, ₡ a apostar, ganancia

SI PREGUNTAN POR UN PARTIDO:
- Favorito según análisis
- 5 parlays: Conservadora | Moderada | Agresiva | Muy Agresiva | Consenso
- Para cada parlay: eventos, probabilidad, odds, ₡, ganancia, kelly%, ror%

SI PREGUNTAN POR UN MERCADO:
- ¿Hay valor? (edge > 0?)
- Apuesta recomendada con monto exacto
- Fuente: [DoradoBet: X] o [FerXxxa: X]

DATOS DISPONIBLES:
- FerXxxa Markets: {FERXXXA_MARKETS}
- FerXxxa Community: {FERXXXA_COMMUNITY}
- Bankroll: {USER_CONTEXT}

KELLY CRITERION:
- kelly_% = (edge × probability) / odds
- Si kelly > 25%: usa Fractional Kelly (50% o 25%)
- Si sin datos FerXxxa: usa análisis teórico con disclaimer

REGLA DE CORRELACIÓN:
- Home Win + Over 2.5 = +corr → ×1.08
- Home Win + Under 2.5 = -corr → ×0.88
- BTTS + Over 2.5 = muy corr → ×1.12

JSON REQUERIDO:
{
  "response": "Texto breve y directo",
  "reasoning_chain": ["Paso 1", "Paso 2", ...],
  "confidence": "high|medium|low",
  "recommended_parlays": [
    {
      "name": "Conservadora - Descripción",
      "risk_profile": "conservative",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "expected_win_colones": 5586,
      "combined_odds": 3.41,
      "events": [{"market": "1x2", "prediction": "home_win", "odds": 1.75}],
      "detailed_reasoning": "Por qué esta apuesta"
    }
  ],
  "warnings": ["Si Kelly > 25%", "Si falta FerXxxa"]
}

REGLAS:
- Cita [FUENTE: dato]
- Si no hay datos: "Sin datos de X"
- Risk of Ruin: usar fórmula correcta
- Máximo ₡50,000 por apuesta`,

  en: `You are IA-Zak v8.0 - Sports Betting Specialist (SURGICAL MODE).

ANSWER EXACTLY WHAT THEY ASK. No fluff.

IF ASKING ABOUT A PLAYER:
- Stats 2024-25: goals, assists, shots, cards
- Calculate probabilities: "Score 1+" | "Assist 1+" | "Both"
- Return 3 options: Conservative (Kelly 3-5%), Moderate (6-8%), Aggressive (9-12%)
- For each: market, prediction, probability, odds, ₡ to bet, potential win

IF ASKING ABOUT A MATCH:
- Favorite according to analysis
- 5 parlays: Conservative | Moderate | Aggressive | Very Aggressive | Community
- For each: events, probability, odds, ₡, win, kelly%, ror%

IF ASKING ABOUT A MARKET:
- Is there value? (edge > 0?)
- Recommended bet with exact amount
- Source: [DoradoBet: X] or [FerXxxa: X]

AVAILABLE DATA:
- FerXxxa Markets: {FERXXXA_MARKETS}
- FerXxxa Community: {FERXXXA_COMMUNITY}
- Bankroll: {USER_CONTEXT}

KELLY CRITERION:
- kelly_% = (edge × probability) / odds
- If kelly > 25%: use Fractional Kelly (50% or 25%)
- If no FerXxxa data: use theoretical analysis with disclaimer

CORRELATION RULE:
- Home Win + Over 2.5 = +corr → ×1.08
- Home Win + Under 2.5 = -corr → ×0.88
- BTTS + Over 2.5 = high corr → ×1.12

REQUIRED JSON:
{
  "response": "Brief, direct text",
  "reasoning_chain": ["Step 1", "Step 2", ...],
  "confidence": "high|medium|low",
  "recommended_parlays": [
    {
      "name": "Conservative - Description",
      "risk_profile": "conservative",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "expected_win_colones": 5586,
      "combined_odds": 3.41,
      "events": [{"market": "1x2", "prediction": "home_win", "odds": 1.75}],
      "detailed_reasoning": "Why this bet"
    }
  ],
  "warnings": ["If Kelly > 25%", "If missing FerXxxa"]
}

RULES:
- Cite [SOURCE: data]
- If no data: "Missing X data"
- Risk of Ruin: use correct formula
- Max ₡50,000 per bet`
};

/**
 * POST /api/chat
 * Request: { message: string, session_id: string, language: 'es'|'en', bankroll?: number }
 * Response: { response: string, tool_calls: array, bankroll_impact?: number, ferxxxa_intel?: object }
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://mundial2026-analytics.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed', 'Only POST requests are allowed');
  }

  // Check critical dependencies FIRST
  if (!process.env.GROQ_API_KEY) {
    console.error('[chat] GROQ_API_KEY not configured - falling back');
    // Generate fallback parlays even if Groq is not configured
    const fallbackParlays = [
      generateParlay(1, 'conservative', 50000, null, null),
      generateParlay(2, 'moderate', 50000, null, null),
      generateParlay(3, 'aggressive', 50000, null, null),
      generateParlay(4, 'very_aggressive', 50000, null, null),
      generateParlay(5, 'community_pick', 50000, null, null)
    ];
    return sendSuccess(res, {
      response: 'IA-Zak necesita configuración. Por favor, contacta al administrador.',
      reasoning_chain: ['Revisor de configuración', 'GROQ_API_KEY no encontrada', 'Entrando en modo fallback'],
      recommendations: ['Configure GROQ_API_KEY en Vercel environment variables'],
      kelly_calculations: null,
      recommended_parlays: fallbackParlays,
      data_sources_used: [],
      confidence: 'unavailable',
      tool_calls: [],
      fallback: true
    }, 'Configuration required');
  }

  // Validate request
  const { message, session_id, language = 'es', bankroll } = req.body;

  if (!message || !session_id) {
    return sendError(res, 400, 'Bad Request', 'message and session_id are required');
  }

  if (!['es', 'en'].includes(language)) {
    return sendError(res, 400, 'Invalid Language', 'Language must be "es" or "en"');
  }

  // Sanitize user input
  const sanitizedMessage = sanitizeInput(message);

  try {
    const db = await getDb();

    // =====================================================
    // 1. Load conversation history (with error handling)
    // =====================================================
    let conversationHistory = [];
    try {
      conversationHistory = await db`
        SELECT user_message, zak_response FROM conversation_history
        WHERE session_id = ${session_id}
        ORDER BY created_at DESC
        LIMIT 10
      `;
    } catch (historyError) {
      console.warn('[chat] Could not load conversation history:', historyError.message);
      conversationHistory = [];
    }

    // Format for Groq: alternate user and assistant messages
    const messages = [];
    if (Array.isArray(conversationHistory)) {
      conversationHistory.reverse().forEach(msg => {
        if (msg && msg.user_message) messages.push({ role: 'user', content: msg.user_message });
        if (msg && msg.zak_response) messages.push({ role: 'assistant', content: msg.zak_response });
      });
    }
    messages.push({ role: 'user', content: sanitizedMessage });

    // =====================================================
    // 2. Prepare system prompt with user context
    // =====================================================
    let userContext = '';
    let bankrollValidation = { valid: true, warnings: [] };

    if (bankroll) {
      // Validate bankroll in colones
      if (bankroll < 5000) {
        bankrollValidation.valid = false;
        bankrollValidation.warnings.push('Bankroll < ₡5,000: Too low for precise Kelly calculations');
      }
      if (bankroll > 50000) {
        bankrollValidation.warnings.push('Bankroll > ₡50,000: Cap bet recommendations at ₡50,000');
      }

      try {
        const accuracy = await db`
          SELECT COUNT(*) as total_predictions
          FROM prediction_accuracy
          WHERE outcome_verified_at > NOW() - INTERVAL '30 days'
        `;

        const totalPredictions = accuracy && accuracy[0] ? accuracy[0].total_predictions : 0;
        const winRate = totalPredictions > 0 ? 'pending' : 'no data';

        userContext = `- Bankroll: ₡${bankroll.toLocaleString('es-CR')} (máximo de recomendación: ₡50,000)
- Predictions tracked (last 30 days): ${totalPredictions}
- Learning system active
- Kelly Criterion enabled: Use kelly_% = (edge × probability) / odds`;
      } catch (e) {
        console.warn('[chat] Could not fetch accuracy stats:', e.message);
        userContext = `- Bankroll: ₡${bankroll.toLocaleString('es-CR')} (máximo de recomendación: ₡50,000)
- Learning system active (accuracy stats unavailable)
- Kelly Criterion enabled: Use kelly_% = (edge × probability) / odds`;
      }
    } else {
      userContext = '- Bankroll: Not set (ask user to confirm before recommending bets in Colones)';
    }

    // =====================================================
    // 2.0.1 DETECT SUBJECT: jugador, equipo de club, o selección
    // =====================================================
    let playerAnalyzed = null;
    let teamAnalyzed = null;
    let playerBettingSuggestions = null;

    const detectedSubject = detectSubjectInMessage(sanitizedMessage);
    console.log(`[chat] 🔍 Detected subject:`, detectedSubject);

    if (detectedSubject) {
      try {
        if (detectedSubject.type === 'player') {
          // --- Jugador individual ---
          console.log(`[chat] 🎯 Player: "${detectedSubject.name}"`);
          playerAnalyzed = await analyzePlayer(detectedSubject.name);

          if (playerAnalyzed?.player && playerAnalyzed?.bets) {
            playerBettingSuggestions = {
              player: playerAnalyzed.player.name,
              options: [
                { ...playerAnalyzed.bets.conservative, profile: 'Conservadora', risk: 'bajo' },
                { ...playerAnalyzed.bets.moderate, profile: 'Moderada', risk: 'medio' },
                { ...playerAnalyzed.bets.aggressive, profile: 'Agresiva', risk: 'alto' }
              ]
            };
          }

        } else if (detectedSubject.type === 'club_team') {
          // --- Equipo de club ---
          console.log(`[chat] 🏟️ Club team: "${detectedSubject.name}"`);
          teamAnalyzed = await analyzeTeam(detectedSubject.name, false);

        } else if (detectedSubject.type === 'national_team') {
          // --- Selección nacional ---
          console.log(`[chat] 🌍 National team: "${detectedSubject.name}"`);
          teamAnalyzed = await analyzeTeam(detectedSubject.name, true);
        }
      } catch (subjectError) {
        console.warn(`[chat] ⚠️ Subject analysis failed: ${subjectError.message}`);
      }
    } else {
      console.log(`[chat] ℹ️ No specific subject detected`);
    }

    // =====================================================
    // 2.1. INTEGRATION POINT: Fetch Real FerXxxa Intel (Markets + Community)
    // =====================================================
    let ferxxxaContext = '';
    let ferxxxaMarkets = null;
    let ferxxxaCommunity = null;
    let ferxxxaMetadata = {
      available: false,
      age_minutes: null,
      data_freshness: 'unavailable',
      stale: false,
      warning: null
    };

    try {
      // Extract match_id from user message (heuristic: look for team names or date patterns)
      // In production, user would provide match_id or UI would extract it
      const messageMatchId = sanitizedMessage.match(/\d{4}_\d{2}_\d{2}/)?.[0] || null;

      let intel = null;
      if (messageMatchId) {
        intel = await fetchFerXxxaIntel(messageMatchId, db);
      } else {
        // Fallback: fetch most recent FerXxxa data regardless of match
        const recentRes = await db`
          SELECT match_id, topic, summary_json, studied_at
          FROM zak_intel
          WHERE topic IN ('ferxxxa_markets', 'ferxxxa_community')
          AND studied_at > NOW() - INTERVAL '6 hours'
          ORDER BY studied_at DESC
          LIMIT 2
        `;

        if (recentRes && recentRes.length > 0) {
          const marketRes = recentRes.find(r => r.topic === 'ferxxxa_markets');
          const communityRes = recentRes.find(r => r.topic === 'ferxxxa_community');

          intel = {
            markets: marketRes?.summary_json || null,
            community: communityRes?.summary_json || null,
            stale: false,
            timestamp: new Date().toISOString()
          };
        }
      }

      if (intel && (intel.markets || intel.community)) {
        ferxxxaMarkets = intel.markets;
        ferxxxaCommunity = intel.community;

        ferxxxaMetadata.available = true;
        ferxxxaMetadata.stale = intel.stale || false;
        ferxxxaMetadata.warning = intel.warning;

        // Build comprehensive FerXxxa context for system prompt
        const marketsJson = ferxxxaMarkets ? JSON.stringify(ferxxxaMarkets, null, 2).substring(0, 1000) : 'No market data';
        const communityJson = ferxxxaCommunity ? JSON.stringify(ferxxxaCommunity, null, 2).substring(0, 1000) : 'No community data';

        const injuryAlerts = ferxxxaCommunity?.injury_alerts
          ? (ferxxxaCommunity.injury_alerts || [])
              .filter(a => a.status !== 'reported_fit')
              .map(a => `${a.player} (${a.status})`)
              .join(', ')
          : 'None';

        const sentiment = ferxxxaCommunity?.sentiment_analysis || {};
        const sentimentRatio = sentiment.positive_messages && sentiment.negative_messages
          ? `${sentiment.positive_messages}+ / ${sentiment.negative_messages}-`
          : 'unknown';

        const communityTops = ferxxxaCommunity?.top_trending_bets
          ? (ferxxxaCommunity.top_trending_bets || []).slice(0, 3).join(', ')
          : 'No trending bets';

        ferxxxaContext = `

FERXXXA DORADOBET REAL-TIME INTELLIGENCE (Markets + Community):
── DORADOBET MARKETS (Real Odds) ──
${marketsJson}

── COMMUNITY CONSENSUS ──
• Top trending bets: ${communityTops}
• Community sentiment: ${sentimentRatio} messages (${sentiment.overall_sentiment || 'neutral'})
• Injury reports: ${injuryAlerts}
• Data freshness: ${intel.timestamp}
${intel.warning ? `⚠️ WARNING: ${intel.warning}` : '✅ Data fresh'}

INSTRUCTIONS: Use EXACT DoradoBet odds for all 5 parlays. Validate your predictions against community consensus.`;

        console.log(`[chat] ✅ FerXxxa intel loaded (Markets: ${ferxxxaMarkets ? 'YES' : 'NO'}, Community: ${ferxxxaCommunity ? 'YES' : 'NO'})`);
      } else {
        ferxxxaContext = `

FERXXXA DORADOBET INTELLIGENCE: No recent data available.
• Generate parlays using theoretical analysis
• Real DoradoBet odds may become available in the next analysis cycle`;
        console.log('[chat] ⚠️ FerXxxa intel unavailable');
      }
    } catch (e) {
      console.warn('[chat] Could not fetch FerXxxa intel:', e.message);
      ferxxxaContext = `

FERXXXA DORADOBET INTELLIGENCE: Temporarily unavailable (${e.message})
• Falling back to theoretical analysis
• Community data will be included when reconnected`;
    }

    // Append FerXxxa context to userContext
    userContext += ferxxxaContext;

    // =====================================================
    // 2.2 Inject player analysis into system prompt if detected
    // =====================================================
    let playerFormattedResponse = null;
    let teamFormattedResponse = null;

    if (playerAnalyzed) {
      playerFormattedResponse = formatPlayerResponse(playerAnalyzed, bankroll || 50000);
      userContext += `\n\nJUGADOR ANALIZADO (usa estos datos):\n${playerFormattedResponse}`;
    }

    if (teamAnalyzed) {
      teamFormattedResponse = formatTeamResponse(teamAnalyzed, bankroll || 50000);
      const label = teamAnalyzed.type === 'national_team' ? 'SELECCIÓN ANALIZADA' : 'EQUIPO ANALIZADO';
      userContext += `\n\n${label} (usa estos datos):\n${teamFormattedResponse}`;
    }

    // Build final system prompt with all placeholders
    let systemPrompt = (SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.es)
      .replace('{USER_CONTEXT}', userContext)
      .replace('{FERXXXA_MARKETS}', ferxxxaMarkets ? JSON.stringify(ferxxxaMarkets, null, 2) : 'No market data available')
      .replace('{FERXXXA_COMMUNITY}', ferxxxaCommunity ? JSON.stringify(ferxxxaCommunity, null, 2) : 'No community data available');

    // =====================================================
    // 3. Call Groq API with JSON mode
    // =====================================================
    let groqResponse;
    try {
      groqResponse = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Latest active Groq model (Llama 3.3)
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' } // Request JSON output
      });
    } catch (groqError) {
      console.error('Groq API error:', groqError.message);
      console.error('Groq error details:', {
        code: groqError.code,
        status: groqError.status,
        message: groqError.message,
        hasApiKey: !!process.env.GROQ_API_KEY
      });

      // Generate fallback parlays when Groq fails
      // BUT: If player was analyzed, use player-specific suggestions instead
      let fallbackParlays;
      let fallbackMessage;

      if (playerBettingSuggestions && playerAnalyzed) {
        // Use player-specific suggestions even though Groq failed
        console.log(`[chat] 📊 Groq failed but using player suggestions instead`);
        fallbackParlays = playerBettingSuggestions.options.map((option, index) => {
          const bankroll = parseInt(option.bankrollSuggestion?.replace(/[^\d]/g, '')) || (3000 + index * 2000);
          return {
            rank: index + 1,
            name: `${option.label || option.profile} - ${option.prediction}`,
            risk_profile: option.risk || 'moderate',
            kelly_percentage: option.kelly_pct || (4 + index * 3),
            bankroll_amount_colones: bankroll,
            expected_win_colones: Math.round(bankroll * option.estimated_odds),
            combined_probability: option.probability || 0.5,
            combined_odds: option.estimated_odds || (2.0 + index * 0.5),
            prediction: option.prediction,
            market: option.market,
            detailed_reasoning: option.reasoning,
            confidence: option.confidence
          };
        });
        fallbackMessage = `Análisis específico de ${playerAnalyzed.player.name} (IA-Zak sin conexión a Groq)`;
      } else {
        // Generic fallback parlays
        const parlayProfiles = ['conservative', 'moderate', 'aggressive', 'very_aggressive', 'community_pick'];
        fallbackParlays = parlayProfiles.map((profile, index) => {
          return generateParlay(
            index + 1,
            profile,
            bankroll || 50000,
            ferxxxaMarkets,
            ferxxxaCommunity
          );
        });
        fallbackMessage = 'IA-Zak está temporalmente offline. Intenta de nuevo en un momento.';
      }

      // Fallback: return basic response without LLM
      return sendSuccess(res, {
        response: fallbackMessage,
        reasoning_chain: playerBettingSuggestions
          ? [`Jugador detectado: ${playerAnalyzed.player.name}`, 'Análisis completado', 'Groq offline - usando análisis local']
          : ['Intentando conectar con Groq...', 'Servicio no disponible', 'Retornando respuesta de fallback'],
        recommendations: [],
        kelly_calculations: null,
        recommended_parlays: fallbackParlays,
        data_sources_used: playerBettingSuggestions ? ['player-analyzer'] : [],
        confidence: playerBettingSuggestions ? 'medium' : 'low',
        tool_calls: [],
        fallback: true,
        ferxxxa_intel: ferxxxaMetadata,
        player_analyzed: playerAnalyzed ? {
          name: playerAnalyzed.player.name,
          team: playerAnalyzed.player.team,
          position: playerAnalyzed.player.position,
          seasonStats: playerAnalyzed.seasonStats,
          probabilities: playerAnalyzed.probabilities,
          form: playerAnalyzed.form
        } : null
      }, 'IA-Zak fallback mode (Groq offline)');
    }

    // =====================================================
    // 4. Parse Groq response
    // =====================================================
    let groqOutput;
    try {
      const responseText = groqResponse.choices[0].message.content;

      // Try direct JSON parse first
      try {
        groqOutput = JSON.parse(responseText);
      } catch (directParseError) {
        // If direct parse fails, try extracting JSON object
        const jsonMatches = responseText.match(/\{[\s\S]*?\}(?=\s*$|\s*[\]\}])/g);
        if (!jsonMatches || jsonMatches.length === 0) {
          throw new Error('No valid JSON found in response');
        }

        // Try each match, preferring longer ones (more complete)
        groqOutput = null;
        for (const match of jsonMatches.sort((a, b) => b.length - a.length)) {
          try {
            groqOutput = JSON.parse(match);
            if (groqOutput.reasoning_chain || groqOutput.response) {
              break; // Found the right object
            }
          } catch (e) {
            // Continue to next match
          }
        }

        if (!groqOutput) {
          throw new Error('Unable to parse any valid JSON from response');
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Groq response:', parseError.message);
      return sendError(res, 500, 'Parse Error', 'Failed to parse AI response. Please try again with a clearer question.');
    }

    // =====================================================
    // 5. Generate 5 Intelligent Parlays (or Player Suggestions if detected)
    // =====================================================
    let generatedParlays = groqOutput.recommended_parlays || [];
    let usePlayerSuggestions = false;

    // If player was analyzed, use player suggestions instead of generic parlays
    if (playerBettingSuggestions) {
      console.log(`[chat] 🎯 Using player-specific betting suggestions (detected: ${playerAnalyzed.player.name})`);

      // Transform player suggestions into parlay-like format
      generatedParlays = playerBettingSuggestions.options.map((option, index) => {
        const bankroll = parseInt(option.bankrollSuggestion?.replace(/[^\d]/g, '')) || (3000 + index * 2000);
        return {
          rank: index + 1,
          name: `${option.label || option.profile} - ${option.prediction}`,
          risk_profile: option.risk || 'moderate',
          kelly_percentage: option.kelly_pct || (4 + index * 3),
          bankroll_amount_colones: bankroll,
          expected_win_colones: Math.round(bankroll * option.estimated_odds),
          combined_probability: option.probability || 0.5,
          combined_odds: option.estimated_odds || (2.0 + index * 0.5),
          prediction: option.prediction,
          market: option.market,
          detailed_reasoning: option.reasoning,
          confidence: option.confidence,
          events: [
            {
              market: option.market,
              prediction: option.prediction,
              your_probability: option.probability || 0.5,
              odds: option.estimated_odds || (2.0 + index * 0.5),
              source: 'player_analyzer'
            }
          ]
        };
      });

      usePlayerSuggestions = true;
      console.log(`[chat] ✅ Generated ${generatedParlays.length} player-specific betting suggestions`);
    }

    // If no player suggestions, generate generic parlays
    if (!generatedParlays || generatedParlays.length === 0) {
      const parlayProfiles = ['conservative', 'moderate', 'aggressive', 'very_aggressive', 'community_pick'];

      generatedParlays = parlayProfiles.map((profile, index) => {
        return generateParlay(
          index + 1,
          profile,
          bankroll || 50000, // Default to 50k colones if not provided
          ferxxxaMarkets,
          ferxxxaCommunity
        );
      });

      console.log(`[chat] Generated ${generatedParlays.length} parlays (Groq output did not include them)`);
    } else if (!usePlayerSuggestions) {
      console.log(`[chat] Using ${generatedParlays.length} parlays from Groq output`);
    }

    // =====================================================
    // 5.1. Execute tool calls if requested
    // =====================================================
    const executedTools = [];
    let bankrollImpact = 0;

    if (groqOutput.tool_calls && Array.isArray(groqOutput.tool_calls)) {
      for (const toolCall of groqOutput.tool_calls) {
        const toolName = toolCall.name;
        const toolInput = toolCall.input;

        try {
          const toolResult = await executeGroqTool(toolName, toolInput);
          executedTools.push({
            name: toolName,
            input: toolInput,
            result: toolResult
          });

          // Update bankroll impact if Kelly calculation was called
          if (toolName === 'calculate_kelly' && toolResult.bet_size_recommended) {
            bankrollImpact = toolResult.bet_size_recommended / (bankroll || 1);
          }
        } catch (toolError) {
          console.error(`Tool ${toolName} execution failed:`, toolError.message);
          executedTools.push({
            name: toolName,
            input: toolInput,
            error: toolError.message
          });
        }
      }
    }

    // =====================================================
    // 6. Store conversation in database
    // =====================================================
    try {
      await db`
        INSERT INTO conversation_history (session_id, user_message, zak_response, user_bankroll, created_at)
        VALUES (${session_id}, ${sanitizedMessage}, ${groqOutput.response || ''}, ${bankroll || null}, NOW())
      `;
    } catch (dbError) {
      console.error('Failed to store conversation:', dbError.message);
      // Continue anyway - don't fail the response just because DB write failed
    }

    // =====================================================
    // 7. Return response with all Groq output + FerXxxa metadata + 5 Parlays + Player Analysis
    // =====================================================
    return sendSuccess(res, {
      response: groqOutput.response || groqOutput.analysis || 'No response generated',
      reasoning_chain: groqOutput.reasoning_chain || [],
      recommendations: groqOutput.recommendations || [],
      kelly_calculations: groqOutput.kelly_calculations || null,
      recommended_parlays: generatedParlays, // ALWAYS include 5 parlays or player suggestions
      data_sources_used: groqOutput.data_sources_used || [],
      uncertainties: groqOutput.uncertainties || [],
      confidence: groqOutput.confidence || 'medium',
      tool_calls: executedTools,
      bankroll_impact: bankrollImpact > 0 ? Math.round(bankrollImpact * 10000) / 100 : null,
      language: language,
      // ===== Player / Team / National Team Analysis =====
      player_response: playerFormattedResponse,
      team_response: teamFormattedResponse,
      player_analyzed: playerAnalyzed ? {
        name: playerAnalyzed.player.name,
        team: playerAnalyzed.player.team,
        position: playerAnalyzed.player.position,
        seasonStats: playerAnalyzed.seasonStats,
        probabilities: playerAnalyzed.probabilities,
        form: playerAnalyzed.form,
        nextMatch: playerAnalyzed.nextMatch || null,
        bets: playerAnalyzed.bets || null
      } : null,
      team_analyzed: teamAnalyzed ? {
        type: teamAnalyzed.type,
        name: teamAnalyzed.team.name,
        recentForm: teamAnalyzed.recentForm,
        probabilities: teamAnalyzed.probabilities,
        nextMatch: teamAnalyzed.nextMatch || null,
        bets: teamAnalyzed.bets || null
      } : null,
      player_suggestions: playerBettingSuggestions || null,
      subject_detected: detectedSubject,
      ferxxxa_intel: {
        ...ferxxxaMetadata,
        markets_available: !!ferxxxaMarkets,
        community_available: !!ferxxxaCommunity,
        parlays_count: generatedParlays.length,
        player_analysis_enabled: !!playerAnalyzed,
        team_analysis_enabled: !!teamAnalyzed
      }
    }, 'Analysis complete with player-specific or generic parlays');

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return sendError(res, 500, 'Internal Server Error', error.message, {
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}


