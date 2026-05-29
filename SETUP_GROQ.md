# 🔑 Configurar GROQ_API_KEY para IA-Zak v7.0

## ¿Qué es Groq?
Groq es un servicio de LLM ultra-rápido (respuestas en ~500ms) con un **free tier ilimitado**. 
No requiere tarjeta de crédito ni tiene límites de requests.

## Paso 1: Obtener tu API Key

1. Ve a https://console.groq.com
2. Haz clic en **"Sign Up"** (gratis)
3. Completa el registro
4. Ve a **API Keys** en el sidebar
5. Haz clic en **"Create API Key"**
6. Copia la key (empieza con `gsk_...`)

## Paso 2: Configurar en Vercel

### Opción A: Desde la línea de comandos (recomendado)

```bash
cd C:\Users\kdiaz\mundial2026

# Configura el proyecto Vercel
vercel link --yes --team <tu-team-id> --project <tu-project-id>

# Agrega la variable de entorno
vercel env add GROQ_API_KEY

# Pega tu key cuando se pida
# Ejemplo: gsk_1a2b3c4d5e6f7g8h9i0j
```

### Opción B: Manualmente en Vercel Dashboard

1. Ve a https://vercel.com/projects/mundial2026-analytics
2. Haz clic en **Settings** → **Environment Variables**
3. Haz clic en **Add** → **New Variable**
4. **Name:** `GROQ_API_KEY`
5. **Value:** (pega tu key de Groq)
6. Click **Save**

## Paso 3: Verificar que funciona

Una vez configurado, el sistema estará 100% operativo:

```bash
# Haz un test
$body = @{
    message = "¿Mejores apuestas para Mbappé?"
    session_id = "test-groq"
    language = "es"
    bankroll = 100000
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://mundial2026-analytics.vercel.app/api/chat" `
    -Method POST `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body
```

Deberías ver:
- ✅ `player_analyzed`: Mbappé
- ✅ `recommended_parlays`: 5 apuestas (Conservative/Moderate/Aggressive/VeryAggressive/CommunityPick)
- ✅ `kelly_calculations`: Bankroll sugerido

## Características disponibles una vez configurado:

- 🎯 **Análisis automático de jugadores**: Pregunta sobre Mbappé, Bellingham, Haaland, etc.
- 📊 **3 perfiles de apuesta**: Conservadora (🟢), Moderada (🟡), Agresiva (🔴)
- 💰 **Kelly Criterion**: Bankroll inteligente en colones (₡)
- 📈 **Desglose completo**: Probabilidades, cuotas, confianza
- 🌍 **Respuestas en español**: Análisis detallado para cada jugador

## Notas:

- ✅ Groq free tier: **ILIMITADO** (no hay límite de requests)
- ✅ Respuesta rápida: **~500ms** (10x más rápido que OpenAI)
- ✅ Sin tarjeta de crédito: Gratis para desarrollo
- ✅ Modelos disponibles: Llama 3.3 70B (última versión)

## Solución de problemas:

**P: ¿Mi API key es válida?**
A: Verifica en https://console.groq.com → API Keys → Key usage stats

**P: ¿Cuándo se activa después de configurar?**
A: Vercel redeploy en ~30-60 segundos. Puedes forzar uno en Settings → Deployments → Redeploy

**P: ¿Groq tiene SLA?**
A: Free tier no tiene SLA, pero es muy confiable en producción. Los tiempos de respuesta son excelentes.
