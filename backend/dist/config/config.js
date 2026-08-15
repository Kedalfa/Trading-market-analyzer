"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    mongoUri: process.env.MONGODB_URI || '',
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    marketDataCacheTtl: parseInt(process.env.MARKET_DATA_CACHE_TTL || '30', 10),
    newsCacheTtl: parseInt(process.env.NEWS_CACHE_TTL || '300', 10),
};
if (!exports.config.mongoUri) {
    console.error('[CONFIG] MONGODB_URI is not set. Please create backend/.env with your MongoDB connection string.');
    process.exit(1);
}
//# sourceMappingURL=config.js.map