import { Document } from 'mongoose';
export interface IAnalysis extends Document {
    analysisId: string;
    userId?: string;
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
export declare const Analysis: import("mongoose").Model<IAnalysis, {}, {}, {}, Document<unknown, {}, IAnalysis, {}, {}> & IAnalysis & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Analysis.d.ts.map