// ============================================================
//  DB SYNC — Mundial 2026 Analytics
//  Bridges the frontend (localStorage) with the Vercel Postgres API.
//  Graceful degradation: if API is unreachable, falls back to localStorage.
// ============================================================

const DB_API = {
  BASE: '/api',

  // ── Is the API available? ────────────────────────────────
  _available: null,
  async isAvailable() {
    if (this._available !== null) return this._available;
    try {
      const r = await fetch(`${this.BASE}/stats`, { method: 'GET' });
      this._available = r.ok;
    } catch {
      this._available = false;
    }
    return this._available;
  },

  // ── BETS ────────────────────────────────────────────────

  async getBets() {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/bets`);
      const j = await r.json();
      return j.ok ? j.bets : null;
    } catch { return null; }
  },

  async saveBet(bet) {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bet),
      });
      const j = await r.json();
      return j.ok ? j.bet : null;
    } catch { return null; }
  },

  async updateBetResult(id, result) {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/bets?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const j = await r.json();
      return j.ok ? j.bet : null;
    } catch { return null; }
  },

  async deleteBet(id) {
    if (!(await this.isAvailable())) return false;
    try {
      const r = await fetch(`${this.BASE}/bets?id=${id}`, { method: 'DELETE' });
      const j = await r.json();
      return j.ok;
    } catch { return false; }
  },

  // ── FIXTURES ─────────────────────────────────────────────

  async saveFixture(fixture) {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/fixtures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixture),
      });
      const j = await r.json();
      return j.ok ? j.fixture : null;
    } catch { return null; }
  },

  async getFixtures() {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/fixtures`);
      const j = await r.json();
      return j.ok ? j.fixtures : null;
    } catch { return null; }
  },

  // ── PICKS CACHE ──────────────────────────────────────────

  async savePicks(homeKey, awayKey, picksJson, lambdas) {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeKey, awayKey, picksJson,
          lambdaHome: lambdas?.home,
          lambdaAway: lambdas?.away,
        }),
      });
      const j = await r.json();
      return j.ok ? j.pick : null;
    } catch { return null; }
  },

  // ── ZAK ANALYSIS LOG ─────────────────────────────────────

  async saveZakAnalysis(homeKey, awayKey, analysisResult) {
    if (!(await this.isAvailable())) return null;
    try {
      const topPick = analysisResult?.picks?.[0];
      const r = await fetch(`${this.BASE}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeKey,
          awayKey,
          picksJson:  analysisResult?.picks || [],
          lambdaHome: analysisResult?.matchData?.lambdaHome,
          lambdaAway: analysisResult?.matchData?.lambdaAway,
        }),
      });
      const j = await r.json();
      return j.ok ? j.pick : null;
    } catch { return null; }
  },

  // ── STATS ────────────────────────────────────────────────

  async getStats() {
    if (!(await this.isAvailable())) return null;
    try {
      const r = await fetch(`${this.BASE}/stats`);
      const j = await r.json();
      return j.ok ? j.stats : null;
    } catch { return null; }
  },

  // ── SYNC: pull DB bets into localStorage ─────────────────

  async syncBetsFromDB() {
    const dbBets = await this.getBets();
    if (!dbBets) return false;

    // Merge DB rows into the LOCAL STATE format
    const local = dbBets.map(b => ({
      id:            b.id,
      dbId:          b.id,
      team:          b.team,
      flag:          b.flag,
      market:        b.market,
      matchup:       b.matchup,
      odds:          parseFloat(b.odds),
      algoProb:      parseFloat(b.algo_prob || 0),
      impliedProb:   parseFloat(b.implied_prob || 0),
      edge:          parseFloat(b.edge || 0),
      stake:         parseFloat(b.stake || 0),
      totalReturn:   parseFloat(b.total_return || 0),
      netProfit:     parseFloat(b.net_profit || 0),
      result:        b.result,
      justification: b.justification,
      date:          b.created_at,
    }));

    // Update STATE and localStorage
    if (typeof STATE !== 'undefined') {
      STATE.bettingHistory = local;
      localStorage.setItem('mundial2026_bets', JSON.stringify(local));
    }
    return true;
  },
};

// ── Auto-sync on load ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const synced = await DB_API.syncBetsFromDB();
  if (synced) {
    console.info('[DB Sync] ✅ Historial sincronizado desde Vercel Postgres');
    // Re-render history tab if it's active
    if (typeof STATE !== 'undefined' && STATE.currentTab === 'historial') {
      if (typeof renderHistory === 'function') renderHistory();
    }
  } else {
    console.info('[DB Sync] 📦 Modo offline — usando localStorage');
  }
});

// ── Expose globally ─────────────────────────────────────────
window.DB_API = DB_API;
