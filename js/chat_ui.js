// ============================================================
//  Chat UI Component - IA-Zak Conversational Interface
//  Real-time chat with reasoning chains visible to user
// ============================================================

const ChatUI = {
  state: {
    messages: [],
    session_id: null,
    bankroll: null,
    language: 'es',
    isLoading: false
  },

  init(sessionId = null, bankroll = null, language = 'es') {
    this.state.session_id = sessionId || `session_${Date.now()}`;
    this.state.bankroll = bankroll;
    this.state.language = language;
    this.state.messages = [];

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

  renderChatContainer() {
    return `
    <div class="chat-container flex flex-col h-[500px] bg-slate-900 rounded-lg border border-slate-700">
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 mb-4">
        ${this.renderMessages()}
      </div>
      <div class="border-t border-slate-700 p-4">
        <div class="flex gap-3">
          <input id="chat-input" type="text" placeholder="¿Qué quieres analizar?"
            class="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-violet-500 outline-none"
            onkeypress="if(event.key==='Enter') ChatUI.sendMessage()" />
          <button onclick="ChatUI.sendMessage()" class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold transition-colors" id="chat-send-btn">
            📤
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
    let html = `<div class="flex justify-start mb-4"><div class="max-w-md bg-slate-800/50 border border-slate-700 rounded-lg p-4">`;

    if (msg.reasoning_chain && Array.isArray(msg.reasoning_chain)) {
      html += `<div class="mb-3 p-3 bg-slate-900/50 border-l-2 border-amber-500 rounded">
        <p class="text-xs font-bold text-amber-400 mb-2">🧠 Razonamiento:</p>
        <div class="space-y-1">`;
      msg.reasoning_chain.forEach(step => {
        html += `<div class="text-xs text-slate-300 leading-relaxed"><span class="text-amber-400">▸</span> ${this.escapeHtml(step)}</div>`;
      });
      html += `</div></div>`;
    }

    html += `<div class="text-sm text-slate-100 mb-3">${this.escapeHtml(msg.content || msg.response || 'Sin respuesta')}</div>`;

    if (msg.recommendations && Array.isArray(msg.recommendations)) {
      html += `<div class="mt-3 pt-3 border-t border-slate-700">
        <p class="text-xs font-bold text-emerald-400 mb-2">💡 Recomendaciones:</p>
        <div class="space-y-1">`;
      msg.recommendations.forEach(rec => {
        html += `<div class="text-xs text-slate-300">• ${this.escapeHtml(rec)}</div>`;
      });
      html += `</div></div>`;
    }

    if (msg.data_sources_used && Array.isArray(msg.data_sources_used)) {
      html += `<div class="mt-3 pt-2 text-[10px] text-slate-500">📊 Fuentes: ${msg.data_sources_used.join(', ')}</div>`;
    }

    if (msg.confidence) {
      html += `<div class="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-400">🎯 Confianza: <span class="text-yellow-400">${this.escapeHtml(msg.confidence)}</span></div>`;
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
      const data = await response.json();

      this.state.messages.push({
        role: 'assistant',
        content: data.response || data.message || 'Sin respuesta',
        reasoning_chain: data.reasoning_chain,
        recommendations: data.recommendations,
        kelly_calculations: data.kelly_calculations,
        data_sources_used: data.data_sources_used,
        confidence: data.confidence,
        bankroll_impact: data.bankroll_impact
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
