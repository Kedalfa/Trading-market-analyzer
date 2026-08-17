import { runSMCPipeline } from '../engine';
import { detectSwingPoints } from '../engine/structure/swingDetector';
import { analyzeMarketStructure } from '../engine/structure/marketStructureEngine';
import { detectFairValueGaps } from '../engine/fvg/fvgEngine';
import { detectOrderBlocks } from '../engine/orderblock/orderBlockEngine';
import { detectLiquidityPools } from '../engine/liquidity/liquidityEngine';
import { calculateDealingRange } from '../engine/range/dealingRangeEngine';
import { Candle, Instrument } from '../types/market';

console.log('=====================================================');
console.log('🧪 SMC MARKET STRUCTURE ENGINE INTEGRITY AUDIT SUITE');
console.log('=====================================================\n');

const testInstrument: Instrument = {
  id: 'EURUSD',
  symbol: 'EUR/USD',
  name: 'Euro / US Dollar',
  assetClass: 'forex',
  baseCurrency: 'EUR',
  quoteCurrency: 'USD',
  pipSize: 0.0001,
  tickSize: 0.00001,
  defaultTimeframe: '15M',
  provider: 'yahoo',
};

function createCandle(index: number, open: number, high: number, low: number, close: number, volume = 100): Candle {
  const baseTime = 1700000000 + index * 900;
  return {
    timestamp: baseTime,
    time: new Date(baseTime * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume,
  };
}

async function runEngineAudit() {
  let passed = 0;
  let total = 0;

  function assert(condition: any, testName: string, detail?: any) {
    total++;
    if (Boolean(condition)) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
    }
  }

  // ── TEST 1: Swing High / Low Detection & Confirmation ───────────
  console.log('\n--- Test 1: Swing High / Low Detection ---');
  const swingCandles: Candle[] = [
    createCandle(0, 1.1000, 1.1020, 1.0990, 1.1010),
    createCandle(1, 1.1010, 1.1040, 1.1005, 1.1030),
    createCandle(2, 1.1030, 1.1050, 1.1020, 1.1045),
    createCandle(3, 1.1045, 1.1080, 1.1040, 1.1070), // Swing High at index 3 (high: 1.1080)
    createCandle(4, 1.1070, 1.1060, 1.1030, 1.1035),
    createCandle(5, 1.1035, 1.1045, 1.1010, 1.1020),
    createCandle(6, 1.1020, 1.1030, 1.0980, 1.0990), // Swing Low at index 6 (low: 1.0980)
    createCandle(7, 1.0990, 1.1015, 1.0990, 1.1010),
    createCandle(8, 1.1010, 1.1030, 1.1005, 1.1025),
    createCandle(9, 1.1025, 1.1040, 1.1020, 1.1035),
  ];

  const swings = detectSwingPoints(swingCandles, { leftBars: 2, rightBars: 2, timeframe: '15M' });
  const highSwing = swings.find(s => s.type === 'HIGH');
  const lowSwing = swings.find(s => s.type === 'LOW');

  assert(highSwing != null && highSwing.price === 1.1080, 'Swing High detected exactly at peak 1.1080');
  assert(highSwing?.confirmationIndex === 5, 'Swing High confirmed after rightBars (index 5)');
  assert(lowSwing != null && lowSwing.price === 1.0980, 'Swing Low detected exactly at trough 1.0980');
  assert(lowSwing?.confirmationIndex === 8, 'Swing Low confirmed after rightBars (index 8)');

  // ── TEST 2: Bullish BOS & Broken Level Precision ────────────────
  console.log('\n--- Test 2: Bullish Break of Structure (BOS) ---');
  const bosCandles: Candle[] = [
    createCandle(0, 1.1000, 1.1020, 1.0990, 1.1010),
    createCandle(1, 1.1010, 1.1050, 1.1000, 1.1040),
    createCandle(2, 1.1040, 1.1080, 1.1030, 1.1070), // Established Swing High at 1.1080
    createCandle(3, 1.1070, 1.1060, 1.1040, 1.1045),
    createCandle(4, 1.1045, 1.1050, 1.1030, 1.1035), // Confirmation bar for swing
    createCandle(5, 1.1035, 1.1055, 1.1025, 1.1050),
    createCandle(6, 1.1050, 1.1070, 1.1040, 1.1065),
    createCandle(7, 1.1065, 1.1110, 1.1060, 1.1100), // Breaking bar closing at 1.1100 > 1.1080
  ];

  const structResult = analyzeMarketStructure(bosCandles, '15M', {
    swingSensitivityHTF: { left: 2, right: 2 },
    requireBodyClose: true,
  });

  const bosBreak = structResult.breaks.find(b => b.direction === 'BULLISH');
  assert(bosBreak != null, 'Bullish structure break was detected');
  assert(bosBreak?.breakPrice === 1.1080, 'Break price references the EXACT broken swing level (1.1080)');
  assert(bosBreak?.candleClosePrice === 1.1100, 'Candle close price is recorded as 1.1100');
  assert(bosBreak?.breakingCandleIndex === 7, 'Breaking candle index is 7');

  // ── TEST 3: Fair Value Gap (FVG) Boundary Precision ─────────────
  console.log('\n--- Test 3: Fair Value Gap (FVG) ---');
  const fvgCandles: Candle[] = [
    createCandle(0, 1.1000, 1.1020, 1.0990, 1.1010),
    createCandle(1, 1.1010, 1.1030, 1.1005, 1.1025), // Candle 1: High = 1.1030
    createCandle(2, 1.1025, 1.1090, 1.1020, 1.1085), // Candle 2: Impulsive displacement expansion
    createCandle(3, 1.1085, 1.1120, 1.1060, 1.1110), // Candle 3: Low = 1.1060
  ];

  const fvgs = detectFairValueGaps(fvgCandles, [], { timeframe: '15M' });
  const bullFvg = fvgs.find(f => f.type === 'BULLISH');

  assert(bullFvg != null, 'Bullish FVG detected from 3-candle sequence');
  assert(bullFvg?.bottom === 1.1030, 'FVG bottom matches Candle 1 High (1.1030)');
  assert(bullFvg?.top === 1.1060, 'FVG top matches Candle 3 Low (1.1060)');
  assert(bullFvg?.midpoint === 1.1045, 'FVG midpoint (Consequent Encroachment) is 1.1045');
  assert(bullFvg?.isMitigated === false, 'FVG starts as unmitigated');

  // ── TEST 4: Liquidity Sweep with Rejection Close ─────────────────
  console.log('\n--- Test 4: Liquidity Sweep ---');
  const sweepCandles: Candle[] = [
    createCandle(0, 1.1000, 1.1020, 1.0990, 1.1010),
    createCandle(1, 1.1010, 1.1050, 1.1005, 1.1045), // Equal High 1 at 1.1050
    createCandle(2, 1.1045, 1.1030, 1.1010, 1.1020),
    createCandle(3, 1.1020, 1.1050, 1.1015, 1.1040), // Equal High 2 at 1.1050
    createCandle(4, 1.1040, 1.1025, 1.1005, 1.1015),
    createCandle(5, 1.1015, 1.1065, 1.1010, 1.1035), // Sweep bar: Wicks to 1.1065, closes back down at 1.1035
    createCandle(6, 1.1035, 1.1040, 1.0980, 1.0985), // Rejection confirmation bar
  ];

  const poolSwings = detectSwingPoints(sweepCandles, { leftBars: 1, rightBars: 1, timeframe: '15M' });
  const pools = detectLiquidityPools(sweepCandles, poolSwings, '15M', { tolerancePercent: 0.05 });
  const sweptPool = pools.find(p => p.status === 'SWEPT' || p.status === 'SWEPT_CONFIRMED');

  assert(sweptPool != null, 'Buy-side liquidity sweep detected and confirmed');
  assert(sweptPool?.sweepExtremePrice === 1.1065, 'Sweep extreme price recorded as wick peak (1.1065)');

  // ── TEST 5: Dealing Range & Premium / Discount ───────────────────
  console.log('\n--- Test 5: Dealing Range & Premium / Discount ---');
  const rangeSwings = [
    { id: 'h1', index: 2, timestamp: 1700001800, price: 1.1100, type: 'HIGH' as const, timeframe: '15M', strength: 2, isInternal: false, confirmed: true },
    { id: 'l1', index: 6, timestamp: 1700005400, price: 1.0900, type: 'LOW' as const, timeframe: '15M', strength: 2, isInternal: false, confirmed: true },
  ];
  const rangeCandles = [createCandle(7, 1.0940, 1.0960, 1.0930, 1.0945)]; // Current price = 1.0945 in Discount

  const dealingRange = calculateDealingRange(rangeCandles, rangeSwings, '15M');
  assert(dealingRange != null, 'Dealing range calculated from swings');
  assert(dealingRange?.rangeHigh === 1.1100, 'Range High is 1.1100');
  assert(dealingRange?.rangeLow === 1.0900, 'Range Low is 1.0900');
  assert(dealingRange?.equilibrium === 1.1000, 'Equilibrium 50% is 1.1000');
  assert(dealingRange?.currentZone === 'DISCOUNT', 'Price 1.0945 is correctly in DISCOUNT zone');

  // ── TEST 6: False-Positive Rejection (No false structures on flat/noisy data) ─
  console.log('\n--- Test 6: False-Positive Rejection ---');
  const flatCandles: Candle[] = Array.from({ length: 25 }, (_, i) => 
    createCandle(i, 1.1000, 1.1005, 1.0995, 1.1000)
  );

  const flatPipeline = runSMCPipeline(testInstrument, flatCandles, '15M');
  assert(flatPipeline.fairValueGaps.length === 0, 'Zero false FVGs on flat consolidating data');
  assert(flatPipeline.orderBlocks.length === 0, 'Zero false Order Blocks without displacement');
  assert(flatPipeline.structure.breaks.length === 0, 'Zero false Structure Breaks on non-trending noise');

  console.log(`\n=====================================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} tests passed`);
  console.log(`=====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runEngineAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
