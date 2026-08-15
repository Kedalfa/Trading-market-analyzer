"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSettings = void 0;
const mongoose_1 = require("mongoose");
const userSettingsSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.UserSettings = (0, mongoose_1.model)('UserSettings', userSettingsSchema);
//# sourceMappingURL=UserSettings.js.map