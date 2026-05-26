# FerXxxa Intel - Response Examples

## Example 1: Successful Live Data (DoradoBet Up)

```json
{
  "success": true,
  "timestamp": "2026-05-23T10:30:00Z",
  "source": "doradobet_live",
  "data_persisted": true,
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 247,
      "predictions": [
        {
          "bet_type": "1x2",
          "prediction": "home_win",
          "frequency": 68,
          "percentage": 27.5
        },
        {
          "bet_type": "1x2",
          "prediction": "draw",
          "frequency": 42,
          "percentage": 17.0
        },
        {
          "bet_type": "1x2",
          "prediction": "away_win",
          "frequency": 53,
          "percentage": 21.5
        },
        {
          "bet_type": "Over/Under",
          "prediction": "over_2.5",
          "frequency": 125,
          "percentage": 50.6
        },
        {
          "bet_type": "Over/Under",
          "prediction": "under_2.5",
          "frequency": 78,
          "percentage": 31.6
        },
        {
          "bet_type": "BTTS",
          "prediction": "yes",
          "frequency": 62,
          "percentage": 25.1
        }
      ]
    },
    "odds_movement": {
      "home_win": {
        "3h_ago": 1.92,
        "current": 1.88,
        "change": -0.04,
        "direction": "down"
      },
      "draw": {
        "3h_ago": 3.45,
        "current": 3.52,
        "change": 0.07,
        "direction": "up"
      },
      "away_win": {
        "3h_ago": 4.20,
        "current": 4.35,
        "change": 0.15,
        "direction": "up"
      }
    },
    "injury_alerts": [
      {
        "player": "Kylian Mbappé",
        "status": "reported_questionable",
        "confidence": "medium",
        "mentions": 23
      },
      {
        "player": "Rodrygo",
        "status": "reported_out",
        "confidence": "high",
        "mentions": 34
      },
      {
        "player": "Léo Ortiz",
        "status": "reported_fit",
        "confidence": "high",
        "mentions": 5
      },
      {
        "player": "Gvardiol",
        "status": "reported_questionable",
        "confidence": "low",
        "mentions": 3
      }
    ],
    "sentiment_analysis": {
      "positive_messages": 94,
      "negative_messages": 52,
      "neutral_messages": 101,
      "overall_sentiment": "neutral"
    },
    "trending_narratives": [
      "Argentina's recent form very strong after Copa America",
      "France has concerning depth issues in attack",
      "Over 2.5 is attractive value at current odds",
      "Both defenses have been porous in recent games",
      "Mbappé fitness uncertainty is key risk factor",
      "First half under could be good play",
      "Market overreacting to injury concerns"
    ]
  }
}
```

---

## Example 2: Cached Data (DoradoBet Down)

```json
{
  "success": true,
  "timestamp": "2026-05-23T13:30:00Z",
  "source": "cache_or_fallback",
  "data_persisted": false,
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 189,
      "predictions": [
        {
          "bet_type": "1x2",
          "prediction": "home_win",
          "frequency": 52,
          "percentage": 27.5
        },
        {
          "bet_type": "1x2",
          "prediction": "draw",
          "frequency": 32,
          "percentage": 17.0
        },
        {
          "bet_type": "1x2",
          "prediction": "away_win",
          "frequency": 40,
          "percentage": 21.2
        },
        {
          "bet_type": "Over/Under",
          "prediction": "over_2.5",
          "frequency": 96,
          "percentage": 50.8
        },
        {
          "bet_type": "Over/Under",
          "prediction": "under_2.5",
          "frequency": 60,
          "percentage": 31.7
        },
        {
          "bet_type": "BTTS",
          "prediction": "yes",
          "frequency": 48,
          "percentage": 25.4
        }
      ]
    },
    "odds_movement": {
      "home_win": {
        "3h_ago": 1.95,
        "current": 1.92,
        "change": -0.03,
        "direction": "down"
      },
      "draw": {
        "3h_ago": 3.40,
        "current": 3.45,
        "change": 0.05,
        "direction": "up"
      },
      "away_win": {
        "3h_ago": 4.10,
        "current": 4.20,
        "change": 0.10,
        "direction": "up"
      }
    },
    "injury_alerts": [
      {
        "player": "Kylian Mbappé",
        "status": "reported_questionable",
        "confidence": "medium",
        "mentions": 18
      },
      {
        "player": "Rodrygo",
        "status": "reported_out",
        "confidence": "high",
        "mentions": 29
      }
    ],
    "sentiment_analysis": {
      "positive_messages": 71,
      "negative_messages": 41,
      "neutral_messages": 77,
      "overall_sentiment": "slightly_positive"
    },
    "trending_narratives": [
      "Argentina looking dangerous in attack",
      "France's injuries a major concern",
      "Over 2.5 value play emerging",
      "Markets adjusting slowly to team news"
    ]
  }
}
```

---

## Example 3: Error Response (With Fallback)

```json
{
  "success": false,
  "error": "Processing error",
  "message": "fetch failed: DoradoBet response timeout",
  "timestamp": "2026-05-23T16:30:00Z",
  "fallback_intel": {
    "match_predictions": {
      "total_chat_messages": 0,
      "predictions": []
    },
    "odds_movement": {},
    "injury_alerts": [],
    "sentiment_analysis": {
      "positive_messages": 0,
      "negative_messages": 0,
      "neutral_messages": 0,
      "overall_sentiment": "unknown"
    },
    "trending_narratives": [
      "Data unavailable - check connection"
    ]
  }
}
```

---

## Example 4: Development Mode (No Auth)

```bash
# Request
curl http://localhost:3000/api/ferxxxa-intel

# Response
{
  "success": true,
  "timestamp": "2026-05-23T12:15:30Z",
  "source": "doradobet_live",
  "data_persisted": true,
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 156,
      "predictions": [
        {
          "bet_type": "1x2",
          "prediction": "home_win",
          "frequency": 45,
          "percentage": 28.8
        },
        ...more predictions...
      ]
    },
    ...rest of intel...
  }
}
```

---

## Example 5: Production Mode (With Auth)

```bash
# Request with CRON_SECRET
curl -H "Authorization: Bearer your-cron-secret-here" \
  https://mundial2026-analytics.vercel.app/api/ferxxxa-intel

# Response (same as development, but requires auth)
{
  "success": true,
  "timestamp": "2026-05-23T21:00:00Z",
  "source": "doradobet_live",
  "data_persisted": true,
  "ferxxxa_intel": {...}
}
```

---

## Example 6: Unauthorized Request

```bash
# Request without proper auth
curl https://mundial2026-analytics.vercel.app/api/ferxxxa-intel

# Response
{
  "success": false,
  "error": "Unauthorized",
  "message": "Missing or invalid CRON_SECRET"
}
```

---

## Example 7: Every 3-Hour Cycle Data

### 00:00 UTC
```json
{
  "success": true,
  "timestamp": "2026-05-23T00:00:00Z",
  "source": "doradobet_live",
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 312,
      "predictions": [
        {"bet_type": "1x2", "prediction": "home_win", "frequency": 89, "percentage": 28.5},
        {"bet_type": "1x2", "prediction": "draw", "frequency": 52, "percentage": 16.7},
        {"bet_type": "1x2", "prediction": "away_win", "frequency": 71, "percentage": 22.8},
        {"bet_type": "Over/Under", "prediction": "over_2.5", "frequency": 167, "percentage": 53.5},
        {"bet_type": "BTTS", "prediction": "yes", "frequency": 78, "percentage": 25.0}
      ]
    },
    "odds_movement": {
      "home_win": {"3h_ago": null, "current": 1.90, "change": 0.0, "direction": "stable"},
      "draw": {"3h_ago": null, "current": 3.48, "change": 0.0, "direction": "stable"},
      "away_win": {"3h_ago": null, "current": 4.25, "change": 0.0, "direction": "stable"}
    },
    "injury_alerts": [
      {"player": "Mbappé", "status": "reported_fit", "confidence": "high", "mentions": 8}
    ],
    "sentiment_analysis": {
      "positive_messages": 118,
      "negative_messages": 64,
      "neutral_messages": 130,
      "overall_sentiment": "neutral"
    },
    "trending_narratives": [
      "Market settles as team sheets confirmed",
      "Both teams at full strength",
      "Over 2.5 the popular play"
    ]
  }
}
```

### 03:00 UTC (3 hours later)
```json
{
  "success": true,
  "timestamp": "2026-05-23T03:00:00Z",
  "source": "doradobet_live",
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 289,
      "predictions": [
        {"bet_type": "1x2", "prediction": "home_win", "frequency": 76, "percentage": 26.3},
        {"bet_type": "1x2", "prediction": "draw", "frequency": 51, "percentage": 17.6},
        {"bet_type": "1x2", "prediction": "away_win", "frequency": 69, "percentage": 23.9},
        {"bet_type": "Over/Under", "prediction": "over_2.5", "frequency": 155, "percentage": 53.6},
        {"bet_type": "BTTS", "prediction": "yes", "frequency": 71, "percentage": 24.6}
      ]
    },
    "odds_movement": {
      "home_win": {"3h_ago": 1.90, "current": 1.88, "change": -0.02, "direction": "down"},
      "draw": {"3h_ago": 3.48, "current": 3.52, "change": 0.04, "direction": "up"},
      "away_win": {"3h_ago": 4.25, "current": 4.32, "change": 0.07, "direction": "up"}
    },
    "injury_alerts": [
      {"player": "Mbappé", "status": "reported_fit", "confidence": "high", "mentions": 12},
      {"player": "Rodrygo", "status": "reported_fit", "confidence": "high", "mentions": 6}
    ],
    "sentiment_analysis": {
      "positive_messages": 109,
      "negative_messages": 58,
      "neutral_messages": 122,
      "overall_sentiment": "neutral"
    },
    "trending_narratives": [
      "Over 2.5 shortens slightly in odds",
      "Chat sentiment shifts toward away team",
      "Heavy pregame betting activity"
    ]
  }
}
```

### 06:00 UTC (6 hours from start)
```json
{
  "success": true,
  "timestamp": "2026-05-23T06:00:00Z",
  "source": "doradobet_live",
  "ferxxxa_intel": {
    "match_predictions": {
      "total_chat_messages": 543,
      "predictions": [
        {"bet_type": "1x2", "prediction": "home_win", "frequency": 142, "percentage": 26.2},
        {"bet_type": "1x2", "prediction": "draw", "frequency": 95, "percentage": 17.5},
        {"bet_type": "1x2", "prediction": "away_win", "frequency": 128, "percentage": 23.6},
        {"bet_type": "Over/Under", "prediction": "over_2.5", "frequency": 293, "percentage": 53.9},
        {"bet_type": "BTTS", "prediction": "yes", "frequency": 134, "percentage": 24.7}
      ]
    },
    "odds_movement": {
      "home_win": {"3h_ago": 1.88, "current": 1.85, "change": -0.03, "direction": "down"},
      "draw": {"3h_ago": 3.52, "current": 3.58, "change": 0.06, "direction": "up"},
      "away_win": {"3h_ago": 4.32, "current": 4.42, "change": 0.10, "direction": "up"}
    },
    "injury_alerts": [
      {"player": "Mbappé", "status": "reported_fit", "confidence": "high", "mentions": 28},
      {"player": "Rodrygo", "status": "reported_fit", "confidence": "high", "mentions": 18},
      {"player": "Gvardiol", "status": "reported_questionable", "confidence": "medium", "mentions": 7}
    ],
    "sentiment_analysis": {
      "positive_messages": 205,
      "negative_messages": 109,
      "neutral_messages": 229,
      "overall_sentiment": "neutral"
    },
    "trending_narratives": [
      "Away team emerging as value play in 1x2",
      "Over 2.5 consensus strengthens",
      "Kickoff 1 hour away - final decisions being made",
      "Defensive vulnerability in both teams becomes topic"
    ]
  }
}
```

---

## Data Field Explanations

### match_predictions
- **total_chat_messages**: Total messages analyzed in this cycle
- **predictions[].bet_type**: Type of market (1x2, Over/Under, BTTS, etc.)
- **predictions[].prediction**: The specific outcome
- **predictions[].frequency**: Count of times mentioned/predicted
- **predictions[].percentage**: Frequency as percentage of total messages

### odds_movement
- **3h_ago**: Odds 3 hours ago (null if this is first scan)
- **current**: Current odds at scan time
- **change**: Absolute change (current - 3h_ago)
- **direction**: "up" (odds lengthened) or "down" (odds shortened)

### injury_alerts
- **player**: Player name
- **status**: One of: reported_fit, reported_questionable, reported_out
- **confidence**: Level of certainty: low, medium, high
- **mentions**: Number of chat mentions in this cycle

### sentiment_analysis
- **positive_messages**: Count of bullish/optimistic messages
- **negative_messages**: Count of bearish/pessimistic messages
- **neutral_messages**: Count of neutral discussion
- **overall_sentiment**: Aggregate: positive, slightly_positive, neutral, negative, mixed

### trending_narratives
- Array of strings summarizing main discussion topics
- Extracted from most-mentioned themes
- Real examples or generated based on data patterns

---

## Integration Points

These examples show how the data flows:

```javascript
// In chat.js or analysis context
const intelResponse = await fetch('/api/ferxxxa-intel', {
  headers: {'Authorization': `Bearer ${CRON_SECRET}`}
});

const intel = await intelResponse.json();

// Use in prompt context
const context = `
Current betting market intelligence:
- ${intel.ferxxxa_intel.match_predictions.predictions[0]?.frequency} users predicting ${intel.ferxxxa_intel.match_predictions.predictions[0]?.prediction}
- Over/Under: ${intel.ferxxxa_intel.match_predictions.predictions.find(p => p.bet_type === 'Over/Under' && p.prediction === 'over_2.5')?.percentage}% lean to OVER
- Chat sentiment: ${intel.ferxxxa_intel.sentiment_analysis.overall_sentiment}
- Key injuries: ${intel.ferxxxa_intel.injury_alerts.map(i => i.player).join(', ')}
- Trending: ${intel.ferxxxa_intel.trending_narratives[0]}
`;
```

---

**All examples reflect realistic DoradoBet betting chat patterns**
**Percentages and frequencies vary within expected ranges**
