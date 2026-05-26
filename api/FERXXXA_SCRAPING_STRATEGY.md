# FerXxxa Scraping Strategy - DoradoBet Chat Mining

## Overview
This document explains how FerXxxa extracts betting intelligence from DoradoBet's live match chat.

## Current Implementation (MVP)
**Status**: Realistic data simulation
**Next Phase**: Real web scraping (Agent 3)

## What We're Scraping

### Source
- **Website**: https://doradobet.com
- **Sections**: 
  - `/deportes/` - Main sports betting section
  - `/deportes/partidos/` - Live matches
  - Individual match pages with live chat

### Data Types Extracted

1. **Bet Predictions** (from chat messages)
   - User predictions: "Argentina 1x2", "Over 2.5", "BTTS Yes"
   - Extracted via keyword matching
   - Frequency = count of similar predictions
   - Percentage = frequency / total_messages

2. **Odds Information**
   - Current odds displayed on page
   - Historical odds (cached or from API)
   - Movement calculated: current - 3h_ago
   - Direction: "up" if positive change, "down" if negative

3. **Injury Information**
   - Chat messages mentioning: "injured", "out", "baja", "lesión"
   - Player name extraction
   - Confidence level based on source reliability
   - Mention count from keyword frequency

4. **Sentiment Analysis**
   - Positive keywords: "win", "bull", "strong", "value", "easy"
   - Negative keywords: "lose", "bear", "weak", "overpriced", "risky"
   - Neutral: remaining messages
   - Aggregate sentiment from distribution

5. **Trending Narratives**
   - Most discussed topics in chat
   - Keywords with high frequency
   - Narrative themes identified
   - Top 5-7 narratives per cycle

---

## Extraction Methods (Implementation Options)

### Option A: Firecrawl (Recommended for Production)

**Setup**:
```bash
npm install @firecrawl/sdk
```

**Implementation**:
```javascript
import { FirecrawlApp } from '@firecrawl/sdk';

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

async function scrapeDoradoBet() {
  try {
    const result = await app.scrapeUrl(
      'https://doradobet.com/deportes/partidos',
      {
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: '.chat-container',
        timeout: 30000
      }
    );
    
    return parseDoradoBetContent(result.markdown);
  } catch (error) {
    console.error('Firecrawl error:', error);
    throw error;
  }
}
```

**Advantages**:
- Handles JavaScript-rendered content
- Reliable blocking on dynamic elements
- Built-in error handling
- Returns clean markdown

**Disadvantages**:
- Requires API key and budget
- External service dependency
- ~2-5 second latency per request

---

### Option B: Cheerio + Fetch (Lightweight)

**Setup**:
```bash
npm install cheerio node-fetch
```

**Implementation**:
```javascript
import * as cheerio from 'cheerio';

async function scrapeDoradoBetCheerio() {
  try {
    const response = await fetch('https://doradobet.com/deportes/partidos', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const intel = {
      predictions: extractPredictions($),
      injuries: extractInjuries($),
      odds: extractOdds($),
      sentiment: analyzeSentiment($)
    };
    
    return intel;
  } catch (error) {
    console.error('Cheerio error:', error);
    throw error;
  }
}

function extractPredictions($) {
  const predictions = {};
  
  // Find all chat messages
  $('.chat-message').each((i, el) => {
    const text = $(el).text().toLowerCase();
    
    // 1x2 predictions
    if (text.includes('home') || text.includes('local')) {
      predictions['home_win'] = (predictions['home_win'] || 0) + 1;
    }
    if (text.includes('away') || text.includes('visitante')) {
      predictions['away_win'] = (predictions['away_win'] || 0) + 1;
    }
    if (text.includes('draw') || text.includes('empate')) {
      predictions['draw'] = (predictions['draw'] || 0) + 1;
    }
    
    // Over/Under
    if (text.includes('over') || text.includes('más de')) {
      predictions['over_2.5'] = (predictions['over_2.5'] || 0) + 1;
    }
    if (text.includes('under') || text.includes('menos de')) {
      predictions['under_2.5'] = (predictions['under_2.5'] || 0) + 1;
    }
    
    // BTTS
    if (text.includes('ambos') || text.includes('btts')) {
      predictions['btts_yes'] = (predictions['btts_yes'] || 0) + 1;
    }
  });
  
  return predictions;
}

function extractInjuries($) {
  const injuries = [];
  const injuryKeywords = ['injured', 'out', 'baja', 'lesión', 'lesionado', 'doubtful'];
  
  $('.chat-message').each((i, el) => {
    const text = $(el).text();
    
    // Check if message mentions injury
    if (injuryKeywords.some(kw => text.toLowerCase().includes(kw))) {
      // Try to extract player name (simple heuristic)
      const words = text.split(/\s+/);
      
      // Look for capitalized words (likely names)
      const potentialNames = words.filter(w => 
        /^[A-Z][a-z]+$/.test(w)
      );
      
      if (potentialNames.length > 0) {
        const playerName = potentialNames[0];
        
        // Find existing injury record
        let injury = injuries.find(inj => inj.player === playerName);
        
        if (!injury) {
          injury = {
            player: playerName,
            mentions: 0,
            confidence: 'medium'
          };
          injuries.push(injury);
        }
        
        injury.mentions++;
        
        // Determine confidence from keyword certainty
        if (text.includes('out') || text.includes('baja')) {
          injury.confidence = 'high';
          injury.status = 'reported_out';
        } else if (text.includes('doubtful') || text.includes('cuestionable')) {
          injury.confidence = 'medium';
          injury.status = 'reported_questionable';
        }
      }
    }
  });
  
  return injuries;
}

function extractOdds($) {
  const odds = {};
  
  // Find odds display on page
  $('.odds-display').each((i, el) => {
    const market = $(el).data('market'); // e.g., '1x2'
    const option = $(el).data('option');  // e.g., 'home'
    const oddValue = parseFloat($(el).text());
    
    if (!odds[market]) odds[market] = {};
    odds[market][option] = oddValue;
  });
  
  return odds;
}

function analyzeSentiment($) {
  const positiveWords = ['win', 'bull', 'strong', 'value', 'easy', 'mejor', 'gana'];
  const negativeWords = ['lose', 'bear', 'weak', 'risky', 'fail', 'peor', 'pierde'];
  
  let positive = 0, negative = 0, neutral = 0;
  
  $('.chat-message').each((i, el) => {
    const text = $(el).text().toLowerCase();
    
    const hasPositive = positiveWords.some(w => text.includes(w));
    const hasNegative = negativeWords.some(w => text.includes(w));
    
    if (hasPositive && !hasNegative) positive++;
    else if (hasNegative && !hasPositive) negative++;
    else neutral++;
  });
  
  const total = positive + negative + neutral || 1;
  
  return {
    positive_messages: positive,
    negative_messages: negative,
    neutral_messages: neutral,
    overall_sentiment: 
      positive > total * 0.45 ? 'positive' :
      negative > total * 0.45 ? 'negative' :
      positive > neutral ? 'slightly_positive' :
      negative > neutral ? 'slightly_negative' :
      'neutral'
  };
}
```

**Advantages**:
- No external dependencies
- Fast (milliseconds)
- No API quota
- Good for static HTML

**Disadvantages**:
- Doesn't handle JavaScript-rendered content
- Need to know exact CSS selectors
- More brittle (breaks with UI changes)
- Requires reverse-engineering DoradoBet HTML

---

### Option C: Puppeteer (Heavy but Dynamic)

**Setup**:
```bash
npm install puppeteer
```

**Implementation**:
```javascript
import puppeteer from 'puppeteer';

async function scrapeDoradoBetPuppeteer() {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );
    
    // Navigate and wait for content
    await page.goto('https://doradobet.com/deportes/partidos', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for chat to load
    await page.waitForSelector('.chat-container', { timeout: 10000 });
    
    // Scroll to load more messages (if lazy-loaded)
    await page.evaluate(() => {
      const chatContainer = document.querySelector('.chat-container');
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    
    // Wait a bit for more messages to load
    await page.waitForTimeout(2000);
    
    // Extract all data via page.evaluate
    const intel = await page.evaluate(() => {
      // All this code runs IN the browser context
      const messages = [];
      
      document.querySelectorAll('.chat-message').forEach(el => {
        messages.push({
          text: el.textContent.trim(),
          author: el.querySelector('.author')?.textContent || 'unknown',
          timestamp: el.querySelector('.time')?.textContent || null
        });
      });
      
      const odds = {};
      document.querySelectorAll('[data-odds]').forEach(el => {
        const market = el.dataset.market;
        const option = el.dataset.option;
        const value = parseFloat(el.textContent);
        
        if (!odds[market]) odds[market] = {};
        odds[market][option] = value;
      });
      
      return { messages, odds };
    });
    
    // Post-process in Node.js context
    return processIntel(intel);
    
  } catch (error) {
    console.error('Puppeteer error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

function processIntel(rawIntel) {
  // Same parsing logic as Cheerio
  const predictions = extractPredictionsFromMessages(rawIntel.messages);
  const sentiment = analyzeSentimentFromMessages(rawIntel.messages);
  
  return {
    predictions,
    sentiment,
    message_count: rawIntel.messages.length,
    odds: rawIntel.odds
  };
}
```

**Advantages**:
- Handles full JavaScript rendering
- Can interact with dynamic content
- Scroll and trigger events
- Most reliable for complex UIs

**Disadvantages**:
- Heavy resource usage (full browser)
- Slow (5-10+ seconds per run)
- High memory footprint
- Expensive on Vercel (may timeout)

---

## Recommended Approach: Hybrid

For best results, use **Firecrawl primary, Cheerio fallback**:

```javascript
async function fetchDoradoBetIntel() {
  try {
    // Try Firecrawl first (ideal for dynamic content)
    return await scrapeWithFirecrawl();
  } catch (firecrawlError) {
    console.warn('Firecrawl failed:', firecrawlError.message);
    
    try {
      // Fall back to lighter Cheerio scraping
      return await scrapeWithCheerio();
    } catch (cheerioError) {
      console.warn('Cheerio failed:', cheerioError.message);
      
      // If both fail, use cached or fallback data
      throw new Error('All scraping methods failed');
    }
  }
}
```

---

## Data Parsing Patterns

### 1. Prediction Keywords

```javascript
const PREDICTION_KEYWORDS = {
  'home_win': [
    'argentina gana', 'argentina 1x2', 'local', 'home win', 'casa',
    '1', '2.5', 'argentina -1', 'gana argentina'
  ],
  'away_win': [
    'france gana', 'france 1x2', 'visitor', 'away win', 'visitante',
    '2', '1.5', 'france -1', 'gana france'
  ],
  'draw': [
    'empate', 'draw', 'x', 'tie', 'paridad', '1-1', 'both tie'
  ],
  'over_2.5': [
    'over 2.5', 'más de 2.5', 'over', 'o2.5', 'goles muchos',
    'partida goleada', 'mucho gol'
  ],
  'under_2.5': [
    'under 2.5', 'menos de 2.5', 'under', 'u2.5', 'pocos goles',
    'defensiva fuerte'
  ],
  'btts': [
    'ambos marcan', 'both score', 'btts', 'gg', 'ambos golean',
    'dos goles seguros'
  ]
};

function matchPrediction(text) {
  const lower = text.toLowerCase();
  
  for (const [predType, keywords] of Object.entries(PREDICTION_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return predType;
    }
  }
  
  return null;
}
```

### 2. Injury Detection

```javascript
const INJURY_PATTERNS = [
  /(\w+)\s+(?:is\s+)?(?:out|injured|questionable|doubtful)/gi,
  /(\w+)\s+(?:está\s+)?(?:baja|lesionado|cuestionable)/gi,
  /(?:injury|lesión|baja)\s+a\s+(\w+)/gi,
  /(\w+)\s+won't\s+play/gi,
  /(\w+)\s+no\s+juega/gi
];

function extractInjuries(text) {
  const injuries = [];
  
  for (const pattern of INJURY_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      injuries.push({
        player: match[1],
        confidence: pattern === /out/gi ? 'high' : 'medium'
      });
    }
  }
  
  return injuries;
}
```

### 3. Odds Extraction

```javascript
const ODDS_SELECTORS = {
  // CSS selectors for different betting sites
  'doradobet': {
    '1x2': '.odds-1x2-home',
    'draw': '.odds-1x2-draw',
    'away': '.odds-1x2-away',
    'over_2.5': '.odds-over-2-5',
    'under_2.5': '.odds-under-2-5'
  }
};

function extractOddsFromPage($) {
  const odds = {};
  
  // Try different selectors
  for (const [selector, value] of Object.entries(ODDS_SELECTORS['doradobet'])) {
    const text = $(selector).text();
    const oddValue = parseFloat(text);
    
    if (!isNaN(oddValue)) {
      odds[selector] = oddValue;
    }
  }
  
  return odds;
}
```

### 4. Sentiment Scoring

```javascript
const SENTIMENT_LEXICON = {
  positive: {
    words: ['win', 'winning', 'bull', 'strong', 'value', 'easy', 'profit'],
    weight: 1
  },
  negative: {
    words: ['lose', 'losing', 'bear', 'weak', 'risky', 'fail', 'loss'],
    weight: -1
  },
  intensifiers: {
    words: ['very', 'definitely', 'easily', 'sure'],
    multiplier: 1.5
  },
  negations: {
    words: ['not', 'no', 'never', 'unlikely'],
    flip: true
  }
};

function scoreSentiment(text) {
  let score = 0;
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Check for intensifiers/negations
    let multiplier = 1;
    if (i > 0 && SENTIMENT_LEXICON.intensifiers.words.includes(words[i - 1])) {
      multiplier = SENTIMENT_LEXICON.intensifiers.multiplier;
    }
    if (i > 0 && SENTIMENT_LEXICON.negations.words.includes(words[i - 1])) {
      multiplier = -1;
    }
    
    // Score the word
    if (SENTIMENT_LEXICON.positive.words.includes(word)) {
      score += 1 * multiplier;
    }
    if (SENTIMENT_LEXICON.negative.words.includes(word)) {
      score -= 1 * multiplier;
    }
  }
  
  return score; // Positive score = positive sentiment
}
```

---

## Rate Limiting & Politeness

### Best Practices

```javascript
// Add delays between requests
const DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds

async function politelyFetch(url) {
  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 FerXxxa-Monitor/1.0 (+https://mundial2026.app)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1'
    }
  });
}

// Respect robots.txt
async function checkRobotsTxt() {
  const robots = await fetch('https://doradobet.com/robots.txt');
  // Parse and respect any restrictions
}

// Implement caching to avoid repeated requests
const cache = new Map();

async function cachedFetch(url, ttl = 3600000) {
  const now = Date.now();
  
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url);
    if (now - timestamp < ttl) {
      return data;
    }
  }
  
  const data = await fetch(url);
  cache.set(url, { data, timestamp: now });
  return data;
}
```

---

## Fallback Strategy When Scraping Fails

```javascript
async function getDoradoBetData() {
  try {
    // Primary: Real scraping
    return await scrapeDoradoBetLive();
  } catch (error) {
    console.error('[scraping] Live scrape failed:', error.message);
    
    // Secondary: Database cache
    const cached = await db`
      SELECT summary_json, studied_at FROM zak_intel
      WHERE topic = 'ferxxxa_intel'
      AND studied_at > NOW() - INTERVAL '6 hours'
      ORDER BY studied_at DESC
      LIMIT 1
    `;
    
    if (cached.length > 0) {
      console.log('[scraping] Using cached data from', cached[0].studied_at);
      return cached[0].summary_json;
    }
    
    // Tertiary: Safe fallback
    console.warn('[scraping] No cache available, using fallback');
    return generateFallbackIntel();
  }
}
```

---

## Testing Scraping

```javascript
// Test script
async function testScraping() {
  console.log('Testing DoradoBet scraping...');
  
  try {
    const result = await fetchDoradoBetIntel();
    
    console.log('✅ Messages found:', result.match_predictions.total_chat_messages);
    console.log('✅ Predictions:', result.match_predictions.predictions.length);
    console.log('✅ Injuries:', result.injury_alerts.length);
    console.log('✅ Sentiment:', result.sentiment_analysis.overall_sentiment);
    
    // Validate data quality
    assert(result.match_predictions.total_chat_messages > 0);
    assert(result.sentiment_analysis.positive_messages >= 0);
    
    console.log('✅ All tests passed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run: node test-scraping.js
```

---

**Next: Agent 3 will implement real scraping**
