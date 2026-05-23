# IA-Zak v3.0 Integration Guide

How to integrate new v3.0 components with existing v2.0 codebase.

---

## Step 1: Setup Environment

```bash
# Verify Groq SDK is installed
npm install

# Create .env.local if not exists
cat > .env.local << EOF
GROQ_API_KEY=gsk_xxxxx...  # Get from https://console.groq.com
EOF

# Add to .gitignore (should already be there)
echo ".env.local" >> .gitignore
```

---

## Step 2: Integrate Chat UI into index.html

Replace the current 8-tab structure with chat-first design:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IA-Zak v3.0 - Mundial 2026</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
  </style>
</head>
<body>

<!-- Main Chat Container -->
<div id="chat-container"></div>

<script type="module">
  import ChatUI from './js/chat_ui.js';
  import ConversationManager from './js/conversation_manager.js';
  import i18n from './js/i18n.js';

  // Initialize chat UI
  const chatUI = new ChatUI('chat-container');
  const convo = new ConversationManager(chatUI.sessionId);

  // Bind language changes
  const langSelector = document.getElementById('language-selector');
  if (langSelector) {
    langSelector.addEventListener('change', (e) => {
      i18n.setLanguage(e.target.value);
      console.log(`Language set to: ${e.target.value}`);
    });
  }

  // Load any saved bankroll
  const bankrollInput = document.getElementById('bankroll-input');
  if (bankrollInput) {
    const savedBankroll = localStorage.getItem('zak_bankroll');
    if (savedBankroll) {
      bankrollInput.value = savedBankroll;
      chatUI.bankroll = parseFloat(savedBankroll);
    }
  }

  // Log initialization
  console.log('🤖 IA-Zak v3.0 initialized');
  console.log('Session ID:', chatUI.sessionId);
  console.log('Language:', i18n.language);
</script>

</body>
</html>
```

---

## Step 3: Connect Tools to v2.0 Modules

### File: `api/claude_tools.js`

Currently all tools return placeholder data. Connect them:

#### Option A: Import from existing v2.0 modules

```javascript
// Add at top of api/claude_tools.js
import { zakAnalyze } from './zak_agent.js';  // If exported
import { getPlayerStats } from './player_engine.js';  // If exported

// Then in analyzMatch function:
async function analyzeMatch({ match_id, home_team, away_team }) {
  try {
    // Use existing Zak analysis
    const analysis = await zakAnalyze(home_team, away_team);
    return {
      match_id,
      markets: analysis.markets,
      stars: analysis.confidence,
      edge: analysis.edge,
      ...analysis
    };
  } catch (error) {
    return { error: error.message };
  }
}
```

#### Option B: Direct mathematical integration

If modules aren't directly importable, include Poisson math:

```javascript
// Include in api/claude_tools.js or separate math_utils.js

function poissonGoalProbability(lambda, goals) {
  // e^-λ * λ^k / k!
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial(goals);
}

function calculateMarkets(homeXg, awayXg) {
  // Use Poisson to calculate 1x2, BTTS, corners, etc.
  const markets = [];
  
  for (let homeGoals = 0; homeGoals <= 5; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= 5; awayGoals++) {
      const prob = poissonGoalProbability(homeXg, homeGoals) * 
                   poissonGoalProbability(awayXg, awayGoals);
      
      // Accumulate for different markets
      if (homeGoals > awayGoals) {
        markets['1x2_home'] = (markets['1x2_home'] || 0) + prob;
      }
      // ... etc
    }
  }
  
  return markets;
}
```

---

## Step 4: Update Vercel Configuration

File: `vercel.json`

```json
{
  "version": 2,
  "name": "mundial2026-analytics",
  "buildCommand": "npm install",
  "outputDirectory": ".",
  "crons": [
    {
      "path": "/api/learn",
      "schedule": "0 6 * * *"
    }
  ],
  "env": [
    {
      "key": "GROQ_API_KEY",
      "value": "@groq-api-key"
    },
    {
      "key": "TAVILY_API_KEY", 
      "value": "@tavily-api-key"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ]
}
```

Then add secrets to Vercel:

```bash
vercel env add GROQ_API_KEY
# Paste: gsk_xxxxx...

vercel env add TAVILY_API_KEY
# Paste: your_tavily_key...
```

---

## Step 5: Connect UI to API

The chat UI automatically calls `/api/chat`, but you may want to handle responses:

```javascript
// In chat_ui.js or app.js, after response is received:

chatUI.addEventListener('response-received', (detail) => {
  const { response, tool_calls, bankroll_impact } = detail;

  // Update conversation manager
  convo.addMessage('assistant', response);

  // If Kelly calculation was done, record potential bet
  const kellyCall = tool_calls.find(t => t.name === 'calculate_kelly');
  if (kellyCall) {
    const bet = convo.recordBet({
      match: 'Argentina vs Marruecos',
      market: '1x2',
      odds: 2.5,
      stake: kellyCall.result.bet_size_recommended,
      model_probability: 0.45,
      expected_value: kellyCall.result.expected_value,
      kelly_pct: kellyCall.result.kelly_recommended_pct
    });

    // Ask for confirmation
    showBetConfirmation(bet);
  }
});
```

---

## Step 6: Implement Feedback Loop

Add modal for betting outcomes:

```javascript
// Show after user places bet
function showBetConfirmation(bet) {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; padding: 24px; border-radius: 12px; max-width: 400px;">
        <h3>¿Aceptas esta apuesta?</h3>
        <div style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px;">
          <p><strong>Partido:</strong> ${bet.match}</p>
          <p><strong>Cuota:</strong> ${bet.odds}</p>
          <p><strong>Apuesta:</strong> €${bet.stake.toFixed(2)}</p>
          <p><strong>Kelly:</strong> ${bet.kelly_pct}%</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="this.closest('div').remove()">Cancelar</button>
          <button onclick="acceptBet(${bet.id}); this.closest('div').remove()" style="background: #667eea; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer;">
            Aceptar ✅
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function acceptBet(betId) {
  // Store in conversation manager
  convo.recentBets.find(b => b.id === betId).status = 'accepted';
  convo.saveToStorage();

  // Later: Ask for outcome
  setTimeout(() => {
    showOutcomeModal(betId);
  }, 5000); // 5 seconds later (or after match ends)
}

function showOutcomeModal(betId) {
  const bet = convo.recentBets.find(b => b.id === betId);
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; padding: 24px; border-radius: 12px; text-align: center;">
        <p style="font-size: 18px; margin-bottom: 16px;">¿Ganaste o perdiste?</p>
        <button onclick="recordOutcome('${betId}', 'won'); this.closest('div').remove()" style="background: #4caf50; color: white; padding: 12px 24px; border: none; border-radius: 6px; margin: 8px; cursor: pointer; font-size: 16px;">
          ✅ Gané
        </button>
        <button onclick="recordOutcome('${betId}', 'lost'); this.closest('div').remove()" style="background: #f44336; color: white; padding: 12px 24px; border: none; border-radius: 6px; margin: 8px; cursor: pointer; font-size: 16px;">
          ❌ Perdí
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function recordOutcome(betId, outcome) {
  convo.updateBetOutcome(betId, outcome);
  
  // POST to backend to store
  fetch('/api/bets/' + betId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome })
  });

  console.log(`Bet ${betId}: ${outcome}. Win rate now: ${convo.accuracy.win_rate}%`);
}
```

---

## Step 7: Database Validation

After deployment, verify tables were created:

```sql
-- Connect to Neon dashboard or via psql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversation_history', 'bet_outcomes', 'prediction_accuracy');

-- Should return 3 rows

-- Check sample data after first chat:
SELECT COUNT(*) FROM conversation_history;
SELECT COUNT(*) FROM bet_outcomes;
```

---

## Step 8: Test End-to-End

### Test 1: Chat API
```bash
curl https://mundial2026.vercel.app/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuál es la probabilidad de Argentina gana?",
    "session_id": "test_session_123",
    "language": "es",
    "bankroll": 5000
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "response": "Argentina tiene una probabilidad estimada de...",
  "tool_calls": [
    {"name": "analyze_match", "result": {...}}
  ],
  "recommendations": ["Buena oportunidad si los odds superan 2.0"],
  "confidence": "high",
  "bankroll_impact": 0.05
}
```

### Test 2: UI Chat
1. Open https://mundial2026.vercel.app
2. Type in Bankroll: 5000
3. Type in Chat: "Argentina vs Marruecos"
4. Click Send
5. Verify response appears in chat
6. Verify UI shows recommendations

### Test 3: Odds Endpoint
```bash
curl 'https://mundial2026.vercel.app/api/odds?match_id=ARG-MAR&market=1x2_home&model_prob=0.45'
```

**Expected:**
```json
{
  "success": true,
  "match_id": "ARG-MAR",
  "market": "1x2_home",
  "odds": 2.2,
  "model_probability": 45.0,
  "edge": 4.55,
  "recommendation": "✅VALOR"
}
```

---

## Step 9: Monitor & Optimize

### Tavily Quota
```bash
# Check Tavily usage
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_key", "query": "test", "max_results": 1}'

# Each daily cron uses ~8 searches, so 240/month (within 1000 limit)
```

### Groq Usage
```bash
# No official quota endpoint, but free tier never cuts off
# Monitor in Vercel logs for response times (~500ms target)
```

### Database Growth
```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- conversation_history grows ~1KB per message = ~500MB for 500k messages
-- Should stay well under 3GB Hobby limit
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "GROQ_API_KEY not set" | Add to Vercel env: `vercel env add GROQ_API_KEY` |
| Chat returns error 500 | Check Vercel logs: `vercel logs` |
| No edge calculated | Ensure model_prob param in /api/odds query |
| Language selector doesn't work | Verify `js/i18n.js` is loaded |
| localStorage not persisting | Check browser privacy settings (not incognito) |
| Tavily quota exceeded | Reduce daily queries or wait for reset |

---

## Rollback Plan

If v3.0 has issues, revert to v2.0:

```bash
git revert HEAD~5..HEAD  # Undo last 5 commits
git push origin main
# Vercel auto-redeploys from main branch

# Or manually restore old index.html
git checkout v2.0 -- index.html js/app.js
git commit -m "Revert to v2.0 UI"
git push origin main
```

---

**You're ready to go live!**
