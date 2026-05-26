# FerXxxa Community Intelligence Analyzer - Implementation Guide

## Overview

The Community Intelligence Analyzer (`api/ferxxxa-community.js`) extracts, parses, and analyzes betting parlays from DoradoBet's public betting chat every 5 minutes. It detects patterns, sentiment, trending, market correlations, and arbitrage opportunities.

**Location:** `/api/ferxxxa-community.js`  
**Cron Trigger:** Every 5 minutes (`*/5 * * * *`)  
**Storage:** `zak_intel` table in Neon Postgres  
**Auth:** CRON_SECRET header validation

---

## Architecture

### 1. Data Pipeline

```
DoradoBet Chat (500 messages)
         ↓
   Chat Scraping
         ↓
   Message Parsing
         ↓
   Sentiment Analysis
         ↓
   Parlay Detection
         ↓
   Trending Detection
         ↓
   Correlation Matrix
         ↓
   Arbitrage Detection
         ↓
   Database Storage
```

### 2. Core Components

#### Component: Sentiment Detection
- **Function:** `detectSentiment(text)`
- **Logic:** Weighted keyword scoring + emoji analysis
- **Output:** "positive" | "negative" | "neutral"
- **Scoring:**
  - Positive keywords have weights (1-2)
  - Negative keywords have weights (1-2)
  - Emojis add +1 sentiment score
  - Result: compare positive_score vs negative_score

**Example:**
```javascript
// "Voy Over 2.5 segura, vamos dale! 🔥"
// Positive: "voy"(1) + "segura"(2) + "vamos"(1) + "dale"(2) + emoji(1) = 7
// Negative: 0
// Result: "positive"
```

#### Component: Market Detection
- **Function:** `detectMarkets(text)`
- **Patterns Detected:**
  - Match Result: "home_win", "draw", "away_win"
  - Goals: "over_2_5_goals", "under_3_5_goals", etc.
  - BTTS: "btts_yes", "btts_no"
  - Discipline: "under_5_cards"
  - Corners: "corners_over"
  - Players: "filipp_goal", "kane_goal", etc.

**Regex Patterns:**
```javascript
// Over 2.5 detection
/\b(over|o|\+)\s*2[.,]?5\b/i

// BTTS detection  
/\b(btts|ambos marcan|gol de ambos)\b/i

// Player goal detection
/(\b[a-záéíóú]+)\s+(?:gol|goal|anota|scorer)/i
```

#### Component: Parlay Parsing
- **Function:** `parseParlay(text)`
- **Detection Strategy:**
  1. Explicit format: "Parlay: Event1, Event2, Event3"
  2. Plus operator: "Home Win + Over 2.5"
  3. Market keywords: Detect 2+ market signals

**Example Inputs:**
```
"Parlay: Home Win, Over 2.5, BTTS Yes"
  → events: ["home win", "over 2.5", "btts yes"]

"Paderborn Win + Over 2.5 + BTTS"
  → events: ["paderborn win", "over 2.5", "btts"]

"Voy local y over 2.5, segura"
  → events: ["home_win", "over_2_5_goals"]
```

#### Component: Trending Detection
- **Function:** `detectTrending(parlayName, currentFreq, currentWindow, previousWindow)`
- **Method:** Compare 15-min time windows
- **Output:** "strongly_up" | "up" | "stable" | "down" | "strongly_down"

**Logic:**
```javascript
percentChange = ((currentCount - previousCount) / previousCount) * 100

if (percentChange > 50)     return "strongly_up"
if (percentChange > 20)     return "up"
if (percentChange < -50)    return "strongly_down"
if (percentChange < -20)    return "down"
else                        return "stable"
```

#### Component: Correlation Matrix
- **Function:** `calculateCorrelations(parlayMap)`
- **Output:** Nested structure of market pairs with correlation scores
- **Formula:** Correlation = frequency_together / max_frequency_individual

**Example Output:**
```json
{
  "home_win": {
    "over_2_5_goals": 0.72,
    "btts_yes": 0.54
  },
  "over_2_5_goals": {
    "home_win": 0.72,
    "btts_yes": 0.68
  }
}
```

**Interpretation:**
- 0.72 = "Home Win" and "Over 2.5" appear together 72% of the time when one is mentioned
- 0.54 = "Home Win" and "BTTS Yes" appear together 54% of the time

#### Component: Arbitrage Detection
- **Function:** `detectArbitrage(parlays)`
- **Threshold:** >3% difference between community and real odds
- **Output:** Array of opportunities with recommendations

**Logic:**
```javascript
percentDiff = Math.abs((realOdds - communityOdds) / communityOdds) * 100

if (percentDiff >= 3) {
  if (realOdds > communityOdds) {
    advantage = "community_undervaluing"  // Real edge is better
  } else {
    advantage = "community_overvaluing"   // Community edge is better
  }
}
```

---

## Data Structure

### Input: Chat Messages
```javascript
{
  user: "usuario123",
  message: "Paderborn Win + Over 2.5 + BTTS, odds 3.25, excelente! 🔥",
  timestamp: "2026-05-25T14:15:00Z",
  likes: 12
}
```

### Output: Database Record
```json
{
  "topic": "ferxxxa_community",
  "match_id": "paderborn_vs_vfl_wolfsburg_2026_05_25",
  "studied_at": "2026-05-25T14:32:00Z",
  "content": "Community betting analysis from DoradoBet chat",
  "summary_json": {
    "total_chat_messages": 500,
    "analyzed_messages": 234,
    "analysis_window_minutes": 30,
    "community_parlays": [
      {
        "parlay_name": "over_2_5_goals + btts_yes",
        "events": ["over_2_5_goals", "btts_yes"],
        "frequency": 67,
        "percentage": 28.6,
        "sentiment": {
          "positive": 55,
          "negative": 2,
          "neutral": 10,
          "dominant": "very_positive"
        },
        "trending": "strongly_up",
        "mentioned_odds": 2.89,
        "real_odds": 2.88,
        "arbitrage_opportunity": false,
        "unique_users": 34
      }
    ],
    "sentiment_analysis": {
      "total_positive": 172,
      "total_negative": 17,
      "total_neutral": 45,
      "overall_sentiment": "positive",
      "confidence": 0.76
    },
    "consensus_bet": {
      "parlay_name": "over_2_5_goals + btts_yes",
      "frequency": 67,
      "consensus_strength": "strong"
    },
    "market_correlation_from_chat": {
      "home_win": {"over_2_5_goals": 0.72, "btts_yes": 0.54},
      "over_2_5_goals": {"btts_yes": 0.68, "home_win": 0.72}
    },
    "player_mentions": {
      "filip_bilbija": {
        "mentions": 18,
        "sentiment": "positive",
        "goals_odds": 2.50
      }
    },
    "arbitrage_opportunities": [
      {
        "parlay": "over_2_5_goals + btts_yes",
        "community_odds": 2.89,
        "real_odds": 3.05,
        "difference": 0.16,
        "percent_difference": 5.5,
        "advantage": "community_undervaluing",
        "recommendation": "Take real odds, avoid community consensus",
        "arbitrage_opportunity": true
      }
    ],
    "data_quality": {
      "messages_analyzed": 234,
      "extraction_timestamp": "2026-05-25T14:32:00Z",
      "confidence_level": "high"
    }
  }
}
```

---

## Key Features

### 1. Sentiment Weighted Keywords
- **Positive:** ganador(2), excelente(2), segura(2), voy(1), dale(2), etc.
- **Negative:** mala(2), pérdida(2), fracaso(2), error(1), riesgo(1), etc.
- **Emojis:** ✓✅🔥🚀💪👍 for positive, ⚠️❌🚫💔⛔ for negative

### 2. Multi-Language Support
- **Spanish:** "local", "gana", "ambos marcan", "tarjetas"
- **English:** "home", "away", "both score", "cards"
- **Abbreviations:** "BTTS", "o2.5", "< 5"

### 3. Trending Detection
- Compares 15-minute time windows
- Calculates percentage change: `((current - previous) / previous) * 100`
- Categories: strongly_up (>50%), up (>20%), stable (±20%), down (<-20%), strongly_down (<-50%)

### 4. Market Correlation
- Detects which markets are mentioned together
- Normalizes market names (variations → standard keys)
- Calculates correlation as: `frequency_together / max_frequency_individual`

### 5. Arbitrage Detection
- Compares community mentioned odds vs real bookmaker odds
- Flags if difference > 3%
- Recommends "take real odds" vs "avoid community"

### 6. Player Tracking
- Extracts player-specific bets: "Filip Bilbija goal"
- Tracks sentiment per player
- Stores average odds mentioned

---

## Execution Flow

### Step 1: Validate Request
```javascript
const secret = req.headers.authorization?.split(' ')[1];
if (secret !== process.env.CRON_SECRET && !isLocalDev) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### Step 2: Scrape Chat
```javascript
let chatMessages = [];
try {
  chatMessages = await scrapeDoradoBetChat();  // Live scraping
} catch (err) {
  // Fallback to cached data (max 30 min old)
  // Or fallback to simulated data
}
```

### Step 3: Parse & Analyze
```javascript
const analysis = analyzeChat(chatMessages);  // Core analysis

// Breakdown:
// - Process 500 messages
// - Detect sentiment on each
// - Parse parlays
// - Track player mentions
// - Calculate trending vs 15-min history
// - Build correlation matrix
```

### Step 4: Enrich with Real Odds
```javascript
enrichWithRealOdds(analysis);  // Add real bookmaker odds
```

### Step 5: Detect Arbitrage
```javascript
analysis.summary_json.arbitrage_opportunities = detectArbitrage(
  analysis.summary_json.community_parlays
);
```

### Step 6: Persist to Database
```javascript
await db`
  INSERT INTO zak_intel (topic, content, summary_json, studied_at)
  VALUES (
    'ferxxxa_community',
    ${contentSummary},
    ${JSON.stringify(analysis.summary_json)}::jsonb,
    NOW()
  )
`;
```

### Step 7: Return Response
```javascript
return res.status(200).json({
  success: true,
  timestamp: timestamp,
  source: scrapingSuccess ? 'doradobet_live' : 'cache',
  data_persisted: dbSaveSuccess,
  community_analysis: analysis.summary_json
});
```

---

## Real-World Example

### Chat Messages (Sample)
```
[14:10] usuario123: "Voy Over 2.5 en este partido, el equipo local está muy ofensivo"
[14:12] betmaster45: "Over 2.5 segura hermano! 🔥 Estos equipos atacan mucho"
[14:15] carlos_expert: "Over 2.5 + BTTS excelente combinación aquí"
[14:18] ana_profesional: "Paderborn Win + Over 2.5, odds 3.25, dale!"
[14:20] paco_seguro: "Parlay: Home Win, Over 3.5, BTTS Yes, < 5 tarjetas"
[14:25] luis_data: "Filip Bilbija gol - ese tipo siempre marca contra estos"
[14:28] diego_smart: "BTTS + Over 3.5 goles, odds 4.50, ganador"
...
```

### Processing Output

**Parsed Parlays:**
1. `over_2_5_goals` → frequency: 156 (67% positive sentiment)
2. `over_2_5_goals + btts_yes` → frequency: 67 (82% positive)
3. `home_win + over_2_5_goals` → frequency: 45 (71% positive)
4. `home_win + over_3_5_goals + btts_yes + under_5_cards` → frequency: 28 (68% positive)
5. `filip_goal + over_2_5_goals` → frequency: 18 (78% positive)

**Sentiment Distribution:**
- Total Positive: 172 (73%)
- Total Negative: 17 (7%)
- Total Neutral: 45 (20%)
- **Overall: "positive" (confidence: 76%)**

**Trending:**
- `over_2_5_goals`: strongly_up (current: 67, previous: 35 → +91%)
- `home_win + over_2_5_goals`: up (current: 45, previous: 32 → +41%)

**Consensus Bet:**
- Parlay: `over_2_5_goals + btts_yes`
- Frequency: 67 (28.6% of analyzed messages)
- **Strength: STRONG** (>15% threshold)

**Correlation Matrix:**
```json
{
  "home_win": {
    "over_2_5_goals": 0.72,  // Together 72% of the time
    "btts_yes": 0.54
  },
  "over_2_5_goals": {
    "btts_yes": 0.68,         // Together 68% of the time
    "home_win": 0.72
  }
}
```

**Arbitrage Opportunities:**
```
Parlay: over_2_5 + btts
Community: 2.89 | Real: 3.05 | Diff: +5.5%
→ "Community undervaluing - Take real odds"
```

---

## Testing

Run the test suite to verify all parsing logic:

```bash
node FERXXXA_COMMUNITY_TEST_EXAMPLES.js
```

Tests cover:
- Sentiment detection (positive, negative, neutral, mixed)
- Market detection (home win, over/under, BTTS, cards, players)
- Odds extraction
- Multi-market parlays
- Edge cases (empty strings, uppercase, special characters)

---

## Configuration

### Environment Variables
```bash
CRON_SECRET=your_secret_key
DORADOBET_USER=your_username
DORADOBET_PASS=your_password
NODE_ENV=production
```

### Database Schema
```sql
CREATE TABLE zak_intel (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(100),
  match_id VARCHAR(200),
  home_team VARCHAR(100),
  away_team VARCHAR(100),
  current_score VARCHAR(20),
  current_minute INT,
  content TEXT,
  summary_json JSONB,
  studied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_topic ON zak_intel(topic);
CREATE INDEX idx_match_id ON zak_intel(match_id);
CREATE INDEX idx_studied_at ON zak_intel(studied_at DESC);
```

---

## Performance Notes

- **Chat Scraping:** ~2-3 seconds (with Playwright)
- **Sentiment Analysis:** ~500ms for 500 messages
- **Parlay Parsing:** ~300ms (regex-based)
- **Correlation Calculation:** ~200ms
- **Database Insert:** ~500ms
- **Total Execution:** ~4-5 seconds per run

---

## Monitoring & Alerts

Monitor these metrics:
1. **Messages Analyzed:** Should be >100 for each run
2. **Sentiment Confidence:** Should be >0.65 for reliable data
3. **Consensus Strength:** "strong" = reliable signal
4. **Data Quality:** "high" confidence when >200 messages analyzed
5. **Trending:** "strongly_up" indicates emerging consensus

---

## Common Issues & Solutions

### No Chat Messages Found
- **Cause:** DoradoBet website structure changed or authentication failed
- **Solution:** Fallback to cached data or simulated messages

### Low Sentiment Confidence
- **Cause:** Chat is discussing specific odds rather than sentiment
- **Solution:** Increase weighting of betting-specific keywords

### Correlation Matrix Empty
- **Cause:** No multi-market parlays detected
- **Solution:** Lower sentiment threshold or improve market detection regex

### Arbitrage Threshold Too Low
- **Current:** >3% difference
- **Adjustment:** Change in `detectArbitrage()` function

---

## Future Enhancements

1. **ML-based Sentiment:** Train classifier on past chat data
2. **User Reputation Scoring:** Weight messages from proven predictors
3. **Cross-Book Arbitrage:** Compare multiple bookmakers
4. **Real-Time Notifications:** Alert when consensus shifts
5. **Player Performance History:** Track accuracy of player goal predictions
6. **Late Momentum Detection:** Identify last-minute sentiment swings

---

## References

- **Spec:** `/mundo2026/FERXXXA_REQUIREMENTS.md`
- **Markets API:** `/api/ferxxxa-markets.js`
- **Tests:** `/FERXXXA_COMMUNITY_TEST_EXAMPLES.js`
- **Example Output:** `/FERXXXA_COMMUNITY_EXAMPLE_OUTPUT.json`
