# IA-Zak v5.0: 5-Parlay API Examples

Complete request/response examples for the enhanced `/api/chat` endpoint with parlay generation.

---

## Example 1: Basic Parlay Request (Spanish)

### Request
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuáles son las 5 mejores combinadas para Paderborn vs Wolfsburg?",
    "session_id": "user_12345_session_01",
    "language": "es",
    "bankroll": 50000
  }'
```

### Response (Condensed - 5 Parlays)
```json
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  "response": "He analizado el partido Paderborn vs Wolfsburg con datos reales de DoradoBet y sentimiento comunitario. Los tres factores clave son: (1) Paderborn en casa con buena forma, (2) Defensa de Wolfsburg vulnerable, (3) Comunidad apuesta fuertemente en Over 2.5 + BTTS. He generado 5 parlays con perfiles de riesgo variados, desde muy conservador (Kelly 4%) hasta muy agresivo (Kelly 11.5%).",
  
  "reasoning_chain": [
    "Paso 1: Entiendo que preguntas sobre Paderborn vs Wolfsburg",
    "Paso 2: Cargo datos reales de DoradoBet (cuotas vivas)",
    "Paso 3: Analizo datos comunitarios de FerXxxa (187+ / 43- mensajes)",
    "Paso 4: Calculo probabilidades con Kelly Criterion",
    "Paso 5: Evalúo Risk of Ruin para cada parlay",
    "Paso 6: Genero 5 parlays con perfiles de riesgo variados"
  ],

  "recommendations": [
    "Parlay 1 (Conservadora): ₡2,100 @ 3.41 cuota (Kelly 4.2%, ROR 0.8%)",
    "Parlay 2 (Moderada): ₡3,550 @ 6.02 cuota (Kelly 7.1%, ROR 1.5%)",
    "Parlay 3 (Agresiva): ₡4,600 @ 10.45 cuota (Kelly 9.2%, ROR 2.5%)",
    "Parlay 4 (Muy Agresiva): ₡5,750 @ 15.82 cuota (Kelly 11.5%, ROR 5.2%)",
    "Parlay 5 (Consenso): ₡4,450 @ 5.84 cuota (Kelly 8.9%, ROR 2.1%)"
  ],

  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservadora - Victoria Local + Menos de 2.5 Goles",
      "risk_profile": "conservative",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "expected_win_colones": 5586,
      "max_loss_colones": 2100,
      "risk_of_ruin_percent": 0.8,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.65,
          "odds": 1.75,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Under 2.5",
          "your_probability": 0.45,
          "odds": 1.95,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.293,
      "combined_odds": 3.41,
      "edge_calculation": "4.2%",
      "detailed_reasoning": "Paderborn local fuerte pero Wolfsburg defiende bien. Combinada anti-correlacionada captura victoria con cautela en goles totales. Baja varianza, alta probabilidad de ganancia.",
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9% de apostadores)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "Evitamos BTTS por robustez defensiva de Wolfsburg. Edge diferente basado en xG defensiva."
      },
      "arbitrage_check": {
        "has_opportunity": false,
        "note": "Cuotas reales de DoradoBet alineadas con ponderación óptima según nuestro modelo"
      }
    },
    
    {
      "rank": 2,
      "name": "Moderada - Victoria Local + Over 2.5 + BTTS",
      "risk_profile": "moderate",
      "kelly_percentage": 7.1,
      "bankroll_amount_colones": 3550,
      "expected_win_colones": 15781,
      "max_loss_colones": 3550,
      "risk_of_ruin_percent": 1.5,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.65,
          "odds": 1.75,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Over 2.5",
          "your_probability": 0.62,
          "odds": 1.65,
          "source": "doradobet_real"
        },
        {
          "market": "BTTS",
          "prediction": "Both Teams Score",
          "your_probability": 0.48,
          "odds": 2.10,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.218,
      "combined_odds": 6.02,
      "edge_calculation": "7.1%",
      "detailed_reasoning": "Balance entre victoria local y goles abundantes. Este parlay alinea con sentimiento comunitario (42.9% apuesta Over + BTTS). Riesgo moderado, recompensa sólida. Correlación positiva entre eventos (+5% ajuste).",
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9% de apostadores)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "TOTALMENTE ALINEADO - Nuestra predicción + modelo coinciden con comunidad"
      },
      "arbitrage_check": {
        "has_opportunity": false,
        "note": "No hay oportunidad de arbitraje detectada entre plataformas"
      }
    },

    {
      "rank": 3,
      "name": "Agresiva - Victoria Local + Over 3.5 + BTTS + Corners",
      "risk_profile": "aggressive",
      "kelly_percentage": 9.2,
      "bankroll_amount_colones": 4600,
      "expected_win_colones": 43670,
      "max_loss_colones": 4600,
      "risk_of_ruin_percent": 2.5,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.65,
          "odds": 1.75,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Over 3.5",
          "your_probability": 0.38,
          "odds": 2.55,
          "source": "doradobet_real"
        },
        {
          "market": "BTTS",
          "prediction": "Both Teams Score",
          "your_probability": 0.48,
          "odds": 2.10,
          "source": "doradobet_real"
        },
        {
          "market": "Corners",
          "prediction": "Over 8.5",
          "your_probability": 0.52,
          "odds": 1.85,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.165,
      "combined_odds": 10.45,
      "edge_calculation": "9.2%",
      "detailed_reasoning": "Parlay agresiva con eventos positivamente correlacionados. Paderborn con ataque fuerte implica más goles Y corners. Menor probabilidad (~16%) pero cuota muy alta (10.45x). Ideal si tienes edge en forma de equipo.",
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9%)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "Divergencia leve - añadimos Over 3.5 + Corners. Creemos que comunidad es conservadora con total de goles."
      },
      "arbitrage_check": {
        "has_opportunity": false,
        "note": "Cuotas competitivas en DoradoBet"
      }
    },

    {
      "rank": 4,
      "name": "Muy Agresiva - Edge Play con Líneas Desalineadas",
      "risk_profile": "very_aggressive",
      "kelly_percentage": 11.5,
      "bankroll_amount_colones": 5750,
      "expected_win_colones": 85795,
      "max_loss_colones": 5750,
      "risk_of_ruin_percent": 5.2,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.65,
          "odds": 1.72,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Over 4.5",
          "your_probability": 0.22,
          "odds": 4.20,
          "source": "doradobet_real"
        },
        {
          "market": "Home Corners",
          "prediction": "Over 4.5",
          "your_probability": 0.55,
          "odds": 1.80,
          "source": "doradobet_real"
        },
        {
          "market": "Shots on Target",
          "prediction": "Over 6.5",
          "your_probability": 0.50,
          "odds": 1.90,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.118,
      "combined_odds": 15.82,
      "edge_calculation": "11.5%",
      "detailed_reasoning": "Edge play basado en líneas aparentemente desalineadas. Mercado parece subestimar la probabilidad de Over 4.5 goles (14.8% vs 22% estimado). ROR alta (5.2%) pero edge potencial es significativo. Solo para usuarios avanzados.",
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9%)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "Fuerte divergencia - vemos oportunidad que comunidad no ha detectado. Over 4.5 desalineado."
      },
      "arbitrage_check": {
        "has_opportunity": true,
        "note": "Línea Over 4.5 potentially underpriced vs otros mercados de goles"
      }
    },

    {
      "rank": 5,
      "name": "Consenso Comunitario - Lo Que Apuesta FerXxxa",
      "risk_profile": "community_pick",
      "kelly_percentage": 8.9,
      "bankroll_amount_colones": 4450,
      "expected_win_colones": 19617,
      "max_loss_colones": 4450,
      "risk_of_ruin_percent": 2.1,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.65,
          "odds": 1.72,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Over 2.5",
          "your_probability": 0.62,
          "odds": 1.65,
          "source": "doradobet_real"
        },
        {
          "market": "BTTS",
          "prediction": "Both Teams Score",
          "your_probability": 0.48,
          "odds": 2.10,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.228,
      "combined_odds": 5.84,
      "edge_calculation": "8.9%",
      "detailed_reasoning": "Este parlay refleja exactamente lo que apuesta la comunidad (42.9% de apostadores en FerXxxa). Cuando modelo + comunidad convergen, confianza ALTA. Sin divergencias. Este es el consenso de mercado.",
      "community_consensus": {
        "consensus_bets": "Over 2.5 + BTTS (42.9% de apostadores)",
        "community_frequency": "42.9%",
        "community_sentiment": "very_positive",
        "our_divergence": "CERO DIVERGENCIA - Modelo + Comunidad en acuerdo TOTAL. Confianza muy alta."
      },
      "arbitrage_check": {
        "has_opportunity": false,
        "note": "Mercado eficiente - cuotas reflejan consenso comunitario"
      }
    }
  ],

  "data_sources_used": [
    "DoradoBet (Real Odds - FerXxxa API)",
    "FerXxxa Community Chat (Sentiment + Trending Bets)",
    "Form Data (Paderborn 3W-1D, Wolfsburg 2W-2L recent)",
    "xG Analysis (Paderborn 1.85 xG/game, Wolfsburg 0.95 xG/game allowed)",
    "Injury Reports (Wolfsburg CB questionable)"
  ],

  "uncertainties": [
    "Injury status Wolfsburg CB - if unavailable, reduce Wolfsburg xG defensive rating by 8%",
    "Weather impact - no severe weather predicted, low impact",
    "Referee history - neutral referee, low impact on yellow cards"
  ],

  "confidence": "high",
  "tool_calls": [],
  "bankroll_impact": null,
  "language": "es",

  "ferxxxa_intel": {
    "available": true,
    "age_minutes": 2,
    "data_freshness": "fresh",
    "stale": false,
    "warning": null,
    "markets_available": true,
    "community_available": true,
    "parlays_count": 5
  }
}
```

---

## Example 2: English Request (No Bankroll)

### Request
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me 5 parlay recommendations for Argentina vs France using real DoradoBet odds",
    "session_id": "user_67890_session_02",
    "language": "en"
  }'
```

### Response (Key Sections)
```json
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  "response": "I've analyzed Argentina vs France with real DoradoBet odds. Argentina is favored (1.72 to win) but France's counterattacking creates interesting parlay opportunities. I've generated 5 parlays ranging from very safe (Conservative, Kelly 4%) to high-variance edge plays (Very Aggressive, Kelly 11%+). Without your bankroll specified, I'm using a ₡50,000 default for calculations.",
  
  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservative - Argentina Win + Under 2.5 Goals",
      "risk_profile": "conservative",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 2100,
      "expected_win_colones": 5586,
      "max_loss_colones": 2100,
      "risk_of_ruin_percent": 0.8,
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "your_probability": 0.62,
          "odds": 1.72,
          "source": "doradobet_real"
        },
        {
          "market": "Total Goals",
          "prediction": "Under 2.5",
          "your_probability": 0.48,
          "odds": 1.92,
          "source": "doradobet_real"
        }
      ],
      "combined_probability": 0.298,
      "combined_odds": 3.30,
      "edge_calculation": "4.2%",
      "detailed_reasoning": "Argentina strong but France's defensive organization prevents high-scoring games. Anti-correlated bet captures Argentina's advantage with goal caution."
    },
    // ... ranks 2-5 (same structure, different events/odds)
  ],

  "ferxxxa_intel": {
    "available": true,
    "markets_available": true,
    "community_available": true,
    "parlays_count": 5,
    "data_freshness": "fresh"
  }
}
```

---

## Example 3: Request with Bankroll Warning

### Request
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Parlays para Brasil vs Uruguay? Tengo ₡3,000",
    "session_id": "user_99999_session_03",
    "language": "es",
    "bankroll": 3000
  }'
```

### Response (With Warning)
```json
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  "response": "⚠️ Tu bankroll de ₡3,000 es muy bajo para cálculos precisos de Kelly. Mínimo recomendado: ₡5,000. He generado los 5 parlays pero los montos son muy pequeños (₡126-399). Considera aumentar tu bankroll o comenzar con parlays más conservadores.",
  
  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservadora - Victoria Local + Menos de 2.5",
      "risk_profile": "conservative",
      "kelly_percentage": 4.2,
      "bankroll_amount_colones": 126,
      "expected_win_colones": 335,
      "risk_of_ruin_percent": 0.8
      // ... rest of parlay
    },
    // ... parlays 2-5 with reduced amounts (180-397₡)
  ],

  "uncertainties": [
    "⚠️ BANKROLL TOO LOW - Bankroll ₡3,000 < minimum ₡5,000 for precise Kelly calculations",
    "Suggested action: Increase bankroll to ₡5,000+ OR use 25% Kelly (more conservative)"
  ],

  "confidence": "low",
  "ferxxxa_intel": {
    "available": true,
    "parlays_count": 5
  }
}
```

---

## Example 4: No FerXxxa Data Available

### Request
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Mejores combinadas para México vs Canadá?",
    "session_id": "user_55555_session_04",
    "language": "es",
    "bankroll": 50000
  }'
```

### Response (Fallback Mode)
```json
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  "response": "No tengo datos reales de DoradoBet en este momento. He generado 5 parlays usando probabilidades teóricas basadas en forma reciente, xG, y análisis histórico. La precisión mejorará cuando FerXxxa Intel esté disponible.",
  
  "recommended_parlays": [
    {
      "rank": 1,
      "name": "Conservadora - Victoria Local + Menos de 2.5",
      "events": [
        {
          "market": "1x2 Result",
          "prediction": "Home Win",
          "odds": 1.70,
          "source": "theoretical_estimate"
        },
        // ... other events marked as "theoretical_estimate"
      ]
    },
    // ... ranks 2-5
  ],

  "uncertainties": [
    "⚠️ FerXxxa Data Unavailable - Using theoretical odds instead of real DoradoBet",
    "Data freshness: No recent community data",
    "Recommendation: Check back in 5 minutes when community intel is available"
  ],

  "ferxxxa_intel": {
    "available": false,
    "markets_available": false,
    "community_available": false,
    "data_freshness": "unavailable",
    "warning": "Markets may be outdated"
  }
}
```

---

## Example 5: Bankroll Validation - Too High Kelly

### Request
```bash
curl -X POST https://mundial2026-analytics.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Dame parlay para Portugal vs Dinamarca, bankroll ₡10,000",
    "session_id": "user_11111_session_05",
    "language": "es",
    "bankroll": 10000
  }'
```

### Response (High Kelly Warning)
```json
{
  "success": true,
  "message": "Analysis complete with 5 parlays",
  "response": "Analizado Portugal vs Dinamarca. Advertencia: El Parlay 4 (Muy Agresiva) sugiere Kelly 13.8%, que es alto para un bankroll de solo ₡10,000. Considera usar Fractional Kelly (50-75% del sugerido) = Kelly 7-10% equivalente = ₡700-1,000 en lugar de ₡1,380.",
  
  "recommended_parlays": [
    // ... parlay 1-3
    {
      "rank": 4,
      "name": "Muy Agresiva - Edge Play",
      "kelly_percentage": 13.8,
      "bankroll_amount_colones": 1380,
      "risk_of_ruin_percent": 8.5,
      "detailed_reasoning": "⚠️ HIGH KELLY WARNING - Este parlay tiene kelly 13.8% que es ALTO para bankroll pequeño. Risk of Ruin: 8.5%. Recomendación: USA FRACTIONAL KELLY (50%) = 7% = ₡700 para reducir riesgo."
    },
    // ... parlay 5
  ],

  "uncertainties": [
    "⚠️ Kelly > 25% en parlay 4 - Considera Fractional Kelly (50% del sugerido)",
    "Risk of Ruin en parlay muy agresivo: 8.5% es alto"
  ]
}
```

---

## Database Queries Used

### Fetch FerXxxa Markets
```sql
SELECT summary_json, studied_at FROM zak_intel
WHERE topic = 'ferxxxa_markets'
AND match_id = 'portugal_vs_dinamarca_2026_06_15'
AND studied_at > NOW() - INTERVAL '5 minutes'
ORDER BY studied_at DESC
LIMIT 1;
```

### Fetch FerXxxa Community
```sql
SELECT summary_json, studied_at FROM zak_intel
WHERE topic = 'ferxxxa_community'
AND match_id = 'portugal_vs_dinamarca_2026_06_15'
AND studied_at > NOW() - INTERVAL '5 minutes'
ORDER BY studied_at DESC
LIMIT 1;
```

### Fallback: Most Recent Data
```sql
SELECT match_id, topic, summary_json, studied_at
FROM zak_intel
WHERE topic IN ('ferxxxa_markets', 'ferxxxa_community')
AND studied_at > NOW() - INTERVAL '6 hours'
ORDER BY studied_at DESC
LIMIT 2;
```

---

## Key Response Fields Explained

| Field | Type | Description |
|-------|------|-------------|
| `recommended_parlays` | Array[Object] | Always 5 parlays, never empty |
| `recommended_parlays[].rank` | Number | 1-5, ordered by risk |
| `recommended_parlays[].kelly_percentage` | Number | % of bankroll to allocate |
| `recommended_parlays[].risk_of_ruin_percent` | Number | Probability of losing full bankroll |
| `recommended_parlays[].events` | Array[Object] | Market + prediction + real odds |
| `recommended_parlays[].community_consensus` | Object | What community bets vs our recommendation |
| `ferxxxa_intel.available` | Boolean | True if FerXxxa data loaded |
| `ferxxxa_intel.markets_available` | Boolean | True if real odds available |
| `ferxxxa_intel.community_available` | Boolean | True if community sentiment available |
| `ferxxxa_intel.data_freshness` | String | "fresh" (<1m), "recent" (<3h), "aging" (>3h), "unavailable" |

---

## Testing Checklist

- [x] Request with bankroll < ₡5,000 → Receives warning
- [x] Request with bankroll > ₡50,000 → Caps at ₡50,000
- [x] Request with Kelly > 25% → Warns user about Fractional Kelly
- [x] Request with FerXxxa available → Uses real odds
- [x] Request with NO FerXxxa → Uses theoretical odds (marked clearly)
- [x] All 5 parlays generated → Always present in response
- [x] Risk of Ruin calculated → Present for all parlays
- [x] Community consensus included → Shows divergence/alignment
- [x] Events marked with source → "doradobet_real" or "theoretical_estimate"

---

End of Examples
