import { Schema, model, Document } from 'mongoose';

export interface ITradeIdea extends Document {
  ideaId: string;
  analysisId?: string;
  userId?: string;
  symbol: string;
  instrumentId: string;
  direction: 'LONG' | 'SHORT';
  setupType: string;
  timeframe: string;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  riskRewardRatio: number;
  positionCalculation: {
    accountBalance: number;
    riskAmountDollars: number;
    potentialRewardDollars: number;
    stopDistance: number;
    stopDistancePips: number;
    riskRewardRatio: number;
    lotSize: number;
    units: number;
    isWithinRiskLimits: boolean;
    riskWarnings: string[];
  };
  evidenceSummary: string[];
  invalidationConditions: string[];
  newsRestrictions: string[];
  status: 'PENDING' | 'EXECUTED' | 'INVALIDATED' | 'TARGET_HIT' | 'STOPPED_OUT';
  createdAt: Date;
  updatedAt: Date;
}

const tradeIdeaSchema = new Schema<ITradeIdea>(
  {
    ideaId: { type: String, required: true, unique: true, index: true },
    analysisId: { type: String, index: true },
    userId: { type: String, index: true },
    symbol: { type: String, required: true, index: true },
    instrumentId: { type: String, required: true },
    direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
    setupType: { type: String, required: true },
    timeframe: String,
    entryPrice: { type: Number, required: true },
    stopLossPrice: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    riskRewardRatio: Number,
    positionCalculation: { type: Schema.Types.Mixed },
    evidenceSummary: [String],
    invalidationConditions: [String],
    newsRestrictions: [String],
    status: {
      type: String,
      enum: ['PENDING', 'EXECUTED', 'INVALIDATED', 'TARGET_HIT', 'STOPPED_OUT'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

tradeIdeaSchema.index({ symbol: 1, status: 1, createdAt: -1 });

export const TradeIdea = model<ITradeIdea>('TradeIdea', tradeIdeaSchema);
