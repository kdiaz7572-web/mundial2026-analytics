// ============================================================
//  API: /api/intel  — Serve IA-Zak research intel to frontend
//
//  GET /api/intel                — latest summary + team mods
//  GET /api/intel?team=Argentina — specific team intel
//  GET /api/intel?topic=injuries — specific topic content
// ============================================================

import { getDb } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  try {
    const sql = await getDb();
    const { team, topic } = req.query;

    // ── Return specific team intel ──────────────────────
    if (team) {
      const rows = await sql`
        SELECT * FROM zak_team_intel
        WHERE LOWER(team_key) = LOWER(${team})
        LIMIT 1
      `;
      return res.json({
        ok: true,
        team: rows[0] || null,
      });
    }

    // ── Return specific topic content ───────────────────
    if (topic) {
      const rows = await sql`
        SELECT content, studied_at FROM zak_intel
        WHERE topic = ${topic}
        ORDER BY studied_at DESC
        LIMIT 1
      `;
      return res.json({
        ok: true,
        content: rows[0]?.content || null,
        studiedAt: rows[0]?.studied_at || null,
      });
    }

    // ── Return full intel summary (default) ─────────────
    // Latest daily summary
    const summaryRows = await sql`
      SELECT summary_json, studied_at FROM zak_intel
      WHERE topic = 'daily_summary'
      ORDER BY studied_at DESC
      LIMIT 1
    `;

    // Latest odds/news brief
    const oddsRows = await sql`
      SELECT content, studied_at FROM zak_intel
      WHERE topic = 'odds_news'
      ORDER BY studied_at DESC
      LIMIT 1
    `;

    // Latest injuries
    const injuryRows = await sql`
      SELECT content, studied_at FROM zak_intel
      WHERE topic LIKE 'injuries%'
      ORDER BY studied_at DESC
      LIMIT 1
    `;

    // All team mods
    const teamMods = await sql`
      SELECT team_key, injuries, form_notes, news, odds_notes,
             attack_mod, defense_mod, confidence, updated_at
      FROM zak_team_intel
      ORDER BY updated_at DESC
    `;

    return res.json({
      ok: true,
      lastStudied: summaryRows[0]?.studied_at || null,
      summary: summaryRows[0]?.summary_json || null,
      oddsNews: oddsRows[0]?.content || null,
      injuryBrief: injuryRows[0]?.content || null,
      teamMods: teamMods || [],
    });

  } catch (e) {
    console.error('[intel] Error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
