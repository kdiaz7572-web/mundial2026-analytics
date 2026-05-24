// ============================================================
//  Learning Stats Endpoint - GET /api/learning_stats
//  Returns real prediction accuracy metrics and insights
//  from the database without dummy data
// ============================================================

import { getDb } from './_db.js';
import { validateLanguage, sendError, sendSuccess } from './_middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed', 'Only GET requests are allowed');
  }

  try {
    const { period = '30', language = 'es' } = req.query;
    const db = await getDb();

    // Validate period parameter (7, 14, 30, 90 days)
    const validPeriods = [7, 14, 30, 90];
    const periodDays = parseInt(period);

    if (!validPeriods.includes(periodDays)) {
      return sendError(res, 400, 'Invalid Period', `Period must be one of: ${validPeriods.join(', ')}`);
    }

    // ═══════════════════════════════════════════════════════
    // 1. Get overall accuracy metrics
    // ═══════════════════════════════════════════════════════

    const overallStats = await db`
      SELECT
        COUNT(*) as total_predictions,
        SUM(CASE WHEN predicted_outcome = actual_outcome THEN 1 ELSE 0 END)::INTEGER as correct_predictions,
        ROUND(AVG(CASE WHEN predicted_outcome = actual_outcome THEN 100 ELSE 0 END))::INTEGER as accuracy_pct,
        ROUND(AVG(brier_score_val)::NUMERIC, 3)::FLOAT as avg_brier_score,
        ROUND(AVG(edge_calc)::NUMERIC, 3)::FLOAT as avg_edge,
        MIN(created_at) as first_prediction,
        MAX(outcome_verified_at) as last_verification
      FROM prediction_accuracy
      WHERE outcome_verified_at > NOW() - INTERVAL '${periodDays} days'
      AND outcome_verified_at IS NOT NULL
    `;

    const stats = overallStats[0] || {
      total_predictions: 0,
      correct_predictions: 0,
      accuracy_pct: 0,
      avg_brier_score: 0,
      avg_edge: 0,
      first_prediction: null,
      last_verification: null
    };

    // ═══════════════════════════════════════════════════════
    // 2. Get accuracy by market (1x2, BTTS, Corners, etc)
    // ═══════════════════════════════════════════════════════

    const byMarket = await db`
      SELECT
        market,
        COUNT(*) as count,
        ROUND(AVG(CASE WHEN predicted_outcome = actual_outcome THEN 100 ELSE 0 END))::INTEGER as accuracy_pct,
        ROUND(AVG(confidence_stars)::NUMERIC, 2)::FLOAT as avg_confidence
      FROM prediction_accuracy
      WHERE outcome_verified_at > NOW() - INTERVAL '${periodDays} days'
      AND outcome_verified_at IS NOT NULL
      GROUP BY market
      ORDER BY accuracy_pct DESC
    `;

    // ═══════════════════════════════════════════════════════
    // 3. Get sharp markets (accuracy > 55%) and weak markets
    // ═══════════════════════════════════════════════════════

    const sharpMarkets = byMarket
      .filter(m => parseInt(m.accuracy_pct) > 55)
      .map(m => ({
        market: m.market,
        accuracy_pct: parseInt(m.accuracy_pct),
        predictions: m.count,
        recommendation: 'INCREASE_WEIGHT'
      }));

    const weakMarkets = byMarket
      .filter(m => parseInt(m.accuracy_pct) < 45)
      .map(m => ({
        market: m.market,
        accuracy_pct: parseInt(m.accuracy_pct),
        predictions: m.count,
        recommendation: 'DECREASE_WEIGHT'
      }));

    // ═══════════════════════════════════════════════════════
    // 4. Get accuracy by confidence level (1★ to 5★)
    // ═══════════════════════════════════════════════════════

    const byConfidence = await db`
      SELECT
        confidence_stars,
        COUNT(*) as count,
        ROUND(AVG(CASE WHEN predicted_outcome = actual_outcome THEN 100 ELSE 0 END))::INTEGER as accuracy_pct
      FROM prediction_accuracy
      WHERE outcome_verified_at > NOW() - INTERVAL '${periodDays} days'
      AND outcome_verified_at IS NOT NULL
      GROUP BY confidence_stars
      ORDER BY confidence_stars ASC
    `;

    // ═══════════════════════════════════════════════════════
    // 5. Get ROI calculation (if stored in database)
    // ═══════════════════════════════════════════════════════

    const roiStats = await db`
      SELECT
        SUM(CASE WHEN bankroll_impact IS NOT NULL THEN bankroll_impact ELSE 0 END)::FLOAT as total_impact,
        COUNT(CASE WHEN bankroll_impact IS NOT NULL THEN 1 END) as bets_tracked
      FROM conversation_history
      WHERE user_bankroll IS NOT NULL
      AND created_at > NOW() - INTERVAL '${periodDays} days'
    `;

    const roi = roiStats[0] || { total_impact: 0, bets_tracked: 0 };

    // ═══════════════════════════════════════════════════════
    // 6. Get learning data trends (last few learning updates)
    // ═══════════════════════════════════════════════════════

    const learningHistory = await db`
      SELECT
        studied_at,
        summary_json
      FROM zak_intel
      WHERE topic = 'learning_update'
      AND studied_at > NOW() - INTERVAL '${periodDays} days'
      ORDER BY studied_at DESC
      LIMIT 5
    `;

    // ═══════════════════════════════════════════════════════
    // 7. Build comprehensive response
    // ═══════════════════════════════════════════════════════

    const learningStats = {
      period_days: periodDays,
      generated_at: new Date().toISOString(),
      overall: {
        total_predictions: parseInt(stats.total_predictions) || 0,
        correct_predictions: parseInt(stats.correct_predictions) || 0,
        accuracy_pct: parseInt(stats.accuracy_pct) || 0,
        avg_brier_score: parseFloat(stats.avg_brier_score) || 0,
        avg_edge: parseFloat(stats.avg_edge) || 0,
        confidence: stats.total_predictions > 50 ? 'high' : (stats.total_predictions > 20 ? 'medium' : 'low')
      },
      by_market: byMarket.map(m => ({
        market: m.market,
        accuracy_pct: parseInt(m.accuracy_pct),
        predictions: parseInt(m.count),
        avg_confidence: parseFloat(m.avg_confidence) || 0
      })),
      sharp_markets: sharpMarkets,
      weak_markets: weakMarkets,
      by_confidence_level: byConfidence.map(c => ({
        stars: parseInt(c.confidence_stars),
        accuracy_pct: parseInt(c.accuracy_pct),
        predictions: parseInt(c.count)
      })),
      roi: {
        total_impact_pct: parseFloat(roi.total_impact) || 0,
        bets_tracked: parseInt(roi.bets_tracked) || 0
      },
      learning_history: learningHistory.map(l => ({
        timestamp: l.studied_at,
        insights: l.summary_json || {}
      })),
      status: {
        has_data: parseInt(stats.total_predictions) > 0,
        minimum_predictions_for_confidence: 50,
        current_predictions: parseInt(stats.total_predictions) || 0
      }
    };

    return sendSuccess(res, learningStats, `Learning stats for last ${periodDays} days`);

  } catch (error) {
    console.error('[learning_stats] Error:', error);
    return sendError(res, 500, 'Database Error', error.message);
  }
}
