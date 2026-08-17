import { validateTradeSetup, ACTIVE_SUPPORTED_INSTRUMENTS } from '../services/tradeSetupValidator';
import { getProximityThreshold } from '../services/analysisOutcomeMonitor';

console.log('=====================================================');
console.log('🧪 SMC TRADE SETUP INTEGRITY & VALIDATION SUITE');
console.log('=====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: any, testName: string, detail?: any) {
  totalTests++;
  if (Boolean(condition)) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`, detail || '');
  }
}

// 1. ACTIVE & DEACTIVATED INSTRUMENTS CHECK
assert(
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('BTCUSDT') &&
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('EURUSD') &&
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('GBPUSD') &&
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('USDJPY') &&
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('XAUUSD') &&
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('US500') &&
  ACTIVE_SUPPORTED_INSTRUMENTS.includes('NAS100'),
  'All 7 target instruments are in ACTIVE_SUPPORTED_INSTRUMENTS'
);

const ethResult = validateTradeSetup({
  symbol: 'ETH/USDT',
  instrumentId: 'ETHUSDT',
  direction: 'BULLISH',
  currentPrice: 3000,
  entryPrice: 3000,
  stopLossPrice: 2950,
  targetPrice: 3150,
});
assert(!ethResult.isValid && ethResult.rejectionReason?.includes('deactivated'), 'ETHUSDT is rejected as deactivated');

const solResult = validateTradeSetup({
  symbol: 'SOL/USDT',
  instrumentId: 'SOLUSDT',
  direction: 'BULLISH',
  currentPrice: 150,
  entryPrice: 150,
  stopLossPrice: 145,
  targetPrice: 165,
});
assert(!solResult.isValid && solResult.rejectionReason?.includes('deactivated'), 'SOLUSDT is rejected as deactivated');

// 2. HARD DIRECTIONAL GEOMETRY (BULLISH: SL < Entry < TP)
const validBullish = validateTradeSetup({
  symbol: 'EUR/USD',
  instrumentId: 'EURUSD',
  direction: 'BULLISH',
  currentPrice: 1.0850,
  entryPrice: 1.0850,
  stopLossPrice: 1.0820, // 30 pips risk
  targetPrice: 1.0910,   // 60 pips reward (2.0R)
});
assert(validBullish.isValid && validBullish.actualRR === 2.0, 'Valid Bullish setup passes (SL < Entry < TP, 2.0R)');

const malformedBullishSL = validateTradeSetup({
  symbol: 'EUR/USD',
  instrumentId: 'EURUSD',
  direction: 'BULLISH',
  currentPrice: 1.0850,
  entryPrice: 1.0850,
  stopLossPrice: 1.0870, // Inverted SL > Entry!
  targetPrice: 1.0950,
});
assert(!malformedBullishSL.isValid && malformedBullishSL.rejectionReason?.includes('Stop Loss (1.087) >= Entry (1.085)'), 'Bullish setup with SL >= Entry is strictly rejected');

const malformedBullishTP = validateTradeSetup({
  symbol: 'EUR/USD',
  instrumentId: 'EURUSD',
  direction: 'BULLISH',
  currentPrice: 1.0850,
  entryPrice: 1.0850,
  stopLossPrice: 1.0820,
  targetPrice: 1.0830, // Inverted TP < Entry!
});
assert(!malformedBullishTP.isValid && malformedBullishTP.rejectionReason?.includes('Take Profit (1.083) <= Entry (1.085)'), 'Bullish setup with TP <= Entry is strictly rejected');

// 3. HARD DIRECTIONAL GEOMETRY (BEARISH: TP < Entry < SL)
const validBearish = validateTradeSetup({
  symbol: 'GBP/USD',
  instrumentId: 'GBPUSD',
  direction: 'BEARISH',
  currentPrice: 1.2750,
  entryPrice: 1.2750,
  stopLossPrice: 1.2780, // 30 pips risk
  targetPrice: 1.2690,   // 60 pips reward (2.0R)
});
assert(validBearish.isValid && validBearish.actualRR === 2.0, 'Valid Bearish setup passes (TP < Entry < SL, 2.0R)');

const malformedBearishSL = validateTradeSetup({
  symbol: 'GBP/USD',
  instrumentId: 'GBPUSD',
  direction: 'BEARISH',
  currentPrice: 1.2750,
  entryPrice: 1.2750,
  stopLossPrice: 1.2720, // Inverted SL < Entry!
  targetPrice: 1.2690,
});
assert(!malformedBearishSL.isValid && malformedBearishSL.rejectionReason?.includes('Stop Loss (1.272) <= Entry (1.275)'), 'Bearish setup with SL <= Entry is strictly rejected');

const malformedBearishTP = validateTradeSetup({
  symbol: 'GBP/USD',
  instrumentId: 'GBPUSD',
  direction: 'BEARISH',
  currentPrice: 1.2750,
  entryPrice: 1.2750,
  stopLossPrice: 1.2780,
  targetPrice: 1.2800, // Inverted TP > Entry!
});
assert(!malformedBearishTP.isValid && malformedBearishTP.rejectionReason?.includes('Take Profit (1.28) >= Entry (1.275)'), 'Bearish setup with TP >= Entry is strictly rejected');

// 4. UNROUNDED RISK-TO-REWARD (R:R >= 1.9R)
const lowRR = validateTradeSetup({
  symbol: 'USD/JPY',
  instrumentId: 'USDJPY',
  direction: 'BULLISH',
  currentPrice: 155.00,
  entryPrice: 155.00,
  stopLossPrice: 154.00, // 100 pips risk
  targetPrice: 156.89,   // 189 pips reward = 1.89R
});
assert(!lowRR.isValid && lowRR.rejectionReason?.includes('below the required minimum of 1.9R'), 'Setup with 1.89R is rejected');

const exactThresholdRR = validateTradeSetup({
  symbol: 'USD/JPY',
  instrumentId: 'USDJPY',
  direction: 'BULLISH',
  currentPrice: 155.00,
  entryPrice: 155.00,
  stopLossPrice: 154.00, // 100 pips risk
  targetPrice: 156.90,   // 190 pips reward = 1.90R
});
assert(exactThresholdRR.isValid && exactThresholdRR.actualRR === 1.9, 'Setup with exact 1.90R is accepted');

// 5. PROXIMITY THRESHOLDS ACROSS INSTRUMENTS
assert(getProximityThreshold('EURUSD', 1.0850) === 0.0005, 'EURUSD proximity threshold is 5 pips (0.0005)');
assert(getProximityThreshold('USDJPY', 155.00) === 0.05, 'USDJPY proximity threshold is 5 pips (0.05)');
assert(getProximityThreshold('XAUUSD', 2400.0) === 2.0, 'XAUUSD proximity threshold is $2.00');
assert(getProximityThreshold('US500', 5500.0) === 8.0, 'US500 proximity threshold is 8.0 pts');
assert(getProximityThreshold('NAS100', 19000.0) === 30.0, 'NAS100 proximity threshold is 30.0 pts');
assert(getProximityThreshold('BTCUSDT', 60000.0) === 150.0, 'BTCUSDT proximity threshold is 0.25% ($150)');

console.log(`\n=====================================================`);
console.log(`🎯 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log(`=====================================================\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
