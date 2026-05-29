/**
 * ============================================================
 * Player Analyzer - Análisis inteligente de jugadores
 * ============================================================
 * Extrae stats reales del jugador y calcula las mejores
 * apuestas basadas en su rendimiento actual
 */

import fetch from 'node-fetch';

/**
 * Buscar jugador en API-Football y obtener stats
 */
async function analyzePlayer(playerName, matchId = null) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      console.warn('[player-analyzer] API_FOOTBALL_KEY not configured');
      return generatePlayerFallback(playerName);
    }

    // Buscar jugador
    const playerSearch = await fetch(
      `https://api.api-football.com/v3/players?search=${encodeURIComponent(playerName)}`,
      { headers: { 'x-apisports-key': apiKey } }
    );

    if (!playerSearch.ok) {
      console.warn('[player-analyzer] Player search failed');
      return generatePlayerFallback(playerName);
    }

    const playerData = await playerSearch.json();
    if (!playerData.response || playerData.response.length === 0) {
      return generatePlayerFallback(playerName);
    }

    const player = playerData.response[0];
    const playerId = player.player.id;
    const playerInfo = player.player;
    const teamInfo = player.statistics[0]?.team || {};
    const stats = player.statistics[0]?.statistics || {};

    // Obtener stats de la temporada actual
    const seasonStats = {
      goals: stats.goals?.total || 0,
      assists: stats.goals?.assists || 0,
      shots: stats.shots?.total || 0,
      shotsOn: stats.shots?.on || 0,
      passes: stats.passes?.total || 0,
      passAccuracy: stats.passes?.accuracy || 0,
      dribbles: stats.dribbles?.attempts || 0,
      dribbleSuccess: stats.dribbles?.success || 0,
      fouls: stats.fouls?.committed || 0,
      yellowCards: stats.cards?.yellow || 0,
      redCards: stats.cards?.red || 0,
      tackles: stats.tackles?.total || 0,
      interceptions: stats.intercept || 0,
      appearances: stats.games?.appearences || 0,
      minutes: stats.games?.minutes || 0
    };

    // Calcular probabilidades basadas en stats
    const probabilityGoal = calculateGoalProbability(seasonStats);
    const probabilityAssist = calculateAssistProbability(seasonStats);
    const probabilityCard = calculateCardProbability(seasonStats);
    const probabilityShot = calculateShotProbability(seasonStats);

    return {
      success: true,
      player: {
        id: playerId,
        name: playerInfo.name,
        position: playerInfo.position,
        age: playerInfo.age,
        height: playerInfo.height,
        weight: playerInfo.weight,
        photo: playerInfo.photo,
        nationality: playerInfo.nationality,
        team: teamInfo.name
      },
      seasonStats,
      probabilities: {
        goal: probabilityGoal,
        assist: probabilityAssist,
        card: probabilityCard,
        shot: probabilityShot
      },
      form: {
        consistency: calculateConsistency(seasonStats),
        riskLevel: calculateRiskLevel(seasonStats),
        recommendation: generateRecommendation(seasonStats, probabilityGoal)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[player-analyzer] Error:', error.message);
    return generatePlayerFallback(playerName);
  }
}

/**
 * Calcular probabilidad de gol
 */
function calculateGoalProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.2;
  const goalsPerGame = stats.goals / stats.appearances;
  // Normalizar entre 0.1 y 0.8
  return Math.min(0.8, Math.max(0.1, goalsPerGame));
}

/**
 * Calcular probabilidad de asistencia
 */
function calculateAssistProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.15;
  const assistsPerGame = stats.assists / stats.appearances;
  return Math.min(0.6, Math.max(0.05, assistsPerGame));
}

/**
 * Calcular probabilidad de tarjeta
 */
function calculateCardProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.15;
  const cardsPerGame = (stats.yellowCards + stats.redCards * 2) / stats.appearances;
  return Math.min(0.5, Math.max(0.05, cardsPerGame));
}

/**
 * Calcular probabilidad de tiro a puerta
 */
function calculateShotProbability(stats) {
  if (!stats.appearances || stats.appearances === 0) return 0.3;
  const shotsPerGame = stats.shotsOn / stats.appearances;
  return Math.min(0.9, Math.max(0.1, shotsPerGame));
}

/**
 * Calcular consistencia del jugador
 */
function calculateConsistency(stats) {
  const appearances = stats.appearances || 0;
  if (appearances < 5) return 'low';
  if (appearances < 15) return 'medium';
  return 'high';
}

/**
 * Calcular nivel de riesgo
 */
function calculateRiskLevel(stats) {
  const fouls = stats.fouls || 0;
  const cards = stats.yellowCards + stats.redCards;
  const riskScore = (fouls * 0.3 + cards * 0.7) / (stats.appearances || 1);

  if (riskScore > 0.5) return 'high';
  if (riskScore > 0.2) return 'medium';
  return 'low';
}

/**
 * Generar recomendación
 */
function generateRecommendation(stats, goalProb) {
  if (goalProb > 0.5) {
    return 'Muy buena opción para Any Goal Scorer - forma excelente';
  }
  if (goalProb > 0.3) {
    return 'Buena opción pero riesgosa - considerar con cautela';
  }
  return 'Probabilidad baja - mejor esperar mejores oportunidades';
}

/**
 * Fallback si no hay datos de API
 */
function generatePlayerFallback(playerName) {
  return {
    success: false,
    player: { name: playerName, team: 'Unknown', position: 'FW' },
    note: 'Datos limitados - usando análisis general',
    seasonStats: {
      goals: 8,
      assists: 3,
      shots: 24,
      shotsOn: 8,
      passes: 450,
      passAccuracy: 0.82,
      dribbles: 15,
      dribbleSuccess: 0.60,
      fouls: 12,
      yellowCards: 2,
      redCards: 0,
      tackles: 4,
      interceptions: 2,
      appearances: 12,
      minutes: 850
    },
    probabilities: {
      goal: 0.35,
      assist: 0.20,
      card: 0.15,
      shot: 0.45
    },
    form: {
      consistency: 'unknown',
      riskLevel: 'medium',
      recommendation: 'Recomendado con cautela'
    }
  };
}

export { analyzePlayer };