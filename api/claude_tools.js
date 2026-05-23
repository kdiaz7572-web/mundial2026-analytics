// ============================================================
//  Groq Tool Definitions - JSON schemas for Groq Llama 3.1
//  These tools are called by IA-Zak via JSON mode responses
// ============================================================

import { getDb } from './_db.js';

/**
 * Tool definitions for Groq to understand what functions it can call
 * Groq will output JSON responses requesting these tools
 */
export const GROQ_TOOLS = [
  {
    name: 'analyze_match',
    description: 'Analyzes a specific football match and returns Poisson picks with edge calculations',
    parameters: {
      type: 'object',
      properties: {
        match_id: { type: 'string', description: 'Unique match identifier (e.g., "ARG-MAR")' },
        home_team: { type: 'string', description: 'Home team name or code' },
        away_team: { type: 'string', description: 'Away team name or code' }
      },
      required: ['match_id', 'home_team', 'away_team']
    }
  },
  {
    name: 'get_team_stats',
    description: 'Fetches team statistics from API-Football or database cache',
    parameters: {
      type: 'object',
      properties: {
        team_name: { type: 'string', description: 'Team name (e.g., "Argentina", "Spain")' },
        stat_type: {
          type: 'string',
          enum: ['recent_form', 'xg', 'key_players', 'defensive_stats', 'injury_status'],
          description: 'Type of statistics to retrieve'
        }
      },
      required: ['team_name', 'stat_type']
    }
  },
  {
    name: 'get_player_performance',
    description: 'Returns historical and current season player statistics',
    parameters: {
      type: 'object',
      properties: {
        player_name: { type: 'string', description: 'Full player name (e.g., "Kylian Mbappé")' },
        season: { type: 'string', description: 'Season (e.g., "2024-25" or "2025-26")' }
      },
      required: ['player_name']
    }
  },
  {
    name: 'calculate_kelly',
    description: 'Calculates Kelly Criterion bet sizing with risk management',
    parameters: {
      type: 'object',
      properties: {
        probability: { type: 'number', description: 'Estimated win probability (0-1)' },
        odds: { type: 'number', description: 'Decimal odds from bookmaker' },
        bankroll: { type: 'number', description: 'User total bankroll in currency' },
        risk_tolerance: {
          type: 'string',
          enum: ['conservative', 'moderate', 'aggressive'],
          description: 'Bet sizing preference'
        }
      },
      required: ['probability', 'odds', 'bankroll']
    }
  },
  {
    name: 'get_doradobet_odds',
    description: 'Fetches current DoradoBet odds for a specific match and market',
    parameters: {
      type: 'object',
      properties: {
        match_id: { type: 'string', description: 'Match identifier' },
        market: { type: 'string', description: 'Market type (e.g., "1x2", "BTTS", "Over2.5", "Corners")' }
      },
      required: ['match_id', 'market']
    }
  },
  {
    name: 'record_bet_outcome',
    description: 'Records user feedback on a bet outcome (won/lost/pending)',
    parameters: {
      type: 'object',
      properties: {
        bet_id: { type: 'integer', description: 'ID of the bet to record' },
        user_outcome: {
          type: 'string',
          enum: ['won', 'lost', 'pending', 'skipped'],
          description: 'User reported outcome'
        }
      },
      required: ['bet_id', 'user_outcome']
    }
  },
  {
    name: 'get_prediction_accuracy_summary',
    description: 'Returns IA-Zak prediction accuracy statistics for learning',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Days to look back (default: 30)' },
        market_filter: { type: 'string', description: 'Filter by specific market (optional)' }
      },
      required: []
    }
  },
  {
    name: 'search_team_news',
    description: 'Searches for latest news about a team (injuries, form, etc.)',
    parameters: {
      type: 'object',
      properties: {
        team_name: { type: 'string', description: 'Team name to search' },
        query: {
          type: 'string',
          enum: ['injuries', 'form', 'tactical_changes', 'manager_news', 'suspension'],
          description: 'Type of news to search for'
        }
      },
      required: ['team_name']
    }
  }
];

/**
 * Execute a tool based on the name and parameters
 * Returns tool result or error
 */
export async function executeGroqTool(toolName, toolInput) {
  try {
    switch (toolName) {
      case 'analyze_match':
        return await analyzeMatch(toolInput);
      case 'get_team_stats':
        return await getTeamStats(toolInput);
      case 'get_player_performance':
        return await getPlayerPerformance(toolInput);
      case 'calculate_kelly':
        return await calculateKelly(toolInput);
      case 'get_doradobet_odds':
        return await getDoradoBetOdds(toolInput);
      case 'record_bet_outcome':
        return await recordBetOutcome(toolInput);
      case 'get_prediction_accuracy_summary':
        return await getPredictionAccuracySummary(toolInput);
      case 'search_team_news':
        return await searchTeamNews(toolInput);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { error: `Tool execution failed: ${error.message}` };
  }
}

// ============================================
// Tool Implementations
// ============================================

async function analyzeMatch({ match_id, home_team, away_team }) {
  // TODO: Integrate with js/zak_agent.js getAnalysisForChat()
  // For now, return placeholder
  return {
    match_id,
    home_team,
    away_team,
    markets: [
      { market: '1x2', home: 0.45, draw: 0.28, away: 0.27, odds: { home: 2.2, draw: 3.5, away: 3.7 } }
    ],
    stars: 3,
    edge: 0.025,
    confidence: 'medium',
    justification: 'Balanced teams, slight home advantage'
  };
}

async function getTeamStats({ team_name, stat_type }) {
  // TODO: Integrate with api/football.js / API-Football
  // For now, return placeholder
  return {
    team_name,
    stat_type,
    recent_form: ['W', 'W', 'D', 'L', 'W'],
    xg_for: 1.85,
    xg_against: 1.12,
    key_players: ['Player 1', 'Player 2', 'Player 3']
  };
}

async function getPlayerPerformance({ player_name, season = '2024-25' }) {
  // TODO: Integrate with js/player_engine.js
  return {
    player_name,
    season,
    goals: 18,
    assists: 5,
    games: 32,
    goals_per_game: 0.56,
    assists_per_game: 0.16
  };
}

async function calculateKelly({ probability, odds, bankroll, risk_tolerance = 'moderate' }) {
  // Kelly Criterion: kelly_pct = (prob * odds - 1) / (odds - 1)
  const edge = probability * odds - 1;
  const kelly_full = edge / (odds - 1);

  let kelly_pct;
  switch (risk_tolerance) {
    case 'conservative':
      kelly_pct = kelly_full * 0.25; // 1/4 Kelly
      break;
    case 'aggressive':
      kelly_pct = kelly_full * 0.75; // 3/4 Kelly
      break;
    case 'moderate':
    default:
      kelly_pct = kelly_full * 0.5; // 1/2 Kelly
  }

  const bet_size = bankroll * kelly_pct;
  const risk_of_ruin = calculateRiskOfRuin(bankroll, bet_size, probability, 0.05);

  const warnings = [];
  if (kelly_pct > 0.25) warnings.push('⚠️ Kelly suggests high stake. Consider fractional Kelly.');
  if (bet_size > bankroll * 0.05) warnings.push('⚠️ Bet exceeds 5% of bankroll. Confirm before betting.');

  return {
    kelly_optimal_pct: Math.round(kelly_full * 10000) / 100,
    kelly_recommended_pct: Math.round(kelly_pct * 10000) / 100,
    bet_size_recommended: Math.round(bet_size * 100) / 100,
    edge_pct: Math.round(edge * 10000) / 100,
    risk_of_ruin_pct: Math.round(risk_of_ruin * 100 * 100) / 100,
    warnings
  };
}

async function getDoradoBetOdds({ match_id, market }) {
  // TODO: Integrate with api/football.js real odds fetcher
  // For now, return simulated
  return {
    match_id,
    market,
    odds: 2.5,
    source: 'doradobet',
    available: true,
    note: '[SIMULATED] Real DoradoBet integration coming soon'
  };
}

async function recordBetOutcome({ bet_id, user_outcome }) {
  const db = await getDb();

  try {
    // Find the bet first
    const [bet] = await db`SELECT * FROM bets WHERE id = ${bet_id}`;
    if (!bet) return { error: `Bet ${bet_id} not found` };

    // Record the outcome
    await db`
      INSERT INTO bet_outcomes (bet_id, user_reported_outcome, created_at)
      VALUES (${bet_id}, ${user_outcome}, NOW())
    `;

    return {
      success: true,
      bet_id,
      user_outcome,
      message: `Bet ${bet_id} outcome recorded: ${user_outcome}`
    };
  } catch (error) {
    return { error: `Failed to record bet outcome: ${error.message}` };
  }
}

async function getPredictionAccuracySummary({ days = 30, market_filter = null }) {
  const db = await getDb();

  try {
    // Fetch recent predictions and outcomes
    const query = `
      SELECT
        market,
        COUNT(*) as total_predictions,
        SUM(CASE WHEN actual_outcome = predicted_outcome THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as accuracy,
        AVG(edge_calc) as avg_edge,
        AVG(confidence_stars) as avg_confidence
      FROM prediction_accuracy
      WHERE created_at > NOW() - INTERVAL '${days} days'
      ${market_filter ? `AND market = '${market_filter}'` : ''}
      GROUP BY market
      ORDER BY total_predictions DESC
    `;

    const results = await db.unsafe(query);

    // Calculate overall stats
    const overall_accuracy = results.length > 0
      ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length
      : 0;

    return {
      period_days: days,
      overall_accuracy: Math.round(overall_accuracy * 10000) / 100,
      by_market: results.map(r => ({
        market: r.market,
        predictions: r.total_predictions,
        accuracy_pct: Math.round(r.accuracy * 10000) / 100,
        avg_edge_pct: Math.round(r.avg_edge * 10000) / 100,
        avg_confidence_stars: Math.round(r.avg_confidence * 100) / 100
      })),
      recommendation: overall_accuracy > 0.55 ? '✅ Above 55% - Sharp.' : overall_accuracy > 0.50 ? '✔️ Break-even territory.' : '⚠️ Below break-even - refine strategy.'
    };
  } catch (error) {
    return { error: `Failed to fetch accuracy summary: ${error.message}` };
  }
}

async function searchTeamNews({ team_name, query = 'injuries' }) {
  // TODO: Integrate with Tavily API search
  // For now, return placeholder
  return {
    team_name,
    query,
    news_items: [
      { title: 'Player injury update', source: 'tavily', date: '2025-05-22', snippet: 'Recent injury news...' }
    ],
    confidence: 'medium'
  };
}

/**
 * Helper: Calculate risk of ruin
 * Simplified version of the gambler's ruin problem
 */
function calculateRiskOfRuin(bankroll, bet_size, win_prob, target_ruin_pct = 0.05) {
  // Simplified: uses normal approximation
  if (bet_size >= bankroll) return 1.0; // Guaranteed ruin if bet >= bankroll

  const p = win_prob;
  const q = 1 - win_prob;
  const b = bet_size / bankroll;

  // Approximation using geometric series
  if (Math.abs(p - q) < 0.001) {
    // Fair game approximation
    return Math.pow(0.5, Math.log2(1 / b));
  }

  const ratio = q / p;
  const x = Math.log(ratio) / (b * (2 * p - 1));
  return Math.pow(ratio, x);
}

export default { GROQ_TOOLS, executeGroqTool };
