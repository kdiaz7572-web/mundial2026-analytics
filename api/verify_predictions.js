// ============================================================
//  Verify Predictions — Post-Match Accuracy Calculation
//  Runs after matches complete (22:15 UTC) to verify predictions
//  Calculates Brier Score, updates learning data, auto-learning
// ============================================================

import { getDb } from './_db.js';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

export default async function handler(req, res) {
  const secret = req.headers.authorization?.split(' ')[1];
  if (secret !== process.env.CRON_SECRET && !req.query.force) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await getDb();
    const startTime = Date.now();
    console.log('[VERIFY] Starting prediction verification and learning...');

    // Get all unverified predictions from last 48 hours
    const unverified = await db`
      SELECT * FROM match_predictions
      WHERE verified_at IS NULL
      AND date_match < NOW()
      AND date_match > NOW() - INTERVAL '48 hours'
      LIMIT 50
    `;

    console.log(`[VERIFY] Found ${unverified.length} unverified predictions`);

    const verified = [];
    const surprises = [];
    const accuracy_summary = {};
    let total_brier_score = 0;

    for (const pred of unverified) {
      try {
        // Fetch actual match result from API-Football
        const actual = await getActualResult(pred.match_id);

        if (!actual) {
          console.log(`[VERIFY] No result yet for match ${pred.match_id}`);
          continue;
        }

        // Calculate Brier Score for 1x2 market
        const actualProb = actual.winner === 'home' ? 1.0 : actual.winner === 'away' ? 0.0 : 0.5;
        const brierScore = Math.pow(pred.probability_home - actualProb, 2);
        const modelAccurate = (pred.probability_home > 0.5 && actual.winner === 'home') ||
                              (pred.probability_home < 0.5 && actual.winner === 'away') ||
                              (Math.abs(pred.probability_home - 0.5) < 0.15 && actual.winner === 'draw');

        total_brier_score += brierScore;

        // Update prediction record with verification
        await db`
          UPDATE match_predictions
          SET verified_at = NOW(),
              verified_result = ${actual.winner},
              brier_score = ${brierScore},
              verified_accurate = ${modelAccurate}
          WHERE id = ${pred.id}
        `;

        // Store in prediction_accuracy for learning
        const marketKey = '1x2';
        await db`
          INSERT INTO prediction_accuracy (
            match_id, market, model_prob, predicted_outcome, actual_outcome,
            confidence_stars, edge_calc, brier_score_val, outcome_verified_at
          ) VALUES (
            ${pred.match_id},
            ${marketKey},
            ${pred.probability_home},
            ${pred.probability_home > 0.5 ? 'home' : pred.probability_home < 0.5 ? 'away' : 'draw'},
            ${actual.winner},
            ${Math.round(pred.confidence * 5) || 3},
            ${calculateEdge(pred.probability_home, actual.winner)},
            ${brierScore},
            NOW()
          )
          ON CONFLICT (match_id) DO UPDATE SET
            actual_outcome = ${actual.winner},
            brier_score_val = ${brierScore},
            outcome_verified_at = NOW()
        `;

        // Track accuracy by market
        if (!accuracy_summary[marketKey]) {
          accuracy_summary[marketKey] = { total: 0, correct: 0, brier_sum: 0 };
        }
        accuracy_summary[marketKey].total++;
        if (modelAccurate) accuracy_summary[marketKey].correct++;
        accuracy_summary[marketKey].brier_sum += brierScore;

        verified.push({
          match: `${pred.home_team} vs ${pred.away_team}`,
          date: pred.date_match,
          predicted: pred.probability_home.toFixed(3),
          actual: actual.winner,
          brier_score: brierScore.toFixed(4),
          accurate: modelAccurate,
          reasoning_summary: pred.reasoning_chain ? pred.reasoning_chain[0] : 'N/A'
        });

        // Detect surprises (>0.20 probability difference)
        if (Math.abs(pred.probability_home - actualProb) > 0.20) {
          surprises.push({
            match: `${pred.home_team} vs ${pred.away_team}`,
            predicted_prob: pred.probability_home.toFixed(3),
            actual: actual.winner,
            difference: Math.abs(pred.probability_home - actualProb).toFixed(3),
            reasoning: pred.reasoning_chain
          });
          console.log(`[VERIFY] SURPRISE: ${pred.home_team} vs ${pred.away_team} (diff: ${Math.abs(pred.probability_home - actualProb).toFixed(3)})`);
        }

      } catch (err) {
        console.error(`[VERIFY] Error verifying ${pred.match_id}:`, err.message);
      }
    }

    const elapsed = Date.now() - startTime;
    const avg_brier = verified.length > 0 ? (total_brier_score / verified.length).toFixed(4) : 'N/A';
    const overall_accuracy = verified.length > 0
      ? ((verified.filter(v => v.accurate).length / verified.length) * 100).toFixed(1)
      : 'N/A';

    // Store summary in zak_intel
    const summary = {
      verified_count: verified.length,
      surprises_count: surprises.length,
      overall_accuracy_pct: overall_accuracy,
      avg_brier_score: avg_brier,
      by_market: accuracy_summary,
      timestamp: new Date().toISOString()
    };

    await db`
      INSERT INTO zak_intel (topic, content, summary_json, studied_at)
      VALUES (
        'prediction_verification',
        ${`Verified ${verified.length} predictions. Accuracy: ${overall_accuracy}%. Surprises: ${surprises.length}`},
        ${JSON.stringify(summary)},
        NOW()
      )
    `;

    console.log(`[VERIFY] ✅ Verified ${verified.length} predictions in ${elapsed}ms`);
    console.log(`[VERIFY] 📊 Overall Accuracy: ${overall_accuracy}% | Avg Brier: ${avg_brier}`);
    console.log(`[VERIFY] 🎯 Surprises: ${surprises.length}`);

    return res.status(200).json({
      ok: true,
      verified: verified.length,
      surprises: surprises.length,
      overall_accuracy: overall_accuracy,
      avg_brier: avg_brier,
      elapsed,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[VERIFY] Fatal error:', error);
    return res.status(500).json({
      error: 'Prediction verification failed',
      message: error.message
    });
  }
}

// Fetch actual match result from API-Football
async function getActualResult(matchId) {
  try {
    // Parse match_id format (usually "home-away" or fixture ID)
    // For now, simulate fetch from API-Football
    // In production: use API-Football fixture endpoint

    // Try to fetch from our fixture_results cache first
    const db = await getDb();
    const [cached] = await db`
      SELECT home_goals, away_goals FROM fixture_results
      WHERE fixture_id = ${matchId}
      AND updated_at > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `;

    if (cached) {
      return {
        winner: cached.home_goals > cached.away_goals ? 'home' :
                cached.away_goals > cached.home_goals ? 'away' : 'draw',
        home_goals: cached.home_goals,
        away_goals: cached.away_goals
      };
    }

    // TODO: In production, call API-Football:
    // const response = await fetch(`${API_FOOTBALL_BASE}/fixtures?id=${matchId}`, {
    //   headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    // });
    // const data = await response.json();
    // return { winner: ..., home_goals: ..., away_goals: ... };

    return null; // No result yet
  } catch (error) {
    console.error(`[getActualResult] Error for ${matchId}:`, error.message);
    return null;
  }
}

// Calculate edge (difference between model prob and actual outcome prob)
function calculateEdge(modelProb, actualWinner) {
  const actualProb = actualWinner === 'home' ? 1.0 : actualWinner === 'away' ? 0.0 : 0.5;
  return modelProb - actualProb;
}
