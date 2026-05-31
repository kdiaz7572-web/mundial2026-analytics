# mundial2026 — Contexto para Claude

## Ruta del proyecto
`D:\proyectos\mundial2026`

## Stack
- **Runtime:** Node.js 18+
- **DB:** Neon (Postgres serverless)
- **AI:** Groq SDK
- **Deploy:** Vercel
- **Testing:** Playwright
- **Módulos:** ES Modules (`"type": "module"`)

## Comandos principales
```bash
vercel dev       # Servidor de desarrollo local
vercel --prod    # Deploy a producción
```

## Estructura clave
```
api/          → Serverless functions (Vercel)
css/          → Estilos
js/           → Lógica frontend
docs/         → Documentación técnica
extension/    → Extensión de Chrome integrada
index.html    → App principal
chat.html     → Interfaz de chat
```

## Variables de entorno
Archivo: `.env.local` (no commitear)
- Groq API Key
- Neon Database URL

## Notas importantes
- Analytics de fútbol para el Mundial 2026
- Implementa fórmula Kelly para mercados y parlays
- Sistema FERXXXA para comunidades
- Desplegado en Vercel con funciones serverless
