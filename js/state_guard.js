// ============================================================
//  State Guard - Validates all required modules are loaded
//  Prevents runtime errors from missing dependencies
// ============================================================

const StateGuard = {
  required: [
    { name: 'AppState', required: false }, // May not be used in chat mode
    { name: 'RefEngine', required: false },
    { name: 'OddsEngine', required: false },
    { name: 'PicksEngine', required: false },
    { name: 'LearningEngine', required: false },
    { name: 'ChatUI', required: true }
  ],

  init() {
    const missing = [];
    const warnings = [];

    // Check required modules
    this.required.forEach(mod => {
      if (typeof window[mod.name] === 'undefined') {
        if (mod.required) {
          missing.push(mod.name);
        } else {
          warnings.push(mod.name);
        }
      }
    });

    // Log results
    if (missing.length > 0) {
      console.error('[StateGuard] ❌ CRITICAL: Missing required modules:', missing);
      this.showError(`Módulos críticos no cargaron: ${missing.join(', ')}`);
      return false;
    }

    if (warnings.length > 0) {
      console.warn('[StateGuard] ⚠️ Optional modules missing:', warnings);
    }

    console.log('[StateGuard] ✅ All required modules loaded');
    return true;
  },

  showError(message) {
    const appContent = document.getElementById('app-content');
    if (appContent) {
      appContent.innerHTML = `
        <div class="flex items-center justify-center min-h-[60vh] bg-slate-950">
          <div class="text-center space-y-4 max-w-md">
            <p class="text-3xl">❌</p>
            <p class="text-xl font-bold text-slate-100">Error de Carga</p>
            <p class="text-slate-400">${message}</p>
            <p class="text-sm text-slate-500">Los módulos requeridos no pudieron cargar correctamente.</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
              🔄 Recargar Página
            </button>
          </div>
        </div>
      `;
    }
  },

  safe(moduleName, fallbackFn) {
    const module = window[moduleName];
    if (typeof module === 'undefined') {
      console.warn(`[StateGuard] Module ${moduleName} not available, using fallback`);
      return fallbackFn || {};
    }
    return module;
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  StateGuard.init();
});
