// ============================================================
//  PLAYER_ENGINE.JS — Motor de Datos de Jugadores para IA-Zak
//
//  Responsabilidades:
//  1. Fetchea /api/football para obtener stats actualizadas
//  2. Persiste en localStorage con TTL de 6 horas
//  3. Enriquece ZakAgent._playerDB con datos reales
//  4. Expone PlayerEngine.getProfile(name, team) como interfaz
//     unificada (real → demo fallback si no disponible)
// ============================================================

'use strict';

const PlayerEngine = (() => {

  const CACHE_KEY = 'pe_players_v2';
  const CACHE_TTL = 6 * 3600 * 1000; // 6 horas en ms
  const API_BASE  = '/api/football';

  // ── Caché local ────────────────────────────────────────────
  let _cache = (() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
    catch { return {}; }
  })();

  function _saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(_cache)); } catch {}
  }

  // ── Estado ─────────────────────────────────────────────────
  const _state = {
    initialized: false,
    source: 'pending',      // 'api-football' | 'db_cache' | 'local'
    lastFetch: null,
    fetchQueue: new Set(),  // teams currently being fetched
  };

  // ────────────────────────────────────────────────────────────
  //  INICIALIZACIÓN — precarga los jugadores del torneo
  // ────────────────────────────────────────────────────────────
  async function init() {
    if (_state.initialized) return;
    _state.initialized = true;

    // Carga los datos locales del fallback primero (disponible inmediatamente)
    try {
      const res  = await fetch(`${API_BASE}?action=players`);
      const json = await res.json();
      if (json.ok && json.data?.length) {
        _ingestPlayers(json.data);
        _state.source = json.source;
        _state.lastFetch = Date.now();
        console.log(`[PlayerEngine] Loaded ${json.data.length} players from ${json.source}`);
      }
    } catch (e) {
      console.warn('[PlayerEngine] Init fetch failed, using local knowledge', e.message);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  FETCH por equipo (lazy, con TTL)
  // ────────────────────────────────────────────────────────────
  async function fetchTeam(teamKey) {
    const cKey = `team:${teamKey}`;
    const cached = _cache[cKey];

    // TTL check
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
      return cached.players;
    }

    // Evita fetches paralelos del mismo equipo
    if (_state.fetchQueue.has(teamKey)) return [];
    _state.fetchQueue.add(teamKey);

    try {
      const res  = await fetch(`${API_BASE}?action=players&team=${teamKey}`);
      const json = await res.json();
      const players = json.ok ? (json.data || []) : [];

      _cache[cKey] = { fetchedAt: Date.now(), players };
      _saveCache();
      _ingestPlayers(players);

      console.log(`[PlayerEngine] Fetched ${players.length} players for ${teamKey} (${json.source})`);
      return players;
    } catch (e) {
      console.warn(`[PlayerEngine] fetchTeam(${teamKey}) failed:`, e.message);
      return [];
    } finally {
      _state.fetchQueue.delete(teamKey);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Ingestar array de players en el mapa interno
  // ────────────────────────────────────────────────────────────
  function _ingestPlayers(players) {
    for (const p of players) {
      const name = p.player_name || p.name;
      if (!name) continue;
      const key = _normalizeKey(name);
      _cache[`player:${key}`] = {
        fetchedAt: Date.now(),
        data: {
          name,
          team:            p.team_key || p.team || '?',
          goals:           p.goals           || 0,
          assists:         p.assists          || 0,
          games:           p.games            || 0,
          yellowCards:     p.yellow_cards     || 0,
          redCards:        p.red_cards        || 0,
          shotsTotal:      p.shots_total      || 0,
          shotsOn:         p.shots_on         || 0,
          goalsPerGame:    +p.goals_per_game  || 0,
          assistsPerGame:  +p.assists_per_game|| 0,
          cardsPerGame:    +p.cards_per_game  || 0,
          shotsPerGame:    +p.shots_per_game  || 0,
          xgPerGame:       +p.xg_per_game     || 0,
          source:          p.source           || 'local',
        },
      };
    }
    _saveCache();
  }

  // ────────────────────────────────────────────────────────────
  //  INTERFAZ PÚBLICA: getProfile
  // ────────────────────────────────────────────────────────────
  /**
   * Devuelve el perfil de stats de un jugador.
   * Prioridad: cache local → ZAK_KNOWLEDGE → demo generado
   */
  function getProfile(playerName, teamKey) {
    const key = _normalizeKey(playerName);

    // 1. Cache del PlayerEngine
    const cached = _cache[`player:${key}`];
    if (cached?.data) return { ...cached.data, _source: 'player_engine' };

    // 2. ZAK_KNOWLEDGE (stats 2024-25 consolidadas)
    if (typeof ZAK_KNOWLEDGE !== 'undefined') {
      const zkData = ZAK_KNOWLEDGE.getPlayer(playerName);
      if (zkData) {
        return {
          name:           playerName,
          team:           teamKey || zkData.team,
          goals:          zkData.goalsAllComps      || 0,
          assists:        zkData.assistsAllComps     || 0,
          games:          zkData.gamesAllComps       || 0,
          goalsPerGame:   zkData.goalsPerGame        || 0,
          assistsPerGame: zkData.assistsPerGame      || 0,
          cardsPerGame:   zkData.yellowCardsPerGame  || 0,
          shotsPerGame:   zkData.shotsPerGame        || 0,
          xgPerGame:      zkData.xGPerGame           || 0,
          internationalGoals: zkData.internationalGoals || 0,
          worldCupGoals:  zkData.worldCupGoals       || 0,
          worldCupBehavior: zkData.worldCupBehavior  || '',
          strengths:      zkData.strengths           || [],
          riskNotes:      zkData.riskNotes           || '',
          _source: 'zak_knowledge',
        };
      }
    }

    // 3. ZakAgent demo fallback
    if (typeof ZakAgent !== 'undefined' && ZakAgent.getPlayerProfile) {
      return { ...ZakAgent.getPlayerProfile(playerName, teamKey), _source: 'zak_demo' };
    }

    // 4. Generic fallback
    return {
      name: playerName, team: teamKey || '?',
      goalsPerGame: 0.18, assistsPerGame: 0.12,
      cardsPerGame: 0.16, shotsPerGame: 1.2, xgPerGame: 0.14,
      _source: 'generic_fallback',
    };
  }

  // ────────────────────────────────────────────────────────────
  //  getSquad — devuelve lista de jugadores de un equipo
  // ────────────────────────────────────────────────────────────
  function getSquad(teamKey) {
    const players = [];
    for (const [k, v] of Object.entries(_cache)) {
      if (k.startsWith('player:') && v.data?.team === teamKey) {
        players.push(v.data);
      }
    }
    // Si no hay en caché, dispara fetch en background
    if (players.length === 0) {
      fetchTeam(teamKey).catch(() => {});
    }
    return players;
  }

  // ────────────────────────────────────────────────────────────
  //  getTopScorer — el mejor goleador de un equipo
  // ────────────────────────────────────────────────────────────
  function getTopScorer(teamKey) {
    const squad = getSquad(teamKey);
    if (squad.length === 0) return null;
    return squad.reduce((best, p) =>
      (p.goalsPerGame || 0) > (best.goalsPerGame || 0) ? p : best
    , squad[0]);
  }

  // ────────────────────────────────────────────────────────────
  //  renderPlayerCard — HTML card para el perfil de jugador
  // ────────────────────────────────────────────────────────────
  function renderPlayerCard(playerName, teamKey) {
    const p = getProfile(playerName, teamKey);
    const sourceLabel = {
      'player_engine': '🌐 API en vivo',
      'zak_knowledge': '📚 Base 2024-25',
      'zak_demo':      '🤖 Demo generado',
      'db_cache':      '💾 DB Cache',
      'generic_fallback': '⚠️ Estimado',
    }[p._source] || '📊 Stats';

    const statBar = (val, max, color = 'var(--amber)') =>
      `<div style="height:3px;border-radius:2px;background:var(--border);margin-top:3px;">
        <div style="height:3px;border-radius:2px;width:${Math.min(100, (val/max)*100).toFixed(0)}%;background:${color};transition:width 0.5s;"></div>
       </div>`;

    return `
      <div class="card p-4 space-y-3 player-card" data-player="${playerName}">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-bold text-white">${p.name}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${p.team} · ${p.games || '—'} partidos</p>
          </div>
          <span class="text-[9px] px-2 py-0.5 rounded-full border border-white/10 text-slate-500">${sourceLabel}</span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="bg-black/20 rounded-lg p-2.5">
            <p class="text-slate-500 text-[10px]">Goles/partido</p>
            <p class="font-black text-emerald-400">${(p.goalsPerGame||0).toFixed(2)}</p>
            ${statBar(p.goalsPerGame||0, 1.0, 'var(--green)')}
          </div>
          <div class="bg-black/20 rounded-lg p-2.5">
            <p class="text-slate-500 text-[10px]">Asistencias/partido</p>
            <p class="font-black text-blue-400">${(p.assistsPerGame||0).toFixed(2)}</p>
            ${statBar(p.assistsPerGame||0, 0.7, 'var(--blue)')}
          </div>
          <div class="bg-black/20 rounded-lg p-2.5">
            <p class="text-slate-500 text-[10px]">Disparos/partido</p>
            <p class="font-black text-amber-400">${(p.shotsPerGame||0).toFixed(1)}</p>
            ${statBar(p.shotsPerGame||0, 5.0, 'var(--amber)')}
          </div>
          <div class="bg-black/20 rounded-lg p-2.5">
            <p class="text-slate-500 text-[10px]">Tarjetas/partido</p>
            <p class="font-black text-red-400">${(p.cardsPerGame||0).toFixed(2)}</p>
            ${statBar(p.cardsPerGame||0, 0.5, 'var(--red)')}
          </div>
        </div>

        ${p.xgPerGame ? `
        <div class="flex items-center gap-2 text-xs">
          <span class="text-slate-500">xG/partido:</span>
          <span class="text-violet-400 font-bold">${p.xgPerGame.toFixed(2)}</span>
          <span class="text-slate-600 text-[10px]">(rendimiento vs expectativa: ${p.goalsPerGame > p.xgPerGame ? '🟢 supera' : '🔴 por debajo'})</span>
        </div>` : ''}

        ${p.worldCupBehavior ? `
        <p class="text-[11px] text-slate-500 border-t border-white/5 pt-2 leading-relaxed">
          🏆 ${p.worldCupBehavior}
        </p>` : ''}

        ${p.riskNotes ? `
        <p class="text-[11px] text-amber-500/80 leading-relaxed">⚡ ${p.riskNotes}</p>
        ` : ''}
      </div>
    `;
  }

  // ────────────────────────────────────────────────────────────
  //  getStatus — info del estado del motor
  // ────────────────────────────────────────────────────────────
  function getStatus() {
    const playerCount = Object.keys(_cache).filter(k => k.startsWith('player:')).length;
    return {
      initialized: _state.initialized,
      source: _state.source,
      lastFetch: _state.lastFetch,
      cachedPlayers: playerCount,
    };
  }

  // ── Helpers ────────────────────────────────────────────────
  function _normalizeKey(name) {
    return name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove accents
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  // ── Auto-init al cargar (non-blocking) ────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().catch(console.warn));
  } else {
    setTimeout(() => init().catch(console.warn), 200);
  }

  // ── API pública ───────────────────────────────────────────
  return {
    init,
    fetchTeam,
    getProfile,
    getSquad,
    getTopScorer,
    renderPlayerCard,
    getStatus,
  };

})();

// Exponer globalmente
window.PlayerEngine = PlayerEngine;
