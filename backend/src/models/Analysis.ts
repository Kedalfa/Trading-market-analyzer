import { Schema, model, Document } from 'mongoose';

// Subdocument schemas
const scoreComponentSchema = new Schema({
  category: String,
  score: Number,
  maxScore: Number,
  weight: Number,
  reason: String,
  isPositive: Boolean,
}, { _id: false });

const scenarioTargetSchema = new Schema({
  label: String,
  price: Number,
  description: String,
}, { _id: false });

const scenarioSchema = new Schema({
  type: { type: String, enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
  probabilityGrade: String,
  title: String,
  narrative: String,
  conditionsRequired: [String],
  invalidationTrigger: String,
  invalidationPrice: Number,
  potentialTargets: [scenarioTargetSchema],
  idealEntryZone: {
    topPrice: Number,
    bottomPrice: Number,
    referenceZone: String,
  },
}, { _id: false });

export interface IAnalysis extends Document {
  analysisId: string;
  userId?: string;         // optional for future multi-user support
  symbol: string;
  instrumentId: string;
  timeframe: string;
  htfTimeframe: string;
  currentPrice: number;
  rulesetUsed: string;
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
  outcome?: {
    status: 'OPEN' | 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED';
    resolvedAt?: Date;
    maxFavorableExcursion?: number;
    maxAdverseExcursion?: number;
    notes?: string;
  };
}

const analysisSchema = new Schema<IAnalysis>(
  {
    analysisId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    symbol: { type: String, required: true, index: true },
    instrumentId: { type: String, required: true },
    timeframe: { type: String, required: true },
    htfTimeframe: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    rulesetUsed: { type: String, required: true },
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
    outcome: {
      status: { type: String, enum: ['OPEN', 'TARGET_HIT', 'STOPPED_OUT', 'INVALIDATED'], default: 'OPEN' },
      resolvedAt: Date,
      maxFavorableExcursion: Number,
      maxAdverseExcursion: Number,
      notes: String,
    },
  },
  { timestamps: true }
);

// Compound index for quick symbol+timeframe queries
analysisSchema.index({ symbol: 1, timeframe: 1, savedAt: -1 });

export const Analysis = model<IAnalysis>('Analysis', analysisSchema);
