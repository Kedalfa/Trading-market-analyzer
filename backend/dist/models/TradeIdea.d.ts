import { Document } from 'mongoose';
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
export declare const TradeIdea: import("mongoose").Model<ITradeIdea, {}, {}, {}, Document<unknown, {}, ITradeIdea, {}, {}> & ITradeIdea & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=TradeIdea.d.ts.map