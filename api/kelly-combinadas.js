// ============================================================
//  Kelly Criterion for Parlays (Apuestas Combinadas)
//  Validates and calculates optimal bet sizing for multi-event bets
//  Accounts for event correlations and implements safety caps
// ============================================================

/**
 * Calculate Kelly Criterion percentage for a parlay (combined bet)
 * @param {Array} events - Array of event objects with {market, prediction, probability, odds, correlation}
 * @param {Object} correlationMatrix - Historical correlation data between markets
 * @param {Number} bankroll - User bankroll in colones (₡)
 * @returns {Object} Kelly calculation results with bet sizing and risk metrics
 */
export function calculateKellyForParlay(events, correlationMatrix = {}, bankroll) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      error: 'Invalid events array',
      kelly_percentage: 0,
      bet_amount_colones: 0,
      warnings: ['No events provided']
    };
  }

  // Step 1: Calculate combined probability
  let combinedProbability = 1;
  for (const event of events) {
    combinedProbability *= event.probability || 0.5;
  }

  // Step 2: Calculate average correlation
  let avgCorrelation = 0;
  if (events.length > 1) {
    let correlationSum = 0;
    let correlationCount = 0;

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const corr = events[i].correlation_with_others || 0;
        correlationSum += Math.abs(corr);
        correlationCount++;
      }
    }

    if (correlationCount > 0) {
      avgCorrelation = correlationSum / correlationCount;
    }
  }

  // Step 3: Apply correlation adjustment
  const correlationFactor = 1 + (avgCorrelation * 0.15);
  const adjustedProbability = Math.min(combinedProbability * correlationFactor, 0.95);

  // Step 4: Calculate combined odds
  let combinedOdds = 1;
  for (const event of events) {
    combinedOdds *= event.odds || 1.5;
  }

  // Step 5: Calculate edge
  const edge = (adjustedProbability * combinedOdds) - 1;

  // Step 6: Apply Kelly Formula
  let kellyFraction = 0;
  if (edge > 0) {
    kellyFraction = edge / (combinedOdds - 1);
  }

  // Step 7: Apply safety adjustments
  let kellyAdjustmentFactor = 1.0;
  const warnings = [];

  // Reduce Kelly for 3+ events (correlation uncertainty)
  if (events.length >= 3) {
    kellyAdjustmentFactor *= 0.75;
    warnings.push(`3+ events: reducing Kelly to 75% due to correlation uncertainty`);
  }

  // Reduce Kelly if high correlation (>0.7)
  if (avgCorrelation > 0.7) {
    kellyAdjustmentFactor *= 0.65;
    warnings.push(`High correlation (${avgCorrelation.toFixed(2)}): reducing Kelly to 65% for safety`);
  }

  // Apply fractional Kelly for parlay safety (always multiply by 0.75)
  kellyAdjustmentFactor *= 0.75;

  let adjustedKellyFraction = kellyFraction * kellyAdjustmentFactor;

  // Hard cap at 15% for parlays (vs 25% for single bets)
  if (adjustedKellyFraction > 0.15) {
    adjustedKellyFraction = 0.15;
    warnings.push(`Kelly capped at 15% maximum for parlay safety`);
  }

  // Step 8: Calculate bet amount in colones
  let betAmount = adjustedKellyFraction * bankroll;

  // Minimum ₡1,000
  if (betAmount < 1000) {
    warnings.push(`Calculated bet (₡${Math.round(betAmount)}) below minimum ₡1,000`);
  }

  // Cap at ₡50,000
  if (betAmount > 50000) {
    betAmount = 50000;
    warnings.push(`Bet capped at ₡50,000 maximum`);
  }

  // Step 9: Calculate Risk of Ruin
  const riskOfRuin = calculateRiskOfRuin(adjustedProbability, betAmount, bankroll);

  if (riskOfRuin > 0.1) {
    warnings.push(`High Risk of Ruin (${(riskOfRuin * 100).toFixed(1)}%): consider reducing bet size`);
  }

  // Step 10: Validate edge
  if (edge <= 0) {
    warnings.push(`WARNING: Negative or zero edge (${(edge * 100).toFixed(1)}%) - this is not a good bet`);
  }

  return {
    kelly_percentage: adjustedKellyFraction * 100,
    kelly_percentage_decimal: adjustedKellyFraction,
    bet_amount_colones: Math.round(betAmount),
    edge: edge,
    edge_percentage: edge * 100,
    combined_probability: adjustedProbability,
    combined_odds: combinedOdds.toFixed(2),
    risk_of_ruin: riskOfRuin,
    risk_of_ruin_percentage: (riskOfRuin * 100).toFixed(1),
    warnings: warnings,
    metadata: {
      events_count: events.length,
      avg_correlation: avgCorrelation.toFixed(2),
      correlation_factor: correlationFactor.toFixed(2),
      kelly_adjustment_factor: kellyAdjustmentFactor.toFixed(3),
      is_positive_edge: edge > 0
    }
  };
}

/**
 * Calculate Risk of Ruin probability
 * @param {Number} probability - Combined win probability
 * @param {Number} betAmount - Bet amount in ₡
 * @param {Number} bankroll - Total bankroll in ₡
 * @returns {Number} Risk of ruin as decimal (0-1)
 */
function calculateRiskOfRuin(probability, betAmount, bankroll) {
  if (bankroll <= 0 || probability <= 0 || probability >= 1) {
    return 0;
  }

  const winAmount = betAmount;
  const loseAmount = betAmount;

  // Simplified RoR formula for parlays
  const q = 1 - probability; // loss probability
  const p = probability;

  if (q === 0) return 0;
  if (p === 0) return 1;

  // Using approximate formula: RoR ≈ (q/p)^(bankroll/betAmount)
  const exponent = bankroll / Math.max(betAmount, 1);
  const ratio = q / p;

  // Protect against very small probabilities
  if (ratio > 1) {
    return Math.pow(ratio, Math.min(exponent, 100));
  } else {
    return 0;
  }
}

/**
 * Validate a parlay for mutual exclusivity and logical consistency
 * @param {Array} events - Array of event objects
 * @param {Object} marketData - Market availability data
 * @returns {Object} Validation result with isValid flag and warnings
 */
export function validateParlay(events, marketData = {}) {
  const warnings = [];
  const invalidCombinations = [
    ['home_win', 'away_win'],
    ['home_win', 'draw'],
    ['away_win', 'draw'],
    ['over_2.5', 'under_2.5'],
    ['over_3.5', 'under_3.5'],
    ['btts_yes', 'home_win_to_nil'],
    ['btts_yes', 'away_win_to_nil']
  ];

  // Check for mutually exclusive events
  const eventPairs = events.map(e => e.prediction).filter(Boolean);

  for (const [invalid1, invalid2] of invalidCombinations) {
    if (eventPairs.includes(invalid1) && eventPairs.includes(invalid2)) {
      return {
        isValid: false,
        warnings: [`Mutually exclusive events: cannot bet both "${invalid1}" and "${invalid2}"`],
        similarCommunityParlay: null
      };
    }
  }

  // Check for duplicate events
  const eventMarkets = events.map(e => e.market);
  const duplicateMarket = eventMarkets.find((market, index) => eventMarkets.indexOf(market) !== index);

  if (duplicateMarket) {
    warnings.push(`Duplicate market: "${duplicateMarket}" appears multiple times in parlay`);
  }

  // Check probability bounds
  for (const event of events) {
    if (event.probability < 0 || event.probability > 1) {
      warnings.push(`Invalid probability for ${event.market}: ${event.probability}`);
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings: warnings,
    similarCommunityParlay: null // Would be populated from FerXxxa data
  };
}

/**
 * Detect correlations between events based on historical data
 * @param {Array} events - Array of event objects
 * @param {Object} historicalData - Historical match data
 * @returns {Object} Correlation analysis
 */
export function detectCorrelations(events, historicalData = {}) {
  const correlations = {};

  for (const event of events) {
    correlations[`${event.market}_${event.prediction}`] = {
      correlates_with: [],
      strength: [],
      interpretation: ''
    };
  }

  // Simplified correlation detection
  // In production, would use historical match data to calculate Pearson correlation
  const commonCorrelations = {
    'home_win': {
      'over_2.5_goals': 0.65,
      'btts_yes': 0.52,
      'corners_gt_9': 0.45
    },
    'over_2.5_goals': {
      'btts_yes': 0.72,
      'corners_gt_9': 0.58,
      'yellow_cards_gt_5': 0.41
    },
    'btts_yes': {
      'over_2.5_goals': 0.72,
      'corners_gt_9': 0.49
    }
  };

  for (const event of events) {
    const key = event.market;
    if (commonCorrelations[key]) {
      correlations[`${event.market}_${event.prediction}`] = {
        correlates_with: Object.keys(commonCorrelations[key]),
        strength: Object.values(commonCorrelations[key]),
        interpretation: `"${key}" is correlated with attacking/defensive metrics`
      };
    }
  }

  return correlations;
}

/**
 * Build optimal parlay based on primary prediction and risk profile
 * @param {Number} probability - Primary event probability (e.g., home win 65%)
 * @param {Number} odds - Primary event odds (e.g., 1.75)
 * @param {Array} availableMarkets - Available markets: ["1x2", "over_under", "btts", "corners", "cards"]
 * @param {String} riskProfile - "conservative" | "moderate" | "aggressive"
 * @returns {Object} Recommended parlay with events
 */
export function buildOptimalParlay(probability, odds, availableMarkets = [], riskProfile = 'moderate') {
  const recommendations = {
    conservative: [
      {
        market: 'over_under',
        prediction: 'under_2.5',
        probability: 0.45,
        odds: 1.95,
        rationale: 'Negative correlation with primary pick for equilibrium'
      }
    ],
    moderate: [
      {
        market: 'btts',
        prediction: 'yes',
        probability: 0.58,
        odds: 1.92,
        rationale: 'Neutral correlation, both teams likely to score'
      }
    ],
    aggressive: [
      {
        market: 'over_under',
        prediction: 'over_2.5',
        probability: 0.60,
        odds: 1.85,
        rationale: 'Positive correlation with primary win prediction'
      },
      {
        market: 'btts',
        prediction: 'yes',
        probability: 0.58,
        odds: 1.92,
        rationale: 'Attacking game implies both teams score'
      }
    ]
  };

  const complementaryEvents = recommendations[riskProfile] || recommendations.moderate;
  const expectedOdds = odds * complementaryEvents.reduce((acc, e) => acc * e.odds, 1);
  const expectedProbability = probability * complementaryEvents.reduce((acc, e) => acc * e.probability, 1);

  return {
    recommended_events: complementaryEvents,
    risk_profile: riskProfile,
    reasoning: `Building ${riskProfile} parlay with complementary markets`,
    expected_kelly_percentage: Math.min((expectedProbability * expectedOdds - 1) * 7.5, 15), // rough estimate
    expected_odds: expectedOdds.toFixed(2),
    expected_probability: expectedProbability.toFixed(3)
  };
}

/**
 * Run test suite for kelly-combinadas
 * @returns {Array} Test results
 */
export function runTests() {
  const results = [];

  // Test 1: Simple 2-event parlay with negative correlation
  const test1 = calculateKellyForParlay(
    [
      { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75, correlation_with_others: 0 },
      { market: 'over_under', prediction: 'under_2.5', probability: 0.45, odds: 1.95, correlation_with_others: -0.15 }
    ],
    {},
    50000
  );
  results.push({
    test_name: 'Simple Kelly (2 events, negative correlation)',
    passed: test1.kelly_percentage > 0 && test1.kelly_percentage <= 15,
    kelly_percentage: test1.kelly_percentage.toFixed(1),
    expected_range: '3-5%',
    warnings: test1.warnings
  });

  // Test 2: 3-event parlay (should apply 75% reduction)
  const test2 = calculateKellyForParlay(
    [
      { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75, correlation_with_others: 0.65 },
      { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85, correlation_with_others: 0.65 },
      { market: 'btts', prediction: 'yes', probability: 0.58, odds: 1.92, correlation_with_others: 0.65 }
    ],
    {},
    50000
  );
  results.push({
    test_name: '3-event parlay (high correlation)',
    passed: test2.kelly_percentage < 10,
    kelly_percentage: test2.kelly_percentage.toFixed(1),
    expected_range: '5-8% (reduced from ~20%)',
    warnings: test2.warnings
  });

  // Test 3: Mutually exclusive events validation
  const test3 = validateParlay(
    [
      { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
      { market: '1x2', prediction: 'away_win', probability: 0.25, odds: 3.5 }
    ]
  );
  results.push({
    test_name: 'Validate mutually exclusive events',
    passed: !test3.isValid,
    isValid: test3.isValid,
    warnings: test3.warnings,
    expected: 'Should fail validation'
  });

  // Test 4: High correlation warning
  const test4 = calculateKellyForParlay(
    [
      { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75, correlation_with_others: 0.85 },
      { market: 'btts', prediction: 'yes', probability: 0.58, odds: 1.92, correlation_with_others: 0.85 }
    ],
    {},
    50000
  );
  results.push({
    test_name: 'High correlation warning (0.85)',
    passed: test4.warnings.some(w => w.includes('High correlation')),
    kelly_percentage: test4.kelly_percentage.toFixed(1),
    warnings: test4.warnings,
    expected: 'Should warn about high correlation'
  });

  // Test 5: Negative edge detection
  const test5 = calculateKellyForParlay(
    [
      { market: '1x2', prediction: 'home_win', probability: 0.35, odds: 1.75, correlation_with_others: 0 },
      { market: 'btts', prediction: 'yes', probability: 0.30, odds: 1.92, correlation_with_others: 0 }
    ],
    {},
    50000
  );
  results.push({
    test_name: 'Negative edge detection',
    passed: test5.edge < 0 && test5.warnings.some(w => w.includes('Negative')),
    edge: test5.edge.toFixed(3),
    warnings: test5.warnings,
    expected: 'Should detect negative edge'
  });

  // Test 6: Bet amount capping at ₡50k
  const test6 = calculateKellyForParlay(
    [
      { market: '1x2', prediction: 'home_win', probability: 0.95, odds: 1.10, correlation_with_others: 0 },
      { market: 'btts', prediction: 'yes', probability: 0.90, odds: 1.20, correlation_with_others: 0 }
    ],
    {},
    500000  // Very high bankroll
  );
  results.push({
    test_name: 'Bet amount cap at ₡50,000',
    passed: test6.bet_amount_colones <= 50000,
    bet_amount: `₡${test6.bet_amount_colones.toLocaleString()}`,
    expected: 'Should cap at ₡50,000',
    warnings: test6.warnings
  });

  return results;
}

/**
 * Get formatted test results
 * @returns {String} Formatted test report
 */
export function getTestResults() {
  const results = runTests();
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  let report = `\n📊 KELLY COMBINADAS TEST REPORT\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `Status: ${passCount}/${totalCount} tests PASSING\n\n`;

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    report += `${status} - ${result.test_name}\n`;
    report += `  Details: ${JSON.stringify(result).substring(0, 100)}\n\n`;
  }

  return report;
}
