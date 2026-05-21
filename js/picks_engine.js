// ============================================================
//  PICKS_ENGINE.JS — Motor Autónomo de Recomendaciones
//
//  Genera automáticamente los mejores picks para cada partido
//  próximo del Mundial, cruzando el modelo Poisson + cuotas
//  simuladas de DoradoBet + perfil dinámico del árbitro.
//
//  El output se almacena en AppState y dispara un evento
//  'picks-update' para que el dashboard se actualice.
// ============================================================

const PicksEngine = {

  // ── Umbrales de filtrado ────────────────────────────────────
  MIN_EDGE:            0.015,  // 1.5% edge mínimo
  MIN_MODEL_PROB:      0.30,   // Modelo debe dar al menos 30%
  MAX_ODDS:            6.00,   // No recomendar cuotas > 6.00
  MIN_ODDS:            1.10,   // Ni < 1.10 (muy poco valor)
  TOP_PICKS_PER_MATCH: 3,      // Máx picks destacados por partido

  // ── Confianza (1–5 estrellas) ───────────────────────────────
  _stars(edge, modelProb) {
    if (edge >= 0.08 && modelProb >= 0.65) return 5;
    if (edge >= 0.05 && modelProb >= 0.55) return 4;
    if (edge >= 0.03 && modelProb >= 0.45) return 3;
    if (edge >= 0.02 && modelProb >= 0.38) return 2;
    return 1;
  },

  // ── Justificación detallada ─────────────────────────────────
  /**
   * Genera una justificación rica en datos para cada mercado.
   * @param {string} marketId
   * @param {number} modelProb   [0..1]
   * @param {number} edge        [0..1]
   * @param {Object} analysis    output de mmAnalyzeMatch
   * @param {Object} refProfile  perfil árbitro dinámico
   * @param {Object} pick        objeto de mercado { odds, impliedProb }
   */
  _justify(marketId, modelProb, edge, analysis, refProfile, pick = {}) {
    const pct     = (modelProb * 100).toFixed(1);
    const edgePct = (edge * 100).toFixed(1);
    const impl    = pick.impliedProb
      ? (pick.impliedProb * 100).toFixed(1)
      : ((modelProb - edge) * 100).toFixed(1);
    const oddsStr = pick.odds ? pick.odds.toFixed(2) : '?';

    // Lambdas de goles
    const lH  = analysis.lambdas.home.toFixed(2);
    const lA  = analysis.lambdas.away.toFixed(2);
    const lT  = analysis.lambdas.total.toFixed(2);

    // Nombres de equipos
    const hName = analysis.meta?.home?.name  || 'Local';
    const aName = analysis.meta?.away?.name  || 'Visitante';
    const hFlag = analysis.meta?.home?.flag  || '🏠';
    const aFlag = analysis.meta?.away?.flag  || '✈️';

    // Lambdas de córners
    const cL    = analysis.corners || {};
    const lcT   = cL.lambda_total ? cL.lambda_total.toFixed(1) : '?';
    const lcH   = cL.lambda_home  ? cL.lambda_home.toFixed(1)  : '?';
    const lcA   = cL.lambda_away  ? cL.lambda_away.toFixed(1)  : '?';

    // Datos de tarjetas
    const cd    = analysis.cards || {};
    const expY  = cd.expected_yellows ? cd.expected_yellows.toFixed(1) : '?';
    const expR  = cd.expected_reds    ? cd.expected_reds.toFixed(2)    : '?';
    const expPts= cd.expected_points  ? cd.expected_points.toFixed(0)  : '?';

    // Marcador más probable
    const topScore = analysis.exact_scores?.[0]?.label || '?';

    // 1X2 probabilities
    const r     = analysis.result_1x2;
    const pHome = r ? (r.home * 100).toFixed(1) : '?';
    const pDraw = r ? (r.draw * 100).toFixed(1) : '?';
    const pAway = r ? (r.away * 100).toFixed(1) : '?';

    // Perfil árbitro
    const hasRef  = refProfile && refProfile.name && refProfile.id !== 'default';
    const refLine = hasRef
      ? `${refProfile.flag || ''} ${refProfile.name} promedia ${refProfile.avg_yellows?.toFixed(1)} 🟨 y ${refProfile.avg_reds?.toFixed(3)} 🟥/partido (strictness ${refProfile.strictness?.toFixed(2)}×).`
      : 'Árbitro con perfil FIFA estándar.';
    const refImpact = hasRef && refProfile.strictness >= 1.1
      ? 'Su strictness alta eleva significativamente la esperanza de tarjetas respecto a la media.'
      : hasRef && refProfile.strictness <= 0.9
      ? 'Su strictness baja reduce la esperanza de tarjetas, favoreciendo los mercados Under.'
      : '';

    const map = {

      // ── Resultado Final ──────────────────────────────────────
      home: [
        `Apuesta recomendada: Victoria de ${hFlag} ${hName} (cuota ${oddsStr}).`,
        `El Modelo Poisson asigna λ=${lH} goles esperados al local frente a λ=${lA} del visitante.`,
        `Probabilidad de victoria local: ${pct}%. DoradoBet implica solo ${impl}% (diferencia de +${edgePct}pp a tu favor).`,
        `Marcador más probable: ${topScore}. Ventaja de campo y mayor xG sostienen esta apuesta.`,
      ],

      draw: [
        `Apuesta recomendada: Empate (cuota ${oddsStr}).`,
        `Con λ local=${lH} y λ visitante=${lA} (total ${lT}), la baja frecuencia de goles concentra probabilidad en marcadores igualados (0-0, 1-1).`,
        `El modelo calcula ${pct}% de empate frente al ${impl}% implícito de la casa. Edge +${edgePct}pp.`,
        `Marcador más probable: ${topScore}. Equilibrio táctico entre ambos planteles.`,
      ],

      away: [
        `Apuesta recomendada: Victoria de ${aFlag} ${aName} (cuota ${oddsStr}).`,
        `Visitante infravalorado por el mercado: λ=${lA} goles esperados (${pAway}% de probabilidad según modelo).`,
        `DoradoBet solo asigna ${impl}%, generando un edge de +${edgePct}pp. Las cuotas de visitante son el mercado donde la casa comete más errores de precio.`,
        `Marcador más probable del match: ${topScore}.`,
      ],

      dc_1x: [
        `Apuesta recomendada: Doble Oportunidad 1X — ${hFlag} ${hName} no pierde (cuota ${oddsStr}).`,
        `Victoria local (${pHome}%) + Empate (${pDraw}%) = ${pct}% de probabilidad combinada.`,
        `DoradoBet implica ${impl}%. Edge +${edgePct}pp con el colchón del empate.`,
        `Ideal si percibes al local como favorito pero el partido puede ser equilibrado.`,
      ],

      dc_x2: [
        `Apuesta recomendada: Doble Oportunidad X2 — ${aFlag} ${aName} no pierde (cuota ${oddsStr}).`,
        `Victoria visitante (${pAway}%) + Empate (${pDraw}%) = ${pct}% de probabilidad combinada.`,
        `Casa implica ${impl}%. Edge +${edgePct}pp. Mercado de cobertura eficiente cuando λ visitante es competitivo.`,
        `El empate actúa como seguro ante resultado ajustado.`,
      ],

      // ── Goles ────────────────────────────────────────────────
      over15: [
        `Apuesta recomendada: Más de 1.5 Goles (cuota ${oddsStr}).`,
        `Con λ total ${lT} goles esperados, P(≥2 goles) = ${pct}% según la distribución de Poisson.`,
        `DoradoBet asigna ${impl}%. Edge +${edgePct}pp en un mercado considerado "seguro" por el mercado.`,
        `Bajo riesgo relativo: solo se necesita 2 goles en 90 minutos.`,
      ],

      over25: [
        `Apuesta recomendada: Más de 2.5 Goles (cuota ${oddsStr}).`,
        `${hFlag} ${hName} (λ=${lH}) y ${aFlag} ${aName} (λ=${lA}) suman ${lT} goles esperados.`,
        `P(>2.5 goles) = ${pct}% según Poisson-Dixon/Coles frente al ${impl}% que implica la cuota.`,
        `Marcador más probable: ${topScore}. Edge +${edgePct}pp; las casas suelen pagar de menos el Over cuando ambos ataques son productivos.`,
      ],

      under25: [
        `Apuesta recomendada: Menos de 2.5 Goles (cuota ${oddsStr}).`,
        `λ total = ${lT} — partido de bajo voltaje ofensivo esperado. P(≤2 goles) = ${pct}%.`,
        `DoradoBet sobrevalora el Over asignando solo ${impl}% al Under. Edge +${edgePct}pp.`,
        `El marcador más probable (${topScore}) confirma el perfil táctico cerrado. Línea con gran valor en partidos de grupos donde un empate sirve a ambos.`,
      ],

      over35: [
        `Apuesta recomendada: Más de 3.5 Goles (cuota ${oddsStr}).`,
        `Partido muy ofensivo: λ local=${lH} + λ visitante=${lA} = ${lT} goles esperados.`,
        `P(>3.5) = ${pct}% según la matriz bivariada. Casa implica ${impl}%. Edge +${edgePct}pp.`,
        `Los tres marcadores más probables incluyen al menos 3 goles. La casa subvalora la capacidad atacante combinada.`,
      ],

      btts_yes: [
        `Apuesta recomendada: Ambos Equipos Anotan — Sí (cuota ${oddsStr}).`,
        `${hFlag} ${hName} (λ=${lH}) tiene alta probabilidad de marcar; ${aFlag} ${aName} (λ=${lA}) también amenaza.`,
        `P(BTTS Sí) = ${pct}% según Poisson bivariado. DoradoBet asigna ${impl}%. Edge +${edgePct}pp.`,
        `La casa infravalora la capacidad goleadora del visitante, que es donde suele haber mayor error de precio.`,
      ],

      btts_no: [
        `Apuesta recomendada: Ambos Equipos Anotan — No (cuota ${oddsStr}).`,
        `Al menos un equipo se queda sin marcar. Con λ local=${lH} y λ visitante=${lA}, P(BTTS No) = ${pct}%.`,
        `DoradoBet implica ${impl}%, sobrevalorando las expectativas goleadoras. Edge +${edgePct}pp.`,
        `Marcador más probable ${topScore} — uno de los equipos tiene λ baja que favorece el blanqueo.`,
      ],

      // ── Córners ──────────────────────────────────────────────
      c_over85: [
        `Apuesta recomendada: Córners Over 8.5 (cuota ${oddsStr}).`,
        `λ córners = ${lcT} totales: ${lcH} local + ${lcA} visitante. P(>8.5 córners) = ${pct}%.`,
        `Casa implica ${impl}%. Edge +${edgePct}pp. Los córners son el mercado donde los modelos que incorporan pressing_intensity superan consistentemente a la casa.`,
        `Ambos equipos con índice de presión alto fuerzan muchas salidas de banda en los 90 minutos.`,
      ],

      c_over95: [
        `Apuesta recomendada: Córners Over 9.5 (cuota ${oddsStr}).`,
        `λ córners totales = ${lcT} (local ${lcH} / visitante ${lcA}). P(>9.5) = ${pct}%.`,
        `DoradoBet asigna implícita ${impl}%. Edge +${edgePct}pp. Las casas fijan este mercado con menos rigor estadístico que el 1X2, generando más oportunidades de valor sistemático.`,
        `Un equipo presionando alto fuerza córners defensivos; el otro lo explota en ataque.`,
      ],

      c_over105: [
        `Apuesta recomendada: Córners Over 10.5 (cuota ${oddsStr}).`,
        `Con λ total de córners ${lcT}, P(>10.5) = ${pct}%. Casa implica ${impl}%. Edge +${edgePct}pp.`,
        `Mercado de alta varianza donde la casa comete los mayores errores de precio del torneo.`,
        `Requiere pressing intenso de ambos: si algún equipo cierra en bloque bajo, el conteo puede bajar.`,
      ],

      c_under95: [
        `Apuesta recomendada: Córners Under 9.5 (cuota ${oddsStr}).`,
        `λ total córners = ${lcT} — nivel bajo que indica bloque defensivo y bajo pressing en banda.`,
        `P(≤9 córners) = ${pct}% frente al ${impl}% de DoradoBet. Edge +${edgePct}pp.`,
        `Partidos con táctica de contragolpe o 5-4-1 generan pocas llegadas en área que deriven en córners.`,
      ],

      // ── Tarjetas ─────────────────────────────────────────────
      pts_over255: [
        `Apuesta recomendada: Puntos Tarjetas Over 25.5 (cuota ${oddsStr}).`,
        `${refLine} El modelo estima ${expY} amarillas + ${expR} rojas esperadas = ${expPts} puntos medios (amarilla=10pts, roja directa=25pts).`,
        `P(>25.5 pts) = ${pct}%. DoradoBet implica ${impl}%. Edge +${edgePct}pp.`,
        `Umbral fácil de superar: solo 3 amarillas (30 pts) ya superan la línea.`,
      ],

      pts_over355: [
        `Apuesta recomendada: Puntos Tarjetas Over 35.5 (cuota ${oddsStr}).`,
        `${refLine} ${refImpact}`,
        `Modelo: ${expY} amarillas esperadas + ${expR} rojas = ${expPts} puntos medios. P(>35.5) = ${pct}% vs ${impl}% implícito.`,
        `Edge +${edgePct}pp. Este mercado es donde los modelos que incorporan perfil de árbitro tienen mayor ventaja estructural sobre la casa.`,
      ],

      pts_over455: [
        `Apuesta recomendada: Puntos Tarjetas Over 45.5 (cuota ${oddsStr}).`,
        `${refLine} ${refImpact}`,
        `Con ${expPts} puntos esperados (λ amarillas=${expY}, λ rojas=${expR}), P(>45.5) = ${pct}%.`,
        `DoradoBet asigna solo ${impl}%, sin modelar el impacto del árbitro en la distribución de cola. Edge +${edgePct}pp. Requiere 5 amarillas o una roja + 3 amarillas.`,
      ],

      pts_under355: [
        `Apuesta recomendada: Puntos Tarjetas Under 35.5 (cuota ${oddsStr}).`,
        `${refLine} ${refImpact}`,
        `Con ${expPts} pts esperados, P(<35.5) = ${pct}% frente al ${impl}% que implica DoradoBet. Edge +${edgePct}pp.`,
        `Árbitro permisivo o equipos técnicos reducen la cola derecha de tarjetas. La casa sobreestima la disciplina en partidos de alta rivalidad.`,
      ],

      // ── Primer Gol ───────────────────────────────────────────
      fg_home: (() => {
        const fg = analysis.first_goal || {};
        const pNone = fg.none ? (fg.none * 100).toFixed(1) : '?';
        return [
          `Apuesta recomendada: ${hFlag} ${hName} Marca Primero (cuota ${oddsStr}).`,
          `Fórmula Poisson — P(local primero) = λH/(λH+λA) × (1-e^(-λH-λA)) = ${pct}% con λH=${lH}, λA=${lA}.`,
          `DoradoBet implica solo ${impl}%. Edge +${edgePct}pp. Las casas asignan este mercado sin modelar el λ diferencial entre equipos, generando errores sistemáticos.`,
          `P(sin goles) = ${pNone}%; P(${hFlag} primero) = ${pct}%. El local presiona más en los primeros 20 minutos, elevando su probabilidad de apertura del marcador.`,
        ];
      })(),

      fg_away: (() => {
        const fg = analysis.first_goal || {};
        const pNone = fg.none ? (fg.none * 100).toFixed(1) : '?';
        return [
          `Apuesta recomendada: ${aFlag} ${aName} Marca Primero (cuota ${oddsStr}).`,
          `P(visitante primero) = λA/(λH+λA) × (1-e^(-λH-λA)) = ${pct}% con λH=${lH}, λA=${lA}.`,
          `El mercado de primer gol visitante es el más infravalorado: casa implica ${impl}%, modelo dice ${pct}%. Edge +${edgePct}pp.`,
          `P(sin goles) = ${pNone}%; visitante con λ=${lA} suficiente para amenazar en transición. Las cuotas de alto perfil en este mercado suelen esconder valor real.`,
        ];
      })(),
    };

    const lines = map[marketId];
    if (lines) return lines.join(' ');
    return `El Modelo Poisson asigna ${pct}% de probabilidad a este mercado frente al ${impl}% que implica DoradoBet (cuota ${oddsStr}), generando un edge matemático de +${edgePct}pp.`;
  },

  /**
   * Genera picks para un partido específico.
   *
   * @param {string} homeKey   - shortName equipo local
   * @param {string} awayKey   - shortName equipo visitante
   * @param {number} fixtureId - Para obtener árbitro asignado
   * @returns {Promise<Object[]>} picks ordenados por valor
   */
  async generateForMatch(homeKey, awayKey, fixtureId = null) {
    // 1. Perfil dinámico del árbitro
    const refProfile = fixtureId
      ? RefEngine.getForFixture(fixtureId)
      : RefEngine.getProfile('default');

    // 2. Obtener cuotas (análisis + odds DoradoBet)
    const { analysis, odds, markets } = await OddsEngine.getOdds(homeKey, awayKey, refProfile);

    // 3. Filtrar y puntuar
    const picks = markets
      .filter(m =>
        m.edge      >= this.MIN_EDGE       &&
        m.modelProb >= this.MIN_MODEL_PROB &&
        m.odds      <= this.MAX_ODDS       &&
        m.odds      >= this.MIN_ODDS
      )
      .map(m => ({
        ...m,
        stars:         this._stars(m.edge, m.modelProb),
        justification: this._justify(m.id, m.modelProb, m.edge, analysis, refProfile, m),
        refProfile,
        homeKey, awayKey, fixtureId,
        generatedAt:   Date.now(),
      }))
      // Ordenar: primero los de mayor valor ajustado por confianza
      .sort((a, b) => (b.edge * b.stars) - (a.edge * a.stars))
      .slice(0, this.TOP_PICKS_PER_MATCH);

    return picks;
  },

  /**
   * Genera picks para todos los próximos partidos (no jugados).
   * Ejecuta en paralelo con Promise.allSettled.
   *
   * @param {number} limit - Máx partidos a analizar (default 8)
   * @returns {Promise<Object[]>} [ { fixture, picks[], refProfile } ]
   */
  async generateDailyPicks(limit = 8) {
    const upcoming = FIXTURES
      .filter(f => f.homeGoals === null && !f.liveStatus)
      .slice(0, limit);

    if (!upcoming.length) {
      console.warn('[PicksEngine] No hay partidos próximos para analizar.');
      return [];
    }

    console.log(`[PicksEngine] Analizando ${upcoming.length} partidos...`);

    const results = await Promise.allSettled(
      upcoming.map(f =>
        this.generateForMatch(f.home, f.away, f.id)
          .then(picks => ({
            fixture:    f,
            picks,
            refProfile: RefEngine.getForFixture(f.id),
          }))
      )
    );

    const daily = results
      .filter(r => r.status === 'fulfilled' && r.value.picks.length > 0)
      .map(r => r.value);

    // Persistir en AppState y notificar al dashboard
    AppState.setPicks(daily);
    console.log(`[PicksEngine] ✅ ${daily.length} partidos con picks generados.`);
    return daily;
  },

  /**
   * Retorna los picks más fuertes de todo el día (top global).
   * @param {number} n - Cuántos devolver
   */
  getTopPicks(n = 5) {
    return AppState.getPicks()
      .flatMap(({ fixture, picks }) => picks.map(p => ({ ...p, fixture })))
      .sort((a, b) => (b.edge * b.stars) - (a.edge * a.stars))
      .slice(0, n);
  },
};
