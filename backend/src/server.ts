import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/config';
import { connectDB } from './config/database';
import { seedInstruments } from './services/instrumentSeedService';

import instrumentRoutes from './routes/instrumentRoutes';
import marketDataRoutes from './routes/marketDataRoutes';
import newsRoutes from './routes/newsRoutes';
import analysisRoutes from './routes/analysisRoutes';
import tradeIdeaRoutes from './routes/tradeIdeaRoutes';
import settingsRoutes from './routes/settingsRoutes';
import telegramRoutes from './routes/telegramRoutes';

import chartVisionRoutes from './routes/chartVisionRoutes';
import exnessRoutes from './routes/exnessRoutes';

const app = express();

// ── Middleware ────────────────────────────────────────────────────
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests from localhost:3000, 127.0.0.1, mobile, curl, or dev tooling
    if (!origin || origin === config.frontendOrigin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // Fully permissive for local development
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
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

app.use('/api/instruments', instrumentRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/trade-ideas', tradeIdeaRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/chart-vision', chartVisionRoutes);
app.use('/api/exness', exnessRoutes);

// ── 404 handler ───────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

import { startOutcomeMonitor, stopOutcomeMonitor } from './services/analysisOutcomeMonitor';
import { telegramBot } from './services/telegramBotService';
import { startMarketScanner, stopMarketScanner } from './services/marketScannerWorker';

// ── Bootstrap & Server Lifecycle ──────────────────────────────────
let httpServer: ReturnType<typeof createServer> | null = null;

async function bootstrap() {
  await connectDB();
  await seedInstruments();

  // Background Workers
  startOutcomeMonitor(20000); // Check open analyses outcomes every 20s
  startMarketScanner(45000);  // Scan watchlist pairs for Grade A setups every 45s
  telegramBot.startPolling(); // Start official Telegram Bot command polling

  httpServer = createServer(app);

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[FATAL] Port ${config.port} is already in use.`);
      console.error(`Please terminate any existing process on port ${config.port} with: lsof -ti :${config.port} | xargs kill -9\n`);
    } else {
      console.error('[Server] Server error:', err);
    }
    process.exit(1);
  });

  httpServer.listen(config.port, () => {
    console.log(`\n🚀 SMC Analyzer Backend running on http://localhost:${config.port}`);
    console.log(`   Frontend allowed: ${config.frontendOrigin}`);
    console.log(`   Health check: http://localhost:${config.port}/api/health\n`);
  });
}

function shutdown() {
  stopOutcomeMonitor();
  stopMarketScanner();
  telegramBot.stopPolling();
  if (httpServer) {
    httpServer.close(() => {
      console.log('[Server] Gracefully stopped');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});

export default app;
