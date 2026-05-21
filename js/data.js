// ============================================================
//  MUNDIAL 2026 ANALYTICS — DATA LAYER
//  FIFA World Cup 2026 — 48 equipos, 12 grupos (A–L)
//  Sede: USA / Canadá / México · Sorteo: 5 dic 2024
//  Nota: composición de grupos es estimada; verificar con FIFA.
// ============================================================

const TEAMS = [
  // ——— GRUPO A (Host: USA) ———
  { id:1,  name:"Estados Unidos", shortName:"USA", flag:"🇺🇸", group:"A", confederation:"CONCACAF",
    fifaRanking:13, color:"#b22234", recentForm:["W","W","D","W","L","W","W","D","W","W"],
    goalsScored:1.6, goalsConceded:1.1, starPlayerValue:80, starPlayer:"C. Pulisic" },
  { id:2,  name:"Panamá",         shortName:"PAN", flag:"🇵🇦", group:"A", confederation:"CONCACAF",
    fifaRanking:44, color:"#da121a", recentForm:["W","D","L","W","W","D","W","L","D","W"],
    goalsScored:1.1, goalsConceded:1.4, starPlayerValue:48, starPlayer:"A. Murillo" },
  { id:3,  name:"Uruguay",        shortName:"URU", flag:"🇺🇾", group:"A", confederation:"CONMEBOL",
    fifaRanking:11, color:"#5aaaff", recentForm:["W","D","W","W","L","W","D","W","D","W"],
    goalsScored:1.7, goalsConceded:1.0, starPlayerValue:82, starPlayer:"F. Valverde" },
  { id:4,  name:"Marruecos",      shortName:"MAR", flag:"🇲🇦", group:"A", confederation:"CAF",
    fifaRanking:14, color:"#c1272d", recentForm:["W","W","W","D","W","W","D","W","W","L"],
    goalsScored:1.6, goalsConceded:0.9, starPlayerValue:78, starPlayer:"H. Ziyech" },

  // ——— GRUPO B (Host: México) ———
  { id:5,  name:"México",         shortName:"MEX", flag:"🇲🇽", group:"B", confederation:"CONCACAF",
    fifaRanking:16, color:"#006847", recentForm:["W","D","W","L","W","D","W","W","L","D"],
    goalsScored:1.4, goalsConceded:1.2, starPlayerValue:70, starPlayer:"H. Lozano" },
  { id:6,  name:"Ecuador",        shortName:"ECU", flag:"🇪🇨", group:"B", confederation:"CONMEBOL",
    fifaRanking:28, color:"#ffdd00", recentForm:["W","L","D","W","W","L","D","W","D","W"],
    goalsScored:1.3, goalsConceded:1.4, starPlayerValue:65, starPlayer:"E. Valencia" },
  { id:7,  name:"Polonia",        shortName:"POL", flag:"🇵🇱", group:"B", confederation:"UEFA",
    fifaRanking:25, color:"#dc143c", recentForm:["W","D","L","W","D","W","L","W","D","W"],
    goalsScored:1.3, goalsConceded:1.3, starPlayerValue:78, starPlayer:"R. Lewandowski" },
  { id:8,  name:"Camerún",        shortName:"CMR", flag:"🇨🇲", group:"B", confederation:"CAF",
    fifaRanking:43, color:"#007a5e", recentForm:["D","W","L","W","D","W","L","D","W","L"],
    goalsScored:1.1, goalsConceded:1.6, starPlayerValue:58, starPlayer:"V. Aboubakar" },

  // ——— GRUPO C (Host: Canadá) ———
  { id:9,  name:"Canadá",         shortName:"CAN", flag:"🇨🇦", group:"C", confederation:"CONCACAF",
    fifaRanking:40, color:"#ff0000", recentForm:["W","D","W","L","W","D","L","W","W","D"],
    goalsScored:1.2, goalsConceded:1.3, starPlayerValue:60, starPlayer:"A. Davies" },
  { id:10, name:"Honduras",       shortName:"HON", flag:"🇭🇳", group:"C", confederation:"CONCACAF",
    fifaRanking:72, color:"#0073cf", recentForm:["L","D","W","L","D","W","L","W","D","L"],
    goalsScored:0.9, goalsConceded:1.8, starPlayerValue:38, starPlayer:"A. Lozano" },
  { id:11, name:"Japón",          shortName:"JPN", flag:"🇯🇵", group:"C", confederation:"AFC",
    fifaRanking:17, color:"#bc002d", recentForm:["W","W","D","W","W","L","W","W","D","W"],
    goalsScored:1.6, goalsConceded:1.1, starPlayerValue:76, starPlayer:"T. Minamino" },
  { id:12, name:"Georgia",        shortName:"GEO", flag:"🇬🇪", group:"C", confederation:"UEFA",
    fifaRanking:65, color:"#da121a", recentForm:["W","L","D","W","L","W","D","L","W","D"],
    goalsScored:1.0, goalsConceded:1.7, starPlayerValue:45, starPlayer:"K. Kvaratskhelia" },

  // ——— GRUPO D ———
  { id:13, name:"Argentina",      shortName:"ARG", flag:"🇦🇷", group:"D", confederation:"CONMEBOL",
    fifaRanking:1,  color:"#74acdf", recentForm:["W","W","W","W","D","W","W","L","W","W"],
    goalsScored:2.6, goalsConceded:0.7, starPlayerValue:98, starPlayer:"L. Martínez" },
  { id:14, name:"España",         shortName:"ESP", flag:"🇪🇸", group:"D", confederation:"UEFA",
    fifaRanking:8,  color:"#aa151b", recentForm:["W","W","W","W","D","W","W","D","W","W"],
    goalsScored:2.1, goalsConceded:0.8, starPlayerValue:90, starPlayer:"P. Gavi" },
  { id:15, name:"Arabia Saudita", shortName:"KSA", flag:"🇸🇦", group:"D", confederation:"AFC",
    fifaRanking:56, color:"#006c35", recentForm:["W","L","D","W","L","D","W","L","W","D"],
    goalsScored:1.2, goalsConceded:1.8, starPlayerValue:55, starPlayer:"S. Al-Dawsari" },
  { id:16, name:"Mali",           shortName:"MLI", flag:"🇲🇱", group:"D", confederation:"CAF",
    fifaRanking:55, color:"#14b53a", recentForm:["W","D","L","W","W","D","W","L","D","W"],
    goalsScored:1.0, goalsConceded:1.5, starPlayerValue:42, starPlayer:"M. Samaké" },

  // ——— GRUPO E ———
  { id:17, name:"Brasil",         shortName:"BRA", flag:"🇧🇷", group:"E", confederation:"CONMEBOL",
    fifaRanking:5,  color:"#009c3b", recentForm:["W","W","D","W","W","L","W","W","D","W"],
    goalsScored:2.3, goalsConceded:0.8, starPlayerValue:95, starPlayer:"Vinicius Jr." },
  { id:18, name:"Alemania",       shortName:"GER", flag:"🇩🇪", group:"E", confederation:"UEFA",
    fifaRanking:12, color:"#cccccc", recentForm:["W","D","W","W","L","W","D","W","W","D"],
    goalsScored:1.9, goalsConceded:1.0, starPlayerValue:88, starPlayer:"J. Musiala" },
  { id:19, name:"Australia",      shortName:"AUS", flag:"🇦🇺", group:"E", confederation:"AFC",
    fifaRanking:27, color:"#00843d", recentForm:["D","W","L","W","D","W","L","D","W","L"],
    goalsScored:1.3, goalsConceded:1.4, starPlayerValue:62, starPlayer:"M. Leckie" },
  { id:20, name:"Rep. D. Congo",  shortName:"COD", flag:"🇨🇩", group:"E", confederation:"CAF",
    fifaRanking:63, color:"#007fff", recentForm:["W","D","L","W","D","W","L","W","D","L"],
    goalsScored:0.9, goalsConceded:1.6, starPlayerValue:40, starPlayer:"C. Banza" },

  // ——— GRUPO F ———
  { id:21, name:"Francia",        shortName:"FRA", flag:"🇫🇷", group:"F", confederation:"UEFA",
    fifaRanking:2,  color:"#003189", recentForm:["W","W","W","D","W","W","W","D","W","W"],
    goalsScored:2.4, goalsConceded:0.9, starPlayerValue:97, starPlayer:"K. Mbappé" },
  { id:22, name:"Venezuela",      shortName:"VEN", flag:"🇻🇪", group:"F", confederation:"CONMEBOL",
    fifaRanking:48, color:"#cf1020", recentForm:["W","D","L","W","W","D","W","L","D","W"],
    goalsScored:1.1, goalsConceded:1.5, starPlayerValue:52, starPlayer:"S. Rondón" },
  { id:23, name:"Irán",           shortName:"IRN", flag:"🇮🇷", group:"F", confederation:"AFC",
    fifaRanking:22, color:"#239f40", recentForm:["W","D","W","W","D","L","W","D","W","W"],
    goalsScored:1.4, goalsConceded:1.2, starPlayerValue:63, starPlayer:"M. Taremi" },
  { id:24, name:"Nigeria",        shortName:"NGA", flag:"🇳🇬", group:"F", confederation:"CAF",
    fifaRanking:47, color:"#008751", recentForm:["W","W","D","L","W","D","W","L","W","D"],
    goalsScored:1.2, goalsConceded:1.4, starPlayerValue:60, starPlayer:"V. Osimhen" },

  // ——— GRUPO G ———
  { id:25, name:"Inglaterra",     shortName:"ENG", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", group:"G", confederation:"UEFA",
    fifaRanking:3,  color:"#cf081f", recentForm:["W","W","W","D","W","D","W","W","W","D"],
    goalsScored:2.0, goalsConceded:0.9, starPlayerValue:92, starPlayer:"J. Bellingham" },
  { id:26, name:"Colombia",       shortName:"COL", flag:"🇨🇴", group:"G", confederation:"CONMEBOL",
    fifaRanking:12, color:"#fcd116", recentForm:["W","W","D","W","W","D","W","L","W","W"],
    goalsScored:1.8, goalsConceded:1.0, starPlayerValue:82, starPlayer:"L. Díaz" },
  { id:27, name:"Corea del Sur",  shortName:"KOR", flag:"🇰🇷", group:"G", confederation:"AFC",
    fifaRanking:23, color:"#cd2e3a", recentForm:["W","W","D","W","L","W","D","W","W","D"],
    goalsScored:1.5, goalsConceded:1.2, starPlayerValue:82, starPlayer:"Son Heung-min" },
  { id:28, name:"Côte d'Ivoire",  shortName:"CIV", flag:"🇨🇮", group:"G", confederation:"CAF",
    fifaRanking:50, color:"#f77f00", recentForm:["W","D","W","L","W","D","L","W","D","W"],
    goalsScored:1.1, goalsConceded:1.4, starPlayerValue:55, starPlayer:"F. Koné" },

  // ——— GRUPO H ———
  { id:29, name:"Portugal",       shortName:"POR", flag:"🇵🇹", group:"H", confederation:"UEFA",
    fifaRanking:6,  color:"#006600", recentForm:["W","W","W","W","D","W","D","W","W","W"],
    goalsScored:2.2, goalsConceded:0.9, starPlayerValue:93, starPlayer:"C. Ronaldo" },
  { id:30, name:"Costa Rica",     shortName:"CRC", flag:"🇨🇷", group:"H", confederation:"CONCACAF",
    fifaRanking:47, color:"#002b7f", recentForm:["D","W","L","D","W","L","W","D","L","W"],
    goalsScored:1.0, goalsConceded:1.6, starPlayerValue:50, starPlayer:"K. Fuller" },
  { id:31, name:"Iraq",           shortName:"IRQ", flag:"🇮🇶", group:"H", confederation:"AFC",
    fifaRanking:58, color:"#007a3d", recentForm:["W","D","L","W","W","D","L","W","D","W"],
    goalsScored:1.1, goalsConceded:1.5, starPlayerValue:44, starPlayer:"A. Ali" },
  { id:32, name:"Egipto",         shortName:"EGY", flag:"🇪🇬", group:"H", confederation:"CAF",
    fifaRanking:38, color:"#ce1126", recentForm:["W","W","D","W","L","W","D","L","W","W"],
    goalsScored:1.3, goalsConceded:1.2, starPlayerValue:68, starPlayer:"M. Salah" },

  // ——— GRUPO I ———
  { id:33, name:"Países Bajos",   shortName:"NED", flag:"🇳🇱", group:"I", confederation:"UEFA",
    fifaRanking:7,  color:"#ff6600", recentForm:["W","D","W","W","D","W","W","L","W","D"],
    goalsScored:1.9, goalsConceded:0.9, starPlayerValue:87, starPlayer:"V. van Dijk" },
  { id:34, name:"Senegal",        shortName:"SEN", flag:"🇸🇳", group:"I", confederation:"CAF",
    fifaRanking:18, color:"#00853f", recentForm:["W","W","D","W","W","D","W","L","W","W"],
    goalsScored:1.7, goalsConceded:1.0, starPlayerValue:80, starPlayer:"S. Mané" },
  { id:35, name:"Uzbekistán",     shortName:"UZB", flag:"🇺🇿", group:"I", confederation:"AFC",
    fifaRanking:69, color:"#1eb53a", recentForm:["W","D","W","L","D","W","W","L","D","W"],
    goalsScored:1.0, goalsConceded:1.5, starPlayerValue:42, starPlayer:"J. Kholmatov" },
  { id:36, name:"Sudáfrica",      shortName:"RSA", flag:"🇿🇦", group:"I", confederation:"CAF",
    fifaRanking:59, color:"#007a4d", recentForm:["D","W","L","W","D","L","W","D","W","L"],
    goalsScored:1.0, goalsConceded:1.6, starPlayerValue:43, starPlayer:"P. Mofokeng" },

  // ——— GRUPO J ———
  { id:37, name:"Croacia",        shortName:"CRO", flag:"🇭🇷", group:"J", confederation:"UEFA",
    fifaRanking:10, color:"#171796", recentForm:["W","D","W","D","W","W","D","L","W","D"],
    goalsScored:1.5, goalsConceded:1.0, starPlayerValue:83, starPlayer:"L. Modrić" },
  { id:38, name:"Serbia",         shortName:"SRB", flag:"🇷🇸", group:"J", confederation:"UEFA",
    fifaRanking:24, color:"#c6363c", recentForm:["W","D","W","L","W","D","W","W","L","W"],
    goalsScored:1.5, goalsConceded:1.2, starPlayerValue:75, starPlayer:"D. Vlahovic" },
  { id:39, name:"Jordania",       shortName:"JOR", flag:"🇯🇴", group:"J", confederation:"AFC",
    fifaRanking:73, color:"#007a3d", recentForm:["W","L","D","W","L","W","D","L","W","D"],
    goalsScored:0.9, goalsConceded:1.7, starPlayerValue:38, starPlayer:"Y. Al-Naimat" },
  { id:40, name:"Ghana",          shortName:"GHA", flag:"🇬🇭", group:"J", confederation:"CAF",
    fifaRanking:60, color:"#006b3f", recentForm:["D","W","L","W","D","L","W","D","W","L"],
    goalsScored:1.1, goalsConceded:1.5, starPlayerValue:55, starPlayer:"J. Ayew" },

  // ——— GRUPO K ———
  { id:41, name:"Suiza",          shortName:"SUI", flag:"🇨🇭", group:"K", confederation:"UEFA",
    fifaRanking:19, color:"#ff0000", recentForm:["W","D","W","D","W","W","L","W","D","W"],
    goalsScored:1.6, goalsConceded:1.1, starPlayerValue:73, starPlayer:"X. Shaqiri" },
  { id:42, name:"Turquía",        shortName:"TUR", flag:"🇹🇷", group:"K", confederation:"UEFA",
    fifaRanking:29, color:"#e30a17", recentForm:["W","W","D","W","L","D","W","W","D","W"],
    goalsScored:1.5, goalsConceded:1.2, starPlayerValue:72, starPlayer:"H. Çalhanoğlu" },
  { id:43, name:"Indonesia",      shortName:"IDN", flag:"🇮🇩", group:"K", confederation:"AFC",
    fifaRanking:88, color:"#ce1126", recentForm:["L","D","W","L","W","D","L","W","L","D"],
    goalsScored:0.8, goalsConceded:2.0, starPlayerValue:30, starPlayer:"M. Struijk" },
  { id:44, name:"Nueva Zelanda",  shortName:"NZL", flag:"🇳🇿", group:"K", confederation:"OFC",
    fifaRanking:95, color:"#00247d", recentForm:["D","L","W","D","L","W","D","L","W","D"],
    goalsScored:0.8, goalsConceded:2.0, starPlayerValue:35, starPlayer:"C. Wood" },

  // ——— GRUPO L ———
  { id:45, name:"Austria",        shortName:"AUT", flag:"🇦🇹", group:"L", confederation:"UEFA",
    fifaRanking:20, color:"#ed2939", recentForm:["W","D","W","W","D","L","W","D","W","W"],
    goalsScored:1.7, goalsConceded:1.1, starPlayerValue:75, starPlayer:"M. Sabitzer" },
  { id:46, name:"Dinamarca",      shortName:"DEN", flag:"🇩🇰", group:"L", confederation:"UEFA",
    fifaRanking:21, color:"#c60c30", recentForm:["W","D","W","W","L","W","D","W","W","D"],
    goalsScored:1.6, goalsConceded:1.0, starPlayerValue:77, starPlayer:"C. Eriksen" },
  { id:47, name:"Hungría",        shortName:"HUN", flag:"🇭🇺", group:"L", confederation:"UEFA",
    fifaRanking:30, color:"#477050", recentForm:["W","D","L","W","W","D","L","W","D","W"],
    goalsScored:1.3, goalsConceded:1.4, starPlayerValue:65, starPlayer:"D. Szoboszlai" },
  { id:48, name:"Túnez",          shortName:"TUN", flag:"🇹🇳", group:"L", confederation:"CAF",
    fifaRanking:31, color:"#e70013", recentForm:["W","D","L","W","W","D","L","W","D","W"],
    goalsScored:1.2, goalsConceded:1.5, starPlayerValue:58, starPlayer:"W. Khazri" },
];

// ——— FIXTURES (72 partidos de fase de grupos — 3 por grupo × 12 grupos) ———
// homeGoals/awayGoals: null = no jugado, número = resultado
const FIXTURES = [
  // == GRUPO A ==
  { id:1,  group:"A", matchday:1, date:"2026-06-11", time:"15:00", home:"USA", away:"MAR", homeGoals:null, awayGoals:null },
  { id:2,  group:"A", matchday:1, date:"2026-06-11", time:"18:00", home:"URU", away:"PAN", homeGoals:null, awayGoals:null },
  { id:3,  group:"A", matchday:2, date:"2026-06-16", time:"15:00", home:"USA", away:"PAN", homeGoals:null, awayGoals:null },
  { id:4,  group:"A", matchday:2, date:"2026-06-16", time:"18:00", home:"MAR", away:"URU", homeGoals:null, awayGoals:null },
  { id:5,  group:"A", matchday:3, date:"2026-06-23", time:"20:00", home:"USA", away:"URU", homeGoals:null, awayGoals:null },
  { id:6,  group:"A", matchday:3, date:"2026-06-23", time:"20:00", home:"MAR", away:"PAN", homeGoals:null, awayGoals:null },

  // == GRUPO B ==
  { id:7,  group:"B", matchday:1, date:"2026-06-12", time:"15:00", home:"MEX", away:"ECU", homeGoals:null, awayGoals:null },
  { id:8,  group:"B", matchday:1, date:"2026-06-12", time:"18:00", home:"POL", away:"CMR", homeGoals:null, awayGoals:null },
  { id:9,  group:"B", matchday:2, date:"2026-06-17", time:"15:00", home:"MEX", away:"POL", homeGoals:null, awayGoals:null },
  { id:10, group:"B", matchday:2, date:"2026-06-17", time:"18:00", home:"ECU", away:"CMR", homeGoals:null, awayGoals:null },
  { id:11, group:"B", matchday:3, date:"2026-06-24", time:"20:00", home:"MEX", away:"CMR", homeGoals:null, awayGoals:null },
  { id:12, group:"B", matchday:3, date:"2026-06-24", time:"20:00", home:"ECU", away:"POL", homeGoals:null, awayGoals:null },

  // == GRUPO C ==
  { id:13, group:"C", matchday:1, date:"2026-06-12", time:"21:00", home:"CAN", away:"HON", homeGoals:null, awayGoals:null },
  { id:14, group:"C", matchday:1, date:"2026-06-13", time:"12:00", home:"JPN", away:"GEO", homeGoals:null, awayGoals:null },
  { id:15, group:"C", matchday:2, date:"2026-06-18", time:"18:00", home:"CAN", away:"JPN", homeGoals:null, awayGoals:null },
  { id:16, group:"C", matchday:2, date:"2026-06-18", time:"15:00", home:"GEO", away:"HON", homeGoals:null, awayGoals:null },
  { id:17, group:"C", matchday:3, date:"2026-06-25", time:"20:00", home:"CAN", away:"GEO", homeGoals:null, awayGoals:null },
  { id:18, group:"C", matchday:3, date:"2026-06-25", time:"20:00", home:"JPN", away:"HON", homeGoals:null, awayGoals:null },

  // == GRUPO D ==
  { id:19, group:"D", matchday:1, date:"2026-06-13", time:"15:00", home:"ARG", away:"KSA", homeGoals:null, awayGoals:null },
  { id:20, group:"D", matchday:1, date:"2026-06-13", time:"18:00", home:"ESP", away:"MLI", homeGoals:null, awayGoals:null },
  { id:21, group:"D", matchday:2, date:"2026-06-19", time:"15:00", home:"ARG", away:"MLI", homeGoals:null, awayGoals:null },
  { id:22, group:"D", matchday:2, date:"2026-06-19", time:"18:00", home:"ESP", away:"KSA", homeGoals:null, awayGoals:null },
  { id:23, group:"D", matchday:3, date:"2026-06-26", time:"20:00", home:"ARG", away:"ESP", homeGoals:null, awayGoals:null },
  { id:24, group:"D", matchday:3, date:"2026-06-26", time:"20:00", home:"KSA", away:"MLI", homeGoals:null, awayGoals:null },

  // == GRUPO E ==
  { id:25, group:"E", matchday:1, date:"2026-06-14", time:"12:00", home:"BRA", away:"AUS", homeGoals:null, awayGoals:null },
  { id:26, group:"E", matchday:1, date:"2026-06-14", time:"15:00", home:"GER", away:"COD", homeGoals:null, awayGoals:null },
  { id:27, group:"E", matchday:2, date:"2026-06-20", time:"15:00", home:"BRA", away:"GER", homeGoals:null, awayGoals:null },
  { id:28, group:"E", matchday:2, date:"2026-06-20", time:"18:00", home:"AUS", away:"COD", homeGoals:null, awayGoals:null },
  { id:29, group:"E", matchday:3, date:"2026-06-27", time:"20:00", home:"BRA", away:"COD", homeGoals:null, awayGoals:null },
  { id:30, group:"E", matchday:3, date:"2026-06-27", time:"20:00", home:"GER", away:"AUS", homeGoals:null, awayGoals:null },

  // == GRUPO F ==
  { id:31, group:"F", matchday:1, date:"2026-06-14", time:"18:00", home:"FRA", away:"VEN", homeGoals:null, awayGoals:null },
  { id:32, group:"F", matchday:1, date:"2026-06-15", time:"12:00", home:"IRN", away:"NGA", homeGoals:null, awayGoals:null },
  { id:33, group:"F", matchday:2, date:"2026-06-20", time:"21:00", home:"FRA", away:"IRN", homeGoals:null, awayGoals:null },
  { id:34, group:"F", matchday:2, date:"2026-06-21", time:"12:00", home:"VEN", away:"NGA", homeGoals:null, awayGoals:null },
  { id:35, group:"F", matchday:3, date:"2026-06-27", time:"16:00", home:"FRA", away:"NGA", homeGoals:null, awayGoals:null },
  { id:36, group:"F", matchday:3, date:"2026-06-27", time:"16:00", home:"VEN", away:"IRN", homeGoals:null, awayGoals:null },

  // == GRUPO G ==
  { id:37, group:"G", matchday:1, date:"2026-06-15", time:"15:00", home:"ENG", away:"KOR", homeGoals:null, awayGoals:null },
  { id:38, group:"G", matchday:1, date:"2026-06-15", time:"18:00", home:"COL", away:"CIV", homeGoals:null, awayGoals:null },
  { id:39, group:"G", matchday:2, date:"2026-06-21", time:"18:00", home:"ENG", away:"COL", homeGoals:null, awayGoals:null },
  { id:40, group:"G", matchday:2, date:"2026-06-21", time:"15:00", home:"KOR", away:"CIV", homeGoals:null, awayGoals:null },
  { id:41, group:"G", matchday:3, date:"2026-06-28", time:"20:00", home:"ENG", away:"CIV", homeGoals:null, awayGoals:null },
  { id:42, group:"G", matchday:3, date:"2026-06-28", time:"20:00", home:"COL", away:"KOR", homeGoals:null, awayGoals:null },

  // == GRUPO H ==
  { id:43, group:"H", matchday:1, date:"2026-06-16", time:"15:00", home:"POR", away:"IRQ", homeGoals:null, awayGoals:null },
  { id:44, group:"H", matchday:1, date:"2026-06-16", time:"18:00", home:"EGY", away:"CRC", homeGoals:null, awayGoals:null },
  { id:45, group:"H", matchday:2, date:"2026-06-22", time:"15:00", home:"POR", away:"EGY", homeGoals:null, awayGoals:null },
  { id:46, group:"H", matchday:2, date:"2026-06-22", time:"18:00", home:"CRC", away:"IRQ", homeGoals:null, awayGoals:null },
  { id:47, group:"H", matchday:3, date:"2026-07-01", time:"20:00", home:"POR", away:"CRC", homeGoals:null, awayGoals:null },
  { id:48, group:"H", matchday:3, date:"2026-07-01", time:"20:00", home:"EGY", away:"IRQ", homeGoals:null, awayGoals:null },

  // == GRUPO I ==
  { id:49, group:"I", matchday:1, date:"2026-06-16", time:"21:00", home:"NED", away:"UZB", homeGoals:null, awayGoals:null },
  { id:50, group:"I", matchday:1, date:"2026-06-17", time:"12:00", home:"SEN", away:"RSA", homeGoals:null, awayGoals:null },
  { id:51, group:"I", matchday:2, date:"2026-06-22", time:"21:00", home:"NED", away:"SEN", homeGoals:null, awayGoals:null },
  { id:52, group:"I", matchday:2, date:"2026-06-23", time:"12:00", home:"UZB", away:"RSA", homeGoals:null, awayGoals:null },
  { id:53, group:"I", matchday:3, date:"2026-07-02", time:"20:00", home:"NED", away:"RSA", homeGoals:null, awayGoals:null },
  { id:54, group:"I", matchday:3, date:"2026-07-02", time:"20:00", home:"SEN", away:"UZB", homeGoals:null, awayGoals:null },

  // == GRUPO J ==
  { id:55, group:"J", matchday:1, date:"2026-06-17", time:"15:00", home:"CRO", away:"GHA", homeGoals:null, awayGoals:null },
  { id:56, group:"J", matchday:1, date:"2026-06-17", time:"18:00", home:"SRB", away:"JOR", homeGoals:null, awayGoals:null },
  { id:57, group:"J", matchday:2, date:"2026-06-23", time:"18:00", home:"CRO", away:"SRB", homeGoals:null, awayGoals:null },
  { id:58, group:"J", matchday:2, date:"2026-06-23", time:"15:00", home:"JOR", away:"GHA", homeGoals:null, awayGoals:null },
  { id:59, group:"J", matchday:3, date:"2026-07-02", time:"16:00", home:"CRO", away:"JOR", homeGoals:null, awayGoals:null },
  { id:60, group:"J", matchday:3, date:"2026-07-02", time:"16:00", home:"SRB", away:"GHA", homeGoals:null, awayGoals:null },

  // == GRUPO K ==
  { id:61, group:"K", matchday:1, date:"2026-06-18", time:"15:00", home:"SUI", away:"IDN", homeGoals:null, awayGoals:null },
  { id:62, group:"K", matchday:1, date:"2026-06-18", time:"18:00", home:"TUR", away:"NZL", homeGoals:null, awayGoals:null },
  { id:63, group:"K", matchday:2, date:"2026-06-24", time:"15:00", home:"SUI", away:"TUR", homeGoals:null, awayGoals:null },
  { id:64, group:"K", matchday:2, date:"2026-06-24", time:"18:00", home:"IDN", away:"NZL", homeGoals:null, awayGoals:null },
  { id:65, group:"K", matchday:3, date:"2026-07-03", time:"20:00", home:"SUI", away:"NZL", homeGoals:null, awayGoals:null },
  { id:66, group:"K", matchday:3, date:"2026-07-03", time:"20:00", home:"TUR", away:"IDN", homeGoals:null, awayGoals:null },

  // == GRUPO L ==
  { id:67, group:"L", matchday:1, date:"2026-06-18", time:"21:00", home:"AUT", away:"HUN", homeGoals:null, awayGoals:null },
  { id:68, group:"L", matchday:1, date:"2026-06-19", time:"12:00", home:"DEN", away:"TUN", homeGoals:null, awayGoals:null },
  { id:69, group:"L", matchday:2, date:"2026-06-25", time:"15:00", home:"AUT", away:"DEN", homeGoals:null, awayGoals:null },
  { id:70, group:"L", matchday:2, date:"2026-06-25", time:"18:00", home:"HUN", away:"TUN", homeGoals:null, awayGoals:null },
  { id:71, group:"L", matchday:3, date:"2026-07-04", time:"20:00", home:"AUT", away:"TUN", homeGoals:null, awayGoals:null },
  { id:72, group:"L", matchday:3, date:"2026-07-04", time:"20:00", home:"DEN", away:"HUN", homeGoals:null, awayGoals:null },
];

// ——— CUOTAS DE CAMPEÓN (DoradoBet simulado) ———
const DORADOBET_ODDS = {
  ARG: { odds: 3.50,  impliedProb: 28.57 },
  FRA: { odds: 4.50,  impliedProb: 22.22 },
  BRA: { odds: 5.50,  impliedProb: 18.18 },
  ENG: { odds: 6.50,  impliedProb: 15.38 },
  ESP: { odds: 9.00,  impliedProb: 11.11 },
  GER: { odds: 11.00, impliedProb: 9.09  },
  POR: { odds: 12.00, impliedProb: 8.33  },
  NED: { odds: 15.00, impliedProb: 6.67  },
  CRO: { odds: 22.00, impliedProb: 4.55  },
  COL: { odds: 28.00, impliedProb: 3.57  },
  URU: { odds: 30.00, impliedProb: 3.33  },
  MAR: { odds: 35.00, impliedProb: 2.86  },
  SEN: { odds: 40.00, impliedProb: 2.50  },
  SUI: { odds: 45.00, impliedProb: 2.22  },
  TUR: { odds: 50.00, impliedProb: 2.00  },
  JPN: { odds: 50.00, impliedProb: 2.00  },
  KOR: { odds: 55.00, impliedProb: 1.82  },
  AUT: { odds: 60.00, impliedProb: 1.67  },
  DEN: { odds: 65.00, impliedProb: 1.54  },
  EGY: { odds: 70.00, impliedProb: 1.43  },
  SRB: { odds: 75.00, impliedProb: 1.33  },
  USA: { odds: 80.00, impliedProb: 1.25  },
  MEX: { odds: 85.00, impliedProb: 1.18  },
  ECU: { odds: 90.00, impliedProb: 1.11  },
  NGA: { odds: 95.00, impliedProb: 1.05  },
  IRN: { odds:100.00, impliedProb: 1.00  },
  POL: { odds:110.00, impliedProb: 0.91  },
  CAN: { odds:120.00, impliedProb: 0.83  },
  AUS: { odds:130.00, impliedProb: 0.77  },
  CMR: { odds:140.00, impliedProb: 0.71  },
  GHA: { odds:160.00, impliedProb: 0.63  },
  HUN: { odds:175.00, impliedProb: 0.57  },
  CIV: { odds:200.00, impliedProb: 0.50  },
  VEN: { odds:200.00, impliedProb: 0.50  },
  IRQ: { odds:250.00, impliedProb: 0.40  },
  UZB: { odds:250.00, impliedProb: 0.40  },
  KSA: { odds:300.00, impliedProb: 0.33  },
  CRC: { odds:300.00, impliedProb: 0.33  },
  RSA: { odds:350.00, impliedProb: 0.29  },
  JOR: { odds:400.00, impliedProb: 0.25  },
  TUN: { odds:400.00, impliedProb: 0.25  },
  GEO: { odds:450.00, impliedProb: 0.22  },
  HON: { odds:500.00, impliedProb: 0.20  },
  MLI: { odds:500.00, impliedProb: 0.20  },
  PAN: { odds:500.00, impliedProb: 0.20  },
  COD: { odds:600.00, impliedProb: 0.17  },
  NZL: { odds:700.00, impliedProb: 0.14  },
  IDN: { odds:750.00, impliedProb: 0.13  },
};

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
