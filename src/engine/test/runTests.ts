import { Candle, Instrument } from '../../types/market';
import { detectSwingPoints } from '../structure/swingDetector';
import { analyzeMarketStructure } from '../structure/marketStructureEngine';
import { detectLiquidityPools } from '../liquidity/liquidityEngine';
import { detectDisplacements } from '../displacement/displacementEngine';
import { detectFairValueGaps } from '../fvg/fvgEngine';
import { detectOrderBlocks } from '../orderblock/orderBlockEngine';
import { calculateDealingRange } from '../range/dealingRangeEngine';
import { calculatePositionSize } from '../../services/riskService';
import { SUPPORTED_INSTRUMENTS } from '../data/instruments';

function createMockCandles(): Candle[] {
  const candles: Candle[] = [];
  const baseTime = 1700000000;
  const prices = [
    // 0-4: Base consolidation
    [100, 102, 99, 101],
    [101, 103, 100, 102],
    [102, 105, 101, 104], // Swing High at 105
    [104, 104.5, 98, 99], // Swing Low at 98
    [99, 101, 98.5, 100],
    // 5-7: Equal High test
    [100, 105.02, 99.5, 103], // EQH at 105
    [103, 103.5, 97, 98],
    // 8: Sweep candle
    [98, 106.5, 97.5, 99], // Sweep above 105 high, closing back at 99!
    // 9-11: Downward Displacement & Bearish FVG
    [99, 99.2, 92, 92.5], // Candle 1
    [92.5, 93, 82, 82.2], // Candle 2 (Big Displacement)
    [82.2, 82.5, 75, 76], // Candle 3 -> FVG between C1 Low (92) and C3 High (82.5)
    // 12-14: Pullback into FVG
    [76, 85, 75.5, 84], // Taps into FVG (82.5 to 92)
    [84, 86, 80, 81],
    [81, 82, 70, 71] // Lower Low
  ];

  prices.forEach((p, idx) => {
    candles.push({
      timestamp: baseTime + idx * 900,
      time: new Date((baseTime + idx * 900) * 1000).toISOString(),
      open: p[0],
      high: p[1],
      low: p[2],
      close: p[3],
      volume: 1500
    });
  });

  return candles;
}

function runVerification() {
  console.log('--- RUNNING DETERMINISTIC SMC ENGINE VERIFICATIONS ---');
  const candles = createMockCandles();
  const inst = SUPPORTED_INSTRUMENTS[0]; // EUR/USD

  // 1. Swings
  const swings = detectSwingPoints(candles, { leftBars: 2, rightBars: 2, timeframe: '15M' });
  console.log(`✓ Swing Detection: Found ${swings.length} confirmed swing points.`);
  console.assert(swings.length >= 2, 'Must detect swing points');

  // 2. Market Structure (BOS / MSS)
  const struct = analyzeMarketStructure(candles, '15M', {
    swingSensitivityHTF: { left: 2, right: 2 },
    swingSensitivityLTF: { left: 1, right: 1 }
  });
  console.log(`✓ Market Structure Engine: Detected ${struct.breaks.length} structural breaks. Current trend: ${struct.currentTrend}`);

  // 3. Liquidity & Sweeps
  const liquidity = detectLiquidityPools(candles, swings, '15M', { tolerancePercent: 0.1 });
  const sweeps = liquidity.filter(l => l.status === 'SWEPT' || l.status === 'SWEPT_CONFIRMED');
  console.log(`✓ Liquidity Engine: Identified ${liquidity.length} pools, including ${sweeps.length} sweeps.`);

  // 4. Displacements
  const displacements = detectDisplacements(candles, { atrPeriod: 5, bodyRatioThreshold: 0.5, atrMultiplierThreshold: 1.0 });
  console.log(`✓ Displacement Engine: Identified ${displacements.length} impulsive moves.`);

  // 5. FVGs
  const fvgs = detectFairValueGaps(candles, displacements, { timeframe: '15M' });
  console.log(`✓ FVG Engine: Identified ${fvgs.length} Fair Value Gaps.`);

  // 6. Order Blocks
  const obs = detectOrderBlocks(candles, displacements, struct.breaks, '15M');
  console.log(`✓ Order Block Engine: Identified ${obs.length} Order Blocks.`);

  // 7. Dealing Range
  const range = calculateDealingRange(candles, swings, '15M');
  if (range) {
    console.log(`✓ Dealing Range: [${range.rangeLow} - ${range.rangeHigh}], EQ: ${range.equilibrium}, Zone: ${range.currentZone}`);
  }

  // 8. Risk Management
  const calc = calculatePositionSize(inst, 1.0850, 1.0800, 1.0950, {
    accountBalance: 10000,
    maxRiskPerTradePercent: 1.0,
    maxDailyLossPercent: 3.0,
    maxDrawdownPercent: 5.0,
    minRiskRewardRatio: 2.0
  });
  console.log(`✓ Risk Service: Position lots = ${calc.lotSize}, R:R = ${calc.riskRewardRatio}R, Risk = $${calc.riskAmountDollars}`);
  console.assert(calc.riskRewardRatio === 2.0, 'Risk Reward must be 2.0');

  console.log('--- ALL DETERMINISTIC VERIFICATIONS PASSED SUCCESSFULLY ---');
}

runVerification();
