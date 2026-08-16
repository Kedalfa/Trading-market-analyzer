/**
 * Background Real-Time Market Scanner Worker
 * Continuously evaluates all active watchlist instruments across verified market feeds
 * (Yahoo Finance for FX/Metals/Indices, Binance for Crypto).
 * Executes deterministic SMC Detection + AI Structural Intelligence + Quality Scoring.
 * Automatically dispatches proactive Grade A/A+ alerts to connected Telegram users.
 */

import { TelegramUser } from '../models/TelegramUser';
import { Analysis } from '../models/Analysis';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
import { getInstrumentMapping } from '../config/instrumentRegistry';
import { fetchBinanceCandles } from './binanceService';
import { fetchYahooCandles } from './yahooMarketService';
import { getEventsForInstrument } from './newsService';
import { runSMCPipeline } from '../engine';
import { generateStructuredSMCAnalysis } from './aiReasoningService';
import { telegramAlertDispatcher } from './telegramAlertDispatcher';
import { Instrument } from '../types/market';

export interface ScannerHealthStatus {
  isScannerRunning: boolean;
  lastScanTimestamp: string | null;
  lastScannedSymbol: string | null;
  monitoredSymbols: string[];
  totalSetupsFoundToday: number;
  totalAlertsDispatchedToday: number;
}

let scannerInterval: NodeJS.Timeout | null = null;
let isCycleRunning = false;

export const scannerHealth: ScannerHealthStatus = {
  isScannerRunning: false,
  lastScanTimestamp: null,
  lastScannedSymbol: null,
  monitoredSymbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT'],
  totalSetupsFoundToday: 0,
  totalAlertsDispatchedToday: 0,
};

export async function scanInstrumentForSetups(instrumentId: string, timeframe = '15M'): Promise<void> {
  scannerHealth.lastScannedSymbol = instrumentId;
  scannerHealth.lastScanTimestamp = new Date().toISOString();

  const mapping = getInstrumentMapping(instrumentId);
  const provider = mapping?.provider || (instrumentId.includes('USDT') ? 'binance' : 'yahoo');

  let candles: any[] | null = null;
  let htfCandles: any[] | null = null;

  try {
    if (provider === 'binance') {
      [candles, htfCandles] = await Promise.all([
        fetchBinanceCandles(instrumentId, timeframe, 120),
        fetchBinanceCandles(instrumentId, '4h', 80),
      ]);
    } else {
      const yahooSym = mapping?.providerSymbol || (
        instrumentId === 'EURUSD' ? 'EURUSD=X' :
        instrumentId === 'GBPUSD' ? 'GBPUSD=X' :
        instrumentId === 'USDJPY' ? 'JPY=X' :
        instrumentId === 'XAUUSD' ? 'GC=F' :
        instrumentId === 'US500' ? '^GSPC' : '^IXIC'
      );
      const [res15m, res4h] = await Promise.all([
        fetchYahooCandles(yahooSym, timeframe, 120),
        fetchYahooCandles(yahooSym, '4h', 80),
      ]);
      candles = res15m?.candles || null;
      htfCandles = res4h?.candles || null;
    }
  } catch (err) {
    console.warn(`[MarketScanner] Feed fetch error for ${instrumentId}:`, err);
    return;
  }

  if (!candles || candles.length < 20) return;

  const instObj: Instrument = {
    id: instrumentId,
    symbol: mapping?.displaySymbol || instrumentId,
    name: mapping?.name || instrumentId,
    assetClass: (mapping?.assetClass as any) || (instrumentId.includes('USDT') ? 'crypto' : 'forex'),
    baseCurrency: mapping?.baseCurrency || instrumentId.slice(0, 3),
    quoteCurrency: mapping?.quoteCurrency || instrumentId.slice(3),
    pipSize: mapping?.pipSize || (instrumentId.includes('JPY') ? 0.01 : 0.0001),
    tickSize: mapping?.tickSize || (instrumentId.includes('JPY') ? 0.001 : 0.00001),
    defaultTimeframe: '15M',
    provider: (provider === 'binance' ? 'binance' : 'yahoo') as 'binance' | 'yahoo',
  };

  // Run Deterministic SMC Pipeline (Single Source of Truth)
  const pipe = runSMCPipeline(instObj, candles, timeframe);
  const htfPipe = htfCandles && htfCandles.length > 10 ? runSMCPipeline(instObj, htfCandles, '4H') : undefined;

  // Macro News & Calendar
  const newsEvents = getEventsForInstrument(instrumentId);
  const newsContext = {
    upcomingEvents: newsEvents.upcomingEvents,
    recentEvents: newsEvents.recentEvents,
    hasImminentHighImpactEvent: newsEvents.hasImminentHighImpactEvent,
    warningMessage: newsEvents.warningMessage,
  };

  // AI Structural Intelligence & Setup Quality Evaluation
  const structAnalysis = generateStructuredSMCAnalysis(pipe, newsContext, 'standard_smc', htfPipe);

  // Setup Quality & Confluence Filter
  const quality = structAnalysis.setupQuality;
  const isBull = structAnalysis.marketOverview.htfBias === 'BULLISH';
  const scenario = isBull ? structAnalysis.scenarios.bullish : structAnalysis.scenarios.bearish;

  // Strict Confluence Gate: Score >= 75 (Grade A or A+) and High Probability
  if (quality.totalScore >= 75 && scenario.probabilityGrade === 'HIGH_PROBABILITY') {
    const entryTop = scenario.idealEntryZone.topPrice;
    const entryBottom = scenario.idealEntryZone.bottomPrice;
    const stopLoss = scenario.invalidationPrice;
    const target1 = scenario.potentialTargets[0]?.price || (isBull ? entryTop * 1.01 : entryBottom * 0.99);
    const target2 = scenario.potentialTargets[1]?.price || (isBull ? entryTop * 1.02 : entryBottom * 0.98);
    const target3 = scenario.potentialTargets[2]?.price;

    const risk = Math.abs(entryTop - stopLoss);
    const reward = Math.abs(target2 - entryTop);
    const rr = risk > 0 ? Number((reward / risk).toFixed(2)) : 2.5;

    // Check if an existing ACTIVE open setup for this symbol is already being monitored
    const existingOpenSetup = await Analysis.findOne({
      symbol: instObj.symbol,
      'outcome.status': 'OPEN',
    });

    if (existingOpenSetup) {
      // Setup is already active and tracked — avoid duplicate spam
      return;
    }

    // Generate unique Setup ID (e.g. SMC-EURUSD-20260816-01)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await Analysis.countDocuments({
      symbol: instObj.symbol,
      savedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const setupIndex = String(countToday + 1).padStart(2, '0');
    const setupId = `SMC-${instObj.symbol.replace('/', '')}-${dateStr}-${setupIndex}`;

    // 1. Proactively dispatch formatted Telegram alerts to subscribers
    await telegramAlertDispatcher.dispatchNewSetupAlert({
      setupId,
      symbol: instObj.symbol,
      analysis: structAnalysis,
      pipeline: pipe,
      direction: isBull ? 'BULLISH' : 'BEARISH',
      entryTop,
      entryBottom,
      stopLoss,
      target1,
      target2,
      target3,
      invalidation: scenario.invalidationPrice,
      riskReward: rr,
    });

    // 2. Persist to MongoDB Analysis Collection for unified outcome tracking
    await Analysis.create({
      analysisId: setupId,
      symbol: instObj.symbol,
      instrumentId,
      timeframe,
      htfTimeframe: '4H',
      currentPrice: pipe.lastPrice,
      direction: isBull ? 'BULLISH' : 'BEARISH',
      entryPrice: Number(entryTop.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      stopLossPrice: Number(stopLoss.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      targetPrice: Number(target2.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      invalidationPrice: Number(scenario.invalidationPrice.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      riskRewardRatio: rr,
      rulesetUsed: 'standard_smc',
      htfBias: structAnalysis.marketOverview.htfBias,
      intermediateStructure: structAnalysis.marketOverview.intermediateStructure,
      structuralEvidence: structAnalysis.structuralEvidence.bulletPoints,
      conflictingSignals: structAnalysis.structuralEvidence.conflictingSignals,
      bullishScenario: structAnalysis.scenarios.bullish,
      bearishScenario: structAnalysis.scenarios.bearish,
      setupQuality: structAnalysis.setupQuality,
      newsRiskWarning: structAnalysis.newsContext.riskWarning,
      sessionNotes: structAnalysis.sessionContext.sessionNotes ?? '',
      savedAt: new Date(),
      outcome: {
        status: 'OPEN',
        monitoringStatus: 'Proactive Alert Dispatched — Actively Monitoring Live Feeds',
        auditTrail: [
          {
            previousStatus: 'NEW',
            newStatus: 'OPEN',
            timestamp: new Date(),
            triggerReason: 'Scanner detected new Grade A SMC confluence setup & pushed Telegram alert',
            observedPrice: pipe.lastPrice,
          },
        ],
      },
    });

    scannerHealth.totalSetupsFoundToday++;
    console.log(`[MarketScanner] 🚀 New qualifying setup created and alert dispatched: ${setupId}`);
  }
}

/**
 * Main scanner cycle across all unique watchlist instruments
 */
export async function runMarketScanCycle(): Promise<void> {
  if (isCycleRunning) return;
  isCycleRunning = true;

  try {
    // Collect all active unique symbols from connected Telegram users + default core pairs
    const users = await TelegramUser.find({ isConnected: true, 'settings.isMuted': false }).lean();
    const symbolSet = new Set<string>(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT']);

    for (const u of users) {
      for (const s of u.watchlist) {
        symbolSet.add(s.replace('/', '').toUpperCase());
      }
    }

    const symbolsArray = Array.from(symbolSet);
    scannerHealth.monitoredSymbols = symbolsArray;

    for (const sym of symbolsArray) {
      await scanInstrumentForSetups(sym, '15M');
    }
  } catch (err) {
    console.error('[MarketScanner] Scan cycle error:', err);
  } finally {
    isCycleRunning = false;
  }
}

export function startMarketScanner(intervalMs = 35000): void {
  if (scannerInterval) return;
  scannerHealth.isScannerRunning = true;
  console.log(`[MarketScanner] Proactive Background Scanner initialized (interval: ${intervalMs / 1000}s)`);
  setTimeout(runMarketScanCycle, 5000);
  scannerInterval = setInterval(runMarketScanCycle, intervalMs);
}

export function stopMarketScanner(): void {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
    scannerHealth.isScannerRunning = false;
    console.log('[MarketScanner] Background scanner stopped');
  }
}
