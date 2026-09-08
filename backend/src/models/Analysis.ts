import { Schema, model, Document } from 'mongoose';

export interface IAuditEntry {
  previousStatus: string;
  newStatus: string;
  timestamp: Date;
  triggerPrice?: number;
  triggerReason: string;
  observedPrice?: number;
  marketDataTimestamp?: number;
}

const auditEntrySchema = new Schema<IAuditEntry>(
  {
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    triggerPrice: Number,
    triggerReason: { type: String, required: true },
    observedPrice: Number,
    marketDataTimestamp: Number,
  },
  { _id: false }
);

export interface IAnalysisOutcome {
  status: 'OPEN' | 'WAITING_FOR_ENTRY' | 'APPROACHING_ENTRY' | 'ENTRY_REACHED' | 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED' | 'EXPIRED' | 'AMBIGUOUS' | 'MONITORING_PAUSED';
  isApproachingEntry?: boolean;
  entryApproachingNotified?: boolean;
  entryTriggeredNotified?: boolean;
  invalidatedReason?: string;
  supersededBySetupId?: string;
  entryReachedAt?: Date;
  completedAt?: Date;
  targetHitAt?: Date;
  stoppedOutAt?: Date;
  resolvedAt?: Date;
  triggerPrice?: number;
  triggerReason?: string;
  observedPrice?: number;
  timeToResolutionMinutes?: number;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  notes?: string;
  lastMonitoredAt?: Date;
  lastProcessedBarTimestamp?: number;
  isRecoveredState?: boolean;
  monitoringStatus?: string;
  auditTrail: IAuditEntry[];
}

export interface IAnalysis extends Document {
  analysisId: string;
  userId?: string;
  symbol: string;
  instrumentId: string;
  timeframe: string;
  htfTimeframe: string;
  currentPrice: number;
  rulesetUsed: string;
  direction: 'BULLISH' | 'BEARISH';
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;      // Canonical TP2 (prime structural target, used for lifecycle monitoring)
  takeProfit1?: number;     // Internal / partial TP level
  takeProfit2?: number;     // Alias for targetPrice (primary draw)
  takeProfit3?: number;     // Extended runner target (if available)
  invalidationPrice: number;
  riskRewardRatio: number;
  htfBias: 'BULLISH' | 'BEARISH' | 'RANGING';
  intermediateStructure: 'BULLISH' | 'BEARISH' | 'RANGING';
  structuralEvidence: string[];
  conflictingSignals: string[];
  bullishScenario: object;
  bearishScenario: object;
  setupQuality: {
    totalScore: number;
    grade: string;
    components: object[];
  };
  newsRiskWarning?: string;
  sessionNotes: string;
  savedAt: Date;
  expiresAt?: Date;
  outcome: IAnalysisOutcome;
}

const analysisSchema = new Schema<IAnalysis>(
  {
    analysisId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    symbol: { type: String, required: true, index: true },
    instrumentId: { type: String, required: true, index: true },
    timeframe: { type: String, required: true },
    htfTimeframe: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    rulesetUsed: { type: String, required: true },
    direction: { type: String, enum: ['BULLISH', 'BEARISH'], default: 'BULLISH', required: true },
    entryPrice: { type: Number, required: true },
    stopLossPrice: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    takeProfit1: { type: Number },
    takeProfit2: { type: Number },
    takeProfit3: { type: Number },
    invalidationPrice: { type: Number, required: true },
    riskRewardRatio: { type: Number, default: 2.0 },
    htfBias: { type: String, enum: ['BULLISH', 'BEARISH', 'RANGING'], required: true },
    intermediateStructure: { type: String, enum: ['BULLISH', 'BEARISH', 'RANGING'], required: true },
    structuralEvidence: [String],
    conflictingSignals: [String],
    bullishScenario: { type: Schema.Types.Mixed },
    bearishScenario: { type: Schema.Types.Mixed },
    setupQuality: {
      totalScore: Number,
      grade: String,
      components: [{ type: Schema.Types.Mixed }],
    },
    newsRiskWarning: String,
    sessionNotes: String,
    savedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    outcome: {
      status: {
        type: String,
        enum: ['OPEN', 'WAITING_FOR_ENTRY', 'APPROACHING_ENTRY', 'ENTRY_REACHED', 'TARGET_HIT', 'STOPPED_OUT', 'INVALIDATED', 'EXPIRED', 'AMBIGUOUS', 'MONITORING_PAUSED'],
        default: 'OPEN',
        index: true,
      },
      isApproachingEntry: { type: Boolean, default: false },
      entryApproachingNotified: { type: Boolean, default: false },
      entryTriggeredNotified: { type: Boolean, default: false },
      invalidatedReason: String,
      supersededBySetupId: String,
      entryReachedAt: Date,
      completedAt: { type: Date, index: true },
      targetHitAt: Date,
      stoppedOutAt: Date,
      resolvedAt: Date,
      triggerPrice: Number,
      triggerReason: String,
      observedPrice: Number,
      timeToResolutionMinutes: Number,
      maxFavorableExcursion: Number,
      maxAdverseExcursion: Number,
      notes: String,
      lastMonitoredAt: Date,
      lastProcessedBarTimestamp: Number,
      isRecoveredState: { type: Boolean, default: false },
      monitoringStatus: String,
      auditTrail: [auditEntrySchema],
    },
  },
  { timestamps: true }
);

analysisSchema.index({ symbol: 1, timeframe: 1, savedAt: -1 });

export const Analysis = model<IAnalysis>('Analysis', analysisSchema);
