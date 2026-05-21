// ============================================================
//  DATA_EXTENDED.JS — Estadísticas avanzadas para el Modelo Pro
//  xG, corners, tarjetas, agresividad y pressing de las 32
//  selecciones. Variables listas para reemplazar con API real.
// ============================================================

const LEAGUE_PARAMS = {
  avg_goals:    2.64,
  avg_corners:  10.3,
  avg_yellows:  3.85,
  avg_reds:     0.17,
  home_advantage: 1.00,   // Mundial sin cancha fija → sin ventaja de local
};

const REFEREE_PROFILES = {
  default: { avg_yellows: 3.85, avg_reds: 0.17, strictness: 1.00, label: 'Normal'    },
  strict:  { avg_yellows: 4.90, avg_reds: 0.28, strictness: 1.27, label: 'Estricto'  },
  lenient: { avg_yellows: 2.80, avg_reds: 0.09, strictness: 0.73, label: 'Permisivo' },
};

// ——— Formato de cada entrada ———
// xG_for / xG_against      → goles esperados (últimas 15 partidos)
// avg_corners_for/against  → córners a favor/en contra por partido
// avg_yellow_cards         → promedio de amarillas recibidas por partido
// avg_red_cards            → promedio de rojas directas recibidas
// foul_rate                → faltas cometidas por partido
// aggression_index         → índice de agresividad 0-100 (faltas + tarjetas)
// pressing_intensity       → intensidad de presión 0-100 (genera corners)

const EXTENDED_STATS = {
  ARG: { xG_for:1.92, xG_against:0.71, avg_corners_for:5.8,  avg_corners_against:4.2, avg_yellow_cards:2.2, avg_red_cards:0.12, foul_rate:14.1, aggression_index:68, pressing_intensity:72 },
  MEX: { xG_for:1.42, xG_against:1.15, avg_corners_for:5.0,  avg_corners_against:4.8, avg_yellow_cards:2.6, avg_red_cards:0.14, foul_rate:15.5, aggression_index:73, pressing_intensity:64 },
  POL: { xG_for:1.32, xG_against:1.28, avg_corners_for:4.6,  avg_corners_against:5.0, avg_yellow_cards:2.5, avg_red_cards:0.13, foul_rate:14.2, aggression_index:70, pressing_intensity:58 },
  KSA: { xG_for:1.12, xG_against:1.78, avg_corners_for:4.0,  avg_corners_against:5.5, avg_yellow_cards:2.5, avg_red_cards:0.16, foul_rate:15.8, aggression_index:72, pressing_intensity:55 },

  FRA: { xG_for:1.88, xG_against:0.81, avg_corners_for:6.1,  avg_corners_against:4.4, avg_yellow_cards:2.0, avg_red_cards:0.09, foul_rate:13.2, aggression_index:62, pressing_intensity:68 },
  AUS: { xG_for:1.28, xG_against:1.42, avg_corners_for:4.5,  avg_corners_against:5.0, avg_yellow_cards:2.1, avg_red_cards:0.10, foul_rate:13.0, aggression_index:60, pressing_intensity:65 },
  TUN: { xG_for:1.15, xG_against:1.45, avg_corners_for:4.2,  avg_corners_against:5.0, avg_yellow_cards:2.7, avg_red_cards:0.15, foul_rate:15.2, aggression_index:70, pressing_intensity:55 },
  KOR: { xG_for:1.38, xG_against:1.05, avg_corners_for:4.9,  avg_corners_against:4.6, avg_yellow_cards:1.9, avg_red_cards:0.09, foul_rate:12.2, aggression_index:55, pressing_intensity:74 },

  ESP: { xG_for:1.98, xG_against:0.78, avg_corners_for:7.2,  avg_corners_against:3.8, avg_yellow_cards:2.1, avg_red_cards:0.10, foul_rate:12.8, aggression_index:60, pressing_intensity:74 },
  GER: { xG_for:1.72, xG_against:1.01, avg_corners_for:6.0,  avg_corners_against:4.5, avg_yellow_cards:2.3, avg_red_cards:0.10, foul_rate:13.5, aggression_index:64, pressing_intensity:72 },
  JPN: { xG_for:1.41, xG_against:0.97, avg_corners_for:5.0,  avg_corners_against:4.8, avg_yellow_cards:1.7, avg_red_cards:0.07, foul_rate:11.5, aggression_index:48, pressing_intensity:80 },
  CRC: { xG_for:0.92, xG_against:1.62, avg_corners_for:3.5,  avg_corners_against:5.8, avg_yellow_cards:2.4, avg_red_cards:0.14, foul_rate:15.5, aggression_index:68, pressing_intensity:52 },

  POR: { xG_for:1.85, xG_against:0.85, avg_corners_for:5.9,  avg_corners_against:4.3, avg_yellow_cards:2.5, avg_red_cards:0.13, foul_rate:14.2, aggression_index:72, pressing_intensity:66 },
  URU: { xG_for:1.55, xG_against:0.85, avg_corners_for:5.2,  avg_corners_against:4.3, avg_yellow_cards:2.8, avg_red_cards:0.18, foul_rate:16.2, aggression_index:80, pressing_intensity:60 },
  GHA: { xG_for:1.08, xG_against:1.52, avg_corners_for:4.0,  avg_corners_against:5.2, avg_yellow_cards:2.6, avg_red_cards:0.16, foul_rate:15.8, aggression_index:74, pressing_intensity:57 },
  USA: { xG_for:1.52, xG_against:0.98, avg_corners_for:5.3,  avg_corners_against:4.7, avg_yellow_cards:2.0, avg_red_cards:0.09, foul_rate:12.8, aggression_index:58, pressing_intensity:70 },

  BRA: { xG_for:1.95, xG_against:0.74, avg_corners_for:6.5,  avg_corners_against:4.0, avg_yellow_cards:2.4, avg_red_cards:0.11, foul_rate:14.8, aggression_index:70, pressing_intensity:78 },
  SRB: { xG_for:1.48, xG_against:1.20, avg_corners_for:4.8,  avg_corners_against:5.0, avg_yellow_cards:2.8, avg_red_cards:0.18, foul_rate:16.0, aggression_index:80, pressing_intensity:58 },
  SUI: { xG_for:1.55, xG_against:1.05, avg_corners_for:5.2,  avg_corners_against:4.6, avg_yellow_cards:2.2, avg_red_cards:0.10, foul_rate:13.5, aggression_index:63, pressing_intensity:65 },
  CMR: { xG_for:1.10, xG_against:1.55, avg_corners_for:4.2,  avg_corners_against:5.2, avg_yellow_cards:2.9, avg_red_cards:0.20, foul_rate:17.0, aggression_index:85, pressing_intensity:55 },

  ENG: { xG_for:1.78, xG_against:0.88, avg_corners_for:6.8,  avg_corners_against:4.1, avg_yellow_cards:1.9, avg_red_cards:0.08, foul_rate:12.5, aggression_index:58, pressing_intensity:65 },
  IRN: { xG_for:1.38, xG_against:1.18, avg_corners_for:4.8,  avg_corners_against:4.8, avg_yellow_cards:2.5, avg_red_cards:0.15, foul_rate:15.5, aggression_index:72, pressing_intensity:60 },
  SEN: { xG_for:1.48, xG_against:0.91, avg_corners_for:4.9,  avg_corners_against:4.4, avg_yellow_cards:2.5, avg_red_cards:0.14, foul_rate:15.1, aggression_index:72, pressing_intensity:68 },
  ECU: { xG_for:1.28, xG_against:1.38, avg_corners_for:4.4,  avg_corners_against:4.9, avg_yellow_cards:2.4, avg_red_cards:0.13, foul_rate:14.5, aggression_index:66, pressing_intensity:62 },

  BEL: { xG_for:1.74, xG_against:0.89, avg_corners_for:5.7,  avg_corners_against:4.2, avg_yellow_cards:2.2, avg_red_cards:0.10, foul_rate:13.4, aggression_index:65, pressing_intensity:65 },
  CRO: { xG_for:1.42, xG_against:0.92, avg_corners_for:5.0,  avg_corners_against:4.5, avg_yellow_cards:2.4, avg_red_cards:0.12, foul_rate:14.5, aggression_index:70, pressing_intensity:62 },
  MAR: { xG_for:1.35, xG_against:0.78, avg_corners_for:4.8,  avg_corners_against:4.0, avg_yellow_cards:2.3, avg_red_cards:0.12, foul_rate:14.8, aggression_index:68, pressing_intensity:72 },
  CAN: { xG_for:1.18, xG_against:1.32, avg_corners_for:4.5,  avg_corners_against:4.7, avg_yellow_cards:2.2, avg_red_cards:0.11, foul_rate:13.2, aggression_index:62, pressing_intensity:68 },

  NED: { xG_for:1.68, xG_against:0.92, avg_corners_for:5.5,  avg_corners_against:4.4, avg_yellow_cards:2.1, avg_red_cards:0.09, foul_rate:13.0, aggression_index:63, pressing_intensity:67 },
  COL: { xG_for:1.62, xG_against:0.95, avg_corners_for:5.4,  avg_corners_against:4.5, avg_yellow_cards:2.7, avg_red_cards:0.15, foul_rate:15.5, aggression_index:75, pressing_intensity:63 },
  DEN: { xG_for:1.60, xG_against:0.98, avg_corners_for:5.5,  avg_corners_against:4.4, avg_yellow_cards:2.0, avg_red_cards:0.09, foul_rate:12.6, aggression_index:60, pressing_intensity:68 },
  NZL: { xG_for:0.78, xG_against:1.98, avg_corners_for:3.2,  avg_corners_against:6.0, avg_yellow_cards:2.0, avg_red_cards:0.10, foul_rate:13.0, aggression_index:55, pressing_intensity:52 },
};

// Fallback para equipos no encontrados
const DEFAULT_TEAM_EXT = {
  xG_for:1.30, xG_against:1.30, avg_corners_for:5.0, avg_corners_against:5.0,
  avg_yellow_cards:2.2, avg_red_cards:0.11, foul_rate:13.8, aggression_index:63, pressing_intensity:63,
};

function getExtStats(shortName) {
  return EXTENDED_STATS[shortName] || DEFAULT_TEAM_EXT;
}
