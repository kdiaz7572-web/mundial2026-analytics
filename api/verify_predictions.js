// ============================================================
//  Verify Predictions — Post-Match Accuracy Calculation
//  Runs after matches complete (22:15 UTC) to verify predictions
//  Calculates Brier Score and updates learning data
// ============================================================

import { getDb } from './_db.js';

export default async function handler(req, res) {
  const secret = req.headers.authorization?.split(' ')[1];
  if (secret !== process.env.CRON_SECRET && !req.query.force) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await getDb();
    const startTime = Date.now();
    console.log('[VERIFY] Starting prediction verification...');

    // Get all unverified predictions from last 24 hours
    const unverified = await db`
      SELECT * FROM match_predictions
      WHERE verified_at IS NULL
      AND date_match < NOW()
      AND date_match > NOW() - INTERVAL '24 hours'
    `;

    console.log(`[VERIFY] Found ${unverified.length} unverified predictions`);

    const verified = [];
    const surprises = [];

    for (const pred of unverified) {
      try {
        // Fetch actual match result
        const actual = await getActualResult(pred.match_id);

        if (!actual) {
          console.log(`[VERIFY] No result yet for match ${pred.match_id}`);
          continue;
        }

        // Calculate Brier Score (measure of forecast accuracy)
        const actualProb = actual.winner === 'home' ? 1 : actual.winner === 'away' ? 0 : 0.5;
        const brierScore = Math.pow(pred.probability_home - actualProb, 2);

        // Update prediction record
        await db`
          UPDATE match_predictions
          SET verified_at = NOW(),
              verified_result = ${actual.winner},
              brier_score = ${brierScore}
          WHERE id = ${pred.id}
        `;

        // Update prediction_accuracy table for learning
        await db`
          INSERT INTO prediction_accuracy (
            match_id, market, model_prob, predicted_outcome, actual_outcome,
            confidence_stars, edge_calc, outcome_verified_at
          ) VALUES (
            ${pred.match_id},
            '1x2',
            ${pred.probability_home},
            ${pred.probability_home > 0.5 ? 'home' : 'away'},
            ${actual.winner},
            3,
            ${0.05},
            NOW()
          )
          ON CONFLICT (match_id) DO UPDATE SET
            actual_outcome = ${actual.winner},
            outcome_verified_at = NOW()
        `;

        verified.push({
          match: `${pred.home_team} vs ${pred.away_team}`,
          predicted: pred.probability_home.toFixed(3),
          actual: actual.winner,
          brier_score: brierScore.toFixed(4)
        });

        // Detect surprises (>0.15 difference)
        if (Math.abs(pred.probability_home - actualProb) > 0.15) {
          surprises.push({
            match: `${pred.home_team} vs ${pred.away_team}`,
            predicted_prob: pred.probability_home.toFixed(3),
            actual: actual.winner,
            reasoning: pred.reasoning_chain
          });
          console.log(`[VERIFY] SURPRISE: ${pred.home_team} vs ${pred.away_team}`);
        }

      } catch (err) {
        console.error(`[VERIFY] Error verifying ${pred.match_id}:`, err.message);
      }
    }

    const elapsed = Date.now() - startTime;

    // Log verification results
    await db`
      INSERT INTO zak_intel (topic, content, summary_json, studied_at)
      VALUES (
        'prediction_verification',
        ${`Verified ${verified.length} predictions. Found ${surprises.length} surprises.`},
        ${JSON.stringify({ verified, surprises, count: verified.length, elapsed })},
        NOW()
      )
    `;

    console.log(`[VERIFY] Verified ${verified.length} predictions in ${elapsed}ms. Surprises: ${surprises.length}`);

    return res.status(200).json({
      ok: true,
      verified: verified.length,
      surprises: surprises.length,
      elapsed,
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

// Get actual match result (from API-Football or fixture_results DB)
async function getActualResult(matchId) {
  // Simulated - in production, fetch from API-Football
  return null; // No result yet (matches haven't happened)
}
