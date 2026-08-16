/**
 * Automated Background Analysis Outcome Monitor & Lifecycle Alert Engine
 * Continuously evaluates all OPEN analyses against real-time market data ticks & historical bars.
 * Executes automatic status transitions and dispatches Telegram lifecycle updates:
 * (ENTRY_APPROACHING -> ENTRY_TRIGGERED -> TARGET_HIT / STOPPED_OUT / INVALIDATED / EXPIRED).
 */

import { Analysis, IAnalysis } from '../models/Analysis';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
import { getInstrumentMapping } from '../config/instrumentRegistry';
import { fetchBinanceCandles, fetchBinanceBookQuote } from './binanceService';
import { fetchYahooCandles } from './yahooMarketService';
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
      const result = await fetchYahooCandles(yahooSymbol, analysis.timeframe, 50);
      if (result) {
        latestCandles = result.candles;
        currentPrice = result.quote.price;
      }
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
      '⏱️ SMC SETUP EXPIRED',
      `Setup monitoring window reached 72 hours without resolution.\n` +
      `• <b>Final Observed Price:</b> <code>${currentPrice}</code>\n` +
      `• <b>Status:</b> Closed`,
      currentPrice
    );
    return;
  }

  const savedTsSeconds = Math.floor(analysis.savedAt.getTime() / 1000);
  const relevantCandles = latestCandles.filter(c => c.timestamp >= savedTsSeconds);

  const isBull = analysis.direction === 'BULLISH';
  const target = analysis.targetPrice;
  const stop = analysis.stopLossPrice;
  const invalidation = analysis.invalidationPrice;
  const entry = analysis.entryPrice;

  // 2. Lifecycle State: ENTRY_APPROACHING & ENTRY_TRIGGERED Checks
  const distanceToEntry = Math.abs(currentPrice - entry) / entry;
  const isApproaching = distanceToEntry <= 0.0025; // within 0.25% of entry
  const hasTriggeredEntry = isBull ? currentPrice <= entry : currentPrice >= entry;

  // Dispatch ENTRY_APPROACHING if close and not already triggered
  if (isApproaching && !hasTriggeredEntry) {
    const alreadySentApproaching = await TelegramAlertLog.findOne({
      setupId: analysis.analysisId,
      alertType: 'ENTRY_APPROACHING',
    });
    if (!alreadySentApproaching) {
      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'ENTRY_APPROACHING',
        '⚠️ ENTRY ZONE APPROACHING',
        `Price is approaching the designated SMC entry zone.\n` +
        `• <b>Target Entry Zone:</b> <code>${entry}</code>\n` +
        `• <b>Current Price:</b> <code>${currentPrice}</code>\n` +
        `• <b>Distance:</b> ${(distanceToEntry * 100).toFixed(2)}%`,
        currentPrice
      );
    }
  }

  // Dispatch ENTRY_TRIGGERED when entry zone is tested
  if (hasTriggeredEntry) {
    const alreadySentTriggered = await TelegramAlertLog.findOne({
      setupId: analysis.analysisId,
      alertType: 'ENTRY_TRIGGERED',
    });
    if (!alreadySentTriggered) {
      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'ENTRY_TRIGGERED',
        '🟢 ENTRY CONDITION TRIGGERED',
        `Price has entered the designated SMC entry zone.\n` +
        `• <b>Entry Zone Tested:</b> <code>${entry}</code>\n` +
        `• <b>Stop Loss:</b> <code>${stop}</code>\n` +
        `• <b>Target:</b> <code>${target}</code> (<b>${analysis.riskRewardRatio}R</b>)\n` +
        `• <b>Status:</b> Active In-Trade Retracement`,
        currentPrice
      );
    }
  }

  // 3. Excursions & Target / Stop / Invalidation Resolution
  let highestObserved = isBull ? entry : entry;
  let lowestObserved = isBull ? entry : entry;

  for (const c of relevantCandles) {
    if (c.high > highestObserved) highestObserved = c.high;
    if (c.low < lowestObserved) lowestObserved = c.low;

    // Check single-bar ambiguity (both target and stop crossed in same candle)
    const crossedTarget = isBull ? c.high >= target : c.low <= target;
    const crossedStop = isBull ? c.low <= stop : c.high >= stop;

    if (crossedTarget && crossedStop) {
      const prev = analysis.outcome.status;
      analysis.outcome.status = 'AMBIGUOUS';
      analysis.outcome.resolvedAt = now;
      analysis.outcome.triggerPrice = currentPrice;
      analysis.outcome.triggerReason = 'Ambiguous resolution: Both target and stop reached in the same OHLC bar';
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.monitoringStatus = 'Resolved: Ambiguous Candle';
      analysis.outcome.auditTrail.push({
        previousStatus: prev,
        newStatus: 'AMBIGUOUS',
        timestamp: now,
        triggerPrice: currentPrice,
        triggerReason: 'Same-bar dual breach',
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();
      return;
    }

    // Check Target Hit
    if (crossedTarget) {
      const prev = analysis.outcome.status;
      const mfe = isBull ? (highestObserved - entry) : (entry - lowestObserved);
      analysis.outcome.status = 'TARGET_HIT';
      analysis.outcome.resolvedAt = now;
      analysis.outcome.triggerPrice = target;
      analysis.outcome.observedPrice = currentPrice;
      analysis.outcome.maxFavorableExcursion = Number(mfe.toFixed(5));
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.triggerReason = `Target price of ${target} successfully reached`;
      analysis.outcome.monitoringStatus = 'Resolved: Target Hit';
      analysis.outcome.auditTrail.push({
        previousStatus: prev,
        newStatus: 'TARGET_HIT',
        timestamp: now,
        triggerPrice: target,
        triggerReason: `Target price reached at ${new Date(c.timestamp * 1000).toUTCString()}`,
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      // Dispatch Telegram Alert
      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'TP_HIT',
        '🎯 TAKE PROFIT TARGET REACHED',
        `Target price of <b>${target}</b> successfully reached!\n` +
        `• <b>Max Favorable Excursion (MFE):</b> +${mfe.toFixed(4)}\n` +
        `• <b>Resolution Time:</b> ${analysis.outcome.timeToResolutionMinutes} mins\n` +
        `• <b>Status:</b> Completed (${analysis.riskRewardRatio}R Realized)`,
        currentPrice
      );
      return;
    }

    // Check Stopped Out
    if (crossedStop) {
      const prev = analysis.outcome.status;
      const mae = isBull ? (entry - lowestObserved) : (highestObserved - entry);
      analysis.outcome.status = 'STOPPED_OUT';
      analysis.outcome.resolvedAt = now;
      analysis.outcome.triggerPrice = stop;
      analysis.outcome.observedPrice = currentPrice;
      analysis.outcome.maxAdverseExcursion = Number(mae.toFixed(5));
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.triggerReason = `Stop loss price of ${stop} triggered`;
      analysis.outcome.monitoringStatus = 'Resolved: Stopped Out';
      analysis.outcome.auditTrail.push({
        previousStatus: prev,
        newStatus: 'STOPPED_OUT',
        timestamp: now,
        triggerPrice: stop,
        triggerReason: `Stop loss hit at ${new Date(c.timestamp * 1000).toUTCString()}`,
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      // Dispatch Telegram Alert
      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'SL_HIT',
        '🛑 STOP LOSS TRIGGERED',
        `Stop loss of <b>${stop}</b> reached.\n` +
        `• <b>Max Adverse Excursion (MAE):</b> -${mae.toFixed(4)}\n` +
        `• <b>Resolution Time:</b> ${analysis.outcome.timeToResolutionMinutes} mins\n` +
        `• <b>Outcome:</b> Stopped Out`,
        currentPrice
      );
      return;
    }

    // Check Structural Invalidation
    const isInvalidated = isBull ? c.close <= invalidation : c.close >= invalidation;
    if (isInvalidated && invalidation !== stop) {
      const prev = analysis.outcome.status;
      analysis.outcome.status = 'INVALIDATED';
      analysis.outcome.resolvedAt = now;
      analysis.outcome.triggerPrice = invalidation;
      analysis.outcome.observedPrice = currentPrice;
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.triggerReason = `Structural invalidation: Price closed beyond invalidation level ${invalidation}`;
      analysis.outcome.monitoringStatus = 'Resolved: Invalidated';
      analysis.outcome.auditTrail.push({
        previousStatus: prev,
        newStatus: 'INVALIDATED',
        timestamp: now,
        triggerPrice: invalidation,
        triggerReason: 'Structural invalidation condition breached',
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      // Dispatch Telegram Alert
      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'INVALIDATED',
        '⚠️ SMC SETUP INVALIDATED',
        `Structural Invalidation: Price confirmed close beyond <b>${invalidation}</b>.\n` +
        `• <b>Reason:</b> Structural invalidation condition breached\n` +
        `• <b>Monitoring:</b> Stopped`,
        currentPrice
      );
      return;
    }
  }

  // Still Open: Update excursions & live monitoring status
  const currentMfe = isBull ? (highestObserved - entry) : (entry - lowestObserved);
  const currentMae = isBull ? (entry - lowestObserved) : (highestObserved - entry);

  analysis.outcome.maxFavorableExcursion = Number(Math.max(0, currentMfe).toFixed(5));
  analysis.outcome.maxAdverseExcursion = Number(Math.max(0, currentMae).toFixed(5));
  analysis.outcome.lastMonitoredAt = now;
  analysis.outcome.observedPrice = currentPrice;
  analysis.outcome.monitoringStatus = `Active Monitoring (Live price: ${currentPrice})`;
  await analysis.save();
}

/**
 * Main polling iteration over all open analyses
 */
export async function runMonitoringCycle(): Promise<void> {
  if (isMonitoringRunning) return;
  isMonitoringRunning = true;

  try {
    monitorHealth.lastEvaluationTimestamp = new Date().toISOString();
    const openAnalyses = await Analysis.find({
      'outcome.status': { $in: ['OPEN', 'MONITORING_PAUSED'] },
    }).limit(50);

    monitorHealth.activeAnalysesCount = openAnalyses.length;

    for (const analysis of openAnalyses) {
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
