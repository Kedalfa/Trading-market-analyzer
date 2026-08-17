/**
 * Automated Background Analysis Outcome Monitor & Lifecycle Alert Engine
 * Continuously evaluates all OPEN & ENTRY_REACHED analyses against real-time market data ticks & historical bars.
 * Executes automatic status transitions and dispatches Telegram lifecycle updates:
 * (WAITING_FOR_ENTRY -> ENTRY_REACHED [TRADE ACTIVE] -> TARGET_HIT / STOPPED_OUT / INVALIDATED / EXPIRED).
 */

import { Analysis, IAnalysis } from '../models/Analysis';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
import { getInstrumentMapping } from '../config/instrumentRegistry';
import { fetchBinanceCandles, fetchBinanceBookQuote } from './binanceService';
import { fetchYahooCandles, fetchYahooRealtimeQuote } from './yahooMarketService';
import { telegramAlertDispatcher } from './telegramAlertDispatcher';

export interface MonitorHealthStatus {
  isMonitorRunning: boolean;
  lastEvaluationTimestamp: string | null;
  activeAnalysesCount: number;
}

let monitorInterval: NodeJS.Timeout | null = null;
let isMonitoringRunning = false;

export const monitorHealth: MonitorHealthStatus = {
  isMonitorRunning: false,
  lastEvaluationTimestamp: null,
  activeAnalysesCount: 0,
};

export async function evaluateSingleAnalysis(analysis: IAnalysis): Promise<void> {
  const mapping = getInstrumentMapping(analysis.instrumentId);
  const provider = mapping?.provider || (analysis.instrumentId.includes('USDT') ? 'binance' : 'yahoo');

  let latestCandles: any[] | null = null;
  let currentPrice: number | null = null;

  try {
    if (provider === 'binance') {
      const [candles, quote] = await Promise.all([
        fetchBinanceCandles(analysis.instrumentId, analysis.timeframe, 50),
        fetchBinanceBookQuote(analysis.instrumentId),
      ]);
      latestCandles = candles;
      currentPrice = quote?.price || (candles && candles.length > 0 ? candles[candles.length - 1].close : null);
    } else {
      const yahooSymbol = mapping?.providerSymbol || (
        analysis.instrumentId === 'EURUSD' ? 'EURUSD=X' :
        analysis.instrumentId === 'GBPUSD' ? 'GBPUSD=X' :
        analysis.instrumentId === 'USDJPY' ? 'JPY=X' :
        analysis.instrumentId === 'XAUUSD' ? 'GC=F' :
        analysis.instrumentId === 'US500' ? '^GSPC' : '^IXIC'
      );
      const [result, liveQuote] = await Promise.all([
        fetchYahooCandles(yahooSymbol, analysis.timeframe, 50),
        fetchYahooRealtimeQuote(yahooSymbol),
      ]);
      if (result) {
        latestCandles = result.candles;
      }
      currentPrice = liveQuote?.price || result?.quote.price || null;
    }
  } catch (err) {
    console.warn(`[OutcomeMonitor] Feed fetch failed for ${analysis.symbol}:`, err);
  }

  const now = new Date();

  // If market data is unreachable: pause monitoring
  if (!latestCandles || latestCandles.length === 0 || currentPrice == null) {
    analysis.outcome.monitoringStatus = 'Monitoring Paused — Market Data Feed Offline';
    analysis.outcome.lastMonitoredAt = now;
    await analysis.save();
    return;
  }

  await evaluateAnalysisOutcome(analysis, latestCandles, currentPrice);
}

export async function evaluateAnalysisOutcome(
  analysis: IAnalysis,
  latestCandles: any[],
  currentPrice: number
): Promise<void> {
  const now = new Date();

  // 1. Check Expiration (default 72h)
  const expirationThreshold = analysis.expiresAt || new Date(analysis.savedAt.getTime() + 72 * 3600 * 1000);
  if (now > expirationThreshold) {
    const prev = analysis.outcome.status;
    analysis.outcome.status = 'EXPIRED';
    analysis.outcome.resolvedAt = now;
    analysis.outcome.observedPrice = currentPrice;
    analysis.outcome.triggerReason = `Analysis expired after 72 hours without reaching target or stop`;
    analysis.outcome.monitoringStatus = 'Resolved: Expired';
    analysis.outcome.auditTrail.push({
      previousStatus: prev,
      newStatus: 'EXPIRED',
      timestamp: now,
      triggerReason: 'Time expiration reached',
      observedPrice: currentPrice,
    });
    await analysis.save();

    await telegramAlertDispatcher.dispatchLifecycleAlert(
      analysis.analysisId,
      analysis.symbol,
      'EXPIRED',
      'SETUP EXPIRED',
      '',
      currentPrice,
      analysis
    );
    return;
  }

  const currentStatus = analysis.outcome.status;
  const savedTsSeconds = Math.floor(analysis.savedAt.getTime() / 1000);
  const relevantCandles = latestCandles
    .filter(c => c.timestamp >= savedTsSeconds)
    .sort((a, b) => a.timestamp - b.timestamp); // Strict chronological order

  const isBull = analysis.direction === 'BULLISH';
  const target = analysis.targetPrice;
  const stop = analysis.stopLossPrice;
  const invalidation = analysis.invalidationPrice;
  const entry = analysis.entryPrice;

  let entryReached = Boolean(analysis.outcome?.entryReachedAt || currentStatus === 'ENTRY_REACHED');
  let entryReachedAt: Date | undefined = analysis.outcome?.entryReachedAt;

  let highestObserved = entry;
  let lowestObserved = entry;

  let shouldDispatchEntryAlert = false;

  // 2. Sequential Candle Evaluation
  for (const c of relevantCandles) {
    const candleTime = new Date(c.timestamp * 1000);

    // Step A: If not yet entered, verify if this candle touched entry
    if (!entryReached) {
      const touchedEntryInCandle = isBull ? c.low <= entry : c.high >= entry;
      if (touchedEntryInCandle) {
        entryReached = true;
        entryReachedAt = candleTime;
        analysis.outcome.entryReachedAt = candleTime;
        analysis.outcome.monitoringStatus = `Trade Active (Entry Reached at ${entry})`;

        if (!analysis.outcome.auditTrail.some(a => a.newStatus === 'ENTRY_REACHED')) {
          analysis.outcome.auditTrail.push({
            previousStatus: currentStatus,
            newStatus: 'ENTRY_REACHED',
            timestamp: candleTime,
            triggerPrice: entry,
            triggerReason: `Price reached designated entry price ${entry} at ${candleTime.toUTCString()}`,
            observedPrice: entry,
            marketDataTimestamp: c.timestamp,
          });
        }
        shouldDispatchEntryAlert = true;
      } else {
        // Pre-entry structural invalidation check
        const isPreEntryInvalidated = isBull ? c.close <= invalidation : c.close >= invalidation;
        if (isPreEntryInvalidated && invalidation !== stop) {
          analysis.outcome.status = 'INVALIDATED';
          analysis.outcome.resolvedAt = candleTime;
          analysis.outcome.completedAt = candleTime;
          analysis.outcome.triggerPrice = invalidation;
          analysis.outcome.observedPrice = c.close;
          analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
          analysis.outcome.triggerReason = `Structural invalidation before entry: Price closed beyond invalidation level ${invalidation}`;
          analysis.outcome.monitoringStatus = 'Resolved: Invalidated';
          analysis.outcome.auditTrail.push({
            previousStatus: currentStatus,
            newStatus: 'INVALIDATED',
            timestamp: candleTime,
            triggerPrice: invalidation,
            triggerReason: 'Structural invalidation condition breached before entry',
            observedPrice: c.close,
            marketDataTimestamp: c.timestamp,
          });
          await analysis.save();

          await telegramAlertDispatcher.dispatchLifecycleAlert(
            analysis.analysisId,
            analysis.symbol,
            'INVALIDATED',
            'SETUP INVALIDATED',
            '',
            c.close,
            analysis
          );
          return;
        }
        // Continue to next candle (still waiting for entry)
        continue;
      }
    }

    // Step B: Trade is in Active Market Execution (entryReached === true)
    if (c.high > highestObserved) highestObserved = c.high;
    if (c.low < lowestObserved) lowestObserved = c.low;

    // Check single-bar ambiguity (both target and stop crossed in same candle)
    const crossedTarget = isBull ? c.high >= target : c.low <= target;
    const crossedStop = isBull ? c.low <= stop : c.high >= stop;

    if (crossedTarget && crossedStop) {
      if (shouldDispatchEntryAlert) {
        await telegramAlertDispatcher.dispatchLifecycleAlert(
          analysis.analysisId,
          analysis.symbol,
          'ENTRY_TRIGGERED',
          'ENTRY REACHED',
          '',
          entry,
          analysis
        );
      }
      analysis.outcome.status = 'AMBIGUOUS';
      analysis.outcome.resolvedAt = candleTime;
      analysis.outcome.completedAt = candleTime;
      analysis.outcome.triggerPrice = currentPrice;
      analysis.outcome.triggerReason = 'Ambiguous resolution: Both target and stop reached in the same OHLC bar';
      analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.monitoringStatus = 'Resolved: Ambiguous Candle';
      analysis.outcome.auditTrail.push({
        previousStatus: 'ENTRY_REACHED',
        newStatus: 'AMBIGUOUS',
        timestamp: candleTime,
        triggerPrice: currentPrice,
        triggerReason: 'Same-bar dual breach',
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();
      return;
    }

    // Check Target Hit (Guaranteed to only execute AFTER entry was reached)
    if (crossedTarget) {
      if (shouldDispatchEntryAlert) {
        await telegramAlertDispatcher.dispatchLifecycleAlert(
          analysis.analysisId,
          analysis.symbol,
          'ENTRY_TRIGGERED',
          'ENTRY REACHED',
          '',
          entry,
          analysis
        );
      }
      const mfe = isBull ? (highestObserved - entry) : (entry - lowestObserved);
      analysis.outcome.status = 'TARGET_HIT';
      analysis.outcome.resolvedAt = candleTime;
      analysis.outcome.completedAt = candleTime;
      analysis.outcome.targetHitAt = candleTime;
      analysis.outcome.triggerPrice = target;
      analysis.outcome.observedPrice = currentPrice;
      analysis.outcome.maxFavorableExcursion = Number(mfe.toFixed(5));
      analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.triggerReason = `Target price of ${target} successfully reached`;
      analysis.outcome.monitoringStatus = 'Resolved: Target Hit';
      analysis.outcome.auditTrail.push({
        previousStatus: 'ENTRY_REACHED',
        newStatus: 'TARGET_HIT',
        timestamp: candleTime,
        triggerPrice: target,
        triggerReason: `Target price reached at ${candleTime.toUTCString()}`,
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'TP_HIT',
        'TARGET REACHED',
        '',
        currentPrice,
        analysis
      );
      return;
    }

    // Check Stopped Out (Guaranteed to only execute AFTER entry was reached)
    if (crossedStop) {
      if (shouldDispatchEntryAlert) {
        await telegramAlertDispatcher.dispatchLifecycleAlert(
          analysis.analysisId,
          analysis.symbol,
          'ENTRY_TRIGGERED',
          'ENTRY REACHED',
          '',
          entry,
          analysis
        );
      }
      const mae = isBull ? (entry - lowestObserved) : (highestObserved - entry);
      analysis.outcome.status = 'STOPPED_OUT';
      analysis.outcome.resolvedAt = candleTime;
      analysis.outcome.completedAt = candleTime;
      analysis.outcome.stoppedOutAt = candleTime;
      analysis.outcome.triggerPrice = stop;
      analysis.outcome.observedPrice = currentPrice;
      analysis.outcome.maxAdverseExcursion = Number(mae.toFixed(5));
      analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.triggerReason = `Stop loss price of ${stop} triggered`;
      analysis.outcome.monitoringStatus = 'Resolved: Stopped Out';
      analysis.outcome.auditTrail.push({
        previousStatus: 'ENTRY_REACHED',
        newStatus: 'STOPPED_OUT',
        timestamp: candleTime,
        triggerPrice: stop,
        triggerReason: `Stop loss hit at ${candleTime.toUTCString()}`,
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'SL_HIT',
        'STOP LOSS TRIGGERED',
        '',
        currentPrice,
        analysis
      );
      return;
    }
  }

  // 3. Real-Time Tick Check (If no candle triggered a terminal status)
  if (!entryReached) {
    const liveTouchedEntry = isBull ? currentPrice <= entry : currentPrice >= entry;
    if (liveTouchedEntry) {
      entryReached = true;
      entryReachedAt = now;
      analysis.outcome.entryReachedAt = now;
      analysis.outcome.status = 'ENTRY_REACHED';
      analysis.outcome.monitoringStatus = `Trade Active (Entry Reached at ${entry})`;
      if (!analysis.outcome.auditTrail.some(a => a.newStatus === 'ENTRY_REACHED')) {
        analysis.outcome.auditTrail.push({
          previousStatus: currentStatus,
          newStatus: 'ENTRY_REACHED',
          timestamp: now,
          triggerPrice: entry,
          triggerReason: `Live market price ${currentPrice} reached designated entry price ${entry}`,
          observedPrice: currentPrice,
        });
      }
      await analysis.save();
      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'ENTRY_TRIGGERED',
        'ENTRY REACHED',
        '',
        currentPrice,
        analysis
      );
      return;
    }
  }

  // If entry reached and trade is still active
  if (entryReached) {
    analysis.outcome.status = 'ENTRY_REACHED';
    analysis.outcome.monitoringStatus = `Trade Active (Live Price: ${currentPrice})`;
    analysis.outcome.observedPrice = currentPrice;
    analysis.outcome.lastMonitoredAt = now;
    await analysis.save();
    return;
  }

  // Otherwise still waiting for entry
  analysis.outcome.status = 'WAITING_FOR_ENTRY';
  analysis.outcome.monitoringStatus = `Waiting for Entry (Live Price: ${currentPrice})`;
  analysis.outcome.observedPrice = currentPrice;
  analysis.outcome.lastMonitoredAt = now;
  await analysis.save();
}

/**
 * Main polling iteration over all active & pending analyses
 */
export async function runMonitoringCycle(): Promise<void> {
  if (isMonitoringRunning) return;
  isMonitoringRunning = true;

  try {
    monitorHealth.lastEvaluationTimestamp = new Date().toISOString();
    const activeAnalyses = await Analysis.find({
      'outcome.status': { $in: ['OPEN', 'WAITING_FOR_ENTRY', 'ENTRY_REACHED', 'MONITORING_PAUSED'] },
    }).limit(100);

    monitorHealth.activeAnalysesCount = activeAnalyses.length;

    for (const analysis of activeAnalyses) {
      await evaluateSingleAnalysis(analysis);
    }
  } catch (err) {
    console.error('[OutcomeMonitor] Cycle error:', err);
  } finally {
    isMonitoringRunning = false;
  }
}

export function startOutcomeMonitor(intervalMs = 20000): void {
  if (monitorInterval) return;
  monitorHealth.isMonitorRunning = true;
  console.log(`[OutcomeMonitor] Background Lifecycle Worker initialized (interval: ${intervalMs / 1000}s)`);
  setTimeout(runMonitoringCycle, 4000);
  monitorInterval = setInterval(runMonitoringCycle, intervalMs);
}

export function stopOutcomeMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    monitorHealth.isMonitorRunning = false;
    console.log('[OutcomeMonitor] Background Lifecycle Worker stopped');
  }
}
