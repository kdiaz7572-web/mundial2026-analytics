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
  'mexico':'MEX','south africa':'RSA','south korea':'KOR','czech republic':'CZE',
  'canada':'CAN','bosnia & herzegovina':'BIH','bosnia and herzegovina':'BIH','qatar':'QAT','switzerland':'SUI',
  'usa':'USA','united states':'USA','paraguay':'PAR','brazil':'BRA','morocco':'MAR','haiti':'HAI','scotland':'SCO',
  'australia':'AUS','turkey':'TUR','turkiye':'TUR','germany':'GER','curacao':'CUW','curaçao':'CUW',
  'netherlands':'NED','japan':'JPN','ivory coast':'CIV',"cote d'ivoire":'CIV','ecuador':'ECU',
  'sweden':'SWE','tunisia':'TUN','spain':'ESP','cape verde':'CPV','saudi arabia':'KSA','uruguay':'URU',
  'belgium':'BEL','egypt':'EGY','iran':'IRN','new zealand':'NZL','france':'FRA','senegal':'SEN',
  'iraq':'IRQ','norway':'NOR','argentina':'ARG','algeria':'ALG','austria':'AUT','jordan':'JOR',
  'portugal':'POR','dr congo':'COD','congo dr':'COD','england':'ENG','croatia':'CRO','ghana':'GHA',
  'panama':'PAN','uzbekistan':'UZB','colombia':'COL',
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

  let synced = 0, skipped = 0, notCompleted = 0;
  const unmappedNames = new Set();

  for (const ev of events) {
    // Solo partidos terminados con marcador
    if (!ev.completed || !Array.isArray(ev.scores)) { skipped++; notCompleted++; continue; }

    const homeShort = toShort(ev.home_team);
    const awayShort = toShort(ev.away_team);
    if (!homeShort || !awayShort) {
      if (!homeShort) unmappedNames.add(ev.home_team);
      if (!awayShort) unmappedNames.add(ev.away_team);
      skipped++; continue;
    }

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
  return {
    synced, skipped, not_completed: notCompleted,
    total_events: events.length,
    unmapped_names: [...unmappedNames],
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // POST → guardar la "combinada del día" (reportada desde DoradoBet) en zak_intel,
  // para que IA-Zak la responda cuando el usuario pregunte por la mejor combinada de hoy.
  if (req.method === 'POST') {
    try {
      const db = await getDb();
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const content = body.combinada || body.content;
      if (!content) return res.status(400).json({ ok: false, error: 'Falta "combinada" en el body' });
      await db`DELETE FROM zak_intel WHERE topic = 'combinada_hoy'`;
      await db`
        INSERT INTO zak_intel (topic, content, summary_json, studied_at)
        VALUES ('combinada_hoy', ${content}, ${JSON.stringify({ date: body.date || 'hoy', ...(body.details || {}) })}, NOW())
      `;
      return res.status(200).json({ ok: true, stored: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

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
