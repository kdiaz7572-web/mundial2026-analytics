// ============================================================
//  Conversation Manager - Maintains session state & persistence
//  Handles localStorage caching, session recovery, and stats
// ============================================================

export class ConversationManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.messages = [];
    this.bankroll = null;
    this.accuracy = {
      total_predictions: 0,
      wins: 0,
      losses: 0,
      win_rate: 0
    };
    this.recentBets = [];
    this.localStorageKey = `zak_conversation_${sessionId}`;

    this.loadFromStorage();
  }

  /**
   * Load conversation from localStorage (fallback if DB unavailable)
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.messages = data.messages || [];
        this.bankroll = data.bankroll;
        this.accuracy = data.accuracy || this.accuracy;
        this.recentBets = data.recentBets || [];
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }

  /**
   * Save conversation to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify({
        sessionId: this.sessionId,
        messages: this.messages,
        bankroll: this.bankroll,
        accuracy: this.accuracy,
        recentBets: this.recentBets,
        lastUpdate: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Add message to conversation
   */
  addMessage(role, content, metadata = {}) {
    const message = {
      role, // 'user' | 'assistant' | 'system'
      content,
      timestamp: Date.now(),
      ...metadata
    };

    this.messages.push(message);
    this.saveToStorage();
    return message;
  }

  /**
   * Get last N messages (for context window)
   */
  getRecentMessages(count = 10) {
    return this.messages.slice(-count);
  }

  /**
   * Clear conversation (start fresh)
   */
  clearConversation() {
    this.messages = [];
    this.saveToStorage();
  }

  /**
   * Record bet placement and tracking
   */
  recordBet(betData) {
    const bet = {
      id: `bet_${Date.now()}`,
      timestamp: Date.now(),
      match: betData.match,
      market: betData.market,
      odds: betData.odds,
      stake: betData.stake,
      model_probability: betData.model_probability,
      expected_value: betData.expected_value,
      kelly_pct: betData.kelly_pct,
      status: 'pending' // pending | won | lost
    };

    this.recentBets.unshift(bet); // Add to beginning
    if (this.recentBets.length > 10) {
      this.recentBets.pop(); // Keep last 10
    }

    this.saveToStorage();
    return bet;
  }

  /**
   * Update bet outcome
   */
  updateBetOutcome(betId, outcome) {
    const bet = this.recentBets.find(b => b.id === betId);
    if (!bet) return null;

    bet.status = outcome; // 'won' | 'lost'
    bet.outcome_timestamp = Date.now();

    // Update accuracy stats
    if (outcome === 'won') {
      this.accuracy.wins++;
    } else if (outcome === 'lost') {
      this.accuracy.losses++;
    }
    this.accuracy.total_predictions++;
    this.accuracy.win_rate = Math.round(
      (this.accuracy.wins / this.accuracy.total_predictions) * 10000
    ) / 100;

    this.saveToStorage();
    return bet;
  }

  /**
   * Get bet statistics
   */
  getBetStats() {
    const totalStake = this.recentBets.reduce((sum, b) => sum + (b.stake || 0), 0);
    const wins = this.recentBets.filter(b => b.status === 'won').length;
    const losses = this.recentBets.filter(b => b.status === 'lost').length;
    const pending = this.recentBets.filter(b => b.status === 'pending').length;

    let roi = 0;
    if (totalStake > 0) {
      const profit = wins * 100 - losses * 100; // Simplified: assume 1:1 payout
      roi = (profit / totalStake) * 100;
    }

    return {
      total_bets: this.recentBets.length,
      wins,
      losses,
      pending,
      win_rate: this.accuracy.win_rate,
      total_stake: totalStake,
      roi: Math.round(roi * 100) / 100
    };
  }

  /**
   * Set user bankroll
   */
  setBankroll(amount) {
    this.bankroll = parseFloat(amount);
    this.saveToStorage();
  }

  /**
   * Get current context for API calls
   */
  getContext() {
    return {
      sessionId: this.sessionId,
      bankroll: this.bankroll,
      messageCount: this.messages.length,
      betStats: this.getBetStats(),
      accuracy: this.accuracy
    };
  }

  /**
   * Export conversation history
   */
  exportConversation() {
    return {
      sessionId: this.sessionId,
      exportDate: new Date().toISOString(),
      messages: this.messages,
      bets: this.recentBets,
      stats: this.getBetStats()
    };
  }

  /**
   * Import conversation history
   */
  importConversation(data) {
    if (data.messages) this.messages = data.messages;
    if (data.bets) this.recentBets = data.bets;
    this.saveToStorage();
  }
}

export default ConversationManager;
