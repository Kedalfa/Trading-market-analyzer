import { Schema, model, Document } from 'mongoose';

export interface IUserSettings extends Document {
  userId: string;   // 'default' for single-user mode
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

const userSettingsSchema = new Schema<IUserSettings>(
  {
    userId: { type: String, required: true, unique: true, default: 'default' },
    riskSettings: {
      accountBalance: { type: Number, default: 10000 },
      maxRiskPerTradePercent: { type: Number, default: 1.0 },
      maxDailyLossPercent: { type: Number, default: 3.0 },
      maxDrawdownPercent: { type: Number, default: 5.0 },
      minRiskRewardRatio: { type: Number, default: 2.0 },
    },
    defaultInstrumentId: { type: String, default: 'BTCUSDT' },
    defaultTimeframe: { type: String, default: '15M' },
    defaultRuleset: { type: String, default: 'standard_smc' },
    chartLayerDefaults: {
      showSwings: { type: Boolean, default: true },
      showBOS: { type: Boolean, default: true },
      showCHoCH: { type: Boolean, default: true },
      showLiquidity: { type: Boolean, default: true },
      showFVG: { type: Boolean, default: true },
      showOrderBlocks: { type: Boolean, default: true },
      showDealingRange: { type: Boolean, default: true },
      showSessions: { type: Boolean, default: true },
      showVolume: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const UserSettings = model<IUserSettings>('UserSettings', userSettingsSchema);
