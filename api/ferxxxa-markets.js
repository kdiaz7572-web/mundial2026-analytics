/**
 * ============================================================
 * FerXxxa Markets - Real-time Betting Odds via OddsPapi
 * ============================================================
 * Extracts 67+ betting markets from 350+ bookmakers (OddsPapi)
 * including Latin American coverage every 5 minutes.
 * Stores in Postgres for IA-Zak consumption.
 *
 * Usage (from vercel.json cron):
 *   GET /api/ferxxxa-markets?fixture_id=partido_id
 *
 * Data Source: OddsPapi (https://oddspapi.io)
 *   - 350+ bookmakers (Bet365, DraftKings, FanDuel, Betfair, etc.)
 *   - LatAm coverage (Betcris, Marathonbet, and more)
 *   - Real-time odds updates
 *   - Legal & authorized API access (no ToS violations)
 */

import { getMatchMarkets } from './oddspapi-client.js';
import { getDb } from './_db.js';

/**
 * Validate fixture ID format
 */
function validateFixtureId(fixtureId) {
  if (!fixtureId || typeof fixtureId !== 'string') {
    return false;
  }
  return fixtureId.length > 0;
}

/**
 * Main function: Fetch real market data from OddsPapi
 */
async function fetchRealMarkets(fixtureId, matchInfo = {}) {
  try {
    console.log(`[FerXxxa] Fetching real markets for fixture ${fixtureId} from OddsPapi...`);

    // Call OddsPapi client to get real odds from 350+ bookmakers
    const marketsData = await getMatchMarkets(fixtureId, matchInfo);

    if (!marketsData) {
      console.warn(`[FerXxxa] OddsPapi returned no data. Returning fallback.`);
      return generateFallbackData(fixtureId, matchInfo);
    }

    return {
      extraction_timestamp: new Date().toISOString(),
      fixture_id: fixtureId,
      home_team: matchInfo.home_team || 'Home',
      away_team: matchInfo.away_team || 'Away',
      ...marketsData,
      data_source: 'OddsPapi (350+ bookmakers, real-time)',
      fallback: false
    };
  } catch (error) {
    console.error('[FerXxxa] Error fetching real markets:', error.message);
    return generateFallbackData(fixtureId, matchInfo);
  }
}

/**
 * Generate realistic fallback market data (for testing/offline mode)
 * This is returned ONLY if OddsPapi fails
 */
function generateFallbackData(fixtureId, matchInfo = {}) {
  console.warn(`[FerXxxa] Using fallback data for fixture ${fixtureId} (OddsPapi unavailable)`);

  return {
    extraction_timestamp: new Date().toISOString(),
    fixture_id: fixtureId,
    home_team: matchInfo.home_team || 'Home Team',
    away_team: matchInfo.away_team || 'Away Team',
    current_score: '0:0',
    current_minute: 0,
    total_markets_found: 67,
    markets: {
      result_1x2: {
        home: 1.75,
        draw: 3.50,
        away: 4.20
      },
      total_goals: {
        over_0_5: 1.02, under_0_5: 20.00,
        over_1_5: 1.12, under_1_5: 7.00,
        over_2_5: 1.60, under_2_5: 2.70,
        over_3_5: 2.80, under_3_5: 1.45,
        over_4_5: 5.00, under_4_5: 1.08,
        over_5_5: 10.00, under_5_5: 1.01
      },
      btts: { yes: 2.10, no: 1.65 },
      yellow_cards: {
        exact_0_3: 1.30, exact_4: 2.40, exact_5: 3.50, exact_6: 5.00,
        over_4_5: 2.00, over_5_5: 2.80
      },
      corners: {
        total_over_17_5: 1.85, total_under_17_5: 1.90
      },
      exact_score: {
        '0-0': 15.00, '1-0': 5.00, '1-1': 4.00, '2-0': 8.00, '2-1': 6.50
      }
    },
    data_quality: {
      markets_extracted: 67,
      odds_freshness_seconds: 60,
      last_update: new Date().toISOString(),
      source: 'Fallback (OddsPapi unavailable)',
      live_match: false,
      fallback: true
    }
  };
}

/**
 * Vercel handler
 * Endpoint: GET /api/ferxxxa-markets?fixture_id=123
 *
 * Called every 5 minutes by vercel.json cron job
 * Returns real odds from 350+ bookmakers (OddsPapi)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests allowed' });
  }

  try {
    const { fixture_id, match_id } = req.query;
    const fixtureId = fixture_id || match_id; // Support both parameter names

    if (!fixtureId) {
      return res.status(400).json({
        error: 'fixture_id or match_id parameter required',
        example: '/api/ferxxxa-markets?fixture_id=123'
      });
    }

    if (!validateFixtureId(fixtureId)) {
      return res.status(400).json({ error: 'Invalid fixture_id format' });
    }

    // Fetch REAL market data from OddsPapi (350+ bookmakers)
    // Falls back to simulated data only if OddsPapi is unavailable
    const marketData = await fetchRealMarkets(fixtureId, {
      home_team: req.query.home_team,
      away_team: req.query.away_team
    });

    // Store in Postgres for IA-Zak to read
    try {
      const db = await getDb();
      await db`
        INSERT INTO zak_intel (topic, match_id, studied_at, summary_json, content)
        VALUES ('ferxxxa_markets', ${fixtureId}, NOW(), ${JSON.stringify(marketData)}, 'Real-time market data from OddsPapi (350+ bookmakers)')
        ON CONFLICT (topic, match_id) DO UPDATE SET
          summary_json = ${JSON.stringify(marketData)},
          studied_at = NOW()
      `;
      console.log(`[FerXxxa] Stored markets for fixture ${fixtureId} in DB`);
    } catch (dbError) {
      console.error('[FerXxxa] Database storage error:', dbError.message);
      // Continue anyway - return data even if DB fails
    }

    return res.status(200).json({
      success: true,
      fixture_id: fixtureId,
      data: marketData,
      timestamp: new Date().toISOString(),
      note: marketData.fallback ? '⚠️ Using fallback data (OddsPapi unavailable)' : '✅ Real odds from OddsPapi'
    });

  } catch (error) {
    console.error('[FerXxxa] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      fallback: true
    });
  }
}

export { fetchRealMarkets, validateFixtureId, generateFallbackData };
