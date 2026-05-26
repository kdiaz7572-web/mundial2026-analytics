# IA-Zak v5.0 System Architecture Diagram

## Data Flow

\\\
User Chat Message
    ↓
[api/chat.js - POST handler]
    ↓
├─ Extract match_id from message
├─ Query conversation history
├─ Prepare user context (bankroll, history)
├─ [NEW] Query FerXxxa Intel:
│  ├─ SELECT FROM zak_intel WHERE topic='ferxxxa_markets'
│  └─ SELECT FROM zak_intel WHERE topic='ferxxxa_community'
├─ [NEW] Inject markets JSON into system prompt
├─ [NEW] Inject community JSON into system prompt
├─ Call Groq API (llama-3.3-70b-versatile)
│  └─ With enhanced v5.0 system prompt
├─ Parse Groq response (JSON mode)
├─ [NEW] If parlays missing: Generate 5 fallback parlays
│  └─ for each profile in [conservative, moderate, aggressive, very_aggressive, community_pick]:
│     └─ generateParlay(rank, profile, bankroll, markets, community)
├─ Store conversation in database
└─ Return response with:
   ├─ Analysis + reasoning chain
   ├─ 5 parlays (ALWAYS)
   ├─ FerXxxa metadata
   └─ Data freshness report
\\\

---

## Function Call Stack

\\\
handler(req, res)
├─ sanitizeInput(message)
├─ getDb() → Neon connection
├─ Load conversation_history
├─ [NEW] fetchFerXxxaIntel(matchId, db)
│  ├─ Query ferxxxa_markets
│  ├─ Query ferxxxa_community
│  ├─ Check data age
│  └─ Return {markets, community, stale, warning}
├─ Call groq.chat.completions.create()
│  └─ With injected system prompt
├─ Parse JSON response
├─ [NEW] generateParlay() × 5
│  ├─ [NEW] calculateKelly(prob, odds)
│  ├─ [NEW] calculateRiskOfRuin(kelly%, bankroll)
│  └─ Return complete parlay object
├─ Store in conversation_history
└─ sendSuccess(res, {...5 parlays...})
\\\

---

## System Prompt Structure

\\\
SYSTEM_PROMPTS = {
  es: \
    Eres IA-Zak v5.0
    
    TU FORMA DE PENSAR (Claude-like)
    
    PROCESO DE ANÁLISIS (Step-by-step)
    
    CONTEXTO DEL USUARIO:
    {USER_CONTEXT} ← Injected with bankroll, history
    
    SECCIÓN CRÍTICA: 5 PARLAYS OBLIGATORIOS
    
    INSTRUCCIONES SOBRE FERXXXA INTEL:
    Usa DATOS DISPONIBLES:
    - Mercados reales de DoradoBet: {FERXXXA_MARKETS} ← Injected JSON
    - Análisis comunitario: {FERXXXA_COMMUNITY} ← Injected JSON
    
    PARA CADA PARLAY INCLUIR EN JSON:
    {...detailed format with all required fields...}
  \,
  en: \...equivalent in English...\
}
\\\

---

## Database Schema Usage

\\\
zak_intel table:
├─ id (SERIAL PRIMARY KEY)
├─ topic (TEXT)
│  ├─ 'ferxxxa_markets' ← Real DoradoBet odds
│  ├─ 'ferxxxa_community' ← Community sentiment
│  └─ other topics
├─ match_id (TEXT) ← e.g., 'paderborn_vs_wolfsburg_2026_05_25'
├─ summary_json (JSONB)
│  └─ Contains markets/community data
├─ studied_at (TIMESTAMPTZ)
│  └─ Used for freshness check
└─ created_at (TIMESTAMPTZ)

Queries:
Q1: SELECT FROM zak_intel WHERE topic='ferxxxa_markets' 
    AND match_id=\ AND studied_at > NOW()-'5m'
Q2: SELECT FROM zak_intel WHERE topic='ferxxxa_community'
    AND match_id=\ AND studied_at > NOW()-'5m'
Fallback: SELECT FROM zak_intel WHERE topic IN (...) 
          AND studied_at > NOW()-'6h' ORDER BY studied_at DESC LIMIT 2
\\\

---

## Response JSON Structure

\\\
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  
  "response": "Análisis detallado...",
  "reasoning_chain": ["Paso 1: ...", "Paso 2: ...", ...],
  "recommendations": ["Parlay 1: ...", "Parlay 2: ...", ...],
  "data_sources_used": ["DoradoBet", "FerXxxa", ...],
  "uncertainties": ["Lesión no confirmada", ...],
  "confidence": "high|medium|low",
  
  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservadora - ...",
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
          "source": "doradobet_real"  ← Real or theoretical_estimate
        },
        {...}
      ],
      
      "combined_probability": 0.293,
      "combined_odds": 3.41,
      "edge_calculation": "4.2%",
      "detailed_reasoning": "...",
      
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9%)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "We avoid BTTS..."
      },
      
      "arbitrage_check": {
        "has_opportunity": false,
        "note": "..."
      }
    },
    {...ranks 2-5...}
  ],
  
  "tool_calls": [],
  "bankroll_impact": null,
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
\\\

---

## Request Handling Flow

\\\
Request: {message, session_id, language, bankroll?}
         ↓
Step 1: Validate input
        - Check method = POST
        - Check GROQ_API_KEY configured
        - Sanitize message (5k char max)
        ↓
Step 2: Load conversation context
        - Query conversation_history (last 10 messages)
        - Format as alternating user/assistant messages
        ↓
Step 3: Prepare system context
        - Load user bankroll (if provided)
        - Validate bankroll (₡5k-50k range)
        - Query prediction_accuracy stats (last 30 days)
        ↓
Step 4: [NEW] Fetch FerXxxa Intel
        - Call fetchFerXxxaIntel(matchId, db)
        - Get markets + community data
        - Check staleness (<5 min = fresh)
        - Build market JSON for injection
        - Build community JSON for injection
        ↓
Step 5: Inject system prompt
        - Replace {USER_CONTEXT} with bankroll info
        - Replace {FERXXXA_MARKETS} with markets JSON
        - Replace {FERXXXA_COMMUNITY} with community JSON
        ↓
Step 6: Call Groq API
        - Model: llama-3.3-70b-versatile
        - System: enhanced v5.0 prompt with injections
        - Messages: conversation history + new message
        - Temp: 0.7, MaxTokens: 1000
        - Format: json_object
        ↓
Step 7: Parse response
        - Extract JSON from Groq output
        - Parse reasoning_chain, recommendations, kelly_calculations
        - Try to extract parlays (if provided)
        ↓
Step 8: [NEW] Fallback parlay generation
        - If no parlays in response: Generate 5
        - For each profile: generateParlay(rank, profile, bankroll, markets, community)
        - Ensure exactly 5 parlays always present
        ↓
Step 9: Store conversation
        - INSERT INTO conversation_history
        - Store user message, zak response, bankroll, timestamp
        ↓
Step 10: Return response
        - Include all Groq output fields
        - Include all 5 parlays
        - Include FerXxxa metadata
        - Include data freshness report
        - Status 200, JSON format
\\\

---

## Error Handling Paths

\\\
Error: No GROQ_API_KEY
       └─ Return config error + fallback response

Error: FerXxxa markets unavailable
       └─ Continue with community data only
          └─ If both unavailable: Use theoretical estimates
             └─ Mark all odds as "theoretical_estimate"
             └─ Warn user in response

Error: Groq API timeout
       └─ Return fallback response
          └─ Generate parlays from cache or defaults
          └─ Report error in response

Error: Database query fails
       └─ Continue without that data
          └─ Update metadata (available: false)
          └─ Log error for monitoring

Error: Invalid bankroll (<₡5k or >₡50k)
       └─ Validate and warn user
          └─ Use defaults (₡50k)
          └─ Include warning in response

Error: Kelly > 25%
       └─ Warn user about Fractional Kelly
          └─ Recommend: kelly_% × 0.5 or 0.75
          └─ Include warning in response
\\\

---

## Performance Timeline

\\\
T0: Request arrives
    ├─ Validation: <5ms
    ├─ Message sanitization: <1ms
    ├─ Load conversation history: ~20ms
    └─ Prepare context: <5ms

T1: FerXxxa Intel fetch
    ├─ ferxxxa_markets query: ~50ms
    ├─ ferxxxa_community query: ~50ms (parallel)
    ├─ Data age check: <1ms
    └─ JSON serialization: <5ms

T2: System prompt preparation
    ├─ String replacement ({USER_CONTEXT}): <1ms
    ├─ Markets JSON injection: <2ms
    ├─ Community JSON injection: <2ms
    └─ Total: <5ms

T3: Groq API call
    ├─ Network latency: ~200ms
    ├─ Model inference (llama-3.3-70b): ~2-3s
    └─ Total: ~2-4s

T4: Response parsing
    ├─ JSON parse: <5ms
    ├─ Field extraction: <5ms
    └─ Total: <10ms

T5: [NEW] Parlay generation (if needed)
    ├─ generateParlay × 5: ~50ms
    ├─ Kelly calculations × 10: <5ms
    ├─ ROR calculations × 5: <5ms
    └─ Total: ~60ms

T6: Database store
    ├─ conversation_history INSERT: ~20ms
    └─ Total: ~20ms

T7: Response serialization
    ├─ JSON stringify (5 parlays): ~10ms
    └─ Total: ~10ms

TOTAL TIME: 2.5-4.5 seconds
Breakdown:
  - Network: ~200ms
  - Groq inference: ~2-4s
  - Database: ~70ms (parallel)
  - Processing: ~100ms
  - Margin: ~200ms
\\\

---

## Scalability Considerations

\\\
Current:
- 1 user × 5 parlays = 5 parlay objects per response
- 1 response ~2.5-4.5s
- Groq timeout: 10s

Scaling:
- Concurrent users: Limited by Groq rate limits (unknown)
- Database: Neon serverless (auto-scales)
- Caching: FerXxxa data (5 min window)
- Optimization: Could cache parlays by match_id

Bottleneck: Groq API (most expensive operation at 2-4s)
Mitigation: Cache parlays for same match within 5 min window
\\\

---

## Component Interactions

\\\
[Client App]
    ↓ POST /api/chat
[api/chat.js handler]
    ├─ Uses: sanitizeInput, sendError, sendSuccess
    ├─ Calls: getDb() → Neon connection
    ├─ [NEW] Calls: fetchFerXxxaIntel() → zak_intel queries
    ├─ Calls: groq.chat.completions.create() → Groq API
    ├─ Parses: Groq response (JSON)
    ├─ [NEW] Calls: generateParlay() × 5
    │  ├─ Uses: calculateKelly()
    │  ├─ Uses: calculateRiskOfRuin()
    │  └─ Uses: generateParrayReasoning()
    ├─ Stores: conversation_history
    └─ Returns: Complete response JSON
\\\

---

Version: 5.0  
Updated: 2026-05-25
