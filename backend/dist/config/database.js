"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
let isConnected = false;
async function connectDB() {
    if (isConnected)
        return;
    try {
        await mongoose_1.default.connect(config_1.config.mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log('[MongoDB] Connected successfully');
        mongoose_1.default.connection.on('disconnected', () => {
            isConnected = false;
            console.warn('[MongoDB] Disconnected. Will reconnect on next request.');
        });
        mongoose_1.default.connection.on('error', (err) => {
            console.error('[MongoDB] Connection error:', err);
        });
    }
    catch (err) {
        console.error('[MongoDB] Failed to connect:', err);
        throw err;
    }
}
//# sourceMappingURL=database.js.map