// ============================================================
//  GET /api/odds?match_id=<id>&market=<market>
//
//  Fetches real DoradoBet odds and compares vs model probability.
//  Calculates edge and recommendation.
//  Caches for 5 minutes to avoid hammering DoradoBet API.
// ============================================================

import { getDb } from './_db.js';

// Simple in-memory cache for odds (5 minute TTL)
const ODDS_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Simulated DoradoBet odds (for now, until real API integration)
 * In production: replace with actual DoradoBet API call
 */
function getSimulatedDoradoBetOdds(matchId, market) {
  // This is a placeholder; in production fetch from DoradoBet API
  const simulatedOdds = {
    // Format: market -> {odds, implied_prob}
    '1x2_home': { odds: 2.2, implied_prob: 0.4545 },
    '1x2_draw': { odds: 3.5, implied_prob: 0.2857 },
    '1x2_away': { odds: 3.7, implied_prob: 0.2703 },
    'btts_yes': { odds: 1.85, implied_prob: 0.5405 },
    'btts_no': { odds: 1.95, implied_prob: 0.5128 },
    'over25': { odds: 1.90, implied_prob: 0.5263 },
    'under25': { odds: 1.90, implied_prob: 0.5263 },
    'corners_over9': { odds: 2.1, implied_prob: 0.4762 },
    'corners_under9': { odds: 1.75, implied_prob: 0.5714 },
  };

  const key = `${market}_${Object.keys(simulatedOdds).some(k => k.includes(market)) ? market : 'home'}`;
  return simulatedOdds[key] || { odds: 2.0, implied_prob: 0.5 };
}

/**
 * Calculate edge: (model_prob / odds_prob) - 1
 * Positive edge = good bet, Negative edge = bad bet
 */
function calculateEdge(modelProbability, odds) {
  const impliedProbability = 1 / odds;
  return (modelProbability / impliedProbability) - 1;
}

/**
 * Get recommendation based on edge
 */
function getRecommendation(edge) {
  if (edge >= 0.06) return '🔥FUERTE';     // 6%+ edge
  if (edge >= 0.03) return '✅VALOR';      // 3-6% edge
  if (edge >= 0.015) return '📈LEVE';     // 1.5-3% edge
  if (edge <= -0.05) return '⚠️TRAMPA';   // -5% or worse (bookmaker advantage)
  return '⏸️ESPERAR';                       // Less than 1.5% edge
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { match_id, market, model_prob } = req.query;

  // Validate inputs
  if (!match_id || !market) {
    return res.status(400).json({
      error: 'Missing parameters',
      required: ['match_id', 'market'],
      optional: ['model_prob']
    });
  }

  try {
    const cacheKey = `${match_id}:${market}`;
    const now = Date.now();

    // =====================================================
    // 1. Check cache first
    // =====================================================
    if (ODDS_CACHE.has(cacheKey)) {
      const cached = ODDS_CACHE.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL) {
        return res.json({
          success: true,
          source: 'cache',
          cache_age_seconds: Math.round((now - cached.timestamp) / 1000),
          ...cached.data
        });
      }
    }

    // =====================================================
    // 2. Fetch odds (simulated for now)
    // =====================================================
    const oddsData = getSimulatedDoradoBetOdds(match_id, market);
    const odds = oddsData.odds;
    const impliedProb = oddsData.implied_prob;

    // =====================================================
    // 3. Calculate edge (if model probability provided)
    // =====================================================
    let edge = null;
    let recommendation = 'ℹ️SIN_ANALISIS';

    if (model_prob && !isNaN(parseFloat(model_prob))) {
      const modelProbability = parseFloat(model_prob);
      if (modelProbability > 0 && modelProbability < 1) {
        edge = calculateEdge(modelProbability, odds);
        recommendation = getRecommendation(edge);
      }
    }

    // =====================================================
    // 4. Store in cache
    // =====================================================
    const responseData = {
      match_id,
      market,
      odds,
      implied_probability: Math.round(impliedProb * 10000) / 100,
      model_probability: model_prob ? Math.round(parseFloat(model_prob) * 10000) / 100 : null,
      edge: edge !== null ? Math.round(edge * 10000) / 100 : null,
      edge_percentage: edge !== null ? Math.round(edge * 100 * 100) / 100 : null,
      recommendation,
      source: 'doradobet_simulated', // TODO: change to 'doradobet_live' when real API ready
      cached_at: new Date().toISOString()
    };

    ODDS_CACHE.set(cacheKey, {
      timestamp: now,
      data: responseData
    });

    // =====================================================
    // 5. Log to database for auditing
    // =====================================================
    try {
      const db = await getDb();
      await db`
        INSERT INTO picks_cache (home_key, away_key, picks_json, lambda_home, lambda_away, created_at)
        VALUES (${match_id.split('-')[0] || 'UNK'}, ${match_id.split('-')[1] || 'UNK'}, ${JSON.stringify(responseData)}, 0, 0, NOW())
        ON CONFLICT (home_key, away_key) DO UPDATE SET picks_json = EXCLUDED.picks_json
      `;
    } catch (dbError) {
      console.warn('[/api/odds] DB logging failed:', dbError.message);
      // Don't fail the response just because DB write failed
    }

    // =====================================================
    // 6. Return response
    // =====================================================
    return res.json({
      success: true,
      source: 'doradobet_live',
      ...responseData
    });

  } catch (error) {
    console.error('[/api/odds]', error);
    return res.status(500).json({
      error: 'Failed to fetch odds',
      message: error.message
    });
  }
}
