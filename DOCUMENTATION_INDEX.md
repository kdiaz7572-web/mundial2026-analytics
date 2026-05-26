# Índice de Documentación - Parlays Inteligentes v4.0
## Sistema IA-Zak de Análisis de Fútbol

---

## 📋 ARCHIVOS DE IMPLEMENTACIÓN

### Modificado
| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| **api/chat.js** | 71-114 (es)<br>147-250 (en)<br>621 | Sistema prompts ampliados + extracción de parlays en return |

### Creados (Documentación)
| Archivo | Líneas | Propósito |
|---------|--------|----------|
| **PARLAYS_EXAMPLES.json** | ~450 | 3 ejemplos completos de respuestas Groq reales |
| **PARLAY_METHODOLOGY.md** | ~350 | Guía técnica completa de correlaciones y Kelly |
| **CHANGELOG_PARLAYS_v4.0.md** | ~300 | Histórico de cambios y validación |
| **DEPLOYMENT_GUIDE_PARLAYS.md** | ~250 | Pasos pre/post deployment y troubleshooting |
| **SUMMARY_PARLAYS_IMPLEMENTATION.txt** | ~200 | Resumen ejecutivo (este es más breve) |
| **DOCUMENTATION_INDEX.md** | este | Índice completo |

---

## 📖 GUÍA RÁPIDA POR AUDIENCIA

### Para Desarrolladores
**Lee en este orden:**
1. `CHANGELOG_PARLAYS_v4.0.md` → Entiende qué cambió exactamente
2. `api/chat.js` → Revisa el código fuente (líneas 71-114, 147-250, 621)
3. `PARLAY_METHODOLOGY.md` → Entiende la lógica detrás

**Para entender correlaciones:**
→ `PARLAY_METHODOLOGY.md` secciones 3 (Correlación) y 7 (Ejemplos Reales)

**Para deployment:**
→ `DEPLOYMENT_GUIDE_PARLAYS.md` secciones 1-4

---

### Para Product Managers
**Lee en este orden:**
1. `SUMMARY_PARLAYS_IMPLEMENTATION.txt` → Resumen ejecutivo
2. `PARLAYS_EXAMPLES.json` → Ver ejemplos reales
3. `DEPLOYMENT_GUIDE_PARLAYS.md` → KPIs y monitoring

**Para presentar a stakeholders:**
→ Use `SUMMARY_PARLAYS_IMPLEMENTATION.txt` (Antes vs Después)

---

### Para QA / Testers
**Lee en este orden:**
1. `DEPLOYMENT_GUIDE_PARLAYS.md` → Sección "Features to Verify"
2. `PARLAY_METHODOLOGY.md` → Sección 8 (Validación y Testing)
3. `PARLAYS_EXAMPLES.json` → Validar contra ejemplos reales

**Para regression testing:**
→ `DEPLOYMENT_GUIDE_PARLAYS.md` secciones 5-6 (Feature tests)

---

### Para Usuarios Finales
**Lee en este orden:**
1. `SUMMARY_PARLAYS_IMPLEMENTATION.txt` → Qué es nuevo (secciones "Antes vs Después")
2. `PARLAYS_EXAMPLES.json` → Ver ejemplos de respuestas
3. `PARLAY_METHODOLOGY.md` → Sección 5 (Perfiles de Riesgo)

**Quick guide:**
- Bankroll bajo (< ₡15k) → Solo Conservative parlays
- Bankroll medio (₡15k-40k) → Conservative + Moderate
- Bankroll alto (> ₡40k) → Todos 3 perfiles

---

## 🔍 BÚSQUEDA POR TEMA

### Correlación Entre Eventos
| Pregunta | Dónde encontrar |
|----------|-----------------|
| ¿Qué significa correlación? | `PARLAY_METHODOLOGY.md` § 3.1-3.2 |
| ¿Matriz de correlaciones? | `PARLAY_METHODOLOGY.md` § 3.1 + `api/chat.js` líneas 74-82 |
| ¿Ejemplos de correlación? | `PARLAY_METHODOLOGY.md` § 7 + `PARLAYS_EXAMPLES.json` |
| ¿Ajustes de correlación? | `PARLAY_METHODOLOGY.md` § 3.2 + `api/chat.js` líneas 100-114 |

### Kelly Criterion
| Pregunta | Dónde encontrar |
|----------|-----------------|
| ¿Fórmula Kelly para picks simples? | `api/chat.js` líneas 58-60 |
| ¿Fórmula Kelly para parlays? | `PARLAY_METHODOLOGY.md` § 4 |
| ¿Ejemplo Kelly step-by-step? | `PARLAY_METHODOLOGY.md` § 4 (Ejemplo Completo) |
| ¿Validación Kelly ranges? | `DEPLOYMENT_GUIDE_PARLAYS.md` § Test 2 |

### Perfiles de Riesgo
| Pregunta | Dónde encontrar |
|----------|-----------------|
| ¿Qué es Conservative? | `api/chat.js` líneas 85-88 + `PARLAY_METHODOLOGY.md` § 5.1 |
| ¿Qué es Moderate? | `api/chat.js` líneas 90-93 + `PARLAY_METHODOLOGY.md` § 5.2 |
| ¿Qué es Aggressive? | `api/chat.js` líneas 95-98 + `PARLAY_METHODOLOGY.md` § 5.3 |
| ¿Cuándo usar cada uno? | `PARLAY_METHODOLOGY.md` § 5 |

### FerXxxa Integration
| Pregunta | Dónde encontrar |
|----------|-----------------|
| ¿Cómo se integra FerXxxa? | `api/chat.js` líneas 116-123 |
| ¿Cómo validar vs. comunidad? | `PARLAY_METHODOLOGY.md` § 6 |
| ¿Ejemplo con FerXxxa? | `PARLAYS_EXAMPLES.json` (todos incluyen ferxxxa_context) |

### Validación & Testing
| Pregunta | Dónde encontrar |
|----------|-----------------|
| ¿Cómo validar localmente? | `DEPLOYMENT_GUIDE_PARLAYS.md` § 2 |
| ¿Feature checklist? | `DEPLOYMENT_GUIDE_PARLAYS.md` § 4 |
| ¿KPI a monitorear? | `DEPLOYMENT_GUIDE_PARLAYS.md` § Monitoring |
| ¿Ejemplos de testing? | `PARLAY_METHODOLOGY.md` § 8 |

### Deployment
| Pregunta | Dónde encontrar |
|----------|-----------------|
| ¿Pasos pre-deploy? | `DEPLOYMENT_GUIDE_PARLAYS.md` § 1 |
| ¿Testing local? | `DEPLOYMENT_GUIDE_PARLAYS.md` § 2 |
| ¿Build & deploy? | `DEPLOYMENT_GUIDE_PARLAYS.md` § 3 |
| ¿Validación post-deploy? | `DEPLOYMENT_GUIDE_PARLAYS.md` § 4 |
| ¿Rollback si falla? | `DEPLOYMENT_GUIDE_PARLAYS.md` § Rollback Plan |

### Troubleshooting
| Problema | Dónde encontrar |
|----------|-----------------|
| ¿No aparecen recommended_parlays? | `DEPLOYMENT_GUIDE_PARLAYS.md` § FAQ #1 |
| ¿Kelly % fuera de rango? | `DEPLOYMENT_GUIDE_PARLAYS.md` § FAQ #2 |
| ¿FerXxxa intel no se integra? | `DEPLOYMENT_GUIDE_PARLAYS.md` § FAQ #3 |
| ¿Response muy lenta? | `DEPLOYMENT_GUIDE_PARLAYS.md` § FAQ #4 |

---

## 📊 ESTRUCTURA DE UN PARLAY

Para entender cómo Groq genera cada parlay:

```json
{
  "name": "Conservative - Argentina Win + Under 2.5",
  "events": [                                    // Ver PARLAY_METHODOLOGY.md § 2
    {
      "market": "1x2",                          // Market type
      "prediction": "home_win",                 // Prediction
      "probability": 0.65,                      // Individual probability
      "odds": 1.75                              // Market odds
    },
    {
      "market": "over_under",
      "prediction": "under_2.5",
      "probability": 0.45,
      "odds": 1.95
    }
  ],
  "combined_probability": 0.29,                 // P1 × P2 × correlation
                                                // Ver PARLAY_METHODOLOGY.md § 4
  "combined_odds": 3.41,                        // O1 × O2
  "correlation_adjustment": "0.85x",            // Ver PARLAY_METHODOLOGY.md § 3
  "kelly_percentage": 4.2,                      // Kelly % calculation
                                                // Ver api/chat.js líneas 58-60
  "bankroll_amount_colones": 2100,              // kelly_% × bankroll
  "risk_profile": "conservative",               // Ver PARLAY_METHODOLOGY.md § 5.1
  "reasoning": "Argentina fuerte..."            // Explicación con citas
}
```

**Cada campo explicado en:**
→ `PARLAY_METHODOLOGY.md` § 2 (Estructura de un Parlay)

---

## 🔄 FLUJO DE EJECUCIÓN

```
User Query
    ↓
api/chat.js (handler)
    ├─ Load conversation history
    ├─ Prepare SYSTEM_PROMPT (con instrucciones parlays)
    │  └─ SYSTEM_PROMPTS[language] (líneas 71-114 / 147-250)
    │
    ├─ Fetch FerXxxa Intel (líneas 306-367)
    │
    ├─ Call Groq API
    │  └─ model: llama-3.3-70b-versatile
    │  └─ temperature: 0.7
    │  └─ max_tokens: 1000
    │  └─ response_format: json_object
    │
    ├─ Parse Groq response JSON
    │  ├─ reasoning_chain ✅
    │  ├─ analysis ✅
    │  ├─ recommendations ✅
    │  ├─ kelly_calculations ✅
    │  └─ recommended_parlays ✨ NUEVO
    │
    ├─ Store conversation in DB
    │
    └─ Return sendSuccess() con todos los campos (línea 621)
        └─ recommended_parlays: groqOutput.recommended_parlays || []
```

**Detalles del flujo:**
→ `PARLAY_METHODOLOGY.md` § 11 (Diagrama de Flujo)

---

## ✅ CHECKLIST DE VALIDACIÓN

### Pre-Production
- [ ] Leer `CHANGELOG_PARLAYS_v4.0.md` (cambios realizados)
- [ ] Revisar `api/chat.js` (líneas 71-114, 147-250, 621)
- [ ] Ejecutar tests locales (`DEPLOYMENT_GUIDE_PARLAYS.md` § 2)
- [ ] Validar todos los features (`DEPLOYMENT_GUIDE_PARLAYS.md` § 4)

### Deployment
- [ ] Check Groq API key en Vercel (`DEPLOYMENT_GUIDE_PARLAYS.md` § 1)
- [ ] Test endpoint production (POST /api/chat)
- [ ] Monitorear KPIs (`DEPLOYMENT_GUIDE_PARLAYS.md` § Monitoring)
- [ ] Configurar alertas Vercel

### Post-Deployment
- [ ] Validar response format incluye parlays
- [ ] Monitorear error rate (< 1%)
- [ ] Monitorear latency (< 5s)
- [ ] Revisar logs "[chat] ✅ FerXxxa intel loaded"

---

## 📞 CONTACTO & ESCALACIONES

| Issue | Responsable | Documento |
|-------|-------------|-----------|
| Parlay generation falla | Dev + Groq API | `DEPLOYMENT_GUIDE_PARLAYS.md` § FAQ #1 |
| Kelly % incorrectos | Dev | `PARLAY_METHODOLOGY.md` § 4 |
| FerXxxa no se integra | Dev + DB | `DEPLOYMENT_GUIDE_PARLAYS.md` § FAQ #3 |
| Performance degradation | DevOps | `DEPLOYMENT_GUIDE_PARLAYS.md` § Monitoring |

---

## 📚 REFERENCIAS ACADÉMICAS

**Kelly Criterion:**
- Original paper: J.L. Kelly Jr. (1956) "A New Interpretation of Information Rate"
- Applied: Sharp, Westhoff (2012) "Sharp Sports Betting"

**Correlación en apuestas:**
- Varias fuentes académicas sobre dependent events en gambling

**Implementación:**
- Groq LLM (Llama 3.3-70b-versatile)
- Claude reasoning principles (step-by-step, source citations)

---

## 🗂️ ORGANIZACIÓN DE ARCHIVOS

```
mundial2026/
├── api/
│   └── chat.js ........................... MODIFICADO ✏️
├── PARLAYS_EXAMPLES.json ................. NUEVO 📄
├── PARLAY_METHODOLOGY.md ................. NUEVO 📚
├── CHANGELOG_PARLAYS_v4.0.md ............. NUEVO 📋
├── DEPLOYMENT_GUIDE_PARLAYS.md ........... NUEVO 🚀
├── SUMMARY_PARLAYS_IMPLEMENTATION.txt ... NUEVO 📊
└── DOCUMENTATION_INDEX.md ................ NUEVO (este archivo) 🗂️
```

---

## 🎯 SIGUIENTES PASOS

1. **Approval:**
   - [ ] Code review (api/chat.js)
   - [ ] Documentation review
   - [ ] Security check (no secrets exposed)

2. **Deployment:**
   - [ ] Merge a main
   - [ ] Deploy en Vercel
   - [ ] Monitor primeros 24h

3. **User Education:**
   - [ ] Email announcement
   - [ ] Update FAQ
   - [ ] In-app tour (si aplica)

4. **Monitoring:**
   - [ ] Track parlay generation rate
   - [ ] Monitor Kelly accuracy
   - [ ] Collect user feedback

---

## 📝 VERSIONES FUTURAS

| Versión | Features | Timeline |
|---------|----------|----------|
| v4.0 | Parlays inteligentes, Kelly, correlaciones | ✅ Released |
| v4.1 | ML tuning, real-time odds, heat maps | TBD |
| v4.2 | Predictive modeling (xG), dashboard | TBD |
| v5.0 | Multi-sport, advanced strategies | TBD |

---

**Última actualización:** 2026-05-25
**Versión:** v4.0 Parlays
**Status:** Production Ready
**Mantenedor:** IA-Zak Team
