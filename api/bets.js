// ============================================================
//  GET  /api/bets          → array of all bets
//  POST /api/bets          → create new bet   { body: bet }
//  PUT  /api/bets?id=X     → update result    { body: { result } }
//  DELETE /api/bets?id=X   → delete bet
// ============================================================
import { getDb } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const db = await getDb();

  try {
    // ── GET ─────────────────────────────────────────────────
    if (req.method === 'GET') {
      const rows = await db`
        SELECT * FROM bets ORDER BY created_at DESC LIMIT 200
      `;
      return res.json({ ok: true, bets: rows });
    }

    // ── POST ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const b = req.body;
      if (!b || !b.team || !b.market || !b.odds) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
      }
      const rows = await db`
        INSERT INTO bets
          (team, flag, market, matchup, odds, algo_prob, implied_prob,
           edge, stake, total_return, net_profit, justification)
        VALUES
          (${b.team}, ${b.flag || '🏳️'}, ${b.market}, ${b.matchup || ''},
           ${b.odds}, ${b.algoProb || null}, ${b.impliedProb || null},
           ${b.edge || null}, ${b.stake || 0}, ${b.totalReturn || 0},
           ${b.netProfit || 0}, ${b.justification || ''})
        RETURNING *
      `;
      return res.status(201).json({ ok: true, bet: rows[0] });
    }

    // ── PUT (update result) ───────────────────────────────────
    if (req.method === 'PUT') {
      const id = req.query.id;
      const { result } = req.body || {};
      if (!id || !['pending','won','lost'].includes(result)) {
        return res.status(400).json({ ok: false, error: 'Invalid id or result' });
      }
      const rows = await db`
        UPDATE bets SET result = ${result} WHERE id = ${id} RETURNING *
      `;
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Not found' });
      return res.json({ ok: true, bet: rows[0] });
    }

    // ── DELETE ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
      await db`DELETE FROM bets WHERE id = ${id}`;
      return res.json({ ok: true });
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/bets]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
