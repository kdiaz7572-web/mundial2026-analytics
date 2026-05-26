# Sistema de Parlays Inteligentes con Kelly Criterion v4.0
## Documentación Técnica - IA-Zak Groq Integration

---

## 1. RESUMEN EJECUTIVO

Se ha mejorado el sistema `api/chat.js` para que **Groq genere automáticamente parlays inteligentes** cuando el usuario pregunta sobre recomendaciones de apuestas para un partido específico.

### Cambios Realizados:
- ✅ Sección de prompts ampliada con instrucciones de parlay generation
- ✅ Sistema de correlación entre eventos (positiva, negativa, fuerte)
- ✅ Tres perfiles de riesgo: Conservador (Kelly 3-5%), Moderado (Kelly 5-8%), Agresivo (Kelly 10-15%)
- ✅ Cálculo de probabilidades combinadas con ajuste por correlación
- ✅ Integración con FerXxxa Intel para validar contra opinión comunitaria
- ✅ Output JSON ampliado: ahora incluye `recommended_parlays` array

---

## 2. ESTRUCTURA DE UN PARLAY

Cada parlay en la respuesta de Groq tiene esta estructura JSON:

```json
{
  "name": "Conservative - Argentina Win + Under 2.5",
  "events": [
    {
      "market": "1x2",
      "prediction": "home_win",
      "probability": 0.65,
      "odds": 1.75
    },
    {
      "market": "over_under",
      "prediction": "under_2.5",
      "probability": 0.45,
      "odds": 1.95
    }
  ],
  "combined_probability": 0.29,
  "combined_odds": 3.41,
  "correlation_adjustment": "0.85x (negative correlation - equilibrium bet)",
  "kelly_percentage": 4.2,
  "bankroll_amount_colones": 2100,
  "risk_profile": "conservative",
  "reasoning": "Explicación detallada de por qué este parlay tiene valor..."
}
```

### Campos Clave:
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `name` | Nombre descriptivo del parlay | "Conservador - Argentina Win + Under 2.5" |
| `events` | Array de eventos individuales | [Home Win, Under 2.5] |
| `combined_probability` | P1 × P2 × P3 × correlation_factor | 0.29 (29%) |
| `combined_odds` | O1 × O2 × O3 | 3.41 |
| `correlation_adjustment` | Factor de ajuste (0.85x - 1.15x) | "0.85x (negative)" |
| `kelly_percentage` | Kelly % para el parlay completo | 4.2% |
| `bankroll_amount_colones` | Monto exacto recomendado | ₡2,100 |
| `risk_profile` | conservative / moderate / aggressive | "conservative" |
| `reasoning` | Por qué este parlay tiene valor | Cita fuentes, explica correlación |

---

## 3. REGLAS DE CORRELACIÓN

### 3.1 Matriz de Correlación entre Mercados

```
┌─────────────────────┬──────────────────────┬─────────────────┬────────────┐
│ Evento 1            │ Evento 2             │ Correlación     │ Ajuste     │
├─────────────────────┼──────────────────────┼─────────────────┼────────────┤
│ Home Win            │ Over 2.5             │ POSITIVA        │ 1.05-1.10x │
│ Home Win            │ Under 2.5            │ NEGATIVA        │ 0.85-0.90x │
│ Home Win            │ BTTS Yes             │ MODERADA        │ 0.95-1.02x │
│ Home Win            │ Away Win             │ NEGATIVA FUERTE │ 0.70x      │
│ BTTS Yes            │ Over 2.5             │ MUY POSITIVA    │ 1.08-1.15x │
│ BTTS Yes            │ Under 2.5            │ NEGATIVA FUERTE │ 0.75-0.80x │
│ Over 2.5            │ Corners > 9          │ POSITIVA        │ 1.03-1.06x │
│ Under 2.5           │ Corners < 8          │ POSITIVA        │ 1.04-1.07x │
└─────────────────────┴──────────────────────┴─────────────────┴────────────┘
```

### 3.2 Interpretación de Correlaciones

#### POSITIVA (ajuste 1.05x - 1.15x):
Los eventos se **refuerzan mutuamente**. Si uno sucede, aumenta probabilidad del otro.

**Ejemplo:** "Home Win" + "Over 2.5"
- Si equipo local es lo suficientemente fuerte para ganar, probablemente TAMBIÉN anote muchos goles
- Probabilidad individual: Home 65%, Over 60%
- **Sin ajuste:** 0.65 × 0.60 = 0.39 (39%)
- **Con ajuste 1.08x:** 0.39 × 1.08 = 0.42 (42%)
- Los eventos están LINKED: dominancia ofensiva → ambos suceden

#### NEGATIVA (ajuste 0.85x - 0.90x):
Los eventos **compiten entre sí**. Si uno sucede, reduce probabilidad del otro.

**Ejemplo:** "Home Win" + "Under 2.5"
- Equipo local gana, pero ¿cuántos goles? Si gana 1-0, sucede Under. Si gana 3-0, NO sucede.
- Probabilidad individual: Home 65%, Under 40%
- **Sin ajuste:** 0.65 × 0.40 = 0.26 (26%)
- **Con ajuste 0.87x:** 0.26 × 0.87 = 0.226 (22.6%)
- Los eventos son EQUILIBRIO: victoria local ≠ garantiza pocos goles

#### MUY POSITIVA (ajuste 1.08x - 1.15x):
Los eventos están **fuertemente acoplados**.

**Ejemplo:** "BTTS Yes" + "Over 2.5"
- Si ambos equipos anotan, casi SIEMPRE hay >2.5 goles totales
- Probabilidad individual: BTTS 58%, Over 60%
- **Sin ajuste:** 0.58 × 0.60 = 0.348 (34.8%)
- **Con ajuste 1.12x:** 0.348 × 1.12 = 0.39 (39%)
- Los eventos son PRÁCTICAMENTE IDÉNTICOS en requirements

---

## 4. FÓRMULA DE KELLY PARA PARLAYS

### Paso 1: Calcular Probabilidad Combinada
```
P_combined = P1 × P2 × P3 × correlation_factor
```

### Paso 2: Calcular Odds Combinadas
```
O_combined = O1 × O2 × O3
```

### Paso 3: Calcular Edge del Parlay
```
Edge = (P_combined × O_combined) - 1
```

### Paso 4: Calcular Kelly %
```
Kelly_% = (Edge × P_combined) / O_combined

Simplificado:
Kelly_% = Edge × P_combined / O_combined
```

### Paso 5: Calcular Monto en ₡
```
Monto_₡ = Kelly_% × Bankroll
Máximo: ₡50,000 (cap recomendado)
```

### Ejemplo Completo:
```
Parlay: Argentina Win (P=0.65, O=1.75) + Under 2.5 (P=0.40, O=1.95)
Correlación: -0.15% (negative, ajuste 0.85x)

P_combined = 0.65 × 0.40 × 0.85 = 0.221 (22.1%)
O_combined = 1.75 × 1.95 = 3.4125
Edge = (0.221 × 3.4125) - 1 = 0.754 - 1 = -0.246 (negativo, pero pequeño)
Kelly_% = (-0.246 × 0.221) / 3.4125 = -0.016 = -1.6%

⚠️ Este ejemplo tiene EDGE NEGATIVO. Groq NO lo recomendaría.
```

### Ejemplo con Edge Positivo:
```
Parlay: Argentina Win (P=0.65, O=1.80) + BTTS (P=0.58, O=1.92)
Correlación: +0.02% (slight positive, ajuste 0.98x)

P_combined = 0.65 × 0.58 × 0.98 = 0.370 (37%)
O_combined = 1.80 × 1.92 = 3.456
Edge = (0.370 × 3.456) - 1 = 1.279 - 1 = 0.279 (27.9% edge)
Kelly_% = (0.279 × 0.370) / 3.456 = 0.030 = 3.0%

Con bankroll ₡50,000: Monto = 0.03 × 50,000 = ₡1,500

✅ PARLAY RECOMENDABLE: Expected value positivo 3%
```

---

## 5. PERFILES DE RIESGO

### 5.1 CONSERVADOR (Kelly 3-5%)

**Características:**
- Máximo 2 eventos en parlay
- Eventos anti-correlacionados (negativa o neutral)
- Probabilidad combinada alta (~25-30%)
- Odds bajas (~3.0-4.5)

**Ejemplo:** "Home Win + Under 2.5"

**Cuándo usar:**
- Bankroll < ₡20,000
- Risk-averse bettors
- Incertidumbre sobre match

**Payout esperado:**
- ₡1,500 apuesta → ₡4,500-6,750 retorno (3-4.5x)

---

### 5.2 MODERADO (Kelly 5-8%)

**Características:**
- 2-3 eventos en parlay
- Eventos balanceados (correlación mixta)
- Probabilidad combinada media (~20-25%)
- Odds medianas (~5.0-7.0)

**Ejemplo:** "Home Win + Over 2.5 + BTTS"

**Cuándo usar:**
- Bankroll ₡25,000-50,000
- Confianza media-alta en análisis
- Datos claros pero no definitivos

**Payout esperado:**
- ₡3,000 apuesta → ₡15,000-21,000 retorno (5-7x)

---

### 5.3 AGRESIVO (Kelly 10-15%)

**Características:**
- 3-4 eventos en parlay
- Eventos positivamente correlacionados
- Probabilidad combinada baja (~12-18%)
- Odds altas (~8.0-15.0)

**Ejemplo:** "Home Win + Over 2.5 + BTTS + Corners > 9"

**Cuándo usar:**
- Bankroll > ₡50,000
- Alta confianza en scenario específico
- Datos muy claros (xG, forma, injuries)

**Payout esperado:**
- ₡5,000 apuesta → ₡40,000-75,000 retorno (8-15x)

---

## 6. INTEGRACIÓN CON FERXXXA INTEL

### 6.1 Validación de Parlays

Cuando Groq genera parlays, SIEMPRE compara con FerXxxa chat data:

```
FerXxxa menciona: "46% apostadores Over+BTTS"

Groq evalúa:
- ¿Mi recomendación coincide? → "Sí, parlay MODERADO también Over+BTTS"
- ¿Divergo significativamente? → "No, aunque enfatizo correlación positiva"
- ¿Hay oportunidad de arbitrage? → "Si comunidad sobrepesa Over+BTTS, mi Conservative Over+Home es subvalorada"
```

### 6.2 Ajustes de Confianza

```json
{
  "ferxxxa_context": {
    "doradobet_consensus": "Argentina Win 68% apostadores",
    "consensus_matches_our_pick": true,
    "confidence_adjustment": "Sin ajuste - sentimiento muy positivo, pero odds también reflejan"
  }
}
```

### 6.3 Narrativas Trending

Si FerXxxa menciona: "Todos dicen Argentina goleador"

Groq busca: ¿Hay value en "Argentina Win + Under 2.5"?
- Si mayoría apuesta "Over", odds en "Under" pueden estar inflados
- Posible arbitrage contrarian

---

## 7. EXAMPLES DE CORRELACIÓN REAL

### 7.1 Argentina vs Francia (Ejemplo del Sistema)

**Análisis:**
- Argentina forma excelente (W-W-D)
- xG Argentina 1.8, Francia 0.9
- BTTS 58% probable

**Parlay 1 - Conservador (Neg. Correlation):**
```
Argentina Win (65%) + Under 2.5 (40%)
P_combined = 0.65 × 0.40 × 0.85 = 0.221 (22.1%)
Reasoning: Si Argentina gana fuerte (3-0), NO sucede Under.
           Si Argentina gana ajustado (1-0), SÍ sucede Under.
           Eventos EN COMPETENCIA → correlación negativa
```

**Parlay 2 - Moderado (Mixed Correlation):**
```
Argentina Win (65%) + Over 2.5 (60%) + BTTS (58%)
P_combined = 0.65 × 0.60 × 0.58 × 0.95 = 0.226 (22.6%)
Reasoning: Argentina dominancia IMPLICA goles. Over+BTTS muy correlacionados (1.12x).
           Win+Over menos ligados (0.92x). Promedio 0.98x ≈ 0.95x usado.
           Scenario: Argentina ofensiva, ambos anotan, >2.5 totales
```

**Parlay 3 - Agresivo (Pos. Correlation):**
```
Argentina Win (65%) + Over 2.5 (60%) + BTTS (58%) + Corners>10 (62%)
P_combined = 0.65 × 0.60 × 0.58 × 0.62 × 1.08 = 0.155 (15.5%)
Reasoning: TODOS los eventos implican partido ABIERTO Y EMOCIONANTE.
           Correlación fuerte positiva (1.08x) porque:
           - Argentina ganando → ambos anotan (más probable)
           - Ambos anotando → >2.5 goles (casi seguro)
           - Partido emocionante → muchos corners (indicador presión)
           Scenario: ¡FIESTA OFENSIVA! Todo sucede juntos
```

---

## 8. VALIDACIÓN Y TESTING

### 8.1 Request HTTP de Prueba

```bash
curl -X POST "https://mundial2026-analytics.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuál es la mejor combinada para Argentina vs Francia?",
    "session_id": "test_parlays_001",
    "language": "es",
    "bankroll": 50000
  }'
```

### 8.2 Response Esperada

```json
{
  "success": true,
  "recommended_parlays": [
    {
      "name": "Conservador - Argentina Win + Under 2.5",
      "events": [...],
      "combined_probability": 0.261,
      "combined_odds": 3.41,
      "kelly_percentage": 3.8,
      "bankroll_amount_colones": 1900,
      "risk_profile": "conservative",
      "correlation_adjustment": "0.85x (negative correlation)",
      "reasoning": "..."
    },
    {
      "name": "Moderado - Argentina Win + Over 2.5 + BTTS",
      "events": [...],
      "combined_probability": 0.226,
      "combined_odds": 6.17,
      "kelly_percentage": 6.8,
      "bankroll_amount_colones": 3400,
      "risk_profile": "moderate",
      "correlation_adjustment": "0.95x (high positive)",
      "reasoning": "..."
    },
    {
      "name": "Agresivo - Argentina Win + Over 2.5 + BTTS + Corners>10",
      "events": [...],
      "combined_probability": 0.14,
      "combined_odds": 11.87,
      "kelly_percentage": 10.2,
      "bankroll_amount_colones": 5100,
      "risk_profile": "aggressive",
      "correlation_adjustment": "1.08x (very high positive)",
      "reasoning": "..."
    }
  ],
  "ferxxxa_intel": {
    "available": true,
    "age_minutes": 45,
    "data_freshness": "fresh"
  }
}
```

### 8.3 Validación de Checklist

- ✅ `recommended_parlays` array con 3-5 opciones
- ✅ Cada parlay tiene `name`, `events`, `combined_probability`, `combined_odds`
- ✅ `kelly_percentage` variado (conservative 3-5%, moderate 5-8%, aggressive 10-15%)
- ✅ `bankroll_amount_colones` en rango ₡1,000-5,100 (respeta cap ₡50,000)
- ✅ `correlation_adjustment` documentado con factor (0.85x - 1.15x)
- ✅ `risk_profile` etiquetado correctamente
- ✅ `reasoning` cita fuentes y explica correlación
- ✅ FerXxxa intel incluido en respuesta
- ✅ Monto total (todos los parlays) < ₡50,000

---

## 9. CAMBIOS EN CÓDIGO

### 9.1 Archivos Modificados

**`api/chat.js`** (líneas 55-185):
- Sección "RECOMENDACIONES DE APUESTA" expandida con instrucciones de parlay
- Nuevo bloque "APUESTAS COMBINADAS INTELIGENTES" con reglas de correlación
- Tabla de matriz de correlación integrada en prompts
- Ejemplo JSON incluido en prompts para Groq

**Línea 503:**
```javascript
recommended_parlays: groqOutput.recommended_parlays || [],
```
Agregada para pasar parlays en respuesta final.

### 9.2 Cambios NO Realizados

- ❌ NO modificado: FerXxxa Intel fetch (líneas 306-367)
- ❌ NO modificado: estructura base de kelly_calculations
- ❌ NO modificado: database schema (_db.js)
- ❌ NO modificado: vercel.json
- ❌ Solo AGREGADO: nuevo campo `recommended_parlays`

---

## 10. INTERPRETACIÓN DE GROQ

### 10.1 Cómo Groq Usa las Instrucciones

El modelo recibe instructions en SYSTEM_PROMPT que dicen:

```
"CUANDO EL USUARIO PREGUNTA SOBRE UN PARTIDO, 
 SIEMPRE GENERAR 3-5 PARLAYS CON PERFILES DE RIESGO VARIADOS"
```

Groq genera JSON con:
1. **reasoning_chain**: Paso a paso cómo llegó a las recomendaciones
2. **kelly_calculations**: Para picks simples (mantiene estructura anterior)
3. **recommended_parlays**: NUEVO CAMPO con 3-5 opciones

### 10.2 Limitaciones de Groq (Expected Behavior)

Groq is a **Language Model**, no un motor de cálculo exacto:
- Algunos kelly_% pueden ser aproximados (±0.5%)
- Correlación puede no ser perfecta científicamente
- Razonamientos pueden variar según temperature (0.7)

**Solución:** Los valores son recomendaciones, no cálculos exactos. El usuario debe validar con su propia data.

### 10.3 Prompts Bilingües

- **Español** (es): Prompts líneas 55-109
- **Inglés** (en): Prompts líneas 111-185

Ambos idiomas tienen **idénticas** instrucciones de parlay (traducidas).

---

## 11. DIAGRAMA DE FLUJO

```
┌─────────────────────────────┐
│   User Query: "Argentina    │
│   vs Francia parlay?"       │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  SYSTEM_PROMPT (español/eng)│
│  - Paso a paso reasoning    │
│  - PARLAY INSTRUCTIONS      │
│  - Correlation rules        │
│  - Kelly formula            │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Groq LLM (Llama 3.3-70b)   │
│  Genera JSON response:      │
│  - reasoning_chain          │
│  - recommendations          │
│  - kelly_calculations       │
│  - recommended_parlays ✨   │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  api/chat.js (línea 503)    │
│  Extrae recommended_parlays │
│  Retorna en respuesta       │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Frontend recibe JSON con   │
│  3-5 parlays formateados    │
│  Kelly %, monto ₡, odds     │
└─────────────────────────────┘
```

---

## 12. CASOS DE USO

### Caso 1: Bankroll Bajo (₡5,000-10,000)
**Recomendación:** Solo Parlay CONSERVADOR
- 2 eventos, anti-correlacionados
- Kelly 3-4%
- Máximo ₡300-400 por parlay

### Caso 2: Bankroll Medio (₡25,000-50,000)
**Recomendación:** Conservador + Moderado
- Diversificar entre 2 parlays
- Kelly total 9-13%
- ₡1,500-3,000 por parlay

### Caso 3: Bankroll Alto (₡50,000+)
**Recomendación:** Todos 3 perfiles
- Kelly total 18-25%
- ₡1,900 (conservador) + ₡3,400 (moderado) + ₡5,100 (agresivo)
- Máximo cap ₡50,000 por recomendación

---

## 13. PRÓXIMAS MEJORAS (Future Work)

- [ ] Machine learning para ajustar correlation factors basado en histórico
- [ ] Real-time odds scraping para validar calculados vs. mercado real
- [ ] Heat maps de parlays populares vs. recomendados (arbitrage detection)
- [ ] Seguimiento automático: ¿Qué parlays ganaron/perdieron? ¿Groq acertó correlaciones?
- [ ] Integration con predictive modeling (xG, expected goals, goal probability)

---

## 14. REFERENCIAS

### Papers & Resources
- Kelly Criterion: "A New Interpretation of Information Rate" (J.L. Kelly Jr., 1956)
- Expected Value in Sports Betting: "Sharp Sports Betting" (Sharp, 2012)
- Correlation in Betting Markets: Academic research on dependent events

### Data Sources
- FBREF (Football Reference): form, recent matches
- Understat: xG, xA, advanced metrics
- API-Football: live odds, match details
- Transfermarkt: injuries, transfers
- FerXxxa Intel: community consensus

---

**Documento actualizado:** 2026-05-25
**Versión:** v4.0 (Parlays)
**Autor:** IA-Zak + Claude
**Estado:** PRODUCCIÓN
