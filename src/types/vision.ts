export interface VisionDetection {
  timeframeDetected?: string;
  symbolDetected?: string;
  identifiedZones: {
    type: 'OB' | 'FVG' | 'LIQUIDITY' | 'BOS' | 'CHOCH' | 'SUPPORT_RESISTANCE';
    approximatePrice: number;
    description: string;
  }[];
  visibleTrend: 'BULLISH' | 'BEARISH' | 'RANGING' | 'UNCLEAR';
  hasDrawings: boolean;
  notes: string;
}

export interface VisionConflict {
  category: 'TREND' | 'STRUCTURE_BREAK' | 'PRICE_LEVEL' | 'TIMEFRAME';
  visualObservation: string;
  authoritativeDataFact: string;
  explanation: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
}

export interface VisionComparisonResult {
  isQualitySufficient: boolean;
  qualityMessage?: string;
  visionDetection: VisionDetection;
  conflicts: VisionConflict[];
  synthesisSummary: string;
}
