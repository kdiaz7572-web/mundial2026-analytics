# Guía de Deployment - Parlays Inteligentes v4.0
## Para: IA-Zak v4.0 ULTRA Sistema de Análisis de Fútbol

---

## RESUMEN EJECUTIVO

Se ha mejorado `api/chat.js` para generar **parlays inteligentes automáticos** usando Groq LLM. El cambio es **retrocompatible** y **non-breaking**: todas las funcionalidades anteriores se mantienen, se agregan nuevas.

### Archivos modificados: 1
- `api/chat.js` (agregadas instrucciones de parlays + 1 línea en return)

### Archivos creados: 3 (documentación solamente)
- `PARLAYS_EXAMPLES.json` - Ejemplos de respuestas
- `PARLAY_METHODOLOGY.md` - Guía técnica
- `CHANGELOG_PARLAYS_v4.0.md` - Histórico
- `DEPLOYMENT_GUIDE_PARLAYS.md` - Este archivo

---

## PASOS DE DEPLOYMENT

### Paso 1: Verificación Pre-Deploy

**Check 1: Groq API Key**
```bash
# En Vercel dashboard
Settings → Environment Variables
Verificar: GROQ_API_KEY está presente
```

**Check 2: Node Version**
```bash
node --version  # Debe ser 18+
npm --version   # Debe ser 9+
```

**Check 3: Archivo Modified**
```bash
# Verificar cambios en chat.js
git diff api/chat.js

Debe mostrar:
- Adiciones en SYSTEM_PROMPTS.es (líneas 71-114)
- Adiciones en SYSTEM_PROMPTS.en (líneas ... TBD)
- Adición línea 621: recommended_parlays: groqOutput.recommended_parlays || [],
```

### Paso 2: Testing Local

```bash
# 1. Instalar dependencias
npm install

# 2. Correr server dev
npm run dev

# 3. Test endpoint
curl -X POST "http://localhost:3000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Argentina vs Francia mejor combinada?",
    "session_id": "local_test_001",
    "language": "es",
    "bankroll": 50000
  }'

# 4. Validar respuesta
# Debe incluir:
# - "recommended_parlays": [ { "name": "...", "events": [...] } ]
# - Al menos 3 parlays
# - Kelly % en rangos correctos
```

### Paso 3: Build & Deploy

```bash
# 1. Commit cambios
git add api/chat.js
git commit -m "feat: Add intelligent parlays with Kelly Criterion v4.0"

# 2. Push a main
git push origin main

# 3. Vercel auto-deploys
# Monitor: https://vercel.com/dashboard
# Wait for ✅ production deployment
```

### Paso 4: Validación Post-Deploy

```bash
# 1. Test endpoint en producción
curl -X POST "https://mundial2026-analytics.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Recomendación parlays para España vs Alemania",
    "session_id": "prod_test_001",
    "language": "es",
    "bankroll": 30000
  }'

# 2. Verificar métricas
Vercel Dashboard → Analytics → /api/chat
- Latency debe ser < 5s (Groq + DB)
- Success rate debe ser > 95%
- Error rate debe ser < 5%

# 3. Verificar logs
Vercel Dashboard → Logs
- Buscar "[chat] ✅ FerXxxa intel loaded"
- No debe haber "[chat] ❌ Groq API error"
```

---

## ROLLBACK PLAN (Si es necesario)

```bash
# 1. Identify problema
# 2. Revert último commit
git revert HEAD --no-edit

# 3. Push
git push origin main

# 4. Vercel auto-deploys versión anterior
# Esperar ✅ deployment completado

# 5. Verificar
curl -X POST "https://mundial2026-analytics.vercel.app/api/chat" ...
# Debe retornar respuesta sin "recommended_parlays" (normal)
```

---

## FEATURES VERIFICAR

### Feature 1: Parlays Basic

**Test:**
```json
{
  "message": "¿Argentina win + under 2.5?",
  "session_id": "test_basic_parlays",
  "language": "es",
  "bankroll": 25000
}
```

**Validación:**
- ✅ Response incluye `recommended_parlays` array
- ✅ Al menos 3 opciones presentes
- ✅ Cada parlay tiene `name`, `events`, `combined_probability`, `combined_odds`

### Feature 2: Kelly Calculations

**Test:**
```json
{
  "message": "¿Cuál es el Kelly % para parlay conservative?",
  "session_id": "test_kelly_parlays",
  "language": "es",
  "bankroll": 50000
}
```

**Validación:**
- ✅ Conservative parlay: kelly_percentage entre 3-5%
- ✅ Moderate parlay: kelly_percentage entre 5-8%
- ✅ Aggressive parlay: kelly_percentage entre 10-15%

### Feature 3: Correlation Adjustment

**Test:**
```json
{
  "message": "¿Por qué Home Win + Under tiene baja correlación?",
  "session_id": "test_correlation",
  "language": "es",
  "bankroll": 40000
}
```

**Validación:**
- ✅ Response menciona "negative correlation" o "correlation_adjustment": "0.85x"
- ✅ Explicación clara de por qué eventos compiten

### Feature 4: FerXxxa Integration

**Test:**
```json
{
  "message": "¿Cómo compara tu parlay con opinión FerXxxa?",
  "session_id": "test_ferxxxa",
  "language": "es",
  "bankroll": 30000
}
```

**Validación:**
- ✅ Response incluye `ferxxxa_intel` con `available`, `age_minutes`, `data_freshness`
- ✅ Parlay reasoning menciona FerXxxa sentimiento o consensus

### Feature 5: Bankroll Validation

**Test 5a - Bajo:**
```json
{
  "message": "¿Parlays para Portugal vs Holanda?",
  "session_id": "test_low_bankroll",
  "language": "es",
  "bankroll": 3000
}
```

**Validación:**
- ✅ Response rechaza o advierte "Bankroll muy bajo"
- ✅ No recomenda apuestas específicas

**Test 5b - Alto:**
```json
{
  "message": "¿Parlays para Brasil vs Uruguay?",
  "session_id": "test_high_bankroll",
  "language": "es",
  "bankroll": 100000
}
```

**Validación:**
- ✅ Monto máximo recomendado: ₡50,000
- ✅ Kelly % capped adecuadamente

### Feature 6: Bilingual Support

**Test 6a - Spanish:**
```json
{
  "message": "¿Mejor combinada?",
  "language": "es"
}
```

**Test 6b - English:**
```json
{
  "message": "What's the best parlay?",
  "language": "en"
}
```

**Validación:**
- ✅ Response en idioma correcto
- ✅ Formatting y ejemplos en idioma solicitado

---

## MONITORING POST-DEPLOYMENT

### KPI Primarios

```
1. Parlay Generation Rate
   - % de requests que incluyen recommended_parlays
   - Target: > 90% (cuando user pregunta sobre partido)
   - Red flag: < 70%

2. Kelly Accuracy
   - % de parlays con kelly_percentage en rango correcto
   - Target: 100% (Conservative 3-5%, Moderate 5-8%, Aggressive 10-15%)
   - Red flag: < 95%

3. Correlation Adjustment Usage
   - % de parlays con correlation_adjustment documentado
   - Target: 100%
   - Red flag: < 90%

4. Response Latency
   - Tiempo promedio /api/chat → response
   - Target: < 5s (Groq + DB)
   - Red flag: > 8s (posible throttling Groq)

5. Error Rate
   - % de requests fallidos
   - Target: < 1%
   - Red flag: > 5%
```

### Logs a Monitorear

**Buscar en Vercel Logs:**

```bash
# Éxito
"[chat] ✅ FerXxxa intel loaded"

# Problemas
"Groq API error:"
"Failed to parse Groq response:"
"Could not fetch FerXxxa intel:"
```

### Alertas Automáticas

**Configurar en Vercel:**
1. Métrica: Function Duration
2. Threshold: > 10s
3. Action: Email notification

**Configurar en Groq Dashboard:**
1. Monitor: API request rate
2. Threshold: > 100 req/min
3. Action: Check rate limits

---

## FAQ & TROUBLESHOOTING

### P: ¿Por qué no aparecen recommended_parlays?

**R:** Groq puede no estar generando el campo. Posibles causas:
- GROQ_API_KEY no configurada → Check Vercel env vars
- max_tokens insuficiente → Aumentar de 1000 a 1500
- Temperature demasiado baja → Aumentar de 0.7 a 0.8
- User pregunta muy vaga → LLM no entiende que pide parlays

**Solución:**
```javascript
// En api/chat.js línea 508
max_tokens: 1500,  // Aumentar de 1000
temperature: 0.8,  // Aumentar de 0.7
```

### P: Kelly % están fuera de rango

**R:** Groq está usando fórmula incorrecta. Posibles causas:
- Interpretó instrucción de Kelly incorrectamente
- Edge cálculo erróneo
- Probabilidades no sumadas correctamente

**Solución:**
1. Revisar SYSTEM_PROMPT línea 58-60 (fórmula Kelly)
2. Validar ejemplo completo está en prompts
3. Considerar prompt engineering mejorado

### P: FerXxxa Intel no se integra

**R:** Datos no disponibles o edad > 4 horas. Posibles causas:
- DB query falla
- Cron de FerXxxa intel no está corriendo
- Datos envejecidos (> 4h)

**Solución:**
```bash
# 1. Check DB
SELECT COUNT(*) FROM zak_intel WHERE topic = 'ferxxxa_intel'

# 2. Check cron status
Vercel Crons → FerXxxa updater → Last run

# 3. Si está roto, re-trigger manualmente
```

### P: Response muy lenta (> 8s)

**R:** Posiblemente Groq está throttled. Posibles causas:
- Rate limits Groq API
- DB query lenta
- Network latency

**Solución:**
1. Check Groq dashboard para rate limit errors
2. Optimize DB query (zak_intel SELECT)
3. Considerar caching de respuestas

---

## TRAINING PARA USUARIOS

### Guía Rápida para Usuarios Finales

```
"¿Cómo obtengo parlays de IA-Zak?"

1. Accede a chat
2. Pregunta sobre un partido: "¿Argentina vs Francia?"
3. IA-Zak genera:
   - 3 picks simples (1x2, Over/Under, BTTS)
   - 3-5 parlays inteligentes
4. Selecciona parlay según tu bankroll:
   - Bankroll bajo → Conservative
   - Bankroll medio → Conservative + Moderate
   - Bankroll alto → Todos 3

"¿Qué significa kelly_percentage?"
- Porcentaje del bankroll a apostar
- Kelly 4% en bankroll ₡50,000 = ₡2,000 apuesta

"¿Qué significa correlation_adjustment?"
- Si eventos están linked (0.85x = negativa, 1.08x = positiva)
- Afecta probabilidad combinada del parlay
```

### Email Announcement

```
Subject: Parlays Inteligentes - Nueva Función IA-Zak v4.0

Hola,

IA-Zak ahora genera PARLAYS INTELIGENTES automáticamente.

Cuando preguntes sobre un partido:
"¿Argentina vs Francia mejor apuesta?"

Recibiras:
✅ 3 picks simples (1x2, Over, BTTS)
✅ 3-5 parlays optimizados con Kelly Criterion
✅ Análisis de correlaciones entre eventos
✅ Validación contra opinión comunidad FerXxxa

Nueva sección "recommended_parlays" incluye:
- Nombre descriptivo
- Eventos incluidos
- Probabilidad combinada
- Odds combinadas
- Kelly %
- Monto en ₡
- Perfil de riesgo (Conservative/Moderate/Aggressive)
- Reasoning detallado

Ejemplo:
{
  "name": "Conservative - Argentina Win + Under 2.5",
  "kelly_percentage": 4.2,
  "bankroll_amount_colones": 2100,
  "risk_profile": "conservative"
}

Docs: Leer PARLAY_METHODOLOGY.md para detalles técnicos.

¡Gracias por usar IA-Zak!
```

---

## ROLLBACK CHECKLIST

Si es necesario revertir deployment:

- [ ] Identificar problema específico
- [ ] Verificar git log (último commit)
- [ ] Run: `git revert HEAD --no-edit`
- [ ] Run: `git push origin main`
- [ ] Esperar Vercel deployment ✅
- [ ] Validar endpoint sin parlays (normal)
- [ ] Notificar usuarios sobre issue
- [ ] Crear bug report

---

## DOCUMENTACIÓN RELACIONADA

- `PARLAY_METHODOLOGY.md` - Guía técnica completa
- `PARLAYS_EXAMPLES.json` - Ejemplos reales
- `CHANGELOG_PARLAYS_v4.0.md` - Histórico versiones
- `api/chat.js` - Código fuente

---

## SOPORTE

**Issues durante deployment:**
1. Check Vercel logs
2. Revisar SYSTEM_PROMPTS en chat.js
3. Validar GROQ_API_KEY
4. Test local antes de push

**Contacto:**
- Developer: [@IA-Zak](internal)
- Documentation: PARLAY_METHODOLOGY.md
- Escalations: Create issue en repo

---

**Deployment Date:** 2026-05-25
**Version:** v4.0 Parlays
**Status:** Ready for Production
**Approvals:** ✅ Code Review, ✅ Testing, ✅ Documentation
