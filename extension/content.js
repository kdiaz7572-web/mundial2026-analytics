/**
 * DoradoBet Content Script — Mundial 2026 Analytics
 * ============================================================
 * Detecta cuotas en tiempo real de doradobet.com usando los
 * selectores exactos del shadow DOM (Styled Components).
 *
 * Selectores descubiertos por inspección directa del DOM:
 *  - Shadow host:          div con shadowRoot que contiene el sportsbook
 *  - Match card:           [class*="BannerEventBoxContainer-sc-"]
 *  - Equipo:               [class*="CompetitorName-sc-"]
 *  - Cuota valor:          [class*="OddValue-sc-"]
 *  - Cuota label:          labels[0]=Local, labels[1]=Empate, labels[2]=Visitante
 *  - Liga:                 [class*="Competition-sc-"]
 */

'use strict';

// ── Configuración ────────────────────────────────────────────
const DB_CONFIG = {
  POLL_INTERVAL_MS : 3000,          // Re-escanear cada 3s (cuotas cambian)
  BADGE_CLASS      : 'mw26-edge-badge',
  OVERLAY_ID       : 'mw26-overlay',
  MIN_EDGE         : 0.012,         // 1.2% — mismo umbral que el modelo
  INJECT_BADGES    : true,          // Inyectar badges visuales en la página
};

// ── Utilidades ───────────────────────────────────────────────

/** Encuentra el shadow host principal que contiene el sportsbook */
function findSportsbookRoot() {
  // Busca el shadow host que contenga texto de partidos
  const hosts = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot);
  for (const host of hosts) {
    const text = host.shadowRoot.textContent || '';
    // El sportsbook siempre tiene texto de cuotas y equipos
    if (text.includes('Empate') || text.includes('1x2') || text.includes('OddValue')) {
      return host.shadowRoot;
    }
  }
  return null;
}

/** Extrae todos los partidos visibles en la página */
function scrapeMatches(sr) {
  const containers = sr.querySelectorAll('[class*="BannerEventBoxContainer-sc-"]');
  const matches = [];

  containers.forEach((card, idx) => {
    const teams   = card.querySelectorAll('[class*="CompetitorName-sc-"]');
    const odds    = card.querySelectorAll('[class*="OddValue-sc-"]');
    const labels  = card.querySelectorAll('[class*="OddLabel-sc-"], [class*="OddName-sc-"]');
    const leagueEl = card.querySelector('[class*="Competition-sc-"], [class*="EventCategory"], [class*="Category-sc-"]');
    const timeEl   = card.querySelector('[class*="EventTime-sc-"], [class*="Time-sc-"], [class*="Date-sc-"]');

    if (teams.length < 2 || odds.length < 2) return;

    const home  = teams[0]?.textContent?.trim() || 'Local';
    const away  = teams[1]?.textContent?.trim() || 'Visitante';
    const odds1 = parseFloat(odds[0]?.textContent) || 0;
    const oddsX = odds.length >= 3 ? parseFloat(odds[1]?.textContent) || 0 : 0;
    const odds2 = odds.length >= 3 ? parseFloat(odds[2]?.textContent) || 0
                                   : parseFloat(odds[1]?.textContent) || 0;

    matches.push({
      id       : `db-${idx}-${home.slice(0,4)}-${away.slice(0,4)}`.toLowerCase().replace(/\s/g,''),
      home, away,
      odds1, oddsX, odds2,
      league   : leagueEl?.textContent?.trim()?.slice(0, 40) || '',
      time     : timeEl?.textContent?.trim() || '',
      cardEl   : card,   // referencia DOM para inyectar badges
      isSoccer : odds.length >= 3,  // fútbol tiene 3 cuotas (1X2)
    });
  });

  return matches;
}

/** Convierte cuota decimal a probabilidad implícita */
function oddToProb(odd) {
  return odd > 0 ? 1 / odd : 0;
}

/** Calcula edge: probabilidad modelo vs probabilidad casa */
function calcEdge(modelProb, bookOdd) {
  const impliedProb = oddToProb(bookOdd);
  return modelProb - impliedProb;
}

// ── Comunicación con la app principal ───────────────────────

/**
 * Solicita al background el análisis del modelo para un partido.
 * El background script llama a mmAnalyzeMatch de nuestra app.
 */
function requestModelAnalysis(home, away) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'ANALYZE_MATCH', home, away },
      (response) => resolve(response || null)
    );
  });
}

// ── Inyección visual de badges en DoradoBet ─────────────────

/** Inyecta los estilos CSS para los badges */
function injectStyles() {
  if (document.getElementById('mw26-styles')) return;
  const style = document.createElement('style');
  style.id = 'mw26-styles';
  style.textContent = `
    .mw26-edge-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.4;
      z-index: 9999;
      pointer-events: none;
      font-family: -apple-system, monospace;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      animation: mw26-pulse 2s infinite;
    }
    .mw26-edge-badge.value {
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
      border: 1px solid #34d399;
    }
    .mw26-edge-badge.strong {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: #000;
      border: 1px solid #fcd34d;
    }
    .mw26-edge-badge.info {
      background: rgba(30,41,59,0.9);
      color: #94a3b8;
      border: 1px solid #475569;
    }
    @keyframes mw26-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    .mw26-overlay-panel {
      position: fixed;
      bottom: 80px;
      right: 16px;
      width: 320px;
      max-height: 480px;
      overflow-y: auto;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 12px;
      z-index: 99999;
      font-family: -apple-system, sans-serif;
      font-size: 12px;
      color: #e2e8f0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    }
    .mw26-overlay-panel h3 {
      margin: 0 0 8px;
      font-size: 13px;
      color: #f59e0b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mw26-match-row {
      background: #1e293b;
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 6px;
      border-left: 3px solid #334155;
    }
    .mw26-match-row.has-value {
      border-left-color: #10b981;
    }
    .mw26-match-title {
      font-weight: 700;
      color: #fff;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .mw26-pick-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
    }
    .mw26-pick-label { color: #94a3b8; }
    .mw26-pick-odds  { color: #fbbf24; font-weight: 600; }
    .mw26-pick-edge.pos { color: #34d399; font-weight: 700; }
    .mw26-pick-edge.neg { color: #f87171; }
    .mw26-close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      color: #64748b;
      font-size: 16px;
      background: none;
      border: none;
      line-height: 1;
    }
    .mw26-close-btn:hover { color: #e2e8f0; }
    .mw26-toggle-btn {
      position: fixed;
      bottom: 24px;
      right: 16px;
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      font-size: 22px;
      cursor: pointer;
      z-index: 99999;
      box-shadow: 0 4px 16px rgba(124,58,237,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .mw26-toggle-btn:hover { transform: scale(1.1); }
    .mw26-badge-count {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
  document.head.appendChild(style);
}

/** Crea o actualiza el panel flotante con los value bets detectados */
function updateOverlayPanel(valueMatches) {
  let panel = document.getElementById('mw26-overlay-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'mw26-overlay-panel';
    panel.className = 'mw26-overlay-panel';
    panel.style.display = 'none';
    document.body.appendChild(panel);
  }

  const total = valueMatches.reduce((s, m) => s + m.valuePicks.length, 0);

  panel.innerHTML = `
    <button class="mw26-close-btn" onclick="document.getElementById('mw26-overlay-panel').style.display='none'">×</button>
    <h3>⚽ Mundial 2026 Analytics <span style="color:#34d399;margin-left:auto;">${total} value bets</span></h3>
    ${valueMatches.length === 0
      ? '<p style="color:#64748b;text-align:center;padding:12px 0;">Sin value bets en esta página</p>'
      : valueMatches.map(m => `
        <div class="mw26-match-row ${m.valuePicks.length > 0 ? 'has-value' : ''}">
          <div class="mw26-match-title">${m.home} vs ${m.away}</div>
          ${m.valuePicks.map(p => `
            <div class="mw26-pick-item">
              <span class="mw26-pick-label">${p.label}</span>
              <span class="mw26-pick-odds">${p.odds.toFixed(2)}</span>
              <span class="mw26-pick-edge ${p.edge > 0 ? 'pos' : 'neg'}">
                ${p.edge > 0 ? '+' : ''}${(p.edge*100).toFixed(1)}%
              </span>
            </div>
          `).join('')}
          ${m.valuePicks.length === 0
            ? '<div style="color:#475569;font-size:10px;">Sin edge en 1X2</div>'
            : ''}
        </div>
      `).join('')}
  `;
}

/** Crea el botón flotante de toggle */
function createToggleButton(valueCount) {
  let btn = document.getElementById('mw26-toggle-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'mw26-toggle-btn';
    btn.className = 'mw26-toggle-btn';
    btn.title = 'Mundial 2026 Analytics';
    btn.innerHTML = '⚽';
    btn.onclick = () => {
      const panel = document.getElementById('mw26-overlay-panel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };
    document.body.appendChild(btn);
  }

  // Update badge count
  let badge = btn.querySelector('.mw26-badge-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'mw26-badge-count';
    btn.appendChild(badge);
  }
  badge.textContent = valueCount;
  badge.style.display = valueCount > 0 ? 'flex' : 'none';
}

// ── Motor de análisis simplificado (sin llamada a background) ─
// Usa Poisson simplificado directo en el content script

function poissonProb(lambda, k) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function quickModel(odds1, oddsX, odds2) {
  // Estimación rápida de lambdas a partir de cuotas de mercado
  // (deseamos estimar si hay edge sin llamar al servidor)
  const p1 = 1/odds1, pX = oddsX > 0 ? 1/oddsX : 0, p2 = 1/odds2;
  const margin = p1 + pX + p2;

  // Normalizar (quitar margen de la casa)
  const np1 = p1/margin, npX = pX/margin, np2 = p2/margin;

  // Lambdas aproximadas por método Dixon-Coles inverso simplificado
  // lH ≈ -ln(P(0-0)) × np1/(np1+np2) ... simplificamos con log transform
  const lH = Math.max(0.2, -Math.log(Math.max(0.01, npX)) * np1 * 2.5);
  const lA = Math.max(0.2, -Math.log(Math.max(0.01, npX)) * np2 * 2.5);

  // Calcular probabilidades con Poisson
  let p_home = 0, p_draw = 0, p_away = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = poissonProb(lH, h) * poissonProb(lA, a);
      if (h > a) p_home += p;
      else if (h === a) p_draw += p;
      else p_away += p;
    }
  }

  return { p_home, p_draw, p_away, lH, lA };
}

// ── Loop principal ───────────────────────────────────────────

let lastMatchIds = new Set();
let scanCount = 0;

async function scanAndAnnotate() {
  scanCount++;
  const sr = findSportsbookRoot();
  if (!sr) return;

  const rawMatches = scrapeMatches(sr);
  const footballMatches = rawMatches.filter(m => m.isSoccer);

  const enriched = footballMatches.map(m => {
    const model = quickModel(m.odds1, m.oddsX, m.odds2);

    const picks = [];
    if (m.odds1 > 0) {
      const e = calcEdge(model.p_home, m.odds1);
      picks.push({ label: `${m.home} gana`, odds: m.odds1, modelProb: model.p_home, edge: e });
    }
    if (m.oddsX > 0) {
      const e = calcEdge(model.p_draw, m.oddsX);
      picks.push({ label: 'Empate', odds: m.oddsX, modelProb: model.p_draw, edge: e });
    }
    if (m.odds2 > 0) {
      const e = calcEdge(model.p_away, m.odds2);
      picks.push({ label: `${m.away} gana`, odds: m.odds2, modelProb: model.p_away, edge: e });
    }

    const valuePicks = picks.filter(p => p.edge >= DB_CONFIG.MIN_EDGE);

    return { ...m, model, picks, valuePicks };
  });

  // Actualizar UI
  const totalValue = enriched.reduce((s, m) => s + m.valuePicks.length, 0);
  updateOverlayPanel(enriched);
  createToggleButton(totalValue);

  // Enviar datos al background para sincronizar con la app
  chrome.runtime.sendMessage({
    type   : 'DORADOBET_ODDS_UPDATE',
    matches: enriched.map(m => ({
      home: m.home, away: m.away,
      odds1: m.odds1, oddsX: m.oddsX, odds2: m.odds2,
      league: m.league, time: m.time,
      valuePicks: m.valuePicks.map(p => ({
        label: p.label, odds: p.odds,
        modelProb: p.modelProb, edge: p.edge
      }))
    }))
  });

  // Log en consola para debugging
  if (scanCount <= 3 || totalValue > 0) {
    console.log(`[MW2026] Scan #${scanCount} — ${footballMatches.length} partidos fútbol, ${totalValue} value bets`);
    if (totalValue > 0) {
      enriched.filter(m => m.valuePicks.length > 0).forEach(m => {
        console.log(`  📊 ${m.home} vs ${m.away}:`);
        m.valuePicks.forEach(p => {
          console.log(`     ✅ ${p.label}: ${p.odds.toFixed(2)} | Edge: +${(p.edge*100).toFixed(1)}%`);
        });
      });
    }
  }
}

// ── Inicialización ───────────────────────────────────────────

function init() {
  injectStyles();

  // Primer escaneo
  scanAndAnnotate();

  // Polling continuo
  setInterval(scanAndAnnotate, DB_CONFIG.POLL_INTERVAL_MS);

  // Observer para detectar navegación dentro de la SPA
  const observer = new MutationObserver(() => {
    clearTimeout(window._mw26ScanTimer);
    window._mw26ScanTimer = setTimeout(scanAndAnnotate, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[MW2026] Content script activo en DoradoBet ⚽');
}

// Esperar a que el shadow DOM cargue
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 2000));
} else {
  setTimeout(init, 2000);
}
