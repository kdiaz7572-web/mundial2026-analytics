# FerXxxa Intel Endpoint Setup Guide

## Overview
The FerXxxa Intel endpoint monitors the DoradoBet chat every 3 hours and extracts:
- Bet predictions and frequency analysis
- Odds movement tracking
- Injury alerts and player status
- Sentiment analysis of chat messages
- Trending narratives among betting community

## Files Created
- `api/ferxxxa-intel.js` - Main endpoint handler

## Implementation Status

### Current (MVP)
- Endpoint fully functional with realistic data simulation
- Database integration complete (stores in `zak_intel` table)
- Error handling with cache fallback (up to 6 hours old)
- CRON_SECRET authentication
- Ready for manual testing

### What's Needed for Production (Agent 3)
- Actual web scraping integration (Firecrawl or Cheerio)
- Update `vercel.json` to enable 3-hour cron schedule
- Integration with IA-Zak for intelligence consumption

## How It Works

### 1. Data Extraction (Simulated for MVP)
```javascript
// Current: Generates realistic simulated data
// Future: Will use Firecrawl to scrape https://doradobet.com/deportes/
```

The endpoint extracts:
- **Predictions**: Counts user bets (1x2, Over/Under, BTTS, etc.)
- **Odds Movement**: Tracks changes vs 3 hours ago
- **Injuries**: Parses mentions of player injuries/status
- **Sentiment**: Analyzes positive/negative/neutral message ratio
- **Narratives**: Identifies trending discussion topics

### 2. Database Storage
All data is persisted to `zak_intel` table:
```sql
INSERT INTO zak_intel (topic, content, summary_json, studied_at)
VALUES (
  'ferxxxa_intel',
  'DoradoBet chat analysis: 147 messages, 52 positive',
  {full_json_object},
  NOW()
)
```

### 3. Error Handling & Fallback
- If scraping fails: Uses cached data (max 6 hours old)
- If no cache: Returns safe fallback with empty arrays
- Database errors don't prevent data return
- Always returns valid JSON structure

## API Endpoint

### URL
```
GET /api/ferxxxa-intel
```

### Authentication
```
Header: Authorization: Bearer {CRON_SECRET}
```

### Response Structure
```json
{
  "success": true,
  "timestamp": "2026-05-23T10:30:00Z",
  "source": "doradobet_live|cache_or_fallback",
  "data_persisted": true,
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 147,
      "predictions": [
        {
          "bet_type": "1x2",
          "prediction": "home_win",
          "frequency": 42,
          "percentage": 28.6
        },
        {
          "bet_type": "Over/Under",
          "prediction": "over_2.5",
          "frequency": 68,
          "percentage": 46.3
        }
      ]
    },
    "odds_movement": {
      "home_win": {
        "3h_ago": 1.95,
        "current": 1.90,
        "change": -0.05,
        "direction": "down"
      },
      "away_win": {
        "3h_ago": 2.10,
        "current": 2.15,
        "change": 0.05,
        "direction": "up"
      }
    },
    "injury_alerts": [
      {
        "player": "Mbappé",
        "status": "reported_out",
        "confidence": "high",
        "mentions": 12
      }
    ],
    "sentiment_analysis": {
      "positive_messages": 52,
      "negative_messages": 38,
      "neutral_messages": 57,
      "overall_sentiment": "neutral"
    },
    "trending_narratives": [
      "Argentina strong form after Copa América win",
      "France's depth concerns due to injuries",
      "Over 2.5 offers good value at these odds"
    ]
  }
}
```

## Manual Testing

### Test locally
```bash
# In development (no auth required)
curl http://localhost:3000/api/ferxxxa-intel

# Response should show realistic simulated data
```

### Test with CRON_SECRET (production-like)
```bash
export CRON_SECRET="your-secret-here"
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://mundial2026-analytics.vercel.app/api/ferxxxa-intel
```

### Check database storage
```sql
SELECT * FROM zak_intel WHERE topic = 'ferxxxa_intel' 
ORDER BY studied_at DESC LIMIT 1;
```

## Adding to vercel.json (Agent 3 Task)

### Current vercel.json
```json
{
  "version": 2,
  "crons": [
    {
      "path": "/api/learn",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### To add FerXxxa (DO NOT DO THIS YET - Agent 3 will do it)
```json
{
  "version": 2,
  "crons": [
    {
      "path": "/api/learn",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/ferxxxa-intel",
      "schedule": "0 */3 * * *"
    }
  ]
}
```

**Cron Schedule Explained**:
- `0 */3 * * *` = Every 3 hours at minute 0
- Runs at: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC

## Integration with IA-Zak (Agent 3 Task)

The endpoint data should be consumed by IA-Zak as follows:

### In chat.js or similar
```javascript
// Fetch latest FerXxxa intel
const ferxxxaData = await fetch(
  `${BASE_URL}/api/ferxxxa-intel`,
  {
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  }
).then(r => r.json());

// Use in analysis context
const context = `
Betting Market Intel:
- Top predictions: ${ferxxxaData.ferxxxa_intel.match_predictions.predictions[0]?.bet_type}
- Chat sentiment: ${ferxxxaData.ferxxxa_intel.sentiment_analysis.overall_sentiment}
- Odds moving: ${Object.entries(ferxxxaData.ferxxxa_intel.odds_movement)
  .map(([k,v]) => k + ' ' + v.direction)
  .join(', ')}
- Injuries: ${ferxxxaData.ferxxxa_intel.injury_alerts.map(i => i.player).join(', ')}
`;
```

## Data Source: DoradoBet Chat

### What We're Monitoring
- URL: `https://doradobet.com/deportes/` (and match-specific pages)
- Element: Live chat during matches
- Frequency: Every 3 hours
- Data Type: User predictions, injury discussions, odds reactions

### Scraping Strategy (To Be Implemented)

**Option A: Firecrawl (Recommended)**
```javascript
import { firecrawl_scrape } from '@firecrawl/mcp';

const response = await firecrawl_scrape(
  'https://doradobet.com/deportes/partidos',
  {
    formats: ['markdown'],
    onlyMainContent: true
  }
);
```

**Option B: Cheerio + Fetch (Alternative)**
```javascript
import * as cheerio from 'cheerio';

const response = await fetch('https://doradobet.com/deportes/');
const html = await response.text();
const $ = cheerio.load(html);

// Parse chat messages
const messages = $('.chat-message').map((i, el) => 
  $(el).text()
).get();
```

**Option C: Puppeteer (Heavy but Dynamic)**
```javascript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://doradobet.com/deportes/');
// Wait for chat to load
await page.waitForSelector('.chat-message');
// Extract...
```

## Key Features

### 1. Smart Caching
- Caches successful scrapes for 6 hours
- Falls back gracefully if DoradoBet is down
- Never returns null - always has fallback data

### 2. Authentication
- Validates CRON_SECRET header
- Bypasses auth in development mode
- Production requests must include bearer token

### 3. Data Quality
- Frequency percentages calculated from counts
- Multiple prediction types tracked
- Confidence levels on injury reports
- Sentiment breakdown into 3 categories

### 4. Error Resilience
- Scraping failures don't crash endpoint
- Database errors logged but don't prevent response
- Always returns valid JSON structure
- Errors return 5xx but with fallback data

## Monitoring & Debugging

### Check logs in Vercel
```bash
vercel logs api/ferxxxa-intel
```

### Database query to see all stored intel
```sql
SELECT topic, content, studied_at, summary_json 
FROM zak_intel 
WHERE topic LIKE 'ferxxxa%'
ORDER BY studied_at DESC 
LIMIT 10;
```

### Expected data freshness
- Fresh data: <3 hours old (from live scraping)
- Stale but usable: 3-6 hours old (from cache)
- Too old: >6 hours (fallback instead)

## Next Steps (Agent 3)

1. **Enable Cron Job**: Add to vercel.json and deploy
2. **Replace Scraping**: Implement actual DoradoBet chat parsing
3. **Integrate with Zak**: Wire intel into chat context
4. **Monitor Quality**: Track accuracy of predictions vs actual match results

## Troubleshooting

### 401 Unauthorized
- Check CRON_SECRET is set in Vercel environment variables
- In development, should work without auth

### Empty predictions
- Endpoint is in MVP mode with simulated data
- Real data will appear after scraping implementation

### Stale data repeatedly
- DoradoBet might be down
- Check internet connectivity
- Verify scraping endpoint is accessible

### Database full
- `zak_intel` table stores indefinitely
- Consider archiving old records periodically
- Query: `DELETE FROM zak_intel WHERE topic = 'ferxxxa_intel' AND studied_at < NOW() - INTERVAL '30 days'`

## Environment Variables Required

In Vercel settings:
```
CRON_SECRET = "your-secure-random-string"
DATABASE_URL = "postgresql://..." (already configured)
NODE_ENV = "production"
```

In local .env.local (development):
```
CRON_SECRET = "test-secret"
DATABASE_URL = "postgresql://..."
```

## Files to Review

- `api/ferxxxa-intel.js` - This endpoint
- `api/_db.js` - Database helper (zak_intel table definition)
- `vercel.json` - Cron configuration
- `api/chat.js` - Where to integrate the intel (Agent 3)

---

**Created for Agent 2: FerXxxa Monitor**
**Status**: Endpoint complete and functional
**Next**: Agent 3 will deploy and integrate with IA-Zak
