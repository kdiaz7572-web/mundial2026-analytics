/**
 * ============================================================
 * Kelly Criterion v2 - Real-time Odds Validation
 * ============================================================
 * Calculates optimal bet sizing using real DoradoBet odds.
 * Detects arbitrage opportunities, validates edge calculations.
 * Used by api/chat.js for parlay recommendations in colones.
 */

/**
 * Calculate Kelly Criterion percentage
 * Formula: kelly_% = (edge × probability) / odds
 * where edge = (probability × odds) - 1
 */
function calculateKelly(probability, odds) {
  if (!probability || !odds || odds <= 1) return 0;
  const edge = (probability * odds) - 1;
  if (edge <= 0) return 0;
  return Math.min(0.5, Math.max(0, (edge * probability) / odds));
}

/**
 * Calculate Kelly-based bet size in colones
 * Applies fractional Kelly (0.75x) for safety
 */
function calculateBetSize(probability, odds, bankroll, riskTolerance = 'moderate') {
  const kelly = calculateKelly(probability, odds);
  
  // Risk tolerance adjustments
  const fractionMap = {
    conservative: 0.25,  // 25% of Kelly
    moderate: 0.5,       // 50% of Kelly (standard)
    aggressive: 0.75,    // 75% of Kelly
    very_aggressive: 1.0 // Full Kelly
  };

  const fraction = fractionMap[riskTolerance] || 0.5;
  const kellyFinal = kelly * fraction * 0.75; // 0.75x safety multiplier

  // Cap at 25% of bankroll absolute max
  const maxBetSize = bankroll * 0.25;
  const betSize = Math.min(maxBetSize, Math.round(bankroll * kellyFinal));

  return {
    kelly_percentage: Math.round(kelly * 10000) / 100,
    kelly_fraction: fraction,
    kelly_final_percent: Math.round(kellyFinal * 10000) / 100,
    bet_size_colones: Math.max(0, betSize),
    edge_percent: Math.round((calculateKelly(probability, odds) * 100) * 100) / 100
  };
}

/**
 * Calculate Risk of Ruin
 * Simplified formula: ROR ≈ e^(-2 × kelly × bankroll / bet_size)
 */
function calculateRiskOfRuin(kelly, bankroll, betSize) {
  if (kelly <= 0 || betSize <= 0) return 0;
  
  // Simplified ROR for single bet
  const ror = Math.exp(-2 * Math.max(0.001, kelly) * (bankroll / betSize));
  return Math.min(100, Math.round(ror * 10000) / 100);
}

/**
 * Validate parlay using real odds
 * Returns warnings for high Kelly, negative edge, etc.
 */
function validateParlay(events, realOdds, combinedProbability) {
  const warnings = [];
  
  // Check combined odds
  let combinedOdds = 1;
  for (const event of events) {
    combinedOdds *= event.odds;
  }

  // Calculate edge
  const edge = (combinedProbability * combinedOdds) - 1;
  const kelly = (edge * combinedProbability) / combinedOdds;

  if (edge < 0) {
    warnings.push('⚠️ Negative edge - this parlay has no mathematical value');
  }

  if (kelly > 0.25) {
    warnings.push('⚠️ Kelly > 25% - very high risk. Consider fractional Kelly instead.');
  }

  if (combinedOdds < 1.5) {
    warnings.push('⚠️ Combined odds < 1.5 - parlay is mostly guaranteed. Limited risk.');
  }

  if (combinedOdds > 20) {
    warnings.push('⚠️ Combined odds > 20 - very unlikely outcome. Only for edge plays.');
  }

  // Correlation warning
  if (events.length >= 4) {
    warnings.push('⚠️ 4+ events: correlations likely reduce actual probability below calculation.');
  }

  return {
    combined_odds: Math.round(combinedOdds * 100) / 100,
    combined_probability: Math.round(combinedProbability * 10000) / 10000,
    edge: Math.round(edge * 10000) / 100,
    kelly_percentage: Math.round(kelly * 10000) / 100,
    warnings: warnings,
    valid: warnings.length === 0
  };
}

/**
 * Detect arbitrage opportunity
 * Compare community consensus odds vs real DoradoBet odds
 */
function detectArbitrage(parleyName, communityOdds, realOdds, communityProbability) {
  if (!communityOdds || !realOdds) {
    return { has_opportunity: false };
  }

  const difference = Math.abs(realOdds - communityOdds) / Math.max(communityOdds, realOdds);

  if (difference < 0.03) {
    // Less than 3% difference = no opportunity
    return {
      has_opportunity: false,
      note: 'Real odds align with community consensus'
    };
  }

  // Calculate true edge vs perceived edge
  const trueEdge = (communityProbability * realOdds) - 1;
  const perceivedEdge = (communityProbability * communityOdds) - 1;

  return {
    has_opportunity: true,
    type: realOdds > communityOdds ? 'undervalue' : 'overvalue',
    community_odds: Math.round(communityOdds * 100) / 100,
    real_odds: Math.round(realOdds * 100) / 100,
    difference_percent: Math.round(difference * 10000) / 100,
    true_edge: Math.round(trueEdge * 10000) / 100,
    perceived_edge: Math.round(perceivedEdge * 10000) / 100,
    advantage_percent: Math.round((trueEdge - perceivedEdge) * 10000) / 100,
    recommendation: realOdds > communityOdds 
      ? `Real odds ${Math.round((difference * 100) * 10) / 10}% better than community consensus`
      : `Community is overvaluing by ${Math.round((difference * 100) * 10) / 10}%`,
    parlay_name: parleyName
  };
}

/**
 * Calculate combined Kelly for multiple correlated events
 * Adjustment factor based on correlation strength
 */
function calculateCombinedKelly(events, correlationMatrix) {
  // Start with individual Kellys
  let combinedKelly = 1;
  let adjustmentFactor = 1;

  for (const event of events) {
    const eventKelly = calculateKelly(event.probability, event.odds);
    combinedKelly *= (1 + eventKelly);
  }

  combinedKelly -= 1; // Remove initial +1

  // Apply correlation adjustments
  if (correlationMatrix) {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i].market;
        const e2 = events[j].market;
        
        if (correlationMatrix[e1] && correlationMatrix[e1][e2]) {
          const correlation = correlationMatrix[e1][e2];
          if (correlation > 0.7) {
            adjustmentFactor *= 0.65; // Strong correlation = reduce Kelly
          } else if (correlation < 0.3) {
            adjustmentFactor *= 0.85; // Anti-correlated = slight boost (diversification)
          }
        }
      }
    }
  }

  return Math.max(0, combinedKelly * adjustmentFactor);
}

/**
 * Main calculation function for parlays with real odds
 */
function calculateKellyWithRealOdds(events, bankroll, userSettings = {}) {
  const riskTolerance = userSettings.riskTolerance || 'moderate';
  const maxKelly = userSettings.maxKelly || 0.25;
  const correlationMatrix = userSettings.correlationMatrix || null;

  // Validate inputs
  if (!Array.isArray(events) || events.length < 1) {
    return { error: 'No events provided' };
  }

  if (!bankroll || bankroll < 5000) {
    return { error: 'Bankroll must be at least ₡5,000' };
  }

  // Calculate combined probability and odds
  let combinedProbability = 1;
  let combinedOdds = 1;

  for (const event of events) {
    combinedProbability *= event.probability;
    combinedOdds *= event.odds;
  }

  // Calculate Kelly Criterion
  const kelly = calculateKelly(combinedProbability, combinedOdds);
  const kellyFinal = Math.min(maxKelly, kelly * 0.75); // Apply max and safety
  const betSize = Math.round(bankroll * kellyFinal);

  // Calculate expected outcome
  const expectedWin = betSize * (combinedOdds - 1);
  const riskOfRuin = calculateRiskOfRuin(kellyFinal, bankroll, betSize);

  // Validate parlay
  const validation = validateParlay(events, combinedOdds, combinedProbability);

  return {
    kelly_percentage: Math.round(kellyFinal * 10000) / 100,
    kelly_fraction: kellyFinal,
    bankroll_amount_colones: betSize,
    expected_win_colones: Math.round(expectedWin),
    max_loss_colones: betSize,
    risk_of_ruin_percent: riskOfRuin,
    adjustment_factors: {
      risk_tolerance: riskTolerance,
      max_kelly: maxKelly,
      safety_multiplier: 0.75,
      correlation_adjustment: correlationMatrix ? 'applied' : 'none'
    },
    combined_odds: Math.round(combinedOdds * 100) / 100,
    combined_probability: Math.round(combinedProbability * 10000) / 10000,
    edge_calculation: validation.edge,
    warnings: validation.warnings,
    confidence: validation.valid ? 'high' : 'low'
  };
}

// Export functions
export {
  calculateKelly,
  calculateBetSize,
  calculateRiskOfRuin,
  validateParlay,
  detectArbitrage,
  calculateCombinedKelly,
  calculateKellyWithRealOdds
};

// For direct Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateKelly,
    calculateBetSize,
    calculateRiskOfRuin,
    validateParlay,
    detectArbitrage,
    calculateCombinedKelly,
    calculateKellyWithRealOdds
  };
}
