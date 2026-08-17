import { Candle, Instrument, MultiTimeframeSelection } from '../types/market';
import { MarketStructureResult } from '../types/structure';
import { LiquidityPool, FairValueGap, OrderBlock, DealingRange, DisplacementMove } from '../types/smc';
import { SessionStatus } from '../types/session';

import { analyzeMarketStructure } from './structure/marketStructureEngine';
import { detectLiquidityPools } from './liquidity/liquidityEngine';
import { detectDisplacements } from './displacement/displacementEngine';
import { detectFairValueGaps } from './fvg/fvgEngine';
import { detectOrderBlocks } from './orderblock/orderBlockEngine';
import { calculateDealingRange } from './range/dealingRangeEngine';
import { getSessionStatus } from './session/sessionEngine';

export interface FullSMCPipelineResult {
  instrument: Instrument;
  timeframe: string;
  candles: Candle[];
  lastPrice: number;
  structure: MarketStructureResult;
  liquidityPools: LiquidityPool[];
  displacements: DisplacementMove[];
  fairValueGaps: FairValueGap[];
  orderBlocks: OrderBlock[];
  dealingRange: DealingRange | null;
  sessionStatus: SessionStatus;
  calculationTimestamp: number;
}

export function runSMCPipeline(
  instrument: Instrument,
  candles: Candle[],
  timeframe: string
): FullSMCPipelineResult {
  const calculationTimestamp = Date.now();
  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // 1. Deterministic Market Structure
  const structure = analyzeMarketStructure(candles, timeframe, {
    swingSensitivityHTF: { left: 4, right: 4 },
    swingSensitivityLTF: { left: 2, right: 2 },
    requireBodyClose: true
  });

  // 2. Liquidity Pools & Sweeps
  const liquidityPools = detectLiquidityPools(candles, structure.swings, timeframe, {
    tolerancePercent: instrument.assetClass === 'crypto' ? 0.12 : 0.04
  });

  // 3. Displacement Detection
  const displacements = detectDisplacements(candles, {
    atrPeriod: 14,
    bodyRatioThreshold: 0.58,
    atrMultiplierThreshold: 1.3
  });

  // 4. Fair Value Gaps
  const fairValueGaps = detectFairValueGaps(candles, displacements, { timeframe });

  // 5. Order Blocks & Breakers
  const orderBlocks = detectOrderBlocks(candles, displacements, structure.breaks, timeframe);

  // 6. Dealing Range & Premium/Discount
  const dealingRange = calculateDealingRange(candles, structure.swings, timeframe);

  // 7. Trading Sessions
  const sessionStatus = getSessionStatus(candles);

  return {
    instrument,
    timeframe,
    candles,
    lastPrice,
    structure,
    liquidityPools,
    displacements,
    fairValueGaps,
    orderBlocks,
    dealingRange,
    sessionStatus,
    calculationTimestamp
  };
}
