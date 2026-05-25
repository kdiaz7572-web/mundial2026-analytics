// ============================================================
// Rebuild trigger: 2026-05-23 22:15:00
//  Chat Endpoint - Groq LLM Integration for IA-Zak v3.0
//  - FerXxxa Intel Integration: Receives DoradoBet chat context
//  - Processes user messages, maintains conversation history,
//  - Executes tools, and returns betting recommendations
// ============================================================

import Groq from 'groq-sdk';
import { getDb } from './_db.js';

// Inline simple utility functions to avoid middleware import issues
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>]/g, '').replace(/javascript:/gi, '').slice(0, 5000);
};

const sendError = (res, statusCode, errorType, message, details = {}) => {
  res.status(statusCode).json({ success: false, error: errorType, message, ...details });
};

const sendSuccess = (res, data = {}, message = '') => {
  res.status(200).json({ success: true, message, ...data });
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * System prompt templates for Spanish and English
 * CLAUDE-LIKE REASONING: Step-by-step transparency with source citations
 */
const SYSTEM_PROMPTS = {
  es: `Eres IA-Zak v4.0 ULTRA - Un asistente de análisis de fútbol que razona como Claude.

TU FORMA DE PENSAR (Tipo Claude):
1. Siempre cuestiono mis propias conclusiones
2. Reconozco limitaciones explícitamente
3. Cito mis fuentes de datos [FBREF: ...], [Understat: ...], etc.
4. Muestro contradicciones entre fuentes
5. Advierto sobre incertidumbres y falta de datos

PROCESO DE ANÁLISIS (Paso a Paso - VISIBLE al usuario):
Paso 1: ENTIENDO - ¿Qué pregunta haces? ¿Qué necesito analizar?
Paso 2: BUSCO DATOS - Consulto: FBREF (forma), Understat (xG), API-Football, Transfermarkt (lesiones), etc.
Paso 3: IDENTIFI CO CONFLICTOS - ¿Hay datos contradictorios? ¿Qué fuente es más confiable?
Paso 4: CALCULO - Poisson base + ajustes (xG, lesiones, ELO) = probabilidades finales
Paso 5: EVALÚO RIESGO - Kelly %, Risk of Ruin, incertidumbre
Paso 6: SÍNTESIS - Recomendación estructurada con citas y advertencias

CONTEXTO DEL USUARIO:
{USER_CONTEXT}

RECOMENDACIONES DE APUESTA EN COLONES (₡):
INSTRUCCIONES CRÍTICAS para apuestas:
1. CANTIDAD EXACTA: Cuando recomiendes una apuesta, SIEMPRE incluye el monto EXACTO en colones (₡)
2. FÓRMULA KELLY: Usa la fórmula Kelly Criterion: kelly_% = (edge × probability) / odds
   - Ejemplo: Si probabilidad=68%, odds=1.80, entonces edge = (0.68×1.80)-1 = 0.224 = 22.4%
   - kelly_% = (0.224 × 0.68) / 1.80 = 8.46% del bankroll
3. EXPLICACIÓN DEL POR QUÉ: Justifica explícitamente:
   - Probabilidad estimada (ej: 68% basado en [FBREF: ...]
   - Edge calculado (ej: 22.4% porque odds undervalúan al equipo)
   - Riesgo vs recompensa (ej: Risk of Ruin = 1.5%)
4. TIPO DE APUESTA: Siempre especifica: "1x2" | "Over/Under" | "BTTS" | "Combinada"
5. VALIDACIÓN BANKROLL:
   - Si bankroll < ₡5,000: Responde "Bankroll muy bajo para cálculos precisos. Mínimo recomendado: ₡5,000"
   - Si kelly_% > 25%: Incluye ⚠️ "Kelly alto - considera Fractional Kelly (50% o 25% del sugerido)"
   - Máximo: Limita recomendaciones a ₡50,000 aunque Kelly sugiera más

SECCIÓN CRÍTICA: APUESTAS COMBINADAS INTELIGENTES (PARLAYS)
CUANDO EL USUARIO PREGUNTA SOBRE UN PARTIDO, SIEMPRE GENERAR 3-5 PARLAYS CON PERFILES DE RIESGO VARIADOS:

REGLA DE CORRELACIÓN (FUNDAMENTAL):
- "Home Win" + "Over 2.5" = POSITIVAMENTE correlacionados (equipo fuerte ofensivamente implica ambos)
  Ajuste: multiplicar probabilidad combinada por 1.05-1.10 (eventos se refuerzan)
- "Home Win" + "Under 2.5" = NEGATIVAMENTE correlacionados (equilibrio)
  Ajuste: multiplicar probabilidad combinada por 0.85-0.90 (eventos compiten)
- "BTTS" + "Over 2.5" = MUY correlacionados (ambos requieren goles abundantes)
  Ajuste: multiplicar probabilidad combinada por 1.08-1.15
- "Home Win" + "BTTS" = moderadamente correlacionados
  Ajuste: multiplicar probabilidad combinada por 0.95-1.02

ESTRUCTURA DE PARLAYS (3-5 opciones recomendadas):
1. CONSERVADOR (Kelly 3-5%):
   - Eventos anti-correlacionados (Home Win + Under X)
   - Máximo 2 eventos
   - Mayor probabilidad combinada (~25-30%), menores odds (~3.0-4.0)

2. MODERADO (Kelly 5-8%):
   - Eventos balanceados (Home Win + Over X + BTTS o similar)
   - 2-3 eventos
   - Probabilidad equilibrada (~20-25%), odds medianas (~5.0-7.0)

3. AGRESIVO (Kelly 10-15%):
   - Eventos correlacionados positivamente (Home Win + BTTS + Over X + Corners>Y)
   - 3-4 eventos
   - Menor probabilidad (~15-18%), altas odds (~8.0-12.0)

PARA CADA PARLAY INCLUIR EN JSON:
{
  "name": "Conservative - Argentina Win + Under 2.5",
  "events": [
    {"market": "1x2", "prediction": "home_win", "probability": 0.65, "odds": 1.75},
    {"market": "over_under", "prediction": "under_2.5", "probability": 0.45, "odds": 1.95}
  ],
  "combined_probability": 0.29,
  "combined_odds": 3.41,
  "correlation_adjustment": "0.85x (negative correlation - equilibrium bet)",
  "kelly_percentage": 4.2,
  "bankroll_amount_colones": 2100,
  "risk_profile": "conservative",
  "reasoning": "Argentina fuerte ofensivamente pero Francia defensiva. Combinada captura win con cautela en goles..."
}

INSTRUCCIONES SOBRE FERXXXA INTEL (CONTEXTO COMUNITARIO):
Si tienes información de FerXxxa (chat de DoradoBet), úsala para:
1. Validar tu análisis: ¿coincide con la opinión de otros apostadores?
2. Detectar arbitrage: ¿estás viendo algo que otros no ven?
3. Ajustar confianza: si la mayoría apuesta diferente, reduce tu confianza o explica por qué diverges
4. Alertas de lesiones: incorpora lesiones mencionadas en chat a tu análisis
5. Narrativas trending: considera si el chat detecta patrones que tú no viste
6. Comparación parlays: menciona si comunidad apuesta combinadas similares a las tuyas

REGLAS CRÍTICAS:
- Si NO tengo datos: "No tengo información sobre X. Necesitaría datos de Y para mejorar el análisis"
- Si HAY incertidumbre: "Mi confianza es MEDIUM porque [razón específica]"
- SIEMPRE cita fuentes: Ejemplo: [FBREF: forma 3 últimos partidos es W-W-D]
- Formato de respuesta JSON (REQUERIDO):
{
  "reasoning_chain": ["Paso 1: Entiendo que preguntas...", "Paso 2: Consulto datos...", "Paso 3: Conflictos encontrados:", "Paso 4: Calculo probabilidades", "Paso 5: Kelly % = X%, Risk of Ruin = Y%"],
  "analysis": "Análisis detallado citando fuentes",
  "data_sources_used": ["FBREF", "Understat", "API-Football", "Transfermarkt", "FerXxxa"],
  "uncertainties": ["Lesión de X no confirmada", "Datos Understat de 3 días"],
  "confidence": "medium|high|low con justificación",
  "recommendations": ["Pick 1: X con Y% de probabilidad", "Pick 2: ..."],
  "kelly_calculations": {
    "bet_1": {
      "amount_colones": 5000,
      "kelly_percentage": 12.5,
      "bet_type": "1x2",
      "reasoning": "Descripción de por qué es la mejor apuesta",
      "probability": 0.68,
      "odds": 1.80,
      "edge": 0.224,
      "risk_of_ruin": 1.5,
      "ferxxxa_context": {
        "doradobet_consensus": "Over 2.5 goles (46% de apostadores)",
        "consensus_matches_our_pick": true,
        "confidence_adjustment": "Sin ajuste - sentimiento positivo"
      }
    },
    "warnings": ["⚠️ Kelly > 25% si aplica", "Risk of Ruin calculado"]
  },
  "recommended_parlays": [
    {
      "name": "Conservative - Home Win + Under 2.5",
      "events": [
        {"market": "1x2", "prediction": "home_win", "probability": 0.65, "odds": 1.75},
        {"market": "over_under", "prediction": "under_2.5", "probability": 0.45, "odds": 1.95}
      ],
      "combined_probability": 0.29,
      "combined_odds": 3.41,
      "correlation_adjustment": "0.85x (negative correlation)",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "risk_profile": "conservative",
      "reasoning": "Combina victoria local con cautela en goles totales..."
    }
  ]
}`,

  en: `You are IA-Zak v4.0 ULTRA - A football analysis assistant that reasons like Claude.

YOUR THINKING PROCESS (Claude-Like):
1. I always question my own conclusions
2. I explicitly recognize limitations
3. I cite my data sources [FBREF: ...], [Understat: ...], etc.
4. I show contradictions between sources
5. I warn about uncertainties and missing data

ANALYSIS PROCESS (Step-by-Step - VISIBLE to user):
Step 1: UNDERSTAND - What question? What do I need to analyze?
Step 2: GATHER DATA - Consult: FBREF (form), Understat (xG), API-Football, Transfermarkt (injuries), etc.
Step 3: IDENTIFY CONFLICTS - Are there contradictions? Which source is more reliable?
Step 4: CALCULATE - Poisson base + adjustments (xG, injuries, ELO) = final probabilities
Step 5: EVALUATE RISK - Kelly %, Risk of Ruin, uncertainty
Step 6: SYNTHESIS - Structured recommendation with citations and warnings

USER CONTEXT:
{USER_CONTEXT}

BET RECOMMENDATIONS IN COLONES (₡):
CRITICAL INSTRUCTIONS for betting recommendations:
1. EXACT AMOUNT: When recommending a bet, ALWAYS include the EXACT amount in Costa Rican Colones (₡)
2. KELLY FORMULA: Use Kelly Criterion formula: kelly_% = (edge × probability) / odds
   - Example: If probability=68%, odds=1.80, then edge = (0.68×1.80)-1 = 0.224 = 22.4%
   - kelly_% = (0.224 × 0.68) / 1.80 = 8.46% of bankroll
3. EXPLAIN THE WHY: Always justify explicitly:
   - Estimated probability (e.g., 68% based on [FBREF: ...])
   - Calculated edge (e.g., 22.4% because odds undervalue the team)
   - Risk vs reward (e.g., Risk of Ruin = 1.5%)
4. BET TYPE: Always specify: "1x2" | "Over/Under" | "BTTS" | "Parlay"
5. BANKROLL VALIDATION:
   - If bankroll < ₡5,000: Respond "Bankroll too low for precise calculations. Minimum recommended: ₡5,000"
   - If kelly_% > 25%: Include ⚠️ "High Kelly - consider Fractional Kelly (50% or 25% of suggested)"
   - Maximum: Cap recommendations at ₡50,000 even if Kelly suggests more

CRITICAL SECTION: INTELLIGENT PARLAYS (MULTI-EVENT BETS)
WHEN USER ASKS ABOUT A MATCH, ALWAYS GENERATE 3-5 PARLAYS WITH VARYING RISK PROFILES:

CORRELATION RULE (FUNDAMENTAL):
- "Home Win" + "Over 2.5" = POSITIVELY correlated (strong offensive team implies both)
  Adjustment: multiply combined probability by 1.05-1.10 (events reinforce each other)
- "Home Win" + "Under 2.5" = NEGATIVELY correlated (equilibrium)
  Adjustment: multiply combined probability by 0.85-0.90 (events compete)
- "BTTS" + "Over 2.5" = HIGHLY correlated (both require abundant scoring)
  Adjustment: multiply combined probability by 1.08-1.15
- "Home Win" + "BTTS" = moderately correlated
  Adjustment: multiply combined probability by 0.95-1.02

PARLAY STRUCTURE (3-5 recommended options):
1. CONSERVATIVE (Kelly 3-5%):
   - Anti-correlated events (Home Win + Under X)
   - Maximum 2 events
   - Higher combined probability (~25-30%), lower odds (~3.0-4.0)

2. MODERATE (Kelly 5-8%):
   - Balanced events (Home Win + Over X + BTTS or similar)
   - 2-3 events
   - Balanced probability (~20-25%), medium odds (~5.0-7.0)

3. AGGRESSIVE (Kelly 10-15%):
   - Positively correlated events (Home Win + BTTS + Over X + Corners>Y)
   - 3-4 events
   - Lower probability (~15-18%), high odds (~8.0-12.0)

FOR EACH PARLAY INCLUDE IN JSON:
{
  "name": "Conservative - Home Win + Under 2.5",
  "events": [
    {"market": "1x2", "prediction": "home_win", "probability": 0.65, "odds": 1.75},
    {"market": "over_under", "prediction": "under_2.5", "probability": 0.45, "odds": 1.95}
  ],
  "combined_probability": 0.29,
  "combined_odds": 3.41,
  "correlation_adjustment": "0.85x (negative correlation - equilibrium bet)",
  "kelly_percentage": 4.2,
  "bankroll_amount_colones": 2100,
  "risk_profile": "conservative",
  "reasoning": "Home team strong offensively but strong defensive opposition. Parlay captures home win with caution on total goals..."
}

INSTRUCTIONS ABOUT FERXXXA INTEL (COMMUNITY CONTEXT):
If you have FerXxxa information (DoradoBet chat), use it to:
1. Validate your analysis: Does it match other bettors' opinions?
2. Detect arbitrage: Are you seeing something others miss?
3. Adjust confidence: If majority bets differently, lower your confidence or explain divergence
4. Include injuries: Incorporate chat-mentioned injuries into your analysis
5. Trending narratives: Consider if chat detected patterns you didn't see
6. Compare parlays: Mention if community bets similar parlays to yours

CRITICAL RULES:
- If I DON'T have data: "I don't have information on X. I would need data on Y to improve analysis"
- If there IS uncertainty: "My confidence is MEDIUM because [specific reason]"
- ALWAYS cite sources: Example: [FBREF: last 3 games form is W-W-D]
- REQUIRED JSON response format:
{
  "reasoning_chain": ["Step 1: I understand you're asking...", "Step 2: I consult data...", "Step 3: Conflicts found:", "Step 4: Calculate probabilities", "Step 5: Kelly % = X%, Risk of Ruin = Y%"],
  "analysis": "Detailed analysis citing sources",
  "data_sources_used": ["FBREF", "Understat", "API-Football", "Transfermarkt", "FerXxxa"],
  "uncertainties": ["Injury of X unconfirmed", "Understat data from 3 days ago"],
  "confidence": "medium|high|low with justification",
  "recommendations": ["Pick 1: X with Y% probability", "Pick 2: ..."],
  "kelly_calculations": {
    "bet_1": {
      "amount_colones": 5000,
      "kelly_percentage": 12.5,
      "bet_type": "1x2",
      "reasoning": "Description of why this is the best bet",
      "probability": 0.68,
      "odds": 1.80,
      "edge": 0.224,
      "risk_of_ruin": 1.5,
      "ferxxxa_context": {
        "doradobet_consensus": "Over 2.5 goals (46% of bettors)",
        "consensus_matches_our_pick": true,
        "confidence_adjustment": "No adjustment - positive sentiment"
      }
    },
    "warnings": ["⚠️ High Kelly > 25% if applicable", "Calculated Risk of Ruin"]
  },
  "recommended_parlays": [
    {
      "name": "Conservative - Home Win + Under 2.5",
      "events": [
        {"market": "1x2", "prediction": "home_win", "probability": 0.65, "odds": 1.75},
        {"market": "over_under", "prediction": "under_2.5", "probability": 0.45, "odds": 1.95}
      ],
      "combined_probability": 0.29,
      "combined_odds": 3.41,
      "correlation_adjustment": "0.85x (negative correlation)",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "risk_profile": "conservative",
      "reasoning": "Combines home win with caution on total goals..."
    }
  ]
}`
};

/**
 * POST /api/chat
 * Request: { message: string, session_id: string, language: 'es'|'en', bankroll?: number }
 * Response: { response: string, tool_calls: array, bankroll_impact?: number, ferxxxa_intel?: object }
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://mundial2026-analytics.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed', 'Only POST requests are allowed');
  }

  // Check critical dependencies FIRST
  if (!process.env.GROQ_API_KEY) {
    console.error('[chat] GROQ_API_KEY not configured - falling back');
    return sendSuccess(res, {
      response: 'IA-Zak necesita configuración. Por favor, contacta al administrador.',
      reasoning_chain: ['Revisor de configuración', 'GROQ_API_KEY no encontrada', 'Entrando en modo fallback'],
      recommendations: ['Configure GROQ_API_KEY en Vercel environment variables'],
      kelly_calculations: null,
      data_sources_used: [],
      confidence: 'unavailable',
      tool_calls: [],
      fallback: true
    }, 'Configuration required');
  }

  // Validate request
  const { message, session_id, language = 'es', bankroll } = req.body;

  if (!message || !session_id) {
    return sendError(res, 400, 'Bad Request', 'message and session_id are required');
  }

  if (!['es', 'en'].includes(language)) {
    return sendError(res, 400, 'Invalid Language', 'Language must be "es" or "en"');
  }

  // Sanitize user input
  const sanitizedMessage = sanitizeInput(message);

  try {
    const db = await getDb();

    // =====================================================
    // 1. Load conversation history (with error handling)
    // =====================================================
    let conversationHistory = [];
    try {
      conversationHistory = await db`
        SELECT user_message, zak_response FROM conversation_history
        WHERE session_id = ${session_id}
        ORDER BY created_at DESC
        LIMIT 10
      `;
    } catch (historyError) {
      console.warn('[chat] Could not load conversation history:', historyError.message);
      conversationHistory = [];
    }

    // Format for Groq: alternate user and assistant messages
    const messages = [];
    if (Array.isArray(conversationHistory)) {
      conversationHistory.reverse().forEach(msg => {
        if (msg && msg.user_message) messages.push({ role: 'user', content: msg.user_message });
        if (msg && msg.zak_response) messages.push({ role: 'assistant', content: msg.zak_response });
      });
    }
    messages.push({ role: 'user', content: sanitizedMessage });

    // =====================================================
    // 2. Prepare system prompt with user context
    // =====================================================
    let userContext = '';
    let bankrollValidation = { valid: true, warnings: [] };

    if (bankroll) {
      // Validate bankroll in colones
      if (bankroll < 5000) {
        bankrollValidation.valid = false;
        bankrollValidation.warnings.push('Bankroll < ₡5,000: Too low for precise Kelly calculations');
      }
      if (bankroll > 50000) {
        bankrollValidation.warnings.push('Bankroll > ₡50,000: Cap bet recommendations at ₡50,000');
      }

      try {
        const accuracy = await db`
          SELECT COUNT(*) as total_predictions
          FROM prediction_accuracy
          WHERE outcome_verified_at > NOW() - INTERVAL '30 days'
        `;

        const totalPredictions = accuracy && accuracy[0] ? accuracy[0].total_predictions : 0;
        const winRate = totalPredictions > 0 ? 'pending' : 'no data';

        userContext = `- Bankroll: ₡${bankroll.toLocaleString('es-CR')} (máximo de recomendación: ₡50,000)
- Predictions tracked (last 30 days): ${totalPredictions}
- Learning system active
- Kelly Criterion enabled: Use kelly_% = (edge × probability) / odds`;
      } catch (e) {
        console.warn('[chat] Could not fetch accuracy stats:', e.message);
        userContext = `- Bankroll: ₡${bankroll.toLocaleString('es-CR')} (máximo de recomendación: ₡50,000)
- Learning system active (accuracy stats unavailable)
- Kelly Criterion enabled: Use kelly_% = (edge × probability) / odds`;
      }
    } else {
      userContext = '- Bankroll: Not set (ask user to confirm before recommending bets in Colones)';
    }

    // =====================================================
    // 2.1. INTEGRATION POINT: Fetch FerXxxa Intel from DoradoBet chat
    // =====================================================
    let ferxxxaContext = '';
    let ferxxxaIntel = null;
    let ferxxxaMetadata = {
      available: false,
      age_minutes: null,
      data_freshness: 'unavailable'
    };

    try {
      const ferxxxaRes = await db`
        SELECT summary_json, studied_at FROM zak_intel
        WHERE topic = 'ferxxxa_intel'
        AND studied_at > NOW() - INTERVAL '4 hours'
        ORDER BY studied_at DESC
        LIMIT 1
      `;
      if (ferxxxaRes && ferxxxaRes[0]) {
        ferxxxaIntel = ferxxxaRes[0].summary_json;
        const studiedAt = new Date(ferxxxaRes[0].studied_at);
        const now = new Date();
        const ageMinutes = Math.round((now - studiedAt) / 60000);

        ferxxxaMetadata.available = true;
        ferxxxaMetadata.age_minutes = ageMinutes;
        ferxxxaMetadata.data_freshness = ageMinutes < 60 ? 'fresh' : ageMinutes < 180 ? 'recent' : 'aging';

        // Build FerXxxa context for system prompt
        const matchPredictions = ferxxxaIntel.match_predictions || {};
        const trendingNarratives = (ferxxxaIntel.trending_narratives || []).slice(0, 3).join(' | ');
        const injuryAlerts = (ferxxxaIntel.injury_alerts || [])
          .filter(a => a.status !== 'reported_fit')
          .map(a => `${a.player} (${a.status})`)
          .join(', ');

        const sentiment = ferxxxaIntel.sentiment_analysis || {};
        const sentimentRatio = sentiment.positive_messages && sentiment.negative_messages
          ? `${sentiment.positive_messages}+ / ${sentiment.negative_messages}-`
          : 'unknown';

        ferxxxaContext = `

FERXXXA DORADOBET CHAT INTELLIGENCE (Community Predictions):
  • Trending narratives: ${trendingNarratives || 'No trends detected'}
  • Community sentiment: ${sentimentRatio} messages (trend: ${sentiment.overall_sentiment || 'neutral'})
  • Injury reports from chat: ${injuryAlerts || 'None mentioned by community'}
  • Intel freshness: ${ageMinutes} minutes old
  • How to use: Validate your picks against community, detect divergences, incorporate chat-mentioned injuries`;

        console.log(`[chat] ✅ FerXxxa intel loaded (${ageMinutes}m old)`);
      } else {
        ferxxxaContext = '\n\nFERXXXA DORADOBET CHAT INTELLIGENCE: No recent data available (last update >4h old)';
        console.log('[chat] ⚠️ FerXxxa intel unavailable - data >4h old');
      }
    } catch (e) {
      console.warn('[chat] Could not fetch FerXxxa intel:', e.message);
      ferxxxaContext = '\n\nFERXXXA DORADOBET CHAT INTELLIGENCE: Currently unavailable (check connection)';
    }

    // Append FerXxxa context to userContext
    userContext += ferxxxaContext;

    const systemPrompt = (SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.es)
      .replace('{USER_CONTEXT}', userContext);

    // =====================================================
    // 3. Call Groq API with JSON mode
    // =====================================================
    let groqResponse;
    try {
      groqResponse = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Latest active Groq model (Llama 3.3)
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' } // Request JSON output
      });
    } catch (groqError) {
      console.error('Groq API error:', groqError.message);
      // Fallback: return basic response without LLM
      return sendSuccess(res, {
        response: 'IA-Zak está temporalmente offline. Intenta de nuevo en un momento.',
        reasoning_chain: ['Intentando conectar con Groq...', 'Servicio no disponible', 'Retornando respuesta de fallback'],
        recommendations: [],
        kelly_calculations: null,
        data_sources_used: [],
        confidence: 'low',
        tool_calls: [],
        fallback: true,
        ferxxxa_intel: ferxxxaMetadata
      }, 'IA-Zak fallback mode');
    }

    // =====================================================
    // 4. Parse Groq response
    // =====================================================
    let groqOutput;
    try {
      const responseText = groqResponse.choices[0].message.content;

      // Try direct JSON parse first
      try {
        groqOutput = JSON.parse(responseText);
      } catch (directParseError) {
        // If direct parse fails, try extracting JSON object
        const jsonMatches = responseText.match(/\{[\s\S]*?\}(?=\s*$|\s*[\]\}])/g);
        if (!jsonMatches || jsonMatches.length === 0) {
          throw new Error('No valid JSON found in response');
        }

        // Try each match, preferring longer ones (more complete)
        groqOutput = null;
        for (const match of jsonMatches.sort((a, b) => b.length - a.length)) {
          try {
            groqOutput = JSON.parse(match);
            if (groqOutput.reasoning_chain || groqOutput.response) {
              break; // Found the right object
            }
          } catch (e) {
            // Continue to next match
          }
        }

        if (!groqOutput) {
          throw new Error('Unable to parse any valid JSON from response');
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Groq response:', parseError.message);
      return sendError(res, 500, 'Parse Error', 'Failed to parse AI response. Please try again with a clearer question.');
    }

    // =====================================================
    // 5. Execute tool calls if requested
    // =====================================================
    const executedTools = [];
    let bankrollImpact = 0;

    if (groqOutput.tool_calls && Array.isArray(groqOutput.tool_calls)) {
      for (const toolCall of groqOutput.tool_calls) {
        const toolName = toolCall.name;
        const toolInput = toolCall.input;

        try {
          const toolResult = await executeGroqTool(toolName, toolInput);
          executedTools.push({
            name: toolName,
            input: toolInput,
            result: toolResult
          });

          // Update bankroll impact if Kelly calculation was called
          if (toolName === 'calculate_kelly' && toolResult.bet_size_recommended) {
            bankrollImpact = toolResult.bet_size_recommended / (bankroll || 1);
          }
        } catch (toolError) {
          console.error(`Tool ${toolName} execution failed:`, toolError.message);
          executedTools.push({
            name: toolName,
            input: toolInput,
            error: toolError.message
          });
        }
      }
    }

    // =====================================================
    // 6. Store conversation in database
    // =====================================================
    try {
      await db`
        INSERT INTO conversation_history (session_id, user_message, zak_response, user_bankroll, created_at)
        VALUES (${session_id}, ${sanitizedMessage}, ${groqOutput.response || ''}, ${bankroll || null}, NOW())
      `;
    } catch (dbError) {
      console.error('Failed to store conversation:', dbError.message);
      // Continue anyway - don't fail the response just because DB write failed
    }

    // =====================================================
    // 7. Return response with all Groq output fields + FerXxxa metadata + Parlays
    // =====================================================
    return sendSuccess(res, {
      response: groqOutput.response || groqOutput.analysis || 'No response generated',
      reasoning_chain: groqOutput.reasoning_chain || [],
      recommendations: groqOutput.recommendations || [],
      kelly_calculations: groqOutput.kelly_calculations || null,
      recommended_parlays: groqOutput.recommended_parlays || [],
      data_sources_used: groqOutput.data_sources_used || [],
      uncertainties: groqOutput.uncertainties || [],
      confidence: groqOutput.confidence || 'medium',
      tool_calls: executedTools,
      bankroll_impact: bankrollImpact > 0 ? Math.round(bankrollImpact * 10000) / 100 : null,
      language: language,
      ferxxxa_intel: ferxxxaMetadata
    }, 'Analysis complete');

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return sendError(res, 500, 'Internal Server Error', error.message, {
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
