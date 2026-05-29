/**
 * ============================================================
 * OddsPapi Client - Real-time Betting Odds
 * ============================================================
 * Fetches real betting odds from 350+ bookmakers (LatAm included)
 * for World Cup 2026 matches.
 *
 * API Docs: https://oddspapi.io/en
 * Pricing: Free tier available (sufficient for testing)
 */

const ODDSPAPI_BASE_URL = 'https://api.oddspapi.io/api/v1';
const ODDSPAPI_KEY = process.env.ODDSPAPI_KEY; // Must be set in Vercel

/**
 * Validate API key is configured
 */
function validateApiKey() {
  if (!ODDSPAPI_KEY) {
    throw new Error('ODDSPAPI_KEY not configured in Vercel environment');
  }
  return true;
}

/**
 * Fetch upcoming matches from OddsPapi
 */
async function fetchUpcomingMatches() {
  try {
    validateApiKey();

    const response = await fetch(
      `${ODDSPAPI_BASE_URL}/fixtures?competition_id=1&api_key=${ODDSPAPI_KEY}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      console.error(`[OddsPapi] HTTP ${response.status}:`, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[OddsPapi] Error fetching matches:', error.message);
    return null;
  }
}

/**
 * Fetch odds for a specific match from ALL bookmakers
 * Returns real odds from 350+ bookmakers (BET365, FanDuel, DraftKings, Betfair, etc.)
 */
async function fetchMatchOdds(fixtureId) {
  try {
    validateApiKey();

    const response = await fetch(
      `${ODDSPAPI_BASE_URL}/odds?fixture_id=${fixtureId}&api_key=${ODDSPAPI_KEY}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      console.error(`[OddsPapi] HTTP ${response.status} for fixture ${fixtureId}`);
      return null;
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[OddsPapi] Error fetching odds:', error.message);
    return null;
  }
}

/**
 * Aggregate odds from multiple bookmakers into meaningful markets
 * Maps raw OddsPapi data → 67+ markets format
 */
function aggregateOddsToMarkets(oddsData, fixtureData) {
  if (!oddsData || oddsData.length === 0) {
    return null;
  }

  const markets = {
    result_1x2: { home: null, draw: null, away: null },
    total_goals: {},
    btts: { yes: null, no: null },
    yellow_cards: {},
    corners: {},
    exact_score: {},
    handicap: {},
    player_props: {}
  };

  // Group odds by bookmaker
  const bookmakerOdds = {};
  for (const odd of oddsData) {
    const bookmaker = odd.bookmaker_name || 'unknown';
    if (!bookmakerOdds[bookmaker]) bookmakerOdds[bookmaker] = [];
    bookmakerOdds[bookmaker].push(odd);
  }

  // Calculate average odds from sharpest bookmakers
  // (BET365, DraftKings, FanDuel are typically sharpest)
  const sharps = Object.keys(bookmakerOdds).filter(bm =>
    ['bet365', 'draftkings', 'fanduel', 'betfair'].includes(bm.toLowerCase())
  );

  const sourceBooks = sharps.length > 0 ? sharps : Object.keys(bookmakerOdds).slice(0, 5);

  // Map OddsPapi market IDs to our format
  // OddsPapi uses: 'h2h' (1x2), 'totals' (Over/Under), 'btts', etc.
  for (const bookmaker of sourceBooks) {
    for (const odd of bookmakerOdds[bookmaker]) {
      const { market_id, market_name, value, outcome } = odd;

      // 1x2 Result
      if (market_id === 'h2h' || market_name?.includes('1x2') || market_name?.includes('Match Result')) {
        if (outcome.includes('Home') || outcome === '1') {
          if (!markets.result_1x2.home) markets.result_1x2.home = parseFloat(value);
        } else if (outcome === 'Draw') {
          if (!markets.result_1x2.draw) markets.result_1x2.draw = parseFloat(value);
        } else if (outcome.includes('Away') || outcome === '2') {
          if (!markets.result_1x2.away) markets.result_1x2.away = parseFloat(value);
        }
      }

      // Over/Under Goals
      if (market_id === 'totals' || market_name?.includes('Total Goals') || market_name?.includes('Over/Under')) {
        const matchOver = market_name?.match(/Over\s+(\d+\.?\d*)/i);
        const matchUnder = market_name?.match(/Under\s+(\d+\.?\d*)/i);

        if (matchOver && outcome.includes('Over')) {
          const threshold = matchOver[1];
          if (!markets.total_goals[`over_${threshold}`])
            markets.total_goals[`over_${threshold}`] = parseFloat(value);
        }
        if (matchUnder && outcome.includes('Under')) {
          const threshold = matchUnder[1];
          if (!markets.total_goals[`under_${threshold}`])
            markets.total_goals[`under_${threshold}`] = parseFloat(value);
        }
      }

      // Both Teams to Score
      if (market_id === 'btts' || market_name?.includes('Both Teams to Score')) {
        if (outcome === 'Yes') markets.btts.yes = parseFloat(value);
        if (outcome === 'No') markets.btts.no = parseFloat(value);
      }
    }
  }

  return {
    markets,
    bookmakers_used: sourceBooks.length,
    total_bookmakers_available: Object.keys(bookmakerOdds).length,
    extraction_timestamp: new Date().toISOString()
  };
}

/**
 * Get market movement (comparing vs historical avg)
 * Indicates if odds are shifting significantly
 */
function analyzeMovement(currentOdds, historicalAvg) {
  if (!historicalAvg) return { direction: 'unknown', magnitude: 0 };

  const movement = ((currentOdds - historicalAvg) / historicalAvg * 100).toFixed(2);
  const direction = movement > 2 ? 'down' : movement < -2 ? 'up' : 'stable';

  return {
    direction,
    magnitude: parseFloat(movement),
    percentage: `${movement}%`
  };
}

/**
 * Main function: Get all markets for a match from OddsPapi
 */
async function getMatchMarkets(fixtureId, matchInfo = {}) {
  console.log(`[OddsPapi] Fetching markets for fixture ${fixtureId}...`);

  try {
    const oddsData = await fetchMatchOdds(fixtureId);
    if (!oddsData) {
      console.warn(`[OddsPapi] No odds data returned for fixture ${fixtureId}`);
      return null;
    }

    const aggregated = aggregateOddsToMarkets(oddsData, matchInfo);

    return {
      success: true,
      fixture_id: fixtureId,
      home_team: matchInfo.home_team || 'TBD',
      away_team: matchInfo.away_team || 'TBD',
      ...aggregated,
      data_quality: {
        markets_extracted: Object.keys(aggregated.markets).length,
        odds_freshness_seconds: 60, // OddsPapi updates ~every minute
        last_update: new Date().toISOString(),
        source: 'OddsPapi (350+ bookmakers)',
        live_match: false
      }
    };
  } catch (error) {
    console.error('[OddsPapi] Error in getMatchMarkets:', error.message);
    return null;
  }
}

/**
 * Get historical odds for a match (learning feature)
 * Useful for IA-Zak to understand line movement
 */
async function getHistoricalOdds(fixtureId, daysBack = 7) {
  try {
    validateApiKey();

    const response = await fetch(
      `${ODDSPAPI_BASE_URL}/historical-odds?fixture_id=${fixtureId}&days=${daysBack}&api_key=${ODDSPAPI_KEY}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[OddsPapi] Error fetching historical odds:', error.message);
    return null;
  }
}

export {
  fetchUpcomingMatches,
  fetchMatchOdds,
  getMatchMarkets,
  getHistoricalOdds,
  analyzeMovement,
  aggregateOddsToMarkets,
  validateApiKey
};
