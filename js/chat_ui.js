// ============================================================
//  Chat UI Component - IA-Zak Conversational Interface
//  Real-time chat with reasoning chains + voice input
// ============================================================

const ChatUI = {
  state: {
    messages: [],
    session_id: null,
    bankroll: null,
    language: 'es',
    isLoading: false,
    isListening: false,
    recognition: null
  },

  init(sessionId = null, bankroll = null, language = 'es') {
    this.state.session_id = sessionId || `session_${Date.now()}`;
    this.state.bankroll = bankroll;
    this.state.language = language;
    this.state.messages = [];

    // Initialize Web Speech API for voice input
    this.initVoiceRecognition();

    // Safely load saved chat history
    try {
      const saved = localStorage.getItem(`chat_${this.state.session_id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate it's an array and not too large
        if (Array.isArray(parsed) && parsed.length < 1000) {
          this.state.messages = parsed;
        } else {
          console.warn('[ChatUI] Loaded chat data exceeds size limit or is invalid');
          localStorage.removeItem(`chat_${this.state.session_id}`);
        }
      }
    } catch (err) {
      console.error('[ChatUI] Failed to load saved chat:', err);
      localStorage.removeItem(`chat_${this.state.session_id}`);
    }

    return this.state.session_id;
  },

  initVoiceRecognition() {
    // Use Web Speech API for voice recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.state.recognition = new SpeechRecognition();
      this.state.recognition.continuous = false;
      this.state.recognition.interimResults = true;
      this.state.recognition.lang = this.state.language === 'es' ? 'es-ES' : 'en-US';

      this.state.recognition.onstart = () => {
        this.state.isListening = true;
        const btn = document.getElementById('voice-btn');
        if (btn) {
          btn.classList.add('bg-red-600', 'animate-pulse');
          btn.classList.remove('bg-slate-700');
          btn.textContent = '🎤 Escuchando...';
        }
      };

      this.state.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        const input = document.getElementById('chat-input');
        if (input) {
          input.value = finalTranscript || interimTranscript;
        }
      };

      this.state.recognition.onend = () => {
        this.state.isListening = false;
        const btn = document.getElementById('voice-btn');
        if (btn) {
          btn.classList.remove('bg-red-600', 'animate-pulse');
          btn.classList.add('bg-slate-700');
          btn.textContent = '🎤';
        }
      };

      this.state.recognition.onerror = (event) => {
        console.error('[ChatUI] Speech recognition error:', event.error);
        const input = document.getElementById('chat-input');
        if (input) {
          input.placeholder = `Error: ${event.error}`;
        }
      };
    }
  },

  toggleVoiceInput() {
    if (!this.state.recognition) {
      console.warn('[ChatUI] Speech Recognition not available');
      return;
    }

    if (this.state.isListening) {
      this.state.recognition.stop();
    } else {
      // Clear input before starting
      const input = document.getElementById('chat-input');
      if (input) input.value = '';
      this.state.recognition.start();
    }
  },

  renderChatContainer() {
    return `
    <div class="chat-container flex flex-col bg-slate-900 rounded-xl border border-slate-700/60 shadow-2xl" style="min-height:520px; max-height:80vh;">
      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-800/60 rounded-t-xl">
        <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        <span class="text-xs font-bold text-slate-300 tracking-wide uppercase">IA-Zak v8.0</span>
        <span class="text-[10px] text-slate-500">· Especialista en Apuestas</span>
      </div>
      <!-- Messages -->
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4" style="min-height:380px;">
        ${this.renderMessages()}
      </div>
      <!-- Input -->
      <div class="border-t border-slate-700/60 p-3 bg-slate-800/40 rounded-b-xl">
        <div class="flex gap-2">
          <input id="chat-input" type="text"
            placeholder="Ej: ¿Apuestas para Argentina vs Colombia?"
            class="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm border border-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none placeholder-slate-500"
            onkeypress="if(event.key==='Enter') ChatUI.sendMessage()" />
          <button id="voice-btn" onclick="ChatUI.toggleVoiceInput()"
            class="px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
            title="Voz">🎤</button>
          <button onclick="ChatUI.sendMessage()"
            class="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors flex items-center gap-1.5"
            id="chat-send-btn">
            <span>Analizar</span><span>⚡</span>
          </button>
        </div>
      </div>
    </div>
    `;
  },

  renderMessages() {
    return this.state.messages.map(msg => {
      if (msg.role === 'user') return this.renderUserMessage(msg.content);
      return this.renderAssistantMessage(msg);
    }).join('');
  },

  renderUserMessage(content) {
    return `<div class="flex justify-end mb-4">
      <div class="max-w-xs bg-violet-600/20 border border-violet-500/30 rounded-lg p-3">
        <p class="text-sm text-slate-100">${this.escapeHtml(content)}</p>
      </div>
    </div>`;
  },

  renderAssistantMessage(msg) {
    const confColor = { high: 'text-emerald-400', medium: 'text-yellow-400', low: 'text-red-400' };
    const confBadge = msg.confidence
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 ${confColor[msg.confidence] || 'text-slate-400'}">🎯 ${msg.confidence.toUpperCase()}</span>`
      : '';

    let html = `<div class="flex justify-start mb-4">
      <div class="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 shadow-lg">`;

    // Reasoning chain (collapsible feel)
    if (msg.reasoning_chain && Array.isArray(msg.reasoning_chain) && msg.reasoning_chain.length > 0) {
      html += `<div class="mb-3 p-3 bg-slate-900/70 border-l-2 border-amber-500/70 rounded-lg">
        <p class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">🧠 Razonamiento</p>
        <div class="space-y-1">`;
      msg.reasoning_chain.forEach(step => {
        html += `<div class="text-[11px] text-slate-400 leading-relaxed">
          <span class="text-amber-500 mr-1">▸</span>${this.escapeHtml(step)}
        </div>`;
      });
      html += `</div></div>`;
    }

    // Main response text + confidence badge
    html += `<div class="flex items-start justify-between gap-2 mb-3">
      <p class="text-sm text-slate-100 leading-relaxed flex-1">${this.escapeHtml(msg.content || msg.response || 'Sin respuesta')}</p>
      ${confBadge}
    </div>`;

    // MATCH SCENARIOS (penales + prórroga)
    if (msg.match_scenarios) {
      html += this.renderMatchScenarios(msg.match_scenarios);
    }

    // INJURY ALERT
    if (msg.injury_alert && msg.injury_alert !== 'null' && msg.injury_alert !== null) {
      html += `<div class="mt-2 mb-3 px-3 py-2 bg-amber-900/20 border border-amber-600/30 rounded-lg">
        <p class="text-[11px] text-amber-400">⚠️ ${this.escapeHtml(msg.injury_alert)}</p>
      </div>`;
    }

    // TACTICAL ADJUSTMENTS
    if (msg.tactical_adjustments) {
      const ta = msg.tactical_adjustments;
      if (ta.home !== '0%' || ta.away !== '0%') {
        html += `<div class="mt-1 mb-2 flex gap-3 text-[10px] text-slate-500">
          <span>⚙️ Ajuste táctico local: <strong class="text-slate-300">${this.escapeHtml(String(ta.home || '0%'))}</strong></span>
          <span>Visitante: <strong class="text-slate-300">${this.escapeHtml(String(ta.away || '0%'))}</strong></span>
        </div>`;
      }
    }

    // PARLAYS GRID (main UI feature)
    if (msg.recommended_parlays && Array.isArray(msg.recommended_parlays) && msg.recommended_parlays.length > 0) {
      html += this.renderParlaysGrid(msg.recommended_parlays);
    }

    // Quick recommendations
    if (msg.recommendations && Array.isArray(msg.recommendations) && msg.recommendations.length > 0) {
      html += `<div class="mt-3 pt-3 border-t border-slate-700/40">
        <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">💡 Picks Rápidos</p>
        <div class="space-y-1">`;
      msg.recommendations.forEach(rec => {
        html += `<div class="text-xs text-slate-300">• ${this.escapeHtml(rec)}</div>`;
      });
      html += `</div></div>`;
    }

    // Footer: sources
    if (msg.data_sources_used && Array.isArray(msg.data_sources_used) && msg.data_sources_used.length > 0) {
      html += `<div class="mt-3 pt-2 border-t border-slate-700/30 text-[10px] text-slate-500">
        📊 Fuentes: ${msg.data_sources_used.map(s => this.escapeHtml(s)).join(' · ')}
      </div>`;
    }

    html += `</div></div>`;
    return html;
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    this.state.messages.push({ role: 'user', content: message });
    this.renderMessagesArea();
    input.value = '';
    this.setLoading(true);

    try {
      let data;
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            session_id: this.state.session_id,
            language: this.state.language,
            bankroll: this.state.bankroll
          })
        });

        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        data = await response.json();
      } catch (chatError) {
        console.warn('[chatUI] Main chat endpoint failed, trying simple endpoint:', chatError.message);
        // Fallback to simple chat endpoint
        const response = await fetch('/api/chat_simple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            session_id: this.state.session_id,
            language: this.state.language
          })
        });
        if (!response.ok) throw new Error(`Fallback error: ${response.statusText}`);
        data = await response.json();
      }

      this.state.messages.push({
        role: 'assistant',
        content: data.response || data.message || 'Sin respuesta',
        reasoning_chain: data.reasoning_chain,
        recommendations: data.recommendations,
        recommended_parlays: data.recommended_parlays,
        kelly_calculations: data.kelly_calculations,
        data_sources_used: data.data_sources_used,
        confidence: data.confidence,
        bankroll_impact: data.bankroll_impact,
        // Nuevos campos v10.0
        match_scenarios: data.match_scenarios,
        injury_alert: data.injury_alert,
        tactical_adjustments: data.tactical_adjustments
      });

      this.renderMessagesArea();

      // Safely save to localStorage
      try {
        localStorage.setItem(`chat_${this.state.session_id}`, JSON.stringify(this.state.messages));
      } catch (storageError) {
        console.error('[ChatUI] Failed to save chat history:', storageError);
        if (storageError.name === 'QuotaExceededError') {
          // Storage quota exceeded - delete old messages
          this.state.messages = this.state.messages.slice(-50);
          try {
            localStorage.setItem(`chat_${this.state.session_id}`, JSON.stringify(this.state.messages));
          } catch (retryError) {
            console.error('[ChatUI] Failed to save even after cleanup');
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      // Evitar duplicar "Error:" si ya está en el mensaje
      let errorMsg = error.message;
      if (!errorMsg.startsWith('Error:')) {
        errorMsg = `Error: ${errorMsg}`;
      }
      this.state.messages.push({
        role: 'assistant',
        content: errorMsg
      });
      this.renderMessagesArea();
    } finally {
      this.setLoading(false);
    }
  },

  renderMessagesArea() {
    const messagesDiv = document.getElementById('chat-messages');
    if (messagesDiv) {
      messagesDiv.innerHTML = this.renderMessages();
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  },

  setLoading(loading) {
    this.state.isLoading = loading;
    const btn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    if (btn) btn.disabled = loading;
    if (input) input.disabled = loading;
  },

  renderMatchScenarios(scenarios) {
    if (!scenarios) return '';
    const s = scenarios;

    const bar = (pct, color) => {
      const width = Math.max(4, Math.min(100, pct || 0));
      return `<div class="flex-1 bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
        <div class="h-full rounded-full ${color}" style="width:${width}%"></div>
      </div>`;
    };

    const hasPenalties = (s.penalties_prob || 0) > 0;

    return `
    <div class="mt-3 mb-3 rounded-lg overflow-hidden border border-slate-700/40" style="background:rgba(15,23,42,0.5)">
      <div class="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
        <span class="text-xs">⚽</span>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Escenarios del Partido</p>
      </div>
      <div class="p-3 space-y-2">

        <!-- 90 minutos -->
        <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">90 Minutos</p>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-300 w-28">Local gana</span>
          ${bar(s.home_win_90, 'bg-emerald-500')}
          <span class="text-[11px] font-bold text-emerald-400 w-8 text-right">${s.home_win_90 || '—'}%</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-300 w-28">Empate</span>
          ${bar(s.draw_90, 'bg-amber-500')}
          <span class="text-[11px] font-bold text-amber-400 w-8 text-right">${s.draw_90 || '—'}%</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-300 w-28">Visitante gana</span>
          ${bar(s.away_win_90, 'bg-blue-500')}
          <span class="text-[11px] font-bold text-blue-400 w-8 text-right">${s.away_win_90 || '—'}%</span>
        </div>

        ${hasPenalties ? `
        <!-- Prórroga + Penales -->
        <div class="pt-2 mt-1 border-t border-slate-700/30">
          <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Si llega a Penales (${s.penalties_prob || 0}% prob.)</p>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2 text-center">
              <p class="text-[9px] text-slate-400 mb-0.5">Local gana en penales</p>
              <p class="text-sm font-black text-emerald-400">${s.home_wins_penalties || '—'}%</p>
              <p class="text-[9px] text-emerald-600">(${s.home_penalty_advantage || 50}% ventaja)</p>
            </div>
            <div class="bg-blue-900/20 border border-blue-700/30 rounded-lg p-2 text-center">
              <p class="text-[9px] text-slate-400 mb-0.5">Visitante gana en penales</p>
              <p class="text-sm font-black text-blue-400">${s.away_wins_penalties || '—'}%</p>
              <p class="text-[9px] text-blue-600">(${s.away_penalty_advantage || 50}% ventaja)</p>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  },

  renderParlaysGrid(parlays) {
    const profileMeta = {
      'conservative': { borderColor: '#10b981', labelColor: '#34d399', icon: '🟢', label: 'CONSERVADORA' },
      'moderate':     { borderColor: '#f59e0b', labelColor: '#fbbf24', icon: '🟡', label: 'MODERADA' },
      'aggressive':   { borderColor: '#ef4444', labelColor: '#f87171', icon: '🔴', label: 'AGRESIVA' },
      'very_aggressive': { borderColor: '#dc2626', labelColor: '#fca5a5', icon: '🔥', label: 'MUY AGRESIVA' },
      'community_pick': { borderColor: '#3b82f6', labelColor: '#93c5fd', icon: '👥', label: 'CONSENSO' }
    };

    // Normalize profile aliases (bajo/medio/alto → conservative/moderate/aggressive)
    const profileAliases = { bajo: 'conservative', medio: 'moderate', alto: 'aggressive', moderada: 'moderate', conservadora: 'conservative', agresiva: 'aggressive' };
    const normalizeParlays = parlays.map((p, i) => {
      const rawProfile = (p.risk_profile || '').toLowerCase();
      return { ...p, risk_profile: profileAliases[rawProfile] || p.risk_profile || ['conservative','moderate','aggressive','very_aggressive','community_pick'][i] || 'conservative' };
    });

    // Show first 3 main profiles + extra button to expand
    const topParlays = normalizeParlays.slice(0, 3);
    const extraCount = normalizeParlays.length - 3;

    let gridHtml = `
    <div class="mt-4">
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">⚡ Opciones de Apuesta</p>
      <div class="grid grid-cols-1 gap-2.5">`;

    topParlays.forEach((parlay) => {
      const profile = parlay.risk_profile || 'conservative';
      const meta = profileMeta[profile] || profileMeta.conservative;

      const stake    = parlay.bankroll_amount_colones || 0;
      const win      = parlay.expected_win_colones || 0;
      const kelly    = parlay.kelly_percentage || 0;
      const ror      = typeof parlay.risk_of_ruin_percent === 'number' ? parlay.risk_of_ruin_percent : 0;
      const odds     = parlay.combined_odds || 0;
      const prob     = parlay.combined_probability || 0;
      const events   = parlay.events || [];
      const reason   = parlay.detailed_reasoning || parlay.reasoning || '';

      // Strip team prefix from name for cleaner display
      const shortName = (parlay.name || meta.label).replace(/^[^-]+-\s*/, '');

      gridHtml += `
      <div class="rounded-lg overflow-hidden border" style="border-color: ${meta.borderColor}30; background: ${meta.borderColor}08;">
        <!-- Card header -->
        <div class="flex items-center justify-between px-3 py-2" style="background: ${meta.borderColor}18; border-bottom: 1px solid ${meta.borderColor}25;">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">${meta.icon}</span>
            <span class="text-[10px] font-black tracking-widest" style="color: ${meta.labelColor}">${meta.label}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-400">Kelly</span>
            <span class="text-[11px] font-bold text-amber-400">${typeof kelly === 'number' ? kelly.toFixed(1) : kelly}%</span>
            <span class="text-[10px] text-slate-500">RoR</span>
            <span class="text-[11px] font-bold text-red-400">${typeof ror === 'number' ? ror.toFixed(2) : ror}%</span>
          </div>
        </div>

        <!-- Events list -->
        ${events.length > 0 ? `
        <div class="px-3 pt-2 pb-1 space-y-0.5">
          ${events.slice(0, 3).map(evt => {
            const evtOdds = evt.odds || evt.your_probability || '';
            const evtPred = evt.prediction || '';
            const evtMarket = evt.market || '';
            return `<div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-400">${evtMarket}</span>
              <span class="font-semibold text-slate-200">${evtPred} <span class="text-slate-500">(${evtOdds}x)</span></span>
            </div>`;
          }).join('')}
        </div>
        ` : (shortName ? `<div class="px-3 pt-2 text-xs text-slate-300">${shortName}</div>` : '')}

        <!-- Financials row -->
        <div class="grid grid-cols-4 gap-0 px-3 py-2 mt-1" style="border-top: 1px solid ${meta.borderColor}20;">
          <div class="text-center">
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Prob.</p>
            <p class="font-bold text-xs text-slate-200">${prob > 0 ? Math.round(prob * 100) + '%' : '—'}</p>
          </div>
          <div class="text-center">
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Cuota</p>
            <p class="font-bold text-xs text-slate-200">${odds > 0 ? (typeof odds === 'number' ? odds.toFixed(2) : odds) : '—'}</p>
          </div>
          <div class="text-center">
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Apostar</p>
            <p class="font-bold text-xs" style="color: ${meta.labelColor}">₡${stake > 0 ? stake.toLocaleString('es-CR') : '—'}</p>
          </div>
          <div class="text-center">
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Ganancia</p>
            <p class="font-bold text-xs text-emerald-400">₡${win > 0 ? win.toLocaleString('es-CR') : '—'}</p>
          </div>
        </div>

        ${reason ? `
        <div class="px-3 pb-2">
          <p class="text-[10px] text-slate-500 italic leading-relaxed">${this.escapeHtml(reason)}</p>
        </div>` : ''}
      </div>`;
    });

    // Show extra parlays count if any
    if (extraCount > 0) {
      gridHtml += `
      <div class="text-center pt-1">
        <p class="text-[10px] text-slate-500">+${extraCount} opciones adicionales disponibles (Muy Agresiva, Consenso)</p>
      </div>`;
    }

    gridHtml += `</div></div>`;
    return gridHtml;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
