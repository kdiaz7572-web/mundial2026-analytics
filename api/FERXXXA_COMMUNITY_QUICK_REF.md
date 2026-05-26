# FerXxxa Community Intelligence - Quick Reference

## What It Does

Analyzes DoradoBet betting room chat to:
- Detect community betting trends (parlays)
- Measure sentiment (positive/negative/neutral)
- Identify arbitrage opportunities
- Find market correlations from user behavior

## Architecture

```
Input: Raw chat messages from DoradoBet
  ↓
[scrapeDoradoBetChat] → 500 messages (simulated or real Playwright)
  ↓
[analyzeChat] → Parse parlays, sentiment, frequency
  ↓
[enrichWithRealOdds] → Compare community vs market odds
  ↓
[detectArbitrage] → Find >5% odds discrepancies
  ↓
Output: Stored in zak_intel table + returned as JSON
```

## Key Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `handler()` | Main API endpoint | req/res | JSON response + DB save |
| `scrapeDoradoBetChat()` | Gets chat messages | - | Array of {user, message, timestamp} |
| `analyzeChat()` | Parses messages | Array of messages | Analysis object with parlays & sentiment |
| `parseParlay()` | Regex parlay detection | String | {parlay_name, events, odds} |
| `detectMarkets()` | Keyword-based markets | String | Array of market strings |
| `detectSentiment()` | Spanish keywords | String | "positive" / "negative" / "neutral" |
| `extractOdds()` | Regex odds parsing | String | Number or null |
| `enrichWithRealOdds()` | Add market odds | Analysis object | Modified object with real_odds |
| `detectArbitrage()` | Find opportunities | Array of parlays | Array of arbitrage objects |
| `calculateCorrelations()` | Market co-mentions | Map of parlays | Object {pair: correlation} |

## Parlay Detection Patterns

### Pattern 1: Explicit Format
```
"Parlay: Home Win, Over 2.5, BTTS"
"Triple: 1x2 Local, Over 3.5, Gol Ambos"
"Combinada: Local Gana, +2.5, Tarjetas < 5"
```

### Pattern 2: Plus Notation
```
"Home Win + Over 2.5 + BTTS"
"Paderborn Win + Over 2.5"
"Over 2.5 + BTTS + Menos de 6 tarjetas"
```

### Pattern 3: Market Keywords
```
"Voy Over 2.5"
"BTTS en este partido"
"Gana local + suma goles"
```

### Pattern 4: Player-Specific
```
"Filip Bilbija gol + BTTS"
"Lewandowski anota + Over 2.5"
```

## Sentiment Keywords (Spanish)

**POSITIVE:** ganador, excelente, segura, lleva, vamos, dale, ✓, 🔥, 🚀, profeta, maestro, seguro, rentable

**NEGATIVE:** mala, pérdida, fracaso, error, no va, imposible, contra, riesgo, desastre

**NEUTRAL:** voy, apostar, odds, cuota

## Market Dictionary

| Keyword | Market |
|---------|--------|
| over 2.5 | over_2_5_goals |
| over 3.5 | over_3_5_goals |
| under 2.5 | under_2_5_goals |
| home/local/1 | home_win |
| draw/x/empate | draw |
| away/visitante/2 | away_win |
| btts/ambos marcan | btts_yes |
| no btts | btts_no |
| < 5 tarjetas | under_5_cards |
| [Player] gol | {player}_goal |

## API Response Structure

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
      "over_2_5_goals_btts_yes": 0.75
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

## Database Storage

**Table:** `zak_intel`

```sql
INSERT INTO zak_intel (topic, content, summary_json, studied_at)
VALUES (
  'ferxxxa_community',
  'Community betting analysis: 500 messages, 156 analyzed, 8 unique parlays',
  {summary_json as JSONB},
  NOW()
);
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Chat unavailable | Returns empty analysis (not error) |
| Parse fails on message | Skips message, continues |
| DB save fails | Returns analysis anyway, `data_persisted: false` |
| All chat fails | Uses cache if < 30 min old |
| No cache available | Returns empty analysis |
| Invalid CRON_SECRET | Returns 401 Unauthorized |

## Testing Checklist

- [ ] Local test with simulated messages
- [ ] Sentiment detection: positive/negative/neutral
- [ ] Parlay parsing: 4+ different patterns
- [ ] Odds extraction from text
- [ ] Arbitrage detection >5% difference
- [ ] Database persistence to zak_intel
- [ ] Cache fallback on failure
- [ ] Cron execution every 5 minutes
- [ ] No crashes on bad input

## Real-World Integration (Phase 2)

### Replace Simulation with Playwright
```javascript
// Current:
messages = generateSimulatedChatMessages();

// Future:
messages = await scrapeLiveChat(); // Uses Playwright
```

### Install Playwright
```bash
npm install --save-dev playwright
```

### Expected Playwright Implementation
1. Launch browser
2. Navigate to doradobet.com
3. Wait for chat to load
4. Extract last 500 messages
5. Close browser
6. Return array of {user, message, timestamp}

## Performance

- **Simulation mode:** 100ms end-to-end
- **Real scraping:** 5-30 seconds (depends on DoradoBet response)
- **Parsing 500 messages:** ~2 seconds
- **Database insert:** ~500ms
- **Total cron cycle:** Target <2 minutes

## Database Queries

Latest analysis:
```sql
SELECT topic, content, studied_at, 
       summary_json->'community_parlays' as parlays
FROM zak_intel
WHERE topic = 'ferxxxa_community'
ORDER BY studied_at DESC
LIMIT 1;
```

Top parlays in last 24h:
```sql
SELECT p->>'parlay_name' as parlay,
       (p->>'frequency')::int as frequency
FROM zak_intel,
  jsonb_array_elements(summary_json->'community_parlays') as p
WHERE topic = 'ferxxxa_community'
  AND studied_at > NOW() - INTERVAL '24 hours'
ORDER BY frequency DESC;
```

## Troubleshooting

**Parlays not detected?**
- Check message format against regex patterns
- Add more keywords to `detectMarkets()`
- Enable logging in chat parsing

**Sentiment always neutral?**
- Spanish keywords might not match
- Check for typos in message text
- Add more keywords to sentiment lists

**No database entries?**
- Verify zak_intel table exists (run migrate.js)
- Check DATABASE_URL is set
- Look for console error messages

**Cache stuck on old data?**
- 30-minute cache window hasn't expired
- Or clear old entries manually
- Query: `DELETE FROM zak_intel WHERE topic='ferxxxa_community' AND studied_at < NOW() - INTERVAL '1 hour';`

## Next Iterations

1. **Add trending detection** - Compare 5-min windows
2. **Machine learning sentiment** - Replace keywords
3. **Real-time WebSocket** - Instead of 5-min polling
4. **Player prediction correlation** - Which players drive BTTS?
5. **Odds momentum** - Track odds changes during chat surge
6. **Risk scoring** - Assess consensus bet reliability
