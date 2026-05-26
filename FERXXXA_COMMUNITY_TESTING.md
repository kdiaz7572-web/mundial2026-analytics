# FerXxxa Community Intelligence Analyzer - Testing Guide

## Overview

The `api/ferxxxa-community.js` endpoint analyzes DoradoBet's betting room chat in real-time, detecting parlays, analyzing sentiment, and identifying arbitrage opportunities.

**Endpoint:** `/api/ferxxxa-community`  
**Method:** GET  
**Frequency:** Every 5 minutes (via cron: `*/5 * * * *`)  
**Auth:** CRON_SECRET header validation

---

## File Structure

```
api/ferxxxa-community.js  (320 lines)
├── Main handler (req/res)
├── scrapeDoradoBetChat() - Chat acquisition layer
├── analyzeChat() - Core parsing & sentiment logic
├── parseParlay() - Regex-based parlay detection
├── detectMarkets() - Market keyword extraction
├── detectSentiment() - Spanish sentiment keywords
├── enrichWithRealOdds() - Odds comparison
├── detectArbitrage() - Opportunity detection
└── calculateCorrelations() - Co-mention analysis
```

---

## Testing Instructions

### 1. LOCAL DEVELOPMENT TEST

Run the endpoint locally with simulated chat:

```bash
# Set environment variables
$env:NODE_ENV = "development"
$env:CRON_SECRET = "test-secret-12345"
$env:DATABASE_URL = "postgresql://..."  # Your Neon connection

# Test the endpoint (development mode bypasses CRON_SECRET)
curl "http://localhost:3000/api/ferxxxa-community" \
  -H "Authorization: Bearer test-secret-12345"
```

**Expected Response:**
```json
{
  "success": true,
  "timestamp": "2026-05-25T14:32:00Z",
  "source": "doradobet_live",
  "data_persisted": true,
  "community_analysis": {
    "total_chat_messages": 500,
    "analyzed_messages": 156,
    "community_parlays": [
      {
        "parlay_name": "over_2_5_goals + btts_yes",
        "events": ["over_2_5_goals", "btts_yes"],
        "frequency": 45,
        "percentage": 28.8,
        "sentiment": "positive",
        "trending": "stable",
        "mentioned_odds": 2.89,
        "real_odds": 2.88,
        "arbitrage_opportunity": false
      }
    ],
    "sentiment_analysis": {
      "total_positive": 87,
      "total_negative": 23,
      "total_neutral": 46,
      "overall_mood": "positive"
    },
    "market_correlation_from_chat": {
      "over_2_5_goals_btts_yes": 0.75,
      "home_win_btts_yes": 0.68
    },
    "arbitrage_opportunities": [
      {
        "parlay": "over_2_5_goals",
        "community_odds": 2.0,
        "real_odds": 1.85,
        "difference": 0.15,
        "percent_difference": 8.1,
        "advantage": "community_overvaluing",
        "edge": "negative"
      }
    ],
    "consensus_bets": {
      "most_popular": "over_2_5_goals + btts_yes",
      "most_bullish": "home_win",
      "sentiment_leaders": ["betmaster45", "carlos_expert"]
    }
  }
}
```

---

### 2. UNIT TESTS FOR PARSING

Test individual parsing functions:

#### Test: Basic Market Detection
```javascript
const text = "Voy Over 2.5 en este partido";
const markets = detectMarkets(text.toLowerCase());
// Expected: ["over_2_5_goals"]
```

#### Test: Multi-Event Parlay
```javascript
const text = "Home Win + Over 2.5 + BTTS";
const parlay = parseParlay(text.toLowerCase());
// Expected events: ["home_win", "over_2_5_goals", "btts_yes"]
```

#### Test: Player-Specific Bet
```javascript
const text = "Filip Bilbija gol + BTTS";
const parlay = parseParlay(text.toLowerCase());
// Expected events include "filip bilbija_goal" and "btts_yes"
```

#### Test: Sentiment Detection
```javascript
const positive = detectSentiment("excelente ganador 🔥");
const negative = detectSentiment("mala pérdida fracaso");
// Expected: "positive" and "negative"
```

#### Test: Odds Extraction
```javascript
const text = "Over 2.5 @ 1.85, odds excelentes";
const odds = extractOdds(text);
// Expected: 1.85
```

---

### 3. INTEGRATION TEST WITH DATABASE

Test full flow with database persistence:

```bash
# 1. Check that zak_intel table is migrated
$env:DATABASE_URL = "postgresql://..."

# 2. Run the endpoint
curl -X GET "http://localhost:3000/api/ferxxxa-community" \
  -H "Authorization: Bearer $env:CRON_SECRET"

# 3. Verify database entry
psql $DATABASE_URL -c "
  SELECT topic, content, studied_at, 
         summary_json->'total_chat_messages' as messages,
         summary_json->'sentiment_analysis' as sentiment
  FROM zak_intel
  WHERE topic = 'ferxxxa_community'
  ORDER BY studied_at DESC
  LIMIT 1;
"
```

**Expected:** Entry with `topic='ferxxxa_community'` and populated `summary_json`

---

### 4. TEST CACHE FALLBACK

Simulate chat scraping failure to test cache:

```bash
# 1. Ensure an older entry exists in database
# (Run the endpoint once, then wait)

# 2. Block network access to DoradoBet (or modify the fetch)

# 3. Run the endpoint again
curl -X GET "http://localhost:3000/api/ferxxxa-community" \
  -H "Authorization: Bearer $env:CRON_SECRET"

# 4. Expected: Returns cached data if < 30 minutes old
# Response should have "source": "cache"
```

---

### 5. TEST SENTIMENT ANALYSIS

Test Spanish sentiment keywords:

```javascript
// Positive examples
const pos1 = detectSentiment("ganador excelente segura 🚀");
const pos2 = detectSentiment("vamos dale lleva ✓");

// Negative examples  
const neg1 = detectSentiment("mala perdida fracaso error");
const neg2 = detectSentiment("no va imposible contra");

// Neutral examples
const neu1 = detectSentiment("voy apostar cuota odds");

console.log(pos1, pos2, neg1, neg2, neu1);
// Expected: "positive", "positive", "negative", "negative", "neutral"
```

---

### 6. TEST PARLAY DETECTION PATTERNS

Test all regex patterns:

```javascript
// Pattern 1: Explicit format "Parlay: Event1, Event2"
const p1 = parseParlay("parlay: home win, over 2.5, btts");
// Expected: parlay_name = "home_win + over_2_5_goals + btts_yes"

// Pattern 2: Plus notation "Event1 + Event2 + Event3"
const p2 = parseParlay("home win + over 2.5 + btts");
// Expected: Similar to p1

// Pattern 3: Market keywords only
const p3 = parseParlay("voy over 2.5 con btts");
// Expected: parlay_name with those markets

// Pattern 4: Player-specific
const p4 = parseParlay("filip bilbija gol + over 2.5");
// Expected: Includes "filip bilbija_goal"
```

---

### 7. TEST ARBITRAGE DETECTION

Test opportunity identification:

```javascript
const parlays = [
  {
    parlay_name: "over_2_5_goals",
    mentioned_odds: 2.0,      // Community says 2.0
    real_odds: 1.85,          // Real odds are 1.85
    // Expected: arbitrage detected (8.1% difference)
  },
  {
    parlay_name: "home_win",
    mentioned_odds: 1.95,
    real_odds: 1.95,
    // Expected: no arbitrage (0% difference)
  }
];

const arb = detectArbitrage(parlays);
// Expected: 1 opportunity found (first parlay only)
// advantage: "community_overvaluing" (community thinks higher chance)
```

---

### 8. CRON INTEGRATION TEST

Test scheduled execution:

```bash
# 1. Add to vercel.json (if deploying):
{
  "crons": [
    {
      "path": "/api/ferxxxa-community",
      "schedule": "*/5 * * * *"
    }
  ]
}

# 2. Deploy to Vercel
vercel deploy

# 3. Check logs
vercel logs api/ferxxxa-community

# 4. Expected output every 5 minutes:
# [ferxxxa-community] Starting community analysis at 2026-05-25T14:32:00Z
# [ferxxxa-community] ✅ Scraped 500 chat messages
# [ferxxxa-community] ✅ Data saved to zak_intel table
```

---

## Error Handling Tests

### 8a. Test Chat Unavailable (Graceful Degradation)
```bash
# The endpoint should return empty analysis, NOT crash:
curl -X GET "http://localhost:3000/api/ferxxxa-community"

# Expected response (even if chat fails):
{
  "success": true,
  "source": "empty_analysis",
  "community_analysis": {
    "total_chat_messages": 0,
    "analyzed_messages": 0,
    "community_parlays": [],
    "sentiment_analysis": { ... }
  }
}
```

### 8b. Test Database Persistence Failure
```bash
# Temporarily break DATABASE_URL
# Endpoint should still return analysis, just not persist

# Expected: 
{
  "success": true,
  "data_persisted": false,
  "community_analysis": { ... }
}
```

### 8c. Test Missing CRON_SECRET (Production)
```bash
# In production mode (NODE_ENV != development):
curl -X GET "http://localhost:3000/api/ferxxxa-community" \
  -H "Authorization: Bearer wrong-secret"

# Expected:
{
  "success": false,
  "error": "Unauthorized",
  "message": "Missing or invalid CRON_SECRET"
}
```

---

## Performance Benchmarks

Expected performance metrics:

| Metric | Target | Notes |
|--------|--------|-------|
| Chat scraping | < 30 sec | Simulation: instant; Real Playwright: 5-30s |
| Message parsing | < 2 sec | 500 messages at ~250/sec |
| Sentiment analysis | < 1 sec | Keyword matching, O(n) |
| Database insert | < 500 ms | Single INSERT to zak_intel |
| **Total end-to-end** | **< 2 min** | Including network delays |

---

## Database Verification Queries

Verify data quality in database:

```sql
-- Check latest community analysis
SELECT id, topic, content, studied_at,
       (summary_json->'total_chat_messages')::int as messages,
       (summary_json->'analyzed_messages')::int as analyzed,
       json_array_length(summary_json->'community_parlays') as parlay_count
FROM zak_intel
WHERE topic = 'ferxxxa_community'
ORDER BY studied_at DESC
LIMIT 5;

-- Check sentiment trends over time
SELECT 
  DATE_TRUNC('hour', studied_at) as hour,
  COUNT(*) as runs,
  AVG((summary_json->'sentiment_analysis'->>'total_positive')::int) as avg_positive
FROM zak_intel
WHERE topic = 'ferxxxa_community'
  AND studied_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;

-- Find most frequently mentioned parlays
SELECT 
  p->>'parlay_name' as parlay,
  (p->>'frequency')::int as frequency,
  (p->>'sentiment')::text as sentiment
FROM zak_intel,
  jsonb_array_elements(summary_json->'community_parlays') as p
WHERE topic = 'ferxxxa_community'
  AND studied_at > NOW() - INTERVAL '24 hours'
ORDER BY (p->>'frequency')::int DESC
LIMIT 10;
```

---

## Real-World Scraping (Future Playwright Implementation)

When integrating actual Playwright scraping:

```javascript
async function scrapeLiveChat() {
  const playwright = require('playwright');
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to DoradoBet
    await page.goto('https://doradobet.com/deportes');

    // Wait for chat to load
    await page.waitForSelector('[data-testid="chat-messages"]', { timeout: 10000 });

    // Extract last 500 messages
    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid="chat-message"]'))
        .slice(-500)
        .map(el => ({
          user: el.querySelector('[data-testid="username"]')?.textContent,
          message: el.querySelector('[data-testid="message-text"]')?.textContent,
          timestamp: el.getAttribute('data-timestamp')
        }));
    });

    return messages;
  } finally {
    await browser.close();
  }
}
```

---

## Troubleshooting

### Issue: "Empty parlays, all messages skipped"
**Cause:** Regex patterns not matching chat format  
**Fix:** Adjust `parseParlay()` patterns if DoradoBet chat format changes

### Issue: "Database entries not persisting"
**Cause:** zak_intel table not created  
**Fix:** Run migrations: `node api/migrate.js`

### Issue: "Sentiment analysis always 'neutral'"
**Cause:** Spanish keywords not matching (case sensitivity, typos)  
**Fix:** Add more keywords to positive/negative lists or debug message text

### Issue: "Cache fallback stuck on old data"
**Cause:** Cache 30-min window hasn't expired  
**Fix:** Wait 30 minutes or manually delete old entries

---

## Success Criteria

✅ Endpoint returns valid JSON with community_analysis  
✅ Sentiment analysis shows mixed positive/negative/neutral distribution  
✅ At least 10+ unique parlays detected from 500 messages  
✅ Arbitrage opportunities identified when odds differ >5%  
✅ Data persists to zak_intel table with proper structure  
✅ Cache fallback works when scraping fails  
✅ Cron runs every 5 minutes without errors  
✅ No crashes on unparseable messages (graceful skip)  

---

## Next Steps

1. **Integrate Real Playwright Scraping** → Replace `generateSimulatedChatMessages()` with `scrapeLiveChat()`
2. **Add Redis Caching** → Cache chat messages to reduce DoradoBet requests
3. **Trending Detection** → Compare frequency changes across 5-min windows
4. **Machine Learning Sentiment** → Replace keyword matching with ML model
5. **Real-Time WebSocket** → Stream updates instead of 5-min polling
6. **Odds API Integration** → Replace mock odds with real betting market data
