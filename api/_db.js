// ============================================================
//  DB helper — Vercel Postgres connection + auto-migration
//  Runs CREATE TABLE IF NOT EXISTS on first request
// ============================================================
import { sql } from '@vercel/postgres';

let migrated = false;

export async function getDb() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
  return sql;
}

async function migrate() {
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
}
