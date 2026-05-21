// ============================================================
//  GET /api/stats  → dashboard KPIs from DB
//  Returns: { totalBets, won, lost, pending, roi, topMarkets }
// ============================================================
import { getDb } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const db = await getDb();

  try {
    // Overall counts
    const { rows: counts } = await db`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE result = 'won')           AS won,
        COUNT(*) FILTER (WHERE result = 'lost')          AS lost,
        COUNT(*) FILTER (WHERE result = 'pending')       AS pending,
        COALESCE(SUM(stake),0)                           AS total_staked,
        COALESCE(SUM(total_return) FILTER
          (WHERE result = 'won'), 0)                     AS total_returned,
        COALESCE(AVG(edge),0)                            AS avg_edge
      FROM bets
    `;

    // Top markets by win rate
    const { rows: topMarkets } = await db`
      SELECT
        market,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE result = 'won') AS wins,
        ROUND(AVG(edge),2) AS avg_edge
      FROM bets
      WHERE result IN ('won','lost')
      GROUP BY market
      ORDER BY wins DESC
      LIMIT 5
    `;

    const s = counts[0];
    const settled = parseInt(s.won) + parseInt(s.lost);
    const roi = s.total_staked > 0
      ? (((s.total_returned - s.total_staked) / s.total_staked) * 100).toFixed(1)
      : null;

    return res.json({
      ok: true,
      stats: {
        total:        parseInt(s.total),
        won:          parseInt(s.won),
        lost:         parseInt(s.lost),
        pending:      parseInt(s.pending),
        winRate:      settled > 0 ? ((s.won / settled) * 100).toFixed(1) : null,
        roi,
        avgEdge:      parseFloat(s.avg_edge).toFixed(2),
        totalStaked:  parseFloat(s.total_staked),
        totalReturned: parseFloat(s.total_returned),
      },
      topMarkets,
    });
  } catch (err) {
    console.error('[/api/stats]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
