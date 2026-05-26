# AGENT 2 - Instrucciones de Despliegue

## Estado: ✅ LISTO PARA DESPLIEGUE

---

## Paso 1: Verificación Pre-Despliegue (5 minutos)

### 1.1 Validar Sintaxis

```bash
# Verificar que el archivo no tiene errores de sintaxis
node -c api/ferxxxa-intel.js

# Esperado: Sin output (significa que pasó)
```

### 1.2 Revisar Cambios

```bash
# Ver cambios realizados
git diff api/ferxxxa-intel.js

# Esperado: 
# - Líneas 106-109: 3 nuevas líneas (popular_parlays, market_correlations, parlay_value_analysis)
# - Líneas 182+: generateRealisticIntel() con nuevas funciones
# - Líneas 340+: Tres nuevas funciones agregadas
```

### 1.3 Verificar Archivo de Configuración

```bash
# Confirmar que vercel.json no cambia
git diff vercel.json

# Esperado: Sin cambios
```

---

## Paso 2: Despliegue a Producción

### Opción A: Git Push (Recomendado)

```bash
# 1. Agregar cambios
git add api/ferxxxa-intel.js

# 2. Crear commit descriptivo
git commit -m "AGENT 2: Add popular parlays detection to FerXxxa Intel

- Add detectPopularParlays() function to identify 5 types of community parlays
- Add calculateMarketCorrelations() function for market correlation analysis
- Add analyzeParlaySvalue() function for parlay value analysis
- Enrich ferxxxa_intel with: popular_parlays, market_correlations, parlay_value_analysis
- Maintain 100% backward compatibility with existing structure"

# 3. Push a rama (o main si está listo)
git push origin master

# 4. Vercel deploy automático si está configurado
# (Debería desplegar automáticamente con git push)
```

### Opción B: Deploy Manual a Vercel

```bash
# 1. Login a Vercel
vercel login

# 2. Deploy
vercel --prod

# 3. Confirmar que muestra: "✅ Production"
```

---

## Paso 3: Validación Post-Despliegue (10 minutos)

### 3.1 Test Endpoint Básico

```bash
# Obtener CRON_SECRET (en Vercel environment variables)
export CRON_SECRET="your_cron_secret_here"

# Test el endpoint
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://mundial2026-analytics.vercel.app/api/ferxxxa-intel

# Esperado: Respuesta 200 OK con ferxxxa_intel JSON
```

### 3.2 Verificar Estructura de Respuesta

```bash
# Guardar respuesta en archivo
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://mundial2026-analytics.vercel.app/api/ferxxxa-intel > response.json

# Verificar que tiene campos nuevos
jq '.ferxxxa_intel | keys' response.json

# Esperado salida:
# [
#   "match_predictions",
#   "odds_movement",
#   "injury_alerts",
#   "sentiment_analysis",
#   "trending_narratives",
#   "popular_parlays",
#   "market_correlations",
#   "parlay_value_analysis"
# ]
```

### 3.3 Validar popular_parlays

```bash
# Verificar que hay 5 parlays
jq '.ferxxxa_intel.popular_parlays | length' response.json
# Esperado: 5

# Ver estructura de primer parlay
jq '.ferxxxa_intel.popular_parlays[0]' response.json

# Esperado:
# {
#   "parlay_name": "Over 2.5 + BTTS",
#   "frequency": <number>,
#   "percentage": <number>,
#   "events": ["over_2.5_goals", "btts_yes"],
#   "implied_probability": 0.35,
#   "real_odds_if_available": 3.55,
#   "community_odds_reported": <number>
# }
```

### 3.4 Validar market_correlations

```bash
# Verificar que hay correlaciones
jq '.ferxxxa_intel.market_correlations | keys' response.json

# Esperado: ["over_2_5_goals", "home_win", "btts_yes", "under_2_5_goals"]

# Ver estructura de correlación
jq '.ferxxxa_intel.market_correlations.over_2_5_goals' response.json

# Esperado:
# {
#   "correlates_with": ["btts_yes", "corners_gt_9", "yellow_cards_gt_5"],
#   "strength": [0.72, 0.58, 0.41],
#   "reasoning": "More goals → both teams score + more action (corners/yellows)"
# }
```

### 3.5 Validar parlay_value_analysis

```bash
# Verificar análisis de valor
jq '.ferxxxa_intel.parlay_value_analysis' response.json

# Esperado:
# {
#   "most_mispriced": "Home Win + Under 2.5 (comunidad dice 3.44 odds, valor real ~3.67)",
#   "consensus_bet": "Over 2.5 + BTTS (X.X% de apostadores...)",
#   "contrarian_opportunity": "Over 2.5 + Corners > 9 (solo X.X% apuesta...)",
#   "analysis_timestamp": "2026-05-25T...",
#   "methodology": "Detección de combinadas basada en co-menciones..."
# }
```

### 3.6 Verificar Datos en Base de Datos

```bash
# Conectar a base de datos
psql "postgresql://user:pass@host/mundial2026"

# Query para verificar último intel guardado
SELECT topic, created_at, summary_json->>'popular_parlays' 
FROM zak_intel 
WHERE topic = 'ferxxxa_intel' 
ORDER BY studied_at DESC 
LIMIT 1;

# Esperado: 
# - topic: 'ferxxxa_intel'
# - created_at: timestamp reciente
# - popular_parlays contiene data (no nula)
```

---

## Paso 4: Integración con IA-Zak (15 minutos)

### 4.1 Test Manual en Chat

1. **Ir a:** https://mundial2026-analytics.vercel.app/chat.html
2. **Esperar:** hasta que la UI esté lista
3. **Preguntar algo como:**
   ```
   "¿Cuál es tu análisis para el partido de Argentina vs Francia?
    Considera lo que apuesta la comunidad de DoradoBet según FerXxxa."
   ```
4. **Esperado respuesta:**
   - Incluye mención de parlays populares
   - Menciona correlaciones
   - Habla de valor/arbitrage si detecta

### 4.2 Verificar que Chat Puede Acceder a Datos

En browser developer console:

```javascript
// Test fetch de ferxxxa intel
fetch('/api/ferxxxa-intel')
  .then(r => r.json())
  .then(data => console.log('FerXxxa Intel:', data.ferxxxa_intel.popular_parlays))
```

Esperado: Array con 5 parlays en consola

### 4.3 Verificar que IA-Zak Recibe los Datos

En respuesta de IA-Zak, buscar palabras clave como:
- "comunidad apuesta" 
- "combinada"
- "parlay"
- "correlación"
- "valor"

Si aparecen, significa que está usando los nuevos datos.

---

## Paso 5: Monitoring Continuo (Diario)

### 5.1 Verificar Logs

```bash
# En Vercel dashboard
# Ir a: Deployments → Recent → Logs

# Buscar líneas como:
# [ferxxxa-intel] ✅ Data saved to zak_intel table
# [ferxxxa-intel] ✅ Successfully fetched DoradoBet data

# Esperado: Sin errores [ferxxxa-intel] ⚠️ o ❌
```

### 5.2 Monitorear Frecuencia de Ejecución

```bash
# Query para verificar frecuencia de inserts
SELECT topic, COUNT(*), 
       MAX(studied_at) as last_run,
       MIN(studied_at) as first_run
FROM zak_intel
WHERE topic = 'ferxxxa_intel'
  AND studied_at > NOW() - INTERVAL '24 hours'
GROUP BY topic;

# Esperado:
# - Aproximadamente 8 inserts en 24 horas (cada 3 horas)
# - Sin errors en logs
```

### 5.3 Revisar Calidad de Datos

```bash
# Verificar que parlays varían (no siempre igual)
SELECT DISTINCT 
  summary_json->'popular_parlays'->0->>'parlay_name',
  summary_json->'popular_parlays'->0->>'frequency'
FROM zak_intel
WHERE topic = 'ferxxxa_intel'
  AND studied_at > NOW() - INTERVAL '24 hours'
LIMIT 10;

# Esperado: Diferentes frequency values (muestra randomness realista)
```

---

## Paso 6: Troubleshooting

### Problema: Endpoint retorna error 401

```
Causa: CRON_SECRET inválido o no configurado
Solución:
1. Verificar que CRON_SECRET está en Vercel environment variables
2. Usar el valor correcto en header: Authorization: Bearer [SECRET]
```

### Problema: Endpoint retorna error 500

```
Causa: Error en código o DB
Solución:
1. Revisar logs en Vercel
2. Verificar que zak_intel tabla existe
3. Ejecutar: node -c api/ferxxxa-intel.js localmente
```

### Problema: popular_parlays está vacío

```
Causa: Función detectPopularParlays() no encuentra predicciones
Solución:
1. Verificar que generateRealisticIntel() genera predicciones
2. Confirmar que predictions array no está vacío
3. Revisar lógica de detección en línea 340+
```

### Problema: market_correlations está vacío

```
Causa: Función calculateMarketCorrelations() no encuentra mercados
Solución:
1. Verificar que predictions incluyen mercados esperados
2. Confirmar que over25, btts, homeWin, etc. se encuentran
3. Revisar lógica en línea 423+
```

### Problema: Chat no menciona parlays

```
Causa: IA-Zak no está usando datos de ferxxxa_intel
Solución:
1. Verificar que /api/ferxxxa-intel retorna datos
2. Confirmar que chat.js puede acceder a endpoint (CORS)
3. Verificar que system prompt incluye instrucciones de FERXXXA
4. Revisar línea 116-123 de chat.js
```

---

## Paso 7: Rollback (si es necesario)

### Si necesitas revertir cambios:

```bash
# 1. Revert commit
git revert HEAD

# 2. Push
git push origin master

# 3. Vercel redeploy automático

# 4. Confirmar que API vuelve a versión anterior
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://mundial2026-analytics.vercel.app/api/ferxxxa-intel | jq '.ferxxxa_intel | keys'

# Esperado (sin new fields): 
# ["match_predictions", "odds_movement", "injury_alerts", 
#  "sentiment_analysis", "trending_narratives"]
```

---

## Cronología Esperada

| Tiempo | Evento | Status |
|--------|--------|--------|
| T+0m | Despliegue a producción | ✅ Deploy inicia |
| T+2m | Vercel build completa | ✅ Build OK |
| T+3m | Endpoint disponible | ✅ API responde |
| T+5m | Test curl exitoso | ✅ Datos correctos |
| T+10m | Datos en DB | ✅ zak_intel table updated |
| T+15m | Chat accede a datos | ✅ IA-Zak menciona parlays |
| T+3h | Próxima ejecución cron | ✅ Insert #2 en tabla |
| T+6h | Próxima ejecución cron | ✅ Insert #3 en tabla |
| T+24h | Monitoreo completo | ✅ 8 inserts en 24h |

---

## Checklist Final Pre-Despliegue

- [ ] Sintaxis validada: `node -c api/ferxxxa-intel.js`
- [ ] Cambios revisados: `git diff api/ferxxxa-intel.js`
- [ ] Vercel.json sin cambios: `git diff vercel.json`
- [ ] CRON_SECRET configurado en Vercel
- [ ] Documento de cambios leído y comprendido
- [ ] Documentación generada y guardada
- [ ] Backup de versión anterior disponible
- [ ] Equipo notificado del despliegue
- [ ] Ventana de despliegue apropiada (no en prod-peak)
- [ ] Ready para rollback si es necesario

---

## Comunicación Post-Despliegue

```
Para anunciar:

"AGENT 2 Deployment - FerXxxa Intel v4.0

✅ Deployed successfully

New Features:
- Parlay detection: Detects 5 types of popular community parlays
- Market correlations: 4-5 markets analyzed for correlation strength
- Value analysis: Identifies mispriced, consensus, and contrarian opportunities

Changes:
- Modified: /api/ferxxxa-intel.js
- Status: Backward compatible (100%)
- Impact: Enriches ferxxxa_intel data only

Monitoring:
- Cron: Running every 3 hours
- DB: Data persisting to zak_intel
- Integration: IA-Zak can now use parlay context

No action required. System operating normally."
```

---

## Documentación Adjunta

1. **FERXXXA_PARLAYS_EXTRACTION.md** - Guía técnica completa
2. **FERXXXA_IMPLEMENTATION_DETAILS.md** - Detalles de implementación
3. **AGENT2_FERXXXA_PARLAYS_DELIVERY.md** - Resumen de cambios
4. **FERXXXA_PARLAYS_EXAMPLE_RESPONSE.json** - Ejemplo JSON
5. **AGENT2_SUMMARY.txt** - Resumen ejecutivo
6. **AGENT2_VALIDATION_CHECKLIST.md** - Checklist de validación
7. **AGENT2_DEPLOYMENT_INSTRUCTIONS.md** - Este documento

---

## Soporte

Si tienes problemas durante o después del despliegue:

1. Revisar logs en Vercel dashboard
2. Ejecutar troubleshooting steps arriba
3. Contactar al equipo de desarrollo
4. Usar rollback si es crítico

**Status:** ✅ **READY FOR PRODUCTION DEPLOYMENT**
