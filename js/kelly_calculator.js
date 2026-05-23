// ============================================================
//  Kelly Criterion Calculator - Risk Management
//  Calculates optimal bet sizing based on probability and odds
// ============================================================

/**
 * Calculate full Kelly percentage
 * Formula: kelly_pct = (prob * odds - 1) / (odds - 1)
 *
 * @param {number} probability - Win probability (0-1)
 * @param {number} odds - Decimal odds
 * @returns {number} Kelly percentage as decimal (0.25 = 25%)
 */
export function calculateKellyOptimal(probability, odds) {
  if (probability <= 0 || probability >= 1) {
    throw new Error('Probability must be between 0 and 1');
  }
  if (odds <= 1) {
    throw new Error('Odds must be greater than 1');
  }

  const numerator = probability * odds - 1;
  const denominator = odds - 1;

  return numerator / denominator;
}

/**
 * Calculate fractional Kelly (safer than full Kelly)
 *
 * @param {number} probability - Win probability
 * @param {number} odds - Decimal odds
 * @param {number} fraction - Fraction of full Kelly (0.5 for half Kelly, 0.25 for quarter Kelly)
 * @returns {number} Fractional Kelly percentage
 */
export function calculateKellyFractional(probability, odds, fraction = 0.5) {
  const fullKelly = calculateKellyOptimal(probability, odds);
  return Math.max(0, fullKelly * fraction); // Never go negative
}

/**
 * Calculate bet size based on Kelly
 *
 * @param {number} bankroll - Total bankroll
 * @param {number} probability - Win probability
 * @param {number} odds - Decimal odds
 * @param {number} fraction - Kelly fraction (0.5 = half Kelly, default)
 * @returns {number} Recommended bet size
 */
export function calculateBetSize(bankroll, probability, odds, fraction = 0.5) {
  const kellyPct = calculateKellyFractional(probability, odds, fraction);
  return bankroll * kellyPct;
}

/**
 * Calculate expected value of a bet
 * EV = (probability * odds - 1) * stake
 *
 * @param {number} probability - Win probability
 * @param {number} odds - Decimal odds
 * @param {number} stake - Bet size
 * @returns {number} Expected value
 */
export function calculateExpectedValue(probability, odds, stake) {
  return (probability * odds - 1) * stake;
}

/**
 * Calculate edge (compare model probability to implied odds probability)
 * edge = (model_prob / odds_prob) - 1
 *
 * @param {number} modelProbability - Your probability estimate
 * @param {number} odds - Bookmaker odds
 * @returns {number} Edge as decimal (0.05 = +5% edge)
 */
export function calculateEdge(modelProbability, odds) {
  const impliedProbability = 1 / odds;
  return (modelProbability / impliedProbability) - 1;
}

/**
 * Calculate risk of ruin - probability of losing entire bankroll
 * Uses simplified gambler's ruin formula
 *
 * @param {number} bankroll - Starting bankroll
 * @param {number} betSize - Individual bet size
 * @param {number} winProbability - Win probability per bet
 * @param {number} targetRuin - Target ruin threshold (0.05 = 5%)
 * @returns {number} Risk of ruin probability (0-1)
 */
export function calculateRiskOfRuin(bankroll, betSize, winProbability, targetRuin = 0.05) {
  if (betSize >= bankroll) return 1.0; // Guaranteed ruin if bet >= bankroll

  const p = winProbability;
  const q = 1 - winProbability;
  const b = betSize / bankroll;

  // If game is fair (p ≈ q), use simplified formula
  if (Math.abs(p - q) < 0.01) {
    const numerator = -2 * (bankroll / betSize - 1) * (p - 0.5);
    return Math.pow(2, numerator / (bankroll / betSize));
  }

  // Use geometric series for biased games
  const ratio = q / p;
  const logRatio = Math.log(ratio);
  const logBankroll = Math.log(1 / b);

  if (Math.abs(logRatio) < 0.001) return targetRuin;

  const rorIndex = (logBankroll * logRatio) / (Math.log(ratio) - 1);
  return Math.pow(ratio, rorIndex);
}

/**
 * Evaluate if a bet is good based on multiple criteria
 *
 * @param {Object} betParams - { probability, odds, bankroll, stake, winRate }
 * @returns {Object} Evaluation result
 */
export function evaluateBet(betParams) {
  const { probability, odds, bankroll, stake, winRate = 0.5 } = betParams;

  // Calculate all metrics
  const edge = calculateEdge(probability, odds);
  const expectedValue = calculateExpectedValue(probability, odds, stake);
  const riskOfRuin = calculateRiskOfRuin(bankroll, stake, probability);
  const kellyFractional = calculateKellyFractional(probability, odds, 0.5);
  const recommendedStake = bankroll * kellyFractional;
  const stakePercentage = (stake / bankroll) * 100;

  // Generate warnings
  const warnings = [];
  const recommendations = [];

  if (edge <= 0) {
    warnings.push('❌ No edge detected - expected loss');
  } else if (edge < 0.015) {
    warnings.push('⚠️ Very small edge (< 1.5%) - high variance');
  }

  if (stake > recommendedStake * 1.5) {
    warnings.push(`❌ Stake is ${Math.round((stake / recommendedStake - 1) * 100)}% above Kelly - too risky`);
  }

  if (riskOfRuin > 0.05) {
    warnings.push(`⚠️ Risk of ruin: ${Math.round(riskOfRuin * 100)}% - consider smaller stake`);
  }

  if (stakePercentage > 10) {
    warnings.push(`⚠️ Stake is ${stakePercentage.toFixed(1)}% of bankroll - consider 5% max`);
  }

  if (edge >= 0.06) {
    recommendations.push('✅ Strong edge (6%+) - good bet');
  }

  if (edge >= 0.03) {
    recommendations.push('✅ Good edge (3-6%) - decent bet');
  }

  if (expectedValue > stake * 0.1) {
    recommendations.push(`✅ Positive EV: €${expectedValue.toFixed(2)} expected value`);
  }

  if (riskOfRuin < 0.01) {
    recommendations.push('✅ Very low ruin risk - comfortable stake');
  }

  // Confidence level
  let confidence = 'BAJA';
  if (edge > 0.05 && riskOfRuin < 0.05 && winRate >= 0.52) {
    confidence = 'ALTA';
  } else if (edge > 0.02 && riskOfRuin < 0.1) {
    confidence = 'MEDIA';
  }

  return {
    edge_pct: Math.round(edge * 10000) / 100,
    expected_value: Math.round(expectedValue * 100) / 100,
    risk_of_ruin_pct: Math.round(riskOfRuin * 10000) / 100,
    kelly_recommended_pct: Math.round(kellyFractional * 10000) / 100,
    stake_percentage: Math.round(stakePercentage * 100) / 100,
    recommended_stake: Math.round(recommendedStake * 100) / 100,
    confidence,
    warnings,
    recommendations,
    is_recommended: warnings.length === 0 && recommendations.length > 0
  };
}

/**
 * Calculate combined Kelly for multiple correlated bets
 * Simplified: reduces individual Kelly by correlation factor
 *
 * @param {Array} bets - Array of { probability, odds, stake }
 * @param {number} correlation - Correlation between bets (0-1, default 0.5)
 * @returns {Object} Combined Kelly analysis
 */
export function calculateCombinedKelly(bets, correlation = 0.5) {
  if (bets.length === 0) return { error: 'No bets provided' };
  if (bets.length === 1) {
    const bet = bets[0];
    return {
      kelly_pct: Math.round(calculateKellyOptimal(bet.probability, bet.odds) * 10000) / 100,
      total_stake: bet.stake,
      num_bets: 1,
      correlation_factor: 1
    };
  }

  // For multiple bets, apply correlation reduction factor
  const avgKelly = bets.reduce((sum, bet) => {
    try {
      return sum + calculateKellyOptimal(bet.probability, bet.odds);
    } catch {
      return sum;
    }
  }, 0) / bets.length;

  // Reduce Kelly by correlation factor
  const correlationFactor = 1 - (correlation * (bets.length - 1) / bets.length);
  const adjustedKelly = avgKelly * correlationFactor;

  return {
    individual_kelly_avg: Math.round(avgKelly * 10000) / 100,
    correlation_factor: Math.round(correlationFactor * 10000) / 100,
    combined_kelly_pct: Math.round(adjustedKelly * 10000) / 100,
    total_stake: bets.reduce((sum, b) => sum + (b.stake || 0), 0),
    num_bets: bets.length,
    warning: 'Combined Kelly is simplified estimate for correlated bets'
  };
}

export default {
  calculateKellyOptimal,
  calculateKellyFractional,
  calculateBetSize,
  calculateExpectedValue,
  calculateEdge,
  calculateRiskOfRuin,
  evaluateBet,
  calculateCombinedKelly
};
