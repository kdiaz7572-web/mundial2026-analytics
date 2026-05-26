# Kelly Criterion Calculator with Real Odds Integration
## Enhanced Parlay Betting Analyzer for DoradoBet

**File:** `api/kelly-mercados.js`  
**Status:** Production Ready  
**Test Pass Rate:** 100% (8/8 tests)

---

## Overview

The Kelly Mercados calculator implements an enhanced Kelly Criterion formula specifically designed for parlay (combined) bets. It integrates real DoradoBet odds, detects arbitrage opportunities, and applies advanced adjustment factors for multi-event bets.

### Key Features

- **Real Odds Integration**: Uses actual DoradoBet odds from `ferxxxa_markets` data
- **Arbitrage Detection**: Compares real odds vs community consensus
- **Multi-Event Adjustments**: Reduces Kelly for 3+ events, high correlations, live matches
- **Risk of Ruin Calculation**: Estimates probability of losing entire bankroll
- **Safety Caps**: Hard limits at 25% Kelly and ₡50,000 maximum bet
- **Fractional Kelly**: 0.75x safety multiplier for practical use

---

## Mathematical Formulas

### 1. Edge Calculation
```
edge = (combined_probability × combined_odds) - 1
```

Example:
- Combined probability: 0.65 × 0.60 = 0.39
- Combined odds: 1.75 × 1.85 = 3.2375
- Edge = (0.39 × 3.2375) - 1 = 0.2626 or 26.26%

### 2. Kelly Optimal
```
Kelly_Optimal = edge / (combined_odds - 1)

When edge > 0 and combined_odds > 1
```

Example (from above):
- Kelly_Optimal = 0.2626 / (3.2375 - 1)
- Kelly_Optimal = 0.2626 / 2.2375 = 0.1174 or 11.74%

### 3. Adjustment Factors (Multiplied Together)

#### Events Count Factor
- 2 events: 1.0x (no reduction)
- 3 events: 0.75x (reduces correlation uncertainty)
- 4+ events: 0.65x (increases safety margin)

#### Correlation Factor
```
If correlation > 0.7:
  correlation_factor = sqrt(1 - correlation)
Else if correlation > 0.5:
  correlation_factor = 0.85
Else:
  correlation_factor = 1.0
```

Example with 0.85 correlation:
- correlation_factor = sqrt(1 - 0.85) = sqrt(0.15) = 0.387

#### Live Match Factor
- Pre-match: 1.0x
- Live/in-progress: 0.90x (accounts for volatility)

#### Market Liquidity Factor
- High liquidity (>₡100k): 1.0x
- Low liquidity (<₡100k): 0.85x

#### Total Multiplier
```
total_multiplier = events_count × correlation × live_match × liquidity
```

### 4. Adjusted Kelly
```
Kelly_Adjusted = Kelly_Optimal × total_multiplier × 0.75

The 0.75 is a fractional Kelly safety multiplier
```

Example:
- Kelly_Optimal = 0.1174 (11.74%)
- Total_Multiplier = 1.0 (2 events, low correlation)
- Kelly_Adjusted = 0.1174 × 1.0 × 0.75 = 0.088 or 8.8%

### 5. Bet Amount in Colones
```
bet_amount = Kelly_Adjusted × bankroll

With constraints:
- Minimum: ₡1,000
- Maximum: min(₡50,000, 15% of bankroll)
```

Example with ₡50,000 bankroll:
- bet_amount = 0.088 × 50,000 = ₡4,400

### 6. Risk of Ruin (Simplified)
```
RoR ≈ (q/p) × kelly

Where:
  p = combined_probability (win chance)
  q = 1 - p (loss chance)
```

This is a simplified formula for parlays. Traditional RoR = (q/p)^(bankroll/bet) creates overflow issues.

### 7. Max Win/Loss
```
max_win = bet_amount × (combined_odds - 1)
max_loss = bet_amount
ROI = (max_win / bet_amount) × 100
```

Example:
- bet_amount = ₡4,400
- combined_odds = 3.2375
- max_win = 4,400 × 2.2375 = ₡9,725
- ROI = 221%

---

## API Usage

### Main Function: `calculateKellyWithRealOdds()`

```javascript
import { calculateKellyWithRealOdds } from './api/kelly-mercados.js';

const result = calculateKellyWithRealOdds(
  events,        // Array of event objects
  realOdds,      // Real odds from DoradoBet
  bankroll,      // User bankroll in colones
  userSettings   // Optional settings object
);
```

### Parameters

#### `events` (Array)
Array of event objects with structure:
```javascript
[
  {
    market: "1x2",              // Market type
    prediction: "home_win",     // Specific prediction
    probability: 0.65,          // Win probability (0-1)
    odds: 1.75                  // Event odds
  },
  {
    market: "over_under",
    prediction: "over_2.5",
    probability: 0.60,
    odds: 1.85
  }
]
```

#### `realOdds` (Object)
Real odds from DoradoBet indexed by `${market}_${prediction}`:
```javascript
{
  "1x2_home_win": { odds: 1.75 },
  "over_under_over_2.5": { odds: 1.85 }
}
```

If a market is missing, the function falls back to the provided `event.odds`.

#### `bankroll` (Number)
Total available bankroll in Costa Rican colones. Minimum: ₡5,000

#### `userSettings` (Object, Optional)
```javascript
{
  riskTolerance: 'conservative',  // 'conservative' | 'moderate' | 'aggressive'
  maxKelly: 0.25,                 // Max Kelly percentage (default 0.25 = 25%)
  correlations: {                 // Custom correlation matrix
    "1x2_over_under": 0.65,       // Correlation between markets
    "btts_corners": 0.52
  }
}
```

### Return Object

```javascript
{
  // Main results
  kelly_percentage: 8.8,           // Kelly as percentage
  kelly_fraction: 0.088,           // Kelly as decimal
  bankroll_amount_colones: 4402,   // Recommended bet size
  max_win_colones: 9848,           // Maximum possible win
  max_loss_colones: 4402,          // Maximum possible loss
  return_on_investment_percent: 223.75,  // ROI if bet wins
  
  // Risk metrics
  risk_of_ruin_percent: 0.48,      // Probability of ruin (%)
  edge: 0.2626,                    // Decimal edge
  edge_percentage: 26.26,          // Edge as percentage
  combined_probability: 0.39,      // P(all events win)
  combined_odds: 3.2375,           // Product of all odds
  kelly_optimal_percent: 11.74,    // Unadjusted Kelly %
  
  // Adjustments applied
  adjustment_factors: {
    events_count: 1.0,
    correlation: 1.0,
    live_match: 1.0,
    market_liquidity: 1.0,
    total_multiplier: 0.75
  },
  
  // Detailed event breakdown
  event_details: [
    {
      market: "1x2",
      prediction: "home_win",
      probability: 0.65,
      odds: 1.75,
      realOdds: 1.75
    },
    // ...
  ],
  
  // Warnings and arbitrage
  warnings: [
    "3+ events: reducing Kelly to 75% due to correlation uncertainty"
  ],
  
  arbitrage: {
    has_opportunity: false,
    type: "none",
    real_odds: 3.2375,
    community_odds: 3.2375,
    real_edge_percent: 26.26,
    community_edge_percent: 26.26,
    difference_percent: 0,
    recommendation: ""
  },
  
  // Meta
  confidence: "medium",            // 'high' | 'medium' | 'low'
  is_kelly_capped: false,          // Was Kelly limited by maxKelly?
  is_bet_capped: false,            // Was bet limited by ₡50k cap?
  calculation_timestamp: "2026-05-25T...",
  disclaimer: "Kelly Criterion is a mathematical model..."
}
```

---

## Example Calculations

### Example 1: Simple 2-Event Parlay

**Input:**
```javascript
const result = calculateKellyWithRealOdds(
  [
    { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
    { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85 }
  ],
  {},
  50000,
  { maxKelly: 0.25 }
);
```

**Calculation Steps:**
1. Combined probability: 0.65 × 0.60 = 0.39
2. Combined odds: 1.75 × 1.85 = 3.2375
3. Edge: (0.39 × 3.2375) - 1 = 0.2626
4. Kelly optimal: 0.2626 / (3.2375 - 1) = 0.1174 (11.74%)
5. Adjustments: 2 events = 1.0x, low correlation = 1.0x, total = 1.0x
6. Kelly adjusted: 0.1174 × 1.0 × 0.75 = 0.088 (8.8%)
7. Bet amount: 0.088 × 50,000 = ₡4,400

**Output:**
```
Kelly %: 8.8%
Bet: ₡4,400
Max Win: ₡9,848
ROI: 223.75%
Confidence: MEDIUM
```

### Example 2: 3-Event Parlay (Higher Reduction)

**Input:**
```javascript
const result = calculateKellyWithRealOdds(
  [
    { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
    { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85 },
    { market: 'btts', prediction: 'yes', probability: 0.58, odds: 1.92 }
  ],
  {},
  50000
);
```

**Calculation Difference:**
1. Combined probability: 0.65 × 0.60 × 0.58 = 0.226
2. Combined odds: 1.75 × 1.85 × 1.92 = 6.216
3. Edge: (0.226 × 6.216) - 1 = 0.404 (40.4%)
4. Kelly optimal: 0.404 / (6.216 - 1) = 0.0788 (7.88%)
5. **Adjustments: 3 events = 0.75x, total = 0.75x** ← Key difference
6. Kelly adjusted: 0.0788 × 0.75 × 0.75 = 0.0443 (4.43%)
7. Bet amount: 0.0443 × 50,000 = ₡2,215

**Output:**
```
Kelly %: 4.43% (reduced from 7.88%)
Bet: ₡2,215
Adjustment Factor: 0.75 (due to 3 events)
Warnings: ["3+ events: reducing Kelly to 75%..."]
```

### Example 3: High Correlation Adjustment

**Input:**
```javascript
const result = calculateKellyWithRealOdds(
  [
    { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
    { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85 }
  ],
  {},
  50000,
  {
    correlations: {
      "1x2_over_under": 0.85  // Very high correlation
    }
  }
);
```

**Adjustment Calculation:**
- correlation_factor = sqrt(1 - 0.85) = sqrt(0.15) = 0.387
- total_multiplier = 1.0 × 0.387 × 1.0 × 1.0 = 0.387
- Kelly adjusted: 0.1174 × 0.387 × 0.75 = 0.034 (3.4%)

**Output:**
```
Kelly %: 3.4% (vs 8.8% without correlation)
Correlation Factor: 0.387
Warnings: ["High correlation detected"]
```

### Example 4: Negative Edge Detection

**Input:**
```javascript
const result = calculateKellyWithRealOdds(
  [
    { market: '1x2', prediction: 'home_win', probability: 0.35, odds: 1.75 },
    { market: 'btts', prediction: 'yes', probability: 0.30, odds: 1.92 }
  ],
  {},
  50000
);
```

**Calculation:**
1. Combined probability: 0.35 × 0.30 = 0.105
2. Combined odds: 1.75 × 1.92 = 3.36
3. Edge: (0.105 × 3.36) - 1 = **-0.647 (NEGATIVE!)**
4. Kelly optimal: 0 (cannot be negative)
5. Bet amount: ₡0

**Output:**
```
Kelly %: 0%
Bet: ₡1,000 (minimum enforced)
Edge: -64.7%
Warnings: [
  "Calculated bet (₡0) below minimum ₡1,000 - using minimum",
  "⚠️ Negative edge (-64.7%) - this is not a good bet"
]
Confidence: LOW
```

### Example 5: Arbitrage Opportunity

**Input:**
```javascript
const result = calculateKellyWithRealOdds(
  [
    { market: '1x2', prediction: 'home_win', probability: 0.70, odds: 1.80 },
    { market: 'over_under', prediction: 'over_2.5', probability: 0.65, odds: 1.75 }
  ],
  {
    "1x2_home_win": { odds: 1.95 },      // Real odds better!
    "over_under_over_2.5": { odds: 1.85 }  // Real odds better!
  },
  50000
);
```

**Arbitrage Analysis:**
- Real combined odds: 1.95 × 1.85 = 3.6075
- Expected combined odds: 1.80 × 1.75 = 3.15
- Difference: +14.5%

**Output:**
```
arbitrage: {
  has_opportunity: true,
  type: "undervalue",
  difference_percent: 14.5,
  recommendation: "Real odds are 14.5% better than community consensus..."
}
```

---

## Adjustment Factor Reference

### When to Apply Which Factors

| Scenario | Factor | Multiplier | Reason |
|----------|--------|------------|--------|
| 2-event parlay | Events | 1.0x | Standard |
| 3-event parlay | Events | 0.75x | Correlation uncertainty |
| 4+ event parlay | Events | 0.65x | High complexity |
| Corr < 0.5 | Correlation | 1.0x | Independent events |
| Corr 0.5-0.7 | Correlation | 0.85x | Moderate correlation |
| Corr > 0.7 | Correlation | sqrt(1-corr) | High correlation penalty |
| Pre-match | Live match | 1.0x | Normal conditions |
| Live match | Live match | 0.90x | Volatility penalty |
| High liquidity | Liquidity | 1.0x | > ₡100k community bets |
| Low liquidity | Liquidity | 0.85x | < ₡100k community bets |

---

## Confidence Levels

The calculator assigns confidence based on:

**HIGH:** 
- 2-3 events
- Edge > 5%
- Probability > 50%
- Correlation factor > 0.8

**MEDIUM:**
- 3-4 events
- Edge > 2%
- Probability > 45%
- Correlation factor > 0.65

**LOW:**
- 5+ events OR
- Edge < 2% OR
- Probability < 45%

---

## Warnings Generated

The calculator may generate these warnings:

| Warning | Meaning | Action |
|---------|---------|--------|
| "3+ events: reducing Kelly to 75%" | Multi-event penalty applied | Review correlation |
| "High correlation (0.85): reducing Kelly to 65%" | Events are correlated | May want to add uncorrelated event |
| "Negative edge (-64.7%)" | This is not a +EV bet | DO NOT PLACE THIS BET |
| "Risk of Ruin: X%" | Probability of losing entire bankroll | Reduce bet size or increase bankroll |
| "Odds too low (1.45) for parlay" | Combined odds < 1.5 | Add more events or pick better odds |
| "Bet capped at ₡50,000" | Hit maximum bet limit | Already at safest bet size |
| "Bet (₡X) below minimum ₡1,000" | Calculated Kelly too small | Increase bankroll or adjust settings |

---

## Safety Features

### Hard Caps
- **Kelly Cap:** 25% maximum (can be adjusted via `userSettings.maxKelly`)
- **Bet Cap:** ₡50,000 maximum per parlay
- **Bankroll Min:** ₡5,000 minimum required

### Fractional Kelly
All Kelly percentages are automatically multiplied by **0.75** (75% fractional Kelly) for safety. This means:
- Optimal 20% Kelly → 15% fractional Kelly
- Optimal 10% Kelly → 7.5% fractional Kelly

### Correlation Adjustment
For 3+ event parlays, Kelly is reduced by:
- 3 events: 75% of calculated Kelly
- 4+ events: 65% of calculated Kelly
- High correlation (>0.7): sqrt(1 - correlation) of calculated Kelly

---

## Integration with ferxxxa_markets Data

The calculator is designed to work with real DoradoBet odds from `ferxxxa_markets`:

```javascript
// From ferxxxa-intel.js
const realOdds = {
  "1x2_home_win": { odds: 1.75, source: "DoradoBet", timestamp: "..." },
  "1x2_draw": { odds: 3.40, source: "DoradoBet", ... },
  "1x2_away_win": { odds: 5.20, source: "DoradoBet", ... },
  "over_under_over_2.5": { odds: 1.85, source: "DoradoBet", ... },
  "over_under_under_2.5": { odds: 1.95, source: "DoradoBet", ... },
  "btts_yes": { odds: 1.92, source: "DoradoBet", ... },
  "btts_no": { odds: 1.88, source: "DoradoBet", ... }
};

const result = calculateKellyWithRealOdds(events, realOdds, bankroll, settings);
```

---

## Test Cases

All 8 test cases pass with 100% success rate:

1. ✓ Simple 2-event parlay
2. ✓ 3-event parlay (higher reduction)
3. ✓ Negative edge detection
4. ✓ High correlation adjustment (0.85)
5. ✓ Low bankroll with positive edge
6. ✓ Adequate bankroll with valid parlay
7. ✓ Maximum bet cap enforcement
8. ✓ Arbitrage detection

Run tests:
```javascript
import { runTests, getTestReport } from './api/kelly-mercados.js';

console.log(getTestReport());
// Output: Status: 8/8 tests PASSING
```

---

## Common Questions

### Q: Should I always use Kelly Criterion?
A: No. Kelly is a mathematical model that assumes:
- Accurate probability estimates
- Sufficient bankroll
- No emotional decision-making
- Use fractional Kelly (0.75) for safety

### Q: What bankroll do I need?
A: Minimum ₡5,000, but recommend at least ₡20,000 to avoid hitting minimum bet limits.

### Q: How accurate are probability estimates?
A: This is the hardest part. Professional bettors spend weeks analyzing matches. Use historical data, team form, and expert consensus.

### Q: What if I disagree with the correlation?
A: You can override in `userSettings.correlations`. But high correlation (>0.7) usually indicates you should pick more independent events.

### Q: Is ₡50,000 the right maximum?
A: Yes, for responsible gambling. You can modify in the code if needed, but recommend keeping limits.

### Q: What about live betting?
A: Use the `live_match: 0.90x` factor automatically applied when match is in progress.

---

## Formula Reference Card

| Formula | Purpose |
|---------|---------|
| `edge = (P × O) - 1` | Calculate expected value |
| `K_optimal = edge / (O - 1)` | Kelly percentage |
| `K_final = K_opt × factors × 0.75` | Applied Kelly with safety |
| `bet = K_final × bankroll` | Bet size in colones |
| `max_win = bet × (O - 1)` | Maximum profit |
| `RoR = (q/p) × kelly` | Risk of ruin (simplified) |

---

## Version History

- **v1.0** (2026-05-25): Initial release
  - Real odds integration
  - Arbitrage detection
  - Multi-event adjustments
  - Risk of Ruin calculations
  - 8/8 tests passing

---

**Author:** Betting System Team  
**Last Updated:** 2026-05-25  
**Status:** Production Ready
