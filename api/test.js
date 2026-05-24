// ============================================================
//  Test Endpoint - Simple diagnostics
//  GET /api/test
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Test endpoint is working',
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasDbUrl: !!process.env.DATABASE_URL
    });
  }

  if (req.method === 'POST') {
    const { test } = req.body || {};

    // Test 1: Simple response
    if (test === 'simple') {
      return res.status(200).json({ test: 'simple', result: 'success' });
    }

    // Test 2: Try importing Groq
    if (test === 'groq') {
      try {
        const Groq = (await import('groq-sdk')).default;
        return res.status(200).json({ test: 'groq', result: 'imported', version: Groq?.version || 'unknown' });
      } catch (e) {
        return res.status(500).json({ test: 'groq', error: e.message });
      }
    }

    // Test 3: Try importing database module
    if (test === 'database') {
      try {
        const { getDb } = await import('./_db.js');
        const db = await getDb();
        // Simple ping query
        const result = await db`SELECT 1 as test`;
        return res.status(200).json({ test: 'database', result: 'connected', data: result });
      } catch (e) {
        return res.status(500).json({ test: 'database', error: e.message });
      }
    }

    return res.status(400).json({ error: 'Unknown test', test });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
