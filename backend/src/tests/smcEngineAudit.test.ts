/**
 * SMC Engine Audit Test Suite — 12 Scenarios (A–L)
 * Tests the validator pipeline integrity after structural SL fixes.
 * Run: npx ts-node src/tests/smcEngineAudit.test.ts
 */

import { validateTradeSetup } from '../services/tradeSetupValidator';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// SCENARIO A: EUR/USD Bull FVG — SL inside entry zone (artificially tight, should REJECT)
console.log('\nScenario A: EUR/USD Bullish FVG — 5-pip SL (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'EURUSD', symbol: 'EUR/USD', direction: 'BULLISH',
    currentPrice: 1.08550, entryPrice: 1.08540, stopLossPrice: 1.08490,
    targetPrice: 1.08720, invalidationPrice: 1.08490,
  });
  assert('A1: Tight 5-pip SL rejected', !r.isValid);
  assert('A2: Rejection reason mentions risk/minimum', (r.rejectionReason ?? '').toLowerCase().includes('risk') || (r.rejectionReason ?? '').toLowerCase().includes('minimum'));
}

// SCENARIO B: EUR/USD Bull — proper structural SL (should PASS)
console.log('\nScenario B: EUR/USD Bullish — 32-pip structural SL (should PASS)');
{
  const r = validateTradeSetup({
    instrumentId: 'EURUSD', symbol: 'EUR/USD', direction: 'BULLISH',
    currentPrice: 1.08500, entryPrice: 1.08540, stopLossPrice: 1.08220,
    targetPrice: 1.09150, invalidationPrice: 1.08220,
  });
  assert('B1: Structural setup accepted', r.isValid);
  assert('B2: R:R >= 1.9', r.actualRR >= 1.9);
}

// SCENARIO C: XAU/USD Bearish — $2 SL (should REJECT)
console.log('\nScenario C: XAU/USD Bearish OB — $2 SL (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'XAUUSD', symbol: 'XAU/USD', direction: 'BEARISH',
    currentPrice: 4638.00, entryPrice: 4636.00, stopLossPrice: 4638.00,
    targetPrice: 4610.00, invalidationPrice: 4638.00,
  });
  assert('C1: $2 XAU/USD SL rejected', !r.isValid);
}

// SCENARIO D: XAU/USD Bearish — $25 structural SL (should PASS)
console.log('\nScenario D: XAU/USD Bearish — $25 structural SL (should PASS)');
{
  const r = validateTradeSetup({
    instrumentId: 'XAUUSD', symbol: 'XAU/USD', direction: 'BEARISH',
    currentPrice: 4640.00, entryPrice: 4636.00, stopLossPrice: 4661.00,
    targetPrice: 4577.00, invalidationPrice: 4661.00,
  });
  assert('D1: $25 XAU/USD stop accepted', r.isValid);
  assert('D2: R:R >= 1.9', r.actualRR >= 1.9);
}

// SCENARIO E: BTC/USDT Bull — $150 SL (below $300 minimum, should REJECT)
console.log('\nScenario E: BTC/USDT Bull — $150 SL (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'BTCUSDT', symbol: 'BTC/USDT', direction: 'BULLISH',
    currentPrice: 78500, entryPrice: 78500, stopLossPrice: 78350,
    targetPrice: 79500, invalidationPrice: 78350,
  });
  assert('E1: $150 BTC stop rejected (min $300)', !r.isValid);
}

// SCENARIO F: BTC/USDT Bull — $600 structural SL (should PASS)
console.log('\nScenario F: BTC/USDT Bull — $600 structural SL (should PASS)');
{
  const r = validateTradeSetup({
    instrumentId: 'BTCUSDT', symbol: 'BTC/USDT', direction: 'BULLISH',
    currentPrice: 78000, entryPrice: 78000, stopLossPrice: 77400,
    targetPrice: 79500, invalidationPrice: 77400,
  });
  assert('F1: $600 BTC stop accepted', r.isValid);
  assert('F2: R:R >= 1.9', r.actualRR >= 1.9);
}

// SCENARIO G: USD/JPY Bear — 10-pip SL (below 20-pip minimum, should REJECT)
console.log('\nScenario G: USD/JPY Bear — 10-pip SL (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'USDJPY', symbol: 'USD/JPY', direction: 'BEARISH',
    currentPrice: 159.20, entryPrice: 159.20, stopLossPrice: 159.30,
    targetPrice: 158.80, invalidationPrice: 159.30,
  });
  assert('G1: 10-pip JPY stop rejected', !r.isValid);
}

// SCENARIO H: USD/JPY Bear — 30-pip structural SL (should PASS)
console.log('\nScenario H: USD/JPY Bear — 30-pip structural SL (should PASS)');
{
  const r = validateTradeSetup({
    instrumentId: 'USDJPY', symbol: 'USD/JPY', direction: 'BEARISH',
    currentPrice: 159.20, entryPrice: 159.20, stopLossPrice: 159.50,
    targetPrice: 158.50, invalidationPrice: 159.50,
  });
  assert('H1: 30-pip JPY stop accepted', r.isValid);
  assert('H2: R:R >= 1.9', r.actualRR >= 1.9);
}

// SCENARIO I: R:R below 1.9 even with structural SL (should REJECT)
console.log('\nScenario I: EUR/USD — R:R = 0.8 with adequate SL (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'EURUSD', symbol: 'EUR/USD', direction: 'BULLISH',
    currentPrice: 1.08500, entryPrice: 1.08540, stopLossPrice: 1.08220,
    targetPrice: 1.08700, invalidationPrice: 1.08220,
  });
  assert('I1: Low R:R rejected despite structural SL', !r.isValid);
  assert('I2: Rejection mentions R:R', (r.rejectionReason ?? '').includes('Risk-to-Reward'));
}

// SCENARIO J: Stale setup — current price already past TP (should REJECT)
console.log('\nScenario J: EUR/USD — current price past TP (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'EURUSD', symbol: 'EUR/USD', direction: 'BULLISH',
    currentPrice: 1.09200, entryPrice: 1.08540, stopLossPrice: 1.08220,
    targetPrice: 1.09100, invalidationPrice: 1.08220,
  });
  assert('J1: Stale/completed setup rejected', !r.isValid);
  assert('J2: Reason mentions stale', (r.rejectionReason ?? '').toLowerCase().includes('stale'));
}

// SCENARIO K: Deactivated instrument (should REJECT)
console.log('\nScenario K: ETHUSDT — deactivated instrument (should REJECT)');
{
  const r = validateTradeSetup({
    instrumentId: 'ETHUSDT', symbol: 'ETH/USDT', direction: 'BULLISH',
    currentPrice: 3000, entryPrice: 3000, stopLossPrice: 2400,
    targetPrice: 4200, invalidationPrice: 2400,
  });
  assert('K1: Deactivated instrument rejected', !r.isValid);
  assert('K2: instrumentSupported is false', !r.instrumentSupported);
}

// SCENARIO L: GBP/USD — SL above entry for BULLISH (invalid geometry)
console.log('\nScenario L: GBP/USD — SL above entry on BULLISH (geometry violation)');
{
  const r = validateTradeSetup({
    instrumentId: 'GBPUSD', symbol: 'GBP/USD', direction: 'BULLISH',
    currentPrice: 1.36000, entryPrice: 1.36000, stopLossPrice: 1.36400,
    targetPrice: 1.37000, invalidationPrice: 1.36400,
  });
  assert('L1: Invalid geometry rejected', !r.isValid);
  assert('L2: geometryValid is false', !r.geometryValid);
}

// FINAL SUMMARY
console.log('\n' + '─'.repeat(60));
console.log(`SMC Audit Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed === 0) {
  console.log('🎉 All assertions PASSED — engine integrity confirmed.');
} else {
  console.error(`⚠️  ${failed} FAILED — review output above.`);
  process.exit(1);
}
