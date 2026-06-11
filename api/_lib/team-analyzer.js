/**
 * ============================================================
 * Team Analyzer — Equipos de club + Selecciones del Mundial 2026
 * ============================================================
 * Analiza equipos de club (Barcelona, PSG, etc.) y selecciones
 * nacionales (España, Brasil, Costa Rica, etc.) vía API-Football.
 *
 * Genera siempre 3 apuestas: Conservadora / Moderada / Agresiva
 */

// fetch is globally available in Node.js 18+
const API_BASE = 'https://api.api-football.com/v3';

// ============================================================
// Selecciones del Mundial 2026 — detección por nombre
// ============================================================

const WORLD_CUP_NATIONS = [
  // CONMEBOL
  { es: ['Argentina', 'Albiceleste'], en: 'Argentina' },
  { es: ['Brasil', 'Brazil', 'Canarinha', 'Seleção'], en: 'Brazil' },
  { es: ['Uruguay', 'Celeste'], en: 'Uruguay' },
  { es: ['Colombia', 'Cafeteros'], en: 'Colombia' },
  { es: ['Ecuador'], en: 'Ecuador' },
  { es: ['Paraguay'], en: 'Paraguay' },
  { es: ['Chile', 'Roja'], en: 'Chile' },
  { es: ['Venezuela'], en: 'Venezuela' },
  { es: ['Bolivia'], en: 'Bolivia' },
  { es: ['Perú', 'Peru'], en: 'Peru' },
  // UEFA
  { es: ['España', 'Spain', 'Roja', 'Furia'], en: 'Spain' },
  { es: ['Francia', 'France', 'Les Bleus'], en: 'France' },
  { es: ['Alemania', 'Germany', 'Deutschland'], en: 'Germany' },
  { es: ['Portugal'], en: 'Portugal' },
  { es: ['Inglaterra', 'England', 'Three Lions'], en: 'England' },
  { es: ['Países Bajos', 'Holanda', 'Netherlands', 'Holland'], en: 'Netherlands' },
  { es: ['Bélgica', 'Belgium'], en: 'Belgium' },
  { es: ['Italia', 'Italy', 'Azzurri'], en: 'Italy' },
  { es: ['Croacia', 'Croatia'], en: 'Croatia' },
  { es: ['Suiza', 'Switzerland'], en: 'Switzerland' },
  { es: ['Polonia', 'Poland'], en: 'Poland' },
  { es: ['Serbia'], en: 'Serbia' },
  { es: ['Dinamarca', 'Denmark'], en: 'Denmark' },
  { es: ['Austria'], en: 'Austria' },
  { es: ['Turquía', 'Turkey'], en: 'Turkey' },
  { es: ['Escocia', 'Scotland'], en: 'Scotland' },
  { es: ['Hungría', 'Hungary'], en: 'Hungary' },
  { es: ['Ucrania', 'Ukraine'], en: 'Ukraine' },
  { es: ['Grecia', 'Greece'], en: 'Greece' },
  { es: ['Eslovaquia', 'Slovakia'], en: 'Slovakia' },
  // CONCACAF
  { es: ['México', 'Mexico', 'Tri', 'El Tri'], en: 'Mexico' },
  { es: ['Estados Unidos', 'USA', 'USMNT'], en: 'USA' },
  { es: ['Canadá', 'Canada'], en: 'Canada' },
  { es: ['Costa Rica', 'Ticos'], en: 'Costa Rica' },
  { es: ['Jamaica'], en: 'Jamaica' },
  { es: ['Honduras'], en: 'Honduras' },
  { es: ['Panamá', 'Panama'], en: 'Panama' },
  // CAF (África)
  { es: ['Marruecos', 'Morocco'], en: 'Morocco' },
  { es: ['Senegal'], en: 'Senegal' },
  { es: ['Ghana'], en: 'Ghana' },
  { es: ['Nigeria', 'Super Eagles'], en: 'Nigeria' },
  { es: ['Egipto', 'Egypt'], en: 'Egypt' },
  { es: ['Costa de Marfil', 'Ivory Coast'], en: 'Ivory Coast' },
  { es: ['Camerún', 'Cameroon'], en: 'Cameroon' },
  { es: ['Mali'], en: 'Mali' },
  { es: ['Sudáfrica', 'South Africa'], en: 'South Africa' },
  // AFC (Asia)
  { es: ['Japón', 'Japan'], en: 'Japan' },
  { es: ['Corea del Sur', 'South Korea'], en: 'South Korea' },
  { es: ['Arabia Saudita', 'Saudi Arabia'], en: 'Saudi Arabia' },
  { es: ['Irán', 'Iran'], en: 'Iran' },
  { es: ['Australia'], en: 'Australia' },
  { es: ['Qatar'], en: 'Qatar' },
  { es: ['Irak', 'Iraq'], en: 'Iraq' },
  { es: ['Uzbekistán', 'Uzbekistan'], en: 'Uzbekistan' },
  // OFC
  { es: ['Nueva Zelanda', 'New Zealand'], en: 'New Zealand' },
];

// ============================================================
// Equipos de club conocidos (para detección en chat)
// ============================================================

const KNOWN_CLUBS = [
  // España
  'Real Madrid', 'Barcelona', 'Atlético', 'Atletico', 'Sevilla', 'Valencia', 'Villarreal',
  'Real Sociedad', 'Athletic', 'Betis', 'Osasuna', 'Girona', 'Las Palmas',
  // Inglaterra
  'Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United', 'Man City',
  'Man United', 'Tottenham', 'Newcastle', 'Aston Villa', 'West Ham', 'Brighton',
  // Alemania
  'Bayern', 'Bayern Munich', 'Borussia Dortmund', 'BVB', 'Leipzig', 'Leverkusen',
  'Frankfurt', 'Stuttgart', 'Wolfsburg',
  // Francia
  'PSG', 'Paris Saint-Germain', 'Monaco', 'Lyon', 'Marseille', 'Lens', 'Lille', 'Nice',
  // Italia
  'Juventus', 'Inter', 'AC Milan', 'Milan', 'Napoli', 'Roma', 'Lazio', 'Fiorentina',
  'Atalanta',
  // Portugal
  'Benfica', 'Porto', 'Sporting',
  // Países Bajos
  'Ajax', 'PSV', 'Feyenoord',
  // Brasil
  'Flamengo', 'Palmeiras', 'Santos', 'Corinthians', 'Fluminense',
  // Argentina
  'Boca Juniors', 'River Plate', 'Racing', 'Independiente',
  // México
  'América', 'Cruz Azul', 'Chivas', 'Guadalajara', 'Tigres', 'Monterrey', 'UNAM',
  // USA
  'Inter Miami', 'Galaxy', 'LAFC', 'Seattle Sounders',
  // Costa Rica
  'Saprissa', 'Herediano', 'Alajuelense',
  // Otros
  'Celtic', 'Rangers', 'Ajax', 'Anderlecht', 'Benfica',
];

// ============================================================
// detectSubject — jugador, equipo de club, o selección
// ============================================================

export function detectSubject(message) {
  const msg = message.toLowerCase();

  // 1. Selecciones nacionales (prioridad alta)
  for (const nation of WORLD_CUP_NATIONS) {
    for (const variant of nation.es) {
      if (new RegExp(`\\b${variant.toLowerCase()}\\b`).test(msg)) {
        return { type: 'national_team', name: nation.en, displayName: variant };
      }
    }
  }

  // 2. Equipos de club conocidos
  for (const club of KNOWN_CLUBS) {
    if (new RegExp(`\\b${club.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(msg)) {
      return { type: 'club_team', name: club, displayName: club };
    }
  }

  // 3. Jugadores conocidos (Mundial 2026 estrellas)
  const KNOWN_PLAYERS = [
    'Mbappé', 'Mbappe', 'Bellingham', 'Yamal', 'Lamine Yamal', 'Vinicius', 'Vinícius',
    'Rodrygo', 'Haaland', 'Kane', 'Salah', 'Messi', 'Ronaldo', 'Dembélé', 'Dembelé',
    'Wirtz', 'Musiala', 'Pedri', 'Osimhen', 'Lewandowski', 'Benzema', 'Neymar',
    'De Bruyne', 'Rashford', 'Saka', 'Pulisic', 'Iniesta', 'Modric', 'Kroos',
    'Carvajal', 'Alaba', 'Ter Stegen', 'Courtois', 'Szczesny', 'Ederson',
    'Griezmann', 'Pavard', 'Camavinga', 'Tchouameni', 'Guendouzi', 'Rabiot',
    'Valverde', 'Ceballos', 'Camari', 'Gavi', 'Barella', 'Jude',
  ];
  for (const player of KNOWN_PLAYERS) {
    if (new RegExp(`\\b${player.toLowerCase()}\\b`, 'i').test(msg)) {
      return { type: 'player', name: player, displayName: player };
    }
  }

  // 4. Patrón genérico para nombres capitalizados en contexto de apuestas
  const betKeywords = ['apuesta', 'apostar', 'análisis', 'analiza', 'odds', 'probabilidad', 'mercado'];
  const hasBetContext = betKeywords.some(k => msg.includes(k));
  if (hasBetContext) {
    const match = message.match(/\b([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,}(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,})?)\b/);
    if (match) {
      const name = match[1];
      const commonWords = ['Para', 'Cuál', 'Mejor', 'Quién', 'Dame', 'Dime', 'Qué', 'Cómo'];
      if (!commonWords.includes(name)) {
        return { type: 'player', name, displayName: name };
      }
    }
  }

  return null;
}

// ============================================================
// API-Football helpers
// ============================================================

async function apiFetch(path, apiKey) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': apiKey }
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`);
  const data = await res.json();
  return data.response || [];
}

// ============================================================
// findTeamId — busca el ID del equipo o selección
// ============================================================

async function findTeamId(name, isNational, apiKey) {
  const params = isNational
    ? `search=${encodeURIComponent(name)}&type=national`
    : `search=${encodeURIComponent(name)}`;
  const results = await apiFetch(`/teams?${params}`, apiKey);
  if (!results || results.length === 0) return null;
  return { id: results[0].team.id, name: results[0].team.name, logo: results[0].team.logo };
}

// ============================================================
// getRecentResults — últimos 5 partidos
// ============================================================

async function getRecentResults(teamId, apiKey) {
  const results = await apiFetch(`/fixtures?team=${teamId}&last=5`, apiKey);
  return results.map(f => {
    const isHome = f.teams.home.id === teamId;
    const scored = isHome ? f.goals.home : f.goals.away;
    const conceded = isHome ? f.goals.away : f.goals.home;
    let result = 'D';
    if (scored > conceded) result = 'W';
    else if (scored < conceded) result = 'L';
    return { result, scored: scored || 0, conceded: conceded || 0, isHome };
  });
}

// ============================================================
// getNextFixture — próximo partido
// ============================================================

async function getNextFixture(teamId, apiKey) {
  const results = await apiFetch(`/fixtures?team=${teamId}&next=1`, apiKey);
  if (!results || results.length === 0) return null;
  const f = results[0];
  const isHome = f.teams.home.id === teamId;
  return {
    fixture_id: f.fixture.id,
    date: f.fixture.date,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    league: f.league.name,
    is_home: isHome,
    opponent_team: isHome ? f.teams.away.name : f.teams.home.name
  };
}

// ============================================================
// calculateTeamProbabilities — desde los últimos 5 resultados
// ============================================================

function calculateTeamProbabilities(recentForm, isHome) {
  if (!recentForm || recentForm.length === 0) {
    return { win: 0.40, draw: 0.28, loss: 0.32, over25: 0.52, btts: 0.45, cleanSheet: 0.32 };
  }

  const wins = recentForm.filter(r => r.result === 'W').length;
  const draws = recentForm.filter(r => r.result === 'D').length;
  const losses = recentForm.filter(r => r.result === 'L').length;
  const n = recentForm.length;

  const avgScored = recentForm.reduce((s, r) => s + r.scored, 0) / n;
  const avgConceded = recentForm.reduce((s, r) => s + r.conceded, 0) / n;
  const over25Count = recentForm.filter(r => r.scored + r.conceded > 2.5).length;
  const bttsCount = recentForm.filter(r => r.scored > 0 && r.conceded > 0).length;
  const cleanSheetCount = recentForm.filter(r => r.conceded === 0).length;

  // Home advantage adjustment
  const homeBonus = isHome ? 0.06 : -0.04;

  return {
    win: Math.min(0.85, Math.max(0.1, wins / n + homeBonus)),
    draw: Math.min(0.45, Math.max(0.1, draws / n)),
    loss: Math.min(0.80, Math.max(0.1, losses / n - homeBonus)),
    over25: Math.round(over25Count / n * 100) / 100,
    btts: Math.round(bttsCount / n * 100) / 100,
    cleanSheet: Math.round(cleanSheetCount / n * 100) / 100,
    avgScored: Math.round(avgScored * 100) / 100,
    avgConceded: Math.round(avgConceded * 100) / 100,
    form: recentForm.map(r => r.result).join('')
  };
}

// ============================================================
// generateThreeBetsForTeam
// ============================================================

function generateThreeBetsForTeam(teamName, probs, nextMatch, isNational) {
  const stars = (p) => '⭐'.repeat(Math.min(5, Math.max(1, Math.round(p * 6))));
  const toOdds = (p) => Math.round((1 / Math.max(0.04, p)) * 100) / 100;
  const kelly = (p, o, f) => Math.max(0.5, Math.round(Math.max(0, (o - 1) * p - (1 - p)) / (o - 1) * f * 100 * 10) / 10);

  const matchCtx = nextMatch
    ? ` en ${nextMatch.home_team} vs ${nextMatch.away_team} (${nextMatch.is_home ? 'local' : 'visitante'})`
    : '';

  // --- CONSERVADORA: Double Chance (Win o Draw) ---
  const dcProb = Math.min(0.92, probs.win + probs.draw);
  const dcOdds = toOdds(dcProb);
  const dcKelly = kelly(dcProb, dcOdds, 0.5);

  // --- MODERADA: Victoria + Over 2.5 ---
  const modProb = Math.round(probs.win * probs.over25 * 1.05 * 100) / 100; // slight + corr
  const modOdds = toOdds(modProb);
  const modKelly = kelly(modProb, modOdds, 0.5);

  // --- AGRESIVA: Victoria + BTTS + Over 2.5 ---
  const aggrProb = Math.max(0.04, Math.round(probs.win * probs.btts * probs.over25 * 100) / 100);
  const aggrOdds = toOdds(aggrProb);
  const aggrKelly = kelly(aggrProb, aggrOdds, 0.25);

  const label = isNational ? 'selección' : 'equipo';

  return {
    conservative: {
      label: '🟢 Conservadora',
      market: 'Doble Oportunidad (Victoria o Empate)',
      prediction: `${teamName} gana o empata`,
      probability: dcProb,
      probability_pct: `${Math.round(dcProb * 100)}%`,
      estimated_odds: dcOdds,
      kelly_pct: dcKelly,
      confidence: stars(dcProb),
      reasoning: `El ${label} gana o empata en ${Math.round(dcProb * 100)}% de sus partidos recientes (forma: ${probs.form || '—'}).${matchCtx} Menor riesgo.`,
      risk: 'bajo'
    },
    moderate: {
      label: '🟡 Moderada',
      market: 'Victoria + Más de 2.5 Goles',
      prediction: `${teamName} gana + Más de 2.5 goles totales`,
      probability: modProb,
      probability_pct: `${Math.round(modProb * 100)}%`,
      estimated_odds: modOdds,
      kelly_pct: modKelly,
      confidence: stars(modProb),
      reasoning: `Combinación de victoria (${Math.round(probs.win * 100)}%) y partido con goles (${Math.round(probs.over25 * 100)}% partidos con Over 2.5).${matchCtx}`,
      risk: 'medio'
    },
    aggressive: {
      label: '🔴 Agresiva',
      market: 'Victoria + BTTS + Over 2.5',
      prediction: `${teamName} gana + Ambos anotan + Más de 2.5 goles`,
      probability: aggrProb,
      probability_pct: `${Math.round(aggrProb * 100)}%`,
      estimated_odds: aggrOdds,
      kelly_pct: aggrKelly,
      confidence: stars(aggrProb),
      reasoning: `Parlay de 3 mercados correlacionados positivamente. Alto retorno pero requiere que ${teamName} gane marcando y recibiendo gol.${matchCtx}`,
      risk: 'alto'
    }
  };
}

// ============================================================
// analyzeTeam — función principal para club o selección
// ============================================================

export async function analyzeTeam(name, isNational = false) {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    console.warn('[team-analyzer] FOOTBALL_API_KEY not configured — using fallback');
    return generateTeamFallback(name, isNational);
  }

  try {
    // 1. Buscar equipo
    const teamInfo = await findTeamId(name, isNational, apiKey);
    if (!teamInfo) {
      console.warn('[team-analyzer] Team not found:', name);
      return generateTeamFallback(name, isNational);
    }

    // 2. Últimos 5 resultados + próximo partido (en paralelo)
    const [recentForm, nextMatch] = await Promise.all([
      getRecentResults(teamInfo.id, apiKey).catch(() => []),
      getNextFixture(teamInfo.id, apiKey).catch(() => null)
    ]);

    const isHome = nextMatch ? nextMatch.is_home : true;
    const probs = calculateTeamProbabilities(recentForm, isHome);
    const bets = generateThreeBetsForTeam(teamInfo.name, probs, nextMatch, isNational);

    return {
      success: true,
      type: isNational ? 'national_team' : 'club_team',
      team: {
        id: teamInfo.id,
        name: teamInfo.name,
        logo: teamInfo.logo,
        isNational
      },
      recentForm,
      probabilities: probs,
      nextMatch,
      bets,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[team-analyzer] Error:', error.message);
    return generateTeamFallback(name, isNational);
  }
}

// ============================================================
// generateTeamFallback
// ============================================================

function generateTeamFallback(name, isNational) {
  const fallbackForm = [
    { result: 'W', scored: 2, conceded: 0, isHome: true },
    { result: 'W', scored: 1, conceded: 1, isHome: false },
    { result: 'D', scored: 1, conceded: 1, isHome: true },
    { result: 'L', scored: 0, conceded: 2, isHome: false },
    { result: 'W', scored: 3, conceded: 1, isHome: true },
  ];
  const probs = calculateTeamProbabilities(fallbackForm, true);
  const bets = generateThreeBetsForTeam(name, probs, null, isNational);

  return {
    success: false,
    type: isNational ? 'national_team' : 'club_team',
    team: {
      name,
      isNational,
      note: 'Datos estimados — configura FOOTBALL_API_KEY para datos reales'
    },
    recentForm: fallbackForm,
    probabilities: probs,
    nextMatch: null,
    bets,
    timestamp: new Date().toISOString()
  };
}
