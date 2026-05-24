// ============================================================
//  Health Check Endpoint - Simple diagnostic
// ============================================================

export default async function handler(req, res) {
  try {
    // Check if basic environment is set up
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasGroqKey = !!process.env.GROQ_API_KEY;

    return res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      environment: {
        database_url_set: hasDbUrl,
        groq_api_key_set: hasGroqKey,
        node_env: process.env.NODE_ENV,
        node_version: process.version
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      error: error.message
    });
  }
}
