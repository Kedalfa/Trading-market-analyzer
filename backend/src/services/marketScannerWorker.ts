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
import { getAuthoritativeCandles } from './marketDataService';
import { getEventsForInstrument } from './newsService';
import { runSMCPipeline } from '../engine';
import { generateStructuredSMCAnalysis } from './aiReasoningService';
import { telegramAlertDispatcher } from './telegramAlertDispatcher';
import { Instrument } from '../types/market';
import { validateTradeSetup, ACTIVE_SUPPORTED_INSTRUMENTS } from './tradeSetupValidator';
import { executeExnessTrade } from './exnessExecutionService';
import { config } from '../config/config';

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
  monitoredSymbols: ACTIVE_SUPPORTED_INSTRUMENTS,
  totalSetupsFoundToday: 0,
  totalAlertsDispatchedToday: 0,
};

export async function scanInstrumentForSetups(instrumentId: string, timeframe = '15M'): Promise<void> {
  scannerHealth.lastScannedSymbol = instrumentId;
  scannerHealth.lastScanTimestamp = new Date().toISOString();

  let candles: any[] | null = null;
  let htfCandles: any[] | null = null;

  try {
    const [res15m, res4h] = await Promise.all([
      getAuthoritativeCandles(instrumentId, timeframe, 120),
      getAuthoritativeCandles(instrumentId, '4H', 80),
    ]);
    candles = res15m?.candles || null;
    htfCandles = res4h?.candles || null;
  } catch (err) {
    console.warn(`[MarketScanner] Authoritative feed fetch error for ${instrumentId}:`, err);
    return;
  }

  if (!candles || candles.length < 20) return;

  const mapping = getInstrumentMapping(instrumentId);
  const provider = mapping?.provider || (instrumentId.includes('USDT') || instrumentId === 'XAUUSD' ? 'binance' : 'yahoo');

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

  // Strict Confluence Gate: Legitimate SMC structure required, Grade >= 75, High Probability, Not TOO_FAR
  if (
    scenario.isStructureIdentified &&
    scenario.entryProximityState !== 'TOO_FAR' &&
    quality.totalScore >= 75 &&
    scenario.probabilityGrade === 'HIGH_PROBABILITY'
  ) {
    const entry = isBull ? scenario.entryZoneHigh : scenario.entryZoneLow;
    const stopLoss = scenario.invalidationPrice;
    const target2 = scenario.potentialTargets[1]?.price || scenario.potentialTargets[0]?.price;

    if (!target2 || target2 <= 0 || (isBull ? target2 <= entry : target2 >= entry)) {
      console.warn(`[MarketScanner] Setup rejected for ${instObj.symbol}: Invalid target structure (${target2}).`);
      return;
    }

    const validation = validateTradeSetup({
      instrumentId,
      symbol: instObj.symbol,
      direction: isBull ? 'BULLISH' : 'BEARISH',
      currentPrice: pipe.lastPrice,
      entryPrice: Number(entry.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      stopLossPrice: Number(stopLoss.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      targetPrice: Number(target2.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
      invalidationPrice: Number(scenario.invalidationPrice.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
    });

    // Hard Safety Gate: Never publish any setup that fails validation
    if (!validation.isValid) {
      console.warn(`[MarketScanner] Setup rejected for ${instObj.symbol}: ${validation.rejectionReason}`);
      return;
    }

    const rr = Number(validation.actualRR.toFixed(2));

    // Evaluate Existing Waiting / Active Setups for this Symbol
    const existingOpenSetups = await Analysis.find({
      symbol: instObj.symbol,
      'outcome.status': { $in: ['OPEN', 'WAITING_FOR_ENTRY', 'APPROACHING_ENTRY', 'ENTRY_REACHED'] },
    });

    // Check if an active IN-MARKET trade (ENTRY_REACHED) exists (Do NOT invalidate active trades)
    const hasActiveLiveTrade = existingOpenSetups.some(s => s.outcome?.status === 'ENTRY_REACHED');

    // Check Supercession: If existing setups are WAITING, evaluate if new structure invalidates them
    for (const oldSetup of existingOpenSetups) {
      if (oldSetup.outcome?.status === 'ENTRY_REACHED') {
        // Active in-market trade continues its own lifecycle; never auto-invalidate live trades
        continue;
      }

      // If existing waiting setup has opposing direction, new MSS/BOS directly invalidates old thesis
      if (oldSetup.direction !== (isBull ? 'BULLISH' : 'BEARISH')) {
        const prev = oldSetup.outcome.status;
        oldSetup.outcome.status = 'INVALIDATED';
        oldSetup.outcome.completedAt = new Date();
        oldSetup.outcome.resolvedAt = new Date();
        oldSetup.outcome.invalidatedReason = `Superseded by new ${isBull ? 'Bullish' : 'Bearish'} market structure shift`;
        oldSetup.outcome.triggerReason = `Structural shift: New ${isBull ? 'Bullish' : 'Bearish'} setup emerged at ${pipe.lastPrice}`;
        oldSetup.outcome.monitoringStatus = 'Resolved: Invalidated';
        oldSetup.outcome.auditTrail.push({
          previousStatus: prev,
          newStatus: 'INVALIDATED',
          timestamp: new Date(),
          triggerPrice: pipe.lastPrice,
          triggerReason: `Superseded by new ${isBull ? 'Bullish' : 'Bearish'} setup`,
          observedPrice: pipe.lastPrice,
        });
        await oldSetup.save();

        await telegramAlertDispatcher.dispatchLifecycleAlert(
          oldSetup.analysisId,
          oldSetup.symbol,
          'INVALIDATED',
          'SETUP INVALIDATED',
          '',
          pipe.lastPrice,
          oldSetup
        );
      } else {
        // If same direction waiting setup already exists within 0.1% price range, avoid duplicate spam
        const priceDiff = Math.abs(oldSetup.entryPrice - entry);
        if (priceDiff < (oldSetup.entryPrice * 0.002)) {
          return;
        }
      }
    }

    if (hasActiveLiveTrade) {
      // Live trade is active; avoid overlapping new setup alert until trade resolves
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

    // 1. Persist to MongoDB Analysis Collection (idempotent upsert — safe across concurrent cycles)
    try {
      const scanDoc = {
        analysisId: setupId,
        symbol: instObj.symbol,
        instrumentId,
        timeframe,
        htfTimeframe: '4H',
        currentPrice: pipe.lastPrice,
        direction: isBull ? 'BULLISH' : 'BEARISH',
        entryPrice: Number(entry.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
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
      };

      const result = await Analysis.findOneAndUpdate(
        { analysisId: setupId },
        { $setOnInsert: scanDoc },
        { upsert: true, new: false, runValidators: true }
      );

      if (result !== null) {
        // Record already existed — scanner cycle overlap, skip counting & alerts
        console.log(`[MarketScanner] Setup ${setupId} already persisted by concurrent cycle — skipped.`);
        return;
      }
    } catch (dbErr: any) {
      if (dbErr?.code === 11000) {
        // MongoDB duplicate key — harmless: another cycle already inserted this setup
        console.log(`[MarketScanner] Duplicate key for ${setupId} (concurrent write) — skipped.`);
        return;
      }
      throw dbErr;
    }

    // 2. Dispatch formatted Telegram alert only AFTER successful authoritative persistence
    const target1 = scenario.potentialTargets[0]?.price || target2;
    const target3 = scenario.potentialTargets[2]?.price;

    await telegramAlertDispatcher.dispatchNewSetupAlert({
      setupId,
      symbol: instObj.symbol,
      analysis: structAnalysis,
      pipeline: pipe,
      direction: isBull ? 'BULLISH' : 'BEARISH',
      entryTop: scenario.entryZoneHigh,
      entryBottom: scenario.entryZoneLow,
      stopLoss,
      target1,
      target2,
      target3,
      invalidation: scenario.invalidationPrice,
      riskReward: rr,
    });

    // 3. Exness Automated Trade Placement (if auto-execute enabled)
    if (config.exness.enabled && config.exness.autoExecute) {
      try {
        console.log(`[MarketScanner] ⚡ Exness auto-execute triggered for ${setupId} on ${instObj.symbol}`);
        const execResult = await executeExnessTrade({
          analysisId: setupId,
          instrumentId,
          direction: isBull ? 'BULLISH' : 'BEARISH',
          entryPrice: Number(entry.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
          stopLoss: Number(stopLoss.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
          takeProfit1: Number(target1.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
          takeProfit2: Number(target2.toFixed(instObj.assetClass === 'forex' ? 5 : 2)),
          riskPercent: config.exness.maxRiskPercent,
          comment: `SMC-${setupId.slice(-8)}`,
        });
        console.log(`[MarketScanner] Exness execution status: ${execResult.status} | Ticket: ${execResult.ticket || execResult.orderId}`);
      } catch (execErr: any) {
        console.error(`[MarketScanner] Exness auto-execution failed for ${setupId}:`, execErr);
      }
    }

    scannerHealth.totalSetupsFoundToday++;
    console.log(`[MarketScanner] 🚀 New qualifying setup persisted and alert dispatched: ${setupId}`);
  }
}

/**
 * Main scanner cycle across all unique watchlist instruments
 */
export async function runMarketScanCycle(): Promise<void> {
  if (isCycleRunning) return;
  isCycleRunning = true;

  try {
    // Collect all active unique symbols from connected Telegram users + default active universe
    const users = await TelegramUser.find({ isConnected: true, 'settings.isMuted': false }).lean();
    const symbolSet = new Set<string>(ACTIVE_SUPPORTED_INSTRUMENTS);

    for (const u of users) {
      for (const s of u.watchlist) {
        const clean = s.replace(/[\/\-_]/g, '').toUpperCase();
        if (ACTIVE_SUPPORTED_INSTRUMENTS.includes(clean)) {
          symbolSet.add(clean);
        }
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
