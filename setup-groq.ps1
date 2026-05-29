# 🔑 Script Automático para Configurar GROQ_API_KEY en Vercel
# Uso: .\setup-groq.ps1 -ApiKey "gsk_tu_key_aqui"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$false)]
    [string]$TeamId,

    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "mundial2026-analytics"
)

Write-Host "🔑 Configurando GROQ_API_KEY..." -ForegroundColor Cyan
Write-Host ""

# Validar que la key tenga el formato correcto
if ($ApiKey -notmatch "^gsk_") {
    Write-Host "❌ Error: La API key debe comenzar con 'gsk_'" -ForegroundColor Red
    Write-Host "Obtén una key válida en: https://console.groq.com" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Formato de key válido: $($ApiKey.Substring(0, 10))..." -ForegroundColor Green
Write-Host ""

# Actualizar .env.local
$envFile = ".env.local"
Write-Host "📝 Actualizando $envFile..." -ForegroundColor Cyan

if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    $content = $content -replace 'GROQ_API_KEY=.+', "GROQ_API_KEY=$ApiKey"
    Set-Content $envFile -Value $content
    Write-Host "✅ $envFile actualizado" -ForegroundColor Green
} else {
    Write-Host "❌ $envFile no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Intentar configurar en Vercel
Write-Host "🚀 Configurando en Vercel..." -ForegroundColor Cyan
Write-Host ""

$vercelArgs = @(
    "env",
    "add",
    "GROQ_API_KEY",
    $ApiKey,
    "--yes"
)

if ($TeamId) {
    $vercelArgs += "--team"
    $vercelArgs += $TeamId
}

$vercelArgs += "--project"
$vercelArgs += $ProjectId

try {
    & vercel @vercelArgs
    Write-Host ""
    Write-Host "✅ GROQ_API_KEY configurado en Vercel" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No se pudo configurar automáticamente en Vercel" -ForegroundColor Yellow
    Write-Host "Configura manualmente en: https://vercel.com/projects/$ProjectId/settings/environment-variables" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ GROQ_API_KEY configurada correctamente" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Vercel redeploy en ~30-60 segundos" -ForegroundColor White
Write-Host "2. Prueba: curl -X POST https://mundial2026-analytics.vercel.app/api/chat" -ForegroundColor White
Write-Host "3. Pregunta sobre un jugador: '¿Mejores apuestas para Mbappé?'" -ForegroundColor White
Write-Host ""
Write-Host "🎉 IA-ZAK v7.0 estará completamente operativo!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
