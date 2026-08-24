/**
 * Deterministic SMC Analysis Outcome Monitor & Lifecycle State Machine
 * 
 * Strict Finite State Machine:
 * 
 *                   [ NEW SMC SETUP ]
 *                           │
 *                           ▼
 *                  [ WAITING_FOR_ENTRY ]
 *                    (Approaching Sub-state)
 *                           │
 *           ┌───────────────┴───────────────┐
 *           │                               │
 *  Structural Invalidation             Executable Entry Touched
 *  BEFORE Entry Reached                (Ask for Long, Bid for Short)
 *           │                               │
 *           ▼                               ▼
 *    [ INVALIDATED ]                [ ENTRY_REACHED ] (ACTIVE TRADE)
 *   (TERMINAL STATE)                        │
 *                               ┌───────────┴───────────┐
 *                               │                       │
 *                           Take Profit             Stop Loss
 *                           (Bid for Long,          (Bid for Long,
 *                            Ask for Short)          Ask for Short)
 *                               │                       │
 *                               ▼                       ▼
 *                        [ TARGET_HIT ]          [ STOPPED_OUT ]
 *                       (TERMINAL STATE)        (TERMINAL STATE)
 * 
 * INVARIANT RULES:
 * 1. Invalidation has absolute priority over Entry.
 * 2. An invalidated setup is terminal — it NEVER transitions to Entry Reached or Active.
 * 3. Pre-entry breach is labeled INVALIDATED; Post-entry breach is labeled STOPPED_OUT.
 * 4. Same-candle entry & invalidation conflicts are resolved without fabrication (marked AMBIGUOUS).
 * 5. Expired setups are transitioned to INVALIDATED with reason "SETUP_EXPIRED".
 * 6. Idempotent: repeated evaluation cycles on identical market states yield identical results.
 */

import { Analysis, IAnalysis } from '../models/Analysis';
import { getInstrumentMapping } from '../config/instrumentRegistry';
import { getAuthoritativeCandles, getAuthoritativeQuote } from './marketDataService';
import { telegramAlertDispatcher } from './telegramAlertDispatcher';

export interface MonitorHealthStatus {
  isMonitorRunning: boolean;
  lastEvaluationTimestamp: string | null;
  activeAnalysesCount: number;
}

export const TERMINAL_STATUSES = new Set<string>([
  'TARGET_HIT',
  'STOPPED_OUT',
  'INVALIDATED',
  'EXPIRED',
  'AMBIGUOUS',
]);

let monitorInterval: NodeJS.Timeout | null = null;
let isMonitoringRunning = false;

export const monitorHealth: MonitorHealthStatus = {
  isMonitorRunning: false,
  lastEvaluationTimestamp: null,
  activeAnalysesCount: 0,
};

export function getProximityThreshold(instrumentId: string, entryPrice: number): number {
  const inst = instrumentId.replace(/[\/\-_]/g, '').toUpperCase();
  if (inst.includes('JPY')) return 0.05; // 5 pips on JPY
  if (inst === 'EURUSD' || inst === 'GBPUSD') return 0.0005; // 5 pips on Forex
  if (inst === 'XAUUSD') return 2.0; // $2.00 on Gold
  if (inst.includes('USDT') || inst.includes('BTC')) return entryPrice * 0.0025; // 0.25% on Crypto
  if (inst === 'US500') return 8.0; // 8 pts on S&P 500
  if (inst === 'NAS100') return 30.0; // 30 pts on Nasdaq 100
  return entryPrice * 0.002;
}

export async function evaluateSingleAnalysis(analysis: IAnalysis): Promise<void> {
  // 1. Guard against already-terminal setups
  if (TERMINAL_STATUSES.has(analysis.outcome.status)) {
    return;
  }

  let latestCandles: any[] | null = null;
  let quote: any = null;

  try {
    const [data, authQuote] = await Promise.all([
      getAuthoritativeCandles(analysis.instrumentId, analysis.timeframe, 60),
      getAuthoritativeQuote(analysis.instrumentId),
    ]);

    latestCandles = data?.candles || null;
    quote = authQuote;
  } catch (err) {
    console.warn(`[OutcomeMonitor] Feed fetch failed for ${analysis.symbol}:`, err);
  }

  const now = new Date();

  // If market data is unreachable: pause monitoring
  if (!latestCandles || latestCandles.length === 0 || !quote || typeof quote.price !== 'number') {
    analysis.outcome.monitoringStatus = 'Monitoring Paused — Market Data Feed Offline';
    analysis.outcome.lastMonitoredAt = now;
    await analysis.save();
    return;
  }

  await evaluateAnalysisOutcome(analysis, latestCandles, quote);
}

export async function evaluateAnalysisOutcome(
  analysis: IAnalysis,
  latestCandles: any[],
  quote: { price: number; bid?: number; ask?: number; providerTimestamp?: number }
): Promise<void> {
  const currentStatus = analysis.outcome.status;

  // 1. TERMINAL STATE GUARD: Never process or overwrite an already-terminal setup
  if (TERMINAL_STATUSES.has(currentStatus)) {
    return;
  }

  const now = new Date();
  const currentPrice = quote.price;
  const currentBid = typeof quote.bid === 'number' ? quote.bid : currentPrice;
  const currentAsk = typeof quote.ask === 'number' ? quote.ask : currentPrice;

  const isBull = analysis.direction === 'BULLISH';
  const entry = analysis.entryPrice;
  const target = analysis.targetPrice;
  const stop = analysis.stopLossPrice;
  const invalidation = analysis.invalidationPrice || stop;

  // 2. CHECK EXPIRATION / STALENESS (Default 72h or configured expiresAt)
  const expirationThreshold = analysis.expiresAt || new Date(analysis.savedAt.getTime() + 72 * 3600 * 1000);
  if (now > expirationThreshold) {
    analysis.outcome.status = 'INVALIDATED';
    analysis.outcome.invalidatedReason = 'SETUP_EXPIRED: Structural validity window elapsed before entry was reached';
    analysis.outcome.resolvedAt = now;
    analysis.outcome.completedAt = now;
    analysis.outcome.observedPrice = currentPrice;
    analysis.outcome.triggerPrice = currentPrice;
    analysis.outcome.triggerReason = 'Setup expired after validity window without reaching entry';
    analysis.outcome.monitoringStatus = 'Resolved: Setup Expired (Invalidated)';
    analysis.outcome.auditTrail.push({
      previousStatus: currentStatus,
      newStatus: 'INVALIDATED',
      timestamp: now,
      triggerReason: 'Validity window elapsed before entry reached (SETUP_EXPIRED)',
      observedPrice: currentPrice,
    });
    await analysis.save();

    await telegramAlertDispatcher.dispatchLifecycleAlert(
      analysis.analysisId,
      analysis.symbol,
      'INVALIDATED',
      'SETUP EXPIRED',
      'Structural validity window elapsed before entry was reached.',
      currentPrice,
      analysis
    );
    return;
  }

  const savedTsSeconds = Math.floor(analysis.savedAt.getTime() / 1000);
  const relevantCandles = latestCandles
    .filter(c => c.timestamp >= savedTsSeconds)
    .sort((a, b) => a.timestamp - b.timestamp); // Strict ascending chronological order

  let entryReached = Boolean(analysis.outcome?.entryReachedAt || currentStatus === 'ENTRY_REACHED');
  let highestObserved = entry;
  let lowestObserved = entry;

  // ──────────────────────────────────────────────────────────────────────────
  // 3. HISTORICAL CANDLE-BY-CANDLE EVALUATION
  // ──────────────────────────────────────────────────────────────────────────
  for (const c of relevantCandles) {
    const candleTime = new Date(c.timestamp * 1000);

    // ── PHASE 1: PRE-ENTRY MONITORING (Waiting for Entry) ───────────────────
    if (!entryReached) {
      const candleInvalidated = isBull ? (c.low <= invalidation || c.close <= invalidation) : (c.high >= invalidation || c.close >= invalidation);
      const candleTouchedEntry = isBull ? c.low <= entry : c.high >= entry;

      // RULE 6 & 7: Invalidation has priority; handle same-candle conflict
      if (candleInvalidated && candleTouchedEntry) {
        // Same candle touched both Entry and Invalidation
        // Check candle open to see if it opened beyond invalidation
        const openedBeyondInvalidation = isBull ? c.open <= invalidation : c.open >= invalidation;

        if (openedBeyondInvalidation) {
          analysis.outcome.status = 'INVALIDATED';
          analysis.outcome.invalidatedReason = `Structural ${isBull ? 'support' : 'resistance'} invalidation breached at bar open (${c.open})`;
          analysis.outcome.resolvedAt = candleTime;
          analysis.outcome.completedAt = candleTime;
          analysis.outcome.triggerPrice = invalidation;
          analysis.outcome.observedPrice = c.open;
          analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
          analysis.outcome.monitoringStatus = 'Resolved: Invalidated';
          analysis.outcome.auditTrail.push({
            previousStatus: currentStatus,
            newStatus: 'INVALIDATED',
            timestamp: candleTime,
            triggerPrice: invalidation,
            triggerReason: `Candle opened beyond structural invalidation level ${invalidation}`,
            observedPrice: c.open,
            marketDataTimestamp: c.timestamp,
          });
          await analysis.save();

          await telegramAlertDispatcher.dispatchLifecycleAlert(
            analysis.analysisId,
            analysis.symbol,
            'INVALIDATED',
            'SETUP INVALIDATED',
            `Candle opened beyond structural invalidation level (${invalidation}).`,
            c.open,
            analysis
          );
          return;
        }

        // Otherwise: ambiguous sequence within bar -> Mark AMBIGUOUS, never falsely claim entry
        analysis.outcome.status = 'AMBIGUOUS';
        analysis.outcome.resolvedAt = candleTime;
        analysis.outcome.completedAt = candleTime;
        analysis.outcome.triggerPrice = invalidation;
        analysis.outcome.observedPrice = c.close;
        analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
        analysis.outcome.triggerReason = 'Ambiguous resolution: Both entry and invalidation touched in the same OHLC bar';
        analysis.outcome.monitoringStatus = 'Resolved: Ambiguous Candle Conflict';
        analysis.outcome.auditTrail.push({
          previousStatus: currentStatus,
          newStatus: 'AMBIGUOUS',
          timestamp: candleTime,
          triggerPrice: invalidation,
          triggerReason: 'Both entry and invalidation touched in the same OHLC bar without sub-bar sequence confirmation',
          observedPrice: c.close,
          marketDataTimestamp: c.timestamp,
        });
        await analysis.save();
        return;
      }

      // PRIORITY 1: Invalidation occurred BEFORE entry
      if (candleInvalidated) {
        const invalidReason = `Structural ${isBull ? 'demand/low' : 'supply/high'} invalidation (${invalidation}) breached before entry reached`;
        analysis.outcome.status = 'INVALIDATED';
        analysis.outcome.invalidatedReason = invalidReason;
        analysis.outcome.resolvedAt = candleTime;
        analysis.outcome.completedAt = candleTime;
        analysis.outcome.triggerPrice = invalidation;
        analysis.outcome.observedPrice = isBull ? c.low : c.high;
        analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
        analysis.outcome.triggerReason = invalidReason;
        analysis.outcome.monitoringStatus = 'Resolved: Invalidated';
        analysis.outcome.auditTrail.push({
          previousStatus: currentStatus,
          newStatus: 'INVALIDATED',
          timestamp: candleTime,
          triggerPrice: invalidation,
          triggerReason: invalidReason,
          observedPrice: isBull ? c.low : c.high,
          marketDataTimestamp: c.timestamp,
        });
        await analysis.save();

        await telegramAlertDispatcher.dispatchLifecycleAlert(
          analysis.analysisId,
          analysis.symbol,
          'INVALIDATED',
          'SETUP INVALIDATED',
          invalidReason,
          isBull ? c.low : c.high,
          analysis
        );
        return;
      }

      // PRIORITY 2: Entry touched (and NOT invalidated)
      if (candleTouchedEntry) {
        entryReached = true;
        analysis.outcome.entryReachedAt = candleTime;
        analysis.outcome.status = 'ENTRY_REACHED';
        analysis.outcome.isApproachingEntry = false;
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

        if (!analysis.outcome.entryTriggeredNotified) {
          analysis.outcome.entryTriggeredNotified = true;
          await telegramAlertDispatcher.dispatchLifecycleAlert(
            analysis.analysisId,
            analysis.symbol,
            'ENTRY_TRIGGERED',
            'ENTRY REACHED',
            `Price reached structural entry zone at ${entry}. Position is now ACTIVE.`,
            entry,
            analysis
          );
        }
      } else {
        // Still waiting for entry in this candle
        continue;
      }
    }

    // ── PHASE 2: POST-ENTRY MONITORING (Active Trade) ───────────────────────
    if (c.high > highestObserved) highestObserved = c.high;
    if (c.low < lowestObserved) lowestObserved = c.low;

    const crossedTarget = isBull ? c.high >= target : c.low <= target;
    const crossedStop = isBull ? c.low <= stop : c.high >= stop;

    // Same-bar dual breach after entry
    if (crossedTarget && crossedStop) {
      analysis.outcome.status = 'AMBIGUOUS';
      analysis.outcome.resolvedAt = candleTime;
      analysis.outcome.completedAt = candleTime;
      analysis.outcome.triggerPrice = currentPrice;
      analysis.outcome.triggerReason = 'Ambiguous resolution: Both target and stop reached in the same active OHLC bar';
      analysis.outcome.timeToResolutionMinutes = Math.round((candleTime.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.monitoringStatus = 'Resolved: Ambiguous Candle';
      analysis.outcome.auditTrail.push({
        previousStatus: 'ENTRY_REACHED',
        newStatus: 'AMBIGUOUS',
        timestamp: candleTime,
        triggerPrice: currentPrice,
        triggerReason: 'Both target and stop reached in the same OHLC bar',
        observedPrice: currentPrice,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();
      return;
    }

    // Target Hit
    if (crossedTarget) {
      const mfe = isBull ? (highestObserved - entry) : (entry - lowestObserved);
      analysis.outcome.status = 'TARGET_HIT';
      analysis.outcome.resolvedAt = candleTime;
      analysis.outcome.completedAt = candleTime;
      analysis.outcome.targetHitAt = candleTime;
      analysis.outcome.triggerPrice = target;
      analysis.outcome.observedPrice = target;
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
        observedPrice: target,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'TP_HIT',
        'TARGET REACHED',
        `Take Profit target ${target} hit with +${(analysis.riskRewardRatio || 2).toFixed(1)}R return.`,
        target,
        analysis
      );
      return;
    }

    // Stopped Out (Post-Entry)
    if (crossedStop) {
      const mae = isBull ? (entry - lowestObserved) : (highestObserved - entry);
      analysis.outcome.status = 'STOPPED_OUT';
      analysis.outcome.resolvedAt = candleTime;
      analysis.outcome.completedAt = candleTime;
      analysis.outcome.stoppedOutAt = candleTime;
      analysis.outcome.triggerPrice = stop;
      analysis.outcome.observedPrice = stop;
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
        observedPrice: stop,
        marketDataTimestamp: c.timestamp,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'SL_HIT',
        'STOP LOSS TRIGGERED',
        `Stop loss level ${stop} triggered. Trade closed at -1.0R.`,
        stop,
        analysis
      );
      return;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. REAL-TIME TICK EVALUATION (Using Executable Bid/Ask)
  // ──────────────────────────────────────────────────────────────────────────

  // ── TICK PRE-ENTRY EVALUATION ───────────────────────────────────────────
  if (!entryReached) {
    // Executable Price Definitions:
    // Long: Invalidation hits Bid; Entry triggers at Ask
    // Short: Invalidation hits Ask; Entry triggers at Bid
    const liveInvalidationPrice = isBull ? currentBid : currentAsk;
    const liveEntryPrice = isBull ? currentAsk : currentBid;

    const isLiveInvalidated = isBull ? liveInvalidationPrice <= invalidation : liveInvalidationPrice >= invalidation;
    const isLiveEntryReached = isBull ? liveEntryPrice <= entry : liveEntryPrice >= entry;

    // RULE 6: Invalidation evaluated FIRST
    if (isLiveInvalidated) {
      const invalidReason = `Structural invalidation level (${invalidation}) breached in real-time (${isBull ? 'Bid' : 'Ask'}: ${liveInvalidationPrice}) before entry reached`;
      analysis.outcome.status = 'INVALIDATED';
      analysis.outcome.invalidatedReason = invalidReason;
      analysis.outcome.resolvedAt = now;
      analysis.outcome.completedAt = now;
      analysis.outcome.triggerPrice = invalidation;
      analysis.outcome.observedPrice = liveInvalidationPrice;
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.triggerReason = invalidReason;
      analysis.outcome.monitoringStatus = 'Resolved: Invalidated';
      analysis.outcome.auditTrail.push({
        previousStatus: currentStatus,
        newStatus: 'INVALIDATED',
        timestamp: now,
        triggerPrice: invalidation,
        triggerReason: invalidReason,
        observedPrice: liveInvalidationPrice,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'INVALIDATED',
        'SETUP INVALIDATED',
        invalidReason,
        liveInvalidationPrice,
        analysis
      );
      return;
    }

    // If NOT invalidated, evaluate live entry trigger
    if (isLiveEntryReached) {
      entryReached = true;
      analysis.outcome.entryReachedAt = now;
      analysis.outcome.status = 'ENTRY_REACHED';
      analysis.outcome.isApproachingEntry = false;
      analysis.outcome.monitoringStatus = `Trade Active (Entry Reached at ${entry} via ${isBull ? 'Ask' : 'Bid'}: ${liveEntryPrice})`;

      if (!analysis.outcome.auditTrail.some(a => a.newStatus === 'ENTRY_REACHED')) {
        analysis.outcome.auditTrail.push({
          previousStatus: currentStatus,
          newStatus: 'ENTRY_REACHED',
          timestamp: now,
          triggerPrice: entry,
          triggerReason: `Executable ${isBull ? 'Ask' : 'Bid'} price ${liveEntryPrice} reached designated entry price ${entry}`,
          observedPrice: liveEntryPrice,
        });
      }

      if (!analysis.outcome.entryTriggeredNotified) {
        analysis.outcome.entryTriggeredNotified = true;
        await telegramAlertDispatcher.dispatchLifecycleAlert(
          analysis.analysisId,
          analysis.symbol,
          'ENTRY_TRIGGERED',
          'ENTRY REACHED',
          `Price reached structural entry zone at ${entry}. Position is now ACTIVE.`,
          liveEntryPrice,
          analysis
        );
      }

      await analysis.save();
      return;
    }

    // Check Proximity / Approaching Entry State
    const proximityThreshold = getProximityThreshold(analysis.instrumentId || analysis.symbol, entry);
    const distanceToEntry = Math.abs(liveEntryPrice - entry);
    const isApproaching = distanceToEntry <= proximityThreshold;

    if (isApproaching) {
      analysis.outcome.isApproachingEntry = true;
      const mapping = getInstrumentMapping(analysis.instrumentId);
      const pipMultiplier = mapping?.pipSize ? (1 / mapping.pipSize) : 10000;
      const distanceFormatted = (distanceToEntry * pipMultiplier).toFixed(1);
      analysis.outcome.monitoringStatus = `Approaching Entry (${distanceFormatted} ${mapping?.assetClass === 'forex' ? 'pips' : 'pts'} away)`;

      // Dispatch single, deduplicated ENTRY_APPROACHING Telegram notification
      if (!analysis.outcome.entryApproachingNotified) {
        analysis.outcome.entryApproachingNotified = true;
        analysis.outcome.auditTrail.push({
          previousStatus: currentStatus,
          newStatus: 'APPROACHING_ENTRY',
          timestamp: now,
          triggerPrice: currentPrice,
          triggerReason: `Price is ${distanceFormatted} ${mapping?.assetClass === 'forex' ? 'pips' : 'pts'} from designated entry (${entry})`,
          observedPrice: currentPrice,
        });

        await telegramAlertDispatcher.dispatchLifecycleAlert(
          analysis.analysisId,
          analysis.symbol,
          'ENTRY_APPROACHING',
          'ENTRY APPROACHING',
          `Price is within ${distanceFormatted} ${mapping?.assetClass === 'forex' ? 'pips' : 'pts'} of entry zone (${entry}).`,
          currentPrice,
          analysis
        );
      }
    } else {
      analysis.outcome.isApproachingEntry = false;
      analysis.outcome.monitoringStatus = `Waiting for Entry (Live Price: ${currentPrice})`;
    }

    analysis.outcome.status = 'WAITING_FOR_ENTRY';
    analysis.outcome.observedPrice = currentPrice;
    analysis.outcome.lastMonitoredAt = now;
    await analysis.save();
    return;
  }

  // ── TICK POST-ENTRY EVALUATION (Active Trade TP/SL) ──────────────────────
  if (entryReached) {
    // Bullish positions exit at BID; Bearish positions exit at ASK
    const exitPrice = isBull ? currentBid : currentAsk;
    const isLiveTargetHit = isBull ? currentBid >= target : currentAsk <= target;
    const isLiveStopHit = isBull ? currentBid <= stop : currentAsk >= stop;

    if (isLiveTargetHit) {
      const mfe = isBull ? (exitPrice - entry) : (entry - exitPrice);
      analysis.outcome.status = 'TARGET_HIT';
      analysis.outcome.resolvedAt = now;
      analysis.outcome.completedAt = now;
      analysis.outcome.targetHitAt = now;
      analysis.outcome.triggerPrice = target;
      analysis.outcome.observedPrice = exitPrice;
      analysis.outcome.maxFavorableExcursion = Number(mfe.toFixed(5));
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.monitoringStatus = `Resolved: Target Hit via ${isBull ? 'Bid' : 'Ask'} at ${exitPrice}`;
      analysis.outcome.auditTrail.push({
        previousStatus: 'ENTRY_REACHED',
        newStatus: 'TARGET_HIT',
        timestamp: now,
        triggerPrice: target,
        triggerReason: `Real-time ${isBull ? 'Bid' : 'Ask'} ${exitPrice} crossed Target ${target}`,
        observedPrice: exitPrice,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'TP_HIT',
        'TARGET REACHED',
        `Take Profit target ${target} hit with +${(analysis.riskRewardRatio || 2).toFixed(1)}R return.`,
        exitPrice,
        analysis
      );
      return;
    }

    if (isLiveStopHit) {
      const mae = isBull ? (entry - exitPrice) : (exitPrice - entry);
      analysis.outcome.status = 'STOPPED_OUT';
      analysis.outcome.resolvedAt = now;
      analysis.outcome.completedAt = now;
      analysis.outcome.stoppedOutAt = now;
      analysis.outcome.triggerPrice = stop;
      analysis.outcome.observedPrice = exitPrice;
      analysis.outcome.maxAdverseExcursion = Number(mae.toFixed(5));
      analysis.outcome.timeToResolutionMinutes = Math.round((now.getTime() - analysis.savedAt.getTime()) / 60000);
      analysis.outcome.monitoringStatus = `Resolved: Stopped Out via ${isBull ? 'Bid' : 'Ask'} at ${exitPrice}`;
      analysis.outcome.auditTrail.push({
        previousStatus: 'ENTRY_REACHED',
        newStatus: 'STOPPED_OUT',
        timestamp: now,
        triggerPrice: stop,
        triggerReason: `Real-time ${isBull ? 'Bid' : 'Ask'} ${exitPrice} crossed Stop Loss ${stop}`,
        observedPrice: exitPrice,
      });
      await analysis.save();

      await telegramAlertDispatcher.dispatchLifecycleAlert(
        analysis.analysisId,
        analysis.symbol,
        'SL_HIT',
        'STOP LOSS TRIGGERED',
        `Stop loss level ${stop} triggered. Trade closed at -1.0R.`,
        exitPrice,
        analysis
      );
      return;
    }

    // If still active and neither TP nor SL hit
    analysis.outcome.status = 'ENTRY_REACHED';
    analysis.outcome.isApproachingEntry = false;
    analysis.outcome.monitoringStatus = `Trade Active (Live Mid: ${currentPrice} | Bid: ${currentBid} | Ask: ${currentAsk})`;
    analysis.outcome.observedPrice = currentPrice;
    analysis.outcome.lastMonitoredAt = now;
    await analysis.save();
    return;
  }
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
      'outcome.status': { $in: ['OPEN', 'WAITING_FOR_ENTRY', 'APPROACHING_ENTRY', 'ENTRY_REACHED', 'MONITORING_PAUSED'] },
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
