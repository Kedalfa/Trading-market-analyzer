"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const config_1 = require("./config/config");
const database_1 = require("./config/database");
const instrumentSeedService_1 = require("./services/instrumentSeedService");
const instrumentRoutes_1 = __importDefault(require("./routes/instrumentRoutes"));
const marketDataRoutes_1 = __importDefault(require("./routes/marketDataRoutes"));
const newsRoutes_1 = __importDefault(require("./routes/newsRoutes"));
const analysisRoutes_1 = __importDefault(require("./routes/analysisRoutes"));
const tradeIdeaRoutes_1 = __importDefault(require("./routes/tradeIdeaRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const app = (0, express_1.default)();
// ── Middleware ────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server) or from allowed origins
        if (!origin || origin === config_1.config.frontendOrigin || origin.startsWith('http://localhost')) {
            callback(null, true);
        }
        else {
            callback(null, true); // Permissive in dev mode
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`);
    next();
});
// ── Routes ────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'SMC Analyzer Backend',
        version: '1.0.0',
    });
});
app.use('/api/instruments', instrumentRoutes_1.default);
app.use('/api/market-data', marketDataRoutes_1.default);
app.use('/api/news', newsRoutes_1.default);
app.use('/api/analyses', analysisRoutes_1.default);
app.use('/api/trade-ideas', tradeIdeaRoutes_1.default);
app.use('/api/settings', settingsRoutes_1.default);
// ── 404 handler ───────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});
// ── Bootstrap & Server Lifecycle ──────────────────────────────────
let httpServer = null;
async function bootstrap() {
    await (0, database_1.connectDB)();
    await (0, instrumentSeedService_1.seedInstruments)();
    httpServer = (0, http_1.createServer)(app);
    httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n[FATAL] Port ${config_1.config.port} is already in use.`);
            console.error(`Please terminate any existing process on port ${config_1.config.port} with: lsof -ti :${config_1.config.port} | xargs kill -9\n`);
        }
        else {
            console.error('[Server] Server error:', err);
        }
        process.exit(1);
    });
    httpServer.listen(config_1.config.port, () => {
        console.log(`\n🚀 SMC Analyzer Backend running on http://localhost:${config_1.config.port}`);
        console.log(`   Frontend allowed: ${config_1.config.frontendOrigin}`);
        console.log(`   Health check: http://localhost:${config_1.config.port}/api/health\n`);
    });
}
function shutdown() {
    if (httpServer) {
        httpServer.close(() => {
            console.log('[Server] Gracefully stopped');
            process.exit(0);
        });
    }
    else {
        process.exit(0);
    }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
bootstrap().catch((err) => {
    console.error('[Bootstrap] Fatal startup error:', err);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=server.js.map