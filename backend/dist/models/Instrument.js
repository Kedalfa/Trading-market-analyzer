"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Instrument = void 0;
const mongoose_1 = require("mongoose");
const instrumentSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    assetClass: {
        type: String,
        required: true,
        enum: ['forex', 'crypto', 'indices', 'commodities'],
    },
    baseCurrency: { type: String, required: true },
    quoteCurrency: { type: String, required: true },
    pipSize: { type: Number, required: true },
    tickSize: { type: Number, required: true },
    defaultTimeframe: { type: String, default: '15M' },
    provider: {
        type: String,
        required: true,
        enum: ['binance', 'yahoo', 'custom'],
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.Instrument = (0, mongoose_1.model)('Instrument', instrumentSchema);
//# sourceMappingURL=Instrument.js.map