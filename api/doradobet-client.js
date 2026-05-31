/**
 * ============================================================
 * DoradoBet Client — Fuente Primaria de Fercha
 * ============================================================
 * Obtiene cuotas REALES directamente de DoradoBet.
 * Estrategia dual:
 *   1. API pública de DoradoBet (si disponible)
 *   2. Fetch autenticado con credenciales del usuario
 *
 * Credenciales: DORADOBET_USER / DORADOBET_PASS en Vercel env
 *
 * Nota: Respetar los Términos de Servicio de DoradoBet.
 * Este cliente usa fetch nativo (sin Playwright) para serverless.
 */

const DORADOBET_BASE = 'https://www.doradobet.com';
const DORADOBET_API  = 'https://www.doradobet.com/api';

// ──────────────────────────────────────────────────────────────
// 1. AUTENTICACIÓN
// ──────────────────────────────────────────────────────────────

let _sessionToken = null;
let _tokenExpiry   = 0;

/**
 * Obtiene token de sesión de DoradoBet.
 * Reutiliza el token si aún es válido (< 25 min).
 */
async function getSessionToken() {
  const now = Date.now();
  if (_sessionToken && now < _tokenExpiry) return _sessionToken;

  const user = process.env.DORADOBET_USER;
  const pass = process.env.DORADOBET_PASS;

  if (!user || !pass) {
    console.warn('[DoradoBet] Credenciales no configuradas (DORADOBET_USER/DORADOBET_PASS)');
    return null;
  }

  try {
    // DoradoBet usa un endpoint estándar de login
    const resp = await fetch(`${DORADOBET_API}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ username: user, password: pass }),
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      // Login endpoint may differ — try alternate path
      console.warn(`[DoradoBet] Auth attempt 1 failed (${resp.status}), trying alternate...`);
      return await tryAlternateLogin(user, pass);
    }

    const data = await resp.json();
    const token = data?.token || data?.access_token || data?.data?.token;

    if (token) {
      _sessionToken = token;
      _tokenExpiry  = now + 25 * 60 * 1000; // 25 min TTL
      console.log('[DoradoBet] ✅ Autenticación exitosa');
      return token;
    }

    console.warn('[DoradoBet] No token en respuesta de login');
    return null;
  } catch (err) {
    console.error('[DoradoBet] Error de autenticación:', err.message);
    return null;
  }
}

/**
 * Intento alternativo de login (algunos sitios usan form-urlencoded)
 */
async function tryAlternateLogin(user, pass) {
  try {
    const resp = await fetch(`${DORADOBET_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: new URLSearchParams({ username: user, password: pass, grant_type: 'password' }),
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    return data?.token || data?.access_token || null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// 2. BÚSQUEDA DE PARTIDO
// ──────────────────────────────────────────────────────────────

/**
 * Busca el partido en DoradoBet por nombres de equipos.
 * Retorna { eventId, homeTeam, awayTeam, startTime } o null.
 */
async function findMatch(homeTeam, awayTeam) {
  const token = await getSessionToken();

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Intenta distintos endpoints de búsqueda
  const endpoints = [
    `/sports/soccer/events?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`,
    `/events/search?q=${encodeURIComponent(homeTeam + ' ' + awayTeam)}&sport=soccer`,
    `/api/v1/sports/1/events?team=${encodeURIComponent(homeTeam)}`
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(`${DORADOBET_API}${ep}`, {
        headers,
        signal: AbortSignal.timeout(6000)
      });
      if (!resp.ok) continue;

      const data = await resp.json();
      const events = data?.data || data?.events || data?.items || [];

      // Match both team names (case-insensitive, partial match)
      const homeLower = homeTeam.toLowerCase();
      const awayLower = awayTeam.toLowerCase();

      for (const evt of events) {
        const h = (evt.homeTeam || evt.home_team || evt.home || '').toLowerCase();
        const a = (evt.awayTeam || evt.away_team || evt.away || '').toLowerCase();

        if ((h.includes(homeLower) || homeLower.includes(h.split(' ')[0])) &&
            (a.includes(awayLower) || awayLower.includes(a.split(' ')[0]))) {
          console.log(`[DoradoBet] ✅ Partido encontrado: ${h} vs ${a} (id: ${evt.id || evt.eventId})`);
          return {
            eventId: evt.id || evt.eventId || evt.event_id,
            homeTeam: evt.homeTeam || evt.home_team || homeTeam,
            awayTeam: evt.awayTeam || evt.away_team || awayTeam,
            startTime: evt.startTime || evt.start_time || null,
            source: 'doradobet'
          };
        }
      }
    } catch (err) {
      console.warn(`[DoradoBet] Search endpoint ${ep} failed:`, err.message);
    }
  }

  console.warn(`[DoradoBet] Partido no encontrado: ${homeTeam} vs ${awayTeam}`);
  return null;
}

// ──────────────────────────────────────────────────────────────
// 3. OBTENER CUOTAS POR PARTIDO
// ──────────────────────────────────────────────────────────────

/**
 * Obtiene todos los mercados y cuotas para un evento de DoradoBet.
 * Retorna el objeto markets en el mismo formato que ferxxxa-markets.js
 */
async function getEventMarkets(eventId) {
  const token = await getSessionToken();

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const endpoints = [
    `/events/${eventId}/markets`,
    `/sports/events/${eventId}/odds`,
    `/api/v1/events/${eventId}/bets`
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(`${DORADOBET_API}${ep}`, {
        headers,
        signal: AbortSignal.timeout(8000)
      });
      if (!resp.ok) continue;

      const raw = await resp.json();
      return parseDoradoBetMarkets(raw, eventId);
    } catch (err) {
      console.warn(`[DoradoBet] Markets endpoint ${ep} failed:`, err.message);
    }
  }

  return null;
}

/**
 * Parsea la respuesta de DoradoBet a nuestro formato estándar de mercados.
 */
function parseDoradoBetMarkets(raw, eventId) {
  const markets = {};

  const data = raw?.data || raw?.markets || raw?.bets || raw || [];
  const items = Array.isArray(data) ? data : Object.values(data);

  for (const item of items) {
    const name  = (item.name || item.market_name || item.type || '').toLowerCase();
    const sels  = item.selections || item.outcomes || item.options || [];

    // 1x2 Result
    if (name.includes('1x2') || name.includes('match result') || name.includes('resultado')) {
      markets.result_1x2 = {
        home: findOdd(sels, ['1', 'home', 'local', 'victoria local']),
        draw: findOdd(sels, ['x', 'draw', 'empate']),
        away: findOdd(sels, ['2', 'away', 'visitante', 'victoria visitante']),
        source: 'doradobet'
      };
    }

    // Total Goals
    if (name.includes('total goals') || name.includes('total goles') || name.includes('over/under')) {
      const line = extractLine(name);
      if (line) {
        const overOdd  = findOdd(sels, ['over', 'mas', 'más']);
        const underOdd = findOdd(sels, ['under', 'menos']);
        if (overOdd)  markets.total_goals = { ...markets.total_goals, [`over_${line.toString().replace('.', '_')}`]: overOdd };
        if (underOdd) markets.total_goals = { ...markets.total_goals, [`under_${line.toString().replace('.', '_')}`]: underOdd };
      }
    }

    // BTTS
    if (name.includes('btts') || name.includes('ambos anotan') || name.includes('both teams')) {
      markets.btts = {
        yes: findOdd(sels, ['yes', 'si', 'sí', 'ambos']),
        no:  findOdd(sels, ['no']),
        source: 'doradobet'
      };
    }

    // Yellow Cards
    if (name.includes('tarjetas') || name.includes('yellow cards') || name.includes('amonestaciones')) {
      const line = extractLine(name);
      if (line) {
        const overOdd = findOdd(sels, ['over', 'mas', 'más']);
        if (overOdd) markets.yellow_cards = { ...markets.yellow_cards, [`over_${line.toString().replace('.', '_')}`]: overOdd };
      }
    }

    // Corners
    if (name.includes('corners') || name.includes('córners') || name.includes('esquinas')) {
      const line = extractLine(name);
      if (line) {
        const overOdd  = findOdd(sels, ['over', 'mas', 'más']);
        const underOdd = findOdd(sels, ['under', 'menos']);
        if (overOdd)  markets.corners = { ...markets.corners, [`total_over_${line.toString().replace('.', '_')}`]: overOdd };
        if (underOdd) markets.corners = { ...markets.corners, [`total_under_${line.toString().replace('.', '_')}`]: underOdd };
      }
    }

    // Asian Handicap
    if (name.includes('handicap') || name.includes('hándicap')) {
      markets.asian_handicap = markets.asian_handicap || {};
      const line = extractLine(name);
      if (line) {
        const homeOdd = findOdd(sels, ['home', 'local', '1']);
        if (homeOdd) markets.asian_handicap[`home_${line}`] = homeOdd;
      }
    }

    // Exact Score
    if (name.includes('correct score') || name.includes('marcador exacto') || name.includes('exact')) {
      markets.exact_score = markets.exact_score || {};
      for (const sel of sels) {
        const scoreName = sel.name || sel.outcome || '';
        const odd = sel.odds || sel.price || sel.value;
        if (scoreName && odd) markets.exact_score[scoreName] = parseFloat(odd);
      }
    }
  }

  return {
    event_id: eventId,
    markets,
    markets_found: Object.keys(markets).length,
    source: 'doradobet',
    fallback: false,
    extraction_timestamp: new Date().toISOString()
  };
}

// ──────────────────────────────────────────────────────────────
// 4. HELPERS
// ──────────────────────────────────────────────────────────────

function findOdd(selections, keywords) {
  if (!Array.isArray(selections)) return null;
  for (const sel of selections) {
    const name = (sel.name || sel.outcome || sel.type || '').toLowerCase();
    if (keywords.some(k => name.includes(k))) {
      const odd = sel.odds || sel.price || sel.value || sel.odd;
      if (odd) return parseFloat(odd);
    }
  }
  return null;
}

function extractLine(text) {
  const m = text.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

// ──────────────────────────────────────────────────────────────
// 5. MAIN EXPORT: getDoradoBetMarkets
// ──────────────────────────────────────────────────────────────

/**
 * Función principal: obtiene cuotas de DoradoBet para un partido.
 * Usado por ferxxxa-markets.js como fuente primaria.
 *
 * @param {string} homeTeam - Nombre del equipo local
 * @param {string} awayTeam - Nombre del equipo visitante
 * @returns {object|null} - Objeto de mercados en formato estándar, o null si falla
 */
// NOTE: DoradoBet direct client deprecated - using Puppeteer scraper in ferxxxa-markets.js
export async function getDoradoBetMarkets(homeTeam, awayTeam) {
  console.log(`[DoradoBet] Buscando cuotas para: ${homeTeam} vs ${awayTeam}`);

  // 1. Encontrar el partido en DoradoBet
  const matchInfo = await findMatch(homeTeam, awayTeam);
  if (!matchInfo) {
    console.warn('[DoradoBet] Partido no encontrado — fallback a OddsPapi');
    return null;
  }

  // 2. Obtener mercados del evento
  const markets = await getEventMarkets(matchInfo.eventId);
  if (!markets) {
    console.warn('[DoradoBet] No se pudieron obtener mercados — fallback a OddsPapi');
    return null;
  }

  return {
    ...markets,
    home_team: matchInfo.homeTeam,
    away_team: matchInfo.awayTeam,
    start_time: matchInfo.startTime,
    data_source: 'DoradoBet (directo)',
    fallback: false
  };
}

export { findMatch, getEventMarkets, parseDoradoBetMarkets };
