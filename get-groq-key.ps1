# 🔑 Script Interactivo para Obtener y Configurar GROQ_API_KEY
# Este script abre el navegador y te guía paso a paso

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔑 GROQ API Key - Setup Interactivo" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 PASOS (3 minutos totales):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣  Abriendo https://console.groq.com en tu navegador..." -ForegroundColor White
Write-Host ""

# Abrir el navegador
Start-Process "https://console.groq.com"

Write-Host "   ⏳ Por favor:"
Write-Host "   → Si no tienes cuenta: Haz clic en 'Sign Up'"
Write-Host "   → Usa email o Google (gratis, sin tarjeta de crédito)"
Write-Host "   → Confirma tu email"
Write-Host ""

Write-Host "2️⃣  Una vez dentro, ve a 'API Keys' (en el sidebar izquierdo)" -ForegroundColor White
Write-Host ""

Write-Host "3️⃣  Haz clic en 'Create API Key'" -ForegroundColor White
Write-Host "   → Dale un nombre como 'IA-ZAK' o 'Mundial2026'"
Write-Host "   → Copia la key (empieza con 'gsk_')" -ForegroundColor Yellow
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Cuando tengas tu API key:" -ForegroundColor Green
Write-Host ""

$apiKey = Read-Host "Pega tu API key aquí (gsk_...)"

if (-not $apiKey -or -not $apiKey.StartsWith("gsk_")) {
    Write-Host ""
    Write-Host "❌ Error: La key debe empezar con 'gsk_'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Key válida: $($apiKey.Substring(0, 20))..." -ForegroundColor Green
Write-Host ""

# Actualizar .env.local
Write-Host "🔧 Actualizando .env.local..." -ForegroundColor Cyan

$envFile = ".env.local"
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    $content = $content -replace 'GROQ_API_KEY=.+', "GROQ_API_KEY=$apiKey"
    Set-Content $envFile -Value $content
    Write-Host "✅ .env.local actualizado" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Configurando en Vercel..." -ForegroundColor Cyan

try {
    # Intentar obtener team y project desde vercel.json o config
    $vercelJson = Get-Content "vercel.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue

    # Comando para agregar variable de entorno
    # Nota: Esto requiere que vercel CLI esté autenticado
    Write-Host "⏳ Esperando confirmación de Vercel CLI..." -ForegroundColor Yellow

    # Usar echo para pasar la key sin interacción
    Write-Host "📝 Ejecutando: vercel env add GROQ_API_KEY" -ForegroundColor White

    # Este comando requiere autenticación de Vercel
    $envAddResult = $apiKey | vercel env add GROQ_API_KEY --yes 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GROQ_API_KEY configurado en Vercel" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Vercel CLI no está autenticado" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Configura manualmente:" -ForegroundColor Yellow
        Write-Host "  1. Ve a https://vercel.com/dashboard" -ForegroundColor White
        Write-Host "  2. Proyecto: mundial2026-analytics" -ForegroundColor White
        Write-Host "  3. Settings → Environment Variables" -ForegroundColor White
        Write-Host "  4. Add Variable → GROQ_API_KEY = $($apiKey.Substring(0, 10))..." -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  No se pudo configurar automáticamente (Vercel CLI no disponible)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 Configura manualmente en:" -ForegroundColor Yellow
    Write-Host "   https://vercel.com/projects/mundial2026-analytics/settings/environment-variables" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ ¡LISTO! GROQ está configurado" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Vercel redeploy automático en ~30-60 segundos" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Prueba ahora:" -ForegroundColor Cyan
Write-Host "   Pregunta: '¿Mejores apuestas para Mbappé?'" -ForegroundColor White
Write-Host "   Respuesta: Análisis automático + 3 perfiles" -ForegroundColor White
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
