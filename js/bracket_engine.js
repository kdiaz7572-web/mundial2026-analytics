// ============================================================
//  BRACKET ENGINE — Mundial 2026 (formato 48 equipos)
//  12 grupos (A–L) × 4 → clasifican: 1° + 2° de cada grupo (24)
//  + los 8 mejores 3° lugares = 32 equipos → Ronda de 32.
//
//  Expone computeBracket() como global (script clásico, sin import).
//  Depende de: FIXTURES, TEAMS, GROUPS, calculateStandings(), getTeam()
//  (todos globales ya cargados desde data.js / app.js).
//
//  NOTA: el cruce oficial de "mejores terceros" de FIFA usa una tabla
//  de combinaciones compleja. Esta v1 hace un sembrado determinista y
//  transparente; los grupos son estimados (verificar con FIFA).
// ============================================================

// ¿Está completa la fase de un grupo? (los 6 partidos con resultado)
function isGroupComplete(group) {
  const gf = FIXTURES.filter(f => f.group === group);
  return gf.length > 0 && gf.every(f => f.homeGoals !== null && f.awayGoals !== null);
}

// ¿Toda la fase de grupos terminó?
function isGroupStageComplete() {
  return GROUPS.every(g => isGroupComplete(g));
}

// Devuelve {first, second, third} con el objeto team de cada posición de un grupo
function groupQualifiers(group) {
  const s = calculateStandings(group); // ya viene ordenado
  return {
    first:  s[0]?.team || null,
    second: s[1]?.team || null,
    third:  s[2] ? { ...s[2], group } : null, // conserva stats para rankear terceros
  };
}

// Ranking de los 8 mejores terceros (Pts, GD, GF)
function bestThirds() {
  const thirds = GROUPS
    .map(g => groupQualifiers(g).third)
    .filter(Boolean)
    .sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);
  return thirds.slice(0, 8).map(t => t.team);
}

// Helper para empaquetar un equipo o un placeholder textual
function slotTeam(team, placeholder) {
  if (team) return { short: team.shortName, name: team.name, flag: team.flag };
  return { short: null, name: placeholder, flag: '⬜', placeholder: true };
}

/**
 * computeBracket() → estructura del árbol de eliminatorias.
 * Si la fase de grupos no terminó, ready=false y los slots muestran
 * los líderes parciales como referencia.
 */
function computeBracket() {
  const ready = isGroupStageComplete();

  // 1° y 2° de cada grupo
  const q = {};
  GROUPS.forEach(g => { q[g] = groupQualifiers(g); });
  const thirds = bestThirds();

  const W = g => slotTeam(q[g].first,  `1° Grupo ${g}`);   // winner
  const R = g => slotTeam(q[g].second, `2° Grupo ${g}`);   // runner-up
  const T = i => slotTeam(thirds[i],   `3° (mejor #${i + 1})`);

  // ── Ronda de 32 (16 partidos) ──────────────────────────────
  // Sembrado determinista: 1°s contra 2°s/terceros de otros grupos.
  // (Plantilla aproximada al bracket FIFA 2026 — verificar oficial.)
  const r32 = [
    { id: 'R32-1',  home: W('A'), away: T(0) },
    { id: 'R32-2',  home: W('C'), away: R('B') },
    { id: 'R32-3',  home: W('E'), away: T(1) },
    { id: 'R32-4',  home: W('G'), away: R('F') },
    { id: 'R32-5',  home: W('I'), away: T(2) },
    { id: 'R32-6',  home: W('K'), away: R('J') },
    { id: 'R32-7',  home: W('B'), away: T(3) },
    { id: 'R32-8',  home: W('D'), away: R('C') },
    { id: 'R32-9',  home: W('F'), away: T(4) },
    { id: 'R32-10', home: W('H'), away: R('G') },
    { id: 'R32-11', home: W('J'), away: T(5) },
    { id: 'R32-12', home: W('L'), away: R('K') },
    { id: 'R32-13', home: R('A'), away: T(6) },
    { id: 'R32-14', home: R('D'), away: R('E') },
    { id: 'R32-15', home: R('H'), away: T(7) },
    { id: 'R32-16', home: R('I'), away: R('L') },
  ];

  // Rondas siguientes: placeholders "Ganador Mxx" (resultados KO = futura mejora)
  const placeholderMatch = (id, a, b) => ({
    id,
    home: { short: null, name: `Ganador ${a}`, flag: '⬜', placeholder: true },
    away: { short: null, name: `Ganador ${b}`, flag: '⬜', placeholder: true },
  });

  const r16 = [];
  for (let i = 0; i < 8; i++) {
    r16.push(placeholderMatch(`R16-${i + 1}`, r32[i * 2].id, r32[i * 2 + 1].id));
  }
  const qf = [];
  for (let i = 0; i < 4; i++) {
    qf.push(placeholderMatch(`QF-${i + 1}`, r16[i * 2].id, r16[i * 2 + 1].id));
  }
  const sf = [];
  for (let i = 0; i < 2; i++) {
    sf.push(placeholderMatch(`SF-${i + 1}`, qf[i * 2].id, qf[i * 2 + 1].id));
  }
  const final = [placeholderMatch('FINAL', sf[0].id, sf[1].id)];
  const thirdPlace = [placeholderMatch('3RD', sf[0].id, sf[1].id)];
  thirdPlace[0].id = '3RD';
  thirdPlace[0].home.name = `Perdedor ${sf[0].id}`;
  thirdPlace[0].away.name = `Perdedor ${sf[1].id}`;

  return {
    ready,
    rounds: [
      { key: 'r32',   label: 'Dieciseisavos', matches: r32 },
      { key: 'r16',   label: 'Octavos',       matches: r16 },
      { key: 'qf',    label: 'Cuartos',       matches: qf },
      { key: 'sf',    label: 'Semifinales',   matches: sf },
      { key: 'final', label: 'Final',         matches: final },
    ],
    thirdPlace: thirdPlace[0],
    bestThirds: thirds.map((t, i) => t ? { rank: i + 1, short: t.shortName, name: t.name, flag: t.flag } : null).filter(Boolean),
    note: 'Sembrado modelo v1 — el cruce oficial de terceros se confirmará con FIFA.',
  };
}

// Exponer como globales
window.computeBracket = computeBracket;
window.isGroupStageComplete = isGroupStageComplete;
window.isGroupComplete = isGroupComplete;
