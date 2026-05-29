/**
 * Kelly Criterion Calculator
 * Cálculo de bankroll óptimo para apuestas
 */

export function calculateKellyOptimal(winProbability, decimalOdds) {
  if (winProbability <= 0 || winProbability >= 1) return 0;
  if (decimalOdds <= 1) return 0;
  const b = decimalOdds - 1;
  const p = winProbability;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  return Math.max(0, Math.min(1, kelly));
}

export function calculateKellyFractional(winProbability, decimalOdds, fraction = 0.5) {
  const optimalKelly = calculateKellyOptimal(winProbability, decimalOdds);
  return optimalKelly * fraction;
}

export function calculateBetSize(winProbability, decimalOdds, totalBankroll, fraction = 0.5) {
  const kellyFraction = calculateKellyFractional(winProbability, decimalOdds, fraction);
  const betSize = totalBankroll * kellyFraction;
  return {
    kelly_optimal_percentage: (calculateKellyOptimal(winProbability, decimalOdds) * 100).toFixed(2),
    kelly_fractional_percentage: (kellyFraction * 100).toFixed(2),
    bet_size_colones: Math.round(betSize),
    fraction_used: fraction
  };
}

export function calculateEdge(winProbability, decimalOdds) {
  if (winProbability <= 0 || decimalOdds <= 1) return 0;
  const edge = (winProbability * decimalOdds) - 1;
  return Math.max(0, edge) * 100;
}

export function calculateRiskOfRuin(winRate, kellyFraction, sampleSize = 100) {
  if (winRate <= 0 || winRate >= 1) return 100;
  const lossRate = 1 - winRate;
  const oddsAgainst = lossRate / winRate;
  const baseRoR = Math.pow(oddsAgainst, kellyFraction * sampleSize);
  return Math.min(100, baseRoR * 100);
}
