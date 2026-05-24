// ============================================================
//  Chat Endpoint - Groq LLM Integration for IA-Zak v3.0
//  Processes user messages, maintains conversation history,
//  executes tools, and returns betting recommendations
// ============================================================

import Groq from 'groq-sdk';
import { getDb } from './_db.js';
import { GROQ_TOOLS, executeGroqTool } from './claude_tools.js';

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

REGLAS CRÍTICAS:
- Si NO tengo datos: "No tengo información sobre X. Necesitaría datos de Y para mejorar el análisis"
- Si HAY incertidumbre: "Mi confianza es MEDIUM porque [razón específica]"
- SIEMPRE cita fuentes: Ejemplo: [FBREF: forma 3 últimos partidos es W-W-D]
- Formato de respuesta JSON (REQUERIDO):
{
  "reasoning_chain": ["Paso 1: Entiendo que preguntas...", "Paso 2: Consulto datos...", "Paso 3: Conflictos encontrados:", "Paso 4: Calculo probabilidades", "Paso 5: Kelly % = X%, Risk of Ruin = Y%"],
  "analysis": "Análisis detallado citando fuentes",
  "data_sources_used": ["FBREF", "Understat", "API-Football", "Transfermarkt"],
  "uncertainties": ["Lesión de X no confirmada", "Datos Understat de 3 días"],
  "confidence": "medium|high|low con justificación",
  "recommendations": ["Pick 1: X con Y% de probabilidad", "Pick 2: ..."],
  "kelly_calculations": {
    "bet_1": {"probability": 0.60, "odds": 1.80, "kelly_%": 12.5, "bet_size": 125},
    "warnings": ["Risk of Ruin = 2.3%"]
  }
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

CRITICAL RULES:
- If I DON'T have data: "I don't have information on X. I would need data on Y to improve analysis"
- If there IS uncertainty: "My confidence is MEDIUM because [specific reason]"
- ALWAYS cite sources: Example: [FBREF: last 3 games form is W-W-D]
- REQUIRED JSON response format:
{
  "reasoning_chain": ["Step 1: I understand you're asking...", "Step 2: I consult data...", "Step 3: Conflicts found:", "Step 4: Calculate probabilities", "Step 5: Kelly % = X%, Risk of Ruin = Y%"],
  "analysis": "Detailed analysis citing sources",
  "data_sources_used": ["FBREF", "Understat", "API-Football", "Transfermarkt"],
  "uncertainties": ["Injury of X unconfirmed", "Understat data from 3 days ago"],
  "confidence": "medium|high|low with justification",
  "recommendations": ["Pick 1: X with Y% probability", "Pick 2: ..."],
  "kelly_calculations": {
    "bet_1": {"probability": 0.60, "odds": 1.80, "kelly_%": 12.5, "bet_size": 125},
    "warnings": ["Risk of Ruin = 2.3%"]
  }
}`
};

/**
 * POST /api/chat
 * Request: { message: string, session_id: string, language: 'es'|'en', bankroll?: number }
 * Response: { response: string, tool_calls: array, bankroll_impact?: number, error?: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, session_id, language = 'es', bankroll } = req.body;

  if (!message || !session_id) {
    return res.status(400).json({ error: 'message and session_id are required' });
  }

  try {
    const db = await getDb();

    // =====================================================
    // 1. Load conversation history
    // =====================================================
    const conversationHistory = await db`
      SELECT user_message, zak_response FROM conversation_history
      WHERE session_id = ${session_id}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Format for Groq: alternate user and assistant messages
    const messages = [];
    conversationHistory.reverse().forEach(msg => {
      if (msg.user_message) messages.push({ role: 'user', content: msg.user_message });
      if (msg.zak_response) messages.push({ role: 'assistant', content: msg.zak_response });
    });
    messages.push({ role: 'user', content: message });

    // =====================================================
    // 2. Prepare system prompt with user context
    // =====================================================
    let userContext = '';
    if (bankroll) {
      const [accuracy] = await db`
        SELECT
          COUNT(*) as total_bets,
          SUM(CASE WHEN actual_outcome = predicted_outcome THEN 1 ELSE 0 END) as wins
        FROM prediction_accuracy
        WHERE created_at > NOW() - INTERVAL '30 days'
        LIMIT 1
      `;

      const winRate = accuracy.total_bets > 0
        ? Math.round((accuracy.wins / accuracy.total_bets) * 100)
        : 0;

      userContext = `- Bankroll: ${bankroll}€ (manage conservatively)
- Win rate (last 30 days): ${winRate}%
- Previous bets: ${accuracy.total_bets || 0} tracked`;
    } else {
      userContext = '- Bankroll: Not set (ask user to confirm before recommending bets)';
    }

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
      // Fallback: return simple response without LLM
      return res.status(500).json({
        error: 'Groq API unavailable',
        fallback: true,
        message: 'IA-Zak is temporarily offline. Try again in a moment.'
      });
    }

    // =====================================================
    // 4. Parse Groq response
    // =====================================================
    let groqOutput;
    try {
      const responseText = groqResponse.choices[0].message.content;
      // Extract JSON from response (Groq may wrap it)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      groqOutput = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Groq response:', parseError.message);
      return res.status(500).json({
        error: 'Failed to parse AI response',
        message: 'Please try again with a clearer question.'
      });
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
        INSERT INTO conversation_history
        (session_id, user_message, zak_response, function_calls_json, user_bankroll, created_at)
        VALUES
        (${session_id}, ${message}, ${groqOutput.response || ''}, ${JSON.stringify(executedTools)}, ${bankroll || null}, NOW())
      `;
    } catch (dbError) {
      console.error('Failed to store conversation:', dbError.message);
      // Continue anyway - don't fail the response just because DB write failed
    }

    // =====================================================
    // 7. Return response with all Groq output fields
    // =====================================================
    return res.status(200).json({
      success: true,
      response: groqOutput.response || groqOutput.analysis || 'No response generated',
      reasoning_chain: groqOutput.reasoning_chain || [],
      recommendations: groqOutput.recommendations || [],
      kelly_calculations: groqOutput.kelly_calculations || null,
      data_sources_used: groqOutput.data_sources_used || [],
      uncertainties: groqOutput.uncertainties || [],
      confidence: groqOutput.confidence || 'medium',
      tool_calls: executedTools,
      bankroll_impact: bankrollImpact > 0 ? Math.round(bankrollImpact * 10000) / 100 : null,
      language: language
    });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
