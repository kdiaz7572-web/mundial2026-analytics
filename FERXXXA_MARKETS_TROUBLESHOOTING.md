# FerXxxa Markets Scraper - Troubleshooting Guide

## Quick Diagnostics

### Step 1: Check if endpoint is responding

```bash
curl -i https://your-domain.vercel.app/api/ferxxxa-markets \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Expected**: HTTP 200 with markets data
**Problem**: HTTP 401, 404, or 500? Continue below.

### Step 2: Check cron is registered

```bash
vercel crons list
```

**Expected**:
```
/api/ferxxxa-markets  ✅  */5 * * * *  (every 5 min)
```

**Problem**: Not listed? Run `vercel link` and redeploy.

### Step 3: Check production logs

```bash
vercel logs --follow api/ferxxxa-markets
```

**Look for**:
- ✅ `[ferxxxa-markets] Successfully scraped DoradoBet markets` → Working
- ✓ `Using cached data from...` → Fallback (but running)
- ⚠️ `Failed to scrape DoradoBet:` → Issue found, see below
- ❌ No logs → Cron not firing or code error

---

## Common Issues & Solutions

### Issue: "Unauthorized" (401)

**Problem**: `CRON_SECRET` header invalid

**Solution**:
```bash
# Verify env var is set
vercel env list

# Should show CRON_SECRET

# If missing:
vercel env add CRON_SECRET

# Generate secure value:
openssl rand -hex 32
```

### Issue: "Method not allowed" (405)

**Problem**: Request method is not GET

**Solution**: 
```bash
# WRONG - POST request
curl -X POST https://your-domain.vercel.app/api/ferxxxa-markets

# CORRECT - GET request
curl -X GET https://your-domain.vercel.app/api/ferxxxa-markets
```

### Issue: "No live matches found"

**Problem**: DoradoBet page structure changed or no live matches running

**Solution 1: Verify DoradoBet has live matches**
- Go to https://doradobet.com manually
- Check if there are live matches displayed
- If no matches: Wait for live matches to start

**Solution 2: Update selectors**
```javascript
// In extractAllMarkets(), line ~320
// Right-click on DoradoBet page → Inspect
// Find live match element
// Update selector in firstMatch query:

const firstMatch = await page.$(
  '.live-match, [data-qa="live-match"], .match-card'
  // Add correct selector here based on inspection
);
```

**Solution 3: Enable debug logging**
```javascript
// Add before market extraction
const html = await page.content();
console.log('[DEBUG] Page HTML length:', html.length);
console.log('[DEBUG] Looking for matches...');
```

### Issue: "Login fails"

**Problem**: Username/password incorrect or DoradoBet requires 2FA

**Solution 1: Verify credentials**
```bash
# Test credentials manually
# Go to https://doradobet.com
# Log in manually with DORADOBET_USER and DORADOBET_PASS
# If fails here, fix credentials
```

**Solution 2: Check env vars**
```bash
vercel env list
# Should show:
# DORADOBET_USER ***
# DORADOBET_PASS ***
```

**Solution 3: If 2FA enabled**
- DoradoBet may require 2FA code
- Need to either:
  1. Disable 2FA on the scraper account
  2. Use API tokens instead (if available)
  3. Use headless browser detection bypass

```javascript
// Add to page context
await page.addInitScript(() => {
  // Hide headless indicators
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
  });
});
```

### Issue: "markets_count: 0"

**Problem**: Market extraction parsing failed

**Solution 1: Check market selectors match DoradoBet**
```bash
# Right-click on DoradoBet match page → Inspect Element
# Look for market sections - what class/data-attribute do they have?
# Update marketConfigs in extractAllMarkets()
```

**Solution 2: Enable logging**
```javascript
// Add after market extraction
console.log('[DEBUG] Markets found:', Object.keys(markets));
console.log('[DEBUG] First market data:', JSON.stringify(markets[Object.keys(markets)[0]]));
```

**Solution 3: Try generic fallback**
```javascript
// In extractAllMarkets(), near end
if (Object.keys(markets).length === 0) {
  console.log('[DEBUG] No markets via selectors, trying generic...');
  const allElements = await page.$$('.market, .odd, .selection');
  console.log('[DEBUG] Found', allElements.length, 'market-like elements');
}
```

### Issue: Timeout (>30 seconds)

**Problem**: Browser launching or DoradoBet responding slowly

**Solution 1: Check DoradoBet uptime**
- Is doradobet.com accessible?
- Try in your browser
- Check if site is under maintenance

**Solution 2: Increase timeout**
```javascript
// In scrapeDoradoBetMarkets(), line ~190
browser = await playwright.chromium.launch({
  headless: true,
  timeout: 40000  // Increased from 30000
});

page.setDefaultTimeout(25000);  // Increased from 20000
```

**Solution 3: Check network**
```bash
# From Vercel function:
vercel logs --follow
# Look for network errors in logs
```

**Solution 4: Reduce browser overhead**
```javascript
// Use minimal browser context
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  // Disable images to speed up loading
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

// Or skip image loading
await page.route('**/*.{png,jpg,jpeg,gif,svg}', route => route.abort());
```

### Issue: Database insert fails

**Problem**: Connection to Neon database failed

**Solution 1: Verify DATABASE_URL**
```bash
vercel env list
# Should show: DATABASE_URL (with neon.tech domain)

# If missing:
vercel env add DATABASE_URL
# Paste connection string from Neon dashboard
```

**Solution 2: Check Neon database status**
- Go to Neon console: https://console.neon.tech
- Check if database is running
- Check connection count (may hit limit)

**Solution 3: Test query locally**
```bash
npm install pg
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(() => console.log('✅ Connected')).catch(e => console.log('❌', e.message));
"
```

**Solution 4: Check zak_intel table exists**
```bash
# Connect to Neon from psql
psql $DATABASE_URL
# Then:
\dt zak_intel
# Should show the table schema
```

### Issue: Cached data is too old (>1 hour)

**Problem**: Scraping has been failing for >1 hour

**Cause**: 
- DoradoBet site is down?
- Login credentials wrong?
- Market selectors don't match anymore?

**Solution**: Investigate root cause
```bash
# Check recent logs
vercel logs --follow api/ferxxxa-markets

# Look for error pattern from past 2 hours
# All failures? → DoradoBet issue
# Some succeed? → Intermittent problem

# Query when last successful scrape was:
psql $DATABASE_URL
SELECT MAX(studied_at), 
       MIN(studied_at)
FROM zak_intel
WHERE topic = 'ferxxxa_markets';

# If last one is >1h old:
SELECT * FROM zak_intel
WHERE topic = 'ferxxxa_markets'
ORDER BY studied_at DESC
LIMIT 5;
```

---

## Performance Issues

### Problem: Slow scraping (>15 seconds)

**Solution 1: Remove unnecessary waits**
```javascript
// BAD - waits for all network traffic
await page.waitForNavigation({ waitUntil: 'networkidle' });

// BETTER - waits for DOM load
await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

// BEST - wait for specific element
await page.waitForSelector('[data-market="1x2"]', { timeout: 5000 });
```

**Solution 2: Parallel market extraction**
```javascript
// Instead of extracting markets sequentially:
const markets = await Promise.all(
  marketConfigs.map(config => extractMarketType(page, config))
);

// Extracts all markets in parallel (faster)
```

**Solution 3: Cache aggressively**
```javascript
// Increase cache duration (if data staleness acceptable)
WHERE studied_at > NOW() - INTERVAL '2 hours'  // Was 1 hour
```

### Problem: High memory usage

**Solution 1: Close browser context**
```javascript
// Ensure cleanup happens
finally {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
}
```

**Solution 2: Limit browser instances**
```javascript
// Create single browser, reuse context
// Don't launch new browser per extraction
```

**Solution 3: Monitor memory**
```bash
# In Vercel logs
# Look for memory usage pattern
vercel logs --follow
# See if memory increases over time (leak?)
```

---

## Data Quality Issues

### Problem: Some markets missing

**Cause**: DoradoBet changed HTML structure for that market type

**Solution**:
```javascript
// In extractAllMarkets(), add market-specific logging:
if (!markets[config.key]) {
  console.warn(`[MISSING] ${config.key} - tried selectors:`, config.selectors);
  // Try alternative selector
  const alt = await page.$('[aria-label*="' + config.key + '"]');
  if (alt) {
    console.log(`[FOUND] Using alternative selector for ${config.key}`);
  }
}
```

### Problem: Odds seem unrealistic

**Cause**: Parsing error or different format

**Solution**:
```javascript
// Check odds value parsing
const oddValue = elem.querySelector('.price')?.innerText;
console.log('[DEBUG] Raw odd value:', oddValue);
// Might be "1.50 EUR" or "1,50" (European format)
// Parse accordingly:
const parsed = parseFloat(oddValue.replace(/[^\d.]/g, ''));
```

### Problem: Duplicate markets

**Cause**: Market appears in multiple selectors

**Solution**:
```javascript
// Deduplicate by market name
const deduped = {};
for (const [key, markets] of Object.entries(rawMarkets)) {
  const seen = new Set();
  markets = markets.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}
```

---

## Monitoring & Alerting

### Check success rate (last 24h)

```sql
SELECT 
  COUNT(*) as total_runs,
  COUNT(CASE WHEN (summary_json->>'total_markets_found')::int > 60 THEN 1 END) as successful,
  ROUND(100.0 * COUNT(CASE WHEN (summary_json->>'total_markets_found')::int > 60 THEN 1 END) / COUNT(*), 2) as success_pct
FROM zak_intel
WHERE topic = 'ferxxxa_markets'
AND studied_at > NOW() - INTERVAL '24 hours';

-- Expected: success_pct >= 95%
-- Alert if < 90%
```

### Check data freshness

```sql
SELECT 
  MAX(studied_at) as latest_extraction,
  NOW() - MAX(studied_at) as age,
  ROUND((summary_json->'data_quality'->>'odds_freshness_seconds')::float, 1) as fresh_sec
FROM zak_intel
WHERE topic = 'ferxxxa_markets'
GROUP BY topic;

-- Age should be < 5 minutes
-- Fresh_sec should be < 10 seconds
```

### Set up alerts

**Vercel Email Alerts**:
- Go to Project Settings → Functions
- Set error threshold (>5 errors/hour)

**Custom Monitoring**:
```javascript
// In a separate endpoint or scheduled task:
const result = await db`
  SELECT MAX(studied_at) as latest
  FROM zak_intel
  WHERE topic = 'ferxxxa_markets'
`;

const age_minutes = (Date.now() - new Date(result[0].latest)) / 60000;
if (age_minutes > 10) {
  // Alert: Scraper hasn't run in >10 minutes
  console.error('ALERT: Market scraper stale');
  // Send Slack/email
}
```

---

## Recovery Procedures

### Manual Trigger

```bash
# Force immediate run (don't wait 5 minutes)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/ferxxxa-markets
```

### Clear Cache & Reset

```bash
# Delete old cache entries (more than 2 hours old)
DELETE FROM zak_intel
WHERE topic = 'ferxxxa_markets'
AND studied_at < NOW() - INTERVAL '2 hours';

# Next run will be forced to scrape live or use recent cache
```

### Restart Database Connection

```bash
# In Neon console:
# 1. Go to your project
# 2. Click Database → ferxxxa_markets branch
# 3. Check for connection limit issues
# 4. Reset all connections if needed
```

### Redeploy With Latest Code

```bash
# If code changes were made
git add .
git commit -m "fix: Update market scraper selectors"
vercel --prod

# Verify deployment:
vercel deployments
```

---

## Testing in Development

### Local Testing

```bash
# 1. Install dependencies
npm install

# 2. Set env vars
export DORADOBET_USER=your_user
export DORADOBET_PASS=your_pass
export CRON_SECRET=test_secret
export DATABASE_URL=postgresql://...
export NODE_ENV=development

# 3. Run local Vercel
npm run dev

# 4. Call endpoint
curl -H "Authorization: Bearer test_secret" \
  http://localhost:3000/api/ferxxxa-markets | jq .

# 5. Check output
# Should see: "success": true, "markets_count": 67
```

### Dry Run (Scraping Only)

```bash
# Create test script
cat > test-scrape.js << 'EOF'
import { scrapeDoradoBetMarkets } from './api/ferxxxa-markets.js';

try {
  const result = await scrapeDoradoBetMarkets();
  console.log('Markets found:', result.total_markets_found);
  console.log('Market types:', Object.keys(result.markets).length);
  console.log('Match:', result.home_team, 'vs', result.away_team);
} catch (err) {
  console.error('Error:', err.message);
}
EOF

# Run
NODE_ENV=development node test-scrape.js
```

### Mock Testing (No DoradoBet)

```javascript
// In api/ferxxxa-markets.js, add:
if (process.env.USE_MOCK_DATA === 'true') {
  console.log('[MOCK] Returning fallback markets');
  return generateRealisticMarkets();
}

// Then test:
export USE_MOCK_DATA=true npm run dev
```

---

## When to Escalate

### Contact Doradobet Support If:
- ❌ 401/403 auth errors (account locked?)
- ❌ 429 rate limit errors (too many requests)
- ❌ 503 service unavailable (site down)
- ❌ HTML structure completely changed (requires redesign)

### Check Internal System If:
- ⚠️ Timeout errors (database slow, network issues)
- ⚠️ Memory errors (need optimization)
- ⚠️ Intermittent failures (race conditions?)

### Debug Checklist
- [ ] Endpoint responds to GET request
- [ ] Cron is registered (`vercel crons list`)
- [ ] Env vars set (`vercel env list`)
- [ ] Recent logs show activity (`vercel logs`)
- [ ] Database is accessible (test query)
- [ ] DoradoBet site is up (test browser)
- [ ] Credentials work (test login manually)

---

## Contact & Support

**Internal Team**:
- FerXxxa Developer: Check /CLAUDE.md for escalation

**External Dependencies**:
- Vercel Support: https://vercel.com/support
- Neon (Postgres): https://neon.tech/support
- Playwright Docs: https://playwright.dev
- DoradoBet Support: https://doradobet.com/help

---

**Last Updated**: 2026-05-25  
**Status**: Production v1.0.0
