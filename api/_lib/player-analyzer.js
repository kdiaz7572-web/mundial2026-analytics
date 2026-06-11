/**
 * ============================================================
 * Player Analyzer - Análisis inteligente de jugadores
 * ============================================================
 * Extrae stats reales del jugador y calcula las mejores
 * apuestas basadas en su rendimiento actual.
 *
 * Retorna siempre:
 *  - player: info básica
 *  - seasonStats: estadísticas de la temporada
 *  - probabilities: probabilidades calculadas
 *  - form: consistencia y nivel de riesgo
 *  - nextMatch: próximo partido del equipo
 *  - bets: 3 apuestas completas (conservative, moderate, aggressive)
 */

// fetch is globally available in Node.js 18+
const API_BASE = 'https://api.api-football.com/v3';

// ============================================================
// HELPERS: Cálculos de probabilidad
// ============================================================

function calculateGoalProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.2;
  const goalsPerGame = stats.goals / stats.appearances;
  return Math.min(0.8, Math.max(0.1, goalsPerGame));
}

function calculateAssistProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.15;
  const assistsPerGame = stats.assists / stats.appearances;
  return Math.min(0.6, Math.max(0.05, assistsPerGame));
}

function calculateCardProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.15;
  const cardsPerGame = (stats.yellowCards + stats.redCards * 2) / stats.appearances;
  return Math.min(0.5, Math.max(0.05, cardsPerGame));
}

function calculateShotProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.3;
  const shotsPerGame = stats.shotsOn / stats.appearances;
  return Math.min(0.9, Math.max(0.1, shotsPerGame));
}

function calculateConsistency(stats) {
  const appearances = stats.appearances || 0;
  if (appearances < 5) return 'low';
  if (appearances < 15) return 'medium';
  return 'high';
}

function calculateRiskLevel(stats) {
  const fouls = stats.fouls || 0;
  const cards = stats.yellowCards + stats.redCards;
  const riskScore = (fouls * 0.3 + cards * 0.7) / (stats.appearances || 1);
  if (riskScore > 0.5) return 'high';
  if (riskScore > 0.2) return 'medium';
  return 'low';
}

function generateRecommendation(stats, goalProb) {
  if (goalProb > 0.5) return 'Muy buena opción para Any Goal Scorer - forma excelente';
  if (goalProb > 0.3) return 'Buena opción pero moderada - considerar con cautela';
  return 'Probabilidad baja - mejor como parte de un parlay';
}

// ============================================================
// Kelly Criterion helpers
// ============================================================

function calcKelly(prob, odds, fraction = 1.0) {
  if (prob <= 0 || odds <= 1) return 0;
  const b = odds - 1;
  const kelly = (b * prob - (1 - prob)) / b;
  return Math.max(0, Math.min(0.25, kelly * fraction));
}

function confidenceStars(prob) {
  if (prob >= 0.65) return '⭐⭐⭐⭐⭐';
  if (prob >= 0.50) return '⭐⭐⭐⭐';
  if (prob >= 0.35) return '⭐⭐⭐';
  if (prob >= 0.20) return '⭐⭐';
  return '⭐';
}

function toOdds(prob) {
  return Math.round((1 / Math.max(0.02, prob)) * 100) / 100;
}

// ============================================================
// findNextMatch — busca próximo partido del equipo
// ============================================================

async function findNextMatch(teamId, apiKey) {
  try {
    const res = await fetch(
      `${API_BASE}/fixtures?team=${teamId}&next=1&status=NS`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.response || data.response.length === 0) return null;

    const fixture = data.response[0];
    const home = fixture.teams.home;
    const away = fixture.teams.away;

    return {
      fixture_id: fixture.fixture.id,
      date: fixture.fixture.date,
      home_team: home.name,
      away_team: away.name,
      league: fixture.league.name,
      is_home: home.id === teamId,
      opponent_team: home.id === teamId ? away.name : home.name
    };
  } catch (err) {
    console.warn('[player-analyzer] findNextMatch error:', err.message);
    return null;
  }
}

// ============================================================
// generateThreeBets — genera 3 apuestas completas para el jugador
// ============================================================

function generateThreeBets(playerName, probabilities, seasonStats, nextMatch) {
  const { goal: goalProb, assist: assistProb, card: cardProb, shot: shotProb } = probabilities;

  // ---------- CONSERVADORA ----------
  // Mejor mercado único según probabilidad más alta
  let consMarket, consPrediction, consProb, consReasoning;
  if (goalProb >= 0.30) {
    consMarket = 'Any Goal Scorer';
    consPrediction = `${playerName} anota al menos 1 gol`;
    consProb = goalProb;
    consReasoning = `Anota en ~${Math.round(goalProb * 100)}% de sus apariciones (${seasonStats.goals} goles en ${seasonStats.appearances} partidos). Mercado más seguro.`;
  } else if (shotProb >= 0.40) {
    consMarket = 'Tiro a Puerta';
    consPrediction = `${playerName} realiza 1+ tiros a puerta`;
    consProb = shotProb;
    consReasoning = `Registra tiros a puerta en ~${Math.round(shotProb * 100)}% de sus partidos. Baja varianza.`;
  } else {
    consMarket = 'Anota Gol o Asiste';
    consPrediction = `${playerName} participa en un gol`;
    consProb = Math.min(0.85, goalProb + assistProb - goalProb * assistProb);
    consReasoning = `Participación ofensiva (gol O asistencia) con mayor cobertura del rendimiento esperado.`;
  }
  const consOdds = toOdds(consProb);
  const consKellyRaw = calcKelly(consProb, consOdds, 0.5);
  const consKellyPct = Math.round(consKellyRaw * 1000) / 10;

  // ---------- MODERADA ----------
  // Combina 2 mercados: Goal OR Assist (unión de probabilidades)
  const modProb = Math.min(0.88, goalProb + assistProb - goalProb * assistProb);
  const modOdds = toOdds(modProb);
  const modKellyRaw = calcKelly(modProb, modOdds, 0.5);
  const modKellyPct = Math.round(modKellyRaw * 1000) / 10;

  // ---------- AGRESIVA ----------
  // Parlay: Gol + Tiro + (si aplica) Asistencia
  const aggrProb = Math.max(0.02, goalProb * shotProb * Math.max(0.3, assistProb));
  const aggrOdds = toOdds(aggrProb);
  const aggrKellyRaw = calcKelly(aggrProb, aggrOdds, 0.25);
  const aggrKellyPct = Math.round(aggrKellyRaw * 1000) / 10;

  const matchCtx = nextMatch
    ? ` en el partido ${nextMatch.home_team} vs ${nextMatch.away_team} (${nextMatch.is_home ? 'local' : 'visitante'})`
    : '';

  return {
    conservative: {
      label: '🟢 Conservadora',
      market: consMarket,
      prediction: consPrediction,
      probability: Math.round(consProb * 10000) / 10000,
      probability_pct: `${Math.round(consProb * 100)}%`,
      estimated_odds: consOdds,
      kelly_pct: consKellyPct,
      confidence: confidenceStars(consProb),
      reasoning: consReasoning + matchCtx,
      risk: 'bajo'
    },
    moderate: {
      label: '🟡 Moderada',
      market: 'Anota Gol O Asiste',
      prediction: `${playerName} Anota O Asiste`,
      probability: Math.round(modProb * 10000) / 10000,
      probability_pct: `${Math.round(modProb * 100)}%`,
      estimated_odds: modOdds,
      kelly_pct: modKellyPct,
      confidence: confidenceStars(modProb),
      reasoning: `Cubre participación ofensiva completa (gol + asistencia). Más cobertura que apostar solo a gol.${matchCtx}`,
      risk: 'medio'
    },
    aggressive: {
      label: '🔴 Agresiva',
      market: 'Parlay: Gol + Tiro + Asistencia',
      prediction: `${playerName} Anota + 1+ Tiro a Puerta + Asiste`,
      probability: Math.round(aggrProb * 10000) / 10000,
      probability_pct: `${Math.round(aggrProb * 100)}%`,
      estimated_odds: aggrOdds,
      kelly_pct: aggrKellyPct,
      confidence: confidenceStars(aggrProb),
      reasoning: `Parlay de 3 mercados. Alto retorno pero baja probabilidad combinada. Solo para tolerancia de riesgo alta.${matchCtx}`,
      risk: 'alto'
    }
  };
}

// ============================================================
// analyzePlayer — función principal
// ============================================================

async function analyzePlayer(playerName, matchId = null) {
  try {
    const apiKey = process.env.FOOTBALL_API_KEY;
    if (!apiKey) {
      console.warn('[player-analyzer] FOOTBALL_API_KEY not configured');
      return generatePlayerFallback(playerName);
    }

    // 1. Buscar jugador
    const playerSearch = await fetch(
      `${API_BASE}/players?search=${encodeURIComponent(playerName)}&season=2024`,
      { headers: { 'x-apisports-key': apiKey } }
    );

    if (!playerSearch.ok) {
      console.warn('[player-analyzer] Player search failed:', playerSearch.status);
      return generatePlayerFallback(playerName);
    }

    const playerData = await playerSearch.json();
    if (!playerData.response || playerData.response.length === 0) {
      console.warn('[player-analyzer] No player found for:', playerName);
      return generatePlayerFallback(playerName);
    }

    const player = playerData.response[0];
    const playerId = player.player.id;
    const playerInfo = player.player;
    const teamInfo = player.statistics[0]?.team || {};
    const stats = player.statistics[0] || {};
    const rawStats = stats.statistics || stats;

    const teamId = teamInfo.id;

    const seasonStats = {
      goals: rawStats.goals?.total || 0,
      assists: rawStats.goals?.assists || 0,
      shots: rawStats.shots?.total || 0,
      shotsOn: rawStats.shots?.on || 0,
      passes: rawStats.passes?.total || 0,
      passAccuracy: rawStats.passes?.accuracy || 0,
      dribbles: rawStats.dribbles?.attempts || 0,
      dribbleSuccess: rawStats.dribbles?.success || 0,
      fouls: rawStats.fouls?.committed || 0,
      yellowCards: rawStats.cards?.yellow || 0,
      redCards: rawStats.cards?.red || 0,
      tackles: rawStats.tackles?.total || 0,
      interceptions: rawStats.interceptons?.total || 0,
      appearances: rawStats.games?.appearences || 0,
      minutes: rawStats.games?.minutes || 0
    };

    const probabilities = {
      goal: calculateGoalProbability(seasonStats),
      assist: calculateAssistProbability(seasonStats),
      card: calculateCardProbability(seasonStats),
      shot: calculateShotProbability(seasonStats)
    };

    // 2. Buscar próximo partido
    let nextMatch = null;
    if (teamId) {
      nextMatch = await findNextMatch(teamId, apiKey);
    }

    // 3. Generar 3 apuestas
    const bets = generateThreeBets(playerInfo.name || playerName, probabilities, seasonStats, nextMatch);

    return {
      success: true,
      player: {
        id: playerId,
        name: playerInfo.name || playerName,
        position: playerInfo.position,
        age: playerInfo.age,
        height: playerInfo.height,
        weight: playerInfo.weight,
        photo: playerInfo.photo,
        nationality: playerInfo.nationality,
        team: teamInfo.name,
        teamId
      },
      seasonStats,
      probabilities,
      form: {
        consistency: calculateConsistency(seasonStats),
        riskLevel: calculateRiskLevel(seasonStats),
        recommendation: generateRecommendation(seasonStats, probabilities.goal)
      },
      nextMatch,
      bets,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[player-analyzer] Error:', error.message);
    return generatePlayerFallback(playerName);
  }
}

// ============================================================
// generatePlayerFallback — datos de ejemplo cuando la API falla
// ============================================================

function generatePlayerFallback(playerName) {
  const fallbackStats = {
    goals: 8, assists: 5, shots: 28, shotsOn: 10,
    passes: 480, passAccuracy: 0.82, dribbles: 18,
    dribbleSuccess: 0.62, fouls: 10, yellowCards: 2,
    redCards: 0, tackles: 3, interceptions: 2,
    appearances: 20, minutes: 1600
  };

  const probabilities = {
    goal: calculateGoalProbability(fallbackStats),
    assist: calculateAssistProbability(fallbackStats),
    card: calculateCardProbability(fallbackStats),
    shot: calculateShotProbability(fallbackStats)
  };

  const bets = generateThreeBets(playerName, probabilities, fallbackStats, null);

  return {
    success: false,
    player: {
      name: playerName,
      team: 'Datos no disponibles — configura FOOTBALL_API_KEY',
      position: 'FW',
      nationality: '—',
      teamId: null
    },
    note: 'FOOTBALL_API_KEY no configurada. Mostrando análisis con datos estimados.',
    seasonStats: fallbackStats,
    probabilities,
    form: {
      consistency: 'medium',
      riskLevel: 'medium',
      recommendation: generateRecommendation(fallbackStats, probabilities.goal)
    },
    nextMatch: null,
    bets,
    timestamp: new Date().toISOString()
  };
}

export { analyzePlayer, generateThreeBets, findNextMatch };
