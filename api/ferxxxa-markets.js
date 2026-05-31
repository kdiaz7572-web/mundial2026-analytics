/**
 * ============================================================
 * FerXxxa Markets — DoradoBet + The Odds API (80+ bookmakers)
 * ============================================================
 * Estrategia de prioridad:
 *   1. DoradoBet via Puppeteer (browser real, bypass Cloudflare)
 *      → Intercepta VirtualSoft API en tiempo real
 *   2. The Odds API (80+ bookmakers, Mundial 2026 disponible)
 *   3. Fallback teórico si ambos fallan
 *
 * maxDuration: 60s (configurado en vercel.json)
 */

import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { getMatchMarkets } from './oddspapi-client.js';
import { getDb } from './_db.js';

// Chromium remoto para serverless (no aumenta bundle size)
const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

// ──────────────────────────────────────────────────────────
// 1. DORADOBET PUPPETEER SCRAPER
// ──────────────────────────────────────────────────────────

async function scrapeDoradoBet(homeTeam, awayTeam) {
  let browser;
  const capturedData = { markets: null, rawApis: [] };

  try {
    const execPath = await chromium.executablePath(CHROMIUM_URL);

    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox',
             '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
      defaultViewport: { width: 1366, height: 768 },
      executablePath: execPath,
      headless: chromium.headless,
      timeout: 20000
    });

    const page = await browser.newPage();

    // Interceptar respuestas de la API de VirtualSoft
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('virtualsoft.tech') && response.status() === 200) {
        try {
          const ct = response.headers()['content-type'] || '';
          if (ct.includes('application/json')) {
            const data = await response.json();
            if (data && !data.HasError) {
              capturedData.rawApis.push({ url, data });
              console.log(`[Puppeteer] ✅ API: ${url.split('/').slice(-1)[0]}`);
            }
          }
        } catch {}
      }
    });

    // Headers de browser real para pasar Cloudflare
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-CR,es;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none', 'Upgrade-Insecure-Requests': '1'
    });

    await page.goto('https://www.doradobet.com', {
      waitUntil: 'networkidle2', timeout: 22000
    });

    // Esperar a que el SPA cargue y haga sus llamadas API
    await new Promise(r => setTimeout(r, 5000));

    // Intentar navegar a deportes
    try {
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const sports = links.find(l =>
          l.textContent.toLowerCase().includes('deport') ||
          l.href.includes('deport') || l.href.includes('sport')
        );
        if (sports) sports.click();
      });
      await new Promise(r => setTimeout(r, 3000));
    } catch {}

    // Parsear datos capturados de la API
    if (capturedData.rawApis.length > 0) {
      capturedData.markets = parseVirtualSoftApis(capturedData.rawApis, homeTeam, awayTeam);
    }

    return {
      markets: capturedData.markets,
      rawCount: capturedData.rawApis.length,
      success: capturedData.markets !== null
    };

  } catch (err) {
    console.warn('[Puppeteer] Error:', err.message);
    return { markets: null, rawCount: 0, success: false, error: err.message };
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
}

function parseVirtualSoftApis(responses, homeTeam, awayTeam) {
  const markets = {};
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();

  for (const { url, data } of responses) {
    const urlLower = url.toLowerCase();
    const arr = Array.isArray(data) ? data : (data.data || data.events || data.items || []);

    if (urlLower.includes('event') || urlLower.includes('match')) {
      const match = Array.isArray(arr) && arr.find(evt => {
        const h = (evt.homeTeam || evt.Home || evt.HomeTeam || '').toLowerCase();
        const a = (evt.awayTeam || evt.Away || evt.AwayTeam || '').toLowerCase();
        return h.includes(homeLower.split(' ')[0]) && a.includes(awayLower.split(' ')[0]);
      });
      if (match) {
        const odds = match.odds || match.Odds || match.markets || [];
        markets.result_1x2 = {
          home: findOdd(odds, ['1','home','local']),
          draw: findOdd(odds, ['x','draw','empate']),
          away: findOdd(odds, ['2','away','visitante']),
          source: 'doradobet_real'
        };
      }
    }
  }
  return Object.keys(markets).length > 0 ? markets : null;
}

function findOdd(arr, keys) {
  if (!Array.isArray(arr)) return null;
  for (const o of arr) {
    const name = (o.name || o.Name || o.outcome || '').toLowerCase();
    if (keys.some(k => name.includes(k))) {
      return parseFloat(o.value || o.Value || o.odds || o.Odds) || null;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// 2. FALLBACK DATA (cuando ambas fuentes fallan)
// ──────────────────────────────────────────────────────────

function generateFallbackData(fixtureId, matchInfo = {}) {
  return {
    extraction_timestamp: new Date().toISOString(),
    fixture_id: fixtureId,
    home_team: matchInfo.home_team || 'Home Team',
    away_team: matchInfo.away_team || 'Away Team',
    current_score: '0:0',
    total_markets_found: 6,
    markets: {
      result_1x2: { home: 1.75, draw: 3.50, away: 4.20 },
      total_goals: { over_0_5: 1.02, over_1_5: 1.12, over_2_5: 1.60, under_2_5: 2.70 },
      btts: { yes: 2.10, no: 1.65 },
      yellow_cards: { over_4_5: 2.00, over_5_5: 2.80 },
      corners: { total_over_9_5: 1.90, total_under_9_5: 1.85 },
      exact_score: { '1-0': 5.00, '1-1': 4.00, '2-0': 8.00 }
    },
    data_quality: {
      source: 'Theoretical fallback',
      fallback: true,
      last_update: new Date().toISOString()
    },
    fallback: true
  };
}

// ──────────────────────────────────────────────────────────
// 3. ORQUESTADOR PRINCIPAL
// ──────────────────────────────────────────────────────────

async function fetchRealMarkets(fixtureId, matchInfo = {}) {
  const home = matchInfo.home_team || matchInfo.homeTeam || '';
  const away = matchInfo.away_team || matchInfo.awayTeam || '';

  // ── Intento 1: DoradoBet via Puppeteer ──
  if (home && away) {
    try {
      console.log(`[FerXxxa] 🌐 Intentando DoradoBet Puppeteer: ${home} vs ${away}`);
      const scraped = await scrapeDoradoBet(home, away);

      if (scraped.success && scraped.markets) {
        console.log(`[FerXxxa] ✅ DoradoBet: ${Object.keys(scraped.markets).length} mercados`);
        return {
          extraction_timestamp: new Date().toISOString(),
          fixture_id: fixtureId, home_team: home, away_team: away,
          markets: scraped.markets,
          markets_found: Object.keys(scraped.markets).length,
          data_source: 'DoradoBet (Puppeteer - Real)',
          fallback: false, source_priority: 'doradobet_puppeteer'
        };
      }
      console.warn(`[FerXxxa] Puppeteer: sin datos (APIs capturadas: ${scraped.rawCount})`);
    } catch (err) {
      console.warn('[FerXxxa] Puppeteer error:', err.message);
    }
  }

  // ── Intento 2: The Odds API (80+ bookmakers) ──
  try {
    console.log(`[FerXxxa] 📡 The Odds API para: ${home || fixtureId} vs ${away}`);
    const oddsData = await getMatchMarkets(fixtureId, matchInfo);
    if (oddsData) {
      console.log('[FerXxxa] ✅ The Odds API: datos obtenidos');
      return {
        extraction_timestamp: new Date().toISOString(),
        fixture_id: fixtureId, home_team: home || 'Home', away_team: away || 'Away',
        ...oddsData,
        data_source: 'The Odds API (80+ bookmakers)',
        fallback: false, source_priority: 'the_odds_api'
      };
    }
  } catch (err) {
    console.warn('[FerXxxa] The Odds API error:', err.message);
  }

  // ── Intento 3: Fallback teórico ──
  console.warn('[FerXxxa] Ambas fuentes fallaron — datos teóricos');
  return generateFallbackData(fixtureId, matchInfo);
}

// ──────────────────────────────────────────────────────────
// 4. VERCEL HANDLER
// ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests allowed' });
  }

  const { fixture_id, match_id, home_team, away_team } = req.query;
  const fixtureId = fixture_id || match_id || `${home_team}_vs_${away_team}`;

  if (!fixtureId && !home_team) {
    return res.status(400).json({
      error: 'Requerido: fixture_id o (home_team + away_team)',
      example: '/api/ferxxxa-markets?home_team=Argentina&away_team=Colombia'
    });
  }

  try {
    const marketData = await fetchRealMarkets(fixtureId, {
      home_team: home_team || req.query.home,
      away_team: away_team || req.query.away
    });

    // Guardar en Postgres para que IA-Zak lo lea
    try {
      const db = await getDb();
      await db`
        INSERT INTO zak_intel (topic, match_id, studied_at, summary_json, content)
        VALUES ('ferxxxa_markets', ${fixtureId}, NOW(), ${JSON.stringify(marketData)}, 'Real-time odds - DoradoBet/TheOddsAPI')
        ON CONFLICT (topic, match_id) DO UPDATE SET
          summary_json = ${JSON.stringify(marketData)},
          studied_at = NOW()
      `;
    } catch (dbErr) {
      console.error('[FerXxxa] DB error:', dbErr.message);
    }

    return res.status(200).json({
      success: true, fixture_id: fixtureId,
      data: marketData,
      timestamp: new Date().toISOString(),
      source: marketData.source_priority || 'unknown',
      note: marketData.fallback
        ? '⚠️ Datos teóricos (DoradoBet + The Odds API no disponibles)'
        : `✅ Cuotas reales — ${marketData.data_source}`
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export { fetchRealMarkets, scrapeDoradoBet };
