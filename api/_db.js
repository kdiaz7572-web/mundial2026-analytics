// ============================================================
//  DB helper — Neon Serverless Postgres connection + auto-migration
//  Uses DATABASE_URL injected by Vercel's Neon integration
// ============================================================
import { neon } from '@neondatabase/serverless';

let _sql = null;
let migrated = false;

function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function getDb() {
  const sql = getSql();
  if (!migrated) {
    await migrate(sql);
    migrated = true;
  }
  return sql;
}

async function migrate(sql) {
  // ── Betting history ──────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS bets (
      id            SERIAL PRIMARY KEY,
      team          TEXT        NOT NULL,
      flag          TEXT        DEFAULT '🏳️',
      market        TEXT        NOT NULL,
      matchup       TEXT,
      odds          NUMERIC(6,2) NOT NULL,
      algo_prob     NUMERIC(5,2),
      implied_prob  NUMERIC(5,2),
      edge          NUMERIC(6,2),
      stake         NUMERIC(12,2) DEFAULT 0,
      total_return  NUMERIC(12,2) DEFAULT 0,
      net_profit    NUMERIC(12,2) DEFAULT 0,
      result        TEXT        DEFAULT 'pending'  CHECK (result IN ('pending','won','lost')),
      justification TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Fixture results ─────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS fixture_results (
      id          SERIAL PRIMARY KEY,
      fixture_id  TEXT        NOT NULL UNIQUE,
      home        TEXT        NOT NULL,
      away        TEXT        NOT NULL,
      home_goals  INTEGER,
      away_goals  INTEGER,
      group_name  TEXT,
      played_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── IA-Zak picks cache ────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS picks_cache (
      id          SERIAL PRIMARY KEY,
      home_key    TEXT        NOT NULL,
      away_key    TEXT        NOT NULL,
      picks_json  JSONB       NOT NULL,
      lambda_home NUMERIC(4,2),
      lambda_away NUMERIC(4,2),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(home_key, away_key)
    )
  `;

  // ── Learning engine data ──────────────────────────────
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

  // ── Player stats snapshots (from api-football.com) ────
  await sql`
    CREATE TABLE IF NOT EXISTS player_stats (
      id              SERIAL PRIMARY KEY,
      player_name     TEXT        NOT NULL,
      player_id_api   INTEGER,
      team_key        TEXT        NOT NULL,
      season          TEXT        DEFAULT '2024',
      goals           INTEGER     DEFAULT 0,
      assists         INTEGER     DEFAULT 0,
      games           INTEGER     DEFAULT 0,
      minutes         INTEGER     DEFAULT 0,
      yellow_cards    INTEGER     DEFAULT 0,
      red_cards       INTEGER     DEFAULT 0,
      shots_total     INTEGER     DEFAULT 0,
      shots_on        INTEGER     DEFAULT 0,
      goals_per_game  NUMERIC(5,3),
      assists_per_game NUMERIC(5,3),
      cards_per_game  NUMERIC(5,3),
      shots_per_game  NUMERIC(5,3),
      xg_per_game     NUMERIC(5,3),
      raw_json        JSONB,
      source          TEXT        DEFAULT 'api-football',
      fetched_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(player_id_api, season)
    )
  `;

  // ── Zak analysis log (all analyses ever run) ─────────
  await sql`
    CREATE TABLE IF NOT EXISTS zak_analyses (
      id           SERIAL PRIMARY KEY,
      home_key     TEXT        NOT NULL,
      away_key     TEXT        NOT NULL,
      analysis_json JSONB      NOT NULL,
      top_pick     TEXT,
      top_edge     NUMERIC(6,3),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Zak Intel — daily Perplexity research results ────
  await sql`
    CREATE TABLE IF NOT EXISTS zak_intel (
      id           SERIAL PRIMARY KEY,
      topic        TEXT        NOT NULL,
      content      TEXT        NOT NULL,
      summary_json JSONB,
      studied_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Zak team intel — per-team research cache ─────────
  await sql`
    CREATE TABLE IF NOT EXISTS zak_team_intel (
      id           SERIAL PRIMARY KEY,
      team_key     TEXT        NOT NULL UNIQUE,
      injuries     TEXT,
      form_notes   TEXT,
      news         TEXT,
      odds_notes   TEXT,
      attack_mod   NUMERIC(4,3) DEFAULT 1.0,
      defense_mod  NUMERIC(4,3) DEFAULT 1.0,
      confidence   TEXT        DEFAULT 'medium',
      injuries_detailed JSONB,
      form_last_10 JSONB,
      xg_metrics   JSONB,
      last_updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Player injuries — REAL-TIME tracking ─────────────
  await sql`
    CREATE TABLE IF NOT EXISTS player_injuries (
      id               SERIAL PRIMARY KEY,
      player_id        INTEGER,
      player_name      VARCHAR(100) NOT NULL,
      team             VARCHAR(100),
      injury_type      VARCHAR(100),
      date_injured     TIMESTAMP,
      expected_return  DATE,
      status           VARCHAR(50),
      severity         VARCHAR(20),
      impact_on_team   NUMERIC(3,1),
      data_source      VARCHAR(50),
      last_verified    TIMESTAMP,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      INDEX (player_name, team)
    )
  `;

  // ── Match predictions — WITH reasoning chain ────────
  await sql`
    CREATE TABLE IF NOT EXISTS match_predictions (
      id                   SERIAL PRIMARY KEY,
      match_id             VARCHAR(50) UNIQUE,
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
      verified_at          TIMESTAMPTZ,
      INDEX (match_id, model_version)
    )
  `;

  // ── Reasoning logs — TRANSPARENCY: cada paso visible ──
  await sql`
    CREATE TABLE IF NOT EXISTS reasoning_logs (
      id                   SERIAL PRIMARY KEY,
      conversation_id      VARCHAR(100),
      user_question        TEXT,
      reasoning_steps      TEXT,
      data_sources_checked JSONB,
      conflicts_found      JSONB,
      uncertainties        JSONB,
      final_recommendation TEXT,
      confidence_level     VARCHAR(20),
      user_bankroll        NUMERIC(12,2),
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      INDEX (conversation_id, created_at)
    )
  `;

  // ── Conversation history — chat session memory ───────
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
  await sql`CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversation_user ON conversation_history(user_id, created_at)`;

  // ── Bet outcomes — user feedback on bets ────────────
  await sql`
    CREATE TABLE IF NOT EXISTS bet_outcomes (
      id                      SERIAL PRIMARY KEY,
      conversation_id         INTEGER,
      bet_id                  INTEGER REFERENCES bets(id),
      user_reported_outcome   TEXT CHECK (user_reported_outcome IN ('won','lost','pending','skipped')),
      actual_result           TEXT CHECK (actual_result IN ('won','lost','pending')),
      verified_at             TIMESTAMPTZ,
      created_at              TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_bet_outcomes_bet ON bet_outcomes(bet_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bet_outcomes_reported ON bet_outcomes(user_reported_outcome, created_at)`;

  // ── Prediction accuracy tracking ────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS prediction_accuracy (
      id               SERIAL PRIMARY KEY,
      match_id         TEXT,
      market           TEXT        NOT NULL,
      model_prob       NUMERIC(5,4) NOT NULL,
      predicted_outcome TEXT,
      actual_outcome   TEXT,
      confidence_stars INTEGER CHECK (confidence_stars >= 1 AND confidence_stars <= 5),
      edge_calc        NUMERIC(6,3),
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      outcome_verified_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prediction_match ON prediction_accuracy(match_id, market)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prediction_created ON prediction_accuracy(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prediction_confidence ON prediction_accuracy(confidence_stars)`;
}
