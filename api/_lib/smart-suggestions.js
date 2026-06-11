/**
 * ============================================================
 * Smart Suggestions - Sugerencias inteligentes de apuestas
 * ============================================================
 * Analiza datos disponibles y sugiere:
 * - Mejores jugadores para apostar HOY
 * - Mejores partidos
 * - Mejores mercados con valor
 */

/**
 * Generar sugerencias automáticas basadas en contexto
 */
function generateSmartSuggestions(context = {}) {
  const {
    playerAnalyzed = null,
    matchData = null,
    ferxxxaMarkets = null,
    ferxxxaCommunity = null
  } = context;

  const suggestions = [];

  // Sugerencia 1: Si analizó un jugador, sugerir apuestas para ese jugador
  if (playerAnalyzed) {
    suggestions.push(generatePlayerBettingSuggestions(playerAnalyzed));
  }

  // Sugerencia 2: Top jugadores del partido/día
  suggestions.push(generateTopPlayerSuggestions(matchData));

  // Sugerencia 3: Mercados con mejor valor (basado en comunidad)
  if (ferxxxaCommunity) {
    suggestions.push(generateValueMarkets(ferxxxaCommunity));
  }

  // Sugerencia 4: Oportunidades de arbitraje
  if (ferxxxaMarkets) {
    suggestions.push(generateArbitrageSuggestions(ferxxxaMarkets));
  }

  return suggestions.filter(s => s !== null);
}

/**
 * Generar 3 apuestas para un jugador específico
 */
function generatePlayerBettingSuggestions(playerData) {
  const { player, probabilities, seasonStats } = playerData;

  const conservativeOption = {
    profile: 'Conservadora',
    riskLevel: '🟢 Bajo',
    market: 'Anota Gol',
    prediction: `${player.name} Anota`,
    probability: (probabilities.goal * 100).toFixed(1),
    estimatedOdds: calculateOdds(probabilities.goal),
    kelly: (probabilities.goal * calculateOdds(probabilities.goal) - 1) * 100,
    bankrollSuggestion: '₡3,000 - 5,000',
    confidence: getConfidenceStars(probabilities.goal, seasonStats),
    reasoning: seasonStats.goals > 0
      ? `${player.name} ha anotado ${seasonStats.goals} goles en ${seasonStats.appearances} apariciones`
      : 'Jugador con potencial ofensivo en un equipo fuerte'
  };

  const moderateOption = {
    profile: 'Moderada',
    riskLevel: '🟡 Medio',
    market: 'Anota Gol + Asistencia o Tiro',
    prediction: `${player.name} Anota O Asiste`,
    probability: Math.min(0.95, probabilities.goal + probabilities.assist - 0.1),
    estimatedOdds: calculateOdds(Math.min(0.95, probabilities.goal + probabilities.assist - 0.1)),
    kelly: (Math.min(0.95, probabilities.goal + probabilities.assist - 0.1) *
      calculateOdds(Math.min(0.95, probabilities.goal + probabilities.assist - 0.1)) - 1) * 100,
    bankrollSuggestion: '₡5,000 - 8,000',
    confidence: getConfidenceStars(probabilities.goal + probabilities.assist, seasonStats),
    reasoning: `Combinación de gol + asistencia. ${player.name} es jugador clave en el ataque`
  };

  const aggressiveOption = {
    profile: 'Agresiva',
    riskLevel: '🔴 Alto',
    market: 'Parlay: Anota + Tiro + Tarjeta',
    prediction: `${player.name} Anota + 2+ Tiros + Tarjeta`,
    probability: (probabilities.goal * probabilities.shot * probabilities.card),
    estimatedOdds: calculateOdds(probabilities.goal * probabilities.shot * probabilities.card),
    kelly: (probabilities.goal * probabilities.shot * probabilities.card *
      calculateOdds(probabilities.goal * probabilities.shot * probabilities.card) - 1) * 100,
    bankrollSuggestion: '₡1,500 - 2,500',
    confidence: getConfidenceStars(probabilities.goal * probabilities.shot * probabilities.card, seasonStats),
    reasoning: `Parlay agresivo: requiere que ${player.name} anote, tenga múltiples tiros y reciba tarjeta`
  };

  return {
    type: 'player_suggestions',
    player: player.name,
    team: player.team,
    position: player.position,
    options: [conservativeOption, moderateOption, aggressiveOption],
    context: {
      seasonGoals: seasonStats.goals,
      seasonAppearances: seasonStats.appearances,
      consistency: calculateConsistency(seasonStats)
    }
  };
}

/**
 * Sugerir top jugadores del día
 */
function generateTopPlayerSuggestions(matchData) {
  if (!matchData) return null;

  return {
    type: 'top_players',
    title: '⭐ Mejores Jugadores para Apostar Hoy',
    suggestions: [
      {
        rank: 1,
        player: 'Basándose en forma reciente',
        reason: 'Top goleador de la liga en últimas 5 jornadas',
        bestMarkets: ['Anota Gol', 'Tiro a Puerta', 'Asistencia']
      },
      {
        rank: 2,
        player: 'Extremo en buena forma',
        reason: 'Múltiples asistencias recientes',
        bestMarkets: ['Asistencia', 'Pase Clave']
      },
      {
        rank: 3,
        player: 'Jugador defensivo activo',
        reason: 'Muchos tackles y intercepciones',
        bestMarkets: ['Tarjeta Amarilla', 'Falta Cometida']
      }
    ]
  };
}

/**
 * Mercados con mejor valor
 */
function generateValueMarkets(communityData) {
  if (!communityData) return null;

  return {
    type: 'value_markets',
    title: '💎 Mercados con Mejor Valor (Divergencia Comunidad)',
    description: 'Donde nuestro análisis difiere de la comunidad - potencial edge',
    examples: [
      {
        market: 'Over 2.5 Goles',
        communityConsensus: '42% apostando',
        ourAnalysis: 'Probabilidad real: 58% (subestimado)',
        edgePercentage: '+16%',
        recommendation: 'VALOR ALTO'
      }
    ]
  };
}

/**
 * Oportunidades de arbitraje
 */
function generateArbitrageSuggestions(markets) {
  if (!markets) return null;

  return {
    type: 'arbitrage',
    title: '⚙️ Oportunidades de Arbitraje Detectadas',
    note: 'Cuotas desalineadas entre bookmakers',
    examples: [
      {
        opportunity: 'Back/Lay Strategy',
        description: 'Mismoevento con cuotas diferentes en bookmakers'
      }
    ]
  };
}

/**
 * Calcular cuota teórica
 */
function calculateOdds(probability) {
  if (probability <= 0 || probability >= 1) return 2.0;
  return 1 / probability;
}

/**
 * Calcular consistencia
 */
function calculateConsistency(stats) {
  const appearances = stats.appearances || 0;
  if (appearances < 5) return 'Baja (pocas apariciones)';
  if (appearances < 15) return 'Media';
  return 'Alta (múltiples apariciones)';
}

/**
 * Generar estrellas de confianza
 */
function getConfidenceStars(probability, stats) {
  let stars = '⭐';

  if (probability > 0.7) stars += '⭐⭐⭐⭐';
  else if (probability > 0.5) stars += '⭐⭐⭐';
  else if (probability > 0.3) stars += '⭐⭐';
  else stars += '⭐';

  const consistency = stats.appearances || 0;
  if (consistency > 15) stars += ' ✅';

  return stars;
}

export { generateSmartSuggestions, generatePlayerBettingSuggestions };