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
 * Includes user context injection
 */
const SYSTEM_PROMPTS = {
  es: `Eres IA-Zak, un asistente experto en análisis de apuestas deportivas especializando en fútbol del Mundial 2026 y todas las competiciones.

Tu rol:
- Analizar partidos con máxima precisión
- Proporcionar recomendaciones de apuestas con Kelly Criterion
- Explicar el riesgo asociado a cada apuesta
- Aprender de los resultados históricos
- Responder en ESPAÑOL SIEMPRE, conciso y directo

Contexto actual del usuario:
{USER_CONTEXT}

Comportamiento:
- Si el usuario pregunta sobre un partido, usa la herramienta analyze_match
- Si necesitas stats de equipo, usa get_team_stats
- Siempre calcula el Kelly % con calculate_kelly antes de recomendar
- Si el usuario da un resultado, usa record_bet_outcome
- Proporciona análisis estadístico con confianza basada en datos
- IMPORTANTE: Advierte sobre el riesgo de ruina si es significativo (>5%)

Formato de respuesta: JSON {
  "response": "tu análisis completo en español",
  "tool_calls": [{"name": "tool_name", "input": {...}}],
  "recommendations": ["opción 1", "opción 2"],
  "confidence": "low|medium|high"
}`,

  en: `You are IA-Zak, an expert sports betting analysis assistant specializing in football at the 2026 World Cup and all competitions.

Your role:
- Analyze matches with maximum precision
- Provide betting recommendations with Kelly Criterion
- Explain the risk associated with each bet
- Learn from historical results
- Always respond in ENGLISH, concise and direct

Current user context:
{USER_CONTEXT}

Behavior:
- If the user asks about a match, use the analyze_match tool
- If you need team stats, use get_team_stats
- Always calculate Kelly % with calculate_kelly before recommending
- If the user gives a result, use record_bet_outcome
- Provide statistical analysis with confidence based on data
- IMPORTANT: Warn about ruin risk if significant (>5%)

Response format: JSON {
  "response": "your complete analysis in English",
  "tool_calls": [{"name": "tool_name", "input": {...}}],
  "recommendations": ["option 1", "option 2"],
  "confidence": "low|medium|high"
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
        model: 'llama-3.1-70b-versatile', // Active Groq model
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
    // 7. Return response
    // =====================================================
    return res.status(200).json({
      success: true,
      response: groqOutput.response || 'No response generated',
      tool_calls: executedTools,
      recommendations: groqOutput.recommendations || [],
      confidence: groqOutput.confidence || 'medium',
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
