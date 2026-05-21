/**
 * Popup Script — Mundial 2026 Analytics Extension
 */
'use strict';

const APP_URL = 'http://localhost:3000';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)  return 'ahora';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s/60)}m`;
}

function renderMatches(matches) {
  if (!matches || matches.length === 0) {
    return `
      <div class="empty">
        <div class="empty-icon">📡</div>
        <div class="empty-txt">Abre DoradoBet Deportes para ver las cuotas</div>
        <button class="open-btn" id="open-doradobet">Abrir DoradoBet</button>
      </div>`;
  }

  // Ordenar: con value bets primero
  const sorted = [...matches].sort((a,b) => (b.valuePicks?.length||0) - (a.valuePicks?.length||0));

  return `<div class="match-list">${sorted.map(m => {
    const hasValue = m.valuePicks?.length > 0;

    const picks = [
      { label: m.home?.slice(0,12) || '1',  odds: m.odds1, pick: m.valuePicks?.find(p => p.label?.includes(m.home?.slice(0,5))) },
      { label: 'X',                          odds: m.oddsX, pick: m.valuePicks?.find(p => p.label === 'Empate') },
      { label: m.away?.slice(0,12) || '2',  odds: m.odds2, pick: m.valuePicks?.find(p => p.label?.includes(m.away?.slice(0,5))) },
    ].filter(p => p.odds > 0);

    return `
      <div class="match-card ${hasValue ? 'has-value' : ''}">
        <div class="match-league">${m.league || 'Fútbol'} · ${m.time || ''}</div>
        <div class="match-teams">${m.home} vs ${m.away}</div>
        <div class="odds-row">
          ${picks.map(p => {
            const edge = p.pick?.edge;
            const cls  = edge >= 0.06 ? 'strong-value' : edge >= 0.012 ? 'value-bet' : '';
            const edgeTxt = edge != null
              ? `<div class="odd-edge ${edge > 0 ? 'pos' : 'neg'}">${edge>0?'+':''}${(edge*100).toFixed(1)}%</div>`
              : '';
            return `
              <div class="odd-chip ${cls}">
                <div class="odd-lbl">${p.label}</div>
                <div class="odd-val">${p.odds?.toFixed(2) || '—'}</div>
                ${edgeTxt}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('')}</div>`;
}

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_MATCHES' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      document.getElementById('status-txt').textContent = 'Error al conectar con el background.';
      return;
    }

    const { matches, lastUpdate, valueBets } = resp;
    const isLive = lastUpdate && (Date.now() - lastUpdate < 30000);

    // Stats
    document.getElementById('stat-matches').textContent = matches?.length || 0;
    document.getElementById('stat-value').textContent   = valueBets || 0;
    document.getElementById('stat-update').textContent  = timeAgo(lastUpdate);

    // Status
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-txt');
    if (isLive) {
      dot.classList.add('active');
      txt.textContent = `Detectando cuotas en DoradoBet — ${matches?.length || 0} partidos`;
      document.getElementById('live-badge').style.display = 'inline-block';
    } else {
      dot.classList.remove('active');
      txt.textContent = 'Esperando datos de DoradoBet…';
    }

    // Content
    document.getElementById('content').innerHTML = renderMatches(matches);

    // Re-bind buttons
    const openBtn = document.getElementById('open-doradobet');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://doradobet.com/deportes' });
      });
    }
  });
}

// Botones del footer
document.getElementById('open-app').addEventListener('click', () => {
  chrome.tabs.create({ url: APP_URL });
});

document.getElementById('refresh-btn').addEventListener('click', () => {
  document.getElementById('stat-update').textContent = '…';
  loadData();
});

// Cargar al abrir el popup
loadData();

// Auto-refresh cada 5s
setInterval(loadData, 5000);
