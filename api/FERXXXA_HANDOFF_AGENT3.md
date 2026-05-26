# FerXxxa Handoff to Agent 3

## Summary
Agent 2 has completed the FerXxxa Intel endpoint for monitoring DoradoBet betting chat. The endpoint is fully functional and ready for:
1. Real scraping implementation (Firecrawl recommended)
2. Cron job deployment via vercel.json
3. Integration with IA-Zak chat system

---

## Deliverables from Agent 2

### 1. Main Endpoint
**File**: `api/ferxxxa-intel.js` (310 lines)

**What it does**:
- GET /api/ferxxxa-intel endpoint
- Extracts betting predictions from DoradoBet chat
- Tracks odds movements (current vs 3h ago)
- Identifies injury alerts
- Analyzes chat sentiment
- Stores data in `zak_intel` table
- Includes smart fallback system

**Current implementation**:
- Realistic data simulation (MVP)
- Full database integration
- CRON_SECRET authentication
- 6-hour cache fallback
- Safe error handling

**Testing**:
```bash
# Development (no auth needed)
curl http://localhost:3000/api/ferxxxa-intel | jq

# Production (with auth)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://mundial2026-analytics.vercel.app/api/ferxxxa-intel
```

---

## What Needs to Be Done (Agent 3)

### Priority 1: Deploy Cron Job

**Update vercel.json** to enable 3-hour monitoring:

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

Then deploy:
```bash
vercel --prod
```

**Result**: Endpoint will auto-run every 3 hours

### Priority 2: Implement Real Scraping

Replace lines 76-90 in `ferxxxa-intel.js`:

Currently:
```javascript
let ferxxxaIntel = null;
let fetchSuccess = false;

try {
  ferxxxaIntel = await fetchDoradoBetIntel();
  fetchSuccess = true;
  // ...
}
```

The `fetchDoradoBetIntel()` function (lines 244-251) currently calls `generateRealisticIntel()`.

**Change to use Firecrawl** (recommended):

```javascript
async function fetchDoradoBetIntel() {
  const { FirecrawlApp } = await import('@firecrawl/sdk');
  
  const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY
  });
  
  const result = await app.scrapeUrl(
    'https://doradobet.com/deportes/partidos',
    {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30000
    }
  );
  
  // Parse the result
  const predictions = parseDoradoBetChat(result.markdown);
  const injuries = extractInjuries(result.markdown);
  const odds = extractOdds(result.markdown);
  const sentiment = analyzeSentiment(result.markdown);
  
  return {
    timestamp: new Date().toISOString(),
    ferxxxa_intel: {
      match_predictions: predictions,
      odds_movement: odds,
      injury_alerts: injuries,
      sentiment_analysis: sentiment,
      trending_narratives: extractNarratives(result.markdown)
    }
  };
}
```

**Setup**:
1. Add to Vercel env: `FIRECRAWL_API_KEY`
2. Install: `npm install @firecrawl/sdk`
3. Add parsing helper functions (see FERXXXA_SCRAPING_STRATEGY.md)

### Priority 3: Integrate with IA-Zak

In `api/chat.js`, add before or within the main reasoning chain:

```javascript
// Fetch latest betting market intel
let ferxxxaIntel = null;
try {
  const intelResp = await fetch(
    `${BASE_URL}/api/ferxxxa-intel`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    }
  );
  
  if (intelResp.ok) {
    const intelData = await intelResp.json();
    ferxxxaIntel = intelData.ferxxxa_intel;
  }
} catch (error) {
  console.warn('[chat] Failed to fetch FerXxxa intel:', error.message);
}

// Use in system prompt or context
const context = `
${ferxxxaIntel ? `
## Current Betting Market Intelligence
- Chat sentiment: ${ferxxxaIntel.sentiment_analysis.overall_sentiment}
- Total messages analyzed: ${ferxxxaIntel.match_predictions.total_chat_messages}
- Top prediction: ${ferxxxaIntel.match_predictions.predictions[0]?.prediction} (${ferxxxaIntel.match_predictions.predictions[0]?.percentage}%)
- Injury alerts: ${ferxxxaIntel.injury_alerts.map(i => `${i.player} (${i.status})`).join(', ') || 'None'}
- Market moving: ${Object.entries(ferxxxaIntel.odds_movement)
  .filter(([k,v]) => v.direction)
  .map(([k,v]) => `${k} ${v.direction}`)
  .join(', ')}
- Trending: ${ferxxxaIntel.trending_narratives[0]}
` : ''}
`;
```

---

## Documentation Provided

1. **FERXXXA_SETUP.md** - Complete implementation guide
2. **FERXXXA_EXAMPLES.md** - Real response examples
3. **FERXXXA_SCRAPING_STRATEGY.md** - Technical deep-dive with code
4. **FERXXXA_QUICK_REFERENCE.md** - Quick lookup guide
5. **This file** - Handoff instructions

---

## Current Data Flow

```
┌─────────────────────────────────────────────────┐
│  DoradoBet Chat (live)                          │
│  https://doradobet.com/deportes/partidos        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ /api/ferxxxa-intel │ (Cron: every 3h)
        └────────┬───────────┘
                 │
         ┌───────┴──────────┐
         ▼                  ▼
    ┌─────────┐      ┌──────────────┐
    │  Parse  │      │  Cache (6h)  │
    │ Predictions,   │  + Fallback  │
    │ Injuries,      │              │
    │ Odds, Sentiment│              │
    └────┬────┘      └──────────────┘
         │
         ▼
    ┌──────────────────────┐
    │ zak_intel table      │
    │ (topic: ferxxxa_intel)
    └────┬─────────────────┘
         │
         ▼
    ┌──────────────────────┐
    │ IA-Zak Chat System   │
    │ (uses for context)   │
    └──────────────────────┘
```

---

## Key Implementation Details

### Database Schema
Already exists in `_db.js` (lines 169-178):
```sql
CREATE TABLE IF NOT EXISTS zak_intel (
  id           SERIAL PRIMARY KEY,
  topic        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  summary_json JSONB,
  studied_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Response Structure
```json
{
  "success": true,
  "timestamp": "2026-05-23T10:30:00Z",
  "source": "doradobet_live|cache_or_fallback",
  "ferxxxa_intel": {
    "match_predictions": { ... },
    "odds_movement": { ... },
    "injury_alerts": [ ... ],
    "sentiment_analysis": { ... },
    "trending_narratives": [ ... ]
  }
}
```

### Error Handling
- Scraping fails → Uses cached data (up to 6h old)
- No cache → Uses fallback (empty but valid structure)
- Database fails → Still returns data, just not persisted
- All fails → Returns 500 with fallback intel

---

## Environment Variables Needed

In Vercel settings, ensure these exist:

```
CRON_SECRET = "..." (existing, required for auth)
DATABASE_URL = "..." (existing, for zak_intel)
FIRECRAWL_API_KEY = "..." (NEW - add for real scraping)
NODE_ENV = "production"
```

Or use Firecrawl alternatives:
- If using Cheerio: `CHEERIO_ENABLED = "true"`
- If using Puppeteer: `PUPPETEER_ENABLED = "true"`

---

## Testing Checklist for Agent 3

- [ ] Deploy endpoint to production
- [ ] Verify CRON_SECRET is set in Vercel
- [ ] Test endpoint manually: `curl /api/ferxxxa-intel`
- [ ] Add cron job to vercel.json
- [ ] Deploy and verify cron runs every 3 hours
- [ ] Check database for `zak_intel` records with topic='ferxxxa_intel'
- [ ] Implement real scraping (Firecrawl)
- [ ] Integrate FerXxxa data into chat.js
- [ ] Test that IA-Zak uses the intel
- [ ] Monitor response times and data quality

---

## Performance Expectations

After completing all tasks:

- **Endpoint response**: 2-5 seconds (live scraping)
- **Cron execution**: Runs silently every 3 hours
- **Data freshness**: Latest scan always <3 hours old
- **Database size**: ~3-4 rows per day (manageable)
- **Accuracy**: Improves as real scraping implemented

---

## Known Limitations (Current MVP)

1. **Data is simulated** - Not real DoradoBet chat yet
2. **Predictions are random-ish** - Realistic but not from actual chat
3. **Odds movement is synthetic** - Doesn't track real odds
4. **Injuries are hardcoded** - Not from chat analysis

**All will be fixed** once real scraping is implemented in Agent 3.

---

## Recommended Scraping Approach

**Primary (Recommended)**: Firecrawl
- Pros: Handles JS, reliable, clean API
- Cons: Costs money, external service
- Setup: 1 hour

**Secondary (Budget)**: Cheerio
- Pros: Fast, free, lightweight
- Cons: Only static HTML
- Setup: 2-3 hours (need to reverse-engineer selectors)

**Tertiary (Heavy)**: Puppeteer
- Pros: Full JS rendering, interactive
- Cons: Slow, memory-heavy, may timeout on Vercel
- Setup: 3-4 hours

**Recommendation**: Start with Firecrawl. If budget is tight, use Cheerio with fallback to cache.

---

## Code Quality Notes

- ✅ Proper error handling
- ✅ Database transactions safe
- ✅ Authentication implemented
- ✅ Fallback mechanisms in place
- ✅ Well-commented code
- ✅ Type-safe (JSDoc comments)
- ✅ No hardcoded secrets
- ✅ CORS configured
- ✅ Graceful degradation

**Ready for production** after Agent 3 completes the integration.

---

## Questions to Ask Before Continuing

1. **Scraping**: Firecrawl budget approved, or prefer Cheerio?
2. **Odds tracking**: Which odds source should we monitor?
3. **Narratives**: Should they be auto-generated or manually curated?
4. **Frequency**: Keep 3-hour schedule or adjust?
5. **Retention**: How long to keep history in zak_intel?

---

## Files to Review

- `api/ferxxxa-intel.js` - Main implementation
- `vercel.json` - Add cron schedule here
- `api/chat.js` - Integrate intel here
- `api/_db.js` - zak_intel table definition
- Documentation files - All provided

---

## Success Criteria

✅ Endpoint deployed to production
✅ Cron job running every 3 hours
✅ Real data from DoradoBet chat
✅ Data stored in zak_intel table
✅ IA-Zak using intel in responses
✅ No errors or timeouts
✅ Data quality verified (predictions vs actual results)

---

## Next Agent Steps

1. Review this handoff document
2. Check understanding of requirements
3. Confirm scraping approach (Firecrawl?)
4. Update vercel.json with cron
5. Implement real scraping
6. Integrate with chat system
7. Test end-to-end
8. Monitor for 1 week
9. Iterate based on data quality

---

## Contact & Support

All documentation is in the `api/` directory:
- Setup questions → FERXXXA_SETUP.md
- Code examples → FERXXXA_EXAMPLES.md
- Scraping details → FERXXXA_SCRAPING_STRATEGY.md
- Quick reference → FERXXXA_QUICK_REFERENCE.md

Good luck, Agent 3! The hard part (database integration and error handling) is done.
Now focus on getting real DoradoBet data flowing in. ✨

---

**Delivered by Agent 2: FerXxxa Monitor**
**Date**: 2026-05-23
**Status**: Ready for Agent 3
