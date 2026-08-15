import { Document } from 'mongoose';
export interface IUserSettings extends Document {
    userId: string;
    riskSettings: {
        accountBalance: number;
        maxRiskPerTradePercent: number;
        maxDailyLossPercent: number;
        maxDrawdownPercent: number;
        minRiskRewardRatio: number;
    };
    defaultInstrumentId: string;
    defaultTimeframe: string;
    defaultRuleset: string;
    chartLayerDefaults: {
        showSwings: boolean;
        showBOS: boolean;
        showCHoCH: boolean;
        showLiquidity: boolean;
        showFVG: boolean;
        showOrderBlocks: boolean;
        showDealingRange: boolean;
        showSessions: boolean;
        showVolume: boolean;
    };
    updatedAt: Date;
}
export declare const UserSettings: import("mongoose").Model<IUserSettings, {}, {}, {}, Document<unknown, {}, IUserSettings, {}, {}> & IUserSettings & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=UserSettings.d.ts.map