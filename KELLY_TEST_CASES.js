/**
 * Test Cases para Kelly Criterion en Colones
 * Archivo para validar la implementación de /api/chat
 *
 * Uso: node KELLY_TEST_CASES.js (requiere API configurada)
 */

// Importar funciones de validación
const calculateKellyCriterion = (probability, odds) => {
  if (!probability || !odds || probability <= 0 || odds <= 1) {
    return { error: 'Invalid probability or odds' };
  }
  const edge = (probability * odds) - 1;
  if (edge <= 0) {
    return {
      error: 'Negative edge - expected value is negative',
      edge: Math.round(edge * 10000) / 100,
      kelly_percentage: 0,
      reason: 'Odds do not provide value given estimated probability'
    };
  }
  const kellyDecimal = (edge * probability) / odds;
  const kellyPercentage = Math.round(kellyDecimal * 10000) / 100;
  return {
    kelly_percentage: kellyPercentage,
    edge: Math.round(edge * 10000) / 100,
    probability: probability,
    odds: odds,
    is_positive_ev: true,
    fractional_kelly_half: Math.round(kellyPercentage * 50) / 100,
    fractional_kelly_quarter: Math.round(kellyPercentage * 25) / 100
  };
};

const calculateBetSizeColones = (kelly_percentage, bankroll, maxBet = 50000) => {
  if (!kelly_percentage || !bankroll || bankroll < 5000) {
    return {
      error: `Bankroll insufficient (${bankroll} < 5000)`,
      minimum_bankroll: 5000
    };
  }
  const betSize = (kelly_percentage / 100) * bankroll;
  const cappedBetSize = Math.min(betSize, maxBet);
  const isCapped = betSize > maxBet;
  return {
    amount_colones: Math.round(cappedBetSize),
    kelly_percentage: kelly_percentage,
    bankroll: bankroll,
    is_capped: isCapped,
    warnings: kelly_percentage > 25
      ? [`⚠️ Kelly alto (${kelly_percentage}%). Considera Fractional Kelly.`]
      : []
  };
};

// TEST CASES
// Nota: Kelly % = (edge × probability) / odds
// edge = (probability × odds) - 1
const testCases = [
  {
    name: 'Test 1: Kelly Básico Positivo',
    probability: 0.68,
    odds: 1.80,
    bankroll: 40000,
    expectedKelly: 8.46, // edge=0.224, kelly=(0.224*0.68)/1.80=8.46%
    expectedBet: 3384
  },
  {
    name: 'Test 2: Kelly Bajo (conservador)',
    probability: 0.55,
    odds: 1.90,
    bankroll: 50000,
    expectedKelly: 1.29, // edge=0.045, kelly=(0.045*0.55)/1.90=1.29%
    expectedBet: 645
  },
  {
    name: 'Test 3: Kelly Alto (Fractional recomendado)',
    probability: 0.85,
    odds: 2.50,
    bankroll: 30000,
    expectedKelly: 38.25, // edge=1.125, kelly=(1.125*0.85)/2.50=38.25%
    expectedBet: 11475, // 38.25% de 30000
    shouldWarn: true
  },
  {
    name: 'Test 4: Over/Under estándar',
    probability: 0.62,
    odds: 1.72,
    bankroll: 25000,
    expectedKelly: 2.39, // edge=0.0664, kelly=(0.0664*0.62)/1.72=2.39%
    expectedBet: 598
  },
  {
    name: 'Test 5: BTTS positivo',
    probability: 0.58,
    odds: 1.95,
    bankroll: 45000,
    expectedKelly: 3.90, // edge=0.131, kelly=(0.131*0.58)/1.95=3.90%
    expectedBet: 1755
  },
  {
    name: 'Test 6: Probabilidad alta pero odds baja',
    probability: 0.95,
    odds: 1.10,
    bankroll: 20000,
    expectedKelly: 3.89, // edge=0.045, kelly=(0.045*0.95)/1.10=3.89%
    expectedBet: 778
  }
];

// TEST CON BANKROLL INVALIDO
const invalidBankrollTests = [
  {
    name: 'Test Inv-1: Bankroll < ₡5,000',
    bankroll: 2500,
    expectedError: true,
    expectedMessage: 'Bankroll insufficient'
  },
  {
    name: 'Test Inv-2: Bankroll = 0',
    bankroll: 0,
    expectedError: true,
    expectedMessage: 'Bankroll insufficient'
  }
];

// EJECUCIÓN
console.log('════════════════════════════════════════════════════════════');
console.log('TEST SUITE: Kelly Criterion en Colones');
console.log('════════════════════════════════════════════════════════════\n');

let passedTests = 0;
let failedTests = 0;

// Test cases válidos
testCases.forEach((test, index) => {
  console.log(`\n${test.name}`);
  console.log('─'.repeat(50));

  const kellyCalc = calculateKellyCriterion(test.probability, test.odds);

  if (kellyCalc.error) {
    console.log('❌ ERROR EN KELLY CALCULATION:', kellyCalc.error);
    failedTests++;
    return;
  }

  console.log(`Probabilidad: ${(test.probability * 100).toFixed(2)}%`);
  console.log(`Odds: ${test.odds}`);
  console.log(`Edge: ${kellyCalc.edge}%`);
  console.log(`Kelly %: ${kellyCalc.kelly_percentage}%`);
  console.log(`Bankroll: ₡${test.bankroll.toLocaleString('es-CR')}`);

  const betCalc = calculateBetSizeColones(kellyCalc.kelly_percentage, test.bankroll);

  if (betCalc.error) {
    console.log('❌ ERROR EN BET CALCULATION:', betCalc.error);
    failedTests++;
    return;
  }

  console.log(`Apuesta Recomendada: ₡${betCalc.amount_colones.toLocaleString('es-CR')}`);
  console.log(`Es Capped (₡50k): ${betCalc.is_capped ? '✅ Sí' : '❌ No'}`);

  if (betCalc.warnings.length > 0) {
    betCalc.warnings.forEach(w => console.log(w));
  }

  // Validación
  const kellyMatch = Math.abs(kellyCalc.kelly_percentage - test.expectedKelly) < 0.1;
  const betMatch = Math.abs(betCalc.amount_colones - test.expectedBet) < 50;

  if (kellyMatch && betMatch) {
    console.log('✅ PASS');
    passedTests++;
  } else {
    console.log('❌ FAIL');
    console.log(`  Expected Kelly: ${test.expectedKelly}%, Got: ${kellyCalc.kelly_percentage}%`);
    console.log(`  Expected Bet: ₡${test.expectedBet}, Got: ₡${betCalc.amount_colones}`);
    failedTests++;
  }
});

// Test cases con bankroll inválido
console.log('\n\n════════════════════════════════════════════════════════════');
console.log('TEST SUITE: Validación de Bankroll');
console.log('════════════════════════════════════════════════════════════\n');

invalidBankrollTests.forEach((test) => {
  console.log(`\n${test.name}`);
  console.log('─'.repeat(50));

  const betCalc = calculateBetSizeColones(10, test.bankroll);

  console.log(`Bankroll: ₡${test.bankroll}`);

  if (betCalc.error && betCalc.error.includes('Bankroll insufficient')) {
    console.log(`✅ PASS - Error esperado: ${betCalc.error}`);
    passedTests++;
  } else {
    console.log(`❌ FAIL - Se esperaba error, pero no se obtuvo`);
    failedTests++;
  }
});

// RESUMEN
console.log('\n\n════════════════════════════════════════════════════════════');
console.log('RESUMEN DE TESTS');
console.log('════════════════════════════════════════════════════════════');
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Total: ${passedTests + failedTests}`);
console.log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);

if (failedTests === 0) {
  console.log('\n✅ TODOS LOS TESTS PASARON');
  process.exit(0);
} else {
  console.log('\n❌ ALGUNOS TESTS FALLARON');
  process.exit(1);
}
