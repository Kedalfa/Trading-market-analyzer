export interface RiskSettings {
  accountBalance: number;
  maxRiskPerTradePercent: number; // e.g. 1.0 (%)
  maxDailyLossPercent: number;    // e.g. 3.0 (%)
  maxDrawdownPercent: number;     // e.g. 5.0 (%)
  minRiskRewardRatio: number;     // e.g. 2.0 (1:2)
}

export interface PositionCalculation {
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskAmountDollars: number;
  potentialRewardDollars: number;
  stopDistance: number;
  stopDistancePips: number;
  riskRewardRatio: number;
  lotSize: number;
  units: number;
  isWithinRiskLimits: boolean;
  riskWarnings: string[];
}

export interface TradeIdea {
  id: string;
  analysisId: string;
  timestamp: number;
  instrumentId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  setupType: string; // e.g. "SMC 15M Sweep + 5M MSS + Bullish FVG Entry"
  timeframe: string;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  riskRewardRatio: number;
  positionCalculation: PositionCalculation;
  evidenceSummary: string[];
  invalidationConditions: string[];
  newsRestrictions: string[];
  status: 'PENDING' | 'EXECUTED' | 'INVALIDATED' | 'TARGET_HIT' | 'STOPPED_OUT';
}

export interface SavedAnalysisRecord {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  predictedDirection: 'BULLISH' | 'BEARISH';
  confidenceScore: number;
  setupGrade: string;
  entryZone: string;
  invalidationPrice: number;
  targetPrice: number;
  outcome?: {
    status: 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED' | 'OPEN';
    maxFavorableExcursion: number;
    maxAdverseExcursion: number;
    resolvedAt?: number;
  };
}
