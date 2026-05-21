/**
 * Background Service Worker — Mundial 2026 Analytics Extension
 * Recibe cuotas del content script y las sincroniza con la app local.
 */

'use strict';

const APP_URL = 'http://localhost:3000';

// Almacenamiento en memoria de los últimos datos scrapeados
let latestMatches = [];
let lastUpdate = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── Actualización de cuotas desde DoradoBet ──────────────
  if (msg.type === 'DORADOBET_ODDS_UPDATE') {
    latestMatches = msg.matches || [];
    lastUpdate = Date.now();

    // Guardar en chrome.storage para el popup
    chrome.storage.local.set({
      doradobet_matches: latestMatches,
      last_update: lastUpdate
    });

    // Badge en el icono de la extensión con número de value bets
    const valueBets = latestMatches.reduce((s, m) => s + (m.valuePicks?.length || 0), 0);
    if (valueBets > 0) {
      chrome.action.setBadgeText({ text: String(valueBets) });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }

    sendResponse({ ok: true });
    return true;
  }

  // ── Solicitud de análisis del modelo ──────────────────────
  if (msg.type === 'ANALYZE_MATCH') {
    // En futuro: llamar a la app en localhost:3000/api/analyze
    // Por ahora retorna los datos cacheados
    const match = latestMatches.find(m =>
      m.home?.toLowerCase().includes(msg.home?.toLowerCase()?.slice(0,5)) ||
      m.away?.toLowerCase().includes(msg.away?.toLowerCase()?.slice(0,5))
    );
    sendResponse({ match: match || null });
    return true;
  }

  // ── Solicitud del popup para obtener datos actuales ───────
  if (msg.type === 'GET_MATCHES') {
    sendResponse({
      matches: latestMatches,
      lastUpdate,
      valueBets: latestMatches.reduce((s, m) => s + (m.valuePicks?.length || 0), 0)
    });
    return true;
  }
});

// Limpiar badge al cambiar de tab
chrome.tabs.onActivated.addListener(() => {
  // Mantener badge visible siempre
});

console.log('[MW2026-BG] Service worker iniciado');
