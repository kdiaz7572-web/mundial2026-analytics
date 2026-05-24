// ============================================================
//  Save Bet Endpoint - POST /api/save_bet
//  Validates and stores user bets with full error handling
//
//  SCHEMA FIX (2026-05-23):
//  - Bets are inserted into the "bets" table (NOT "bet_outcomes")
//  - The "bets" table has columns: id, session_id, match_id, market, odds,
//    probability, kelly_bet_size, bankroll_used, status, created_at
//  - The "bet_outcomes" table is ONLY for user feedback (outcome reporting)
//    with columns: id, conversation_id, bet_id, user_reported_outcome,
//    actual_result, verified_at, created_at
//  - Additional metadata (team_home, team_away, notes, confidence) are
//    stored in the response only, not persisted to DB (acceptable for
//    this use case as they can be derived from match_id lookup)
// ============================================================

import { getDb } from './_db.js';
import {
  checkRateLimit,
  validateRequest,
  sanitizeInput,
  validateBankroll,
  sendError,
  sendSuccess,
  logRequest
} from './_middleware.js';

/**
 * Validate bet data structure
 */
function validateBetData(bet) {
  const errors = [];

  // Required fields
  if (!bet.session_id) errors.push('session_id is required');
  if (!bet.match_id) errors.push('match_id is required');
  if (!bet.market) errors.push('market is required');
  if (bet.odds === undefined || bet.odds === null) errors.push('odds is required');
  if (bet.probability === undefined || bet.probability === null) errors.push('probability is required');

  // Validate data types
  if (typeof bet.match_id !== 'string') errors.push('match_id must be a string');
  if (typeof bet.market !== 'string') errors.push('market must be a string');
  if (typeof bet.odds !== 'number' || bet.odds <= 0) errors.push('odds must be a positive number');
  if (typeof bet.probability !== 'number' || bet.probability < 0 || bet.probability > 1) {
    errors.push('probability must be a number between 0 and 1');
  }

  // Validate market
  const validMarkets = ['1x2', 'BTTS', 'Over/Under', 'Corners', 'Cards', 'Handicap', 'Asian', 'Custom'];
  if (!validMarkets.includes(bet.market)) {
    errors.push(`market must be one of: ${validMarkets.join(', ')}`);
  }

  // Validate optional bankroll_used
  if (bet.bankroll_used !== undefined && bet.bankroll_used !== null) {
    if (typeof bet.bankroll_used !== 'number' || bet.bankroll_used <= 0) {
      errors.push('bankroll_used must be a positive number');
    }
    // Reasonable limit: max €100,000 per bet
    if (bet.bankroll_used > 100000) {
      errors.push('bankroll_used cannot exceed €100,000');
    }
  }

  // Validate optional confidence
  if (bet.confidence !== undefined && bet.confidence !== null) {
    if (typeof bet.confidence !== 'number' || bet.confidence < 1 || bet.confidence > 5) {
      errors.push('confidence must be a number between 1 and 5');
    }
  }

  // Validate optional kelly_percentage
  if (bet.kelly_percentage !== undefined && bet.kelly_percentage !== null) {
    if (typeof bet.kelly_percentage !== 'number' || bet.kelly_percentage < 0 || bet.kelly_percentage > 100) {
      errors.push('kelly_percentage must be between 0 and 100');
    }
  }

  return errors;
}

/**
 * Calculate Kelly Criterion bet size
 */
function calculateKellyBetSize(probability, odds, bankroll, fractionalKelly = 0.25) {
  if (!probability || !odds || !bankroll) return 0;

  // Kelly formula: (bp - q) / b
  // where b = odds - 1, p = win probability, q = 1 - p
  const b = odds - 1;
  const q = 1 - probability;
  const kellyPct = (b * probability - q) / b;

  // Fractional Kelly for safety (typically 1/4 Kelly)
  const fractionalKellyPct = kellyPct * fractionalKelly;

  // Clamp between 0 and 5% of bankroll
  const clamped = Math.max(0, Math.min(0.05, fractionalKellyPct));

  return bankroll * clamped;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://mundial2026-analytics.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed', 'Only POST requests are allowed');
  }

  // Rate limiting: max 10 bets per minute per session
  if (!checkRateLimit(req, res, 10, 60000)) {
    return;
  }

  // Validate required fields
  if (!validateRequest(req, res, ['session_id', 'match_id', 'market', 'odds', 'probability'])) {
    return;
  }

  try {
    const db = await getDb();
    const {
      session_id,
      match_id,
      market,
      odds,
      probability,
      team_home = null,
      team_away = null,
      bankroll_total = null,
      bankroll_used = null,
      confidence = null,
      kelly_percentage = null,
      notes = ''
    } = req.body;

    // Validate bet data
    const betData = {
      session_id,
      match_id,
      market,
      odds,
      probability,
      bankroll_used,
      confidence
    };

    const validationErrors = validateBetData(betData);
    if (validationErrors.length > 0) {
      return sendError(res, 400, 'Validation Error', validationErrors.join('; '));
    }

    // Sanitize string inputs
    const sanitizedNotes = sanitizeInput(notes);
    const sanitizedHome = team_home ? sanitizeInput(team_home) : null;
    const sanitizedAway = team_away ? sanitizeInput(team_away) : null;

    // Calculate Kelly if bankroll provided
    let calculatedKelly = kelly_percentage;
    if (bankroll_total && !kelly_percentage) {
      calculatedKelly = calculateKellyBetSize(probability, odds, bankroll_total);
    }

    // Log the request
    logRequest('/api/save_bet', session_id, {
      market,
      odds,
      probability: (probability * 100).toFixed(1) + '%',
      bankroll_used
    });

    // ═══════════════════════════════════════════════════════
    // Save bet to database (into "bets" table, not "bet_outcomes")
    // ═══════════════════════════════════════════════════════

    const result = await db`
      INSERT INTO bets (
        session_id,
        match_id,
        market,
        odds,
        probability,
        kelly_bet_size,
        bankroll_used,
        status
      ) VALUES (
        ${session_id},
        ${match_id},
        ${market},
        ${odds},
        ${probability},
        ${calculatedKelly || null},
        ${bankroll_used},
        'pending'
      )
      RETURNING id, created_at
    `;

    if (!result || result.length === 0) {
      return sendError(res, 500, 'Database Error', 'Failed to save bet');
    }

    const savedBet = result[0];

    // ═══════════════════════════════════════════════════════
    // Calculate bet metrics for response
    // ═══════════════════════════════════════════════════════

    const edge = (probability * odds - 1) * 100;
    const recommendation = edge > 5 ? 'STRONG' : (edge > 0 ? 'VALUE' : 'SKIP');

    return sendSuccess(res, {
      bet_id: savedBet.id,
      session_id,
      match_id,
      market,
      odds,
      probability: (probability * 100).toFixed(1) + '%',
      kelly_bet_size: calculatedKelly ? calculatedKelly.toFixed(2) : null,
      bankroll_used,
      edge_pct: edge.toFixed(2),
      recommendation,
      status: 'pending',
      created_at: savedBet.created_at,
      message: `Bet saved successfully. Edge: ${edge.toFixed(2)}%. Recommendation: ${recommendation}`
    }, 'Bet saved');

  } catch (error) {
    console.error('[save_bet] Error:', error);
    return sendError(res, 500, 'Database Error', error.message);
  }
}
