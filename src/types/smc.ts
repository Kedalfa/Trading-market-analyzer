import { SwingPoint, StructureBreak } from './structure';

export type LiquidityType = 
  | 'EQH'        // Equal Highs
  | 'EQL'        // Equal Lows
  | 'PDH'        // Previous Day High
  | 'PDL'        // Previous Day Low
  | 'PWH'        // Previous Week High
  | 'PWL'        // Previous Week Low
  | 'SESSION_H'  // Session High
  | 'SESSION_L'  // Session Low
  | 'BSL'        // Buy-Side Liquidity Pool
  | 'SSL';       // Sell-Side Liquidity Pool

export type SweepStatus = 'IDENTIFIED' | 'SWEPT' | 'SWEPT_CONFIRMED' | 'INVALIDATED';

export interface LiquidityPool {
  id: string;
  type: LiquidityType;
  direction: 'BUYSIDE' | 'SELLSIDE';
  price: number;
  secondaryPrice?: number; // For EQH/EQL ranges
  timestamp: number;
  timeframe: string;
  status: SweepStatus;
  sweepCandleIndex?: number;
  sweepTimestamp?: number;
  sweepExtremePrice?: number; // Highest/Lowest wick price during sweep
  mitigatedTimestamp?: number;
  description: string;
}

export interface FairValueGap {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  top: number;       // Top of gap (for Bullish: Low of candle 3; for Bearish: High of candle 1)
  bottom: number;    // Bottom of gap (for Bullish: High of candle 1; for Bearish: Low of candle 3)
  midpoint: number;  // Consequent Encroachment (50% level)
  candle1Index: number;
  candle2Index: number; // The displacement candle
  candle3Index: number;
  timestamp: number;
  timeframe: string;
  isMitigated: boolean;
  mitigationPercent: number; // 0% to 100%
  mitigatedAtTimestamp?: number;
  isAssociatedWithDisplacement: boolean;
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface OrderBlock {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  isBreaker: boolean;
  topPrice: number;
  bottomPrice: number;
  originCandleIndex: number;
  originTimestamp: number;
  timeframe: string;
  isMitigated: boolean;
  mitigationTimestamp?: number;
  touchCount: number;
  associatedDisplacementIndex?: number;
  associatedStructureBreak?: StructureBreak;
  validityStatus: 'ACTIVE' | 'MITIGATED' | 'VIOLATED' | 'BREAKER';
  classificationReason: string;
}

export interface DisplacementMove {
  id: string;
  startIndex: number;
  endIndex: number;
  startTimestamp: number;
  endTimestamp: number;
  direction: 'BULLISH' | 'BEARISH';
  priceChangePercent: number;
  relativeVolatility: number; // Multiplier of ATR
  consecutiveCandles: number;
  averageBodyPercent: number; // Ratio of body to total range
  associatedFVGIds: string[];
}

export interface DealingRange {
  id: string;
  timeframe: string;
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number; // 50%
  oteUpper: number;   // 0.786
  oteLower: number;   // 0.618
  currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
  highSwing: SwingPoint;
  lowSwing: SwingPoint;
}

export interface InducementZone {
  id: string;
  price: number;
  direction: 'BULLISH' | 'BEARISH';
  type: 'INTERNAL_RANGE_LIQUIDITY' | 'EARLY_BUYERS' | 'EARLY_SELLERS';
  timestamp: number;
  timeframe: string;
  isTrapped: boolean;
}
