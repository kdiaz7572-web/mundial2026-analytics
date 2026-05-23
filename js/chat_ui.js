// ============================================================
//  Chat UI Component - IA-Zak v3.0
//  Renders chat interface with message list, input, and status bar
// ============================================================

export class ChatUI {
  constructor(containerId = 'chat-container') {
    this.container = document.getElementById(containerId);
    this.messageList = null;
    this.inputBox = null;
    this.sendButton = null;
    this.statusBar = null;
    this.sessionId = this.generateSessionId();
    this.language = 'es';
    this.bankroll = null;
    this.isLoading = false;

    this.init();
  }

  /**
   * Initialize chat UI structure
   */
  init() {
    this.container.innerHTML = `
      <div class="chat-wrapper" style="display: flex; flex-direction: column; height: 100vh; background: #f9f9f9;">

        <!-- Header with language selector -->
        <div class="chat-header" style="
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        ">
          <h2 style="margin: 0; font-size: 20px;">🤖 IA-Zak v3.0</h2>
          <select id="language-selector" style="
            padding: 8px 12px;
            border-radius: 6px;
            border: none;
            background: white;
            color: #333;
            cursor: pointer;
            font-weight: 500;
          ">
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>

        <!-- Status Bar -->
        <div class="chat-status-bar" style="
          padding: 12px 16px;
          background: #f0f0f0;
          display: flex;
          gap: 24px;
          font-size: 14px;
          border-bottom: 1px solid #ddd;
          flex-wrap: wrap;
        ">
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-weight: bold;">Bankroll:</span>
            <input type="number" id="bankroll-input" placeholder="€5000" style="
              width: 100px;
              padding: 4px 8px;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 13px;
            ">
          </div>
          <div id="win-rate-display" style="color: #666;">Win rate: —</div>
          <div id="recent-bets-display" style="color: #666;">Últimas apuestas: —</div>
        </div>

        <!-- Messages Container -->
        <div class="chat-messages" id="message-list" style="
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        "></div>

        <!-- Input Area -->
        <div class="chat-input-area" style="
          padding: 16px;
          background: white;
          border-top: 1px solid #ddd;
          display: flex;
          gap: 8px;
        ">
          <input
            type="text"
            id="chat-input"
            placeholder="Pregunta sobre cualquier partido..."
            style="
              flex: 1;
              padding: 12px;
              border: 1px solid #ddd;
              border-radius: 8px;
              font-size: 14px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
            "
          >
          <button id="send-button" style="
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            min-width: 100px;
            transition: opacity 0.2s;
          ">Enviar</button>
        </div>

        <!-- Typing Indicator -->
        <div id="typing-indicator" style="
          padding: 12px 16px;
          color: #999;
          font-size: 13px;
          display: none;
        ">
          <span>✏️ IA-Zak está escribiendo</span>
          <span class="typing-dots">.</span>
        </div>
      </div>
    `;

    this.messageList = document.getElementById('message-list');
    this.inputBox = document.getElementById('chat-input');
    this.sendButton = document.getElementById('send-button');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.languageSelector = document.getElementById('language-selector');
    this.bankrollInput = document.getElementById('bankroll-input');

    this.attachEventListeners();
    this.animateTypingDots();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.inputBox.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.languageSelector.addEventListener('change', (e) => {
      this.language = e.target.value;
      this.addSystemMessage(`🌐 Idioma cambiado a ${e.target.value === 'es' ? 'Español' : 'English'}`);
    });

    this.bankrollInput.addEventListener('change', () => {
      this.bankroll = parseFloat(this.bankrollInput.value) || null;
      if (this.bankroll) {
        this.addSystemMessage(`💰 Bankroll establecido: €${this.bankroll}`);
      }
    });
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send user message
   */
  async sendMessage() {
    const message = this.inputBox.value.trim();
    if (!message) return;

    // Validate bankroll is set
    if (!this.bankroll) {
      this.addSystemMessage('⚠️ Por favor, establece tu bankroll primero');
      return;
    }

    // Add user message to UI
    this.addMessage(message, 'user');
    this.inputBox.value = '';
    this.sendButton.disabled = true;
    this.isLoading = true;
    this.showTypingIndicator();

    try {
      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: this.sessionId,
          language: this.language,
          bankroll: this.bankroll
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Add IA-Zak response
      this.addMessage(data.response || 'No response', 'assistant');

      // Show tool calls if any
      if (data.tool_calls && data.tool_calls.length > 0) {
        this.showToolCalls(data.tool_calls);
      }

      // Show recommendations
      if (data.recommendations && data.recommendations.length > 0) {
        this.showRecommendations(data.recommendations);
      }

      // Show bankroll impact warning if significant
      if (data.bankroll_impact && data.bankroll_impact > 0.05) {
        this.addSystemMessage(`⚠️ Esta apuesta es el ${(data.bankroll_impact * 100).toFixed(1)}% de tu bankroll. Considera fractional Kelly.`);
      }

    } catch (error) {
      this.addMessage(`❌ Error: ${error.message}`, 'error');
    } finally {
      this.isLoading = false;
      this.hideTypingIndicator();
      this.sendButton.disabled = false;
      this.inputBox.focus();
    }
  }

  /**
   * Add message to chat
   */
  addMessage(text, type = 'assistant') {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;

    const bgColor = type === 'user' ? '#e3f2fd' : type === 'error' ? '#ffebee' : '#f5f5f5';
    const borderLeft = type === 'user' ? '4px solid #667eea' : type === 'error' ? '4px solid #f44336' : '4px solid #764ba2';
    const textColor = type === 'error' ? '#c62828' : '#333';

    messageEl.style.cssText = `
      padding: 12px 16px;
      background: ${bgColor};
      border-left: ${borderLeft};
      border-radius: 8px;
      word-wrap: break-word;
      color: ${textColor};
      line-height: 1.5;
      animation: slideIn 0.3s ease-out;
    `;

    // Parse markdown-like formatting (basic)
    let htmlText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 3px; font-family: monospace;">$1</code>')
      .replace(/\n/g, '<br>');

    messageEl.innerHTML = htmlText;
    this.messageList.appendChild(messageEl);
    this.scrollToBottom();
  }

  /**
   * Add system message (info/warning)
   */
  addSystemMessage(text) {
    this.addMessage(text, 'system');
  }

  /**
   * Show executed tool calls
   */
  showToolCalls(toolCalls) {
    const toolsEl = document.createElement('div');
    toolsEl.style.cssText = `
      padding: 12px 16px;
      background: #f5f5f5;
      border-left: 4px solid #ff9800;
      border-radius: 8px;
      margin-top: 8px;
      font-size: 13px;
      color: #666;
    `;

    let toolsHtml = '<strong>🔧 Herramientas ejecutadas:</strong><br>';
    toolCalls.forEach(tool => {
      const status = tool.error ? '❌' : '✅';
      toolsHtml += `${status} ${tool.name}`;
      if (tool.result && !tool.error) {
        toolsHtml += ` → ${JSON.stringify(tool.result).substring(0, 50)}...`;
      }
      toolsHtml += '<br>';
    });

    toolsEl.innerHTML = toolsHtml;
    this.messageList.appendChild(toolsEl);
    this.scrollToBottom();
  }

  /**
   * Show betting recommendations
   */
  showRecommendations(recommendations) {
    if (!recommendations.length) return;

    const recEl = document.createElement('div');
    recEl.style.cssText = `
      padding: 12px 16px;
      background: #e8f5e9;
      border-left: 4px solid #4caf50;
      border-radius: 8px;
      margin-top: 8px;
      font-size: 13px;
      color: #2e7d32;
    `;

    let recHtml = '<strong>💡 Recomendaciones:</strong><ul style="margin: 8px 0; padding-left: 20px;">';
    recommendations.forEach(rec => {
      recHtml += `<li>${rec}</li>`;
    });
    recHtml += '</ul>';

    recEl.innerHTML = recHtml;
    this.messageList.appendChild(recEl);
    this.scrollToBottom();
  }

  /**
   * Show/hide typing indicator
   */
  showTypingIndicator() {
    this.typingIndicator.style.display = 'block';
  }

  hideTypingIndicator() {
    this.typingIndicator.style.display = 'none';
  }

  /**
   * Animate typing dots
   */
  animateTypingDots() {
    const dots = document.querySelector('.typing-dots');
    if (!dots) return;

    setInterval(() => {
      const current = dots.textContent;
      dots.textContent = current === '.' ? '..' : current === '..' ? '...' : '.';
    }, 500);
  }

  /**
   * Scroll to bottom of message list
   */
  scrollToBottom() {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  /**
   * Update status bar with user stats
   */
  updateStatusBar(stats) {
    if (stats.winRate !== undefined) {
      const winRateEl = document.getElementById('win-rate-display');
      const color = stats.winRate >= 55 ? '#4caf50' : stats.winRate >= 50 ? '#ff9800' : '#f44336';
      winRateEl.innerHTML = `<span style="color: ${color}; font-weight: bold;">Win rate: ${stats.winRate}%</span>`;
    }

    if (stats.recentBets !== undefined) {
      document.getElementById('recent-bets-display').textContent = `Últimas apuestas: ${stats.recentBets}`;
    }
  }

  /**
   * Load conversation history
   */
  async loadHistory() {
    // TODO: Fetch from /api/conversation?session_id=<sessionId>
    // For now, start fresh each session
    this.addSystemMessage('🤖 IA-Zak iniciado. ¿Sobre qué partido quieres analizar?');
  }
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  #send-button:hover {
    opacity: 0.9;
  }

  #send-button:active {
    transform: scale(0.98);
  }

  #chat-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  @media (max-width: 768px) {
    .chat-status-bar {
      flex-direction: column;
      gap: 8px;
    }

    #send-button {
      min-width: 80px;
      padding: 8px 16px;
    }
  }
`;
document.head.appendChild(style);

export default ChatUI;
