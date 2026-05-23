// ============================================================
//  i18n - Internationalization Support
//  Spanish (ES) and English (EN) translations
// ============================================================

const translations = {
  es: {
    // UI Labels
    'chat.header': '🤖 IA-Zak v3.0',
    'chat.input_placeholder': 'Pregunta sobre cualquier partido...',
    'chat.bankroll_label': 'Bankroll',
    'chat.bankroll_placeholder': '€5000',
    'chat.send_button': 'Enviar',
    'chat.language_selector': 'Español',

    // Status Bar
    'status.bankroll': 'Bankroll',
    'status.win_rate': 'Win rate',
    'status.recent_bets': 'Últimas apuestas',

    // System Messages
    'system.bankroll_set': '💰 Bankroll establecido: €{amount}',
    'system.language_changed': '🌐 Idioma cambiado a Español',
    'system.bankroll_required': '⚠️ Por favor, establece tu bankroll primero',
    'system.welcome': '🤖 IA-Zak iniciado. ¿Sobre qué partido quieres analizar?',
    'system.analyzing': '✏️ IA-Zak está analizando...',
    'system.error': '❌ Error: {error}',

    // Kelly Warnings
    'kelly.high_stake': '⚠️ Esta apuesta es el {percent}% de tu bankroll. Considera fractional Kelly.',
    'kelly.no_edge': '❌ Sin edge detectado - pérdida esperada',
    'kelly.small_edge': '⚠️ Edge muy pequeño (< 1.5%) - alta varianza',
    'kelly.above_kelly': '❌ La apuesta es {percent}% superior a Kelly - demasiado riesgo',
    'kelly.high_ror': '⚠️ Riesgo de ruina: {percent}% - considera apuesta menor',
    'kelly.excessive_stake': '⚠️ La apuesta es {percent}% del bankroll - máximo 5%',
    'kelly.strong_edge': '✅ Edge fuerte (6%+) - buena apuesta',
    'kelly.good_edge': '✅ Buen edge (3-6%) - apuesta decente',
    'kelly.positive_ev': '✅ EV positivo: €{ev} valor esperado',
    'kelly.low_ror': '✅ Riesgo de ruina muy bajo - apuesta cómoda',

    // Confidence Levels
    'confidence.high': 'ALTA',
    'confidence.medium': 'MEDIA',
    'confidence.low': 'BAJA',

    // Tool Indicators
    'tools.executed': '🔧 Herramientas ejecutadas:',
    'tools.success': '✅',
    'tools.error': '❌',

    // Recommendations
    'recommendations.header': '💡 Recomendaciones:',

    // Markets
    'market.1x2': '1x2',
    'market.btts': 'BTTS (Ambos marcan)',
    'market.over': 'Over {goals}.5',
    'market.under': 'Under {goals}.5',
    'market.corners': 'Córners',
    'market.cards': 'Tarjetas',

    // Betting
    'bet.placed': '✅ Apuesta registrada',
    'bet.feedback_title': '¿Ganaste o perdiste?',
    'bet.won': '🎉 ¡Excelente! Ganaste esta apuesta.',
    'bet.lost': '😔 Apuesta perdida. Seguimos analizando...',
    'bet.pending': 'Apuesta pendiente...',

    // Accuracy
    'accuracy.sharp': 'Sharp (>55%)',
    'accuracy.breakeven': 'Break-even',
    'accuracy.weak': 'Débil (<45%)',

    // API Errors
    'error.api_unavailable': 'API no disponible',
    'error.parse_failed': 'Error al procesar respuesta',
    'error.network': 'Error de red',
  },

  en: {
    // UI Labels
    'chat.header': '🤖 IA-Zak v3.0',
    'chat.input_placeholder': 'Ask about any match...',
    'chat.bankroll_label': 'Bankroll',
    'chat.bankroll_placeholder': '$5000',
    'chat.send_button': 'Send',
    'chat.language_selector': 'English',

    // Status Bar
    'status.bankroll': 'Bankroll',
    'status.win_rate': 'Win rate',
    'status.recent_bets': 'Recent bets',

    // System Messages
    'system.bankroll_set': '💰 Bankroll set: ${amount}',
    'system.language_changed': '🌐 Language changed to English',
    'system.bankroll_required': '⚠️ Please set your bankroll first',
    'system.welcome': '🤖 IA-Zak initialized. What match would you like to analyze?',
    'system.analyzing': '✏️ IA-Zak is analyzing...',
    'system.error': '❌ Error: {error}',

    // Kelly Warnings
    'kelly.high_stake': '⚠️ This bet is {percent}% of your bankroll. Consider fractional Kelly.',
    'kelly.no_edge': '❌ No edge detected - expected loss',
    'kelly.small_edge': '⚠️ Very small edge (< 1.5%) - high variance',
    'kelly.above_kelly': '❌ Bet is {percent}% above Kelly - too risky',
    'kelly.high_ror': '⚠️ Risk of ruin: {percent}% - consider smaller stake',
    'kelly.excessive_stake': '⚠️ Bet is {percent}% of bankroll - max 5%',
    'kelly.strong_edge': '✅ Strong edge (6%+) - good bet',
    'kelly.good_edge': '✅ Good edge (3-6%) - decent bet',
    'kelly.positive_ev': '✅ Positive EV: ${ev} expected value',
    'kelly.low_ror': '✅ Very low ruin risk - comfortable stake',

    // Confidence Levels
    'confidence.high': 'HIGH',
    'confidence.medium': 'MEDIUM',
    'confidence.low': 'LOW',

    // Tool Indicators
    'tools.executed': '🔧 Executed tools:',
    'tools.success': '✅',
    'tools.error': '❌',

    // Recommendations
    'recommendations.header': '💡 Recommendations:',

    // Markets
    'market.1x2': '1x2',
    'market.btts': 'BTTS (Both score)',
    'market.over': 'Over {goals}.5',
    'market.under': 'Under {goals}.5',
    'market.corners': 'Corners',
    'market.cards': 'Cards',

    // Betting
    'bet.placed': '✅ Bet recorded',
    'bet.feedback_title': 'Did you win or lose?',
    'bet.won': '🎉 Excellent! You won this bet.',
    'bet.lost': '😔 Bet lost. We keep analyzing...',
    'bet.pending': 'Bet pending...',

    // Accuracy
    'accuracy.sharp': 'Sharp (>55%)',
    'accuracy.breakeven': 'Break-even',
    'accuracy.weak': 'Weak (<45%)',

    // API Errors
    'error.api_unavailable': 'API unavailable',
    'error.parse_failed': 'Failed to parse response',
    'error.network': 'Network error',
  }
};

/**
 * Translation system
 */
export class i18n {
  constructor(defaultLanguage = 'es') {
    this.language = defaultLanguage;
    this.loadLanguagePreference();
  }

  /**
   * Load language preference from localStorage
   */
  loadLanguagePreference() {
    const saved = localStorage.getItem('zak_language');
    if (saved && translations[saved]) {
      this.language = saved;
    }
  }

  /**
   * Set language
   */
  setLanguage(lang) {
    if (!translations[lang]) {
      console.warn(`Language ${lang} not supported`);
      return false;
    }
    this.language = lang;
    localStorage.setItem('zak_language', lang);
    return true;
  }

  /**
   * Translate key with optional variable substitution
   */
  t(key, variables = {}) {
    const langDict = translations[this.language];
    let text = langDict?.[key] || key;

    // Substitute variables
    Object.entries(variables).forEach(([varKey, value]) => {
      text = text.replace(new RegExp(`\\{${varKey}\\}`, 'g'), value);
    });

    return text;
  }

  /**
   * Translate and capitalize
   */
  tc(key, variables = {}) {
    const text = this.t(key, variables);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Get all translations for current language
   */
  getAll() {
    return translations[this.language];
  }

  /**
   * Check if language is supported
   */
  isSupported(lang) {
    return lang in translations;
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages() {
    return Object.keys(translations);
  }
}

/**
 * System prompt for Groq (language-specific)
 */
export function getSystemPrompt(language = 'es', userContext = '') {
  const prompts = {
    es: `Eres IA-Zak, un asistente experto en análisis de apuestas deportivas especializado en fútbol del Mundial 2026 y todas las competiciones.

Tu rol:
- Analizar partidos con máxima precisión usando el modelo Poisson-Dixon-Coles
- Proporcionar recomendaciones de apuestas con Kelly Criterion
- Explicar el riesgo asociado a cada apuesta (Edge %, Kelly %, Riesgo de ruina)
- Aprender de los resultados históricos del usuario
- Responder SIEMPRE en ESPAÑOL, conciso y directo

Contexto del usuario:
${userContext}

Comportamiento:
- Si el usuario pregunta sobre un partido: usa analyze_match para obtener picks
- Si necesitas stats de equipo: usa get_team_stats
- SIEMPRE calcula Kelly % con calculate_kelly antes de recomendar apuestas
- Si el usuario da un resultado: usa record_bet_outcome para aprender
- Proporciona análisis estadístico con confianza (1-5 estrellas)
- ADVERTENCIA: Advierte sobre riesgo de ruina si >5%
- IMPORTANTE: Nunca animes a apostar más de lo prudente

Formato respuesta: JSON {
  "response": "análisis completo en español",
  "tool_calls": [{"name": "tool_name", "input": {...}}],
  "recommendations": ["opción 1", "opción 2"],
  "confidence": "low|medium|high"
}`,

    en: `You are IA-Zak, an expert sports betting analysis assistant specializing in football at the 2026 World Cup and all competitions.

Your role:
- Analyze matches with maximum precision using Poisson-Dixon-Coles model
- Provide betting recommendations with Kelly Criterion
- Explain the risk associated with each bet (Edge %, Kelly %, Risk of Ruin)
- Learn from user's historical results
- Always respond in ENGLISH, concise and direct

User context:
${userContext}

Behavior:
- If user asks about a match: use analyze_match to get picks
- If you need team stats: use get_team_stats
- ALWAYS calculate Kelly % with calculate_kelly before recommending
- If user gives a result: use record_bet_outcome to learn
- Provide statistical analysis with confidence (1-5 stars)
- WARNING: Warn about ruin risk if >5%
- IMPORTANT: Never encourage betting more than prudent

Response format: JSON {
  "response": "complete analysis in English",
  "tool_calls": [{"name": "tool_name", "input": {...}}],
  "recommendations": ["option 1", "option 2"],
  "confidence": "low|medium|high"
}`
  };

  return prompts[language] || prompts.es;
}

export default new i18n();
