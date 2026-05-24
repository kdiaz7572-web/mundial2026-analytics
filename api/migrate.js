// ============================================================
//  Database Migration Trigger — Manual Schema Setup
//  GET /api/migrate?force=true
// ============================================================

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Security check
  const secret = req.headers.authorization?.split(' ')[1];
  const force = req.query.force === 'true';

  if (!force && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', 'https://mundial2026-analytics.vercel.app');

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'DATABASE_URL not configured',
        message: 'Set DATABASE_URL in Vercel environment variables'
      });
    }

    const sql = neon(process.env.DATABASE_URL);
    console.log('[MIGRATE] Starting database migration...');
    const startTime = Date.now();

    const results = {
      tables_created: [],
      tables_failed: [],
      indexes_created: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    // 1. Create conversation_history table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id                 SERIAL PRIMARY KEY,
          session_id         TEXT        NOT NULL,
          user_id            TEXT,
          user_message       TEXT        NOT NULL,
          zak_response       TEXT,
          function_calls_json JSONB,
          user_bankroll      NUMERIC(12,2),
          created_at         TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tables_created.push('conversation_history');
      console.log('[MIGRATE] ✅ conversation_history');
    } catch (e) {
      results.tables_failed.push({ table: 'conversation_history', error: e.message });
      console.error('[MIGRATE] ❌ conversation_history:', e.message);
    }

    // 2. Create bets table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS bets (
          id              SERIAL PRIMARY KEY,
          session_id      TEXT        NOT NULL,
          match_id        TEXT        NOT NULL,
          market          TEXT        NOT NULL,
          odds            NUMERIC(6,3) NOT NULL,
          probability     NUMERIC(5,4) NOT NULL,
          kelly_bet_size  NUMERIC(10,2),
          bankroll_used   NUMERIC(10,2),
          status          TEXT DEFAULT 'pending',
          created_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tables_created.push('bets');
      console.log('[MIGRATE] ✅ bets');
    } catch (e) {
      results.tables_failed.push({ table: 'bets', error: e.message });
      console.error('[MIGRATE] ❌ bets:', e.message);
    }

    // 3. Create bet_outcomes table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS bet_outcomes (
          id                      SERIAL PRIMARY KEY,
          conversation_id         INTEGER,
          bet_id                  INTEGER,
          user_reported_outcome   TEXT,
          actual_result           TEXT,
          verified_at             TIMESTAMPTZ,
          created_at              TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tables_created.push('bet_outcomes');
      console.log('[MIGRATE] ✅ bet_outcomes');
    } catch (e) {
      results.tables_failed.push({ table: 'bet_outcomes', error: e.message });
      console.error('[MIGRATE] ❌ bet_outcomes:', e.message);
    }

    // 4. Create prediction_accuracy table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS prediction_accuracy (
          id               SERIAL PRIMARY KEY,
          match_id         TEXT,
          market           TEXT        NOT NULL,
          model_prob       NUMERIC(5,4) NOT NULL,
          predicted_outcome TEXT,
          actual_outcome   TEXT,
          confidence_stars INTEGER,
          edge_calc        NUMERIC(6,3),
          brier_score_val  NUMERIC(6,4),
          created_at       TIMESTAMPTZ DEFAULT NOW(),
          outcome_verified_at TIMESTAMPTZ
        )
      `;
      results.tables_created.push('prediction_accuracy');
      console.log('[MIGRATE] ✅ prediction_accuracy');
    } catch (e) {
      results.tables_failed.push({ table: 'prediction_accuracy', error: e.message });
      console.error('[MIGRATE] ❌ prediction_accuracy:', e.message);
    }

    // 5. Create learning_data table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS learning_data (
          id           SERIAL PRIMARY KEY,
          market       TEXT        NOT NULL,
          predicted    NUMERIC(5,3),
          actual       BOOLEAN,
          edge         NUMERIC(6,3),
          odds         NUMERIC(6,2),
          fixture_id   TEXT,
          created_at   TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tables_created.push('learning_data');
      console.log('[MIGRATE] ✅ learning_data');
    } catch (e) {
      results.tables_failed.push({ table: 'learning_data', error: e.message });
      console.error('[MIGRATE] ❌ learning_data:', e.message);
    }

    // 6. Create zak_intel table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS zak_intel (
          id           SERIAL PRIMARY KEY,
          topic        TEXT        NOT NULL,
          content      TEXT        NOT NULL,
          summary_json JSONB,
          studied_at   TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tables_created.push('zak_intel');
      console.log('[MIGRATE] ✅ zak_intel');
    } catch (e) {
      results.tables_failed.push({ table: 'zak_intel', error: e.message });
      console.error('[MIGRATE] ❌ zak_intel:', e.message);
    }

    // 7. Create match_predictions table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS match_predictions (
          id                   SERIAL PRIMARY KEY,
          match_id             VARCHAR(50),
          date_match           TIMESTAMP,
          home_team            VARCHAR(100),
          away_team            VARCHAR(100),
          probability_home     NUMERIC(5,4),
          probability_draw     NUMERIC(5,4),
          probability_away     NUMERIC(5,4),
          xg_home              NUMERIC(4,2),
          xg_away              NUMERIC(4,2),
          model_version        VARCHAR(20),
          confidence           VARCHAR(20),
          reasoning_chain      JSONB,
          data_sources_used    JSONB,
          created_at           TIMESTAMPTZ DEFAULT NOW(),
          verified_at          TIMESTAMPTZ
        )
      `;
      results.tables_created.push('match_predictions');
      console.log('[MIGRATE] ✅ match_predictions');
    } catch (e) {
      results.tables_failed.push({ table: 'match_predictions', error: e.message });
      console.error('[MIGRATE] ❌ match_predictions:', e.message);
    }

    // 8. Create fixture_results table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS fixture_results (
          id          SERIAL PRIMARY KEY,
          fixture_id  TEXT        NOT NULL,
          home        TEXT        NOT NULL,
          away        TEXT        NOT NULL,
          home_goals  INTEGER,
          away_goals  INTEGER,
          group_name  TEXT,
          played_at   TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tables_created.push('fixture_results');
      console.log('[MIGRATE] ✅ fixture_results');
    } catch (e) {
      results.tables_failed.push({ table: 'fixture_results', error: e.message });
      console.error('[MIGRATE] ❌ fixture_results:', e.message);
    }

    // Create indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id, created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversation_user ON conversation_history(user_id, created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_bets_session ON bets(session_id, created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_bets_match ON bets(match_id, created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_bet_outcomes_bet ON bet_outcomes(bet_id, created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_prediction_match ON prediction_accuracy(match_id, market)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_prediction_created ON prediction_accuracy(created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_prediction_confidence ON prediction_accuracy(confidence_stars)`;
      results.indexes_created = 8;
      console.log('[MIGRATE] ✅ Created 8 indexes');
    } catch (e) {
      results.errors.push({ type: 'indexes', error: e.message });
      console.error('[MIGRATE] ⚠️ Index creation error:', e.message);
    }

    const elapsed = Date.now() - startTime;
    const summary = {
      status: results.tables_failed.length === 0 ? '✅ MIGRATION SUCCESSFUL' : '⚠️ PARTIAL MIGRATION',
      tables_created_count: results.tables_created.length,
      tables_failed_count: results.tables_failed.length,
      indexes_created_count: results.indexes_created,
      elapsed_ms: elapsed,
      ...results
    };

    console.log(`[MIGRATE] ${summary.status} in ${elapsed}ms`);
    console.log(`[MIGRATE] Created ${results.tables_created.length} tables, ${results.indexes_created} indexes`);
    if (results.tables_failed.length > 0) {
      console.log(`[MIGRATE] Failed tables: ${results.tables_failed.map(f => f.table).join(', ')}`);
    }

    return res.status(200).json(summary);

  } catch (error) {
    console.error('[MIGRATE] Fatal error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
