/**
 * ============================================================
 * DoradoBet Scraper — Puppeteer + Chromium serverless
 * ============================================================
 * Usa un navegador real (Chromium) para bypassar Cloudflare y
 * obtener cuotas reales de DoradoBet interceptando las llamadas
 * que el SPA de VirtualSoft hace a su API interna.
 *
 * Chromium se descarga en runtime desde GitHub Releases (~50MB),
 * no aumenta el bundle de la función Vercel.
 *
 * maxDuration: 60s (configurado en vercel.json)
 */

import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { getDb } from './_db.js';

// URL de Chromium optimizado para AWS Lambda / Vercel
const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

/**
 * ────────────────────────────────────────────────────────────
 * SCRAPING PRINCIPAL: Obtiene cuotas de DoradoBet para un
 * partido específico usando un navegador real.
 * ────────────────────────────────────────────────────────────
 */
export async function scrapeDoradoBetMatch(homeTeam, awayTeam) {
  let browser;
  const capturedData = { markets: null, rawApiResponses: [] };

  console.log(`[DoradoBet Scraper] 🌐 Iniciando browser para: ${homeTeam} vs ${awayTeam}`);

  try {
    // Lanzar Chromium con configuración para serverless
    const execPath = await chromium.executablePath(CHROMIUM_URL);

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ],
      defaultViewport: { width: 1366, height: 768 },
      executablePath: execPath,
      headless: chromium.headless,
      timeout: 25000
    });

    const page = await browser.newPage();

    // ── Interceptar respuestas de la API de VirtualSoft ──
    page.on('response', async (response) => {
      const url = response.url();

      // Capturar todas las respuestas de partnerapi.virtualsoft.tech
      if (url.includes('virtualsoft.tech') && response.status() === 200) {
        try {
          const ct = response.headers()['content-type'] || '';
          if (ct.includes('application/json')) {
            const data = await response.json();
            if (data && !data.HasError) {
              capturedData.rawApiResponses.push({ url, data });
              console.log(`[DoradoBet Scraper] ✅ Capturada API: ${url.split('?')[0].split('/').slice(-2).join('/')}`);
            }
          }
        } catch { /* ignore parse errors */ }
      }
    });

    // ── Headers para parecer un browser real ──
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-CR,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // ── Navegar a DoradoBet ──
    console.log('[DoradoBet Scraper] Navegando a doradobet.com...');
    await page.goto('https://www.doradobet.com', {
      waitUntil: 'networkidle2',
      timeout: 25000
    });

    // Esperar a que el SPA cargue y las APIs se invoquen
    await new Promise(r => setTimeout(r, 4000));

    // ── Intentar hacer click en Deportes → Fútbol ──
    try {
      const sportsLink = await page.$('[href*="deport"], [href*="sport"], a:contains("Deportes"), a:contains("Fútbol")');
      if (sportsLink) {
        await sportsLink.click();
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch { /* ignore navigation errors */ }

    // ── Extraer cuotas del DOM si la API no fue capturada ──
    let domOdds = null;
    if (capturedData.rawApiResponses.length === 0) {
      console.log('[DoradoBet Scraper] Intentando extraer odds del DOM...');
      domOdds = await page.evaluate(() => {
        // Buscar elementos con cuotas en el DOM del SPA
        const oddsElements = document.querySelectorAll('[data-odds], .odds-value, .coefficient, [class*="odd"]');
        const found = [];
        oddsElements.forEach(el => {
          const val = parseFloat(el.textContent);
          if (val > 1.0 && val < 50.0) found.push({ text: el.textContent.trim(), class: el.className });
        });
        return found.slice(0, 20);
      });
    }

    console.log(`[DoradoBet Scraper] APIs capturadas: ${capturedData.rawApiResponses.length}`);
    console.log(`[DoradoBet Scraper] DOM odds: ${domOdds ? domOdds.length : 0}`);

    // ── Parsear datos capturados ──
    if (capturedData.rawApiResponses.length > 0) {
      capturedData.markets = parseVirtualSoftResponse(capturedData.rawApiResponses, homeTeam, awayTeam);
    }

    return {
      markets: capturedData.markets,
      rawResponses: capturedData.rawApiResponses.length,
      domOdds,
      success: capturedData.markets !== null || (domOdds && domOdds.length > 0)
    };

  } catch (error) {
    console.error('[DoradoBet Scraper] Error:', error.message);
    return { markets: null, error: error.message, success: false };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

/**
 * Parsea respuestas de la API VirtualSoft capturadas durante el scraping
 */
function parseVirtualSoftResponse(responses, homeTeam, awayTeam) {
  const markets = {};

  for (const { url, data } of responses) {
    const urlLower = url.toLowerCase();

    // Respuestas de GetEvents / GetMatches
    if ((urlLower.includes('getevents') || urlLower.includes('getmatches')) && Array.isArray(data)) {
      const homeLower = homeTeam.toLowerCase();
      const awayLower = awayTeam.toLowerCase();

      const match = data.find(evt => {
        const h = (evt.homeTeam || evt.Home || evt.HomeTeam || '').toLowerCase();
        const a = (evt.awayTeam || evt.Away || evt.AwayTeam || '').toLowerCase();
        return h.includes(homeLower.split(' ')[0]) && a.includes(awayLower.split(' ')[0]);
      });

      if (match) {
        const odds = match.odds || match.Odds || match.markets || [];
        markets.result_1x2 = {
          home: findOddValue(odds, ['1', 'home', 'local']),
          draw: findOddValue(odds, ['x', 'draw', 'empate']),
          away: findOddValue(odds, ['2', 'away', 'visitante']),
          source: 'doradobet_real'
        };
      }
    }

    // Respuestas de GetOdds
    if (urlLower.includes('getodds') && data.odds) {
      markets.total_goals = parseOddsGroup(data.odds, 'total');
      markets.btts = parseOddsGroup(data.odds, 'btts');
      markets.corners = parseOddsGroup(data.odds, 'corner');
    }
  }

  return Object.keys(markets).length > 0 ? markets : null;
}

function findOddValue(oddsArray, keywords) {
  if (!Array.isArray(oddsArray)) return null;
  for (const odd of oddsArray) {
    const name = (odd.name || odd.Name || odd.outcome || '').toLowerCase();
    if (keywords.some(k => name.includes(k))) {
      return parseFloat(odd.value || odd.Value || odd.odds || odd.Odds) || null;
    }
  }
  return null;
}

function parseOddsGroup(odds, groupKey) {
  if (!Array.isArray(odds)) return {};
  const group = odds.filter(o => (o.name || '').toLowerCase().includes(groupKey));
  const result = {};
  group.forEach(o => {
    const key = (o.name || '').toLowerCase().replace(/\s+/g, '_');
    result[key] = parseFloat(o.value || o.odds) || null;
  });
  return result;
}

/**
 * ────────────────────────────────────────────────────────────
 * HANDLER Vercel: GET /api/doradobet-scraper
 * ────────────────────────────────────────────────────────────
 * Usado por el cron job o manualmente para actualizar cuotas
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { home_team, away_team, store = 'true' } = req.query;

  if (!home_team || !away_team) {
    return res.status(400).json({
      error: 'Parámetros requeridos: home_team, away_team',
      example: '/api/doradobet-scraper?home_team=Argentina&away_team=Colombia'
    });
  }

  try {
    console.log(`[Scraper] Iniciando scraping para ${home_team} vs ${away_team}`);
    const result = await scrapeDoradoBetMatch(home_team, away_team);

    // Guardar en DB si se encontraron datos
    if (store === 'true' && result.markets) {
      try {
        const db = await getDb();
        const matchId = `${home_team.toLowerCase().replace(/\s+/g, '_')}_vs_${away_team.toLowerCase().replace(/\s+/g, '_')}`;
        await db`
          INSERT INTO zak_intel (topic, match_id, studied_at, summary_json, content)
          VALUES ('doradobet_markets', ${matchId}, NOW(), ${JSON.stringify(result.markets)}, 'DoradoBet real odds via Puppeteer')
          ON CONFLICT (topic, match_id) DO UPDATE SET
            summary_json = ${JSON.stringify(result.markets)},
            studied_at = NOW()
        `;
        console.log(`[Scraper] ✅ Cuotas guardadas en DB para ${matchId}`);
      } catch (dbErr) {
        console.error('[Scraper] DB error:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: result.success,
      home_team,
      away_team,
      markets: result.markets,
      raw_apis_captured: result.rawResponses,
      dom_odds: result.domOdds?.length || 0,
      source: result.success ? 'doradobet_puppeteer' : 'failed',
      error: result.error || null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
