/**
 * Telegram Alert Formatter & Dispatcher
 * Formats deterministic SMC setup data and outcome lifecycle transitions into
 * high-impact, institutional Telegram alerts with deep-link inline buttons.
 * ZERO raw code, JSON objects, or debug artifacts exposed.
 */

import { config } from '../config/config';
import { TelegramUser } from '../models/TelegramUser';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
import { Analysis } from '../models/Analysis';
import { telegramBot, escapeHtml, InlineKeyboardButton } from './telegramBotService';
import { StructuredSMCAnalysis } from '../types/ai';
import { FullSMCPipelineResult } from '../engine';

export interface AlertDispatchParams {
  setupId: string;
  symbol: string;
  analysis: StructuredSMCAnalysis;
  pipeline: FullSMCPipelineResult;
  direction: 'BULLISH' | 'BEARISH';
  entryTop: number;
  entryBottom: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3?: number;
  invalidation: number;
  riskReward: number;
}

class TelegramAlertDispatcher {
  /**
   * Dispatches a NEW_SETUP alert to all active Telegram subscribers monitoring this symbol
   */
  public async dispatchNewSetupAlert(params: AlertDispatchParams): Promise<void> {
    const isBull = params.direction === 'BULLISH';
    const isForex = params.symbol.length === 6 && !params.symbol.includes('USDT');
    const decimals = isForex ? 5 : 2;

    const symClean = params.symbol.replace('/', '').toUpperCase();
    const users = await TelegramUser.find({
      isConnected: true,
      chatId: { $exists: true },
      'settings.isMuted': false,
      'settings.alertTypes.newSetup': true,
      watchlist: { $in: [symClean, params.symbol] },
    });

    if (users.length === 0) return;

    const grade = params.analysis.setupQuality.grade;
    const isHighGrade = grade === 'A+' || grade === 'A';

    const evidenceLines = params.analysis.structuralEvidence.bulletPoints.slice(0, 5)
      .map(pt => `• ${escapeHtml(pt)}`)
      .join('\n');

    const newsNote = escapeHtml(params.analysis.newsContext.riskWarning || 'No major conflicting high-impact event detected.');
    const sessionNote = escapeHtml(params.analysis.sessionContext.sessionNotes || 'Active Session');

    // Build Clean Formatted HTML Message (Zero raw JSON / code)
    const message = `🔥 <b>HIGH-QUALITY SMC SETUP</b>\n\n` +
      `<b>${escapeHtml(params.symbol)}</b> — Potential <b>${params.direction}</b> Scenario\n` +
      `<code>Setup ID: ${params.setupId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 <b>MARKET STRUCTURE</b>\n` +
      `• <b>HTF:</b> ${escapeHtml(params.analysis.marketOverview.htfBias)}\n` +
      `• <b>Intermediate:</b> ${escapeHtml(params.analysis.marketOverview.intermediateStructure)}\n` +
      `• <b>Lower TF:</b> ${escapeHtml(params.analysis.marketOverview.lowerTimeframeStatus)}\n\n` +
      `💧 <b>LIQUIDITY & DRAW</b>\n` +
      `• ${escapeHtml(params.analysis.liquidityMap.nextTargetSummary)}\n\n` +
      `🎯 <b>ENTRY ZONE:</b> <code>${params.entryBottom.toFixed(decimals)} — ${params.entryTop.toFixed(decimals)}</code>\n` +
      `🛑 <b>STOP LOSS:</b> <code>${params.stopLoss.toFixed(decimals)}</code>\n` +
      `🎯 <b>TAKE PROFIT (TP1):</b> <code>${params.target1.toFixed(decimals)}</code>\n` +
      (params.target2 ? `🎯 <b>TAKE PROFIT (TP2):</b> <code>${params.target2.toFixed(decimals)}</code>\n` : '') +
      `📐 <b>RISK : REWARD:</b> <code>1 : ${params.riskReward.toFixed(1)}R</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧠 <b>STRUCTURAL EVIDENCE</b>\n` +
      `${evidenceLines}\n\n` +
      `📰 <b>MACRO / NEWS:</b> <i>${newsNote}</i>\n` +
      `🕐 <b>SESSION:</b> <i>${sessionNote}</i>\n\n` +
      `⚠️ <b>INVALIDATION:</b> <i>Price confirmed close beyond <code>${params.invalidation.toFixed(decimals)}</code></i>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⭐ <b>Quality:</b> Grade ${grade} (${params.analysis.setupQuality.totalScore}/100)\n` +
      `<b>Status:</b> 🟢 Active Monitoring`;

    const inlineKeyboard: InlineKeyboardButton[][] = [
      [
        { text: '🎯 View Setup Details', callback_data: `view_setup_${params.setupId}` },
        { text: '📋 Active Setups', callback_data: 'cmd_setups' },
      ],
    ];

    for (const user of users) {
      if (!user.chatId) continue;
      if (user.settings.minQuality === 'HIGH' && !isHighGrade) continue;
      if (user.settings.newsFilter === 'BLOCK_HIGH' && params.analysis.newsContext.riskWarning) continue;

      const existing = await TelegramAlertLog.findOne({
        setupId: params.setupId,
        chatId: user.chatId,
        alertType: 'NEW_SETUP',
        deliveryStatus: 'SENT',
      });
      if (existing) continue;

      const sent = await telegramBot.sendMessage(user.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });

      await TelegramAlertLog.create({
        setupId: params.setupId,
        chatId: user.chatId,
        userId: user.userId,
        symbol: params.symbol,
        alertType: 'NEW_SETUP',
        stage: 'DETECTED',
        message: `New High-Quality ${params.direction} Setup (${params.riskReward}R)`,
        deliveryStatus: sent ? 'SENT' : 'FAILED',
      });
    }
  }

  /**
   * Formats human-readable lifecycle outcome messages (Take Profit, Stop Loss, Invalidation, Expiry)
   */
  public formatLifecycleMessage(
    analysisDoc: any,
    alertType: string,
    observedPrice?: number
  ): string {
    const symbol = analysisDoc?.symbol || 'Instrument';
    const isBull = analysisDoc?.direction === 'BULLISH';
    const dirLabel = isBull ? 'Bullish' : 'Bearish';
    const setupId = analysisDoc?.analysisId || '';
    const entry = analysisDoc?.entryPrice;
    const stop = analysisDoc?.stopLossPrice;
    const target = analysisDoc?.targetPrice;
    const rr = analysisDoc?.riskRewardRatio ? Number(analysisDoc.riskRewardRatio).toFixed(1) : '2.0';

    if (alertType === 'TP_HIT' || alertType === 'TP1' || alertType === 'TP2' || alertType === 'TP3') {
      return (
        `🎯 <b>TAKE PROFIT REACHED</b>\n\n` +
        `<b>${escapeHtml(symbol)}</b> — <b>${dirLabel}</b>\n\n` +
        `<b>Target:</b> TP1\n` +
        (entry != null ? `<b>Entry:</b> <code>${entry}</code>\n` : '') +
        (target != null ? `<b>Take Profit:</b> <code>${target}</code>\n` : '') +
        (observedPrice != null ? `<b>Exit Price:</b> <code>${observedPrice}</code>\n` : '') +
        `Price reached the target level with verified structural execution.\n\n` +
        `<b>Result:</b> Target Hit (+${rr}R)\n` +
        `<b>Setup ID:</b> <code>${setupId}</code>`
      );
    }

    if (alertType === 'SL_HIT' || alertType === 'SL') {
      return (
        `🛑 <b>STOP LOSS TRIGGERED</b>\n\n` +
        `<b>${escapeHtml(symbol)}</b> — <b>${dirLabel}</b>\n\n` +
        (entry != null ? `<b>Entry:</b> <code>${entry}</code>\n` : '') +
        (stop != null ? `<b>Stop Loss:</b> <code>${stop}</code>\n` : '') +
        (observedPrice != null ? `<b>Exit Price:</b> <code>${observedPrice}</code>\n` : '') +
        `Price reached the stop loss protection level.\n\n` +
        `<b>Result:</b> Stopped Out (-1.0R)\n` +
        `<b>Setup ID:</b> <code>${setupId}</code>`
      );
    }

    if (alertType === 'INVALIDATED') {
      const invalidation = analysisDoc?.invalidationPrice || stop;
      return (
        `🚫 <b>SETUP INVALIDATED</b>\n\n` +
        `<b>${escapeHtml(symbol)}</b> — <b>${dirLabel}</b>\n\n` +
        (invalidation != null ? `<b>Invalidation Level:</b> <code>${invalidation}</code>\n` : '') +
        (observedPrice != null ? `<b>Observed Price:</b> <code>${observedPrice}</code>\n` : '') +
        `Price closed beyond the structural invalidation boundary.\n\n` +
        `<b>Result:</b> Invalidated (0.0R)\n` +
        `<b>Setup ID:</b> <code>${setupId}</code>`
      );
    }

    if (alertType === 'EXPIRED') {
      return (
        `⏳ <b>SETUP EXPIRED</b>\n\n` +
        `<b>${escapeHtml(symbol)}</b> — <b>${dirLabel}</b>\n\n` +
        `The maximum 72-hour validity window elapsed without reaching entry/target.\n\n` +
        `<b>Result:</b> Expired (0.0R)\n` +
        `<b>Setup ID:</b> <code>${setupId}</code>`
      );
    }

    if (alertType === 'ENTRY_TRIGGERED') {
      return (
        `🎯 <b>ENTRY TRIGGERED</b>\n\n` +
        `<b>${escapeHtml(symbol)}</b> — <b>${dirLabel}</b>\n\n` +
        (entry != null ? `<b>Entry Price:</b> <code>${entry}</code>\n` : '') +
        (target != null ? `<b>Target (TP):</b> <code>${target}</code>\n` : '') +
        (stop != null ? `<b>Stop Loss:</b> <code>${stop}</code>\n` : '') +
        `Price entered the institutional order block zone and is actively monitoring.\n\n` +
        `<b>Setup ID:</b> <code>${setupId}</code>`
      );
    }

    return (
      `🔔 <b>SMC ALERT: ${escapeHtml(symbol)}</b>\n\n` +
      `<b>Setup ID:</b> <code>${setupId}</code>\n` +
      (observedPrice != null ? `<b>Observed Price:</b> <code>${observedPrice}</code>\n` : '') +
      `<b>Timestamp:</b> ${new Date().toUTCString()}`
    );
  }

  /**
   * Dispatches an OUTCOME / LIFECYCLE alert
   */
  public async dispatchLifecycleAlert(
    setupId: string,
    symbol: string,
    alertType: 'ENTRY_APPROACHING' | 'ENTRY_TRIGGERED' | 'TP1' | 'TP2' | 'TP3' | 'SL' | 'TP_HIT' | 'SL_HIT' | 'INVALIDATED' | 'EXPIRED',
    _unusedTitle: string,
    _unusedDescription: string,
    observedPrice?: number,
    analysisDoc?: any
  ): Promise<void> {
    const symClean = symbol.replace('/', '').toUpperCase();
    const users = await TelegramUser.find({
      isConnected: true,
      chatId: { $exists: true },
      'settings.isMuted': false,
      watchlist: { $in: [symClean, symbol] },
    });

    if (users.length === 0) return;

    // Load full analysis snapshot if not directly provided
    const analysis = analysisDoc || (await Analysis.findOne({ analysisId: setupId }).lean());
    const message = this.formatLifecycleMessage(analysis || { symbol, analysisId: setupId }, alertType, observedPrice);

    const inlineKeyboard: InlineKeyboardButton[][] = [
      [
        { text: '🎯 View Setup Details', callback_data: `view_setup_${setupId}` },
        { text: '📋 Active Setups', callback_data: 'cmd_setups' },
      ],
    ];

    for (const user of users) {
      if (!user.chatId) continue;

      const typeKey = alertType === 'ENTRY_APPROACHING' ? 'entryApproaching'
        : alertType === 'ENTRY_TRIGGERED' ? 'entryTriggered'
        : (alertType === 'TP1' || alertType === 'TP_HIT') ? 'tp1'
        : alertType === 'TP2' ? 'tp2'
        : alertType === 'TP3' ? 'tp3'
        : (alertType === 'SL' || alertType === 'SL_HIT') ? 'sl'
        : alertType === 'INVALIDATED' ? 'invalidated'
        : 'expired';

      if (!user.settings.alertTypes[typeKey]) continue;

      // Deduplication check
      const existing = await TelegramAlertLog.findOne({
        setupId,
        chatId: user.chatId,
        alertType,
        deliveryStatus: 'SENT',
      });
      if (existing) continue;

      console.log(`[ALERT] Dispatching LIFECYCLE [${alertType}]: setupId=${setupId}, chatId=${user.chatId}`);

      const sent = await telegramBot.sendMessage(user.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });

      console.log(`[TELEGRAM] Lifecycle delivery result for ${user.chatId}: ${sent ? 'HTTP 200 (SENT)' : 'FAILED'}`);

      await TelegramAlertLog.create({
        setupId,
        chatId: user.chatId,
        userId: user.userId,
        symbol,
        alertType,
        stage: alertType,
        message: `${alertType} for ${symbol}`,
        deliveryStatus: sent ? 'SENT' : 'FAILED',
      });
    }
  }
}

export const telegramAlertDispatcher = new TelegramAlertDispatcher();
