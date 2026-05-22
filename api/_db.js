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
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}
