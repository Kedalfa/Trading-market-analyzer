import { MarketStructureResult } from './structure';
import { LiquidityPool, FairValueGap, OrderBlock, DealingRange, DisplacementMove } from './smc';
import { TradingSession } from './session';
import { EconomicEvent } from './news';

export interface SetupScoreComponent {
  category: string;
  score: number;       // 0 to 10
  maxScore: number;    // e.g. 10
  weight: number;      // 0 to 1.0
  reason: string;
  isPositive: boolean;
}

export interface SetupQualityScore {
  totalScore: number;     // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'INCOMPLETE';
  components: SetupScoreComponent[];
  summary: string;
}

export interface TradingScenario {
  id: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  probabilityGrade: 'HIGH_PROBABILITY' | 'MODERATE_PROBABILITY' | 'LOW_PROBABILITY' | 'CONDITIONAL';
  title: string;
  narrative: string;
  conditionsRequired: string[];
  invalidationTrigger: string;
  invalidationPrice: number;
  potentialTargets: {
    label: string;
    price: number;
    description: string;
    targetType?: string;
    targetStructureId?: string;
  }[];
  idealEntryZone: {
    topPrice: number;
    bottomPrice: number;
    referenceZone: string;
  };
  // Structural Audit & Calculation Metadata
  isStructureIdentified: boolean;
  entryReason: string;
  entryStructureType: 'FVG' | 'ORDER_BLOCK' | 'BREAKER_BLOCK' | 'LIQUIDITY_SWEEP_RECLAIM' | 'DISPLACEMENT_ORIGIN' | 'PREMIUM_DISCOUNT_EQUILIBRIUM' | 'NONE';
  entryStructureId?: string;
  entryZoneHigh: number;
  entryZoneLow: number;
  supportingSwing?: {
    type: 'SWING_HIGH' | 'SWING_LOW';
    price: number;
    time?: number;
    candleIndex?: number;
  };
  supportingLiquidity?: {
    type: 'BUYSIDE' | 'SELLSIDE';
    price: number;
    status: string;
  };
  timeframe: string;
  sourceCandleIds?: number[];
  slReason: string;
  slStructureType: 'SWING_LOW' | 'SWING_HIGH' | 'ORDER_BLOCK_INVALIDATION' | 'FVG_INVALIDATION' | 'LIQUIDITY_SWEEP_EXTREME' | 'DEALING_RANGE_EXTREME';
  slStructurePrice: number;
  slBufferUsed: number;
  tpReason: string;
  tpStructureType: 'SWING_HIGH' | 'SWING_LOW' | 'EQUAL_HIGHS' | 'EQUAL_LOWS' | 'OPPOSING_ORDER_BLOCK' | 'OPPOSING_FVG' | 'EXTERNAL_LIQUIDITY_POOL' | 'DEALING_RANGE_EXPANSION';
  tpStructureId?: string;
  tpDistanceFromEntry: number;
  calculatedRR: number;
  currentPriceAtCreation: number;
  entryDistance: number;
  entryDistancePercent: number;
  entryDistanceInATR: number;
  entryProximityState: 'APPROACHING' | 'PENDING' | 'TOO_FAR' | 'INVALIDATED';
}

export interface StructuredSMCAnalysis {
  analysisId: string;
  timestamp: number;
  instrumentId: string;
  symbol: string;
  currentPrice: number;
  timeframeHierarchy: {
    higher: string;
    intermediate: string;
    setup: string;
    entry: string;
  };
  rulesetUsed: string;
  marketOverview: {
    htfBias: 'BULLISH' | 'BEARISH' | 'RANGING';
    intermediateStructure: 'BULLISH' | 'BEARISH' | 'RANGING';
    lowerTimeframeStatus: string;
    summary: string;
  };
  structuralEvidence: {
    bulletPoints: string[];
    conflictingSignals: string[];
  };
  liquidityMap: {
    nearestBuyside: LiquidityPool | null;
    nearestSellside: LiquidityPool | null;
    majorLiquidityPools: LiquidityPool[];
    sweptLiquidity: LiquidityPool[];
    nextTargetSummary: string;
  };
  relevantZones: {
    activeOrderBlocks: OrderBlock[];
    unmitigatedFVGs: FairValueGap[];
    dealingRange: DealingRange | null;
    displacements: DisplacementMove[];
  };
  newsContext: {
    relevantEvents: EconomicEvent[];
    riskWarning?: string;
  };
  sessionContext: {
    activeSessions: TradingSession[];
    sessionNotes: string;
  };
  scenarios: {
    bullish: TradingScenario;
    bearish: TradingScenario;
  };
  setupQuality: SetupQualityScore;
  educationalNotes: {
    concept: string;
    explanation: string;
    chartApplication: string;
  }[];
}

export interface EducationalConcept {
  id: string;
  name: string;
  category: 'Structure' | 'Liquidity' | 'Imbalance' | 'Institutional Zones' | 'Session & Macro';
  summary: string;
  detailedExplanation: string;
  detectionFormula: string;
  tradingRules: string[];
  invalidationRules: string[];
  commonMistakes: string[];
  visualDiagramType: 'bos' | 'choch' | 'mss' | 'fvg' | 'orderblock' | 'liquidity_sweep' | 'premium_discount';
}
