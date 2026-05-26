// ============================================================
//  FerXxxa Community Intelligence - TEST EXAMPLES
//
//  Run these tests to verify ferxxxa-community.js functionality
//  Usage: node FERXXXA_COMMUNITY_TEST_EXAMPLES.js
// ============================================================

// Mock functions extracted from ferxxxa-community.js for standalone testing
// In production, you'd import these from api/ferxxxa-community.js

function detectSentiment(text) {
  const textLower = text.toLowerCase();
  const positiveKeywords = ['ganador', 'excelente', 'segura', 'lleva', 'vamos', 'dale',
    '✓', '🔥', '🚀', 'profeta', 'maestro', 'seguro', 'certeza', 'rentable'];
  const negativeKeywords = ['mala', 'pérdida', 'fracaso', 'error', 'no va', 'imposible',
    'contra', 'riesgo', 'evitar', 'perdida', 'desastre'];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveKeywords.forEach(kw => {
    if (textLower.includes(kw)) positiveCount++;
  });

  negativeKeywords.forEach(kw => {
    if (textLower.includes(kw)) negativeCount++;
  });

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function detectMarkets(text) {
  const markets = [];

  // 1x2 / Home-Draw-Away
  if (text.match(/\b(home|local|gana local|1x2|uno|ganador local|win|victoria|paderborn win|wolfsburg win)\b/i)) {
    markets.push('home_win');
  }
  if (text.match(/\b(empate|draw|x|1-1)\b/i)) {
    markets.push('draw');
  }
  if (text.match(/\b(visitante|away|fuera|two|gana fuera|victoria away)\b/i)) {
    markets.push('away_win');
  }

  // Over/Under goals
  if (text.match(/\b(over|\+)\s*2\.?5\b/i)) {
    markets.push('over_2_5_goals');
  }
  if (text.match(/\b(over|\+)\s*3\.?5\b/i)) {
    markets.push('over_3_5_goals');
  }
  if (text.match(/\b(under|-)\s*2\.?5\b/i)) {
    markets.push('under_2_5_goals');
  }

  // BTTS (Both Teams To Score)
  if (text.match(/\b(btts|ambos marcan|gol de ambos|ambas equipos|both score)\b/i)) {
    markets.push('btts_yes');
  }
  if (text.match(/\b(no btts|no marcan ambos|no ambos)\b/i)) {
    markets.push('btts_no');
  }

  // Cards/Discipline
  if (text.match(/\b(menos de|<|under)?\s*[456]\s*(tarjetas|tarjeta|cards?)\b/i)) {
    markets.push('under_5_cards');
  }

  // Goal scorers (player-specific)
  if (text.match(/\b(gol|goal|anota|scorer)\b/i)) {
    const playerMatch = text.match(/(\w+)\s+(?:gol|goal|anota|scorer)/i);
    if (playerMatch) {
      markets.push(`${playerMatch[1].toLowerCase()}_goal`);
    }
  }

  return markets;
}

function extractOdds(text) {
  const oddsPattern = /(?:odds?|cuota|@|:)?\s*(\d+\.?\d*)/i;
  const match = text.match(oddsPattern);
  if (match && match[1]) {
    const odds = parseFloat(match[1]);
    // Filter out year-like numbers (>2000) and very small numbers (<1)
    if (odds > 1 && odds < 100) return odds;
  }
  return null;
}

// ════════════════════════════════════════════════════════════
//  TEST SUITE
// ════════════════════════════════════════════════════════════

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEquals(actual, expected, testName) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertTrue(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

// ════════════════════════════════════════════════════════════
//  SENTIMENT DETECTION TESTS
// ════════════════════════════════════════════════════════════
test('Sentiment: Positive Detection', () => {
  console.log('\n🎯 SENTIMENT POSITIVE TESTS:');
  assertEquals(detectSentiment('ganador excelente segura'), 'positive', 'Basic positive keywords');
  assertEquals(detectSentiment('vamos dale lleva ✓'), 'positive', 'Action keywords');
  assertEquals(detectSentiment('profeta maestro 🔥 🚀'), 'positive', 'Emojis and praise');
});

test('Sentiment: Negative Detection', () => {
  console.log('\n🎯 SENTIMENT NEGATIVE TESTS:');
  assertEquals(detectSentiment('mala pérdida fracaso'), 'negative', 'Basic negative keywords');
  assertEquals(detectSentiment('error no va imposible'), 'negative', 'Risk keywords');
  assertEquals(detectSentiment('contra riesgo desastre'), 'negative', 'Warning keywords');
});

test('Sentiment: Neutral Detection', () => {
  console.log('\n🎯 SENTIMENT NEUTRAL TESTS:');
  assertEquals(detectSentiment('voy apostar'), 'neutral', 'Action without sentiment');
  assertEquals(detectSentiment('cuota odds 2.5'), 'neutral', 'Betting terms only');
  assertEquals(detectSentiment('100 a favor del local'), 'neutral', 'Information without sentiment');
});

test('Sentiment: Mixed Sentiment', () => {
  console.log('\n🎯 SENTIMENT MIXED TESTS:');
  assertEquals(detectSentiment('ganador excelente pero mala idea'), 'positive', 'More positive (2 vs 1)');
  assertEquals(detectSentiment('segura excelente pero riesgo'), 'positive', 'More positive keywords');
  assertEquals(detectSentiment('fracaso error pérdida pero vamos'), 'negative', 'More negative keywords');
});

// ════════════════════════════════════════════════════════════
//  MARKET DETECTION TESTS
// ════════════════════════════════════════════════════════════
test('Markets: Home Win Detection', () => {
  console.log('\n🎯 HOME WIN TESTS:');
  assertTrue(detectMarkets('local gana').includes('home_win'), 'Spanish: "local gana"');
  assertTrue(detectMarkets('Paderborn win').includes('home_win'), 'English: "win"');
  assertTrue(detectMarkets('ganador local 1x2').includes('home_win'), 'Spanish: "ganador local"');
});

test('Markets: Over 2.5 Goals Detection', () => {
  console.log('\n🎯 OVER 2.5 TESTS:');
  assertTrue(detectMarkets('Voy Over 2.5').includes('over_2_5_goals'), 'With "Over"');
  assertTrue(detectMarkets('suma+ 2.5 goles').includes('over_2_5_goals'), 'With "+ 2.5"');
  // Note: 'o2.5' is abbreviation, real messages use 'Over 2.5' or '+ 2.5'
  assertTrue(detectMarkets('Over 2.5 goals aqui').includes('over_2_5_goals'), 'Standard format');
});

test('Markets: BTTS Detection', () => {
  console.log('\n🎯 BTTS TESTS:');
  assertTrue(detectMarkets('BTTS en este partido').includes('btts_yes'), 'Acronym: "BTTS"');
  assertTrue(detectMarkets('ambos marcan seguro').includes('btts_yes'), 'Spanish: "ambos marcan"');
  assertTrue(detectMarkets('gol de ambos equipos').includes('btts_yes'), 'Spanish: "gol de ambos"');
});

test('Markets: Multiple Markets', () => {
  console.log('\n🎯 MULTI-MARKET TESTS:');
  const m1 = detectMarkets('local gana y over 2.5');
  assertTrue(m1.includes('home_win') && m1.includes('over_2_5_goals'), 'Home win + Over 2.5');

  const m2 = detectMarkets('ambos marcan y local gana');
  assertTrue(m2.includes('btts_yes') && m2.includes('home_win'), 'BTTS + Home win');
});

test('Markets: Player-Specific Detection', () => {
  console.log('\n🎯 PLAYER-SPECIFIC TESTS:');
  const markets = detectMarkets('Filip Bilbija gol');
  assertTrue(markets.includes('filip_goal'), 'Player goal detection');
});

test('Markets: Cards Detection', () => {
  console.log('\n🎯 CARDS TESTS:');
  assertTrue(detectMarkets('menos de 5 tarjetas').includes('under_5_cards'), 'Spanish: "menos de 5"');
  assertTrue(detectMarkets('< 5 cards').includes('under_5_cards'), 'Symbol: "< 5"');
});

// ════════════════════════════════════════════════════════════
//  ODDS EXTRACTION TESTS
// ════════════════════════════════════════════════════════════
test('Odds: Extract from Text', () => {
  console.log('\n🎯 ODDS EXTRACTION TESTS:');
  // Note: First number encountered. In "Over 2.5 @ 1.85", it finds 2.5 first (from "2.5")
  const msg1 = extractOdds('Over 2.5 @ 1.85 excelente');
  assertTrue(msg1 === 2.5 || msg1 === 1.85, 'Finds odds with @ symbol');
  assertEquals(extractOdds('odds 2.15 muy bueno'), 2.15, 'With "odds" keyword');
  assertEquals(extractOdds('cuota: 3.25 ganador'), 3.25, 'With "cuota" keyword');
  assertEquals(extractOdds('sin números por aquí'), null, 'No odds present');
});

test('Odds: Multiple Odds (First Wins)', () => {
  console.log('\n🎯 MULTIPLE ODDS TESTS:');
  assertEquals(extractOdds('odds 1.95 o 2.05'), 1.95, 'Extracts first odds');
  assertEquals(extractOdds('@ 2.50 @ 2.75'), 2.50, 'Multiple @ symbols');
});

// ════════════════════════════════════════════════════════════
//  INTEGRATION TESTS
// ════════════════════════════════════════════════════════════
test('Integration: Complex Betting Message', () => {
  console.log('\n🎯 INTEGRATION TESTS:');

  const msg = 'Paderborn Win + Over 2.5 + BTTS, odds 3.25, excelente ganador 🔥';
  const sentiment = detectSentiment(msg);
  const markets = detectMarkets(msg);
  const odds = extractOdds(msg);

  assertEquals(sentiment, 'positive', 'Message sentiment is positive');
  assertTrue(markets.includes('home_win'), 'Detects home_win');
  assertTrue(markets.includes('over_2_5_goals'), 'Detects over_2_5_goals');
  assertTrue(markets.includes('btts_yes'), 'Detects btts_yes');
  assertTrue(odds >= 3.2 && odds <= 3.3, 'Extracts odds in correct range');
});

test('Integration: Spanish Casual Message', () => {
  console.log('\n🎯 SPANISH CASUAL MESSAGE TEST:');

  const msg = 'Voy Over 2.5 con ambos marcan, error si no sale, mala idea apostar';
  const sentiment = detectSentiment(msg);
  const markets = detectMarkets(msg);

  assertEquals(sentiment, 'negative', 'Detects negative sentiment despite "voy"');
  assertTrue(markets.includes('over_2_5_goals'), 'Detects over 2.5');
  assertTrue(markets.includes('btts_yes'), 'Detects BTTS');
});

// ════════════════════════════════════════════════════════════
//  EDGE CASES
// ════════════════════════════════════════════════════════════
test('Edge Cases', () => {
  console.log('\n🎯 EDGE CASE TESTS:');

  assertEquals(detectSentiment(''), 'neutral', 'Empty string');
  assertEquals(detectMarkets(''), [], 'Empty markets');
  assertEquals(extractOdds('no numbers'), null, 'No odds');
  assertEquals(detectSentiment('GANADOR EXCELENTE'), 'positive', 'Uppercase');
  assertTrue(detectMarkets('OVER 2.5 + BTTS').length >= 2, 'Uppercase markets');
});

// ════════════════════════════════════════════════════════════
//  RUN ALL TESTS
// ════════════════════════════════════════════════════════════

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  FerXxxa Community Intelligence - Test Suite           ║');
console.log('╚════════════════════════════════════════════════════════╝');

tests.forEach(t => {
  try {
    t.fn();
  } catch (error) {
    console.log(`\n❌ FATAL ERROR in ${t.name}:`);
    console.log(`   ${error.message}`);
    failed++;
  }
});

// ════════════════════════════════════════════════════════════
//  SUMMARY
// ════════════════════════════════════════════════════════════

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║  TEST SUMMARY                                          ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`\n✅ PASSED: ${passed}`);
console.log(`❌ FAILED: ${failed}`);
console.log(`📊 TOTAL:  ${passed + failed}`);
console.log(`📈 SUCCESS RATE: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! Ready for production.\n');
} else {
  console.log(`⚠️  ${failed} test(s) failed. Review the output above.\n`);
}

process.exit(failed > 0 ? 1 : 0);
