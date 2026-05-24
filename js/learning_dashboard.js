// ============================================================
//  Learning Dashboard - IA-Zak Performance Metrics
//  Shows accuracy, Brier scores, sharp markets, and blend weights
// ============================================================

const LearningDashboard = {
  state: {
    metrics: null,
    loading: false,
    lastUpdate: null
  },

  async init() {
    this.state.loading = true;
    try {
      const response = await fetch('/api/learning-stats');
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      this.state.metrics = await response.json();
      this.state.lastUpdate = new Date();
    } catch (error) {
      console.error('[LearningDashboard] Error:', error);
      this.state.metrics = null;
    } finally {
      this.state.loading = false;
    }
  },

  renderWidget() {
    if (this.state.loading) {
      return `<div class="p-4 text-center text-slate-400">Cargando métricas...</div>`;
    }

    if (!this.state.metrics) {
      return `<div class="p-4 text-center text-slate-500 text-sm">Sin datos disponibles. Ejecuta predicciones primero.</div>`;
    }

    const m = this.state.metrics;
    return `
    <div class="card p-5 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">📊</span>
          <div>
            <p class="text-sm font-bold text-white">Métricas de Aprendizaje</p>
            <p class="text-[10px] text-slate-500">Últimas 30 días</p>
          </div>
        </div>
        <button onclick="LearningDashboard.init()" class="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 text-slate-400 hover:text-white transition-colors">
          🔄 Actualizar
        </button>
      </div>

      <!-- Overall Accuracy -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <p class="text-[10px] text-slate-500 font-bold mb-2">ACCURACY GENERAL</p>
          <p class="text-2xl font-black text-emerald-400">${(m.overall_accuracy * 100).toFixed(1)}%</p>
          <p class="text-[9px] text-slate-600 mt-1">${m.total_predictions} predicciones</p>
        </div>

        <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <p class="text-[10px] text-slate-500 font-bold mb-2">BRIER SCORE</p>
          <p class="text-2xl font-black ${m.avg_brier < 0.25 ? 'text-emerald-400' : 'text-amber-400'}">${m.avg_brier.toFixed(3)}</p>
          <p class="text-[9px] text-slate-600 mt-1">${m.avg_brier < 0.25 ? '✓ Bueno' : 'Mejorable'}</p>
        </div>

        <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <p class="text-[10px] text-slate-500 font-bold mb-2">ROI (TEÓRICO)</p>
          <p class="text-2xl font-black text-blue-400">${m.roi_pct.toFixed(1)}%</p>
          <p class="text-[9px] text-slate-600 mt-1">Edge promedio</p>
        </div>
      </div>

      <!-- Accuracy by Market -->
      <div>
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Precisión por Mercado</p>
        <div class="space-y-2">
          ${m.by_market.map(market => `
            <div class="flex items-center gap-3">
              <div class="flex-1">
                <div class="flex justify-between items-center mb-1">
                  <p class="text-sm text-slate-300">${market.name}</p>
                  <p class="text-xs font-bold ${market.accuracy > 0.55 ? 'text-emerald-400' : market.accuracy < 0.45 ? 'text-red-400' : 'text-yellow-400'}">${(market.accuracy * 100).toFixed(0)}%</p>
                </div>
                <div class="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div class="h-full ${market.accuracy > 0.55 ? 'bg-emerald-500' : market.accuracy < 0.45 ? 'bg-red-500' : 'bg-yellow-500'}" style="width: ${market.accuracy * 100}%"></div>
                </div>
              </div>
              <span class="text-[9px] text-slate-600 w-12 text-right">${market.count} pred.</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Source Weights -->
      <div>
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pesos de Fuentes (Blend)</p>
        <div class="space-y-2">
          ${Object.entries(m.source_weights || {}).map(([source, weight]) => `
            <div class="flex items-center gap-2">
              <div class="w-24 text-xs text-slate-400">${source === 'fbref_form' ? 'FBREF Form' : source === 'understat_xg' ? 'Understat xG' : 'Transfermarkt'}</div>
              <div class="flex-1 h-6 bg-slate-700/50 rounded-lg overflow-hidden">
                <div class="h-full bg-gradient-to-r from-violet-500 to-violet-600" style="width: ${weight * 100}%"></div>
              </div>
              <div class="w-12 text-right text-xs font-bold text-violet-300">${(weight * 100).toFixed(0)}%</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Sharp Markets (Accuracy > 55%) -->
      ${m.sharp_markets && m.sharp_markets.length > 0 ? `
      <div class="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4">
        <p class="text-xs font-bold text-emerald-400 mb-2">✅ MERCADOS SHARP (>55%)</p>
        <div class="space-y-1 text-[11px]">
          ${m.sharp_markets.map(market => `
            <div class="flex justify-between">
              <span class="text-slate-300">${market.name}</span>
              <span class="text-emerald-400">${market.accuracy.toFixed(1)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Weak Markets (Accuracy < 45%) -->
      ${m.weak_markets && m.weak_markets.length > 0 ? `
      <div class="bg-red-900/20 border border-red-700/40 rounded-lg p-4">
        <p class="text-xs font-bold text-red-400 mb-2">⚠️ MERCADOS DÉBILES (<45%)</p>
        <div class="space-y-1 text-[11px]">
          ${m.weak_markets.map(market => `
            <div class="flex justify-between">
              <span class="text-slate-300">${market.name}</span>
              <span class="text-red-400">${market.accuracy.toFixed(1)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Last Update -->
      <div class="text-[10px] text-slate-600 border-t border-slate-700/50 pt-3">
        Última actualización: ${m.last_update ? new Date(m.last_update).toLocaleString('es-ES') : 'Nunca'}
      </div>
    </div>
    `;
  },

  // Render inline stats for compact display
  renderMini() {
    if (!this.state.metrics) return '';

    const m = this.state.metrics;
    return `
    <div class="flex gap-2 text-xs">
      <span class="px-2 py-1 rounded-lg bg-slate-800 text-emerald-400">📊 ${(m.overall_accuracy * 100).toFixed(0)}%</span>
      <span class="px-2 py-1 rounded-lg bg-slate-800 text-blue-400">🎲 ${m.roi_pct.toFixed(1)}% ROI</span>
      <span class="px-2 py-1 rounded-lg bg-slate-800 text-slate-400">🎯 ${m.total_predictions} bets</span>
    </div>
    `;
  }
};
