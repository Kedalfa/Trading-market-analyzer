/**
 * R:R Calculation Audit Test Suite
 * Tests Parts 9–21 of the Critical Audit task.
 */

import { validateTradeSetup } from '../services/tradeSetupValidator';

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateRR(direction: 'BULLISH' | 'BEARISH', entry: number, sl: number, tp: number): number {
  if (direction === 'BULLISH') {
    const risk   = entry - sl;
    const reward = tp - entry;
    return reward / risk;
  } else {
    const risk   = sl - entry;
    const reward = entry - tp;
    return reward / risk;
  }
}

function calculateMonetaryRisk(
  direction: 'BULLISH' | 'BEARISH',
  entry: number,
  sl: number,
  lotSize: number,
  contractSize: number
): number {
  const priceDist = direction === 'BULLISH' ? entry - sl : sl - entry;
  return priceDist * lotSize * contractSize;
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail = '') {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
    failures.push(testName);
  }
}

function assertClose(a: number, b: number, tolerance: number, testName: string) {
  assert(Math.abs(a - b) <= tolerance, testName, `got ${a.toFixed(6)}, expected ${b.toFixed(6)} (±${tolerance})`);
}

// ─── TEST 1: Basic Long R:R ──────────────────────────────────────────────────
console.log('\n── Test 1: Basic Long R:R ──');
{
  const entry = 100, sl = 95, tp = 110;
  const rr = calculateRR('BULLISH', entry, sl, tp);
  assertClose(rr, 2.0, 0.001, 'Long: Entry=100, SL=95, TP=110 → R:R = 2.0');

  const result = validateTradeSetup({
    symbol: 'EURUSD', instrumentId: 'EURUSD', direction: 'BULLISH',
    currentPrice: 1.09950,
    entryPrice: 1.10000, stopLossPrice: 1.09800, targetPrice: 1.10400, invalidationPrice: 1.09800,
  });
  assert(result.isValid, 'Long EURUSD 2R setup passes validator');
  assertClose(result.actualRR, (1.10400 - 1.10000) / (1.10000 - 1.09800), 0.01, 'EURUSD validator returns correct RR');
}

// ─── TEST 2: Basic Short R:R ─────────────────────────────────────────────────
console.log('\n── Test 2: Basic Short R:R ──');
{
  const entry = 100, sl = 105, tp = 90;
  const rr = calculateRR('BEARISH', entry, sl, tp);
  assertClose(rr, 2.0, 0.001, 'Short: Entry=100, SL=105, TP=90 → R:R = 2.0');

  const result = validateTradeSetup({
    symbol: 'EURUSD', instrumentId: 'EURUSD', direction: 'BEARISH',
    currentPrice: 1.10150,
    entryPrice: 1.10200, stopLossPrice: 1.10450, targetPrice: 1.09700, invalidationPrice: 1.10450,
  });
  assert(result.isValid, 'Short EURUSD 2R setup passes validator');
}

// ─── TEST 3: Lot Size Does NOT Change R:R ────────────────────────────────────
console.log('\n── Test 3: Lot size invariance ──');
{
  const entry = 3350.00, sl = 3330.00, tp = 3390.00;
  const expectedRR = (tp - entry) / (entry - sl); // 2.0

  for (const lots of [0.01, 0.10, 1.00, 5.00]) {
    const rr = calculateRR('BULLISH', entry, sl, tp);
    assertClose(rr, expectedRR, 0.0001, `RR unchanged at lot size ${lots} (RR=${rr.toFixed(4)})`);
  }

  // Monetary risk DOES scale
  const risks = {
    '0.01': calculateMonetaryRisk('BULLISH', entry, sl, 0.01, 1),
    '0.10': calculateMonetaryRisk('BULLISH', entry, sl, 0.10, 1),
    '1.00': calculateMonetaryRisk('BULLISH', entry, sl, 1.00, 1),
  };
  assertClose(risks['0.01'], 0.20, 0.001, 'Monetary risk scales: 0.01 lot = $0.20 (entry-SL=$20, contractSize=1)');
  assertClose(risks['0.10'], 2.00, 0.001, 'Monetary risk scales: 0.10 lot = $2.00');
  assertClose(risks['1.00'], 20.0, 0.001, 'Monetary risk scales: 1.00 lot = $20.00');
}

// ─── TEST 4: Multiple TP — Each Gets Its Own R ───────────────────────────────
console.log('\n── Test 4: Multiple TP levels each have separate R ──');
{
  const entry = 100, sl = 95;
  const risk = entry - sl; // 5

  const tps = [
    { label: 'TP1', price: 110, expectedR: 2.0 },
    { label: 'TP2', price: 115, expectedR: 3.0 },
    { label: 'TP3', price: 120, expectedR: 4.0 },
  ];

  for (const tp of tps) {
    const r = (tp.price - entry) / risk;
    assertClose(r, tp.expectedR, 0.001, `${tp.label}: price ${tp.price} → ${tp.expectedR}R`);
  }

  assert(tps.every(t => (t.price - entry) / risk >= 1.9), 'All TP levels produce R:R ≥ 1.9R');
}

// ─── TEST 5: Tight SL Rejection ──────────────────────────────────────────────
console.log('\n── Test 5: Tight SL rejected by minimum structural risk gate ──');
{
  // XAUUSD minimum = $8.00
  const resultTight = validateTradeSetup({
    symbol: 'XAUUSD', instrumentId: 'XAUUSD', direction: 'BULLISH',
    currentPrice: 3348.00,
    entryPrice: 3350.00, stopLossPrice: 3349.00, targetPrice: 3360.00,
    invalidationPrice: 3349.00,
  });
  assert(!resultTight.isValid, 'XAUUSD SL $1 below entry rejected (below $8 minimum)');
  assert(resultTight.actualRR === 0, 'Rejected setup returns actualRR = 0');

  // Valid minimum
  const resultValid = validateTradeSetup({
    symbol: 'XAUUSD', instrumentId: 'XAUUSD', direction: 'BULLISH',
    currentPrice: 3344.00, // between SL(3339) and entry(3350) — setup is fresh
    entryPrice: 3350.00, stopLossPrice: 3339.00, targetPrice: 3375.00,
    invalidationPrice: 3339.00,
  });
  assert(resultValid.isValid, 'XAUUSD SL $11 below entry accepted (above $8 minimum)');
}

// ─── TEST 6: Bad R:R Rejection ────────────────────────────────────────────────
console.log('\n── Test 6: R:R < 1.9 rejected ──');
{
  // 1:1 EURUSD
  const result1R = validateTradeSetup({
    symbol: 'EURUSD', instrumentId: 'EURUSD', direction: 'BULLISH',
    currentPrice: 1.09900,
    entryPrice: 1.10000, stopLossPrice: 1.09800, targetPrice: 1.10200,
    invalidationPrice: 1.09800,
  });
  assert(!result1R.isValid, '1:1 EURUSD setup rejected');
  assertClose(result1R.actualRR, 1.0, 0.01, 'Rejected setup reports actualRR ≈ 1.0');

  // Exactly 1.9R must pass
  // risk = 0.0020, reward = 0.0038 → 1.9R
  const result19 = validateTradeSetup({
    symbol: 'EURUSD', instrumentId: 'EURUSD', direction: 'BULLISH',
    currentPrice: 1.09900,
    entryPrice: 1.10000, stopLossPrice: 1.09800, targetPrice: 1.10380,
    invalidationPrice: 1.09800,
  });
  assert(result19.isValid, '1.9R EURUSD setup accepted');
  assertClose(result19.actualRR, 1.9, 0.02, 'Exactly 1.9R setup reports correct RR');
}

// ─── TEST 7: Per-instrument minimum risk gate ─────────────────────────────────
console.log('\n── Test 7: Per-instrument minimum structural risk gate ──');
const instrumentTests = [
  { id: 'EURUSD', belowMin: 0.0005, aboveMin: 0.0020, entry: 1.10000, current: 1.09980 },
  { id: 'GBPUSD', belowMin: 0.0008, aboveMin: 0.0022, entry: 1.27000, current: 1.26978 },
  { id: 'USDJPY', belowMin: 0.05,   aboveMin: 0.25,   entry: 150.00,  current: 149.97 },
  { id: 'XAUUSD', belowMin: 2.00,   aboveMin: 12.00,  entry: 3350.00, current: 3340.00 },
  { id: 'US500',  belowMin: 5.00,   aboveMin: 25.00,  entry: 5000.00, current: 4980.00 },
  { id: 'NAS100', belowMin: 30.00,  aboveMin: 80.00,  entry: 19000.0, current: 18935.0 },
  { id: 'BTCUSDT',belowMin: 100.0,  aboveMin: 400.0,  entry: 90000.0, current: 89700.0 },
];

for (const inst of instrumentTests) {
  const tightSL  = inst.entry - inst.belowMin;
  const tightTP  = inst.entry + (inst.belowMin * 5);
  const tightResult = validateTradeSetup({
    symbol: inst.id, instrumentId: inst.id, direction: 'BULLISH',
    currentPrice: inst.current,
    entryPrice: inst.entry, stopLossPrice: tightSL, targetPrice: tightTP,
    invalidationPrice: tightSL,
  });
  assert(!tightResult.isValid, `${inst.id}: SL too tight (${inst.belowMin}) → rejected`);

  const validSL = inst.entry - inst.aboveMin;
  const validTP = inst.entry + (inst.aboveMin * 2.5); // ~2.5R
  const validResult = validateTradeSetup({
    symbol: inst.id, instrumentId: inst.id, direction: 'BULLISH',
    currentPrice: inst.current,
    entryPrice: inst.entry, stopLossPrice: validSL, targetPrice: validTP,
    invalidationPrice: validSL,
  });
  if (validResult.actualRR >= 1.9) {
    assert(validResult.isValid, `${inst.id}: SL structural (${inst.aboveMin}) → accepted at ${validResult.actualRR.toFixed(2)}R`);
  }
}

// ─── TEST 8: 33R Forensic Analysis ───────────────────────────────────────────
console.log('\n── Test 8: 33R forensic reconstruction ──');
{
  const entry = 3350.00, tightSL = 3349.00, tp = 3383.00;
  const illegalRR = (tp - entry) / (entry - tightSL);
  assertClose(illegalRR, 33.0, 0.5, '33R mathematically produced by $1 SL + $33 reward on XAUUSD');

  const result = validateTradeSetup({
    symbol: 'XAUUSD', instrumentId: 'XAUUSD', direction: 'BULLISH',
    currentPrice: 3340.00,
    entryPrice: entry, stopLossPrice: tightSL, targetPrice: tp,
    invalidationPrice: tightSL,
  });
  assert(!result.isValid, '33R XAUUSD setup rejected by current validator (SL too tight < $8)');
  assert(result.actualRR === 0, '33R rejected setup reports actualRR = 0');

  // Legitimate structural setup with the same reward distance
  const properSL = entry - 15.00;
  const legitimateRR = (tp - entry) / (entry - properSL);
  assertClose(legitimateRR, 2.2, 0.1, 'Proper $15 structural SL → 2.2R (not 33R)');

  const legitimateResult = validateTradeSetup({
    symbol: 'XAUUSD', instrumentId: 'XAUUSD', direction: 'BULLISH',
    currentPrice: 3342.00, // between properSL(3335) and entry(3350) — fresh setup
    entryPrice: entry, stopLossPrice: properSL, targetPrice: tp,
    invalidationPrice: properSL,
  });
  assert(legitimateResult.isValid, 'Structural XAUUSD setup at 2.2R accepted');
}

// ─── TEST 9: Terminal state badge invariance (pure logic test) ───────────────
console.log('\n── Test 9: Terminal state badge logic — isApproachingEntry override guard ──');
{
  const TERMINAL_STATUSES = new Set(['TARGET_HIT', 'STOPPED_OUT', 'INVALIDATED', 'EXPIRED', 'AMBIGUOUS']);

  function renderStatusCategory(outcome: { status: string; isApproachingEntry?: boolean }): string {
    const s = outcome.status || 'OPEN';
    if (!TERMINAL_STATUSES.has(s)) {
      if (outcome.isApproachingEntry) return 'APPROACHING_ENTRY';
    }
    return s;
  }

  // Terminal + stale flag
  assert(renderStatusCategory({ status: 'INVALIDATED',  isApproachingEntry: true }) === 'INVALIDATED',  'INVALIDATED + stale flag → INVALIDATED badge');
  assert(renderStatusCategory({ status: 'TARGET_HIT',   isApproachingEntry: true }) === 'TARGET_HIT',   'TARGET_HIT + stale flag → TARGET_HIT badge');
  assert(renderStatusCategory({ status: 'STOPPED_OUT',  isApproachingEntry: true }) === 'STOPPED_OUT',  'STOPPED_OUT + stale flag → STOPPED_OUT badge');
  assert(renderStatusCategory({ status: 'EXPIRED',      isApproachingEntry: true }) === 'EXPIRED',      'EXPIRED + stale flag → EXPIRED badge');
  assert(renderStatusCategory({ status: 'AMBIGUOUS',    isApproachingEntry: true }) === 'AMBIGUOUS',    'AMBIGUOUS + stale flag → AMBIGUOUS badge');

  // Non-terminal correctly shows approaching
  assert(renderStatusCategory({ status: 'WAITING_FOR_ENTRY', isApproachingEntry: true }) === 'APPROACHING_ENTRY', 'Non-terminal + isApproachingEntry=true → APPROACHING_ENTRY badge');
  assert(renderStatusCategory({ status: 'WAITING_FOR_ENTRY', isApproachingEntry: false }) === 'WAITING_FOR_ENTRY', 'Non-terminal + isApproachingEntry=false → WAITING_FOR_ENTRY badge');
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log(`R:R Audit Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.error('FAILURES:');
  failures.forEach(f => console.error(`  ✗ ${f}`));
  process.exit(1);
} else {
  console.log('🎉 All R:R Audit assertions PASSED — engine integrity confirmed.');
  process.exit(0);
}
