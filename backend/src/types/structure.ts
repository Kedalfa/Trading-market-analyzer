export type SwingType = 'HH' | 'HL' | 'LH' | 'LL';

export interface SwingPoint {
  id: string;
  index: number;
  timestamp: number;
  price: number;
  type: 'HIGH' | 'LOW';
  subType?: SwingType; // HH, HL, LH, LL
  timeframe: string;
  strength: number;    // Lookback bars or confidence factor (e.g. 5, 10, 20)
  isInternal: boolean; // Internal structure vs External / Major swing
  confirmed: boolean;
}

export type BreakType = 'BOS' | 'CHOCH' | 'MSS';

export interface StructureBreak {
  id: string;
  breakType: BreakType;
  direction: 'BULLISH' | 'BEARISH';
  brokenSwing: SwingPoint;
  breakingCandleIndex: number;
  breakingTimestamp: number;
  breakPrice: number;
  candleClosePrice: number;
  isWickBreakOnly: boolean; // Confirmed by body close or only wick penetration
  timeframe: string;
  confidence: number; // 0-100%
  description: string;
}

export interface MarketStructureResult {
  timeframe: string;
  swings: SwingPoint[];
  breaks: StructureBreak[];
  currentTrend: 'BULLISH' | 'BEARISH' | 'RANGING';
  lastBOS?: StructureBreak;
  lastCHoCH?: StructureBreak;
  lastMSS?: StructureBreak;
  internalTrend: 'BULLISH' | 'BEARISH' | 'RANGING';
}
