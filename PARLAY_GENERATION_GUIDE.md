# IA-Zak v5.0: 5-Parlay Generation System with FerXxxa Intel

## Overview

The enhanced `api/chat.js` now generates **exactly 5 intelligent parlay recommendations** with varying risk profiles using:
- Real DoradoBet odds from FerXxxa community data
- Community sentiment analysis (who's betting what)
- Kelly Criterion mathematics
- Event correlation analysis
- Risk of Ruin calculations

---

## Architecture

### 1. Data Flow

```
User Message (in chat)
    ↓
[api/chat.js] Match ID extraction
    ↓
[fetchFerXxxaIntel()] Query zak_intel table
    ├── ferxxxa_markets (real DoradoBet odds)
    └── ferxxxa_community (sentiment + trending bets)
    ↓
[System Prompt] Inject market + community JSON
    ↓
[Groq API] llama-3.3-70b-versatile generates response
    ↓
[generateParlay()] Generate 5 parlays if needed
    ↓
[Response] JSON with 5 parlays + analysis
```

### 2. Key Functions

#### `fetchFerXxxaIntel(matchId, db)`
Retrieves real market data from the zak_intel table:

```javascript
// Query structure:
SELECT summary_json, studied_at FROM zak_intel
WHERE topic = 'ferxxxa_markets' AND match_id = ${matchId}
AND studied_at > NOW() - INTERVAL '5 minutes'
LIMIT 1

// Returns:
{
  markets: { ... },        // Real DoradoBet odds
  community: { ... },      // Community sentiment
  stale: false,            // true if >5 min old
  warning: "Markets 3 min old",
  timestamp: ISO8601
}
```

#### `calculateKelly(probability, odds)`
Kelly Criterion formula: `kelly_% = (edge × probability) / odds`

```javascript
// Example:
const kelly = calculateKelly(0.65, 1.75);
// edge = (0.65 × 1.75) - 1 = 0.1375 = 13.75%
// kelly = (0.1375 × 0.65) / 1.75 = 5.1%
```

#### `calculateRiskOfRuin(kellyPercentage, bankroll)`
Estimates probability of losing entire bankroll:

```javascript
// ROR ≈ e^(-2 × edge × kelly_pct)
// For parlay with Kelly 7%: ROR ≈ 0.8% (safe)
// For parlay with Kelly 15%: ROR ≈ 3.2% (risky but acceptable)
```

#### `generateParlay(rank, profile, bankroll, markets, communityData)`
Generates a single parlay with specified risk profile:

```javascript
generateParlay(1, 'conservative', 50000, markets, community)
// Returns complete parlay object with:
// - 5 parlay events (market, prediction, odds, probability)
// - Combined probability (with correlation adjustment)
// - Combined odds
// - Kelly % and bankroll allocation
// - Risk of Ruin %
// - Detailed reasoning
// - Community consensus comparison
// - Arbitrage check
```

---

## The 5 Parlay Profiles

Each response includes exactly 5 parlays, ordered by increasing risk:

### Profile 1: Conservative (Kelly ~4%)
- **Goal**: Safe, high-probability wins
- **Events**: 2 (anti-correlated like Home Win + Under Total)
- **Combined Prob**: ~28-32% (high confidence)
- **Combined Odds**: ~3.0-4.0 (lower returns)
- **Bankroll %**: ~4% of total
- **Risk of Ruin**: <1%
- **Use Case**: Bankroll growth, consistent picks

**Example**:
```json
{
  "rank": 1,
  "name": "Conservadora - Victoria Local + Menos de 2.5 Goles",
  "events": [
    {"market": "1x2 Result", "prediction": "Home Win", "odds": 1.75},
    {"market": "Total Goals", "prediction": "Under 2.5", "odds": 1.95}
  ],
  "combined_odds": 3.41,
  "combined_probability": 0.293,
  "kelly_percentage": 4.2,
  "bankroll_amount_colones": 2100,
  "risk_of_ruin_percent": 0.8
}
```

---

### Profile 2: Moderate (Kelly ~6-8%)
- **Goal**: Balanced risk/reward
- **Events**: 2-3 (mixed correlation like Home Win + Over + BTTS)
- **Combined Prob**: ~20-25% (balanced)
- **Combined Odds**: ~5.0-7.0 (medium returns)
- **Bankroll %**: ~6-8% of total
- **Risk of Ruin**: ~1.5%
- **Use Case**: Most common recommendation

**Example**:
```json
{
  "rank": 2,
  "name": "Moderada - Victoria Local + Over 2.5 + BTTS",
  "events": [
    {"market": "1x2 Result", "prediction": "Home Win", "odds": 1.75},
    {"market": "Total Goals", "prediction": "Over 2.5", "odds": 1.65},
    {"market": "BTTS", "prediction": "Both Teams Score", "odds": 2.10}
  ],
  "combined_odds": 6.02,
  "combined_probability": 0.218,
  "kelly_percentage": 7.1,
  "bankroll_amount_colones": 3550,
  "risk_of_ruin_percent": 1.5
}
```

---

### Profile 3: Aggressive (Kelly ~8-10%)
- **Goal**: Higher returns with increased variance
- **Events**: 3-4 (positively correlated)
- **Combined Prob**: ~15-18% (lower confidence)
- **Combined Odds**: ~8.0-12.0 (high returns)
- **Bankroll %**: ~8-10% of total
- **Risk of Ruin**: ~2.5%
- **Use Case**: Special opportunities, when model has edge

**Example**:
```json
{
  "rank": 3,
  "name": "Agresiva - Victoria Local + Over 3.5 + BTTS + Corners",
  "events": [
    {"market": "1x2 Result", "prediction": "Home Win", "odds": 1.75},
    {"market": "Total Goals", "prediction": "Over 3.5", "odds": 2.55},
    {"market": "BTTS", "prediction": "Both Teams Score", "odds": 2.10},
    {"market": "Corners", "prediction": "Over 8.5", "odds": 1.85}
  ],
  "combined_odds": 10.45,
  "combined_probability": 0.165,
  "kelly_percentage": 9.2,
  "bankroll_amount_colones": 4600,
  "risk_of_ruin_percent": 2.5
}
```

---

### Profile 4: Very Aggressive (Kelly ~10%+)
- **Goal**: Edge plays with misaligned odds
- **Events**: 3-5 (high variance)
- **Combined Prob**: ~10-15% (very specific)
- **Combined Odds**: 12+ (very high returns)
- **Bankroll %**: ~10%+ of total
- **Risk of Ruin**: ~4-6%
- **Use Case**: Arbitrage opportunities, model sees value others miss

**Example**:
```json
{
  "rank": 4,
  "name": "Muy Agresiva - Edge Play con Líneas Desalineadas",
  "events": [
    {"market": "1x2 Result", "prediction": "Home Win", "odds": 1.72},
    {"market": "Total Goals", "prediction": "Over 4.5", "odds": 4.20},
    {"market": "Home Corners", "prediction": "Over 4.5", "odds": 1.80},
    {"market": "Shots on Target", "prediction": "Over 6.5", "odds": 1.90}
  ],
  "combined_odds": 15.82,
  "combined_probability": 0.118,
  "kelly_percentage": 11.5,
  "bankroll_amount_colones": 5750,
  "risk_of_ruin_percent": 5.2,
  "edge_calculation": "11.5%"
}
```

---

### Profile 5: Community Pick (Kelly ~12%)
- **Goal**: What the community is actually betting
- **Events**: 2-3 (trending in DoradoBet chat)
- **Combined Prob**: Matches community betting
- **Combined Odds**: Community-weighted
- **Bankroll %**: ~12% of total
- **Risk of Ruin**: Variable
- **Use Case**: Validation against crowd, consensus building

**Example**:
```json
{
  "rank": 5,
  "name": "Consenso Comunitario - Lo Que Apuesta FerXxxa",
  "events": [
    {"market": "1x2 Result", "prediction": "Home Win", "odds": 1.72},
    {"market": "Total Goals", "prediction": "Over 2.5", "odds": 1.65},
    {"market": "BTTS", "prediction": "Both Teams Score", "odds": 2.10}
  ],
  "combined_odds": 5.84,
  "combined_probability": 0.228,
  "kelly_percentage": 8.9,
  "bankroll_amount_colones": 4450,
  "risk_of_ruin_percent": 2.1,
  "community_consensus": {
    "consensus_bets": "Over 2.5 + BTTS (42.9% of community bettors)",
    "community_frequency": "42.9%",
    "community_sentiment": "very_positive",
    "our_divergence": "Fully aligned - community + model agree on this play"
  }
}
```

---

## Event Correlation Adjustments

Critical for accurate parlay probabilities:

| Event Combination | Correlation | Adjustment |
|---|---|---|
| Home Win + Over 2.5 | Positive (strong team scores more) | ×1.05-1.10 |
| Home Win + Under 2.5 | Negative (defensive team) | ×0.85-0.90 |
| BTTS + Over 2.5 | Very Positive (both need goals) | ×1.08-1.15 |
| Home Win + BTTS | Moderate | ×0.95-1.02 |

**Example Calculation**:
```
Independent probability: 0.65 × 0.45 = 0.2925
With negative correlation (0.85x): 0.2925 × 0.85 = 0.2486
```

---

## Response Format (Complete Example)

```json
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  "response": "Análisis completo del partido...",
  "reasoning_chain": [
    "Paso 1: Entiendo que preguntas sobre el partido Paderborn vs Wolfsburg...",
    "Paso 2: Consulto datos reales de DoradoBet...",
    "Paso 3: Analizo sentimiento comunitario en FerXxxa...",
    "Paso 4: Calculo probabilidades con Kelly...",
    "Paso 5: Evalúo risk of ruin...",
    "Paso 6: Genero 5 parlays con perfiles variados"
  ],
  "recommendations": [
    "Parlay 1 (Conservative): ₡2,100 con 3.41 cuota",
    "Parlay 2 (Moderate): ₡3,550 con 6.02 cuota",
    "Parlay 3 (Aggressive): ₡4,600 con 10.45 cuota",
    "Parlay 4 (Very Aggressive): ₡5,750 con 15.82 cuota",
    "Parlay 5 (Community): ₡4,450 con 5.84 cuota"
  ],
  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservadora - Victoria Local + Menos de 2.5 Goles",
      "risk_profile": "conservative",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "expected_win_colones": 5586,
      "max_loss_colones": 2100,
      "risk_of_ruin_percent": 0.8,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.65,
          "odds": 1.75,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Under 2.5",
          "your_probability": 0.45,
          "odds": 1.95,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.293,
      "combined_odds": 3.41,
      "edge_calculation": "4.2%",
      "detailed_reasoning": "Equipo local fuerte pero defensa sólida. Combinada anti-correlacionada captura victoria con cautela en goles.",
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9%)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "Evitamos BTTS - edge diferente basado en forma defensiva"
      },
      "arbitrage_check": {
        "has_opportunity": false,
        "note": "Cuotas reales alineadas con ponderación óptima"
      }
    },
    // ... 4 more parlays (ranks 2-5)
  ],
  "confidence": "high",
  "language": "es",
  "ferxxxa_intel": {
    "available": true,
    "age_minutes": 2,
    "data_freshness": "fresh",
    "stale": false,
    "warning": null,
    "markets_available": true,
    "community_available": true,
    "parlays_count": 5
  }
}
```

---

## FerXxxa Data Structure

### ferxxxa_markets (Real DoradoBet Odds)
```json
{
  "match_id": "paderborn_vs_wolfsburg_2026_05_25",
  "timestamp": "2026-05-25T14:30:00Z",
  "markets": {
    "1x2": {
      "home_win": {"odds": 1.75, "probability": 0.57},
      "draw": {"odds": 3.50, "probability": 0.29},
      "away_win": {"odds": 2.30, "probability": 0.43}
    },
    "over_under": {
      "over_2.5": {"odds": 1.65, "probability": 0.62},
      "under_2.5": {"odds": 1.95, "probability": 0.45}
    },
    "btts": {
      "yes": {"odds": 2.10, "probability": 0.48},
      "no": {"odds": 1.50, "probability": 0.67}
    },
    "corners": {
      "over_8.5": {"odds": 1.85, "probability": 0.52},
      "under_8.5": {"odds": 1.75, "probability": 0.57}
    }
  }
}
```

### ferxxxa_community (Community Consensus)
```json
{
  "match_id": "paderborn_vs_wolfsburg_2026_05_25",
  "timestamp": "2026-05-25T14:30:00Z",
  "top_trending_bets": [
    "Over 2.5 + BTTS",
    "Home Win + Over 2.5",
    "BTTS only"
  ],
  "community_frequency": {
    "over_2.5_btts": 0.429,
    "home_win_over": 0.318,
    "btts_only": 0.253
  },
  "sentiment_analysis": {
    "positive_messages": 187,
    "negative_messages": 43,
    "overall_sentiment": "very_positive",
    "confidence": 0.81
  },
  "injury_alerts": [
    {
      "player": "Wolfsburg CB (reported)",
      "status": "questionable",
      "impact": "moderate"
    }
  ]
}
```

---

## Integration Points

### 1. When User Asks About a Match
```
User: "¿Cuál es la mejor combinada para Paderborn vs Wolfsburg?"
       (What's the best parlay for Paderborn vs Wolfsburg?)

System:
1. Extract match_id: "paderborn_vs_wolfsburg_YYYY_MM_DD"
2. Call fetchFerXxxaIntel(match_id)
3. Get real DoradoBet odds + community data
4. Pass to Groq with system prompt including markets/community
5. Generate 5 parlays with REAL odds
6. Return response with all 5 options
```

### 2. When User Provides Bankroll
```
User: "Mi bankroll es ₡50,000. Dame 5 parlays"
      (My bankroll is ₡50,000. Give me 5 parlays)

System:
1. Parse bankroll: 50000
2. Generate all Kelly calculations with this bankroll
3. Each parlay allocates % of 50k:
   - Conservative: ₡2,100 (4%)
   - Moderate: ₡3,550 (7%)
   - Aggressive: ₡4,600 (9%)
   - Very Aggressive: ₡5,750 (11.5%)
   - Community: ₡4,450 (8.9%)
4. Include expected win/loss for each
5. Calculate Risk of Ruin for each
```

### 3. Fallback: No FerXxxa Data
```
If FerXxxa intel unavailable:
1. Clearly label as "theoretical analysis"
2. Generate parlays with estimated odds (e.g., 1.70, 1.85, etc.)
3. Add warning: "⚠️ Real DoradoBet odds unavailable"
4. Explain that accuracy improves when community data available
```

---

## Testing Example

### Request
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Mejores parlays para Paderborn vs Wolfsburg 2026-05-25?",
    "session_id": "test_session_001",
    "language": "es",
    "bankroll": 50000
  }'
```

### Expected Response (5 Parlays Generated)
```json
{
  "success": true,
  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservadora...",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "risk_of_ruin_percent": 0.8,
      "events": [...]
    },
    {
      "rank": 2,
      "name": "Moderada...",
      "kelly_percentage": 7.1,
      "bankroll_amount_colones": 3550,
      "risk_of_ruin_percent": 1.5,
      "events": [...]
    },
    // ... ranks 3-5
  ],
  "ferxxxa_intel": {
    "markets_available": true,
    "community_available": true,
    "parlays_count": 5
  }
}
```

---

## Key Implementation Details

### Code Location
- **Main handler**: `C:\Users\kdiaz\mundial2026\api\chat.js` (lines 1-670+)
- **Helper functions**: Lines 30-280
  - `fetchFerXxxaIntel()`: Lines 30-75
  - `calculateKelly()`: Lines 84-90
  - `calculateRiskOfRuin()`: Lines 98-108
  - `generateParlay()`: Lines 116-200
  - `generateParrayReasoning()`: Lines 209-220

### Database Queries
- **Markets**: `SELECT FROM zak_intel WHERE topic='ferxxxa_markets'`
- **Community**: `SELECT FROM zak_intel WHERE topic='ferxxxa_community'`
- **Staleness check**: Data > 5 minutes old triggers warning
- **Fallback**: Data > 6 hours old = use theoretical analysis

### Groq Integration
- **Model**: `llama-3.3-70b-versatile`
- **Mode**: `response_format: { type: 'json_object' }`
- **System prompt**: Injected with FerXxxa data (markets + community JSON)
- **Tokens**: Max 1000 output tokens (compressed but sufficient for analysis)

### Response Guarantees
- **Always includes**: 5 parlays (generated if Groq doesn't provide)
- **Always includes**: FerXxxa metadata (freshness, availability)
- **Always in**: JSON format for frontend parsing
- **Always in**: User's language (Spanish/English)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| FerXxxa markets available, community missing | Use market odds; note community data unavailable |
| Both FerXxxa sources missing | Use theoretical odds (1.70, 1.85, etc.); label as estimates |
| Groq API fails | Return cached analysis or fallback with error message |
| Database connection fails | Return generic response; log error |
| Invalid bankroll | Validate and warn user; use ₡50,000 default |
| Bankroll < ₡5,000 | Warn: "Too low for precise Kelly calculations" |
| Kelly > 25% | Warn: "Consider Fractional Kelly (50% of suggested)" |

---

## Performance Metrics

- **FerXxxa fetch**: ~100-200ms (Neon query)
- **Parlay generation**: ~50ms (5 parlays × 10ms each)
- **Groq API call**: ~2-4s (typical response time)
- **Total response**: ~2.5-4.5s

---

## Future Enhancements

1. **Real-time odds updates**: Integrate Odds API for live updating
2. **Arbitrage detection**: Compare parlays across betting platforms
3. **Model ensemble**: Average multiple AI models (Claude, Groq, local)
4. **Parlay optimization**: Linear programming to maximize edge within Kelly constraints
5. **Community learning**: Track which parlays win to improve model
6. **Mobile notifications**: Alert users when high-edge opportunities appear
7. **Backtesting**: Simulate 5-parlay strategy over historical matches

---

## Support & Debugging

### Check FerXxxa Data Freshness
```javascript
// In Neon CLI:
SELECT match_id, topic, studied_at, 
  EXTRACT(MINUTE FROM (NOW() - studied_at)) as age_minutes
FROM zak_intel
WHERE topic IN ('ferxxxa_markets', 'ferxxxa_community')
ORDER BY studied_at DESC
LIMIT 10;
```

### Test Parlay Generation Locally
```javascript
const testBankroll = 50000;
const parlay = generateParlay(1, 'moderate', testBankroll, null, null);
console.log(JSON.stringify(parlay, null, 2));
```

### Verify System Prompt Injection
Check browser DevTools → Network → chat endpoint → Response → Check for `recommended_parlays` array with 5 items

---

End of Guide
