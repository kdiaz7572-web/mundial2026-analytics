# FerXxxa ↔ IA-Zak Integration - Summary

## What Was Done

**Agent 3 has successfully connected FerXxxa (DoradoBet chat monitor) with IA-Zak (betting AI) so that IA-Zak receives real-time community intelligence before making recommendations.**

---

## Files Modified

### 1. `api/chat.js` - Core Integration
- **Lines 237-283:** Added FerXxxa intelligence fetching
- Queries `zak_intel` table for latest DoradoBet data (age < 4 hours)
- Builds context string with:
  - Trending narratives from chat
  - Community sentiment (positive/negative ratio)
  - Injury alerts mentioned by bettors
  - Data freshness (minutes old)
- Injects FerXxxa context into system prompt for Groq
- Returns metadata: `ferxxxa_intel: { available, age_minutes, data_freshness }`

**Key change:**
```javascript
// 2.1. INTEGRATION POINT: Fetch FerXxxa Intel from DoradoBet chat
const ferxxxaRes = await db`
  SELECT summary_json, studied_at FROM zak_intel
  WHERE topic = 'ferxxxa_intel'
  AND studied_at > NOW() - INTERVAL '4 hours'
  ORDER BY studied_at DESC
  LIMIT 1
`;
```

### 2. `vercel.json` - Cron Configuration
- Added FerXxxa cron job: `0 */3 * * *` (every 3 hours)
- Keeps existing learn cron: `0 6 * * *` (daily)

**New config:**
```json
{
  "path": "/api/ferxxxa-intel",
  "schedule": "0 */3 * * *",
  "description": "FerXxxa DoradoBet chat monitor - runs every 3 hours"
}
```

---

## What Happens Now

### Timeline: User Asks a Betting Question

```
T+0min:  FerXxxa runs (cron)
         └─ Fetches DoradoBet predictions
         └─ Saves to zak_intel (topic='ferxxxa_intel')

T+35min: User asks "¿Qué apuesto en Argentina vs Francia?"
         └─ POST /api/chat

T+35min: IA-Zak loads chat history
T+35min: IA-Zak fetches FerXxxa intel from DB (just saved 35min ago)
         └─ Gets: trending_narratives, sentiment, injury_alerts
         └─ Injects into system prompt

T+35min: Groq LLM analyzes with BOTH:
         ├─ Technical data (FBREF, Understat, API-Football)
         └─ Community data (DoradoBet predictions, chat sentiment)

T+35min: IA-Zak returns recommendation:
         ├─ "Over 2.5 a ₡8,500 (Kelly 12.8%)"
         ├─ "Community consensus matches my analysis ✅"
         └─ ferxxxa_intel: { available: true, age_minutes: 35, data_freshness: 'fresh' }
```

---

## System Prompt: How FerXxxa Context Is Used

### Injected into SYSTEM_PROMPTS.es:

```
FERXXXA DORADOBET CHAT INTELLIGENCE (Community Predictions):
  • Trending narratives: Argentina strong form | Over 2.5 value | Injuries key
  • Community sentiment: 82+ / 34- messages (trend: positive)
  • Injury reports from chat: Mbappé (reported_questionable), Rodrygo (reported_out)
  • Intel freshness: 35 minutes old

INSTRUCTIONS ABOUT FERXXXA INTEL:
If you have FerXxxa information (DoradoBet chat), use it to:
1. Validate your analysis: Does it match other bettors' opinions?
2. Detect arbitrage: Are you seeing something others miss?
3. Adjust confidence: If majority bets differently, explain divergence
4. Include injuries: Incorporate chat-mentioned injuries into your analysis
5. Trending narratives: Consider if chat detected patterns you didn't see
```

### IA-Zak's Reasoning:

1. **If community agrees with analysis:**
   - "Community consensus matches my analysis - CONFIDENCE BOOST"
   - Kelly % may increase slightly (sentiment confirms pick)

2. **If community diverges:**
   - "Only 28% of DoradoBet users picked this - potential arbitrage"
   - Lower confidence, explain divergence clearly

3. **If injuries mentioned by community:**
   - "DoradoBet already pricing in Mbappé uncertainty"
   - Incorporates community injury mentions into probability adjustments

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      DORADOBET CHAT                             │
│              (Predictive messages from bettors)                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ (Every 3 hours, cron: 0 */3 * * *)
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│            /api/ferxxxa-intel (FerXxxa)                          │
│  Fetches predictions from DoradoBet                              │
│  ├─ Trending narratives                                          │
│  ├─ Odds movements                                               │
│  ├─ Injury alerts                                                │
│  └─ Sentiment analysis                                           │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ (INSERT INTO zak_intel)
                   │ topic='ferxxxa_intel'
                   │ studied_at=NOW()
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  PostgreSQL zak_intel Table                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ topic        │ ferxxxa_intel                                │  │
│  │ summary_json │ { match_predictions: {...}, sentiment: ... }│  │
│  │ studied_at   │ 2026-05-23 22:00:00                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ (User asks betting question)
                   │ POST /api/chat
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              /api/chat (IA-Zak Analysis)                         │
│                                                                   │
│  1. Load conversation history                                    │
│  2. FETCH FerXxxa intel from DB (age < 4 hours) ← INTEGRATION   │
│  3. Prepare system prompt:                                       │
│     ├─ User context (bankroll, Kelly rules)                      │
│     └─ FerXxxa context (community predictions + sentiment)       │
│  4. Call Groq LLM with enhanced prompt                           │
│  5. Parse JSON response                                          │
│  6. Return recommendation + ferxxxa_intel metadata               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│               User Gets Recommendation                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ "Over 2.5 a ₡8,500 (Kelly 12.8%)"                         │  │
│  │ "Community consensus matches my analysis ✅"              │  │
│  │ "Mbappé reported_questionable in chat (12 mentions)"      │  │
│  │ ferxxxa_intel: {                                          │  │
│  │   available: true,                                        │  │
│  │   age_minutes: 35,                                        │  │
│  │   data_freshness: 'fresh'                                 │  │
│  │ }                                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Response Structure: With FerXxxa Context

```json
{
  "response": "Analysis with community context...",
  "reasoning_chain": [
    "Paso 1: Entiendo que preguntas...",
    "Paso 2: Consulto FBREF, Understat, DoradoBet chat...",
    "Paso 3: Conflictos: Community also mentions Mbappé injury...",
    "Paso 4: Calculo con ajustes (xG, lesiones, ELO)...",
    "Paso 5: Kelly % = 12.8%, Risk of Ruin = 1.8%..."
  ],
  "recommendations": [
    "Over 2.5 goles a ₡8,500 (68% probabilidad)"
  ],
  "kelly_calculations": {
    "bet_1": {
      "amount_colones": 8500,
      "kelly_percentage": 12.8,
      "bet_type": "Over/Under",
      "probability": 0.68,
      "odds": 1.80,
      "edge": 0.224,
      "risk_of_ruin": 1.8,
      "ferxxxa_context": {
        "doradobet_consensus": "Over 2.5 goles (45% de apostadores)",
        "consensus_matches_our_pick": true,
        "confidence_adjustment": "Sin ajuste - sentimiento positivo"
      }
    }
  },
  "data_sources_used": [
    "FBREF",
    "Understat",
    "API-Football",
    "Transfermarkt",
    "FerXxxa"  ← NEW!
  ],
  "ferxxxa_intel": {
    "available": true,
    "age_minutes": 35,
    "data_freshness": "fresh"
  }
}
```

---

## Error Handling

### Scenario 1: FerXxxa Data Too Old
```
FerXxxa data > 4 hours old
│
└─ IA-Zak skips FerXxxa context
└─ Continues with technical analysis only
└─ Message: "FERXXXA DORADOBET CHAT INTELLIGENCE: No recent data (>4h old)"
└─ ferxxxa_intel: { available: false, age_minutes: 250, data_freshness: 'unavailable' }
```

### Scenario 2: FerXxxa Cron Fails
```
FerXxxa cron fails to fetch DoradoBet
│
└─ Uses cached data (max 6 hours old) or generates fallback
└─ DB still gets updated (with fallback or cached data)
└─ IA-Zak continues as normal (always has something to work with)
```

### Scenario 3: DB Query Fails in Chat.js
```
SELECT from zak_intel fails
│
└─ Catch block logs warning: "[chat] Could not fetch FerXxxa intel"
└─ ferxxxaContext defaults to unavailable message
└─ IA-Zak still works (no hard failure)
└─ ferxxxa_intel: { available: false }
```

---

## Validations & Safety

### Age Calculation
```javascript
const ageMinutes = Math.round((now - studiedAt) / 60000);

if (ageMinutes < 60)      → 'fresh'
if (ageMinutes < 180)     → 'recent'
if (ageMinutes >= 180)    → 'aging' (will be excluded after 240min)
```

### Data Freshness
- ✅ Fresh: < 60 minutes
- ✅ Recent: 60-180 minutes
- ⚠️ Aging: 180-240 minutes
- ❌ Stale: > 240 minutes (excluded from query)

---

## No Breaking Changes

### What Didn't Change
- ✅ `api/ferxxxa-intel.js` - Not modified (Agent 2's work)
- ✅ `api/football.js` - Not modified
- ✅ `api/picks.js` - Not modified
- ✅ `js/chat_ui.js` - Not modified
- ✅ Database schema - No new tables (uses existing `zak_intel`)
- ✅ API contract - Chat endpoint still accepts same inputs, adds new `ferxxxa_intel` field in response

---

## Testing Checklist

### 1. FerXxxa Cron
```bash
# Should run every 3 hours
GET /api/ferxxxa-intel (with CRON_SECRET header)
Response: { success: true, data_persisted: true, ferxxxa_intel: {...} }
```

### 2. IA-Zak Fetches FerXxxa
```bash
# Ask IA-Zak a betting question
POST /api/chat with { message, session_id, bankroll, language }
Response includes:
  - ferxxxa_intel: { available: true, age_minutes: 35, ... }
  - ferxxxa_context in kelly_calculations
```

### 3. Community Divergence Detection
```
User Q: "¿Qué apuesto?"
FerXxxa shows: Only 15% of users picked this
IA-Zak response: "Potential arbitrage detected. Community diverges but..."
```

### 4. Injury Updates
```
FerXxxa reports: Mbappé reported_questionable (12 mentions)
IA-Zak analysis: "Incorporating Mbappé injury uncertainty..."
```

### 5. Graceful Degradation
```
# If FerXxxa data > 4 hours old:
ferxxxa_intel: { available: false }
IA-Zak works normally (just without community context)
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| FerXxxa Update Frequency | Every 3 hours |
| FerXxxa Data Freshness Window | 4 hours max |
| IA-Zak Latency Impact | ~5ms (DB query) |
| Database Queries | 1 SELECT per chat request |
| New Tables Created | 0 (uses existing zak_intel) |
| Modified Files | 2 (chat.js, vercel.json) |
| System Prompt Injection | ~500-800 chars |

---

## Summary

**Integration Status: COMPLETE**

FerXxxa now feeds real-time DoradoBet predictions to IA-Zak every time a user asks for betting advice. IA-Zak uses this community context to:

1. **Validate** its technical analysis against bettors' opinions
2. **Detect** potential arbitrage opportunities
3. **Adjust** confidence based on community consensus
4. **Incorporate** injury alerts from chat
5. **Provide** more informed, community-aware recommendations

The system is **fully backwards compatible** and **gracefully degrades** if FerXxxa data becomes unavailable.

See `/docs/FERXXXA_INTEGRATION.md` for full technical documentation.
