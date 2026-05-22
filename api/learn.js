// ============================================================
//  API: /api/learn  — IA-Zak Daily Learning Engine
//  Triggered by Vercel Cron Job (daily at 06:00 UTC)
//  Also callable manually: GET /api/learn?force=1
//
//  Strategy (fits within Vercel Hobby 10s limit):
//  - 3 focused Perplexity calls covering all 48 WC2026 teams
//  - Results stored in zak_intel + zak_team_intel tables
//  - Frontend reads via /api/intel
// ============================================================

import { getDb } from './_db.js';

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar';

// All 48 WC2026 qualified teams
const WC2026_TEAMS = [
  // CONMEBOL
  'Argentina','Brazil','Uruguay','Colombia','Ecuador','Paraguay','Bolivia','Venezuela','Peru','Chile',
  // UEFA
  'France','Spain','England','Germany','Portugal','Netherlands','Belgium','Switzerland','Croatia','Serbia',
  'Poland','Austria','Scotland','Turkey','Slovakia','Albania','Slovenia','Georgia','Ukraine','Denmark',
  // CONCACAF
  'United States','Mexico','Canada','Costa Rica','Panama','Jamaica','Honduras','El Salvador',
  // CAF
  'Morocco','Senegal','Egypt','Nigeria','Ivory Coast','South Africa','Cameroon','DR Congo','Ghana',
  // AFC
  'Japan','South Korea','Saudi Arabia','Australia','Iran','Qatar','Uzbekistan',
  // OFC
  'New Zealand',
];

async function callPerplexity(systemPrompt, userPrompt) {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not set');
  }

  const res = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.1,
      return_citations: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

function parseTeamMods(text) {
  // Extract JSON block if present, otherwise return defaults
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (match) {
      const raw = match[1] || match[0];
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export default async function handler(req, res) {
  // Allow GET for cron trigger, POST for manual
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Verify cron secret or force param (manual trigger)
  const authHeader = req.headers['authorization'];
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isForced = req.query?.force === '1';

  if (!isCron && !isForced) {
    return res.status(401).json({ ok: false, error: 'Unauthorized. Use ?force=1 to trigger manually.' });
  }

  const startTime = Date.now();
  const results = { topics: [], teamsUpdated: 0, errors: [] };

  try {
    const sql = await getDb();

    // ── RESEARCH CALL 1: Injuries + Suspensions (top priority) ──
    try {
      const injuryText = await callPerplexity(
        `You are a football data analyst. Be concise. Today is ${new Date().toISOString().split('T')[0]}.`,
        `Research injury and suspension news for the 2026 FIFA World Cup teams.
Focus on: ${WC2026_TEAMS.slice(0, 24).join(', ')}.
For each team with significant news, output ONLY a JSON object like:
{
  "Argentina": {"injuries": "Messi fit, Di Maria doubtful (hamstring)", "attack_mod": 0.95, "defense_mod": 1.0},
  "Brazil": {"injuries": "Vinicius Jr match fit", "attack_mod": 1.0, "defense_mod": 1.0}
}
Only include teams with actual news. attack_mod/defense_mod: 1.0=normal, >1=boost, <1=weakened (min 0.7, max 1.3).`
      );

      await sql`
        INSERT INTO zak_intel (topic, content)
        VALUES ('injuries_group1', ${injuryText})
      `;
      results.topics.push('injuries_group1');

      // Parse and store team mods
      const mods1 = parseTeamMods(injuryText);
      for (const [team, data] of Object.entries(mods1)) {
        if (data && typeof data === 'object') {
          await sql`
            INSERT INTO zak_team_intel (team_key, injuries, attack_mod, defense_mod, updated_at)
            VALUES (${team}, ${data.injuries || ''}, ${data.attack_mod || 1.0}, ${data.defense_mod || 1.0}, NOW())
            ON CONFLICT (team_key) DO UPDATE SET
              injuries = EXCLUDED.injuries,
              attack_mod = EXCLUDED.attack_mod,
              defense_mod = EXCLUDED.defense_mod,
              updated_at = NOW()
          `;
          results.teamsUpdated++;
        }
      }
    } catch (e) {
      results.errors.push(`injuries_group1: ${e.message}`);
    }

    // Time check — Vercel Hobby: 10s max
    if (Date.now() - startTime > 7000) {
      return res.json({ ok: true, partial: true, results, elapsed: Date.now() - startTime });
    }

    // ── RESEARCH CALL 2: Form + Recent Results ──
    try {
      const formText = await callPerplexity(
        `You are a football analyst. Be concise. Today is ${new Date().toISOString().split('T')[0]}.`,
        `Research recent form (last 5 matches) for 2026 World Cup teams:
${WC2026_TEAMS.slice(24).join(', ')}.
Output ONLY JSON:
{
  "France": {"form": "WWWDW", "form_notes": "Won 4 of last 5, strong at home", "attack_mod": 1.05, "defense_mod": 1.0},
  "England": {"form": "WDWWL", "form_notes": "Inconsistent away form", "attack_mod": 1.0, "defense_mod": 0.95}
}
Only include teams with noteworthy form trends.`
      );

      await sql`
        INSERT INTO zak_intel (topic, content)
        VALUES ('form_group2', ${formText})
      `;
      results.topics.push('form_group2');

      const mods2 = parseTeamMods(formText);
      for (const [team, data] of Object.entries(mods2)) {
        if (data && typeof data === 'object') {
          await sql`
            INSERT INTO zak_team_intel (team_key, form_notes, attack_mod, defense_mod, updated_at)
            VALUES (${team}, ${data.form_notes || ''}, ${data.attack_mod || 1.0}, ${data.defense_mod || 1.0}, NOW())
            ON CONFLICT (team_key) DO UPDATE SET
              form_notes = EXCLUDED.form_notes,
              attack_mod = GREATEST(zak_team_intel.attack_mod, EXCLUDED.attack_mod),
              defense_mod = LEAST(zak_team_intel.defense_mod, EXCLUDED.defense_mod),
              updated_at = NOW()
          `;
          results.teamsUpdated++;
        }
      }
    } catch (e) {
      results.errors.push(`form_group2: ${e.message}`);
    }

    // Time check again
    if (Date.now() - startTime > 8500) {
      return res.json({ ok: true, partial: true, results, elapsed: Date.now() - startTime });
    }

    // ── RESEARCH CALL 3: Match Odds + Key News ──
    try {
      const oddsText = await callPerplexity(
        `You are a sports betting analyst. Today is ${new Date().toISOString().split('T')[0]}.`,
        `What are the latest betting odds movements and key tactical news for the 2026 FIFA World Cup?
Provide a brief summary covering:
1. Top 5 favorites with current odds to win the tournament
2. Any significant odds movements in the last 48 hours
3. Key tactical or squad news that affects betting value
4. Best value bets identified for the upcoming tournament

Be concise, factual, and focus on information that gives betting edge.`
      );

      await sql`
        INSERT INTO zak_intel (topic, content)
        VALUES ('odds_news', ${oddsText})
      `;
      results.topics.push('odds_news');
    } catch (e) {
      results.errors.push(`odds_news: ${e.message}`);
    }

    // Mark daily study complete
    await sql`
      INSERT INTO zak_intel (topic, content, summary_json)
      VALUES (
        'daily_summary',
        ${`Study complete: ${results.topics.join(', ')}. Teams updated: ${results.teamsUpdated}. Errors: ${results.errors.length}`},
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
