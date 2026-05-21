// ============================================================
//  MUNDIAL 2026 ANALYTICS — MÓDULO DE PREDICCIONES
//  Algoritmo de pesos estadísticos para estimar probabilidades
// ============================================================

/**
 * Convierte el array de forma reciente en puntos (0-30).
 * W=3, D=1, L=0 — máximo 30 con 10 victorias seguidas.
 */
function calculateFormPoints(form) {
  return form.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
}

/**
 * Calcula el puntaje bruto de un equipo aplicando los pesos del modelo:
 *   30% Ranking FIFA · 25% Forma reciente · 20% Ataque · 15% Defensa · 10% Jugador estrella
 */
function calculateTeamScore(team, maxGoalsScored, maxGoalsConceded) {
  // Ranking FIFA → escala 0-100 (rk1 ≈ 100, rk100 ≈ 0)
  const rankScore = Math.max(0, 100 - (team.fifaRanking - 1) * 1.0);

  // Forma → 0-100 basado en los últimos 10 partidos
  const formScore = (calculateFormPoints(team.recentForm) / 30) * 100;

  // Ataque → normalizado al máximo del torneo
  const attackScore = (team.goalsScored / maxGoalsScored) * 100;

  // Defensa → menos goles concedidos = mayor puntaje
  const defenseScore = (1 - team.goalsConceded / (maxGoalsConceded * 1.1)) * 100;

  // Jugador estrella → ya en escala 0-100
  const starScore = team.starPlayerValue;

  return (
    rankScore   * 0.30 +
    formScore   * 0.25 +
    attackScore * 0.20 +
    defenseScore* 0.15 +
    starScore   * 0.10
  );
}

/**
 * Calcula las probabilidades de ganar el torneo para todos los equipos.
 * Devuelve un array ordenado de mayor a menor probabilidad.
 */
function calculateAllProbabilities() {
  const maxGoalsScored   = Math.max(...TEAMS.map(t => t.goalsScored));
  const maxGoalsConceded = Math.max(...TEAMS.map(t => t.goalsConceded));

  const scored = TEAMS.map(team => ({
    team,
    score: calculateTeamScore(team, maxGoalsScored, maxGoalsConceded),
  }));

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);

  return scored
    .map(s => ({
      team:        s.team,
      score:       s.score,
      probability: parseFloat((s.score / totalScore * 100).toFixed(2)),
    }))
    .sort((a, b) => b.probability - a.probability)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Compara las probabilidades del algoritmo con las cuotas de DoradoBet.
 * Una "apuesta de valor" existe cuando nuestra prob > prob implícita de la casa.
 * Se exige un margen mínimo de 1.2 puntos porcentuales para filtrar ruido.
 */
function detectValueBets(probabilities) {
  return probabilities
    .map(p => {
      const market = DORADOBET_ODDS[p.team.shortName];
      if (!market) return null;

      const impliedProb = parseFloat((1 / market.odds * 100).toFixed(2));
      const edge        = parseFloat((p.probability - impliedProb).toFixed(2));
      const isValue     = edge >= 1.2;

      return {
        team:        p.team,
        rank:        p.rank,
        algoProb:    p.probability,
        impliedProb,
        odds:        market.odds,
        edge,
        isValue,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.edge - a.edge);
}

/**
 * Desglosa los sub-scores de un equipo para la vista de transparencia algorítmica.
 */
function getScoreBreakdown(team) {
  const maxGoalsScored   = Math.max(...TEAMS.map(t => t.goalsScored));
  const maxGoalsConceded = Math.max(...TEAMS.map(t => t.goalsConceded));

  return {
    ranking:  parseFloat((Math.max(0, 100 - (team.fifaRanking - 1)) * 0.30).toFixed(1)),
    forma:    parseFloat(((calculateFormPoints(team.recentForm) / 30) * 100 * 0.25).toFixed(1)),
    ataque:   parseFloat(((team.goalsScored / maxGoalsScored) * 100 * 0.20).toFixed(1)),
    defensa:  parseFloat(((1 - team.goalsConceded / (maxGoalsConceded * 1.1)) * 100 * 0.15).toFixed(1)),
    estrella: parseFloat((team.starPlayerValue * 0.10).toFixed(1)),
  };
}
