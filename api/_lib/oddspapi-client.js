/**
 * ============================================================
 * The Odds API Client — Cuotas Reales de 80+ Bookmakers
 * ============================================================
 * API: https://the-odds-api.com/
 * Free tier: 500 requests/month
 * Bookmakers: bet365, betfair, draftkings, fanduel, unibet, +80 más
 * Cobertura: Soccer, World Cup, Champions League, etc.
 *
 * Key en Vercel: ODDS_API_KEY
 */

const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const THE_ODDS_API_KEY = process.env.ODDS_API_KEY;

// Soccer sport keys in The Odds API
const SOCCER_SPORT_KEYS = [
  'soccer_fifa_world_cup',
  'soccer_conmebol_copa_america',
  'soccer_uefa_euro_qualification',
  'soccer_france_ligue_one',
  'soccer_spain_la_liga',
  'soccer_epl',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a'
];

/**
 * Search for a match by team names across all soccer leagues.
 * Returns the event + odds or null if not found.
 */
export async function getMatchMarkets(fixtureId, matchInfo = {}) {
  if (!THE_ODDS_API_KEY) {
    console.warn('[OddsAPI] ODDS_API_KEY not configured');
    return null;
  }

  const home = matchInfo.home_team || matchInfo.homeTeam || '';
  const away = matchInfo.away_team || matchInfo.awayTeam || '';

  if (!home || !away) {
    console.warn('[OddsAPI] No team names provided for search');
    return null;
  }

  console.log(`[OddsAPI] Searching for: ${home} vs ${away}`);

  // Try each soccer sport key to find the match
  for (const sportKey of SOCCER_SPORT_KEYS) {
    try {
      // btts not supported by all sports in The Odds API — use h2h + totals
      const oddsResp = await fetch(
        `${THE_ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${THE_ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!oddsResp.ok) {
        if (oddsResp.status === 422) continue; // sport not available right now
        console.warn(`[OddsAPI] ${sportKey}: HTTP ${oddsResp.status}`);
        continue;
      }

      const events = await oddsResp.json();
      if (!Array.isArray(events)) continue;

      // Find matching event
      const homeLower = home.toLowerCase();
      const awayLower = away.toLowerCase();

      const match = events.find(evt => {
        const h = (evt.home_team || '').toLowerCase();
        const a = (evt.away_team || '').toLowerCase();
        return (
          (h.includes(homeLower.split(' ')[0]) || homeLower.includes(h.split(' ')[0])) &&
          (a.includes(awayLower.split(' ')[0]) || awayLower.includes(a.split(' ')[0]))
        );
      });

      if (match) {
        console.log(`[OddsAPI] ✅ Found: ${match.home_team} vs ${match.away_team} (${sportKey})`);
        return parseTheOddsApiEvent(match);
      }
    } catch (err) {
      console.warn(`[OddsAPI] Error on ${sportKey}:`, err.message);
    }
  }

  console.warn(`[OddsAPI] Match not found: ${home} vs ${away}`);
  return null;
}

/**
 * Get upcoming soccer events (for Fercha cron)
 */
export async function getUpcomingMatches() {
  if (!THE_ODDS_API_KEY) return null;

  try {
    const resp = await fetch(
      `${THE_ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds?apiKey=${THE_ODDS_API_KEY}&regions=eu,us&markets=h2h,totals&oddsFormat=decimal`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resp.ok) return null;
    const events = await resp.json();
    return Array.isArray(events) ? events.map(parseTheOddsApiEvent) : null;
  } catch (err) {
    console.warn('[OddsAPI] getUpcomingMatches error:', err.message);
    return null;
  }
}

/**
 * Get REAL scores (live + completed) for the World Cup from The Odds API.
 * Endpoint: /v4/sports/{sport}/scores?daysFrom=3
 * Returns raw events: { id, commence_time, completed, home_team, away_team,
 *                       scores: [{ name, score }] | null }
 */
export async function getWorldCupScores(daysFrom = 3) {
  if (!THE_ODDS_API_KEY) {
    console.warn('[OddsAPI] ODDS_API_KEY not configured (scores)');
    return null;
  }
  try {
    const resp = await fetch(
      `${THE_ODDS_API_BASE}/sports/soccer_fifa_world_cup/scores?apiKey=${THE_ODDS_API_KEY}&daysFrom=${daysFrom}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) {
      console.warn(`[OddsAPI] scores HTTP ${resp.status}`);
      return null;
    }
    const events = await resp.json();
    return Array.isArray(events) ? events : null;
  } catch (err) {
    console.warn('[OddsAPI] getWorldCupScores error:', err.message);
    return null;
  }
}

/**
 * Parse a The Odds API event into our standard markets format
 */
function parseTheOddsApiEvent(event) {
  const markets = {
    result_1x2: { home: null, draw: null, away: null },
    total_goals: {},
    btts: { yes: null, no: null }
  };

  // Average odds across bookmakers for best estimate
  const bookmakerCount = { h2h: 0, totals: 0 };
  const odds = { home: [], draw: [], away: [] };
  const totalsOdds = {};
  const bttsOdds = { yes: [], no: [] };

  for (const bm of (event.bookmakers || [])) {
    for (const mkt of (bm.markets || [])) {
      if (mkt.key === 'h2h') {
        bookmakerCount.h2h++;
        for (const outcome of mkt.outcomes) {
          if (outcome.name === event.home_team) odds.home.push(outcome.price);
          else if (outcome.name === event.away_team) odds.away.push(outcome.price);
          else if (outcome.name === 'Draw') odds.draw.push(outcome.price);
        }
      }

      if (mkt.key === 'totals') {
        bookmakerCount.totals++;
        for (const outcome of mkt.outcomes) {
          const line = outcome.point ? `${outcome.name.toLowerCase()}_${String(outcome.point).replace('.', '_')}` : null;
          if (line) {
            if (!totalsOdds[line]) totalsOdds[line] = [];
            totalsOdds[line].push(outcome.price);
          }
        }
      }

      if (mkt.key === 'btts') {
        for (const outcome of mkt.outcomes) {
          if (outcome.name === 'Yes') bttsOdds.yes.push(outcome.price);
          else if (outcome.name === 'No') bttsOdds.no.push(outcome.price);
        }
      }
    }
  }

  // Average the odds
  const avg = arr => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

  markets.result_1x2 = {
    home: avg(odds.home),
    draw: avg(odds.draw),
    away: avg(odds.away),
    source: 'the_odds_api'
  };

  for (const [line, prices] of Object.entries(totalsOdds)) {
    markets.total_goals[line] = avg(prices);
  }

  markets.btts = {
    yes: avg(bttsOdds.yes),
    no: avg(bttsOdds.no),
    source: 'the_odds_api'
  };

  return {
    home_team: event.home_team,
    away_team: event.away_team,
    commence_time: event.commence_time,
    sport: event.sport_key,
    markets,
    bookmakers_used: event.bookmakers?.length || 0,
    markets_found: Object.keys(markets).filter(k => {
      const m = markets[k];
      return m && (typeof m === 'object' ? Object.values(m).some(v => v !== null) : true);
    }).length,
    source: 'the_odds_api',
    fallback: false
  };
}
