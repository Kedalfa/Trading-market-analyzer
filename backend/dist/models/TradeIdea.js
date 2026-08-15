"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeIdea = void 0;
const mongoose_1 = require("mongoose");
const tradeIdeaSchema = new mongoose_1.Schema({
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
    positionCalculation: { type: mongoose_1.Schema.Types.Mixed },
    evidenceSummary: [String],
    invalidationConditions: [String],
    newsRestrictions: [String],
    status: {
        type: String,
        enum: ['PENDING', 'EXECUTED', 'INVALIDATED', 'TARGET_HIT', 'STOPPED_OUT'],
        default: 'PENDING',
    },
}, { timestamps: true });
tradeIdeaSchema.index({ symbol: 1, status: 1, createdAt: -1 });
exports.TradeIdea = (0, mongoose_1.model)('TradeIdea', tradeIdeaSchema);
//# sourceMappingURL=TradeIdea.js.map