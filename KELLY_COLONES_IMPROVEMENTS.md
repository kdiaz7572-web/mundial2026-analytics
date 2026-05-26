# IA-Zak v4.0 - Mejoras de Kelly Criterion en Colones

## Resumen de Cambios Realizados

Se han mejorado `/api/chat.js` para calcular recomendaciones de apuesta específicas en colones (₡) usando Kelly Criterion con explicaciones detalladas del por qué es la mejor apuesta.

---

## 1. Sistema Prompts Mejorado

### Para Spanish (es)
Se agregó una sección nueva **"RECOMENDACIONES DE APUESTA EN COLONES (₡)"** que instruye a Groq:

- **CANTIDAD EXACTA**: Incluir monto en ₡ (colones costarricenses)
- **FÓRMULA KELLY**: `kelly_% = (edge × probability) / odds`
  - Ejemplo: Si probabilidad=68%, odds=1.80
  - Edge = (0.68×1.80)-1 = 0.224 = 22.4%
  - kelly_% = (0.224 × 0.68) / 1.80 = 8.46% del bankroll

- **EXPLICACIÓN DEL POR QUÉ**:
  - Probabilidad estimada (basada en datos)
  - Edge calculado (ventaja matemática)
  - Riesgo vs recompensa (Risk of Ruin)

- **TIPO DE APUESTA**: 1x2 | Over/Under | BTTS | Combinada

- **VALIDACIÓN**:
  - Bankroll < ₡5,000 → Error "muy bajo"
  - Kelly % > 25% → ⚠️ Advertencia sobre Fractional Kelly
  - Máximo: ₡50,000

### Para English (en)
Misma estructura, adaptada al inglés con especificaciones para colones.

---

## 2. Funciones Utility Agregadas

### `calculateKellyCriterion(probability, odds)`
Calcula el porcentaje Kelly con fórmula matemática:

```javascript
const result = calculateKellyCriterion(0.68, 1.80);
// Retorna:
// {
//   kelly_percentage: 8.46,
//   edge: 22.4,
//   probability: 0.68,
//   odds: 1.80,
//   is_positive_ev: true,
//   fractional_kelly_half: 4.23,      // 50% Kelly (seguridad)
//   fractional_kelly_quarter: 2.12    // 25% Kelly (máximo seguridad)
// }
```

**Fórmula interna**:
```
edge = (probability × odds) - 1
kelly_% = (edge × probability) / odds
```

### `calculateBetSizeColones(kelly_percentage, bankroll, maxBet)`
Convierte Kelly % a monto en colones:

```javascript
const betSize = calculateBetSizeColones(8.46, 40000);
// Retorna:
// {
//   amount_colones: 3384,
//   kelly_percentage: 8.46,
//   bankroll: 40000,
//   is_capped: false,
//   warnings: []
// }
```

**Validaciones**:
- Bankroll < ₡5,000 → Error
- Kelly % > 25% → Advertencia Fractional Kelly
- Bet > ₡50,000 → Capped a ₡50,000

---

## 3. Contexto de Usuario Mejorado

Cuando se proporciona un `bankroll`, el sistema ahora:

1. **Valida el bankroll**:
   - `< ₡5,000` → Marca como inválido
   - `> ₡50,000` → Advierte sobre cap máximo

2. **Inyecta instrucciones en el system prompt**:
   ```
   - Bankroll: ₡40,000 (máximo de recomendación: ₡50,000)
   - Kelly Criterion enabled: Use kelly_% = (edge × probability) / odds
   ```

3. **Prepara validaciones** para la respuesta

---

## 4. Validación y Enriquecimiento de Respuesta

Antes de retornar, el endpoint ahora:

1. **Valida cálculos Kelly** de Groq
2. **Calcula valores faltantes**:
   - Si falta `kelly_percentage` → Calcula desde edge y probabilidad
   - Si falta `amount_colones` → Calcula desde kelly_% y bankroll
   - Si falta `risk_of_ruin` → Estima desde probabilidad

3. **Agrega advertencias automáticas**:
   - Kelly > 25% → Recomienda Fractional Kelly (50% del sugerido)
   - Bankroll < ₡5,000 → Error explícito en respuesta

4. **Retorna en respuesta JSON**:
   ```json
   {
     "response": "...",
     "kelly_calculations": {
       "bet_1": {
         "amount_colones": 3384,
         "kelly_percentage": 8.46,
         "bet_type": "1x2",
         "reasoning": "Argentina win with 68% probability, odds 1.80, edge 22.4%. Kelly suggests 8.46% of ₡40,000 = ₡3,384 for optimal bankroll growth",
         "probability": 0.68,
         "odds": 1.80,
         "edge": 0.224,
         "risk_of_ruin": 32.0
       },
       "warnings": []
     },
     "bankroll_warnings": ["Bankroll > ₡50,000: Cap bet recommendations at ₡50,000"],
     "language": "es"
   }
   ```

---

## 5. Ejemplo de Uso Completo

### Request
```bash
POST /api/chat
{
  "message": "¿Debería apostar a Argentina gana vs Francia si los odds son 1.80 y tengo ₡40,000?",
  "session_id": "user_12345",
  "language": "es",
  "bankroll": 40000
}
```

### Respuesta Esperada de Groq
```json
{
  "reasoning_chain": [
    "Paso 1: Usuario pregunta sobre apostar Argentina (odds 1.80) con ₡40,000",
    "Paso 2: Consulto forma Argentina (FBREF), Understat xG, Transfermarkt lesiones",
    "Paso 3: No hay conflictos - todas las fuentes indican Argentina favorita",
    "Paso 4: Calculo probabilidad = 68% basado en ELO y xG",
    "Paso 5: Edge = (0.68×1.80)-1 = 22.4%. Kelly % = (0.224×0.68)/1.80 = 8.46%",
    "Paso 6: Recomendación: ₡3,384 en 1x2 Argentina (8.46% de ₡40,000)"
  ],
  "analysis": "Argentina ha ganado 3 de sus últimos 4 partidos [FBREF: W-W-D-W]. Su xG promedio es 1.8 vs 0.9 del rival [Understat]. No hay lesiones de impacto. Con probabilidad estimada en 68%, los odds 1.80 ofrecen 22.4% de edge. Esto justifica una apuesta Kelly.",
  "data_sources_used": ["FBREF", "Understat", "Transfermarkt"],
  "uncertainties": ["Datos de Understat pueden tener 2-3 días de lag"],
  "confidence": "high",
  "recommendations": [
    "Apostar ₡3,384 a Argentina Gana (1x2) con odds 1.80",
    "Risk/Reward: 32% pérdida potencial vs 54% ganancia potencial"
  ],
  "kelly_calculations": {
    "bet_1": {
      "amount_colones": 3384,
      "kelly_percentage": 8.46,
      "bet_type": "1x2",
      "reasoning": "Argentina ganó 3/4 últimos, xG 1.8 vs 0.9 rival. Probabilidad 68% (ELO + xG). Odds 1.80 ofrecen 22.4% edge. Kelly 8.46% = ₡3,384. Crecimiento óptimo sin sobre-exponerse.",
      "probability": 0.68,
      "odds": 1.80,
      "edge": 0.224,
      "risk_of_ruin": 32.0
    },
    "warnings": []
  }
}
```

### Response Endpoint
```json
{
  "success": true,
  "message": "Analysis complete",
  "response": "...[análisis completo]...",
  "reasoning_chain": [...],
  "recommendations": ["Apostar ₡3,384 a Argentina Gana (1x2)..."],
  "kelly_calculations": {
    "bet_1": {
      "amount_colones": 3384,
      "kelly_percentage": 8.46,
      "bet_type": "1x2",
      "reasoning": "...",
      "probability": 0.68,
      "odds": 1.80,
      "edge": 0.224,
      "risk_of_ruin": 32.0
    }
  },
  "data_sources_used": ["FBREF", "Understat", "Transfermarkt"],
  "uncertainties": ["Datos de Understat pueden tener 2-3 días de lag"],
  "confidence": "high",
  "bankroll_impact": null,
  "language": "es"
}
```

---

## 6. Casos Edge Manejados

### Bankroll < ₡5,000
**Request**:
```json
{ "bankroll": 3000 }
```

**Response**:
```json
{
  "success": true,
  "bankroll_error": "Bankroll muy bajo (₡3,000). Mínimo recomendado para análisis Kelly: ₡5,000",
  "bankroll_warnings": ["Bankroll < ₡5,000: Too low for precise Kelly calculations"],
  "kelly_calculations": null
}
```

### Kelly % > 25% (Recomendación Fractional Kelly)
**Cálculo interno**:
- Kelly sugerido: 32%
- Advertencia agregada: "⚠️ Kelly alto (32%) - Considera Fractional Kelly (50% del sugerido = ₡6,400)"
- Bet size (full Kelly): ₡12,800 → capped a ₡50,000
- Bet size (50% Kelly): ₡6,400

---

## 7. Cambios de Código

### Archivo: `/api/chat.js`

#### A. Función `calculateKellyCriterion` (línea 35)
- Valida probabilidad y odds
- Calcula edge con validación de EV positivo
- Retorna kelly_%, edge, fractional_kelly (50% y 25%)

#### B. Función `calculateBetSizeColones` (línea 75)
- Convierte kelly_% a ₡
- Cap máximo: ₡50,000
- Warnings automáticos si kelly_% > 25%

#### C. System Prompts Mejorados (línea 106)
- Sección "RECOMENDACIONES DE APUESTA EN COLONES"
- Instrucciones Kelly explícitas
- Validaciones de bankroll

#### D. Contexto de Usuario (línea 237)
- Validación de bankroll (< ₡5,000 o > ₡50,000)
- Inyección de instrucciones Kelly en sistema
- Preparación de warnings

#### E. Validación de Respuesta (línea 372)
- Enriquecimiento automático de cálculos faltantes
- Capping a ₡50,000
- Advertencias Fractional Kelly
- Mensajes de error explícitos

---

## 8. Testing Manual

Prueba la mejora con estos prompts:

### Test 1: Kelly básico
```
¿Cuál sería mi apuesta Kelly para Argentina gana (68%, odds 1.80) con bankroll ₡40,000?
```
**Esperado**: ₡3,384 (8.46% Kelly)

### Test 2: Bankroll bajo
```
Tengo ₡2,000. ¿Puedo hacer apuestas Kelly?
```
**Esperado**: Error "Bankroll muy bajo (₡2,000)"

### Test 3: Kelly alto
```
¿Debería apostar 40% Kelly si los odds son muy buenos?
```
**Esperado**: Advertencia "⚠️ Kelly alto - Considera Fractional Kelly"

### Test 4: Combinada con múltiples apuestas
```
¿Cuál es mi Kelly para estas 3 apuestas combinadas?
```
**Esperado**: Respuesta JSON con bet_1, bet_2, bet_3 con cálculos separados

---

## 9. Resumen de Campos Esperados en JSON

```json
{
  "kelly_calculations": {
    "bet_1": {
      "amount_colones": 3384,           // REQUERIDO: monto exacto en ₡
      "kelly_percentage": 8.46,         // REQUERIDO: % del bankroll
      "bet_type": "1x2|Over/Under|BTTS|Combinada",  // REQUERIDO: tipo
      "reasoning": "Explicación detallada",         // REQUERIDO: por qué
      "probability": 0.68,              // REQUERIDO: probabilidad (0-1)
      "odds": 1.80,                     // REQUERIDO: odds decimales
      "edge": 0.224,                    // REQUERIDO: ventaja matemática
      "risk_of_ruin": 32.0              // REQUERIDO: RoR en %
    },
    "warnings": [                       // OPCIONAL: advertencias
      "⚠️ Kelly alto - considera Fractional Kelly"
    ]
  }
}
```

---

## 10. Próximos Pasos Opcionales

1. **Integración con database**: Guardar cálculos Kelly en `betting_recommendations`
2. **Histórico de acuracidad**: Comparar predicciones vs resultados reales
3. **Risk of Ruin avanzado**: Cálculo secuencial para múltiples apuestas
4. **Fractional Kelly automático**: Si kelly_% > 25%, auto-aplicar 50% Kelly
5. **A/B testing**: Comparar Kelly vs Fractional Kelly en live bets

---

## Verificación Final

El archivo ha sido modificado exitosamente:
- ✅ System prompts actualizados (ES + EN)
- ✅ Funciones Kelly y Colones agregadas
- ✅ Validación de bankroll implementada
- ✅ Enriquecimiento de respuesta JSON
- ✅ Advertencias automáticas
- ✅ Documentación completa

Todas las reglas y restricciones fueron respetadas:
- ✅ No se modificó base de datos
- ✅ No se tocó `js/chat_ui.js`
- ✅ Estructura de endpoint `/api/chat` intacta
- ✅ Otros endpoints sin cambios
