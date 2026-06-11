// ============================================================
//  MUNDIAL 2026 ANALYTICS — CONTROLADOR PRINCIPAL
// ============================================================

// ——— Estado global ———
const STATE = {
  currentTab: 'dashboard',
  confederationFilter: 'ALL',
  groupFilter: 'A',
  modelTab: 'goles',
  modelAnalysis: null,
  modelRefType: 'default',
  calendarView: 'grupos',
};

// ——— Carga de resultados reales (The Odds API, vía /api/fixtures) ———
let _realResultsLoaded = false;
async function loadRealResults() {
  if (_realResultsLoaded) return;
  _realResultsLoaded = true;
  try {
    const res  = await fetch('/api/fixtures');
    const data = await res.json();
    if (!data || !data.ok || !data.results) return;
    Object.values(data.results).forEach(r => {
      const fx = FIXTURES.find(f => f.home === r.home && f.away === r.away);
      if (fx && r.homeGoals != null && r.awayGoals != null) {
        fx.homeGoals = r.homeGoals;
        fx.awayGoals = r.awayGoals;
      }
    });
    if (STATE.currentTab === 'calendario') renderCalendar();
  } catch (e) {
    // Falla silenciosa: la UI sigue funcionando con datos locales.
    console.warn('loadRealResults falló:', e);
  }
}

const TABS = [
  { id: 'dashboard',  label: '📊 Dashboard' },
  { id: 'equipos',    label: '🌍 Equipos' },
  { id: 'calendario', label: '📅 Calendario' },
  { id: 'zak',        label: '🤖 IA-Zak' },
  { id: 'analytics',  label: '📈 Analytics' },
];

const CONFEDERATIONS = ['ALL','UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC'];

// ——— Utilidades ———
const getTeam    = sn  => TEAMS.find(t => t.shortName === sn);
const fmtDate    = iso => new Date(iso + 'T00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
const fmtOdds    = n   => n.toFixed(2);

function formBadges(form) {
  return form.slice(-5).map(r =>
    `<span class="form-badge form-${r}">${r}</span>`
  ).join('');
}

function rankBadge(rank) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
  return `<span class="rank-badge ${cls}">${rank}</span>`;
}

function probBarColor(rank) {
  if (rank <= 3)  return 'prob-bar-top';
  if (rank <= 10) return 'prob-bar-mid';
  return 'prob-bar-low';
}

// ——— Standings de grupo ———
function calculateStandings(group) {
  const groupTeams = TEAMS.filter(t => t.group === group);
  const stats = {};
  groupTeams.forEach(t => {
    stats[t.shortName] = { team: t, P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, Pts:0 };
  });

  FIXTURES.filter(f => f.group === group && f.homeGoals !== null).forEach(f => {
    const h = stats[f.home], a = stats[f.away];
    if (!h || !a) return;
    h.P++; a.P++;
    h.GF += f.homeGoals; h.GA += f.awayGoals;
    a.GF += f.awayGoals; a.GA += f.homeGoals;
    if (f.homeGoals > f.awayGoals)       { h.W++; h.Pts+=3; a.L++; }
    else if (f.homeGoals < f.awayGoals)  { a.W++; a.Pts+=3; h.L++; }
    else                                  { h.D++; h.Pts++; a.D++; a.Pts++; }
    h.GD = h.GF - h.GA;
    a.GD = a.GF - a.GA;
  });

  return Object.values(stats).sort((a, b) =>
    b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF
  );
}

// ——— Guardar resultado de partido ———
function saveResult(fixtureId) {
  const hInput = document.getElementById(`home-${fixtureId}`);
  const aInput = document.getElementById(`away-${fixtureId}`);
  const hv = parseInt(hInput.value), av = parseInt(aInput.value);
  if (isNaN(hv) || isNaN(av) || hv < 0 || av < 0) {
    alert('Introduce marcadores válidos (números ≥ 0)'); return;
  }
  const fx = FIXTURES.find(f => f.id === fixtureId);
  fx.homeGoals = hv;
  fx.awayGoals = av;
  renderCalendar();
}

function clearResult(fixtureId) {
  const fx = FIXTURES.find(f => f.id === fixtureId);
  fx.homeGoals = null;
  fx.awayGoals = null;
  renderCalendar();
}

// ——— Guardar apuesta simulada ———
/**
 * Guarda una apuesta en el historial.
 * Acepta dos firmas:
 *   saveBet(shortName, algoProb, odds)          — legado (ganador torneo)
 *   saveBet({ team, flag, market, ... })        — extendido (picks IA-Zak)
 */
function saveBet(shortNameOrData, legacyAlgoProb, legacyOdds) {
  let betData;
  if (typeof shortNameOrData === 'object' && shortNameOrData !== null) {
    betData = shortNameOrData;
  } else {
    const team = getTeam(shortNameOrData);
    betData = {
      team:          team ? team.name : shortNameOrData,
      flag:          team ? team.flag : '🌍',
      algoProb:      legacyAlgoProb,
      odds:          legacyOdds,
      market:        'Ganador del torneo',
      matchup:       team ? team.name : shortNameOrData,
      justification: `Probabilidad del modelo: ${legacyAlgoProb}% frente a probabilidad implícita: ${(1/legacyOdds*100).toFixed(1)}%.`,
      impliedProb:   parseFloat((1/legacyOdds*100).toFixed(2)),
      edge:          parseFloat((legacyAlgoProb - 1/legacyOdds*100).toFixed(2)),
      stake:         0,
      totalReturn:   0,
      netProfit:     0,
    };
  }

  const bet = {
    id:      Date.now(),
    date:    new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    result:  'pending',
    ...betData,
  };

  STATE.bettingHistory.unshift(bet);
  localStorage.setItem('mundial2026_bets', JSON.stringify(STATE.bettingHistory));

  // ── Persist to Vercel Postgres (fire-and-forget) ─────────
  if (window.DB_API) {
    window.DB_API.saveBet(bet).then(dbRow => {
      if (dbRow?.id) {
        // Store DB id for future updates
        bet.dbId = dbRow.id;
        localStorage.setItem('mundial2026_bets', JSON.stringify(STATE.bettingHistory));
      }
    }).catch(() => {});
  }

  if (STATE.currentTab === 'apuestas') renderBetting();
  const msg = document.getElementById('bet-saved-msg');
  if (msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 2500); }
}

function markBet(id, result) {
  const bet = STATE.bettingHistory.find(b => b.id === id);
  if (bet) {
    bet.result = result;
    localStorage.setItem('mundial2026_bets', JSON.stringify(STATE.bettingHistory));
    // Sync to DB if we have a dbId
    if (window.DB_API && bet.dbId) {
      window.DB_API.updateBetResult(bet.dbId, result).catch(() => {});
    }
    renderHistory();
  }
}

function deleteBet(id) {
  const bet = STATE.bettingHistory.find(b => b.id === id);
  // Sync delete to DB
  if (window.DB_API && bet?.dbId) {
    window.DB_API.deleteBet(bet.dbId).catch(() => {});
  }
  STATE.bettingHistory = STATE.bettingHistory.filter(b => b.id !== id);
  localStorage.setItem('mundial2026_bets', JSON.stringify(STATE.bettingHistory));
  renderHistory();
}

// ============================================================
//  RENDERS
// ============================================================

// ——— DASHBOARD ———
function renderDashboard() {
  const probs      = calculateAllProbabilities();
  const top5       = probs.slice(0, 5);
  const upcoming   = FIXTURES.filter(f => f.homeGoals === null).slice(0, 4);
  const played     = FIXTURES.filter(f => f.homeGoals !== null).length;

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-8">

      <!-- Countdown Hero -->
      <div class="countdown-hero">
        <div class="countdown-flag-bg" aria-hidden="true">🇺🇸🇲🇽🇨🇦</div>
        <div class="relative z-10 text-center">
          <p class="text-[10px] font-black text-amber-500 tracking-[0.25em] uppercase mb-3">FIFA World Cup 2026 · USA · México · Canadá</p>
          <h2 class="text-3xl sm:text-4xl font-black text-white mb-1 leading-none">
            Mundial <span class="text-amber-400">2026</span>
          </h2>
          <p class="text-slate-500 text-sm mt-1 mb-5">11 de Junio — Ciudad de México / Los Ángeles / Toronto</p>

          <!-- Countdown units -->
          <div class="flex items-center justify-center gap-1 sm:gap-3 flex-wrap" id="countdown-display">
            <div class="countdown-unit"><span class="countdown-num" id="cd-days">--</span><span class="countdown-label">días</span></div>
            <span class="countdown-sep">:</span>
            <div class="countdown-unit"><span class="countdown-num" id="cd-hours">--</span><span class="countdown-label">horas</span></div>
            <span class="countdown-sep">:</span>
            <div class="countdown-unit"><span class="countdown-num" id="cd-mins">--</span><span class="countdown-label">min</span></div>
            <span class="countdown-sep">:</span>
            <div class="countdown-unit"><span class="countdown-num" id="cd-secs">--</span><span class="countdown-label">seg</span></div>
          </div>

          <!-- Top 5 chips -->
          <div class="flex gap-2 mt-5 justify-center flex-wrap">
            ${top5.slice(0,5).map(p => `
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                <span class="text-base leading-none">${p.team.flag}</span>
                <span class="text-[11px] font-bold text-slate-300">${p.team.shortName}</span>
                <span class="text-[10px] text-amber-400 font-mono">${p.probability}%</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="stat-card gold">
          <div class="stat-icon" style="background:var(--amber-dim)">⚽</div>
          <p class="stat-label">Equipos</p>
          <p class="stat-value">${TEAMS.length}</p>
          <p class="stat-sub">${GROUPS.length} grupos · 48 naciones</p>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon" style="background:var(--blue-dim)">📅</div>
          <p class="stat-label">Partidos</p>
          <p class="stat-value">${played}<span style="font-size:1rem;opacity:0.4">/${FIXTURES.length}</span></p>
          <p class="stat-sub">fase de grupos</p>
        </div>
        <div class="stat-card gold">
          <div class="stat-icon" style="background:var(--amber-dim)">${top5[0].team.flag}</div>
          <p class="stat-label">Favorito</p>
          <p class="stat-value" style="font-size:1.4rem">${top5[0].team.shortName}</p>
          <p class="stat-sub" style="color:var(--amber)">${top5[0].probability}% de probabilidad</p>
        </div>
      </div>

      <!-- Top 5 + Próximos -->
      <div class="grid md:grid-cols-2 gap-6 dashboard-main-grid">

        <!-- Top 5 favoritos -->
        <div class="card p-5">
          <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">🏆 Top 5 Favoritos</h3>
          <div class="space-y-3">
            ${top5.map(p => `
              <div class="flex items-center gap-3">
                ${rankBadge(p.rank)}
                <span class="text-xl">${p.team.flag}</span>
                <span class="text-sm font-semibold text-slate-200 w-28 truncate">${p.team.name}</span>
                <div class="flex-1">
                  <div class="prob-bar-container">
                    <div class="prob-bar ${probBarColor(p.rank)}" data-width="${p.probability / top5[0].probability * 100}"></div>
                  </div>
                </div>
                <span class="text-xs font-bold text-amber-400 w-12 text-right">${p.probability}%</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Próximos partidos -->
        <div class="card p-5">
          <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">📅 Próximos Partidos</h3>
          <div class="space-y-2">
            ${upcoming.length ? upcoming.map(f => {
              const h = getTeam(f.home), a = getTeam(f.away);
              return `
              <div class="match-card">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 flex-1">
                    <span class="text-xl leading-none">${h?.flag || '🏳️'}</span>
                    <span class="text-xs font-bold text-white">${h?.name || f.home}</span>
                  </div>
                  <div class="text-center flex-shrink-0 px-1">
                    <p class="text-[9px] text-slate-600 font-mono">${fmtDate(f.date)}</p>
                    <p class="text-[9px] font-bold text-amber-500">${f.group ? 'Gr.'+f.group : 'KO'}</p>
                  </div>
                  <div class="flex items-center gap-2 flex-1 justify-end">
                    <span class="text-xs font-bold text-white">${a?.name || f.away}</span>
                    <span class="text-xl leading-none">${a?.flag || '🏳️'}</span>
                  </div>
                </div>
              </div>`;
            }).join('') : '<p class="text-slate-500 text-sm text-center py-4">Todos los partidos jugados</p>'}
          </div>
        </div>
      </div>


    </div>`;

  // Animar barras tras render
  requestAnimationFrame(() => {
    document.querySelectorAll('.prob-bar[data-width]').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });

  // Iniciar / reiniciar countdown
  startCountdown();
}

// ——— Countdown al Mundial 2026 ———
let _countdownInterval = null;
function startCountdown() {
  if (_countdownInterval) clearInterval(_countdownInterval);
  const TARGET = new Date('2026-06-11T18:00:00-06:00'); // 6pm hora México (UTC-6)

  function tick() {
    const now  = new Date();
    const diff = TARGET - now;
    if (diff <= 0) {
      ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '00';
      });
      clearInterval(_countdownInterval);
      return;
    }
    const d  = Math.floor(diff / 86400000);
    const h  = Math.floor((diff % 86400000) / 3600000);
    const m  = Math.floor((diff % 3600000)  / 60000);
    const s  = Math.floor((diff % 60000)    / 1000);
    const fmt = n => String(n).padStart(2, '0');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v); };
    set('cd-days',  d);
    set('cd-hours', h);
    set('cd-mins',  m);
    set('cd-secs',  s);
  }
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

// ——— EQUIPOS ———
function renderTeams() {
  const conf   = STATE.confederationFilter;
  const teams  = conf === 'ALL' ? TEAMS : TEAMS.filter(t => t.confederation === conf);
  const probs  = calculateAllProbabilities();
  const probMap = {};
  probs.forEach(p => { probMap[p.team.shortName] = p; });

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-6">
      <div>
        <h2 class="section-title">🌍 Selecciones Participantes</h2>
        <p class="section-subtitle">${TEAMS.length} equipos clasificados para el Mundial 2026</p>
      </div>

      <!-- Filtros -->
      <div class="flex flex-wrap gap-2">
        ${CONFEDERATIONS.map(c => `
          <button onclick="filterTeams('${c}')"
            class="text-xs px-3 py-1.5 rounded-full font-semibold transition-all
              ${STATE.confederationFilter === c
                ? 'bg-amber-500 text-black'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}">
            ${c}
          </button>
        `).join('')}
      </div>

      <!-- Grid de equipos -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 teams-grid-xl">
        ${teams.map(team => {
          const p = probMap[team.shortName];
          return `
          <div class="flag-card team-card p-4" data-flag="${team.flag}" onclick="openTeamModal('${team.shortName}')">
            <div class="absolute top-2 right-2 text-6xl opacity-10 select-none pointer-events-none" aria-hidden="true">${team.flag}</div>
            <div class="flag-accent"></div>
            <div class="flex items-start justify-between mb-3 relative z-10">
              <div class="flex items-center gap-3">
                <span class="text-5xl leading-none drop-shadow-lg">${team.flag}</span>
                <div>
                  <p class="font-black text-white text-sm leading-tight">${team.name}</p>
                  <p class="text-[10px] text-slate-500 mt-0.5">${team.shortName} · Grupo ${team.group}</p>
                </div>
              </div>
              <span class="text-[10px] text-slate-600 font-mono">#${team.fifaRanking}</span>
            </div>

            <div class="flex gap-1 mb-3 relative z-10">${formBadges(team.recentForm)}</div>

            <div class="grid grid-cols-2 gap-2 text-xs mb-3 relative z-10">
              <div class="bg-[#0d1220] rounded-xl p-2.5 border border-[#1a2540]">
                <p class="text-slate-600 text-[10px]">Goles/prt</p>
                <p class="font-black text-emerald-400 text-sm mt-0.5">${team.goalsScored.toFixed(1)}</p>
              </div>
              <div class="bg-[#0d1220] rounded-xl p-2.5 border border-[#1a2540]">
                <p class="text-slate-600 text-[10px]">Concedidos</p>
                <p class="font-black text-red-400 text-sm mt-0.5">${team.goalsConceded.toFixed(1)}</p>
              </div>
            </div>

            <div class="flex items-center justify-between relative z-10">
              <span class="text-[10px] text-slate-600 truncate">⭐ ${team.starPlayer}</span>
              <span class="text-sm font-black ${p?.rank <= 3 ? 'text-amber-400' : 'text-white'} font-mono">${p ? p.probability + '%' : '—'}</span>
            </div>

            <div class="prob-bar-container mt-2 relative z-10">
              <div class="prob-bar ${probBarColor(p?.rank || 99)}"
                data-width="${p ? (p.probability / probs[0].probability * 100) : 0}">
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    document.querySelectorAll('.prob-bar[data-width]').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });
}

function filterTeams(conf) {
  STATE.confederationFilter = conf;
  renderTeams();
}

function openTeamModal(shortName) {
  const team = getTeam(shortName);
  const probs = calculateAllProbabilities();
  const p = probs.find(x => x.team.shortName === shortName);
  const bd = getScoreBreakdown(team);
  const market = DORADOBET_ODDS[shortName];

  const breakdown = [
    { label: 'Ranking FIFA',   value: bd.ranking,  max: 30, color: 'bg-blue-500' },
    { label: 'Forma reciente', value: bd.forma,     max: 25, color: 'bg-amber-500' },
    { label: 'Poder ofensivo', value: bd.ataque,    max: 20, color: 'bg-green-500' },
    { label: 'Solidez defensiva', value: bd.defensa, max: 15, color: 'bg-purple-500' },
    { label: 'Jugador estrella', value: bd.estrella, max: 10, color: 'bg-pink-500' },
  ];

  openModal(`
    <div class="text-center mb-5">
      <div class="text-6xl mb-2">${team.flag}</div>
      <h2 class="text-xl font-bold text-white">${team.name}</h2>
      <p class="text-slate-400 text-sm">${team.confederation} · Grupo ${team.group} · FIFA #${team.fifaRanking}</p>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-5">
      <div class="bg-slate-900 rounded-xl p-3 text-center">
        <p class="text-2xl font-extrabold text-amber-400">${p?.probability}%</p>
        <p class="text-xs text-slate-500 mt-1">Prob. campeón (algo.)</p>
      </div>
      <div class="bg-slate-900 rounded-xl p-3 text-center">
        <p class="text-2xl font-extrabold text-white">${market ? market.odds.toFixed(2) : '—'}</p>
        <p class="text-xs text-slate-500 mt-1">Cuota DoradoBet</p>
      </div>
    </div>

    <div class="mb-4">
      <p class="text-xs font-bold text-slate-400 uppercase mb-3">Desglose del Algoritmo</p>
      <div class="space-y-2">
        ${breakdown.map(b => `
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 w-36">${b.label}</span>
            <div class="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div class="${b.color} h-full rounded-full" style="width:${(b.value/b.max*100).toFixed(0)}%"></div>
            </div>
            <span class="text-xs text-white w-8 text-right">${b.value}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div>
      <p class="text-xs font-bold text-slate-400 uppercase mb-2">Forma Reciente (10 partidos)</p>
      <div class="flex gap-1 flex-wrap">${team.recentForm.map(r =>
        `<span class="form-badge form-${r}">${r}</span>`).join('')}
      </div>
    </div>

    <div class="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2">
      <span class="text-lg">⭐</span>
      <div>
        <p class="text-xs text-slate-500">Jugador estrella</p>
        <p class="text-sm font-semibold text-white">${team.starPlayer}</p>
      </div>
      <div class="ml-auto bg-slate-800 px-3 py-1 rounded-full">
        <span class="text-amber-400 font-bold text-sm">${team.starPlayerValue}/100</span>
      </div>
    </div>

    <!-- Convocatoria Tab -->
    ${(() => {
      const squad = getSquad(shortName);
      if (!squad) return `<div class="mt-4 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
        Convocatoria no disponible aún — se actualizará con listas oficiales FIFA.
      </div>`;
      return `
      <div class="mt-4 pt-4 border-t border-slate-700">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">🧑‍🤝‍🧑 Convocatoria — ${squad.players.length} jugadores</p>
          <span class="text-xs text-slate-500">DT: ${squad.coach}</span>
        </div>
        <div style="max-height:260px;overflow-y:auto;scrollbar-width:thin;">
          <table class="w-full text-xs" style="border-collapse:collapse;">
            <thead>
              <tr class="text-left" style="background:#1e293b;position:sticky;top:0;">
                <th class="px-2 py-2 text-slate-400 font-semibold w-6">#</th>
                <th class="px-2 py-2 text-slate-400 font-semibold">Jugador</th>
                <th class="px-2 py-2 text-slate-400 font-semibold text-center">Pos</th>
                <th class="px-2 py-2 text-slate-400 font-semibold hidden sm:table-cell">Club</th>
                <th class="px-2 py-2 text-slate-400 font-semibold text-center">Caps</th>
                <th class="px-2 py-2 text-slate-400 font-semibold text-center">Edad</th>
              </tr>
            </thead>
            <tbody>
              ${squad.players.map((pl, i) => `
              <tr style="border-bottom:1px solid #1f2937;background:${i%2===0?'transparent':'rgba(255,255,255,.015)'}">
                <td class="px-2 py-1.5 text-slate-500 font-mono">${pl.n}</td>
                <td class="px-2 py-1.5 text-white font-semibold">${pl.name}</td>
                <td class="px-2 py-1.5 text-center">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style="background:${pl.pos==='GK'?'rgba(99,102,241,.2)':pl.pos==='CB'||pl.pos==='RB'||pl.pos==='LB'?'rgba(59,130,246,.2)':pl.pos==='DM'||pl.pos==='CM'?'rgba(16,185,129,.2)':'rgba(245,158,11,.2)'};color:${pl.pos==='GK'?'#a5b4fc':pl.pos==='CB'||pl.pos==='RB'||pl.pos==='LB'?'#93c5fd':pl.pos==='DM'||pl.pos==='CM'?'#6ee7b7':'#fcd34d'}">
                    ${pl.pos}
                  </span>
                </td>
                <td class="px-2 py-1.5 text-slate-400 hidden sm:table-cell">${pl.club}</td>
                <td class="px-2 py-1.5 text-center text-slate-300">${pl.caps}</td>
                <td class="px-2 py-1.5 text-center text-slate-400">${pl.age}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-[10px] text-slate-600 mt-2 text-center">
          * Lista estimada pre-torneo. Actualizar con convocatorias oficiales FIFA.
        </p>
      </div>`;
    })()}
  `);
}

// ——— CALENDARIO ———

// Toggle Grupos / Eliminatorias
function calendarViewToggle(active) {
  const btn = (v, label) => `
    <button onclick="setCalendarView('${v}')"
      class="px-4 py-2 rounded-xl text-sm font-bold transition-all
        ${active === v
          ? 'bg-amber-500 text-black'
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}">
      ${label}
    </button>`;
  return `
    <div class="flex gap-2">
      ${btn('grupos', 'Grupos')}
      ${btn('eliminatorias', 'Eliminatorias')}
    </div>`;
}

// Sub-vista de cuadro de eliminatorias
function renderCalendarBracket() {
  const complete = (typeof isGroupStageComplete === 'function') ? isGroupStageComplete() : false;
  let bracketHtml;
  if (typeof renderBracketView === 'function' && typeof computeBracket === 'function') {
    bracketHtml = renderBracketView(computeBracket());
  } else {
    bracketHtml = `
      <div class="card p-8 text-center text-slate-400 text-sm">
        ⏳ Cargando bracket…
      </div>`;
  }

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-6">
      <div>
        <h2 class="section-title">📅 Calendario & Resultados</h2>
        <p class="section-subtitle">Cuadro de eliminatorias</p>
      </div>

      ${calendarViewToggle('eliminatorias')}

      ${!complete ? `
        <div class="card px-4 py-3 border-l-4 border-amber-500 bg-amber-500/5 text-sm text-amber-200">
          Fase de grupos en curso — el cuadro se completa cuando terminen los 12 grupos.
        </div>` : ''}

      <div class="bracket-wrapper">
        ${bracketHtml}
      </div>
    </div>`;
}

function renderCalendar() {
  const view = STATE.calendarView || 'grupos';

  // ——— Sub-vista: Eliminatorias (bracket) ———
  if (view === 'eliminatorias') {
    renderCalendarBracket();
    return;
  }

  const group    = STATE.groupFilter;
  const fixtures = FIXTURES.filter(f => f.group === group);
  const standings = calculateStandings(group);
  const todayStr = new Date().toISOString().slice(0, 10);

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-6">
      <div>
        <h2 class="section-title">📅 Calendario & Resultados</h2>
        <p class="section-subtitle">Resultados reales sincronizados a diario</p>
      </div>

      ${calendarViewToggle(view)}

      <!-- Selector de grupo -->
      <div class="flex flex-wrap gap-2">
        ${GROUPS.map(g => `
          <button onclick="filterGroup('${g}')"
            class="w-10 h-10 rounded-xl font-bold text-sm transition-all
              ${STATE.groupFilter === g
                ? 'bg-amber-500 text-black'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}">
            ${g}
          </button>
        `).join('')}
      </div>

      <div class="grid lg:grid-cols-2 gap-6 calendar-desktop-grid">

        <!-- Tabla de posiciones -->
        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 class="font-bold text-white text-sm">Grupo ${group} — Posiciones</h3>
            <span class="text-xs text-slate-500">${standings.filter(s => s.P > 0).length > 0 ? standings.filter(s => s.P > 0).length + ' partidos jugados' : 'Sin resultados aún'}</span>
          </div>
          <table class="w-full standings-table">
            <thead>
              <tr class="bg-slate-900/50">
                <th class="text-left">#</th>
                <th class="text-left">Equipo</th>
                <th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
                <th>GF</th><th>GC</th><th>GD</th>
                <th class="text-amber-400">Pts</th>
              </tr>
            </thead>
            <tbody>
              ${standings.map((s, i) => `
                <tr class="${i < 2 ? (i === 0 ? 'qualified-1' : 'qualified-2') : ''}">
                  <td>${i+1}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <span>${s.team.flag}</span>
                      <span class="font-semibold text-white hidden sm:inline">${s.team.name}</span>
                      <span class="font-semibold text-white sm:hidden">${s.team.shortName}</span>
                    </div>
                  </td>
                  <td class="text-center text-slate-400">${s.P}</td>
                  <td class="text-center text-green-400">${s.W}</td>
                  <td class="text-center text-amber-400">${s.D}</td>
                  <td class="text-center text-red-400">${s.L}</td>
                  <td class="text-center text-slate-300">${s.GF}</td>
                  <td class="text-center text-slate-300">${s.GA}</td>
                  <td class="text-center ${s.GD > 0 ? 'text-green-400' : s.GD < 0 ? 'text-red-400' : 'text-slate-400'}">${s.GD > 0 ? '+' : ''}${s.GD}</td>
                  <td class="text-center font-extrabold text-white">${s.Pts}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="px-5 py-2 bg-slate-900/30 flex gap-4 text-xs text-slate-500">
            <span class="flex items-center gap-1"><span class="w-3 h-3 bg-emerald-500 rounded-sm inline-block"></span> Clasificado 1°</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 bg-blue-500 rounded-sm inline-block"></span> Clasificado 2°</span>
          </div>
        </div>

        <!-- Partidos del grupo -->
        <div class="space-y-3">
          ${[1,2,3]
            .map(md => ({ md, mdFix: fixtures.filter(f => f.matchday === md) }))
            .sort((a, b) => {
              const aT = a.mdFix.some(f => f.date === todayStr) ? 1 : 0;
              const bT = b.mdFix.some(f => f.date === todayStr) ? 1 : 0;
              return bT - aT; // jornadas con partidos de HOY primero
            })
            .map(({ md, mdFix }) => {
            const hasToday = mdFix.some(f => f.date === todayStr);
            return `
            <div class="card overflow-hidden ${hasToday ? 'ring-1 ring-amber-400/50' : ''}">
              <div class="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase">Jornada ${md}</span>
                ${hasToday ? `<span class="text-[10px] font-extrabold text-amber-400 uppercase">● Hoy</span>` : ''}
              </div>
              <div class="p-3 space-y-2">
                ${mdFix.map(f => {
                  const h = getTeam(f.home), a = getTeam(f.away);
                  const played   = f.homeGoals !== null;
                  const isToday  = f.date === todayStr;
                  const ld       = AppState.getLive(f.id);
                  const isLive   = ld && ['1H','HT','2H'].includes(ld.status);
                  const isSimFT  = !played && ld && ld.status === 'FT';

                  // ── Marcador central ──────────────────────────────────────
                  let scoreHtml;
                  if (played) {
                    scoreHtml = `
                      <span class="text-lg font-extrabold text-white">${f.homeGoals}</span>
                      <span class="text-slate-500 text-sm">–</span>
                      <span class="text-lg font-extrabold text-white">${f.awayGoals}</span>`;
                  } else if (isLive) {
                    const timeBadge = ld.status === 'HT'
                      ? `<span class="text-xs text-amber-400 font-bold px-1">HT</span>`
                      : `<span class="text-xs text-red-400 font-bold animate-pulse px-1">${ld.elapsed}'</span>`;
                    scoreHtml = `
                      ${timeBadge}
                      <span class="text-lg font-extrabold text-emerald-400">${ld.homeGoals}</span>
                      <span class="text-slate-400 text-sm">–</span>
                      <span class="text-lg font-extrabold text-emerald-400">${ld.awayGoals}</span>`;
                  } else if (isSimFT) {
                    scoreHtml = `
                      <span class="text-[10px] text-slate-500 font-bold mr-0.5">FT</span>
                      <span class="text-lg font-extrabold text-slate-300">${ld.homeGoals}</span>
                      <span class="text-slate-500 text-sm">–</span>
                      <span class="text-lg font-extrabold text-slate-300">${ld.awayGoals}</span>`;
                  } else {
                    // Partido aún no jugado: solo hora + estado "Programado".
                    scoreHtml = `
                      <span class="text-sm font-bold text-slate-300">${f.time}</span>`;
                  }

                  // ── Fila de stats en vivo ─────────────────────────────────
                  const liveStatsRow = isLive ? `
                    <div class="flex items-center justify-center gap-3 mt-1.5">
                      <span class="text-[11px] text-slate-400">🚩 <span class="font-semibold">${ld.corners.home}</span>–<span class="font-semibold">${ld.corners.away}</span> córners</span>
                      <span class="text-[11px] text-amber-400">🟨 ${ld.cards.homeYellow + ld.cards.awayYellow}</span>
                      ${(ld.cards.homeRed + ld.cards.awayRed) > 0
                        ? `<span class="text-[11px] text-red-400">🟥 ${ld.cards.homeRed + ld.cards.awayRed}</span>` : ''}
                    </div>` : '';

                  // ── Clases de la tarjeta ──────────────────────────────────
                  const extraClass = (isLive
                    ? 'live-match-card'
                    : isSimFT
                    ? 'sim-ft-card'
                    : '')
                    + (isToday ? ' ring-2 ring-amber-400/70 ring-offset-1 ring-offset-slate-900' : '');

                  // ── Footer: fecha + acción ────────────────────────────────
                  let footerAction;
                  if (!played && !isLive && !isSimFT) {
                    footerAction = `<span class="text-[11px] text-slate-500 ml-2">Programado</span>`;
                  } else if (isLive) {
                    footerAction = `<span class="text-[11px] text-emerald-400 animate-pulse font-bold ml-2">⚡ EN VIVO</span>`;
                  } else if (isSimFT) {
                    footerAction = `
                      <span class="text-[11px] text-slate-500 ml-2">Sim. completada</span>
                      <button onclick="saveSimResult(${f.id},${ld.homeGoals},${ld.awayGoals})"
                        class="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded-lg transition-all font-semibold ml-1">
                        ✓ Guardar
                      </button>`;
                  } else {
                    footerAction = '';
                  }

                  return `
                  <div id="match-card-${f.id}" class="match-card ${played ? 'played' : ''} ${extraClass}">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <span class="text-xl">${h.flag}</span>
                        <span class="text-xs font-semibold text-white truncate">${h.shortName}</span>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">${scoreHtml}</div>
                      <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <span class="text-xs font-semibold text-white truncate">${a.shortName}</span>
                        <span class="text-xl">${a.flag}</span>
                      </div>
                    </div>
                    ${liveStatsRow}
                    <div class="flex items-center justify-center mt-1 flex-wrap gap-1">
                      ${isToday ? `<span class="text-[10px] font-extrabold text-black bg-amber-400 px-1.5 py-0.5 rounded">HOY</span>` : ''}
                      <span class="text-xs text-slate-600">${fmtDate(f.date)} · ${f.time}</span>
                      ${footerAction}
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function filterGroup(g) {
  STATE.groupFilter = g;
  renderCalendar();
}

// ──────────────────────────────────────────────────────────────
//  DESPLEGABLE DE PICKS POR PARTIDO (Calendario)
// ──────────────────────────────────────────────────────────────

/**
 * Toggle del panel de picks para una tarjeta de partido.
 * Si está cerrado lo abre y carga los mercados vía OddsEngine.
 */
async function toggleFixturePicks(fixtureId, homeKey, awayKey) {
  const panelId = `fixture-picks-${fixtureId}`;
  const panel   = document.getElementById(panelId);
  const btn     = document.getElementById(`picks-btn-${fixtureId}`);
  if (!panel) return;

  // Cerrar si ya está abierto
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    if (btn) { btn.textContent = '📊 Picks'; btn.classList.remove('text-blue-200'); }
    return;
  }

  // Abrir y mostrar loader
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="py-3 text-center text-xs text-slate-500 animate-pulse">
      ⏳ Analizando mercados DoradoBet…
    </div>`;
  if (btn) { btn.textContent = '✕ Cerrar'; btn.classList.add('text-blue-200'); }

  try {
    const refProfile = RefEngine.getForFixture(fixtureId);
    const { analysis, odds, markets } = await OddsEngine.getOdds(homeKey, awayKey, refProfile);
    panel.innerHTML = _renderFixturePicksPanel(fixtureId, homeKey, awayKey, analysis, odds, markets);
  } catch (e) {
    console.warn('[toggleFixturePicks]', e);
    panel.innerHTML = `
      <div class="py-3 text-center text-xs text-red-400">
        ⚠️ Error al cargar mercados. Intenta de nuevo.
      </div>`;
  }
}

/**
 * Construye el HTML del panel de picks de una tarjeta de partido.
 */
function _renderFixturePicksPanel(fixtureId, homeKey, awayKey, analysis, odds, markets) {
  const h = getTeam(homeKey), a = getTeam(awayKey);
  const VALUE_EDGE = 0.012;

  // Separar mercados con valor y sin valor
  const valueMkts = markets.filter(m => m.edge >= VALUE_EDGE).sort((x, y) => y.edge - x.edge);
  const allMkts   = markets.sort((x, y) => y.modelProb - x.modelProb);

  // Agrupar todos los mercados por categoría para mostrar tabla completa
  const mktGroups = [
    { label: '🏆 Resultado Final',  ids: ['home','draw','away','dc_1x','dc_x2'] },
    { label: '⚽ Goles',            ids: ['over15','over25','under25','over35','btts_yes','btts_no'] },
    { label: '⚡ Primer Gol',       ids: ['fg_home','fg_away'] },
    { label: '🚩 Córners',          ids: ['c_over85','c_over95','c_over105','c_under95'] },
    { label: '🟨 Tarjetas',         ids: ['pts_over255','pts_over355','pts_under355'] },
  ];

  const mktMap = Object.fromEntries(markets.map(m => [m.id, m]));

  const groupRows = mktGroups.map(g => {
    const rows = g.ids
      .map(id => mktMap[id])
      .filter(Boolean)
      .map(m => {
        const isValue  = m.edge >= VALUE_EDGE;
        const edgeTxt  = m.edge > 0 ? `+${(m.edge*100).toFixed(1)}%` : `${(m.edge*100).toFixed(1)}%`;
        const edgeCls  = m.edge >= 0.06 ? 'text-emerald-300 font-extrabold'
                       : m.edge >= 0.03 ? 'text-emerald-400 font-bold'
                       : m.edge >= VALUE_EDGE ? 'text-green-400 font-semibold'
                       : 'text-slate-500';
        const uid      = `fp-${fixtureId}-${m.id}`;
        return `
        <tr class="${isValue ? 'bg-emerald-950/40' : ''} border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
          <td class="px-2 py-1.5 text-xs text-slate-300">${m.label}</td>
          <td class="px-2 py-1.5 text-xs text-center font-bold text-white">${m.odds.toFixed(2)}</td>
          <td class="px-2 py-1.5 text-xs text-center text-slate-400">${(m.modelProb*100).toFixed(1)}%</td>
          <td class="px-2 py-1.5 text-xs text-center ${edgeCls}">${edgeTxt}</td>
          <td class="px-2 py-1.5 text-center">
            ${isValue
              ? `<span class="text-[10px] bg-emerald-900 text-emerald-400 border border-emerald-700 px-1.5 py-0.5 rounded-full font-bold">VALUE ✅</span>`
              : `<span class="text-[10px] text-slate-600">—</span>`}
          </td>
          <td class="px-2 py-1.5 text-center">
            <button onclick="savePickFromCalendar('${uid}','${homeKey}','${awayKey}','${m.label.replace(/'/g,'')}',${m.odds},${m.modelProb},${m.edge})"
              class="text-[10px] bg-slate-700 hover:bg-emerald-800 text-slate-400 hover:text-emerald-300
                     border border-slate-600 hover:border-emerald-600 px-2 py-0.5 rounded-lg transition-all">
              💾
            </button>
          </td>
        </tr>`;
      }).join('');

    if (!rows) return '';
    return `
    <tr class="bg-slate-900/60">
      <td colspan="6" class="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">${g.label}</td>
    </tr>
    ${rows}`;
  }).join('');

  // Banner del mejor pick de este partido
  const bestPick = valueMkts[0];
  const bestBanner = bestPick ? `
    <div class="px-3 py-2 flex items-center gap-2 flex-wrap" style="background:rgba(16,185,129,.08);border-bottom:1px solid rgba(16,185,129,.15);">
      <span class="text-xs">🎯</span>
      <span class="text-xs font-bold text-emerald-400">Mejor valor:</span>
      <span class="text-xs text-white font-semibold">${bestPick.label}</span>
      <span class="text-xs text-amber-400 font-bold">${bestPick.odds.toFixed(2)}</span>
      <span class="text-xs text-emerald-400">Edge: +${(bestPick.edge*100).toFixed(1)}%</span>
      <span class="ml-auto text-[10px] text-slate-500">
        Modelo: ${(bestPick.modelProb*100).toFixed(1)}% · Casa: ${(1/bestPick.odds*100).toFixed(1)}%
      </span>
    </div>` : '';

  return `
  <div class="fixture-picks-panel-inner mt-2" style="border-top:1px solid #1f2937;">
    <!-- Header -->
    <div class="px-3 py-2 flex items-center justify-between" style="background:#0d1117;">
      <div class="flex items-center gap-2">
        <span class="text-sm">${h?.flag}${a?.flag}</span>
        <span class="text-xs font-bold text-white">${h?.name} vs ${a?.name}</span>
      </div>
      <div class="flex items-center gap-2">
        ${valueMkts.length > 0
          ? `<span class="text-[10px] bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 px-2 py-0.5 rounded-full font-bold">${valueMkts.length} VALUE BETS</span>`
          : `<span class="text-[10px] text-slate-600">Sin value bets</span>`}
        <span class="text-[10px] text-slate-600">λH=${analysis.lambdas.home.toFixed(2)} λA=${analysis.lambdas.away.toFixed(2)}</span>
      </div>
    </div>

    ${bestBanner}

    <!-- Tabla de mercados -->
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto;">
      <table class="w-full" style="min-width:380px;border-collapse:collapse;">
        <thead style="position:sticky;top:0;background:#111827;z-index:1;">
          <tr class="text-left border-b border-slate-700">
            <th class="px-2 py-1.5 text-[10px] text-slate-500 font-semibold">Mercado DoradoBet</th>
            <th class="px-2 py-1.5 text-[10px] text-slate-500 font-semibold text-center">Cuota</th>
            <th class="px-2 py-1.5 text-[10px] text-slate-500 font-semibold text-center">Modelo</th>
            <th class="px-2 py-1.5 text-[10px] text-slate-500 font-semibold text-center">Edge</th>
            <th class="px-2 py-1.5 text-[10px] text-slate-500 font-semibold text-center">Estado</th>
            <th class="px-2 py-1.5 text-[10px] text-slate-500 font-semibold text-center">Guardar</th>
          </tr>
        </thead>
        <tbody>
          ${groupRows}
        </tbody>
      </table>
    </div>

    <!-- Learning Engine badge -->
    <div class="px-3 py-1.5 flex items-center gap-2 border-t border-slate-800">
      ${LearningEngine ? `
      <span class="text-[10px] text-emerald-600">🧠 Agente activo · λ blend ${LearningEngine.getBlendRatio()}%</span>
      ` : ''}
      <span class="ml-auto text-[10px] text-slate-700">Poisson-Dixon/Coles · DEMO mode</span>
    </div>
  </div>`;
}

/**
 * Guardar apuesta directamente desde el calendario.
 */
function savePickFromCalendar(uid, homeKey, awayKey, label, odds, modelProb, edge) {
  const h = getTeam(homeKey), a = getTeam(awayKey);
  saveBet({
    team:        h?.name || homeKey,
    flag:        h?.flag || '🏠',
    matchup:     `${h?.name || homeKey} vs ${a?.name || awayKey}`,
    market:      label,
    odds,
    algoProb:    parseFloat((modelProb * 100).toFixed(1)),
    impliedProb: parseFloat((1/odds * 100).toFixed(1)),
    edge:        parseFloat((edge * 100).toFixed(2)),
    justification: `Value bet detectado: ${label} con cuota ${odds.toFixed(2)}. Modelo Poisson asigna ${(modelProb*100).toFixed(1)}% frente al ${(1/odds*100).toFixed(1)}% implícito. Edge: +${(edge*100).toFixed(1)}pp.`,
    stake: 0, totalReturn: 0, netProfit: 0,
  });
  // Flash visual en el botón
  const btn = document.querySelector(`[onclick*="${uid}"]`);
  if (btn) { btn.textContent = '✅'; setTimeout(() => btn.textContent = '💾', 1500); }
}

// ——— PREDICCIONES ———
function renderPredictions() {
  const probs = calculateAllProbabilities();

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-6">
      <div>
        <h2 class="section-title">🔮 Predicciones Pre-torneo</h2>
        <p class="section-subtitle">Algoritmo de pesos estadísticos — Probabilidad de ganar el Mundial 2026</p>
      </div>

      <!-- Leyenda del algoritmo -->
      <div class="card p-5">
        <h3 class="text-xs font-bold text-slate-400 uppercase mb-4">Variables del modelo</h3>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
          ${[
            { color:'bg-blue-500',   pct:'30%', label:'Ranking FIFA' },
            { color:'bg-amber-500',  pct:'25%', label:'Forma reciente' },
            { color:'bg-green-500',  pct:'20%', label:'Poder ofensivo' },
            { color:'bg-purple-500', pct:'15%', label:'Solidez defensiva' },
            { color:'bg-pink-500',   pct:'10%', label:'Jugador estrella' },
          ].map(v => `
            <div class="bg-slate-900 rounded-xl p-3">
              <div class="w-3 h-3 ${v.color} rounded-full mx-auto mb-2"></div>
              <p class="text-white font-bold text-lg">${v.pct}</p>
              <p class="text-slate-500">${v.label}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Ranking completo -->
      <div class="card overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800">
          <h3 class="font-bold text-white text-sm">Ranking de Probabilidades — ${Object.keys(TEAMS).length} selecciones</h3>
        </div>
        <div class="divide-y divide-slate-800/60">
          ${probs.map(p => {
            const bd = getScoreBreakdown(p.team);
            const barPct = (p.probability / probs[0].probability * 100).toFixed(1);
            return `
            <div class="flex items-center gap-3 px-5 py-3 hover:bg-slate-900/40 transition-colors group">
              ${rankBadge(p.rank)}
              <span class="text-2xl">${p.team.flag}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-white">${p.team.name}</span>
                  <span class="tag bg-slate-800 text-slate-500 text-xs hidden sm:inline">${p.team.confederation}</span>
                  <span class="tag bg-slate-800 text-slate-500 text-xs">Grupo ${p.team.group}</span>
                </div>
                <div class="mt-1 prob-bar-container">
                  <div class="prob-bar ${probBarColor(p.rank)}" data-width="${barPct}"></div>
                </div>
                <!-- Desglose mini (visible en hover) -->
                <div class="hidden group-hover:flex gap-3 mt-1.5 flex-wrap">
                  <span class="text-xs text-blue-400">RK: ${bd.ranking}</span>
                  <span class="text-xs text-amber-400">Forma: ${bd.forma}</span>
                  <span class="text-xs text-green-400">Atq: ${bd.ataque}</span>
                  <span class="text-xs text-purple-400">Def: ${bd.defensa}</span>
                  <span class="text-xs text-pink-400">★ ${bd.estrella}</span>
                </div>
              </div>
              <div class="text-right">
                <p class="text-base font-extrabold ${p.rank <= 3 ? 'text-amber-400' : 'text-white'}">${p.probability}%</p>
                <p class="text-xs text-slate-600">FIFA #${p.team.fifaRanking}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <p class="text-xs text-slate-600 text-center">
        * Datos estructurados listos para conectarse a una API real (API-Football, FIFA API).
        Las probabilidades son estimaciones estadísticas, no predicciones definitivas.
      </p>
    </div>`;

  requestAnimationFrame(() => {
    document.querySelectorAll('.prob-bar[data-width]').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });
}

// ——— ASISTENTE DE APUESTAS ———
function renderBetting() {
  // ── Obtener picks del IA-Zak (fuente primaria) ────────────
  const VALUE_EDGE = 0.012;   // Regla: edge ≥ 1.2 pp para activar la alerta
  const allPicks   = AppState.getPicks();
  const valuePicks = allPicks
    .map(fp => ({ ...fp, picks: fp.picks.filter(p => p.edge >= VALUE_EDGE) }))
    .filter(fp => fp.picks.length > 0);
  const totalPicks = valuePicks.reduce((n, fp) => n + fp.picks.length, 0);
  const avgEdge    = totalPicks > 0
    ? (valuePicks.flatMap(fp => fp.picks).reduce((s, p) => s + p.edge, 0) / totalPicks * 100).toFixed(1)
    : '—';

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-6">

      <!-- Título -->
      <div>
        <h2 class="section-title">💡 Asistente de Apuestas Inteligente</h2>
        <p class="section-subtitle">Modelo Poisson · Árbitros dinámicos · DoradoBet · Calculadora <span class="text-amber-400 font-bold">₡ Colones</span></p>
      </div>

      <!-- Stats bar rápidas -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="stat-card blue text-center">
          <p class="text-2xl font-bold text-white">${totalPicks}</p>
          <p class="text-xs text-slate-500 mt-1">Value Bets activas</p>
        </div>
        <div class="stat-card green text-center">
          <p class="text-2xl font-bold text-emerald-400">${avgEdge !== '—' ? '+' + avgEdge + '%' : '—'}</p>
          <p class="text-xs text-slate-500 mt-1">Edge promedio</p>
        </div>
        <div class="stat-card gold text-center">
          <p class="text-2xl font-bold text-amber-400">${valuePicks.length}</p>
          <p class="text-xs text-slate-500 mt-1">Partidos con valor</p>
        </div>
        <div class="stat-card blue text-center">
          <p class="text-base font-bold text-slate-300">≥ 1.2%</p>
          <p class="text-xs text-slate-500 mt-1">Umbral edge mínimo</p>
        </div>
      </div>

      <!-- Toast de confirmación -->
      <div id="bet-saved-msg"
        class="hidden bg-emerald-900/50 border border-emerald-600 rounded-xl p-3 text-center text-sm text-emerald-300 font-semibold">
        ✅ Apuesta guardada en el historial
      </div>

      <!-- ═══ MEJOR APUESTA DEL DÍA — Hero Banner ═══ -->
      ${(() => {
        // Mejor pick: max(edge × stars) a través de todos los picks con valor
        const allFlat = valuePicks.flatMap(fp =>
          fp.picks.map(p => ({ ...p, fixture: fp.fixture, refProfile: fp.refProfile }))
        );
        if (!allFlat.length) return '';
        const best = allFlat.reduce((a, b) =>
          (b.edge * (b.stars || 1)) > (a.edge * (a.stars || 1)) ? b : a
        );
        const bH = getTeam(best.fixture?.home), bA = getTeam(best.fixture?.away);
        const bEdgePct = (best.edge * 100).toFixed(1);
        const bModelPct = (best.modelProb * 100).toFixed(1);
        return `
        <div class="card overflow-hidden" style="background:linear-gradient(135deg,#0c1f38 0%,#0d1b2e 50%,#111827 100%);border-color:rgba(251,191,36,.35);">
          <div class="px-5 py-3 flex items-center gap-2 border-b" style="border-color:rgba(251,191,36,.2);background:rgba(251,191,36,.06);">
            <span class="text-lg">🏆</span>
            <span class="text-xs font-extrabold text-amber-400 uppercase tracking-widest">Mejor Apuesta del Día</span>
            <span class="ml-auto text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
              ${'⭐'.repeat(Math.min(best.stars || 1, 5))}
            </span>
          </div>
          <div class="px-5 py-4 flex flex-wrap items-center gap-4">
            <div class="text-center">
              <p class="text-3xl">${bH?.flag || '🏠'}${bA?.flag || '✈️'}</p>
              <p class="text-xs text-slate-400 mt-1 font-semibold">${bH?.name || '?'} vs ${bA?.name || '?'}</p>
            </div>
            <div class="flex-1 min-w-[200px]">
              <p class="text-sm font-extrabold text-white mb-1">📌 ${best.label}</p>
              <p class="text-xs text-slate-400 leading-relaxed">${(best.justification || '').split('.')[0]}.</p>
            </div>
            <div class="text-center shrink-0">
              <p class="text-3xl font-extrabold text-amber-400">${fmtOdds(best.odds)}</p>
              <p class="text-[10px] text-slate-500">Cuota DoradoBet</p>
            </div>
            <div class="text-center shrink-0">
              <p class="text-lg font-extrabold text-emerald-400">+${bEdgePct}%</p>
              <p class="text-[10px] text-slate-500">Edge · Modelo: ${bModelPct}%</p>
            </div>
          </div>
        </div>`;
      })()}

      ${totalPicks > 0 ? `

        <!-- Cabecera de la sección -->
        <div class="flex items-center gap-3 flex-wrap">
          <h3 class="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ⚡ ${totalPicks} Oportunidad${totalPicks !== 1 ? 'es' : ''} de Valor Detectada${totalPicks !== 1 ? 's' : ''} — IA-Zak Análisis
          </h3>
          <button onclick="runDailyPicks()" id="btn-gen-picks"
            class="ml-auto text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-all">
            🔄 Actualizar análisis
          </button>
        </div>

        <!-- ═══ Value Bet Cards ═══ -->
        <div class="space-y-4">
          ${valuePicks.map(({ fixture, picks, refProfile }) => {
            const h = getTeam(fixture.home), a = getTeam(fixture.away);
            if (!h || !a) return '';
            const ref      = refProfile || RefEngine.getForFixture(fixture.id);
            const refName  = (ref && ref.name)        ? ref.name             : 'FIFA estándar';
            const refFlag  = (ref && ref.flag)        ? ref.flag             : '🌍';
            const refYell  = (ref && ref.avg_yellows) ? ref.avg_yellows.toFixed(1)  : '—';
            const refRed   = (ref && ref.avg_reds)    ? ref.avg_reds.toFixed(3)     : '—';
            const refNotes = (ref && ref.notes)       ? ref.notes            : null;

            return `
            <div class="vbc">

              <!-- ── Match header ── -->
              <div class="vbc-header">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <span class="text-2xl">${h.flag}</span>
                  <div>
                    <p class="font-bold text-white text-sm leading-tight">${h.name} <span class="text-slate-500">vs</span> ${a.name}</p>
                    <p class="text-xs text-slate-500 mt-0.5">Grupo ${fixture.group} · ${fmtDate(fixture.date)}</p>
                  </div>
                  <span class="text-2xl">${a.flag}</span>
                </div>
                <div class="text-right shrink-0 ml-auto pl-4">
                  <p class="text-xs font-semibold text-slate-400">${refFlag} ${refName}</p>
                  <p class="text-xs text-slate-600">🟨 ${refYell}/p · 🟥 ${refRed}/p</p>
                </div>
              </div>

              <!-- ── Picks de este partido ── -->
              <div class="divide-y divide-slate-800/70">
                ${picks.map((pick, pi) => {
                  const uid       = `${fixture.id}-${pi}`;
                  const edgePct   = (pick.edge * 100).toFixed(1);
                  const modelPct  = (pick.modelProb  * 100).toFixed(1);
                  const implPct   = (pick.impliedProb * 100).toFixed(1);
                  const lvlBg     = pick.level === 'strong' ? 'bg-emerald-500' :
                                    pick.level === 'medium' ? 'bg-green-600'   : 'bg-amber-500';
                  const lvlText   = pick.level === 'strong' ? 'text-emerald-400' :
                                    pick.level === 'medium' ? 'text-green-400'   : 'text-amber-400';
                  // Encode data attrs (no newlines, no double-quotes)
                  const safeMarket = (pick.label || '').replace(/"/g, "'");
                  const safeJust   = (pick.justification || '').replace(/"/g, "'");
                  const safeMatchup = `${h.shortName} vs ${a.shortName}`;

                  return `
                  <div class="vbc-pick" id="pick-wrap-${uid}">

                    <!-- Fila principal -->
                    <div class="flex flex-wrap items-start gap-3">

                      <div class="flex-1 min-w-0">
                        <!-- Market label + edge badge + stars -->
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                          <span class="vbc-market-badge">${pick.label}</span>
                          <span class="text-xs px-2 py-0.5 rounded-full font-bold text-white ${lvlBg}">
                            +${edgePct}% edge
                          </span>
                          <span class="text-xs text-slate-600">${'⭐'.repeat(Math.min(pick.stars || 1, 5))}</span>
                        </div>
                        <!-- Probabilidades mini -->
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span class="text-slate-500">Modelo: <strong class="text-amber-400">${modelPct}%</strong></span>
                          <span class="text-slate-500">Casa impl.: <strong class="text-slate-300">${implPct}%</strong></span>
                          <span class="text-slate-500">Ventaja: <strong class="${lvlText}">+${edgePct}%</strong></span>
                        </div>
                      </div>

                      <!-- Cuota + toggle -->
                      <div class="flex items-center gap-2 shrink-0">
                        <div class="text-center">
                          <p class="text-2xl font-extrabold text-white leading-none">${fmtOdds(pick.odds)}</p>
                          <p class="text-[10px] text-slate-500 mt-0.5">Cuota DoradoBet</p>
                        </div>
                        <button onclick="toggleBetAccordion('${uid}')"
                          id="accordion-btn-${uid}" class="vbc-accordion-btn">
                          <span id="accordion-icon-${uid}">▼</span>&nbsp;Análisis IA-Zak
                        </button>
                      </div>
                    </div>

                    <!-- ─── Acordeón: Análisis IA-Zak ─── -->
                    <div id="accordion-${uid}" class="vbc-accordion hidden">

                      <!-- Mercado recomendado -->
                      <div class="flex items-start gap-3 mb-4">
                        <span class="text-2xl mt-0.5">🎯</span>
                        <div>
                          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mercado Recomendado</p>
                          <p class="text-sm font-bold text-white">${pick.label}</p>
                          <p class="text-xs text-slate-400 mt-1">
                            Cuota DoradoBet: <strong class="text-amber-400">${fmtOdds(pick.odds)}</strong>
                            &nbsp;·&nbsp; Prob. implícita: <strong class="text-white">${implPct}%</strong>
                            &nbsp;·&nbsp; Prob. modelo Poisson: <strong class="text-emerald-400">${modelPct}%</strong>
                          </p>
                        </div>
                      </div>

                      <!-- Justificación del modelo -->
                      <div class="flex items-start gap-3 mb-4">
                        <span class="text-2xl mt-0.5">🤖</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Justificación del IA-Zak Análisis</p>
                          ${(() => {
                            // Separar el texto en oraciones para renderizar como líneas visuales
                            const lines = (pick.justification || '—').split('. ').filter(l => l.trim());
                            const icons = ['🎯','📊','💡','📌'];
                            return lines.map((line, li) => `
                              <div class="flex items-start gap-2 mb-1.5 ${li === 0 ? 'pb-2 border-b border-slate-800 mb-2' : ''}">
                                <span class="text-sm shrink-0 mt-0.5">${icons[li] || '▪'}</span>
                                <p class="text-xs ${li === 0 ? 'text-white font-semibold' : 'text-slate-400'} leading-relaxed">
                                  ${line.endsWith('.') ? line : line + '.'}
                                </p>
                              </div>`).join('');
                          })()}
                        </div>
                      </div>

                      <!-- Perfil árbitro -->
                      ${ref && ref.name ? `
                      <div class="flex items-start gap-3 mb-4">
                        <span class="text-2xl mt-0.5">🧑‍⚖️</span>
                        <div>
                          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Árbitro Asignado</p>
                          <p class="text-sm font-bold text-white">${refFlag} ${refName}</p>
                          <div class="flex flex-wrap gap-4 text-xs mt-1">
                            <span class="text-slate-400">🟨 Prom.: <strong class="text-amber-400">${refYell}/partido</strong></span>
                            <span class="text-slate-400">🟥 Prom.: <strong class="text-red-400">${refRed}/partido</strong></span>
                            ${ref.strictness ? `<span class="text-slate-400">Strictness:
                              <strong class="${ref.strictness >= 1.1 ? 'text-red-400' : ref.strictness <= 0.9 ? 'text-green-400' : 'text-slate-300'}">
                                ${ref.strictness.toFixed(2)}×
                              </strong></span>` : ''}
                          </div>
                          ${refNotes ? `<p class="text-xs text-slate-500 italic mt-1.5">"${refNotes}"</p>` : ''}
                        </div>
                      </div>` : ''}

                      <!-- Barra de ventaja visual -->
                      <div class="mt-1">
                        <div class="flex justify-between text-[10px] text-slate-600 mb-1">
                          <span>Prob. implícita casa (${implPct}%)</span>
                          <span>Prob. Modelo Poisson (${modelPct}%)</span>
                        </div>
                        <div class="relative h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div class="absolute inset-y-0 left-0 bg-slate-600 rounded-full"
                            style="width:${Math.min(pick.impliedProb*100,100).toFixed(1)}%"></div>
                          <div class="absolute inset-y-0 left-0 bg-emerald-500/60 rounded-full transition-all"
                            style="width:${Math.min(pick.modelProb*100,100).toFixed(1)}%"></div>
                        </div>
                        <p class="text-xs ${lvlText} text-right mt-1 font-bold">Ventaja matemática: +${edgePct}%</p>
                      </div>
                    </div>

                    <!-- ─── ₡ Calculadora de Apuesta ─── -->
                    <div class="calc-panel">
                      <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                        ₡ Calculadora — Colones Costarricenses
                      </p>
                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">

                        <!-- Stake input -->
                        <div>
                          <label class="calc-label">Monto a apostar</label>
                          <div class="calc-input-wrap">
                            <span class="calc-currency">₡</span>
                            <input
                              type="number"
                              id="stake-${uid}"
                              class="calc-input"
                              placeholder="0"
                              value="0"
                              min="0"
                              step="500"
                              data-odds="${pick.odds}"
                              data-team="${h.name.replace(/"/g,"'")}"
                              data-flag="${h.flag}"
                              data-matchup="${safeMatchup}"
                              data-market="${safeMarket}"
                              data-justification="${safeJust}"
                              data-algo-prob="${modelPct}"
                              data-implied-prob="${implPct}"
                              data-edge="${edgePct}"
                              oninput="calcBetReturn('${uid}')"
                            />
                          </div>
                        </div>

                        <!-- Retorno total -->
                        <div class="calc-result-box">
                          <p class="calc-label">Retorno total estimado</p>
                          <p id="return-${uid}" class="calc-value text-white">₡0</p>
                        </div>

                        <!-- Ganancia neta -->
                        <div class="calc-result-box">
                          <p class="calc-label">Ganancia neta estimada</p>
                          <p id="profit-${uid}" class="calc-value text-slate-500">₡0</p>
                        </div>
                      </div>

                      <!-- Botón guardar -->
                      <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
                        <p class="text-[10px] text-slate-600">
                          Cuota ${fmtOdds(pick.odds)} · Mercado: ${pick.label}
                        </p>
                        <button onclick="savePickBet('${uid}')" class="vbc-save-btn">
                          💾 Guardar apuesta en Historial
                        </button>
                      </div>
                    </div>

                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>

      ` : `
        <div class="card p-10 text-center">
          <p class="text-5xl mb-4">🔍</p>
          <p class="font-semibold text-slate-300 text-lg">No hay value bets con edge ≥ 1.2% en este momento</p>
          <p class="text-sm text-slate-500 mt-2">El IA-Zak Análisis analiza mercados específicos (goles, córners, tarjetas, 1X2)<br>usando distribución de Poisson + perfiles de árbitros en tiempo real.</p>
          <button onclick="runDailyPicks()" id="btn-gen-picks"
            class="mt-5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            🤖 Generar Análisis PRO ahora
          </button>
        </div>
      `}

      <!-- ═══ Nota legal ═══ -->
      <div class="vbc-disclaimer">
        <span class="text-xl">⚠️</span>
        <p>
          <strong class="text-slate-300">Nota legal:</strong>
          Las cuotas de DoradoBet mostradas son <strong>simuladas con fines exclusivamente educativos</strong>.
          Una <em>apuesta de valor (value bet)</em> ocurre cuando la ventaja calculada supera la probabilidad
          implícita de la casa en <strong>al menos 1.2 puntos porcentuales</strong>.
          Las probabilidades son estimaciones estadísticas del Modelo Poisson y no garantizan resultados.
          <strong class="text-amber-400">Apuesta con responsabilidad. Si el juego se convierte en un problema, busca ayuda.</strong>
        </p>
      </div>

    </div>`;
}

// ──────────────────────────────────────────────────────────────
//  Helpers de la sección Apuestas
// ──────────────────────────────────────────────────────────────

/**
 * Toggle del acordeón de Análisis IA-Zak.
 */
function toggleBetAccordion(uid) {
  const panel = document.getElementById(`accordion-${uid}`);
  const icon  = document.getElementById(`accordion-icon-${uid}`);
  const btn   = document.getElementById(`accordion-btn-${uid}`);
  if (!panel) return;
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !opening);
  if (icon) icon.textContent = opening ? '▲' : '▼';
  if (btn)  btn.classList.toggle('active', opening);
}

/**
 * Calculadora en tiempo real.
 * Lee el stake del input, calcula retorno y ganancia en ₡.
 */
function calcBetReturn(uid) {
  const stakeEl  = document.getElementById(`stake-${uid}`);
  const returnEl = document.getElementById(`return-${uid}`);
  const profitEl = document.getElementById(`profit-${uid}`);
  if (!stakeEl || !returnEl || !profitEl) return;

  const stake  = parseFloat(stakeEl.value) || 0;
  const odds   = parseFloat(stakeEl.dataset.odds) || 1;
  const ret    = stake * odds;
  const profit = ret - stake;

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
  returnEl.textContent = fmt(ret);
  profitEl.textContent = fmt(profit);
  profitEl.className = `calc-value ${profit > 0 && stake > 0 ? 'text-emerald-400' : 'text-slate-500'}`;
}

/**
 * Guarda el pick con todos los datos extendidos (incluyendo stake y retorno en ₡).
 */
function savePickBet(uid) {
  const el = document.getElementById(`stake-${uid}`);
  if (!el) return;
  const stake  = parseFloat(el.value) || 0;
  const odds   = parseFloat(el.dataset.odds);
  const ret    = stake * odds;
  const profit = ret - stake;

  if (stake <= 0) {
    // Guardar sin monto (sólo pick)
    saveBet({
      team:          el.dataset.team,
      flag:          el.dataset.flag,
      matchup:       el.dataset.matchup,
      market:        el.dataset.market,
      justification: el.dataset.justification,
      algoProb:      parseFloat(el.dataset.algoProb),
      impliedProb:   parseFloat(el.dataset.impliedProb),
      edge:          parseFloat(el.dataset.edge),
      odds,
      stake:         0,
      totalReturn:   0,
      netProfit:     0,
    });
  } else {
    saveBet({
      team:          el.dataset.team,
      flag:          el.dataset.flag,
      matchup:       el.dataset.matchup,
      market:        el.dataset.market,
      justification: el.dataset.justification,
      algoProb:      parseFloat(el.dataset.algoProb),
      impliedProb:   parseFloat(el.dataset.impliedProb),
      edge:          parseFloat(el.dataset.edge),
      odds,
      stake,
      totalReturn:   ret,
      netProfit:     profit,
    });
  }
}

// ——— HISTORIAL ———
function renderHistory() {
  const bets  = STATE.bettingHistory;
  const won   = bets.filter(b => b.result === 'won').length;
  const lost  = bets.filter(b => b.result === 'lost').length;
  const pend  = bets.filter(b => b.result === 'pending').length;
  const settled = bets.filter(b => b.result !== 'pending').length;
  const rate  = settled > 0 ? ((won / settled) * 100).toFixed(0) : '—';

  // Métricas financieras (₡) — solo de apuestas con stake > 0
  const staked  = bets.reduce((s, b) => s + (b.stake || 0), 0);
  const wonRet  = bets.filter(b => b.result === 'won').reduce((s, b) => s + (b.totalReturn || 0), 0);
  const fmtCRC  = n => n > 0 ? '₡' + Math.round(n).toLocaleString('es-CR') : (n < 0 ? '-₡' + Math.round(Math.abs(n)).toLocaleString('es-CR') : '—');

  document.getElementById('app-content').innerHTML = `
    <div class="fade-in space-y-6">

      <!-- Cabecera -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="section-title">📋 Historial de Apuestas Simuladas</h2>
          <p class="section-subtitle">Registro detallado de oportunidades guardadas — Análisis del IA-Zak Análisis</p>
        </div>
        ${bets.length > 0 ? `
          <button onclick="if(confirm('¿Borrar todo el historial?')){STATE.bettingHistory=[];localStorage.removeItem('mundial2026_bets');renderHistory();}"
            class="text-xs text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-700 px-3 py-1.5 rounded-lg transition-all mt-1">
            🗑 Borrar todo
          </button>` : ''}
      </div>

      ${bets.length > 0 ? `

        <!-- Stats resumen -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="stat-card green text-center">
            <p class="text-2xl font-bold text-emerald-400">${won}</p>
            <p class="text-xs text-slate-500 mt-1">✅ Ganadas</p>
          </div>
          <div class="stat-card gold text-center">
            <p class="text-2xl font-bold text-red-400">${lost}</p>
            <p class="text-xs text-slate-500 mt-1">❌ Perdidas</p>
          </div>
          <div class="stat-card blue text-center">
            <p class="text-2xl font-bold text-slate-400">${pend}</p>
            <p class="text-xs text-slate-500 mt-1">⏳ Pendientes</p>
          </div>
          <div class="stat-card gold text-center">
            <p class="text-2xl font-bold text-amber-400">${rate}${rate !== '—' ? '%' : ''}</p>
            <p class="text-xs text-slate-500 mt-1">Tasa de acierto</p>
          </div>
        </div>

        <!-- Métricas financieras ₡ -->
        ${staked > 0 ? `
        <div class="card p-4">
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Resumen financiero en ₡ Colones</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div class="bg-slate-900 rounded-xl p-3">
              <p class="text-lg font-extrabold text-white">${fmtCRC(staked)}</p>
              <p class="text-xs text-slate-500 mt-0.5">Total apostado</p>
            </div>
            <div class="bg-slate-900 rounded-xl p-3">
              <p class="text-lg font-extrabold text-emerald-400">${fmtCRC(wonRet)}</p>
              <p class="text-xs text-slate-500 mt-0.5">Retorno (ganadas)</p>
            </div>
            <div class="bg-slate-900 rounded-xl p-3 col-span-2 sm:col-span-1">
              <p class="text-lg font-extrabold ${wonRet - staked >= 0 ? 'text-emerald-400' : 'text-red-400'}">${fmtCRC(wonRet - staked)}</p>
              <p class="text-xs text-slate-500 mt-0.5">Ganancia neta</p>
            </div>
          </div>
        </div>` : ''}

        <!-- Tabla de historial extendida -->
        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-800">
            <h3 class="font-bold text-white text-sm">Registro detallado</h3>
          </div>
          <!-- Cards de historial (formato expandible, más legible que tabla) -->
          <div class="divide-y divide-slate-800/50">
            ${bets.map(b => {
              const hasExt  = !!b.market;
              const hasStake = b.stake > 0;
              const fmtN = n => n ? '₡' + Math.round(n).toLocaleString('es-CR') : '—';
              const edgeTxt = b.edge ? `+${parseFloat(b.edge).toFixed(1)}%` : null;
              return `
              <div class="px-5 py-4 hover:bg-slate-900/30 transition-colors bet-history-row ${b.result}">
                <div class="flex flex-wrap items-start gap-3">

                  <!-- Flag + equipo + fecha -->
                  <div class="flex items-start gap-2 flex-1 min-w-0">
                    <span class="text-2xl mt-0.5">${b.flag}</span>
                    <div class="min-w-0">
                      <!-- Partido / equipo -->
                      <p class="text-sm font-bold text-white leading-tight">
                        ${b.matchup || b.team}
                      </p>
                      <!-- Market badge -->
                      ${hasExt ? `<span class="hist-market-tag">${b.market}</span>` : ''}
                      <!-- Fecha -->
                      <p class="text-[11px] text-slate-600 mt-0.5">${b.date}</p>
                      <!-- Justificación (colapsable) -->
                      ${hasExt && b.justification ? `
                        <p class="hist-detail mt-1 max-w-lg">
                          ${b.justification.split('. ')[0] + '.'}
                        </p>` : ''}
                    </div>
                  </div>

                  <!-- Datos financieros -->
                  <div class="text-right shrink-0 space-y-1">
                    <p class="text-base font-extrabold text-white leading-none">${fmtOdds(b.odds)}</p>
                    <p class="text-[10px] text-slate-500">cuota</p>
                    ${hasStake ? `
                      <p class="text-xs text-slate-400">${fmtN(b.stake)} <span class="text-slate-600">apostado</span></p>
                      <p class="text-xs ${b.result === 'won' ? 'hist-profit-pos' : 'hist-profit-neg'}">
                        ${b.result === 'won' ? '+ ' + fmtN(b.netProfit) + ' ganancia' : fmtN(b.totalReturn) + ' retorno proj.'}
                      </p>` : ''}
                    ${edgeTxt ? `<p class="text-[10px] text-emerald-600">Edge ${edgeTxt}</p>` : ''}
                  </div>

                  <!-- Estado + acciones -->
                  <div class="flex flex-col items-end gap-2 shrink-0">
                    ${b.result === 'won'
                      ? '<span class="tag bg-emerald-900/60 text-emerald-400 border border-emerald-700/40">✅ Ganada</span>'
                      : b.result === 'lost'
                      ? '<span class="tag bg-red-900/30 text-red-400 border border-red-800/30">❌ Perdida</span>'
                      : '<span class="tag bg-slate-800 text-slate-400">⏳ Pendiente</span>'}
                    <div class="flex gap-1">
                      ${b.result === 'pending' ? `
                        <button onclick="markBet(${b.id},'won')"
                          class="text-[11px] bg-emerald-800/60 hover:bg-emerald-700 text-emerald-300 px-2 py-1 rounded-lg transition-colors">
                          ✓ Ganada
                        </button>
                        <button onclick="markBet(${b.id},'lost')"
                          class="text-[11px] bg-red-900/40 hover:bg-red-800 text-red-400 px-2 py-1 rounded-lg transition-colors">
                          ✗ Perdida
                        </button>` : ''}
                      <button onclick="deleteBet(${b.id})"
                        class="text-[11px] text-slate-700 hover:text-red-500 transition-colors px-1.5 py-1 rounded-lg hover:bg-red-900/20"
                        title="Eliminar">🗑</button>
                    </div>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

      ` : `
        <div class="card p-12 text-center text-slate-500">
          <p class="text-5xl mb-4">📋</p>
          <p class="font-semibold text-slate-400 text-lg">Historial vacío</p>
          <p class="text-sm mt-2">Guarda oportunidades desde el <strong>Asistente de Apuestas</strong> para verlas aquí con su análisis completo.</p>
          <button onclick="switchTab('apuestas')"
            class="mt-5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Ir al Asistente de Apuestas
          </button>
        </div>
      `}
    </div>`;
}

// ——— MODAL ———
function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ——— NAVEGACIÓN ———
function renderNav() {
  const probs = calculateAllProbabilities();
  const valueBetsCount = detectValueBets(probs).filter(v => v.isValue).length;

  const badge = document.getElementById('value-bets-badge');
  if (valueBetsCount > 0) {
    badge.textContent = valueBetsCount + ' valor';
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  ['main-nav', 'mobile-nav'].forEach(navId => {
    const nav = document.getElementById(navId);
    nav.innerHTML = TABS.map(tab => `
      <button class="nav-tab ${STATE.currentTab === tab.id ? 'active' : ''}"
        onclick="switchTab('${tab.id}')">
        ${tab.label}
        ${tab.id === 'modelo' && AppState.getPicks().length > 0
          ? `<span class="ml-1 text-xs bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-bold">${AppState.getPicks().reduce((a,p)=>a+p.picks.length,0)}</span>`
          : ''}
      </button>
    `).join('');
  });
}

function switchTab(tab) {
  STATE.currentTab = tab;
  renderNav();
  const renders = {
    dashboard:  renderDashboard,
    equipos:    renderTeams,
    calendario: renderCalendar,
    zak:        renderZakAgent,
    analytics:  renderAnalytics,
  };
  if (renders[tab]) renders[tab]();
  if (tab === 'calendario') loadRealResults();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setCalendarView(v) {
  STATE.calendarView = v;
  renderCalendar();
}

// ============================================================
//  ⚡ MODELO PRO — Análisis Poisson completo
// ============================================================

function renderModeloPro() {
  const teamOptions = TEAMS.map(t =>
    `<option value="${t.shortName}">${t.flag} ${t.name}</option>`
  ).join('');

  document.getElementById('app-content').innerHTML = `
  <div class="fade-in space-y-6">

    <!-- Título -->
    <div>
      <h2 class="section-title">⚡ IA-Zak + DoradoBet</h2>
      <p class="section-subtitle">Poisson · Dixon-Coles · Árbitros dinámicos · Cuotas en vivo DoradoBet · Detector de Edge</p>
    </div>

    <!-- Desktop 2-col: config left · results right -->
    <div class="model-desktop-layout space-y-6">

    <!-- Panel de configuración (left col on desktop) -->
    <div class="card p-5 space-y-4">
      <div class="grid sm:grid-cols-2 xl:grid-cols-1 gap-4">
        <div>
          <label class="block text-xs text-slate-400 font-semibold uppercase mb-1">Equipo Local</label>
          <select id="mp-home" class="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
            ${teamOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs text-slate-400 font-semibold uppercase mb-1">Equipo Visitante</label>
          <select id="mp-away" class="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
            ${TEAMS.map((t,i) => `<option value="${t.shortName}" ${i===1?'selected':''}>${t.flag} ${t.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Árbitro dinámico (desde REFEREE_DATABASE) -->
      <div>
        <label class="block text-xs text-slate-400 font-semibold uppercase mb-1">Árbitro Asignado</label>
        <div class="flex gap-2 items-center">
          <select id="mp-referee" class="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
            <option value="default">🌍 Estándar FIFA (sin asignar)</option>
            ${RefEngine.getList().map(r => {
              const dyn = AppState.getRef(r.id);
              const wcTag = dyn && dyn.wc_matches
                ? ` · WC: ${dyn.wc_matches} partidos`
                : '';
              return `<option value="${r.id}">${r.flag} ${r.name} — 🟨 ${r.avg_yellows} 🟥 ${r.avg_reds}${wcTag}</option>`;
            }).join('')}
          </select>
          <button id="mp-ref-info-btn" onclick="showRefereeInfo()"
            class="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-xl transition-colors">
            ℹ️ Info
          </button>
        </div>
        <div id="mp-ref-stats" class="hidden mt-2 text-xs text-slate-400 bg-slate-900 rounded-xl px-4 py-3 border border-slate-700"></div>
      </div>

      <!-- Botones de acción -->
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-analyze" onclick="runModelAnalysis()">⚡ Analizar Partido</button>
        <button id="btn-fetch-odds" class="btn-analyze" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6)"
          onclick="fetchDoradoBetOdds()">
          🎰 Obtener Cuotas DoradoBet
        </button>
      </div>
      <p id="mp-odds-status" class="text-xs text-center text-slate-500 hidden"></p>
    </div>

    <!-- Resultados (right col on desktop) -->
    <div id="mp-results" style="display:none"></div>

    </div><!-- end model-desktop-layout -->

  </div>`;
}

function setModelRef(ref) {
  STATE.modelRefType = ref;
  document.querySelectorAll('.ref-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ref === ref);
  });
}

/** Muestra el panel de info del árbitro seleccionado. */
function showRefereeInfo() {
  const sel   = document.getElementById('mp-referee');
  const panel = document.getElementById('mp-ref-stats');
  if (!sel || !panel) return;
  const refId  = sel.value;
  const profile = RefEngine.getProfile(refId);
  const dyn    = AppState.getRef(refId);

  panel.classList.toggle('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xl">${profile.flag || '🌍'}</span>
      <strong class="text-white text-sm">${profile.name}</strong>
      <span class="text-slate-500">${profile.country || ''}</span>
    </div>
    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="bg-slate-800 rounded-lg p-2">
        <div class="text-amber-400 font-bold">${profile.avg_yellows.toFixed(2)}</div>
        <div class="text-slate-500 text-xs">🟨/partido</div>
      </div>
      <div class="bg-slate-800 rounded-lg p-2">
        <div class="text-red-400 font-bold">${profile.avg_reds.toFixed(3)}</div>
        <div class="text-slate-500 text-xs">🟥/partido</div>
      </div>
      <div class="bg-slate-800 rounded-lg p-2">
        <div class="text-purple-400 font-bold">${profile.strictness.toFixed(2)}</div>
        <div class="text-slate-500 text-xs">Strictness</div>
      </div>
    </div>
    ${dyn && dyn.wc_matches ? `
      <div class="mt-2 pt-2 border-t border-slate-700 text-xs text-emerald-400">
        📊 Mundial 2026: ${dyn.wc_matches} partidos arbitrados · 🟨 ${dyn.wc_yellows} · 🟥 ${dyn.wc_reds}
        <span class="text-slate-400">(promedio recalculado dinámicamente)</span>
      </div>` : ''}
    ${profile.notes ? `<p class="mt-2 text-slate-500 italic">"${profile.notes}"</p>` : ''}`;
}

/** Obtiene cuotas de DoradoBet para el partido actual y repoblación la pestaña Valor. */
async function fetchDoradoBetOdds() {
  const homeKey = document.getElementById('mp-home')?.value;
  const awayKey = document.getElementById('mp-away')?.value;
  const refId   = document.getElementById('mp-referee')?.value || 'default';
  if (!homeKey || !awayKey || homeKey === awayKey) {
    alert('Selecciona dos equipos diferentes.'); return;
  }

  const btn    = document.getElementById('btn-fetch-odds');
  const status = document.getElementById('mp-odds-status');
  btn.textContent = '⏳ Consultando DoradoBet…'; btn.disabled = true;
  if (status) { status.textContent = 'Conectando con DoradoBet…'; status.classList.remove('hidden'); }

  try {
    const refProfile = RefEngine.getProfile(refId);
    const result = await OddsEngine.getOdds(homeKey, awayKey, refProfile);

    // Si ya hay resultados de análisis, actualizar la pestaña Valor con los edges
    if (STATE.modelAnalysis) {
      _populateValorWithOdds(result.odds, result.markets);
      if (status) {
        const count = result.markets.filter(m => m.level !== 'none').length;
        status.textContent = `✅ Cuotas actualizadas · ${count} mercados con edge detectado`;
        status.className = 'text-xs text-center text-emerald-400';
      }
    } else {
      // Si no hay análisis, lanzar uno completo con las cuotas ya cargadas
      STATE.modelOddsData = result;
      await runModelAnalysis();
      if (status) status.textContent = '✅ Análisis + cuotas DoradoBet completados';
    }
  } catch(e) {
    if (status) { status.textContent = `❌ Error: ${e.message}`; status.className = 'text-xs text-center text-red-400'; }
    console.error('[fetchDoradoBetOdds]', e);
  } finally {
    btn.textContent = '🎰 Obtener Cuotas DoradoBet'; btn.disabled = false;
    if (status) status.classList.remove('hidden');
  }
}

/**
 * Rellena automáticamente los inputs del Valor tab con las cuotas de DoradoBet
 * y muestra los badges de edge sin que el usuario tenga que escribir nada.
 */
function _populateValorWithOdds(odds, markets) {
  // Mapa de market id → input id + badge id
  const MAP = {
    over25:      'vd-ou25-over',    under25:     'vd-ou25-under',
    c_over85:    'vd-c85',          c_over95:    'vd-c95',
    c_over105:   'vd-c105',         c_over115:   'vd-c115',         c_over125:   'vd-c125',
    pts_over255: 'vd-pts255',       pts_over355: 'vd-pts355',
    pts_over455: 'vd-pts455',       pts_over555: 'vd-pts555',
    home:        'vd-1x2h',         draw:        'vd-1x2d',         away:        'vd-1x2a',
  };
  const oddsByKey = {
    over25: odds.over25, under25: odds.under25,
    c_over85: odds.c_over85, c_over95: odds.c_over95,
    c_over105: odds.c_over105, c_over115: odds.c_over115, c_over125: odds.c_over125,
    pts_over255: odds.pts_over255, pts_over355: odds.pts_over355,
    pts_over455: odds.pts_over455, pts_over555: odds.pts_over555,
    home: odds.home, draw: odds.draw, away: odds.away,
  };

  Object.entries(MAP).forEach(([marketId, inputBase]) => {
    const input  = document.getElementById(inputBase + '-odds');
    const badge  = document.getElementById(inputBase + '-badge');
    const market = markets.find(m => m.id === marketId);
    if (!input || !market) return;

    input.value = oddsByKey[marketId] || '';
    if (badge) {
      badge.textContent = market.edgeLabel || '—';
      badge.className   = 'vd-badge ' + (
        market.level === 'strong' ? 'value' :
        market.level === 'medium' ? 'value' :
        market.level === 'slight' ? 'neutral' :
        market.level === 'trap'   ? 'negative' : ''
      );
    }
  });

  // Cambiar al tab Valor automáticamente si hay edges fuertes
  const hasValue = markets.some(m => ['strong','medium'].includes(m.level));
  if (hasValue) switchModelTab('valor');
}

function runModelAnalysis() {
  const homeKey = document.getElementById('mp-home').value;
  const awayKey = document.getElementById('mp-away').value;
  const refId   = document.getElementById('mp-referee')?.value || 'default';
  if (homeKey === awayKey) {
    alert('Selecciona dos equipos diferentes.'); return;
  }

  const btn = document.getElementById('btn-analyze') || document.querySelector('.btn-analyze');
  if (btn) { btn.textContent = '⏳ Calculando…'; btn.disabled = true; }

  setTimeout(() => {
    try {
      // Obtener perfil dinámico del árbitro
      const refProfile = RefEngine.getProfile(refId);
      // Correr modelo con el perfil real (objeto, no string)
      STATE.modelAnalysis = mmAnalyzeMatch(homeKey, awayKey, refProfile);
      STATE.modelAnalysis._refProfile = refProfile;   // guardar para mostrar
      STATE.modelTab = 'goles';
      displayModelResults(STATE.modelAnalysis);

      // Si hay cuotas en caché para este partido, auto-poblar la pestaña Valor
      const cached = AppState.getOdds(`${homeKey}-${awayKey}`);
      if (cached && cached.markets) {
        setTimeout(() => _populateValorWithOdds(cached.odds, cached.markets), 100);
      }
    } catch(e) {
      console.error(e);
      document.getElementById('mp-results').innerHTML =
        `<div class="card p-4 text-red-400 text-sm">❌ Error en el modelo: ${e.message}</div>`;
      document.getElementById('mp-results').style.display = 'block';
    }
    if (btn) { btn.textContent = '⚡ Analizar Partido'; btn.disabled = false; }
  }, 50);
}

function displayModelResults(raw) {
  // ── Normalize model output (snake_case → camelCase aliases) ──
  const homeTeam = raw.meta.home;
  const awayTeam = raw.meta.away;

  // Usar el perfil real de árbitro si está disponible
  const refProfile = raw._refProfile;
  const refLabel = refProfile
    ? `${refProfile.flag || ''} ${refProfile.label || refProfile.name}`.trim()
    : ({ default:'Normal ⚖️', strict:'Estricto 🟥', lenient:'Permisivo 🟡' }[raw.meta.refType] || raw.meta.refType);

  // Aliases para templates
  const lH = raw.lambdas.home;
  const lA = raw.lambdas.away;
  const r1x2 = raw.result_1x2;
  const dc   = raw.double_chance;
  const ou   = raw.over_under;
  const btts = raw.btts;
  const tg   = raw.team_goals;
  const gr   = raw.goal_range;
  const es   = raw.exact_scores;          // array: { label, prob }
  const cn   = raw.corners;               // corners sub-object
  const cd   = raw.cards;
  const cb   = raw.combos;

  // Build pLines array from points_system object
  const pLines = Object.entries(cd.points_system).map(([line, v]) => ({ line, over: v.over, under: v.under }))
    .sort((a, b) => parseFloat(a.line) - parseFloat(b.line));

  // Marcadores exactos top-8
  const topScores = es.slice(0, 8);
  const maxScoreProb = topScores[0] ? topScores[0].prob : 1;

  // Helper: render a market row with bar
  const mpRow = (label, prob, sub='', colorClass='') => `
    <div class="mp-row">
      <span class="mp-label">${label}</span>
      <div class="mp-bar-wrap">
        <div class="mp-bar ${colorClass}" style="width:${Math.min(prob*100,100).toFixed(1)}%"></div>
      </div>
      <span class="mp-pct">${mmPct(prob)}</span>
      ${sub ? `<span class="mp-sub">${sub}</span>` : ''}
    </div>`;

  // Shorthand aliases used in HTML
  const a = {
    lambdaHome: lH,
    lambdaAway: lA,
    result1X2:  r1x2,
    doubleChance: dc,
    overUnder:  ou,
    btts,
    teamGoals: { home: { '0.5': tg.home.ou_0_5, '1.5': tg.home.ou_1_5, '2.5': tg.home.ou_2_5 },
                  away: { '0.5': tg.away.ou_0_5, '1.5': tg.away.ou_1_5, '2.5': tg.away.ou_2_5 } },
    goalRange:  gr,
    exactScores: es.map(s => ({ score: s.label, prob: s.prob })),
    corners: {
      ou:        cn.total_ou,
      result1X2: cn.corners_1x2,
      teamOU:    { home: { '4.5': cn.home_team.ou_4_5, '5.5': cn.home_team.ou_5_5 },
                   away: { '4.5': cn.away_team.ou_4_5, '5.5': cn.away_team.ou_5_5 } },
      oddEven:   cn.odd_even,
      firstHalf: { over45: cn.first_half['4.5'].over, under45: cn.first_half['4.5'].under },
    },
    cards: {
      yellowOU:  { '3.5': cd.yellow_ou.ou_3_5, '4.5': cd.yellow_ou.ou_4_5, '5.5': cd.yellow_ou.ou_5_5 },
      redProb:   cd.any_red,
      meanPts:   cd.expected_points,
      pointLines: pLines,
    },
    combos: {
      '1X2+BTTS':    { homeWinYes: cb.h_and_btts, drawYes: cb.d_and_btts, awayWinYes: cb.a_and_btts },
      '1X2+OU25':    { homeOver: cb.h_and_over25, homeUnder: cb.h_and_under25, drawOver: cb.d_and_over25, drawUnder: cb.d_and_under25, awayOver: cb.a_and_over25, awayUnder: cb.a_and_under25 },
      '1X2+Corners': { homeOver: cb.h_and_corners95, drawOver: cb.d_and_corners95, awayOver: cb.a_and_corners95 },
    },
  };

  const html = `
  <div class="card p-0 overflow-hidden">

    <!-- Match header -->
    <div class="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-3xl">${homeTeam.flag}</span>
          <div>
            <div class="text-sm font-bold text-white">${homeTeam.name}</div>
            <div class="text-xs text-slate-400">Local</div>
          </div>
        </div>
        <div class="text-center">
          <div class="text-xl font-extrabold text-amber-400">VS</div>
          <div class="text-xs text-slate-500 mt-0.5">Árbitro: ${refLabel}</div>
        </div>
        <div class="flex items-center gap-3 text-right">
          <div>
            <div class="text-sm font-bold text-white">${awayTeam.name}</div>
            <div class="text-xs text-slate-400">Visitante</div>
          </div>
          <span class="text-3xl">${awayTeam.flag}</span>
        </div>
      </div>
      <!-- Lambda cards -->
      <div class="grid grid-cols-3 gap-3 mt-4">
        <div class="lambda-card">
          <div class="lc-val">${a.lambdaHome.toFixed(2)}</div>
          <div class="lc-lbl">λ Local (xG)</div>
        </div>
        <div class="lambda-card" style="border-color:#f59e0b22">
          <div class="lc-val text-amber-400">${(a.lambdaHome + a.lambdaAway).toFixed(2)}</div>
          <div class="lc-lbl">λ Total</div>
        </div>
        <div class="lambda-card">
          <div class="lc-val">${a.lambdaAway.toFixed(2)}</div>
          <div class="lc-lbl">λ Visit. (xG)</div>
        </div>
      </div>
    </div>

    <!-- Inner tabs -->
    <div class="inner-tabs px-4 pt-3">
      <button class="inner-tab ${STATE.modelTab==='goles'?'active':''}"    onclick="switchModelTab('goles')">⚽ Goles</button>
      <button class="inner-tab ${STATE.modelTab==='corners'?'active':''}"  onclick="switchModelTab('corners')">🚩 Córners</button>
      <button class="inner-tab ${STATE.modelTab==='tarjetas'?'active':''}" onclick="switchModelTab('tarjetas')">🟨 Tarjetas</button>
      <button class="inner-tab ${STATE.modelTab==='combos'?'active':''}"   onclick="switchModelTab('combos')">🔀 Combos</button>
      <button class="inner-tab ${STATE.modelTab==='valor'?'active':''}"    onclick="switchModelTab('valor')">💎 Valor</button>
    </div>

    <div class="px-4 py-4">

    <!-- ─── GOLES ─── -->
    <div class="mp-panel" id="mpp-goles" style="${STATE.modelTab==='goles'?'':'display:none'}">

      <div class="mp-group">
        <div class="mp-group-title">Resultado Final (1X2)</div>
        <div class="model-1x2-grid">
          <div class="m1x2-cell home">
            <div class="m1x2-label">1 Local</div>
            <div class="m1x2-pct">${mmPct(a.result1X2.home)}</div>
            <div class="m1x2-bar-wrap"><div class="m1x2-bar" style="width:${(a.result1X2.home*100).toFixed(0)}%"></div></div>
          </div>
          <div class="m1x2-cell draw">
            <div class="m1x2-label">X Empate</div>
            <div class="m1x2-pct">${mmPct(a.result1X2.draw)}</div>
            <div class="m1x2-bar-wrap"><div class="m1x2-bar draw" style="width:${(a.result1X2.draw*100).toFixed(0)}%"></div></div>
          </div>
          <div class="m1x2-cell away">
            <div class="m1x2-label">2 Visit.</div>
            <div class="m1x2-pct">${mmPct(a.result1X2.away)}</div>
            <div class="m1x2-bar-wrap"><div class="m1x2-bar away" style="width:${(a.result1X2.away*100).toFixed(0)}%"></div></div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2">
          <div class="text-center text-xs text-slate-500">DC: ${mmPct(a.doubleChance.h1X)}</div>
          <div class="text-center text-xs text-slate-500">DC: ${mmPct(a.doubleChance.hX2)}</div>
          <div class="text-center text-xs text-slate-500">DC: ${mmPct(a.doubleChance.h12)}</div>
        </div>
      </div>

      <div class="mp-group">
        <div class="mp-group-title">Over / Under Goles</div>
        ${mpRow('Over 1.5', a.overUnder['1.5'].over,  '', 'bar-green')}
        ${mpRow('Under 1.5', a.overUnder['1.5'].under, '')}
        ${mpRow('Over 2.5', a.overUnder['2.5'].over,  '', 'bar-green')}
        ${mpRow('Under 2.5', a.overUnder['2.5'].under, '')}
        ${mpRow('Over 3.5', a.overUnder['3.5'].over,  '', 'bar-green')}
        ${mpRow('Under 3.5', a.overUnder['3.5'].under, '')}
        ${mpRow('Over 4.5', a.overUnder['4.5'].over,  '', 'bar-green')}
        ${mpRow('Under 4.5', a.overUnder['4.5'].under, '')}
      </div>

      <div class="mp-group">
        <div class="mp-group-title">BTTS — Ambos Anotan</div>
        ${mpRow('Sí, ambos anotan', a.btts.yes, '', 'bar-amber')}
        ${mpRow('No (al menos uno no anota)', a.btts.no, '')}
      </div>

      <div class="mp-group">
        <div class="mp-group-title">Rango de Goles Totales</div>
        ${mpRow('0 – 1 goles', a.goalRange['0-1'])}
        ${mpRow('2 – 3 goles', a.goalRange['2-3'], '', 'bar-amber')}
        ${mpRow('4 – 6 goles', a.goalRange['4-6'])}
        ${mpRow('7 + goles', a.goalRange['7+'])}
      </div>

      <div class="mp-group">
        <div class="mp-group-title">Goles por Equipo</div>
        ${mpRow(`${homeTeam.shortName} Over 0.5`, a.teamGoals.home['0.5'].over, '', 'bar-green')}
        ${mpRow(`${homeTeam.shortName} Over 1.5`, a.teamGoals.home['1.5'].over, '', 'bar-green')}
        ${mpRow(`${homeTeam.shortName} Over 2.5`, a.teamGoals.home['2.5'].over, '', 'bar-green')}
        ${mpRow(`${awayTeam.shortName} Over 0.5`, a.teamGoals.away['0.5'].over, '', 'bar-blue')}
        ${mpRow(`${awayTeam.shortName} Over 1.5`, a.teamGoals.away['1.5'].over, '', 'bar-blue')}
        ${mpRow(`${awayTeam.shortName} Over 2.5`, a.teamGoals.away['2.5'].over, '', 'bar-blue')}
      </div>

      <div class="mp-group">
        <div class="mp-group-title">Top Marcadores Exactos</div>
        <div class="exact-scores-grid">
          ${topScores.map((s, i) => `
            <div class="es-cell ${i===0?'es-top':''}" style="--bar-w:${(s.prob/maxScoreProb*100).toFixed(0)}%">
              <div class="es-score">${s.label || s.score || '?'}</div>
              <div class="es-bar-wrap"><div class="es-bar"></div></div>
              <div class="es-pct">${mmPct(s.prob)}</div>
            </div>`).join('')}
        </div>
      </div>

      ${raw.first_goal ? `
      <div class="mp-group">
        <div class="mp-group-title">⚡ Primer Equipo en Marcar — Poisson</div>
        <div class="text-xs text-slate-500 mb-2">
          Fórmula: P(local primero) = λH/(λH+λA) × (1 − e<sup>−λT</sup>)
          · λH=${lH.toFixed(2)}, λA=${lA.toFixed(2)}
        </div>
        <div class="model-1x2-grid">
          <div class="m1x2-cell home">
            <div class="m1x2-label">${homeTeam.flag} Local</div>
            <div class="m1x2-pct">${mmPct(raw.first_goal.home)}</div>
            <div class="m1x2-bar-wrap"><div class="m1x2-bar" style="width:${(raw.first_goal.home*100).toFixed(0)}%"></div></div>
          </div>
          <div class="m1x2-cell draw">
            <div class="m1x2-label">Sin Goles</div>
            <div class="m1x2-pct">${mmPct(raw.first_goal.none)}</div>
            <div class="m1x2-bar-wrap"><div class="m1x2-bar draw" style="width:${(raw.first_goal.none*100).toFixed(0)}%"></div></div>
          </div>
          <div class="m1x2-cell away">
            <div class="m1x2-label">${awayTeam.flag} Visit.</div>
            <div class="m1x2-pct">${mmPct(raw.first_goal.away)}</div>
            <div class="m1x2-bar-wrap"><div class="m1x2-bar away" style="width:${(raw.first_goal.away*100).toFixed(0)}%"></div></div>
          </div>
        </div>
        <p class="text-[10px] text-slate-600 mt-2 text-center">
          P(sin goles) = e<sup>−λH</sup> × e<sup>−λA</sup> = ${mmPct(raw.first_goal.none)}
        </p>
      </div>` : ''}
    </div>

    <!-- ─── CÓRNERS ─── -->
    <div class="mp-panel" id="mpp-corners" style="${STATE.modelTab==='corners'?'':'display:none'}">
      <div class="mp-group">
        <div class="mp-group-title">Over / Under Córners Totales</div>
        ${mpRow('Over 8.5', a.corners.ou['8.5'].over, '', 'bar-green')}
        ${mpRow('Over 9.5', a.corners.ou['9.5'].over, '', 'bar-green')}
        ${mpRow('Over 10.5', a.corners.ou['10.5'].over, '', 'bar-amber')}
        ${mpRow('Over 11.5', a.corners.ou['11.5'].over, '', 'bar-green')}
        ${mpRow('Over 12.5', a.corners.ou['12.5'].over, '')}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">Resultado 1X2 en Córners</div>
        ${mpRow(`${homeTeam.shortName} más córners`, a.corners.result1X2.home, '', 'bar-green')}
        ${mpRow('Empate en córners', a.corners.result1X2.draw)}
        ${mpRow(`${awayTeam.shortName} más córners`, a.corners.result1X2.away, '', 'bar-blue')}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">Córners por Equipo</div>
        ${mpRow(`${homeTeam.shortName} Over 4.5`, a.corners.teamOU.home['4.5'].over, '', 'bar-green')}
        ${mpRow(`${homeTeam.shortName} Over 5.5`, a.corners.teamOU.home['5.5'].over, '', 'bar-green')}
        ${mpRow(`${awayTeam.shortName} Over 4.5`, a.corners.teamOU.away['4.5'].over, '', 'bar-blue')}
        ${mpRow(`${awayTeam.shortName} Over 5.5`, a.corners.teamOU.away['5.5'].over, '', 'bar-blue')}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">Paridad de Córners</div>
        ${mpRow('Córners totales PAR', a.corners.oddEven.even, '', 'bar-amber')}
        ${mpRow('Córners totales IMPAR', a.corners.oddEven.odd)}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">Primer Tiempo</div>
        ${mpRow('Over 4.5 Córners 1ª Parte', a.corners.firstHalf.over45, '', 'bar-green')}
        ${mpRow('Under 4.5 Córners 1ª Parte', a.corners.firstHalf.under45)}
      </div>
    </div>

    <!-- ─── TARJETAS ─── -->
    <div class="mp-panel" id="mpp-tarjetas" style="${STATE.modelTab==='tarjetas'?'':'display:none'}">
      <div class="mp-group">
        <div class="mp-group-title">Tarjetas Amarillas Totales</div>
        ${mpRow('Over 3.5 amarillas', a.cards.yellowOU['3.5'].over, '', 'bar-amber')}
        ${mpRow('Over 4.5 amarillas', a.cards.yellowOU['4.5'].over, '', 'bar-amber')}
        ${mpRow('Over 5.5 amarillas', a.cards.yellowOU['5.5'].over, '', 'bar-amber')}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">Tarjetas Rojas</div>
        ${mpRow('Al menos 1 roja en el partido', a.cards.redProb, '', 'bar-red')}
        ${mpRow('Ninguna roja', 1 - a.cards.redProb)}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">Sistema de Puntos DoradoBet (🟡=10 · 🟥=25)</div>
        <div class="mb-2 text-xs text-slate-500">Media: <span class="pts-badge">${a.cards.meanPts.toFixed(1)} pts</span></div>
        ${pLines.map(pl => `
          <div class="mp-row">
            <span class="mp-label">Over ${pl.line}</span>
            <div class="mp-bar-wrap">
              <div class="mp-bar bar-amber" style="width:${(pl.over*100).toFixed(1)}%"></div>
            </div>
            <span class="mp-pct">${mmPct(pl.over)}</span>
            <span class="mp-sub">under ${mmPct(pl.under)}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- ─── COMBOS ─── -->
    <div class="mp-panel" id="mpp-combos" style="${STATE.modelTab==='combos'?'':'display:none'}">
      <div class="mp-group">
        <div class="mp-group-title">1X2 + BTTS</div>
        ${mpRow(`${homeTeam.shortName} gana + Ambos anotan`, a.combos['1X2+BTTS'].homeWinYes, '', 'bar-green')}
        ${mpRow(`Empate + Ambos anotan`, a.combos['1X2+BTTS'].drawYes)}
        ${mpRow(`${awayTeam.shortName} gana + Ambos anotan`, a.combos['1X2+BTTS'].awayWinYes, '', 'bar-blue')}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">1X2 + Over/Under 2.5 Goles</div>
        ${mpRow(`${homeTeam.shortName} gana + Over 2.5`, a.combos['1X2+OU25'].homeOver, '', 'bar-green')}
        ${mpRow(`${homeTeam.shortName} gana + Under 2.5`, a.combos['1X2+OU25'].homeUnder)}
        ${mpRow(`Empate + Over 2.5`, a.combos['1X2+OU25'].drawOver)}
        ${mpRow(`Empate + Under 2.5`, a.combos['1X2+OU25'].drawUnder)}
        ${mpRow(`${awayTeam.shortName} gana + Over 2.5`, a.combos['1X2+OU25'].awayOver, '', 'bar-blue')}
        ${mpRow(`${awayTeam.shortName} gana + Under 2.5`, a.combos['1X2+OU25'].awayUnder)}
      </div>
      <div class="mp-group">
        <div class="mp-group-title">1X2 + Over 9.5 Córners</div>
        ${mpRow(`${homeTeam.shortName} gana + Over 9.5 córners`, a.combos['1X2+Corners'].homeOver, '', 'bar-green')}
        ${mpRow(`Empate + Over 9.5 córners`, a.combos['1X2+Corners'].drawOver)}
        ${mpRow(`${awayTeam.shortName} gana + Over 9.5 córners`, a.combos['1X2+Corners'].awayOver, '', 'bar-blue')}
      </div>
    </div>

    <!-- ─── VALOR ─── -->
    <div class="mp-panel" id="mpp-valor" style="${STATE.modelTab==='valor'?'':'display:none'}">
      <p class="text-xs text-slate-400 mb-4">
        Ingresa las cuotas de la casa de apuestas. El detector calcula el
        <strong>Edge = Prob. Modelo − Prob. Implícita</strong>.
        Edge ≥ 3% se resalta como <span class="text-emerald-400 font-bold">VALUE BET</span>.
      </p>

      <!-- Over/Under 2.5 goles -->
      <div class="mp-group">
        <div class="mp-group-title">⚽ Goles O/U 2.5</div>
        <div class="vd-table">
          <div class="vd-row">
            <span class="vd-label">Over 2.5 — Modelo: <strong>${mmPct(a.overUnder['2.5'].over)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-ou25-over-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-ou25-over', ${a.overUnder['2.5'].over}, this.value)" />
            <span id="vd-ou25-over-badge" class="vd-badge">—</span>
          </div>
          <div class="vd-row">
            <span class="vd-label">Under 2.5 — Modelo: <strong>${mmPct(a.overUnder['2.5'].under)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-ou25-under-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-ou25-under', ${a.overUnder['2.5'].under}, this.value)" />
            <span id="vd-ou25-under-badge" class="vd-badge">—</span>
          </div>
        </div>
      </div>

      <!-- Córners O/U -->
      <div class="mp-group">
        <div class="mp-group-title">🚩 Córners Totales O/U</div>
        <div class="vd-table">
          ${['8.5','9.5','10.5','11.5','12.5'].map(line => `
          <div class="vd-row">
            <span class="vd-label">Over ${line} — Modelo: <strong>${mmPct(a.corners.ou[line].over)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-c${line.replace('.','')}-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-c${line.replace('.','')}'  , ${a.corners.ou[line].over}, this.value)" />
            <span id="vd-c${line.replace('.','')}-badge" class="vd-badge">—</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- Puntos Tarjetas -->
      <div class="mp-group">
        <div class="mp-group-title">🟨 Puntos Tarjetas O/U (🟡×10 + 🟥×25)</div>
        <div class="vd-table">
          ${pLines.map(pl => `
          <div class="vd-row">
            <span class="vd-label">Over ${pl.line} pts — Modelo: <strong>${mmPct(pl.over)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-pts${pl.line.replace('.','')}-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-pts${pl.line.replace('.','')}'  , ${pl.over}, this.value)" />
            <span id="vd-pts${pl.line.replace('.','')}-badge" class="vd-badge">—</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- 1X2 -->
      <div class="mp-group">
        <div class="mp-group-title">🏆 Resultado Final 1X2</div>
        <div class="vd-table">
          <div class="vd-row">
            <span class="vd-label">${homeTeam.shortName} gana — Modelo: <strong>${mmPct(a.result1X2.home)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-1x2h-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-1x2h', ${a.result1X2.home}, this.value)" />
            <span id="vd-1x2h-badge" class="vd-badge">—</span>
          </div>
          <div class="vd-row">
            <span class="vd-label">Empate — Modelo: <strong>${mmPct(a.result1X2.draw)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-1x2d-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-1x2d', ${a.result1X2.draw}, this.value)" />
            <span id="vd-1x2d-badge" class="vd-badge">—</span>
          </div>
          <div class="vd-row">
            <span class="vd-label">${awayTeam.shortName} gana — Modelo: <strong>${mmPct(a.result1X2.away)}</strong></span>
            <input type="number" class="vd-odds-input" id="vd-1x2a-odds" placeholder="Cuota" min="1.01" step="0.01"
              oninput="updateValueEdge('vd-1x2a', ${a.result1X2.away}, this.value)" />
            <span id="vd-1x2a-badge" class="vd-badge">—</span>
          </div>
        </div>
      </div>
    </div>

    </div><!-- /px-4 py-4 -->
  </div>`;

  const resultsEl = document.getElementById('mp-results');
  resultsEl.innerHTML = html;
  resultsEl.style.display = 'block';
}

function switchModelTab(tab) {
  STATE.modelTab = tab;
  // Update tab buttons
  document.querySelectorAll('.inner-tab').forEach(b => {
    const map = { goles:'goles', corners:'corners', tarjetas:'tarjetas', combos:'combos', valor:'valor' };
    b.classList.toggle('active', b.textContent.toLowerCase().includes(
      { goles:'goles', corners:'córners', tarjetas:'tarjetas', combos:'combos', valor:'valor' }[tab] || tab
    ));
  });
  // Show/hide panels
  ['goles','corners','tarjetas','combos','valor'].forEach(p => {
    const el = document.getElementById(`mpp-${p}`);
    if (el) el.style.display = p === tab ? 'block' : 'none';
  });
  // Refresh tab active state by label
  document.querySelectorAll('.inner-tab').forEach((btn, idx) => {
    const tabIds = ['goles','corners','tarjetas','combos','valor'];
    btn.classList.toggle('active', tabIds[idx] === tab);
  });
}

function updateValueEdge(marketId, modelProb, oddsStr) {
  const badgeEl = document.getElementById(marketId + '-badge');
  if (!badgeEl) return;
  const odds = parseFloat(oddsStr);
  if (!odds || odds < 1.01) { badgeEl.textContent = '—'; badgeEl.className = 'vd-badge'; return; }
  const impliedProb = 1 / odds;
  const edge = modelProb - impliedProb;
  const edgePct = (edge * 100).toFixed(1);
  if (edge >= 0.03) {
    badgeEl.textContent = `✅ VALUE +${edgePct}%`;
    badgeEl.className = 'vd-badge value';
  } else if (edge >= 0) {
    badgeEl.textContent = `+${edgePct}%`;
    badgeEl.className = 'vd-badge neutral';
  } else {
    badgeEl.textContent = `${edgePct}%`;
    badgeEl.className = 'vd-badge negative';
  }
}

// ============================================================
//  PICKS ENGINE — UI / Sección de Recomendaciones del IA-Zak Análisis
// ============================================================

/**
 * Genera el HTML de la sección "Recomendaciones del IA-Zak Análisis"
 * para el dashboard. Lee desde AppState.getPicks().
 */
function _renderPicksSectionHTML() {
  const dailyPicks = AppState.getPicks();

  return `
  <div class="card p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider">
        🤖 Recomendaciones del IA-Zak Análisis
      </h3>
      <div class="flex items-center gap-2">
        <span id="picks-status-badge" class="text-xs text-slate-500"></span>
        <button onclick="runDailyPicks()" id="btn-gen-picks"
          class="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg transition-colors">
          🔄 Generar picks
        </button>
      </div>
    </div>

    ${!dailyPicks || dailyPicks.length === 0 ? `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-3">🤖</div>
        <p class="text-sm font-semibold text-slate-400">Picks no generados aún</p>
        <p class="text-xs mt-1">Pulsa "Generar picks" para analizar los próximos partidos</p>
      </div>` :
      dailyPicks.map(({ fixture, picks, refProfile }) => {
        const h = getTeam(fixture.home), a = getTeam(fixture.away);
        if (!h || !a || !picks.length) return '';
        const ref = refProfile || RefEngine.getForFixture(fixture.id);
        return `
        <div class="mb-5 last:mb-0">
          <!-- Cabecera del partido -->
          <div class="flex items-center gap-3 mb-2 pb-2 border-b border-slate-800">
            <span class="text-xl">${h.flag}</span>
            <span class="text-sm font-bold text-slate-200">${h.shortName}</span>
            <span class="text-xs text-slate-500">vs</span>
            <span class="text-sm font-bold text-slate-200">${a.shortName}</span>
            <span class="text-xl">${a.flag}</span>
            <span class="ml-auto text-xs text-slate-600">Grupo ${fixture.group} · ${fmtDate(fixture.date)}</span>
            ${ref && ref.id !== 'default' ? `<span class="text-xs text-slate-500">${ref.flag||''}${ref.label}</span>` : ''}
          </div>
          <!-- Picks de este partido -->
          <div class="space-y-2">
            ${picks.map(pick => _renderPickCard(pick)).join('')}
          </div>
        </div>`;
      }).join('')
    }
  </div>`;
}

/**
 * Renderiza una tarjeta de pick individual.
 */
function _renderPickCard(pick) {
  const edgePct  = (pick.edge * 100).toFixed(1);
  const probPct  = (pick.modelProb * 100).toFixed(1);
  const stars    = '⭐'.repeat(pick.stars || 1);
  const lvlClass = pick.level === 'strong' ? 'border-emerald-500/30 bg-emerald-900/10' :
                   pick.level === 'medium' ? 'border-green-600/30 bg-green-900/10' :
                   pick.level === 'slight' ? 'border-amber-500/30 bg-amber-900/10' : 'border-slate-700';
  const badgeCls = pick.level === 'strong' ? 'bg-emerald-500 text-white' :
                   pick.level === 'medium' ? 'bg-green-600 text-white' :
                   pick.level === 'slight' ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400';

  return `
  <div class="rounded-xl border ${lvlClass} p-3 transition-all">
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-bold text-white">${pick.label}</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-bold ${badgeCls}">
            +${edgePct}% edge
          </span>
          <span class="text-xs text-slate-500">${stars}</span>
        </div>
        <p class="text-xs text-slate-400 mt-1 leading-relaxed">${pick.justification}</p>
      </div>
      <div class="text-right shrink-0">
        <div class="text-lg font-extrabold text-white">${fmtOdds(pick.odds)}</div>
        <div class="text-xs text-amber-400 font-semibold">${probPct}%</div>
        <div class="text-xs text-slate-600 mt-0.5">modelo</div>
      </div>
    </div>
  </div>`;
}

/**
 * Llama a PicksEngine.generateDailyPicks() y actualiza el dashboard.
 */
async function runDailyPicks() {
  const btn    = document.getElementById('btn-gen-picks');
  const status = document.getElementById('picks-status-badge');
  if (btn) { btn.textContent = '⏳ Analizando…'; btn.disabled = true; }
  if (status) status.textContent = 'Generando picks para los próximos partidos…';

  try {
    const picks = await PicksEngine.generateDailyPicks(8);
    const totalPicks = picks.reduce((acc, p) => acc + p.picks.length, 0);
    if (status) status.textContent = `✅ ${totalPicks} picks para ${picks.length} partidos`;
    // AppState.setPicks() ya dispara 'picks-update' → renderDashboard()
  } catch(e) {
    console.error('[runDailyPicks]', e);
    if (status) status.textContent = '❌ Error generando picks';
  } finally {
    if (btn) { btn.textContent = '🔄 Generar picks'; btn.disabled = false; }
  }
}

// ============================================================
//  LIVE MATCH SIMULATOR — UI pública (desde botones)
// ============================================================

/**
 * Inicia la simulación en vivo de un partido desde la pestaña Calendario.
 * @param {number} fixtureId
 */
function startLiveSimulation(fixtureId) {
  const fx = FIXTURES.find(f => f.id === fixtureId);
  if (!fx) return;
  if (fx.homeGoals !== null) {
    alert('Este partido ya tiene resultado registrado.'); return;
  }
  if (LiveEngine.isSimulating(fixtureId)) {
    alert('La simulación de este partido ya está en marcha.'); return;
  }
  LiveEngine.simulate(fixtureId);
  // Forzar re-render inmediato del calendario para mostrar el estado "⚡ EN VIVO"
  if (STATE.currentTab === 'calendario') renderCalendar();
}

/**
 * Guarda el resultado simulado (FT) definitivamente en el fixture,
 * igual que si el usuario lo hubiera escrito manualmente.
 * @param {number} fixtureId
 * @param {number} hg   - goles local
 * @param {number} ag   - goles visitante
 */
function saveSimResult(fixtureId, hg, ag) {
  const fx = FIXTURES.find(f => f.id === fixtureId);
  if (!fx) return;
  fx.homeGoals = hg;
  fx.awayGoals = ag;
  AppState.emit('fixtures-changed', null);
  renderCalendar();
}

// ——— INIT ———
function init() {
  // Cerrar modal al clic fuera
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // Hidratar estado persistido (cuotas, árbitros, picks)
  AppState.hydrate();

  // ── Suscripciones al bus de eventos ──
  // Re-renderiza la pestaña activa cuando los fixtures cambian (datos en vivo)
  AppState.on('fixtures-changed', () => {
    const tab = STATE.currentTab;
    if (tab === 'calendario') {
      // Re-render sin hacer scroll, para no interrumpir la visualización en vivo
      renderCalendar();
    } else if (tab === 'dashboard') {
      switchTab(tab);
    }
    _updateLiveBadge();
  });

  // Actualiza la sección de picks en el dashboard cuando se regeneran
  AppState.on('picks-update', () => {
    if (STATE.currentTab === 'dashboard') renderDashboard();
  });

  // Actualiza contador LIVE en el nav
  AppState.on('live-status', ({ count }) => {
    AppState.getAll().liveCount = count;
    _updateLiveBadge();
  });

  // ── Iniciar motor en vivo ──
  LiveEngine.start();

  // ── Iniciar agente de aprendizaje ──
  try {
    LearningEngine.init();
    // Suscribirse a outliers de jugadores para notificar en UI
    AppState.on('player-outlier', (alert) => {
      console.log(`[LearningEngine] 🌟 Outlier: ${alert.player} (${alert.team}) Δ=${(alert.delta*100).toFixed(0)}% → picks regenerados`);
      _showLearningAlert(alert);
    });
    // Suscribirse a actualizaciones del agente para badge
    AppState.on('learning-update', () => _updateLearningBadge());
  } catch (e) {
    console.warn('[LearningEngine] init error:', e);
  }

  // ── Render inicial ──
  renderNav();
  renderDashboard();

  // Generar picks en segundo plano al cargar (sin bloquear UI)
  setTimeout(() => {
    PicksEngine.generateDailyPicks(6).catch(e => console.warn('[Picks]', e));
  }, 1500);

  // Cargar intel de equipos en segundo plano (afecta lambdas de ZakAgent)
  setTimeout(() => {
    if (typeof ZakAgent !== 'undefined' && ZakAgent.loadTeamIntel) {
      ZakAgent.loadTeamIntel().catch(() => {});
    }
  }, 2000);
}

// ──────────────────────────────────────────────────────────────
//  LEARNING ENGINE UI HELPERS
// ──────────────────────────────────────────────────────────────

/**
 * Muestra una notificación flotante cuando se detecta un outlier de jugador.
 */
function _showLearningAlert(alert) {
  const isUp  = alert.direction === 'up';
  const pct   = Math.abs(alert.delta * 100).toFixed(0);
  const color = isUp ? 'emerald' : 'red';
  const arrow = isUp ? '⬆️' : '⬇️';

  const toastId = `le-toast-${Date.now()}`;
  const toast   = document.createElement('div');
  toast.id = toastId;
  toast.className = `fixed bottom-5 right-5 z-50 max-w-xs p-4 rounded-2xl shadow-2xl border fade-in`;
  toast.style.cssText = `background:#111827;border-color:rgba(${isUp ? '16,185,129' : '239,68,68'},.3);`;
  toast.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="text-2xl">${arrow}</span>
      <div>
        <p class="text-xs font-extrabold text-${color}-400 uppercase tracking-wider">🧠 Agente de Aprendizaje</p>
        <p class="text-sm font-bold text-white mt-0.5">${alert.player}</p>
        <p class="text-xs text-slate-400 mt-0.5">
          Rating ${isUp ? 'superior' : 'inferior'} al histórico en <strong class="text-${color}-400">${pct}%</strong>
          · Λ ajustada · Picks regenerados ✅
        </p>
      </div>
      <button onclick="document.getElementById('${toastId}').remove()"
        class="text-slate-600 hover:text-slate-300 text-lg leading-none ml-1 shrink-0">×</button>
    </div>`;

  document.body.appendChild(toast);
  setTimeout(() => { if (document.getElementById(toastId)) document.getElementById(toastId).remove(); }, 7000);
}

/**
 * Actualiza el badge del Learning Engine en el header (si existe).
 */
function _updateLearningBadge() {
  let badge = document.getElementById('le-status-badge');
  if (!badge) return;
  const alerts = LearningEngine.getAllAlerts();
  if (alerts.length > 0) {
    badge.textContent = `🧠 ${alerts.length} ajuste${alerts.length !== 1 ? 's' : ''}`;
    badge.classList.remove('hidden');
  }
}

/** Actualiza el badge "LIVE n" en el header. */
function _updateLiveBadge() {
  const badge = document.getElementById('live-count-badge');
  const count = AppState.getLiveCount();
  if (!badge) return;
  if (count > 0) {
    badge.textContent = `⚡ LIVE ${count}`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
//  🤖 IA-Zak — Panel Analítico Inteligente
// ============================================================

// Estado local de la pestaña Zak
const ZAK_STATE = {
  homeKey: null,
  awayKey: null,
  result: null,
  activeCategory: 'all',
};

function renderZakAgent() {
  if (typeof ZakAgent === 'undefined') {
    document.getElementById('app-content').innerHTML =
      '<div class="p-8 text-center text-red-400">IA-Zak no está disponible. Recarga la página.</div>';
    return;
  }

  const teamOptions = TEAMS.map(t =>
    `<option value="${t.shortName}">${t.flag || '🏳️'} ${t.name || t.shortName}</option>`
  ).join('');

  const zakState = ZakAgent.getState();

  document.getElementById('app-content').innerHTML = `
  <div class="fade-in space-y-5">

    <!-- ═══ HEADER IA-ZAK — flags as visual anchors ═══ -->
    <div class="relative overflow-hidden rounded-2xl border border-violet-800/40 p-6 sm:p-8"
         style="background:linear-gradient(135deg,#0a0c20 0%,#0f0d2e 50%,#0a0c20 100%);">
      <!-- Ambient flag watermarks -->
      <span class="absolute left-0 top-1/2 -translate-y-1/2 text-[120px] opacity-[0.04] select-none leading-none pointer-events-none">🏆</span>
      <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[90px] opacity-[0.06] select-none leading-none pointer-events-none">🤖</span>
      <!-- Content -->
      <div class="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-900/60 border border-violet-700/50 text-violet-300 text-[10px] font-bold tracking-widest uppercase">
              ⚡ Agente Analítico
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold
              ${zakState.demoMode ? 'bg-amber-900/40 border-amber-700/40 text-amber-300' : 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'}">
              ${zakState.demoMode ? '🧪 DEMO' : '🔴 LIVE'}
            </span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-white leading-none mb-1">
            IA-Zak <span class="text-violet-400 font-mono text-xl">v${zakState.version}</span>
          </h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            30+ mercados DoradoBet · Poisson-Dixon/Coles · Historial de jugadores · Riesgo 🟢🟡🔴
          </p>
        </div>
        <div class="flex gap-4 shrink-0">
          <div class="text-center px-4 py-2 rounded-xl border border-violet-800/40 bg-violet-900/20">
            <p class="text-xl font-black text-white font-mono">${zakState.playersTracked}</p>
            <p class="text-[10px] text-violet-400 uppercase tracking-wider mt-0.5">Jugadores</p>
          </div>
          <div class="text-center px-4 py-2 rounded-xl border border-violet-800/40 bg-violet-900/20">
            <p class="text-xl font-black text-emerald-400 font-mono">30+</p>
            <p class="text-[10px] text-violet-400 uppercase tracking-wider mt-0.5">Mercados</p>
          </div>
          <div id="zak-status-badge" class="hidden sm:flex text-center px-4 py-2 rounded-xl border border-emerald-800/40 bg-emerald-900/20 flex-col justify-center">
            <p class="text-[10px] text-emerald-400 font-bold">✅ Listo</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ INTEL DAILY BRIEF ═══ -->
    <div id="zak-intel-panel" class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">🧠</span>
          <div>
            <p class="text-sm font-bold text-white">Intel Diario</p>
            <p class="text-[10px] text-slate-500" id="zak-intel-timestamp">Cargando…</p>
          </div>
        </div>
        <button onclick="zakRefreshIntel()" title="Estudiar ahora"
          class="text-[10px] px-3 py-1.5 rounded-lg border border-violet-700/50 text-violet-400 hover:bg-violet-900/40 transition-colors font-bold">
          🔄 Actualizar
        </button>
      </div>
      <div id="zak-intel-content" class="text-xs text-slate-400 leading-relaxed">
        <div class="flex items-center gap-2 text-slate-600">
          <div class="w-4 h-4 border-2 border-violet-800 border-t-violet-400 rounded-full animate-spin"></div>
          Cargando inteligencia del Mundial…
        </div>
      </div>
    </div>

    <!-- ═══ DESKTOP 2-COL: selector left · results right ═══ -->
    <div class="zak-desktop-layout space-y-5">

      <!-- LEFT COL: Selector de partido -->
      <div class="card p-5">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Seleccionar Partido</h3>

        <!-- Team pickers with live flag preview -->
        <div class="grid sm:grid-cols-[1fr_auto_1fr] xl:grid-cols-1 gap-3 items-end mb-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Local</label>
            <div class="relative">
              <span id="zak-home-flag" class="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none leading-none">🏳️</span>
              <select id="zak-home" onchange="zakUpdateTeams()"
                class="zak-team-select pl-10">
                <option value="">— Seleccionar —</option>
                ${teamOptions}
              </select>
            </div>
          </div>

          <div class="flex items-end pb-2 xl:hidden">
            <span class="text-slate-600 font-black text-lg px-2 select-none">VS</span>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Visitante</label>
            <div class="relative">
              <span id="zak-away-flag" class="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none leading-none">🏳️</span>
              <select id="zak-away" onchange="zakUpdateTeams()"
                class="zak-team-select pl-10">
                <option value="">— Seleccionar —</option>
                ${teamOptions}
              </select>
            </div>
          </div>
        </div>

        <button onclick="zakAnalyze()"
          class="w-full px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 mb-4"
          style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;">
          🔍 Analizar Partido
        </button>

        <!-- Fixture quick-load buttons -->
        <div>
          <p class="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Próximos Partidos</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2" id="zak-fixture-btns">
            ${_zakFixtureButtons()}
          </div>
        </div>
      </div>

      <!-- RIGHT COL: Resultado del análisis + jugadores -->
      <div class="space-y-5">
        <div id="zak-result-panel">
          ${ZAK_STATE.result ? _renderZakResult(ZAK_STATE.result) : _renderZakWelcome()}
        </div>
        <div id="zak-player-panel"></div>
      </div>

    </div>

    <!-- ═══ CHAT SECTION ═══ -->
    <div class="card p-5 mt-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-lg">💬</span>
        <div>
          <p class="text-sm font-bold text-white">Chat con IA-Zak</p>
          <p class="text-[10px] text-slate-500">Razonamiento tipo Claude con fuentes visibles</p>
        </div>
      </div>
      <div id="zak-chat-container"></div>
    </div>

  </div>`;

  // Pre-llenar si ya hay selección previa
  if (ZAK_STATE.homeKey) {
    const sel = document.getElementById('zak-home');
    if (sel) { sel.value = ZAK_STATE.homeKey; _zakUpdateFlagPreview(); }
  }
  if (ZAK_STATE.awayKey) {
    const sel = document.getElementById('zak-away');
    if (sel) { sel.value = ZAK_STATE.awayKey; _zakUpdateFlagPreview(); }
  }

  // Initialize chat UI
  const sessionId = ChatUI.init(null, STATE.bankroll || 5000, 'es');
  const chatContainer = document.getElementById('zak-chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = ChatUI.renderChatContainer();
    ChatUI.renderMessagesArea();
  }

  // Load intel in background (non-blocking)
  _loadZakIntel();
}

// ── Intel loader ────────────────────────────────────────────
async function _loadZakIntel() {
  try {
    const res  = await fetch('/api/intel');
    const data = await res.json();
    _renderZakIntelPanel(data);
  } catch {
    const el = document.getElementById('zak-intel-content');
    if (el) el.innerHTML = '<span class="text-slate-600 text-[11px]">Sin conexión con el servidor de intel.</span>';
  }
}

function _renderZakIntelPanel(data) {
  const ts  = document.getElementById('zak-intel-timestamp');
  const el  = document.getElementById('zak-intel-content');
  if (!el) return;

  if (!data.ok || (!data.lastStudied && !data.oddsNews)) {
    el.innerHTML = `
      <div class="flex items-center justify-between p-3 rounded-xl border border-amber-900/40 bg-amber-900/10">
        <p class="text-[11px] text-amber-400">IA-Zak aún no ha estudiado. Pulsa <strong>Actualizar</strong> para iniciar el primer estudio.</p>
      </div>`;
    if (ts) ts.textContent = 'Sin datos todavía';
    return;
  }

  if (ts && data.lastStudied) {
    const d = new Date(data.lastStudied);
    ts.textContent = `Último estudio: ${d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}`;
  }

  const teamMods = data.teamMods || [];
  const injured  = teamMods.filter(t => t.injuries && t.injuries.length > 10).slice(0, 4);

  // Build intel cards
  let html = '<div class="space-y-3">';

  // Odds/news brief
  if (data.oddsNews) {
    const brief = data.oddsNews.substring(0, 400);
    html += `
      <div class="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <p class="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1.5">📰 Análisis de Mercado</p>
        <p class="text-[11px] text-slate-300 leading-relaxed">${brief}${data.oddsNews.length > 400 ? '…' : ''}</p>
      </div>`;
  }

  // Injured teams
  if (injured.length) {
    html += `
      <div class="p-3 rounded-xl border border-red-900/30 bg-red-900/10">
        <p class="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">🏥 Lesiones / Bajas Clave</p>
        <div class="space-y-1.5">
          ${injured.map(t => `
            <div class="flex items-start gap-2">
              <span class="text-[10px] font-bold text-white min-w-[80px]">${t.team_key}</span>
              <span class="text-[10px] text-slate-400 leading-tight">${t.injuries}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // Team modifier summary
  const boosted  = teamMods.filter(t => parseFloat(t.attack_mod) > 1.05).slice(0,3);
  const weakened = teamMods.filter(t => parseFloat(t.defense_mod) < 0.95).slice(0,3);
  if (boosted.length || weakened.length) {
    html += `
      <div class="grid grid-cols-2 gap-2">
        ${boosted.length ? `<div class="p-2.5 rounded-xl border border-emerald-900/30 bg-emerald-900/10">
          <p class="text-[10px] font-bold text-emerald-400 mb-1.5">🟢 Ataque Reforzado</p>
          ${boosted.map(t => `<p class="text-[10px] text-slate-300">${t.team_key} <span class="text-emerald-400 font-mono">×${parseFloat(t.attack_mod).toFixed(2)}</span></p>`).join('')}
        </div>` : ''}
        ${weakened.length ? `<div class="p-2.5 rounded-xl border border-red-900/30 bg-red-900/10">
          <p class="text-[10px] font-bold text-red-400 mb-1.5">🔴 Defensa Debilitada</p>
          ${weakened.map(t => `<p class="text-[10px] text-slate-300">${t.team_key} <span class="text-red-400 font-mono">×${parseFloat(t.defense_mod).toFixed(2)}</span></p>`).join('')}
        </div>` : ''}
      </div>`;
  }

  if (html === '<div class="space-y-3">') {
    html += `<p class="text-slate-500 text-[11px]">No hay intel disponible todavía. Pulsa Actualizar.</p>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

async function zakRefreshIntel() {
  const btn = document.querySelector('[onclick="zakRefreshIntel()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Estudiando…'; }
  const el = document.getElementById('zak-intel-content');
  if (el) el.innerHTML = `
    <div class="flex items-center gap-2 text-slate-400 text-[11px]">
      <div class="w-4 h-4 border-2 border-violet-800 border-t-violet-400 rounded-full animate-spin"></div>
      IA-Zak está investigando el Mundial 2026 ahora mismo…
    </div>`;

  try {
    const res  = await fetch('/api/learn?force=1');
    const data = await res.json();
    if (data.ok) {
      // Reload intel after study
      await _loadZakIntel();
    } else {
      if (el) el.innerHTML = `<p class="text-red-400 text-[11px]">Error: ${data.error || 'Fallo al estudiar'}</p>`;
    }
  } catch (e) {
    if (el) el.innerHTML = `<p class="text-red-400 text-[11px]">Error de red: ${e.message}</p>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualizar'; }
  }
}

function _zakUpdateFlagPreview() {
  const hKey = document.getElementById('zak-home')?.value;
  const aKey = document.getElementById('zak-away')?.value;
  const hTeam = hKey ? TEAMS.find(t => t.shortName === hKey) : null;
  const aTeam = aKey ? TEAMS.find(t => t.shortName === aKey) : null;
  const hFlag = document.getElementById('zak-home-flag');
  const aFlag = document.getElementById('zak-away-flag');
  if (hFlag) hFlag.textContent = hTeam?.flag || '🏳️';
  if (aFlag) aFlag.textContent = aTeam?.flag || '🏳️';
}

function _zakFixtureButtons() {
  const upcoming = FIXTURES.filter(f => f.homeGoals === null).slice(0, 6);
  if (!upcoming.length) return '<p class="text-xs text-slate-600 col-span-2">Sin partidos pendientes</p>';
  return upcoming.map(f => {
    const hKey = f.home, aKey = f.away;
    const hTeam = TEAMS.find(t => t.shortName === hKey) || {};
    const aTeam = TEAMS.find(t => t.shortName === aKey) || {};
    const hFlag = hTeam.flag || '🏳️', aFlag = aTeam.flag || '🏳️';
    const hName = hTeam.name || hKey, aName = aTeam.name || aKey;
    return `
    <button onclick="zakQuickLoad('${hKey}','${aKey}')" class="zak-fixture-btn">
      <span class="fixture-flags">${hFlag}${aFlag}</span>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-white leading-none">${hName} vs ${aName}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">${f.group ? 'Grupo '+f.group : (f.round || 'Fixture')}</p>
      </div>
      <svg class="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
    </button>`;
  }).join('');
}

function _renderZakWelcome() {
  const demoFlags = ['🇧🇷','🇦🇷','🇫🇷','🇪🇸','🇩🇪','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇵🇹','🇳🇱'];
  const features = [
    { icon:'📊', label:'30+ mercados', sub:'Result, goles, córners, tarjetas…' },
    { icon:'🎯', label:'Value bets', sub:'Edge vs cuotas DoradoBet' },
    { icon:'👤', label:'Jugadores estrella', sub:'Stats 2024-25 reales' },
    { icon:'📣', label:'Comunidad', sub:'Tendencias y sentimiento' },
    { icon:'⚡', label:'Árbitros FIFA', sub:'Perfiles y promedios 2026' },
    { icon:'🔢', label:'Poisson-Dixon', sub:'Modelo matemático avanzado' },
  ];
  return `
  <div class="card overflow-hidden">
    <!-- Flag parade banner -->
    <div class="px-6 py-4 border-b border-[#1a2540] flex items-center gap-2 overflow-hidden"
         style="background:linear-gradient(135deg,#09112a,#0d1220);">
      <div class="flex gap-2 text-3xl select-none animate-pulse opacity-80">
        ${demoFlags.map(f => `<span>${f}</span>`).join('')}
      </div>
    </div>
    <!-- Welcome content -->
    <div class="p-8 text-center">
      <div class="zak-welcome-icon mb-5">🤖</div>
      <h3 class="text-xl font-black text-white mb-2">IA-Zak está listo</h3>
      <p class="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
        Selecciona dos selecciones nacionales y presiona <strong class="text-violet-400">Analizar</strong> para obtener picks con evaluación de riesgo, narrativa y análisis de jugadores.
      </p>
      <div class="mt-7 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
        ${features.map(f => `
        <div class="p-3 rounded-xl border border-[#1a2540] bg-[#0d1220] text-left">
          <div class="text-xl mb-1.5">${f.icon}</div>
          <p class="text-xs font-bold text-white">${f.label}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">${f.sub}</p>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function _renderZakResult(result) {
  if (!result || result.error) {
    return `<div class="card p-6 text-center text-red-400">⚠️ ${result?.error || 'Error al analizar'}</div>`;
  }

  const { summary, topPicks, allPicks, community, homeKey, awayKey, homeName, awayName, homeFlag, awayFlag } = result;

  const categories = [
    { id: 'all',       label: 'Todos',     count: allPicks.length },
    { id: 'resultado', label: 'Resultado', count: allPicks.filter(p=>p.category==='resultado').length },
    { id: 'goles',     label: 'Goles',     count: allPicks.filter(p=>p.category==='goles').length },
    { id: 'handicap',  label: 'Hándicap',  count: allPicks.filter(p=>p.category==='handicap').length },
    { id: 'corners',   label: 'Córners',   count: allPicks.filter(p=>p.category==='corners').length },
    { id: 'tarjetas',  label: 'Tarjetas',  count: allPicks.filter(p=>p.category==='tarjetas').length },
    { id: 'jugador',   label: 'Jugadores', count: allPicks.filter(p=>p.category==='jugador').length },
    { id: 'tiempo',    label: 'Tiempo',    count: allPicks.filter(p=>p.category==='tiempo').length },
  ].filter(c => c.id === 'all' || c.count > 0);

  const filteredPicks = ZAK_STATE.activeCategory === 'all'
    ? allPicks
    : allPicks.filter(p => p.category === ZAK_STATE.activeCategory);

  const catTabs = categories.map(c => `
    <button onclick="zakSetCategory('${c.id}')" class="zak-cat-tab ${ZAK_STATE.activeCategory === c.id ? 'active' : ''}">
      ${c.label}${c.count > 0 && c.id !== 'all' ? ` <span class="ml-1 opacity-60 text-[9px]">${c.count}</span>` : ''}
    </button>`).join('');

  const homeStar = result.markets?.players?.homeStar;
  const awayStar = result.markets?.players?.awayStar;
  const allSquad = [...(result.markets?.players?.homeSquad || []), ...(result.markets?.players?.awaySquad || [])];

  // Sentiment percentages for community bar
  const homeSentiment = community.home?.sentiment || 50;
  const commHotPick   = community.home?.hotPick || '—';
  const commTrending  = community.home?.trending || [];

  return `
  <div class="space-y-4 fade-in">

    <!-- ═══ MATCH HERO — big flags ═══ -->
    <div class="zak-analysis-header">
      <div class="match-hero">
        <!-- Home team -->
        <div class="match-hero-team flex-1">
          <span class="match-hero-flag">${homeFlag}</span>
          <div class="min-w-0">
            <p class="text-base font-black text-white leading-none">${homeName}</p>
            <p class="text-[10px] text-slate-500 mt-0.5 font-mono">λ ${summary.lambdas.home}</p>
          </div>
        </div>

        <!-- VS / score -->
        <div class="match-hero-vs px-4">
          <span class="match-hero-vs-text">VS</span>
          <div class="flex items-center gap-1 mt-1">
            <span class="text-[10px] font-mono text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded-full border border-violet-800/30">
              ${summary.expectedGoals} goles esperados
            </span>
          </div>
        </div>

        <!-- Away team -->
        <div class="match-hero-team away flex-1">
          <span class="match-hero-flag">${awayFlag}</span>
          <div class="min-w-0 text-right">
            <p class="text-base font-black text-white leading-none">${awayName}</p>
            <p class="text-[10px] text-slate-500 mt-0.5 font-mono">λ ${summary.lambdas.away}</p>
          </div>
        </div>
      </div>

      <!-- Summary stats row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#1a2540] border-t border-[#1a2540]">
        <div class="px-4 py-3 text-center">
          <p class="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Favorito</p>
          <p class="text-sm font-black text-white leading-none">${summary.favorite}</p>
          <p class="text-xs text-amber-400 mt-0.5 font-mono">${summary.favoriteProb}</p>
        </div>
        <div class="px-4 py-3 text-center">
          <p class="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Value Bets</p>
          <p class="text-2xl font-black text-emerald-400 leading-none font-mono">${allPicks.length}</p>
          <p class="text-[10px] text-slate-600 mt-0.5">detectadas</p>
        </div>
        <div class="px-4 py-3 text-center">
          <p class="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Mejor Pick</p>
          <p class="text-xs font-bold text-white leading-snug line-clamp-2">${topPicks[0]?.label || '—'}</p>
          <p class="text-xs text-emerald-400 font-mono">${topPicks[0]?.edgeLabel || '—'}</p>
        </div>
        <div class="px-4 py-3 text-center">
          <p class="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Comunidad</p>
          <div class="sentiment-bar mt-1 mb-1"><div class="sentiment-fill" style="width:${homeSentiment}%"></div></div>
          <p class="text-[10px] text-violet-300 leading-snug">${commHotPick.slice(0,24)}</p>
        </div>
      </div>
    </div>

    <!-- IA-Zak narrative -->
    <div class="card px-5 py-4 flex gap-3 items-start">
      <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
           style="background:linear-gradient(135deg,#4c1d95,#2e1065);border:1px solid #6d28d9;">🤖</div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-violet-400 mb-1">IA-Zak · Análisis</p>
        <p class="text-sm text-slate-300 leading-relaxed">${summary.outlook}</p>
        ${commTrending.length ? `
        <div class="flex gap-2 mt-2 flex-wrap">
          ${commTrending.map(t => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/30 border border-violet-800/30 text-violet-300">${t}</span>`).join('')}
        </div>` : ''}
      </div>
    </div>

    <!-- ═══ TOP PICKS ═══ -->
    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-amber-400 text-lg">⭐</span>
        <h3 class="text-sm font-black text-white uppercase tracking-wider">Top Picks de IA-Zak</h3>
        <span class="ml-auto text-[10px] font-bold text-amber-500 bg-amber-900/30 border border-amber-800/30 px-2 py-0.5 rounded-full">
          Mayor edge
        </span>
      </div>
      <div class="space-y-3">
        ${topPicks.length
          ? topPicks.map((p, i) => _renderZakPick(p, i)).join('')
          : '<p class="text-slate-500 text-sm text-center py-4">Sin picks destacados en este partido</p>'
        }
      </div>
    </div>

    <!-- ═══ JUGADORES ESTRELLA ═══ -->
    ${(homeStar || awayStar) ? `
    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-blue-400 text-lg">👤</span>
        <h3 class="text-sm font-black text-white uppercase tracking-wider">Jugadores Estrella</h3>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        ${homeStar ? _renderZakPlayer(homeStar, homeFlag) : ''}
        ${awayStar ? _renderZakPlayer(awayStar, awayFlag) : ''}
      </div>
    </div>` : ''}

    <!-- ═══ TODOS LOS MERCADOS ═══ -->
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <span class="text-blue-400 text-lg">📊</span>
          <h3 class="text-sm font-black text-white uppercase tracking-wider">Todos los Mercados</h3>
        </div>
        <span class="text-[10px] text-slate-600 font-mono">${allPicks.length} picks con valor</span>
      </div>
      <div class="flex flex-wrap gap-1.5 mb-4">
        ${catTabs}
      </div>
      ${filteredPicks.length === 0
        ? `<div class="py-8 text-center">
            <p class="text-3xl mb-2">🔍</p>
            <p class="text-slate-500 text-sm">Sin apuestas con valor en esta categoría</p>
           </div>`
        : `<div class="space-y-2">${filteredPicks.slice(0,25).map(p => _renderZakPick(p)).join('')}</div>`
      }
    </div>

    <!-- ═══ SQUAD OVERVIEW ═══ -->
    ${allSquad.length ? `
    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-violet-400 text-lg">👥</span>
        <h3 class="text-sm font-black text-white uppercase tracking-wider">Convocados — Análisis Individual</h3>
      </div>
      <div class="grid sm:grid-cols-2 gap-2">
        ${allSquad.slice(0,16).map(p => `
        <div class="flex items-center justify-between p-2.5 rounded-xl border border-[#1a2540] bg-[#0d1220]"
             data-flag="${p.flag || ''}">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-lg leading-none">${p.flag || '👤'}</span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-white leading-none truncate">${p.player}</p>
              <p class="text-[10px] text-slate-600 mt-0.5">${p.team || ''}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0 ml-2">
            <p class="text-[10px] text-emerald-400 font-mono">${(p.predictions.scoreProbability*100).toFixed(0)}% ⚽</p>
            <p class="text-[10px] text-amber-400 font-mono">${(p.predictions.cardProbability*100).toFixed(0)}% 🟨</p>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

  </div>`;
}

function _renderZakPick(p, rank = null) {
  const riskLevel = p.risk?.level || 'alto';
  const riskColor = p.risk?.color || 'text-slate-400';
  const riskBg    = riskLevel === 'bajo' ? 'risk-low' : riskLevel === 'medio' ? 'risk-med' : 'risk-high';
  const edgePct   = (p.edge * 100).toFixed(1);
  const edgeCls   = p.edge >= 0.05 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-700/50'
                  : p.edge >= 0.03 ? 'bg-green-700/20 text-green-300 border-green-700/50'
                  : 'bg-amber-800/20 text-amber-300 border-amber-700/50';
  const stars     = '★'.repeat(Math.min(p.stars || 1, 5));
  const rankNum   = rank !== null ? rank + 1 : null;
  const pillCls   = rankNum === 1 ? 'r1' : rankNum === 2 ? 'r2' : rankNum === 3 ? 'r3' : 'rn';

  // Model vs implied probability bar
  const modelPct   = (p.modelProb  * 100).toFixed(1);
  const implPct    = (p.impliedProb * 100).toFixed(1);
  const barWidth   = Math.min(p.modelProb * 100, 100).toFixed(1);
  const implWidth  = Math.min(p.impliedProb * 100, 100).toFixed(1);

  return `
  <div class="zak-pick-card ${riskBg}">
    <div class="flex items-start gap-3">
      ${rankNum !== null ? `<span class="zak-rank-pill ${pillCls}">${rankNum}</span>` : ''}
      <div class="flex-1 min-w-0">
        <!-- Label + edge + risk -->
        <div class="flex items-center gap-2 flex-wrap mb-1.5">
          <span class="text-sm font-black text-white leading-none">${p.label}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${edgeCls}">+${edgePct}%</span>
          ${p.communityBoosted ? '<span class="text-[10px] text-violet-300 font-bold">📣</span>' : ''}
        </div>

        <!-- Odds + probabilities row -->
        <div class="flex items-center gap-3 flex-wrap mb-2">
          <span class="text-sm font-black text-amber-400 font-mono">${p.odds?.toFixed(2) || '—'}</span>
          <span class="text-[10px] text-slate-500">Modelo <span class="text-slate-300 font-mono">${modelPct}%</span></span>
          <span class="text-[10px] text-slate-500">Casa <span class="text-slate-400 font-mono">${implPct}%</span></span>
          <span class="text-[10px] text-amber-500">${stars}</span>
          <span class="ml-auto text-[10px] font-bold ${riskColor} whitespace-nowrap">${p.risk?.label || '—'}</span>
        </div>

        <!-- Visual edge bar -->
        <div class="relative h-1.5 rounded-full overflow-hidden mb-2" style="background:#1a2540;">
          <div class="absolute inset-y-0 left-0 rounded-full opacity-50" style="width:${implWidth}%;background:#374151;"></div>
          <div class="absolute inset-y-0 left-0 rounded-full transition-all" style="width:${barWidth}%;background:${p.edge >= 0.03 ? '#10b981' : '#f59e0b'};"></div>
        </div>

        ${p.narrative ? `<p class="text-[11px] text-slate-400 leading-relaxed mt-1.5">${p.narrative}</p>` : ''}
      </div>
    </div>
  </div>`;
}

function _renderZakPlayer(playerData, flag) {
  const pred = playerData.predictions;
  const stats = [
    { label:'Gol/prt',   pct: (pred.scoreProbability  * 100).toFixed(0), color:'text-emerald-400', bar:'#10b981' },
    { label:'Asistencia', pct: (pred.assistProbability * 100).toFixed(0), color:'text-blue-400',    bar:'#3b82f6' },
    { label:'Tarjeta',   pct: (pred.cardProbability    * 100).toFixed(0), color:'text-amber-400',   bar:'#f59e0b' },
    { label:'Disparo',   pct: (pred.shotProbability    * 100).toFixed(0), color:'text-purple-400',  bar:'#8b5cf6' },
  ];

  return `
  <div class="zak-player-card relative overflow-hidden" data-flag="${flag}">
    <!-- Flag watermark -->
    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-6xl opacity-[0.06] pointer-events-none select-none leading-none">${flag}</span>
    <!-- Player header -->
    <div class="flex items-center gap-3 mb-3 relative z-10">
      <span class="text-3xl leading-none drop-shadow-sm">${flag}</span>
      <div>
        <p class="text-sm font-black text-white leading-none">${playerData.player}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">${playerData.team || ''}</p>
      </div>
      <span class="ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold
        ${playerData.profile?._demo ? 'bg-slate-800 text-slate-600' : 'bg-violet-900/50 text-violet-400 border border-violet-800/30'}">
        ${playerData.profile?._demo ? 'HISTÓRICO' : 'TORNEO'}
      </span>
    </div>
    <!-- Stats bars -->
    <div class="space-y-2 relative z-10">
      ${stats.map(s => `
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-slate-600 w-16 flex-shrink-0">${s.label}</span>
        <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:#1a2540;">
          <div class="h-full rounded-full" style="width:${s.pct}%;background:${s.bar};transition:width 1s ease;"></div>
        </div>
        <span class="text-xs font-black font-mono ${s.color} w-9 text-right">${s.pct}%</span>
      </div>`).join('')}
    </div>
    ${playerData.narrative ? `
    <p class="text-[11px] text-slate-400 mt-3 leading-relaxed relative z-10 border-t border-[#1a2540] pt-2.5">${playerData.narrative}</p>` : ''}
  </div>`;
}

// ── Funciones de UI para IA-Zak ────────────────────────────

window.zakUpdateTeams = function() {
  ZAK_STATE.homeKey = document.getElementById('zak-home')?.value || null;
  ZAK_STATE.awayKey = document.getElementById('zak-away')?.value || null;
  _zakUpdateFlagPreview();
};

window.zakQuickLoad = function(homeKey, awayKey) {
  ZAK_STATE.homeKey = homeKey;
  ZAK_STATE.awayKey = awayKey;
  ZAK_STATE.activeCategory = 'all';
  zakAnalyze();
};

window.zakSetCategory = function(cat) {
  ZAK_STATE.activeCategory = cat;
  if (ZAK_STATE.result) {
    document.getElementById('zak-result-panel').innerHTML = _renderZakResult(ZAK_STATE.result);
  }
};

window.zakAnalyze = function() {
  const homeKey = ZAK_STATE.homeKey || document.getElementById('zak-home')?.value;
  const awayKey = ZAK_STATE.awayKey || document.getElementById('zak-away')?.value;

  if (!homeKey || !awayKey) {
    alert('Selecciona ambos equipos');
    return;
  }
  if (homeKey === awayKey) {
    alert('Los equipos deben ser diferentes');
    return;
  }

  // Loading state
  const badge = document.getElementById('zak-status-badge');
  if (badge) { badge.textContent = '⏳ Analizando...'; badge.className = badge.className.replace('emerald','amber'); }
  document.getElementById('zak-result-panel').innerHTML = `
    <div class="card p-8 text-center">
      <div class="text-4xl mb-3 animate-spin">⚙️</div>
      <p class="text-slate-400">IA-Zak calculando ${homeKey} vs ${awayKey}...</p>
    </div>`;

  // Delay para dejar que el DOM pinte el spinner antes del cálculo
  setTimeout(() => {
    try {
      const result = ZakAgent.refreshForFixture(homeKey, awayKey);
      ZAK_STATE.homeKey = homeKey;
      ZAK_STATE.awayKey = awayKey;
      ZAK_STATE.result  = result;
      ZAK_STATE.activeCategory = 'all';
      document.getElementById('zak-result-panel').innerHTML = _renderZakResult(result);
      if (badge) { badge.textContent = '✅ Análisis listo'; badge.className = badge.className.replace('amber','emerald'); }

      // ── Render player cards for both teams ───────────────
      _renderZakPlayerPanel(homeKey, awayKey);

      // ── Persist analysis to DB ────────────────────────────
      if (window.DB_API?.saveZakAnalysis) {
        window.DB_API.saveZakAnalysis(homeKey, awayKey, result).catch(() => {});
      }

    } catch (err) {
      console.error('[IA-Zak]', err);
      document.getElementById('zak-result-panel').innerHTML =
        `<div class="card p-6 text-center text-red-400">⚠️ Error: ${err.message}</div>`;
    }
  }, 50);
};

// ────────────────────────────────────────────────────────────
//  PANEL DE JUGADORES — se renderiza tras el análisis de Zak
// ────────────────────────────────────────────────────────────
function _renderZakPlayerPanel(homeKey, awayKey) {
  const panel = document.getElementById('zak-player-panel');
  if (!panel) return;

  const hTeam = TEAMS.find(t => t.shortName === homeKey);
  const aTeam = TEAMS.find(t => t.shortName === awayKey);
  if (!hTeam || !aTeam) return;

  // Cargar datos de jugadores en background y re-renderizar
  const renderCards = () => {
    const hPlayer = hTeam.starPlayer || '';
    const aPlayer = aTeam.starPlayer || '';

    // Top 3 jugadores por equipo desde PlayerEngine
    const hSquad = window.PlayerEngine ? PlayerEngine.getSquad(homeKey) : [];
    const aSquad = window.PlayerEngine ? PlayerEngine.getSquad(awayKey) : [];

    // Si no hay squad en cache, usamos los jugadores estrella conocidos
    const hProfiles = hSquad.length > 0
      ? hSquad.sort((a,b) => b.goalsPerGame - a.goalsPerGame).slice(0, 3)
      : [hPlayer ? PlayerEngine?.getProfile(hPlayer, homeKey) : null].filter(Boolean);

    const aProfiles = aSquad.length > 0
      ? aSquad.sort((a,b) => b.goalsPerGame - a.goalsPerGame).slice(0, 3)
      : [aPlayer ? PlayerEngine?.getProfile(aPlayer, awayKey) : null].filter(Boolean);

    const buildPlayerCard = (p, accent) => {
      if (!p) return '';
      const g = (p.goalsPerGame||0).toFixed(2);
      const a = (p.assistsPerGame||0).toFixed(2);
      const sh = (p.shotsPerGame||0).toFixed(1);
      const c = (p.cardsPerGame||0).toFixed(2);
      return `
        <div class="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-black/20 hover:bg-black/30 transition-colors">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
               style="background:${accent}20;color:${accent}">
            ${(p.name||'?')[0]}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-white truncate">${p.name||'?'}</p>
            <div class="flex gap-2 mt-0.5 flex-wrap">
              <span class="text-[10px] text-emerald-400">⚽ ${g}</span>
              <span class="text-[10px] text-blue-400">🅰️ ${a}</span>
              <span class="text-[10px] text-amber-400">👟 ${sh}</span>
              <span class="text-[10px] text-red-400">🟨 ${c}</span>
            </div>
          </div>
          ${(p.xgPerGame||0) > 0 ? `
          <div class="shrink-0 text-right">
            <p class="text-[9px] text-slate-500">xG</p>
            <p class="text-[11px] text-violet-400 font-bold">${(p.xgPerGame||0).toFixed(2)}</p>
          </div>` : ''}
        </div>`;
    };

    const hCards = hProfiles.map(p => buildPlayerCard(p, '#10b981')).join('') ||
      `<p class="text-xs text-slate-600 py-2">Cargando jugadores…</p>`;
    const aCards = aProfiles.map(p => buildPlayerCard(p, '#3b82f6')).join('') ||
      `<p class="text-xs text-slate-600 py-2">Cargando jugadores…</p>`;

    const status = window.PlayerEngine ? PlayerEngine.getStatus() : null;
    const sourceLabel = status ? {
      'api-football': '🌐 API en vivo',
      'db_cache':     '💾 DB cache (6h)',
      'local':        '📚 Base conocimiento',
      'local_fallback':'📚 Base conocimiento',
    }[status.source] || '📊 Stats' : '📚 Base conocimiento';

    panel.innerHTML = `
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest">👥 Jugadores Clave</h3>
          <span class="text-[9px] text-slate-600 border border-white/5 rounded-full px-2 py-0.5">${sourceLabel}</span>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              ${hTeam.flag} ${hTeam.name}
            </p>
            <div class="space-y-2">${hCards}</div>
          </div>
          <div>
            <p class="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              ${aTeam.flag} ${aTeam.name}
            </p>
            <div class="space-y-2">${aCards}</div>
          </div>
        </div>
        ${status ? `<p class="text-[10px] text-slate-700 text-right mt-3">${status.cachedPlayers} jugadores en cache</p>` : ''}
      </div>`;

    // Prefetch en background — SIN llamada recursiva (evita infinite microtask loop)
    if (window.PlayerEngine) {
      const alreadyFetched = PlayerEngine.getSquad(homeKey).length > 0 &&
                             PlayerEngine.getSquad(awayKey).length > 0;
      if (!alreadyFetched) {
        Promise.all([
          PlayerEngine.fetchTeam(homeKey),
          PlayerEngine.fetchTeam(awayKey),
        ]).then(() => {
          // Re-render una sola vez después de que lleguen los datos
          requestAnimationFrame(() => {
            const freshPanel = document.getElementById('zak-player-panel');
            if (freshPanel) renderCards();
          });
        }).catch(() => {});
      }
    }
  };

  renderCards();
}

// ============================================================
//  📈 ANALYTICS — Learning Metrics Dashboard
// ============================================================

function renderAnalytics() {
  document.getElementById('app-content').innerHTML = `
  <div class="fade-in space-y-5">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-2xl border border-blue-800/40 p-6 sm:p-8"
         style="background:linear-gradient(135deg,#0a0c20 0%,#0f0d2e 50%,#0a0c20 100%);">
      <span class="absolute left-0 top-1/2 -translate-y-1/2 text-[120px] opacity-[0.04] select-none leading-none pointer-events-none">📊</span>
      <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[90px] opacity-[0.06] select-none leading-none pointer-events-none">📈</span>
      <div class="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-900/60 border border-blue-700/50 text-blue-300 text-[10px] font-bold tracking-widest uppercase">
              📊 Learning Analytics
            </span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-white leading-none mb-1">
            Métricas de Aprendizaje
          </h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Precisión de predicciones, Brier Score, y ajuste dinámico de pesos de fuentes
          </p>
        </div>
      </div>
    </div>

    <!-- Learning Dashboard Widget -->
    <div id="learning-dashboard-widget"></div>
  </div>`;

  // Initialize and render learning dashboard
  LearningDashboard.init().then(() => {
    const widget = document.getElementById('learning-dashboard-widget');
    if (widget) {
      widget.innerHTML = LearningDashboard.renderWidget();
    }
  });
}
