// ============================================================
//  GET  /api/picks?home=BRA&away=ARG  → cached picks for fixture
//  POST /api/picks                    → save IA-Zak analysis
// ============================================================
import { getDb } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const db = await getDb();

  try {
    if (req.method === 'GET') {
      const { home, away } = req.query;
      if (!home || !away) {
        // Return all recent picks
        const { rows } = await db`
          SELECT home_key, away_key, lambda_home, lambda_away, created_at
          FROM picks_cache ORDER BY created_at DESC LIMIT 50
        `;
        return res.json({ ok: true, picks: rows });
      }
      const { rows } = await db`
        SELECT * FROM picks_cache
        WHERE home_key = ${home} AND away_key = ${away}
        LIMIT 1
      `;
      return res.json({ ok: true, pick: rows[0] || null });
    }

    if (req.method === 'POST') {
      const p = req.body;
      if (!p?.homeKey || !p?.awayKey || !p?.picksJson) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
      }
      const picksJson = typeof p.picksJson === 'string'
        ? p.picksJson
        : JSON.stringify(p.picksJson);

      const { rows } = await db`
        INSERT INTO picks_cache (home_key, away_key, picks_json, lambda_home, lambda_away)
        VALUES (${p.homeKey}, ${p.awayKey}, ${picksJson}::jsonb, ${p.lambdaHome || null}, ${p.lambdaAway || null})
        ON CONFLICT (home_key, away_key) DO UPDATE
          SET picks_json  = EXCLUDED.picks_json,
              lambda_home = EXCLUDED.lambda_home,
              lambda_away = EXCLUDED.lambda_away,
              created_at  = NOW()
        RETURNING *
      `;
      return res.status(201).json({ ok: true, pick: rows[0] });
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/picks]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
