"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Analysis = void 0;
const mongoose_1 = require("mongoose");
// Subdocument schemas
const scoreComponentSchema = new mongoose_1.Schema({
    category: String,
    score: Number,
    maxScore: Number,
    weight: Number,
    reason: String,
    isPositive: Boolean,
}, { _id: false });
const scenarioTargetSchema = new mongoose_1.Schema({
    label: String,
    price: Number,
    description: String,
}, { _id: false });
const scenarioSchema = new mongoose_1.Schema({
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
const analysisSchema = new mongoose_1.Schema({
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
    bullishScenario: { type: mongoose_1.Schema.Types.Mixed },
    bearishScenario: { type: mongoose_1.Schema.Types.Mixed },
    setupQuality: {
        totalScore: Number,
        grade: String,
        components: [{ type: mongoose_1.Schema.Types.Mixed }],
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
}, { timestamps: true });
// Compound index for quick symbol+timeframe queries
analysisSchema.index({ symbol: 1, timeframe: 1, savedAt: -1 });
exports.Analysis = (0, mongoose_1.model)('Analysis', analysisSchema);
//# sourceMappingURL=Analysis.js.map