// ============================================================
//  Chat Simple - Minimal endpoint without database
//  POST /api/chat_simple
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', 'https://mundial2026-analytics.vercel.app');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { message, session_id, language = 'es' } = req.body;

  if (!message || !session_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'message and session_id are required'
    });
  }

  // Simple response without any database
  const response = {
    success: true,
    message: message,
    session_id: session_id,
    response: `IA-Zak recibió tu mensaje: "${message}". Estoy funcionando en modo de fallback sin acceso a la base de datos. Por favor, intenta de nuevo en unos momentos.`,
    reasoning_chain: [
      'Recibí tu pregunta',
      'Base de datos no disponible',
      'Retornando respuesta de fallback',
      'Sistema listo para funcionar cuando BD esté online'
    ],
    recommendations: [],
    confidence: 'low',
    fallback: true,
    timestamp: new Date().toISOString()
  };

  return res.status(200).json(response);
}
