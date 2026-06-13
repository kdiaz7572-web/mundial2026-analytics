// ============================================================
//  GET  /api/football?action=squad&team=<id>
//  GET  /api/football?action=player&id=<id>
//  GET  /api/football?action=players&team=<key>
//  GET  /api/football?action=topscorers&season=2026
//
//  Proxy a api-football.com (RapidAPI).
//  Si FOOTBALL_API_KEY no está configurada devuelve datos locales
//  del ZAK_KNOWLEDGE como fallback (el frontend sigue funcionando).
// ============================================================

import { getDb } from './_db.js';

// Mapa shortName → api-football team ID (liga de clasificatorias / selecciones)
const TEAM_IDS = {
  ARG: 26,  BRA: 6,   FRA: 2,   ESP: 9,   ENG: 10,
  GER: 25,  POR: 27,  NED: 1118,NOR: 1118,BEL: 1,
  URU: 34,  MEX: 16,  USA: 2415,CAN: 40,  MAR: 35,
  SEN: 14,  JPN: 29,  KOR: 149, AUS: 26,  CRO: 3,
  SUI: 15,  DEN: 21,  POL: 24,  SWE: 18,  TUR: 28,
  COL: 6,   ECU: 133, CHI: 7,   PER: 144, VEN: 5,
  NGR: 31,  EGY: 30,  CMR: 8,   GHA: 5,   CIV: 20,
  ALG: 46,  TUN: 2,   IRN: 785, SAU: 36,  QAT: 3454,
};

// Teams de interés para el Mundial 2026 en api-football (season=2026 o 2024-25)
const NATIONAL_TEAM_IDS = {
  ARG: 26, BRA: 6, FRA: 2, ESP: 9, ENG: 10, GER: 25, POR: 27,
  NED: 1118, BEL: 1, URU: 34, MEX: 16, USA: 2415, CAN: 40,
  MAR: 35, SEN: 14, JPN: 29, KOR: 149, CRO: 3, SUI: 15,
};

// shortName → nombre de búsqueda en API-Football (selecciones nacionales)
const FORM_SEARCH = {
  MEX:'Mexico', RSA:'South Africa', KOR:'South Korea', CZE:'Czech Republic',
  CAN:'Canada', BIH:'Bosnia', QAT:'Qatar', SUI:'Switzerland', USA:'USA', PAR:'Paraguay',
  BRA:'Brazil', MAR:'Morocco', HAI:'Haiti', SCO:'Scotland', AUS:'Australia', TUR:'Turkey',
  GER:'Germany', CUW:'Curacao', CIV:'Ivory Coast', ECU:'Ecuador', NED:'Netherlands', JPN:'Japan',
  SWE:'Sweden', TUN:'Tunisia', ESP:'Spain', CPV:'Cape Verde', KSA:'Saudi Arabia', URU:'Uruguay',
  BEL:'Belgium', EGY:'Egypt', IRN:'Iran', NZL:'New Zealand', FRA:'France', SEN:'Senegal',
  IRQ:'Iraq', NOR:'Norway', ARG:'Argentina', ALG:'Algeria', AUT:'Austria', JOR:'Jordan',
  POR:'Portugal', COD:'Congo DR', ENG:'England', CRO:'Croatia', GHA:'Ghana', PAN:'Panama',
  UZB:'Uzbekistan', COL:'Colombia',
};

const AF_HEADERS = key => ({ 'x-rapidapi-key': key, 'x-rapidapi-host': 'v3.football.api-sports.io' });

// Resuelve el ID de la selección nacional (cacheado en team_form.api_team_id)
async function resolveTeamId(db, key, apiKey) {
  const cached = await db`SELECT api_team_id FROM team_form WHERE team_key = ${key}`;
  if (cached[0]?.api_team_id) return cached[0].api_team_id;

  const name = FORM_SEARCH[key] || key;
  const r = await fetch(`https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`, { headers: AF_HEADERS(apiKey) });
  const j = await r.json();
  const list = (j.response || []).filter(t => t.team?.national);
  if (!list.length) return null;
  // mejor match por nombre, si no el primero nacional
  const exact = list.find(t => (t.team.name || '').toLowerCase() === name.toLowerCase());
  return (exact || list[0]).team.id;
}

async function fetchSeasonFixtures(apiKey, teamId, year) {
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?team=${teamId}&season=${year}`, { headers: AF_HEADERS(apiKey) });
  const j = await r.json();
  return Array.isArray(j.response) ? j.response : [];
}

// Calcula forma desde la perspectiva del equipo (más reciente primero)
function computeForm(fixtures, teamId) {
  const finished = fixtures.filter(f => ['FT','AET','PEN'].includes(f.fixture?.status?.short));
  // Solo oficiales (excluye amistosos); si quedan muy pocos, se reincluyen amistosos
  const official = finished.filter(f => !/friendl/i.test(f.league?.name || ''));
  let used = official.length >= 6 ? official : finished;
  used = used.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)).slice(0, 12);

  const form = [], sample = [];
  let gf = 0, ga = 0, cs = 0;
  for (const f of used) {
    const isHome = f.teams.home.id === teamId;
    const my = isHome ? f.goals.home : f.goals.away;
    const opp = isHome ? f.goals.away : f.goals.home;
    if (my == null || opp == null) continue;
    form.push(my > opp ? 'W' : my < opp ? 'L' : 'D');
    gf += my; ga += opp; if (opp === 0) cs++;
    sample.push(`${f.fixture.date.slice(0,10)} ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name}`);
  }
  const n = form.length || 1;
  return {
    recentForm: form,
    gf_avg: +(gf / n).toFixed(2),
    ga_avg: +(ga / n).toFixed(2),
    clean_sheets: cs,
    official_count: official.length,
    sample,
  };
}

async function handleForm(req, res, apiKey, key) {
  if (!key || !FORM_SEARCH[key]) {
    return res.status(400).json({ ok: false, error: `team requerido (shortName válido). Ej: ?action=form&team=ARG` });
  }
  try {
    const db = await getDb();

    // Cache 7 días
    const cached = await db`SELECT * FROM team_form WHERE team_key = ${key}`;
    if (cached[0]?.recent_form && (Date.now() - new Date(cached[0].fetched_at)) < 7 * 864e5) {
      return res.json({ ok: true, source: 'db_cache', team: key, ...rowToForm(cached[0]) });
    }

    const teamId = await resolveTeamId(db, key, apiKey);
    if (!teamId) {
      if (cached[0]) return res.json({ ok: true, source: 'db_stale', team: key, ...rowToForm(cached[0]) });
      return res.json({ ok: true, source: 'unresolved', team: key, recentForm: [], note: 'No se pudo resolver el equipo en API-Football' });
    }

    let fixtures = await fetchSeasonFixtures(apiKey, teamId, 2024);
    let f = computeForm(fixtures, teamId);
    if (f.recentForm.length < 8) {
      const prev = await fetchSeasonFixtures(apiKey, teamId, 2023);
      f = computeForm(fixtures.concat(prev), teamId);
    }

    await db`
      INSERT INTO team_form (team_key, api_team_id, recent_form, gf_avg, ga_avg, clean_sheets, official_count, sample, fetched_at)
      VALUES (${key}, ${teamId}, ${JSON.stringify(f.recentForm)}, ${f.gf_avg}, ${f.ga_avg}, ${f.clean_sheets}, ${f.official_count}, ${JSON.stringify(f.sample)}, NOW())
      ON CONFLICT (team_key) DO UPDATE SET
        api_team_id = ${teamId}, recent_form = ${JSON.stringify(f.recentForm)},
        gf_avg = ${f.gf_avg}, ga_avg = ${f.ga_avg}, clean_sheets = ${f.clean_sheets},
        official_count = ${f.official_count}, sample = ${JSON.stringify(f.sample)}, fetched_at = NOW()
    `;

    return res.json({ ok: true, source: 'api-football', team: key, api_team_id: teamId, ...f });
  } catch (err) {
    console.error('[/api/football form]', err);
    return res.status(200).json({ ok: true, source: 'error', team: key, recentForm: [], error: err.message });
  }
}

function rowToForm(row) {
  return {
    recentForm: row.recent_form || [],
    gf_avg: Number(row.gf_avg), ga_avg: Number(row.ga_avg),
    clean_sheets: row.clean_sheets, official_count: row.official_count,
    sample: row.sample || [],
  };
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { action, team, id, season = '2024' } = req.query;
  const API_KEY = process.env.FOOTBALL_API_KEY;

  // ── Sin API key → devuelve fallback local ─────────────────
  if (!API_KEY) {
    return res.json({
      ok: true,
      source: 'local',
      note: 'FOOTBALL_API_KEY not configured — serving local data',
      data: getLocalFallback(action, team),
    });
  }

  // ── Forma reciente real (últimos ~12 oficiales) ───────────
  if (action === 'form') {
    return await handleForm(req, res, API_KEY, (team || '').toUpperCase());
  }

  // ── Con API key → llama a api-football.com ────────────────
  try {
    let endpoint = '';
    let cacheKey = '';

    switch (action) {
      case 'players': {
        const teamId = NATIONAL_TEAM_IDS[team?.toUpperCase()] || null;
        if (!teamId) return res.json({ ok: true, source: 'local', data: getLocalFallback('players', team) });
        endpoint = `https://v3.football.api-sports.io/players?team=${teamId}&season=${season}`;
        cacheKey  = `players:${team}:${season}`;
        break;
      }
      case 'topscorers': {
        endpoint = `https://v3.football.api-sports.io/players/topscorers?league=1&season=${season}`;
        cacheKey  = `topscorers:${season}`;
        break;
      }
      case 'player': {
        if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
        endpoint = `https://v3.football.api-sports.io/players?id=${id}&season=${season}`;
        cacheKey  = `player:${id}:${season}`;
        break;
      }
      default:
        return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }

    // Check DB cache first (TTL: 6 hours)
    const db = await getDb();
    if (action === 'players' && team) {
      const cached = await db`
        SELECT raw_json, fetched_at FROM player_stats
        WHERE team_key = ${team.toUpperCase()} AND season = ${season}
        ORDER BY fetched_at DESC LIMIT 1
      `;
      if (cached.length > 0) {
        const age = (Date.now() - new Date(cached[0].fetched_at)) / 3600000; // hours
        if (age < 6) {
          // Return all players for this team from DB
          const players = await db`
            SELECT * FROM player_stats
            WHERE team_key = ${team.toUpperCase()} AND season = ${season}
            ORDER BY goals DESC
          `;
          return res.json({ ok: true, source: 'db_cache', data: players, count: players.length });
        }
      }
    }

    // Fetch from api-football.com
    const response = await fetch(endpoint, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });

    if (!response.ok) {
      console.error('[/api/football] upstream error', response.status);
      return res.json({ ok: true, source: 'local', data: getLocalFallback(action, team) });
    }

    const json = await response.json();

    // Quota check
    const remaining = response.headers.get('x-ratelimit-requests-remaining');
    console.log(`[/api/football] API quota remaining: ${remaining}`);

    // Persist to DB (upsert player stats)
    if (action === 'players' && json.response?.length > 0) {
      await persistPlayers(db, json.response, team?.toUpperCase(), season);
    }

    return res.json({
      ok: true,
      source: 'api-football',
      quota_remaining: remaining,
      data: json.response || [],
      count: (json.response || []).length,
    });

  } catch (err) {
    console.error('[/api/football]', err);
    // Graceful fallback to local data on any error
    return res.json({
      ok: true,
      source: 'local_fallback',
      error_detail: err.message,
      data: getLocalFallback(action, team),
    });
  }
}

// ────────────────────────────────────────────────────────────
//  Persist player stats to Neon DB
// ────────────────────────────────────────────────────────────
async function persistPlayers(db, players, teamKey, season) {
  for (const item of players) {
    const p = item.player;
    const s = item.statistics?.[0];
    if (!p?.id || !s) continue;

    const goals     = s.goals?.total     || 0;
    const assists   = s.goals?.assists   || 0;
    const games     = s.games?.appearences || 0;
    const minutes   = s.games?.minutes   || 0;
    const yCards    = s.cards?.yellow    || 0;
    const rCards    = s.cards?.red       || 0;
    const shots     = s.shots?.total     || 0;
    const shotsOn   = s.shots?.on        || 0;

    await db`
      INSERT INTO player_stats (
        player_id_api, player_name, team_key, season,
        goals, assists, games, minutes,
        yellow_cards, red_cards, shots_total, shots_on,
        goals_per_game, assists_per_game, cards_per_game, shots_per_game,
        raw_json, source
      ) VALUES (
        ${p.id}, ${p.name}, ${teamKey || 'UNK'}, ${season},
        ${goals}, ${assists}, ${games}, ${minutes},
        ${yCards}, ${rCards}, ${shots}, ${shotsOn},
        ${games > 0 ? (goals / games).toFixed(3) : 0},
        ${games > 0 ? (assists / games).toFixed(3) : 0},
        ${games > 0 ? ((yCards + rCards) / games).toFixed(3) : 0},
        ${games > 0 ? (shots / games).toFixed(3) : 0},
        ${JSON.stringify(item)}::jsonb, 'api-football'
      )
      ON CONFLICT (player_id_api, season)
      DO UPDATE SET
        goals          = EXCLUDED.goals,
        assists        = EXCLUDED.assists,
        games          = EXCLUDED.games,
        minutes        = EXCLUDED.minutes,
        yellow_cards   = EXCLUDED.yellow_cards,
        red_cards      = EXCLUDED.red_cards,
        shots_total    = EXCLUDED.shots_total,
        shots_on       = EXCLUDED.shots_on,
        goals_per_game = EXCLUDED.goals_per_game,
        assists_per_game = EXCLUDED.assists_per_game,
        cards_per_game = EXCLUDED.cards_per_game,
        shots_per_game = EXCLUDED.shots_per_game,
        raw_json       = EXCLUDED.raw_json,
        fetched_at     = NOW()
    `;
  }
}

// ────────────────────────────────────────────────────────────
//  Local fallback — data from ZAK_KNOWLEDGE base stats
// ────────────────────────────────────────────────────────────
function getLocalFallback(action, team) {
  // Compact player profiles for the top stars
  const STARS = [
    { name: 'Kylian Mbappé',     team: 'FRA', goals: 24, assists: 3,  games: 36, goals_per_game: 0.67, assists_per_game: 0.08, shots_per_game: 3.6, cards_per_game: 0.08, xg_per_game: 0.58 },
    { name: 'Vinicius Junior',   team: 'BRA', goals: 14, assists: 9,  games: 28, goals_per_game: 0.50, assists_per_game: 0.32, shots_per_game: 3.1, cards_per_game: 0.18, xg_per_game: 0.42 },
    { name: 'Erling Haaland',    team: 'NOR', goals: 42, assists: 9,  games: 45, goals_per_game: 0.93, assists_per_game: 0.20, shots_per_game: 4.1, cards_per_game: 0.15, xg_per_game: 0.78 },
    { name: 'Lamine Yamal',      team: 'ESP', goals: 18, assists: 21, games: 48, goals_per_game: 0.375,assists_per_game: 0.44, shots_per_game: 3.2, cards_per_game: 0.10, xg_per_game: 0.29 },
    { name: 'Jude Bellingham',   team: 'ENG', goals: 14, assists: 8,  games: 35, goals_per_game: 0.40, assists_per_game: 0.23, shots_per_game: 2.5, cards_per_game: 0.22, xg_per_game: 0.28 },
    { name: 'Harry Kane',        team: 'ENG', goals: 34, assists: 12, games: 42, goals_per_game: 0.81, assists_per_game: 0.29, shots_per_game: 3.3, cards_per_game: 0.12, xg_per_game: 0.64 },
    { name: 'Mohamed Salah',     team: 'EGY', goals: 29, assists: 18, games: 42, goals_per_game: 0.69, assists_per_game: 0.43, shots_per_game: 3.5, cards_per_game: 0.07, xg_per_game: 0.55 },
    { name: 'Pedri',             team: 'ESP', goals: 12, assists: 14, games: 44, goals_per_game: 0.27, assists_per_game: 0.32, shots_per_game: 1.8, cards_per_game: 0.18, xg_per_game: 0.18 },
    { name: 'Rodrygo',           team: 'BRA', goals: 11, assists: 10, games: 38, goals_per_game: 0.29, assists_per_game: 0.26, shots_per_game: 2.1, cards_per_game: 0.11, xg_per_game: 0.24 },
    { name: 'Julián Álvarez',    team: 'ARG', goals: 29, assists: 8,  games: 45, goals_per_game: 0.64, assists_per_game: 0.18, shots_per_game: 2.8, cards_per_game: 0.16, xg_per_game: 0.48 },
    { name: 'Jamal Musiala',     team: 'GER', goals: 18, assists: 14, games: 38, goals_per_game: 0.47, assists_per_game: 0.37, shots_per_game: 3.2, cards_per_game: 0.13, xg_per_game: 0.35 },
    { name: 'Florian Wirtz',     team: 'GER', goals: 15, assists: 18, games: 44, goals_per_game: 0.34, assists_per_game: 0.41, shots_per_game: 2.4, cards_per_game: 0.09, xg_per_game: 0.26 },
    { name: 'Lionel Messi',      team: 'ARG', goals: 19, assists: 11, games: 28, goals_per_game: 0.68, assists_per_game: 0.39, shots_per_game: 3.0, cards_per_game: 0.11, xg_per_game: 0.52 },
    { name: 'Cristiano Ronaldo', team: 'POR', goals: 25, assists: 8,  games: 35, goals_per_game: 0.71, assists_per_game: 0.23, shots_per_game: 4.2, cards_per_game: 0.17, xg_per_game: 0.55 },
    { name: 'Bukayo Saka',       team: 'ENG', goals: 20, assists: 14, games: 45, goals_per_game: 0.44, assists_per_game: 0.31, shots_per_game: 2.8, cards_per_game: 0.09, xg_per_game: 0.36 },
    { name: 'Phil Foden',        team: 'ENG', goals: 15, assists: 12, games: 40, goals_per_game: 0.375,assists_per_game: 0.30, shots_per_game: 2.6, cards_per_game: 0.10, xg_per_game: 0.31 },
    { name: 'Pedri González',    team: 'ESP', goals: 12, assists: 14, games: 44, goals_per_game: 0.27, assists_per_game: 0.32, shots_per_game: 1.8, cards_per_game: 0.18, xg_per_game: 0.18 },
    { name: 'Leroy Sané',        team: 'GER', goals: 14, assists: 10, games: 35, goals_per_game: 0.40, assists_per_game: 0.29, shots_per_game: 2.9, cards_per_game: 0.12, xg_per_game: 0.33 },
    { name: 'Ousmane Dembélé',   team: 'FRA', goals: 11, assists: 15, games: 38, goals_per_game: 0.29, assists_per_game: 0.39, shots_per_game: 2.7, cards_per_game: 0.11, xg_per_game: 0.25 },
    { name: 'Antoine Griezmann', team: 'FRA', goals: 16, assists: 10, games: 40, goals_per_game: 0.40, assists_per_game: 0.25, shots_per_game: 2.4, cards_per_game: 0.14, xg_per_game: 0.37 },
    { name: 'Bernardo Silva',    team: 'POR', goals: 11, assists: 13, games: 44, goals_per_game: 0.25, assists_per_game: 0.30, shots_per_game: 2.1, cards_per_game: 0.11, xg_per_game: 0.22 },
    { name: 'Rúben Dias',        team: 'POR', goals: 4,  assists: 2,  games: 40, goals_per_game: 0.10, assists_per_game: 0.05, shots_per_game: 0.6, cards_per_game: 0.20, xg_per_game: 0.08 },
    { name: 'Federico Valverde', team: 'URU', goals: 12, assists: 9,  games: 42, goals_per_game: 0.29, assists_per_game: 0.21, shots_per_game: 2.4, cards_per_game: 0.21, xg_per_game: 0.22 },
    { name: 'Darwin Núñez',      team: 'URU', goals: 20, assists: 7,  games: 40, goals_per_game: 0.50, assists_per_game: 0.18, shots_per_game: 3.4, cards_per_game: 0.18, xg_per_game: 0.45 },
    { name: 'Rafael Leão',       team: 'POR', goals: 18, assists: 12, games: 38, goals_per_game: 0.47, assists_per_game: 0.32, shots_per_game: 3.1, cards_per_game: 0.13, xg_per_game: 0.40 },
    { name: 'Kevin De Bruyne',   team: 'BEL', goals: 8,  assists: 19, games: 30, goals_per_game: 0.27, assists_per_game: 0.63, shots_per_game: 2.0, cards_per_game: 0.13, xg_per_game: 0.24 },
    { name: 'Romelu Lukaku',     team: 'BEL', goals: 16, assists: 4,  games: 35, goals_per_game: 0.46, assists_per_game: 0.11, shots_per_game: 2.8, cards_per_game: 0.17, xg_per_game: 0.44 },
    { name: 'Ferran Torres',     team: 'ESP', goals: 13, assists: 9,  games: 38, goals_per_game: 0.34, assists_per_game: 0.24, shots_per_game: 2.2, cards_per_game: 0.11, xg_per_game: 0.30 },
    { name: 'Gavi',              team: 'ESP', goals: 6,  assists: 11, games: 40, goals_per_game: 0.15, assists_per_game: 0.28, shots_per_game: 1.5, cards_per_game: 0.30, xg_per_game: 0.12 },
    { name: 'Arda Güler',        team: 'TUR', goals: 9,  assists: 8,  games: 32, goals_per_game: 0.28, assists_per_game: 0.25, shots_per_game: 2.0, cards_per_game: 0.09, xg_per_game: 0.24 },
  ];

  if (action === 'players' && team) {
    const tk = team.toUpperCase();
    return STARS.filter(p => p.team === tk);
  }

  return STARS;
}
