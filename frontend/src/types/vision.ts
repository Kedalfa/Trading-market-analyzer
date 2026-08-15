export type AnnotationType =
  | 'BOS'
  | 'CHOCH'
  | 'MSS'
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'FVG'
  | 'ORDER_BLOCK'
  | 'BREAKER'
  | 'LIQUIDITY_POOL'
  | 'LIQUIDITY_SWEEP'
  | 'DEALING_RANGE'
  | 'DISPLACEMENT'
  | 'POTENTIAL_SETUP';

export interface VisionAnnotationItem {
  id: string;
  type: AnnotationType;
  label: string;
  subLabel?: string;
  category: 'Structure' | 'Liquidity' | 'Imbalance' | 'Institutional' | 'DealingRange' | 'Setup';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  coordinates: {
    xPct: number;       // 0 to 100% from left of image
    yPct: number;       // 0 to 100% from top of image
    widthPct?: number;  // For zones & rectangles
    heightPct?: number;
    x2Pct?: number;     // For lines (BOS, Sweeps)
    y2Pct?: number;
  };
  priceLevel?: number;
  priceRange?: {
    top: number;
    bottom: number;
  };
  whyDetected: string;
  status: string;
  relatedStructure?: string;
}

export interface VisionSetupEvidence {
  label: string;
  passed: boolean;
  note: string;
  category: string;
}

export interface VisionSetup {
  id: string;
  title: string;
  direction: 'BULLISH' | 'BEARISH';
  probabilityGrade: 'HIGH_PROBABILITY' | 'MODERATE_PROBABILITY' | 'CONDITIONAL';
  entryZone: {
    topPrice: number;
    bottomPrice: number;
    referenceZone: string;
  };
  invalidationPrice: number;
  targetPrice: number;
  riskRewardRatio: number;
  narrative: string;
  conditions: string[];
  evidenceChecklist: VisionSetupEvidence[];
  disclaimer: string;
}

export interface VisionConflict {
  category: 'TREND' | 'STRUCTURE_BREAK' | 'PRICE_LEVEL' | 'TIMEFRAME';
  visualObservation: string;
  authoritativeDataFact: string;
  explanation: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
}

export interface VisionAnalysisResult {
  isQualitySufficient: boolean;
  qualityMessage?: string;
  screenshotTimestamp?: string;
  symbolDetected?: string;
  timeframeDetected?: string;
  visibleTrend: 'BULLISH' | 'BEARISH' | 'RANGING' | 'UNCLEAR';
  annotations: VisionAnnotationItem[];
  setup?: VisionSetup;
  conflicts: VisionConflict[];
  summary: string;
}
