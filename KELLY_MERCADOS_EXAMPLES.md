# Kelly Mercados - Detailed Examples

Complete worked examples showing Kelly Criterion calculations for various parlay scenarios.

---

## Example 1: Basic 2-Event Parlay

**Scenario:** Simple parlay with high confidence prediction

### Input Data
```javascript
const events = [
  {
    market: '1x2',
    prediction: 'home_win',
    probability: 0.65,  // 65% chance
    odds: 1.75
  },
  {
    market: 'over_under',
    prediction: 'over_2.5',
    probability: 0.60,  // 60% chance
    odds: 1.85
  }
];

const realOdds = {
  '1x2_home_win': { odds: 1.75 },
  'over_under_over_2.5': { odds: 1.85 }
};

const bankroll = 50000;
const userSettings = { maxKelly: 0.25 };
```

### Step-by-Step Calculation

**Step 1: Combined Probability**
```
P_combined = 0.65 × 0.60 = 0.39
(39% chance both events hit)
```

**Step 2: Combined Odds**
```
O_combined = 1.75 × 1.85 = 3.2375
(If both hit, original bet multiplies by 3.2375)
```

**Step 3: Edge Calculation**
```
edge = (P_combined × O_combined) - 1
edge = (0.39 × 3.2375) - 1
edge = 1.2626 - 1
edge = 0.2626  (26.26% edge)
```

**Step 4: Kelly Optimal**
```
Kelly_optimal = edge / (O_combined - 1)
Kelly_optimal = 0.2626 / (3.2375 - 1)
Kelly_optimal = 0.2626 / 2.2375
Kelly_optimal = 0.1174  (11.74%)
```

**Step 5: Adjustment Factors**
- Events count: 2 events → 1.0x (no reduction)
- Correlation: Low → 1.0x (assuming independent)
- Live match: Pre-match → 1.0x
- Liquidity: High → 1.0x
- **Total multiplier: 1.0x**

**Step 6: Kelly Adjusted**
```
Kelly_adjusted = Kelly_optimal × total_multiplier × 0.75
Kelly_adjusted = 0.1174 × 1.0 × 0.75
Kelly_adjusted = 0.088  (8.8%)

(0.75 is the fractional Kelly safety multiplier)
```

**Step 7: Check Caps**
```
Kelly = 0.088 = 8.8%
User max = 0.25 = 25%
✓ Not capped (8.8% < 25%)
```

**Step 8: Bet Amount**
```
bet = Kelly_adjusted × bankroll
bet = 0.088 × 50,000
bet = ₡4,400
```

**Step 9: Check Betting Limits**
```
Min bet: ₡1,000 → ✓ OK (4,400 > 1,000)
Max bet: ₡50,000 → ✓ OK (4,400 < 50,000)
```

**Step 10: Calculate Win/Loss**
```
Max Win = bet × (O_combined - 1)
Max Win = 4,400 × (3.2375 - 1)
Max Win = 4,400 × 2.2375
Max Win = ₡9,845

Max Loss = bet = ₡4,400

ROI = (Max Win / bet) × 100 = 223.75%
```

**Step 11: Risk of Ruin**
```
RoR = (q/p) × kelly

Where:
p = probability = 0.39
q = 1 - p = 0.61

RoR = (0.61/0.39) × 0.088
RoR = 1.564 × 0.088
RoR = 0.0477  (4.77%)

Interpretation: ~4.8% chance of losing entire ₡50k bankroll
```

### Output
```javascript
{
  kelly_percentage: 8.8,
  kelly_fraction: 0.088,
  bankroll_amount_colones: 4402,
  max_win_colones: 9845,
  max_loss_colones: 4402,
  return_on_investment_percent: 223.75,
  risk_of_ruin_percent: 4.77,
  
  edge: 0.2626,
  edge_percentage: 26.26,
  combined_probability: 0.39,
  combined_odds: 3.2375,
  kelly_optimal_percent: 11.74,
  
  adjustment_factors: {
    events_count: 1.0,
    correlation: 1.0,
    live_match: 1.0,
    market_liquidity: 1.0,
    total_multiplier: 1.0
  },
  
  event_details: [
    {
      market: '1x2',
      prediction: 'home_win',
      probability: 0.65,
      odds: 1.75,
      realOdds: 1.75
    },
    {
      market: 'over_under',
      prediction: 'over_2.5',
      probability: 0.60,
      odds: 1.85,
      realOdds: 1.85
    }
  ],
  
  warnings: [],
  
  arbitrage: {
    has_opportunity: false,
    type: 'none',
    real_odds: 3.2375,
    community_odds: 3.2375,
    real_edge_percent: 26.26,
    community_edge_percent: 26.26,
    difference_percent: 0,
    recommendation: ''
  },
  
  confidence: 'medium',
  is_kelly_capped: false,
  is_bet_capped: false
}
```

### Interpretation
- **Recommendation:** MODERATE - Medium confidence
- **Bet sizing:** ₡4,400 is a reasonable 8.8% Kelly bet
- **Expected value:** 26.26% edge suggests positive EV
- **Risk level:** 4.77% risk of ruin is acceptable
- **Action:** Safe to place this parlay

---

## Example 2: 3-Event Parlay (Higher Reduction)

**Scenario:** Adding a third market creates correlation uncertainty

### Input Data
```javascript
const events = [
  { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
  { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85 },
  { market: 'btts', prediction: 'yes', probability: 0.58, odds: 1.92 }
];

const bankroll = 50000;
```

### Step-by-Step (Key Differences)

**Steps 1-4: Same as Example 1**
```
P_combined = 0.65 × 0.60 × 0.58 = 0.226
O_combined = 1.75 × 1.85 × 1.92 = 6.216
edge = (0.226 × 6.216) - 1 = 0.404
Kelly_optimal = 0.404 / (6.216 - 1) = 0.0788  (7.88%)
```

**Step 5: Adjustment Factors (DIFFERENT)**
```
Events count: 3 events → 0.75x  ← KEY REDUCTION
Correlation: Moderate → 1.0x
Live match: Pre-match → 1.0x
Liquidity: High → 1.0x

Total multiplier = 0.75 × 1.0 × 1.0 × 1.0 = 0.75
```

**Step 6: Kelly Adjusted**
```
Kelly_adjusted = 0.0788 × 0.75 × 0.75
Kelly_adjusted = 0.0443  (4.43%)

Compare to 2-event: 8.8% → 4.43%
REDUCTION: The 3rd event cut Kelly in half!
```

**Step 7-8: Bet Amount**
```
bet = 0.0443 × 50,000 = ₡2,215
```

### Key Difference
- 2-event parlay: ₡4,400 bet
- 3-event parlay: ₡2,215 bet (50% reduction)

**Why?** Adding a third event increases uncertainty about correlation. The 0.75x penalty reflects this.

### Output (Partial)
```javascript
{
  kelly_percentage: 4.43,
  bankroll_amount_colones: 2215,
  kelly_optimal_percent: 7.88,
  
  adjustment_factors: {
    events_count: 0.75,  // ← 3-event penalty
    correlation: 1.0,
    live_match: 1.0,
    market_liquidity: 1.0,
    total_multiplier: 0.75
  },
  
  warnings: [
    '3+ events: reducing Kelly to 75% due to correlation uncertainty'
  ]
}
```

---

## Example 3: High Correlation Penalty

**Scenario:** Two highly correlated markets (0.85 correlation)

### Input Data
```javascript
const events = [
  { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
  { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85 }
];

const userSettings = {
  correlations: {
    '1x2_over_under': 0.85  // Very high!
  }
};

const bankroll = 50000;
```

### Step-by-Step

**Steps 1-4: Same calculation**
```
P_combined = 0.39
O_combined = 3.2375
edge = 0.2626
Kelly_optimal = 0.1174  (11.74%)
```

**Step 5: Adjustment Factors**
```
Events count: 2 events → 1.0x

Correlation: 0.85 (HIGH!)
  → correlation_factor = sqrt(1 - 0.85)
  → correlation_factor = sqrt(0.15)
  → correlation_factor = 0.387

Live match: 1.0x
Liquidity: 1.0x

Total multiplier = 1.0 × 0.387 × 1.0 × 1.0 = 0.387
```

**Step 6: Kelly Adjusted**
```
Kelly_adjusted = 0.1174 × 0.387 × 0.75
Kelly_adjusted = 0.034  (3.4%)

Compare: Without correlation: 8.8%
         With correlation: 3.4%
REDUCTION: 61% reduction!
```

**Step 7-8: Bet Amount**
```
bet = 0.034 × 50,000 = ₡1,700
```

### Output (Partial)
```javascript
{
  kelly_percentage: 3.4,
  bankroll_amount_colones: 1700,
  kelly_optimal_percent: 11.74,
  
  adjustment_factors: {
    events_count: 1.0,
    correlation: 0.387,  // ← HIGH CORRELATION PENALTY
    live_match: 1.0,
    market_liquidity: 1.0,
    total_multiplier: 0.387
  },
  
  warnings: [
    'High correlation (0.85): reducing Kelly to 65% for safety'
  ]
}
```

### Interpretation
- **Why reduce?** When markets are 85% correlated, they're almost the same bet
- **Your actual risk:** Higher than if they were independent
- **Kelly formula:** Assumes independence, must adjust for correlation
- **Recommendation:** Either accept smaller bet, or find uncorrelated market

---

## Example 4: Arbitrage Opportunity

**Scenario:** Real DoradoBet odds are better than community consensus

### Input Data
```javascript
const events = [
  { market: '1x2', prediction: 'home_win', probability: 0.70, odds: 1.80 },
  { market: 'over_under', prediction: 'over_2.5', probability: 0.65, odds: 1.75 }
];

const realOdds = {
  '1x2_home_win': { odds: 1.95 },      // Real: 1.95
  'over_under_over_2.5': { odds: 1.85 }  // Real: 1.85
};

// Implied community odds: 1.80 and 1.75
```

### Calculations

**Real odds calculation:**
```
P_combined = 0.70 × 0.65 = 0.455
O_real = 1.95 × 1.85 = 3.6075
edge_real = (0.455 × 3.6075) - 1 = 0.641  (64.1% edge!)
```

**Community odds calculation (implied):**
```
P_combined = 0.70 × 0.65 = 0.455  (same)
O_community = 1.80 × 1.75 = 3.15
edge_community = (0.455 × 3.15) - 1 = 0.434  (43.4% edge)
```

**Arbitrage Detection:**
```
Difference = (0.641 - 0.434) / 0.434 × 100 = 47.7%

Is 47.7% > 5%? YES!
→ ARBITRAGE OPPORTUNITY DETECTED
```

### Output (Arbitrage Section)
```javascript
{
  arbitrage: {
    has_opportunity: true,
    type: "undervalue",
    real_odds: 3.6075,
    community_odds: 3.15,
    real_edge_percent: 64.1,
    community_edge_percent: 43.4,
    difference_percent: 47.7,
    recommendation: "Real odds are 47.7% better than community consensus - real edge is significantly higher"
  }
}
```

### Interpretation
- **What happened?** Community is undervaluing the parlay
- **Reason:** Perhaps bookmakers have insider info, or community estimates are outdated
- **Your advantage:** Betting at DoradoBet odds gives you 47.7% better edge
- **Action:** STRONGLY RECOMMENDED - place larger bet at these real odds

---

## Example 5: Negative Edge Warning

**Scenario:** Poor probability estimates lead to negative edge

### Input Data
```javascript
const events = [
  { market: '1x2', prediction: 'home_win', probability: 0.35, odds: 1.75 },
  { market: 'btts', prediction: 'yes', probability: 0.30, odds: 1.92 }
];

const bankroll = 50000;
```

### Calculations

**Combined metrics:**
```
P_combined = 0.35 × 0.30 = 0.105  (only 10.5% to win!)
O_combined = 1.75 × 1.92 = 3.36
edge = (0.105 × 3.36) - 1 = -0.647  (NEGATIVE!)
```

**Kelly calculation:**
```
Since edge ≤ 0, Kelly = 0
Bet amount = 0
```

### Output
```javascript
{
  kelly_percentage: 0,
  kelly_fraction: 0,
  bankroll_amount_colones: 1000,  // Minimum enforced
  
  edge: -0.647,
  edge_percentage: -64.7,
  
  warnings: [
    'Calculated bet (₡0) below minimum ₡1,000 - using minimum',
    '⚠️ Negative edge (-64.7%) - this is not a good bet'
  ]
}
```

### Interpretation
- **Recommendation:** DO NOT PLACE THIS BET
- **Why?** Your combined probability is too low for the odds
- **The math:** You need at least 29.8% combined probability for 1.75×1.92 odds to break even
- **You're providing:** Only 10.5% probability
- **Expected loss:** 64.7% of your bet on average

---

## Example 6: Small Bankroll Limitation

**Scenario:** Low bankroll forces minimum bet

### Input Data
```javascript
const events = [
  { market: '1x2', prediction: 'home_win', probability: 0.65, odds: 1.75 },
  { market: 'over_under', prediction: 'over_2.5', probability: 0.60, odds: 1.85 }
];

const bankroll = 5000;  // Minimum allowed
```

### Calculations

**Kelly calculation (same edge):**
```
Kelly_optimal = 0.1174  (11.74%)
Kelly_adjusted = 0.088  (8.8%)
Bet = 0.088 × 5000 = ₡440
```

**Minimum enforcement:**
```
Calculated bet: ₡440
Minimum bet: ₡1,000
→ Bet set to: ₡1,000  (override)
```

**Impact:**
```
Requested Kelly: 8.8%
Actual Kelly: 1000/5000 = 20%

You're betting DOUBLE the recommended Kelly!
```

### Output
```javascript
{
  kelly_percentage: 8.8,
  bankroll_amount_colones: 1000,  // NOT 440!
  
  warnings: [
    'Calculated bet (₡440) below minimum ₡1,000 - using minimum'
  ]
}
```

### Interpretation
- **Problem:** Small bankroll forces suboptimal bet sizing
- **Risk:** Using 20% Kelly instead of 8.8% increases volatility
- **Recommendation:** Increase bankroll to at least ₡20,000 to avoid minimum bet issues

---

## Example 7: Maximum Bet Cap

**Scenario:** High confidence leads to Kelly exceeding maximum

### Input Data
```javascript
const events = [
  { market: '1x2', prediction: 'home_win', probability: 0.95, odds: 1.10 },
  { market: 'btts', prediction: 'yes', probability: 0.90, odds: 1.20 }
];

const bankroll = 500000;  // Very large bankroll
```

### Calculations

**Very high edge:**
```
P_combined = 0.95 × 0.90 = 0.855
O_combined = 1.10 × 1.20 = 1.32
edge = (0.855 × 1.32) - 1 = 0.1266  (12.66%)
Kelly_optimal = 0.1266 / (1.32 - 1) = 0.395  (39.5%!)
```

**With 0.75 safety multiplier:**
```
Kelly_adjusted = 0.395 × 1.0 × 0.75 = 0.296  (29.6%)
```

**Applying user cap:**
```
User maxKelly: 0.25  (25%)
Kelly_adjusted > maxKelly?  29.6% > 25%?  YES!
→ Apply cap: Kelly = 0.25
```

**Applying bet cap:**
```
Bet = 0.25 × 500000 = ₡125,000
Maximum allowed: ₡50,000
→ Apply cap: Bet = ₡50,000
```

### Output
```javascript
{
  kelly_percentage: 25.0,  // Capped at maxKelly
  bankroll_amount_colones: 50000,  // Capped at maximum
  
  adjustment_factors: {
    total_multiplier: 0.75
  },
  
  warnings: [
    'Bet capped at ₡50,000 (max 15% of bankroll)'
  ],
  
  is_kelly_capped: true,
  is_bet_capped: true
}
```

### Interpretation
- **What happened?** Two layers of safety kicked in
- **Why?** Extremely high confidence (95% prob) led to aggressive Kelly
- **Protection:** System enforces maximum ₡50k bet regardless of bankroll size
- **Recommendation:** Even at ₡50k, this is a good bet with 95% win probability

---

## Summary Table: All Examples

| Example | Events | Probability | Odds | Kelly | Bet | Confidence | Action |
|---------|--------|-------------|------|-------|-----|------------|--------|
| 1 | 2 | 39% | 3.24 | 8.8% | ₡4,400 | Medium | PLACE BET |
| 2 | 3 | 22.6% | 6.22 | 4.4% | ₡2,215 | Low | CONSIDER |
| 3 | 2 (corr) | 39% | 3.24 | 3.4% | ₡1,700 | Low | CAUTION |
| 4 | 2 (arb) | 45.5% | 3.61 | 15%+ | ₡7,500+ | High | STRONG YES |
| 5 | 2 (neg) | 10.5% | 3.36 | 0% | ₡1,000* | None | DO NOT BET |
| 6 | 2 (small) | 39% | 3.24 | 8.8%* | ₡1,000 | Low | GET MORE CAPITAL |
| 7 | 2 (high) | 85.5% | 1.32 | 25%* | ₡50,000* | Medium | PLACE MAX |

\* = Capped or overridden

---

**Created:** 2026-05-25  
**File:** api/kelly-mercados.js (KELLY_MERCADOS_EXAMPLES.md)
