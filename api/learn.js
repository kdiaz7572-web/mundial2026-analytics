// ============================================================
//  API: /api/learn  — IA-Zak Daily Learning Engine
//  Triggered by Vercel Cron Job (daily at 06:00 UTC)
//  Also callable manually: GET /api/learn?force=1
//
//  Uses Tavily Search API (free: 1000 searches/month)
//  Strategy: 4 focused searches covering all 48 WC2026 teams
// ============================================================

import { getDb } from './_db.js';

const TAVILY_API = 'https://api.tavily.com/search';

const WC2026_TEAMS_A = [
  'Argentina','Brazil','Uruguay','Colombia','Ecuador',
  'France','Spain','England','Germany','Portugal',
  'Morocco','Senegal','Nigeria','Japan','South Korea',
  'United States','Mexico','Canada',
];

const WC2026_TEAMS_B = [
  'Netherlands','Belgium','Croatia','Switzerland','Poland',
  'Austria','Turkey','Denmark','Serbia','Ukraine',
  'Ivory Coast','Egypt','Cameroon','Saudi Arabia','Australia',
  'Costa Rica','Panama','Jamaica',
];

async function tavilySearch(query, maxResults = 5) {
  if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY not set');

  const res = await fetch(TAVILY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: true,
    }),
  });

  if (!res.ok) throw new Error(`Tavily error ${res.status}`);
  const data = await res.json();
  return data.answer || data.results?.map(r => r.content).join('\n') || '';
}

function extractTeamMods(text, teams) {
  const mods = {};
  for (const team of teams) {
    const regex = new RegExp(team, 'i');
    if (!regex.test(text)) continue;

    // Look for injury keywords near the team name
    const injuryKeywords = /injur|doubt|suspen|miss|out|absent|unavailab/i;
    const positiveKeywords = /fit|return|available|recover|good form|winning/i;
    const hasInjury  = injuryKeywords.test(text.slice(text.search(regex), text.search(regex) + 300));
    const hasPositive = positiveKeywords.test(text.slice(text.search(regex), text.search(regex) + 300));

    if (hasInjury || hasPositive) {
      mods[team] = {
        attack_mod:  hasInjury ? 0.90 : (hasPositive ? 1.05 : 1.0),
        defense_mod: hasInjury ? 0.95 : (hasPositive ? 1.02 : 1.0),
        injuries: hasInjury ? `Possible issues detected near ${team}` : '',
        form_notes: hasPositive ? 'Positive news detected' : '',
      };
    }
  }
  return mods;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  const isCron   = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isForced = req.query?.force === '1';

  if (!isCron && !isForced) {
    return res.status(401).json({ ok: false, error: 'Unauthorized. Add ?force=1 to trigger manually.' });
  }

  const startTime = Date.now();
  const results   = { topics: [], teamsUpdated: 0, errors: [] };

  try {
    const sql = await getDb();

    // ── SEARCH 1: Injuries & suspensions (top teams) ──────────
    try {
      const q1 = `FIFA World Cup 2026 team injuries suspensions squad news ${WC2026_TEAMS_A.slice(0, 9).join(' ')} 2025`;
      const text1 = await tavilySearch(q1, 5);

      await sql`INSERT INTO zak_intel (topic, content) VALUES ('injuries_a', ${text1})`;
      results.topics.push('injuries_a');

      const mods1 = extractTeamMods(text1, WC2026_TEAMS_A.slice(0, 9));
      for (const [team, data] of Object.entries(mods1)) {
        await sql`
          INSERT INTO zak_team_intel (team_key, injuries, form_notes, attack_mod, defense_mod, updated_at)
          VALUES (${team}, ${data.injuries}, ${data.form_notes}, ${data.attack_mod}, ${data.defense_mod}, NOW())
          ON CONFLICT (team_key) DO UPDATE SET
            injuries   = EXCLUDED.injuries,
            form_notes = EXCLUDED.form_notes,
            attack_mod = EXCLUDED.attack_mod,
            defense_mod = EXCLUDED.defense_mod,
            updated_at = NOW()
        `;
        results.teamsUpdated++;
      }
    } catch (e) { results.errors.push(`injuries_a: ${e.message}`); }

    if (Date.now() - startTime > 7000) {
      return res.json({ ok: true, partial: true, results, elapsed: Date.now() - startTime });
    }

    // ── SEARCH 2: Form & results (remaining teams) ────────────
    try {
      const q2 = `World Cup 2026 qualifying results recent form ${WC2026_TEAMS_B.slice(0, 9).join(' ')} 2025`;
      const text2 = await tavilySearch(q2, 5);

      await sql`INSERT INTO zak_intel (topic, content) VALUES ('form_b', ${text2})`;
      results.topics.push('form_b');

      const mods2 = extractTeamMods(text2, WC2026_TEAMS_B.slice(0, 9));
      for (const [team, data] of Object.entries(mods2)) {
        await sql`
          INSERT INTO zak_team_intel (team_key, injuries, form_notes, attack_mod, defense_mod, updated_at)
          VALUES (${team}, ${data.injuries}, ${data.form_notes}, ${data.attack_mod}, ${data.defense_mod}, NOW())
          ON CONFLICT (team_key) DO UPDATE SET
            form_notes  = EXCLUDED.form_notes,
            attack_mod  = GREATEST(zak_team_intel.attack_mod, EXCLUDED.attack_mod),
            defense_mod = LEAST(zak_team_intel.defense_mod, EXCLUDED.defense_mod),
            updated_at  = NOW()
        `;
        results.teamsUpdated++;
      }
    } catch (e) { results.errors.push(`form_b: ${e.message}`); }

    if (Date.now() - startTime > 8500) {
      return res.json({ ok: true, partial: true, results, elapsed: Date.now() - startTime });
    }

    // ── SEARCH 3: Odds & betting news ─────────────────────────
    try {
      const q3 = `World Cup 2026 betting odds favorites predictions latest news ${new Date().toISOString().split('T')[0]}`;
      const text3 = await tavilySearch(q3, 5);

      await sql`INSERT INTO zak_intel (topic, content) VALUES ('odds_news', ${text3})`;
      results.topics.push('odds_news');
    } catch (e) { results.errors.push(`odds_news: ${e.message}`); }

    // ── Mark daily study complete ──────────────────────────────
    await sql`
      INSERT INTO zak_intel (topic, content, summary_json)
      VALUES (
        'daily_summary',
        ${`Study complete: ${results.topics.join(', ')}. Teams: ${results.teamsUpdated}. Errors: ${results.errors.length}`},
        ${JSON.stringify({ ...results, studiedAt: new Date().toISOString() })}
      )
    `;

    return res.json({
      ok: true,
      results,
      elapsed: Date.now() - startTime,
      studiedAt: new Date().toISOString(),
    });

  } catch (e) {
    console.error('[learn] Fatal error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
