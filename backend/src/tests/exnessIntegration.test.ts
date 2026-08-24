/**
 * Exness Broker Integration Unit & Verification Test
 * Tests symbol mapping, dynamic lot sizing, risk rules, and execution formatting.
 */

import { resolveExnessSymbol, getInstrumentMapping } from '../config/instrumentRegistry';
import { calculateExnessLotSize, executeExnessTrade } from '../services/exnessExecutionService';
import { mapTimeframeToExness, getExnessAccountInfo } from '../services/exnessService';

async function runExnessTests() {
  console.log('\n=== RUNNING EXNESS BROKER INTEGRATION TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  }

  // ── 1. Symbol Resolution Tests ──────────────────────────────────
  console.log('[1] Testing Exness Symbol Resolution...');

  // Standard Account (suffix 'm')
  assert(resolveExnessSymbol('EURUSD', 'standard') === 'EURUSDm', 'EURUSD maps to EURUSDm on Standard account');
  assert(resolveExnessSymbol('GBPUSD', 'standard') === 'GBPUSDm', 'GBPUSD maps to GBPUSDm on Standard account');
  assert(resolveExnessSymbol('XAUUSD', 'standard') === 'XAUUSDm', 'XAUUSD maps to XAUUSDm on Standard account');
  assert(resolveExnessSymbol('NAS100', 'standard') === 'USTECm', 'NAS100 maps to USTECm (Nasdaq 100) on Standard account');
  assert(resolveExnessSymbol('US500', 'standard') === 'US500m', 'US500 maps to US500m on Standard account');
  assert(resolveExnessSymbol('BTCUSDT', 'standard') === 'BTCUSDm', 'BTCUSDT maps to BTCUSDm on Standard account');

  // Raw Spread / Pro Account (no suffix)
  assert(resolveExnessSymbol('EURUSD', 'raw_spread') === 'EURUSD', 'EURUSD maps to EURUSD on Raw Spread account');
  assert(resolveExnessSymbol('XAUUSD', 'raw_spread') === 'XAUUSD', 'XAUUSD maps to XAUUSD on Raw Spread account');
  assert(resolveExnessSymbol('NAS100', 'raw_spread') === 'USTEC', 'NAS100 maps to USTEC on Raw Spread account');

  // ── 2. Timeframe Mapping Tests ──────────────────────────────────
  console.log('\n[2] Testing Timeframe Mappings...');
  assert(mapTimeframeToExness('15M') === '15m', '15M maps to 15m');
  assert(mapTimeframeToExness('1H') === '1h', '1H maps to 1h');
  assert(mapTimeframeToExness('4H') === '4h', '4H maps to 4h');
  assert(mapTimeframeToExness('1D') === '1d', '1D maps to 1d');

  // ── 3. Lot Size & Risk Management Tests ─────────────────────────
  console.log('\n[3] Testing Dynamic Lot Size & Risk Sizing...');

  // Scenario A: $10,000 Equity, 1% Risk ($100), EURUSD Entry: 1.08500, SL: 1.08250 (25 pips SL)
  // Risk = $100, SL = 25 pips * $10/pip = $250/lot => 100 / 250 = 0.40 lots
  const sizingA = calculateExnessLotSize(10000, 1.0, 1.08500, 1.08250, 0.0001, 10);
  assert(sizingA.riskAmount === 100, `Risk Amount is exactly $100 (got: $${sizingA.riskAmount})`);
  assert(sizingA.lotSize === 0.40, `Lot size is calculated to 0.40 lots (got: ${sizingA.lotSize})`);

  // Scenario B: $1,000 Equity, 1% Risk ($10), Gold Entry: 2500.00, SL: 2495.00 (50 pips / $5.00)
  // Risk = $10, 50 pips * $10/pip = $500/lot => 10 / 500 = 0.02 lots
  const sizingB = calculateExnessLotSize(1000, 1.0, 2500.00, 2495.00, 0.1, 10);
  assert(sizingB.riskAmount === 10, `Risk Amount is exactly $10 (got: $${sizingB.riskAmount})`);
  assert(sizingB.lotSize === 0.02, `Lot size is calculated to 0.02 lots (got: ${sizingB.lotSize})`);

  // Scenario C: Enforces 0.01 minimum micro lot clamp
  const sizingC = calculateExnessLotSize(100, 0.5, 1.08500, 1.08000, 0.0001, 10);
  assert(sizingC.lotSize >= 0.01, `Min lot size is clamped to at least 0.01 (got: ${sizingC.lotSize})`);

  // ── 4. Trade Execution Order Construction ───────────────────────
  console.log('\n[4] Testing SMC Trade Execution Construction...');
  const execResult = await executeExnessTrade({
    instrumentId: 'EURUSD',
    direction: 'BULLISH',
    entryPrice: 1.08550,
    stopLoss: 1.08300,
    takeProfit1: 1.09000,
    takeProfit2: 1.09500,
    riskPercent: 1.0,
    comment: 'SMC-TEST-01',
  });

  assert(execResult.success === true, 'Execution service returns valid structural response');
  assert(execResult.symbol === 'EURUSDm' || execResult.symbol === 'EURUSD', `Symbol formatted correctly: ${execResult.symbol}`);
  assert(execResult.stopLoss === 1.08300, `Stop loss preserved: ${execResult.stopLoss}`);
  assert(execResult.takeProfit === 1.09000, `Take profit preserved: ${execResult.takeProfit}`);
  assert(execResult.volume > 0, `Volume assigned: ${execResult.volume} lots`);

  // ── 5. Account Info Fallback / Sync ──────────────────────────────
  console.log('\n[5] Testing Account Info Sync...');
  const account = await getExnessAccountInfo();
  assert(typeof account.balance === 'number', `Balance field is numeric: ${account.balance}`);
  assert(typeof account.equity === 'number', `Equity field is numeric: ${account.equity}`);
  assert(account.leverage > 0, `Leverage is positive: 1:${account.leverage}`);
  assert(['CONNECTED', 'SYNCHRONIZING', 'UNCONFIGURED'].includes(account.state), `Account state is valid: ${account.state}`);

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runExnessTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
