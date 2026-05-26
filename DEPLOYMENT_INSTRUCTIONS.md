# Instrucciones de Deployment - Kelly Criterion en Colones

## Pre-Deployment Checklist

- [x] Código modificado en `api/chat.js`
- [x] Funciones utility Kelly implementadas
- [x] System prompts mejorados (ES + EN)
- [x] Validación de bankroll programada
- [x] Tests ejecutados: 100% PASS
- [x] Documentación completada
- [x] Ejemplos proporcionados

---

## Pasos de Deployment

### 1. Verificación Sintáctica

```bash
# Navegar a directorio
cd C:\Users\kdiaz\mundial2026

# Verificar sintaxis JavaScript
node -c api/chat.js

# Ejecutar tests
node KELLY_TEST_CASES.js
```

**Resultado esperado:** Sin errores, 100% tests pasados

---

### 2. Verificación en Vercel

```bash
# Navegar a directorio raíz del proyecto
cd C:\Users\kdiaz\mundial2026

# (Opcional) Testing local
npm run test

# Deploy a Vercel
vercel --prod
```

---

### 3. Testing Post-Deployment

#### Test 1: Kelly Básico
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Debería apostar a Argentina gana vs Francia si los odds son 1.80 y tengo ₡40,000?",
    "session_id": "test_001",
    "language": "es",
    "bankroll": 40000
  }'
```

**Esperado:** 
- `amount_colones`: 3384
- `kelly_percentage`: 8.46
- `bet_type`: "1x2"
- `reasoning`: explicación detallada

---

#### Test 2: Bankroll Bajo
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quiero empezar a apostar",
    "session_id": "test_002",
    "language": "es",
    "bankroll": 2000
  }'
```

**Esperado:**
```json
{
  "success": true,
  "bankroll_error": "Bankroll muy bajo (₡2,000). Mínimo recomendado para análisis Kelly: ₡5,000",
  "kelly_calculations": null
}
```

---

#### Test 3: Kelly Alto (Fractional)
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cuál es mi Kelly para probabilidad 85%, odds 2.50?",
    "session_id": "test_003",
    "language": "es",
    "bankroll": 30000
  }'
```

**Esperado:**
- `kelly_percentage`: 38.25
- `warnings`: ["⚠️ Kelly alto - Considera Fractional Kelly"]

---

#### Test 4: Sin Bankroll
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Debería apostar?",
    "session_id": "test_004",
    "language": "es"
  }'
```

**Esperado:**
- Contexto sistema: "Bankroll: Not set (ask user to confirm)"
- Groq recomienda confirmación de bankroll antes de sugerir apuestas

---

### 4. Monitoreo Post-Deployment

**Verificar logs de Vercel:**

```bash
# Ver logs en tiempo real
vercel logs

# Buscar errores Kelly
vercel logs | grep -i kelly

# Buscar errores bankroll
vercel logs | grep -i bankroll
```

---

## Rollback en Caso de Error

Si hay problemas después de deployment:

```bash
# Revertir a versión anterior de api/chat.js
git checkout HEAD~1 api/chat.js

# Verificar cambios
git diff api/chat.js

# Redeploy
vercel --prod
```

---

## Environment Variables Requeridas

Verificar en Vercel que exista:

```
GROQ_API_KEY=<tu_key_aqui>
NODE_ENV=production
```

Si no existen, agregarlos:

```bash
# Usando vercel CLI
vercel env add GROQ_API_KEY
vercel env add NODE_ENV

# O en Vercel dashboard:
# Settings → Environment Variables
```

---

## Performance Expectations

Después del deployment, esperar:

| Métrica | Esperado |
|---------|----------|
| Tiempo respuesta `/api/chat` | 1-3 segundos |
| Kelly calculation | < 100ms |
| Bankroll validation | < 10ms |
| JSON parsing | < 50ms |
| Groq API call | 1-2 segundos |

---

## Monitoreo de Errores Comunes

### Error 1: Groq API Key no configurada
```
Response: "IA-Zak necesita configuración"
Solución: Verificar GROQ_API_KEY en environment variables
```

### Error 2: JSON inválido de Groq
```
Response: "Parse Error"
Solución: Verificar que Groq retorna JSON válido
```

### Error 3: Bankroll < 5000
```
Response: "Bankroll muy bajo"
Solución: Esperado - usuario debe aumentar bankroll
```

---

## Database Considerations

**Verificar que estas tablas existan:**

```sql
-- conversation_history (existente)
CREATE TABLE IF NOT EXISTS conversation_history (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_message TEXT,
  zak_response TEXT,
  user_bankroll INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: para guardar recomendaciones Kelly
CREATE TABLE IF NOT EXISTS kelly_recommendations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  bankroll INTEGER,
  kelly_percentage DECIMAL(5,2),
  amount_colones INTEGER,
  bet_type VARCHAR(50),
  probability DECIMAL(3,2),
  odds DECIMAL(5,2),
  edge DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Health Check

Crear endpoint para verificar salud del sistema:

```bash
curl https://mundial2026-analytics.vercel.app/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "groq_connected": true,
  "database_connected": true,
  "kelly_calculations_enabled": true
}
```

---

## Documentation Links

Después del deployment, estos archivos están disponibles:

1. **KELLY_COLONES_IMPROVEMENTS.md** - Documentación técnica completa
2. **KELLY_EXAMPLE_RESPONSES.json** - 6 ejemplos de requests/responses
3. **DELIVERY_REPORT.md** - Reporte de entrega
4. **KELLY_TEST_CASES.js** - Suite de tests validada

---

## Rollout Strategy (Opcional)

### Fase 1: Canary (5% de usuarios)
- Deploy a grupo pequeño
- Monitorear por 24 horas
- Verificar sin errores

### Fase 2: Beta (25% de usuarios)
- Expandir a más usuarios
- Recopilar feedback
- Optimizar si es necesario

### Fase 3: General Availability (100%)
- Deploy completo
- Monitoreo intenso por 48 horas
- Establecer SLA

---

## Support & Troubleshooting

**Si hay problemas durante deployment:**

1. Verificar logs: `vercel logs`
2. Verificar sintaxis: `node -c api/chat.js`
3. Verificar tests: `node KELLY_TEST_CASES.js`
4. Verificar environment variables
5. Hacer rollback si es necesario

---

## Sign-Off

**Antes de deploying a producción, confirmar:**

- [ ] Tests pasaron 100%
- [ ] Sintaxis verificada
- [ ] Documentation actualizada
- [ ] Environment variables configuradas
- [ ] Logs monitoreados
- [ ] Rollback plan listo

---

**Deployment Status:** ✅ LISTO PARA PRODUCCIÓN

**Última actualización:** 2026-05-23
