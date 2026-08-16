/**
 * Telegram Alert Formatter & Dispatcher
 * Formats deterministic SMC setup data and outcome lifecycle transitions into
 * high-impact, institutional Telegram alerts with deep-link inline buttons.
 */

import { config } from '../config/config';
import { TelegramUser } from '../models/TelegramUser';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
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

    // Find all users who are connected, unmuted, and have this symbol in their watchlist
    const symClean = params.symbol.replace('/', '').toUpperCase();
    const users = await TelegramUser.find({
      isConnected: true,
      chatId: { $exists: true },
      'settings.isMuted': false,
      'settings.alertTypes.newSetup': true,
      watchlist: { $in: [symClean, params.symbol] },
    });

    if (users.length === 0) return;

    // Check Quality Score threshold
    const grade = params.analysis.setupQuality.grade;
    const isHighGrade = grade === 'A+' || grade === 'A';

    // Format SMC Evidence checklist with HTML escaping
    const evidenceLines = params.analysis.structuralEvidence.bulletPoints.slice(0, 5)
      .map(pt => `✓ ${escapeHtml(pt)}`)
      .join('\n');

    // News check
    const newsNote = escapeHtml(params.analysis.newsContext.riskWarning || 'No major conflicting high-impact event detected.');

    // Session check
    const sessionNote = escapeHtml(params.analysis.sessionContext.sessionNotes || 'Active Session');

    // Build Formatted HTML Message
    const message = `🔥 <b>HIGH-QUALITY SMC SETUP</b>\n` +
      `<b>${params.symbol}</b> — Potential <b>${params.direction}</b> Scenario\n` +
      `<code>Setup ID: ${params.setupId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 <b>MARKET STRUCTURE</b>\n` +
      `• <b>HTF:</b> ${escapeHtml(params.analysis.marketOverview.htfBias)}\n` +
      `• <b>Intermediate:</b> ${escapeHtml(params.analysis.marketOverview.intermediateStructure)}\n` +
      `• <b>Lower TF:</b> ${escapeHtml(params.analysis.marketOverview.lowerTimeframeStatus)}\n\n` +
      `💧 <b>LIQUIDITY & DRAW</b>\n` +
      `• ${escapeHtml(params.analysis.liquidityMap.nextTargetSummary)}\n\n` +
      `🎯 <b>ENTRY ZONE</b>\n` +
      `<code>${params.entryBottom.toFixed(decimals)} — ${params.entryTop.toFixed(decimals)}</code>\n\n` +
      `🛑 <b>STOP LOSS</b>\n` +
      `<code>${params.stopLoss.toFixed(decimals)}</code>\n\n` +
      `🎯 <b>TAKE PROFIT TARGETS</b>\n` +
      `• <b>TP1:</b> <code>${params.target1.toFixed(decimals)}</code>\n` +
      `• <b>TP2:</b> <code>${params.target2.toFixed(decimals)}</code>\n` +
      (params.target3 ? `• <b>TP3:</b> <code>${params.target3.toFixed(decimals)}</code>\n` : '') +
      `\n📐 <b>RISK : REWARD</b>\n` +
      `<code>1 : ${params.riskReward.toFixed(1)}R</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧠 <b>SMC CONFLUENCE EVIDENCE</b>\n` +
      `${evidenceLines}\n\n` +
      `📰 <b>MACRO / NEWS</b>\n` +
      `<i>${newsNote}</i>\n\n` +
      `🕐 <b>SESSION</b>\n` +
      `<i>${sessionNote}</i>\n\n` +
      `⚠️ <b>INVALIDATION TRIGGER</b>\n` +
      `<i>${isBull ? 'Bullish' : 'Bearish'} thesis invalidated if price confirms close beyond <code>${params.invalidation.toFixed(decimals)}</code></i>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧠 <b>AI STRUCTURAL ASSESSMENT</b>\n` +
      `<b>Grade ${grade} (${params.analysis.setupQuality.totalScore}/100)</b> — High Confluence Institutional Setup.\n` +
      `<b>Status:</b> 🟢 Monitoring`;

    const inlineKeyboard: InlineKeyboardButton[][] = [
      [
        { text: '🎯 View Setup Details', callback_data: `view_setup_${params.setupId}` },
        { text: '📋 Active Setups', callback_data: 'cmd_setups' },
      ],
    ];

    for (const user of users) {
      if (!user.chatId) continue;

      // Check minQuality filter
      if (user.settings.minQuality === 'HIGH' && !isHighGrade) continue;

      // News filter check
      if (user.settings.newsFilter === 'BLOCK_HIGH' && params.analysis.newsContext.riskWarning) continue;

      // Deduplication check: Do not re-send if already SENT successfully
      const existing = await TelegramAlertLog.findOne({
        setupId: params.setupId,
        chatId: user.chatId,
        alertType: 'NEW_SETUP',
        deliveryStatus: 'SENT',
      });
      if (existing) continue;

      console.log(`[ALERT] Dispatching NEW_SETUP: setupId=${params.setupId}, symbol=${params.symbol}, chatId=${user.chatId}`);

      const sent = await telegramBot.sendMessage(user.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });

      console.log(`[TELEGRAM] Message delivery result for ${user.chatId}: ${sent ? 'HTTP 200 (SENT)' : 'FAILED'}`);

      // Record to audit log
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
   * Dispatches an OUTCOME / LIFECYCLE alert
   */
  public async dispatchLifecycleAlert(
    setupId: string,
    symbol: string,
    alertType: 'ENTRY_APPROACHING' | 'ENTRY_TRIGGERED' | 'TP1' | 'TP2' | 'TP3' | 'SL' | 'TP_HIT' | 'SL_HIT' | 'INVALIDATED' | 'EXPIRED',
    title: string,
    description: string,
    observedPrice?: number
  ): Promise<void> {
    const symClean = symbol.replace('/', '').toUpperCase();
    const users = await TelegramUser.find({
      isConnected: true,
      chatId: { $exists: true },
      'settings.isMuted': false,
      watchlist: { $in: [symClean, symbol] },
    });

    if (users.length === 0) return;

    let icon = '🔔';
    if (alertType === 'ENTRY_APPROACHING') icon = '⚠️';
    if (alertType === 'ENTRY_TRIGGERED') icon = '🎯';
    if (alertType.startsWith('TP')) icon = '💰';
    if (alertType === 'SL' || alertType === 'SL_HIT') icon = '🛑';
    if (alertType === 'INVALIDATED') icon = '🚫';
    if (alertType === 'EXPIRED') icon = '⏳';

    const message = `${icon} <b>SMC ALERT: ${escapeHtml(title)}</b>\n` +
      `<b>${symbol}</b> — <code>${setupId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${escapeHtml(description)}\n\n` +
      (observedPrice != null ? `• <b>Observed Market Price:</b> <code>${observedPrice}</code>\n` : '') +
      `• <b>Timestamp:</b> ${new Date().toUTCString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    const inlineKeyboard: InlineKeyboardButton[][] = [
      [
        { text: '🎯 View Setup Details', callback_data: `view_setup_${setupId}` },
        { text: '📊 Active Setups', callback_data: 'cmd_setups' },
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
        message: description.slice(0, 300),
        deliveryStatus: sent ? 'SENT' : 'FAILED',
      });
    }
  }
}

export const telegramAlertDispatcher = new TelegramAlertDispatcher();
