// ============================================================
//  GET  /api/fixtures                  → resultados reales guardados (overlay)
//  GET  /api/fixtures?sync=1            → fuerza sync con The Odds API (scores)
//  GET  /api/fixtures (cron diario)     → sync automático
//
//  Fuente de resultados REALES: The Odds API /scores (soccer_fifa_world_cup).
//  API-Football Free no da acceso a la temporada 2026, por eso usamos
//  The Odds API que SÍ tiene el Mundial 2026 activo.
//
//  Hace match de cada evento (nombres completos en inglés) contra los
//  72 fixtures locales por par de equipos, y persiste el marcador en
//  la tabla fixture_results. El frontend hace overlay sobre FIXTURES.
// ============================================================

import { getDb } from './_db.js';
import { getWorldCupScores } from './_lib/oddspapi-client.js';

// Nombre completo (inglés, como lo devuelve The Odds API) → shortName local
const NAME_TO_SHORT = {
  'united states': 'USA', 'usa': 'USA', 'panama': 'PAN', 'uruguay': 'URU', 'morocco': 'MAR',
  'mexico': 'MEX', 'ecuador': 'ECU', 'poland': 'POL', 'cameroon': 'CMR',
  'canada': 'CAN', 'honduras': 'HON', 'japan': 'JPN', 'jamaica': 'JAM',
  'argentina': 'ARG', 'spain': 'ESP', 'saudi arabia': 'KSA', 'belgium': 'BEL',
  'brazil': 'BRA', 'australia': 'AUS', 'germany': 'GER', 'dr congo': 'COD', 'congo dr': 'COD',
  'france': 'FRA', 'venezuela': 'VEN', 'iran': 'IRN', 'nigeria': 'NGA',
  'england': 'ENG', 'south korea': 'KOR', 'korea republic': 'KOR', 'colombia': 'COL', 'ivory coast': 'CIV', "cote d'ivoire": 'CIV',
  'portugal': 'POR', 'albania': 'ALB', 'egypt': 'EGY', 'qatar': 'QAT',
  'netherlands': 'NED', 'uzbekistan': 'UZB', 'senegal': 'SEN', 'south africa': 'RSA',
  'croatia': 'CRO', 'ghana': 'GHA', 'serbia': 'SRB', 'jordan': 'JOR',
  'switzerland': 'SUI', 'indonesia': 'IDN', 'turkey': 'TUR', 'turkiye': 'TUR', 'scotland': 'SCO', 'new zealand': 'NZL',
  'austria': 'AUT', 'hungary': 'HUN', 'denmark': 'DEN', 'tunisia': 'TUN',
};

function toShort(name) {
  if (!name) return null;
  return NAME_TO_SHORT[name.trim().toLowerCase()] || null;
}

/**
 * Sincroniza resultados reales desde The Odds API → fixture_results.
 * Devuelve { synced, skipped, errors }.
 */
async function syncRealScores(db) {
  const events = await getWorldCupScores(3);
  if (!events) return { synced: 0, skipped: 0, note: 'The Odds API sin datos / sin key' };

  let synced = 0, skipped = 0;

  for (const ev of events) {
    // Solo partidos terminados con marcador
    if (!ev.completed || !Array.isArray(ev.scores)) { skipped++; continue; }

    const homeShort = toShort(ev.home_team);
    const awayShort = toShort(ev.away_team);
    if (!homeShort || !awayShort) { skipped++; continue; }

    // scores: [{name, score}] — emparejar por nombre
    let hg = null, ag = null;
    for (const s of ev.scores) {
      const sn = toShort(s.name);
      const val = parseInt(s.score, 10);
      if (Number.isNaN(val)) continue;
      if (sn === homeShort) hg = val;
      else if (sn === awayShort) ag = val;
    }
    if (hg === null || ag === null) { skipped++; continue; }

    const fixtureId = `${homeShort}_${awayShort}`;
    try {
      // upsert manual (no hay unique constraint): borra previo y reinserta
      await db`DELETE FROM fixture_results WHERE fixture_id = ${fixtureId}`;
      await db`
        INSERT INTO fixture_results (fixture_id, home, away, home_goals, away_goals, played_at)
        VALUES (${fixtureId}, ${homeShort}, ${awayShort}, ${hg}, ${ag}, NOW())
      `;
      synced++;
    } catch (e) {
      console.warn('[fixtures] insert error', fixtureId, e.message);
    }
  }
  return { synced, skipped, total_events: events.length };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Cron de Vercel manda header especial; también aceptamos ?sync=1 manual
  const isCron = !!req.headers['x-vercel-cron'];
  const forceSync = req.query.sync === '1' || isCron;

  try {
    const db = await getDb();

    let syncReport = null;
    if (forceSync) {
      syncReport = await syncRealScores(db);
    }

    // Devolver todos los resultados reales guardados (overlay para el frontend)
    const rows = await db`
      SELECT fixture_id, home, away, home_goals, away_goals, group_name, played_at
      FROM fixture_results
      ORDER BY played_at DESC
    `;

    // Mapa { "HOME_AWAY": {home, away, home_goals, away_goals} } para overlay rápido
    const results = {};
    for (const r of rows) {
      results[`${r.home}_${r.away}`] = {
        home: r.home, away: r.away,
        homeGoals: r.home_goals, awayGoals: r.away_goals,
        playedAt: r.played_at,
      };
    }

    return res.status(200).json({
      ok: true,
      count: rows.length,
      results,
      synced: syncReport,
      source: 'The Odds API (soccer_fifa_world_cup) + Neon Postgres',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/fixtures]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
