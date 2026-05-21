// ============================================================
//  GET  /api/fixtures        → all saved fixture results
//  POST /api/fixtures        → save/update a fixture result
//  DELETE /api/fixtures?id=X → clear a result
// ============================================================
import { getDb } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const db = await getDb();

  try {
    if (req.method === 'GET') {
      const rows = await db`
        SELECT * FROM fixture_results ORDER BY played_at DESC
      `;
      return res.json({ ok: true, fixtures: rows });
    }

    if (req.method === 'POST') {
      const f = req.body;
      if (!f?.fixtureId || !f?.home || !f?.away) {
        return res.status(400).json({ ok: false, error: 'Missing fixture data' });
      }
      const rows = await db`
        INSERT INTO fixture_results (fixture_id, home, away, home_goals, away_goals, group_name)
        VALUES (${f.fixtureId}, ${f.home}, ${f.away}, ${f.homeGoals}, ${f.awayGoals}, ${f.group || null})
        ON CONFLICT (fixture_id) DO UPDATE
          SET home_goals = EXCLUDED.home_goals,
              away_goals = EXCLUDED.away_goals,
              played_at  = NOW()
        RETURNING *
      `;
      return res.status(201).json({ ok: true, fixture: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
      await db`DELETE FROM fixture_results WHERE fixture_id = ${id}`;
      return res.json({ ok: true });
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/fixtures]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
