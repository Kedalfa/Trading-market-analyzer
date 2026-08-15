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
  }[];
  idealEntryZone: {
    topPrice: number;
    bottomPrice: number;
    referenceZone: string; // e.g. "15M Bullish OB + FVG"
  };
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
