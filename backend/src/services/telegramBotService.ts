/**
 * Telegram Bot API Service
 * Handles official Telegram Bot API communications, automatic user provisioning,
 * persistent menu keyboards, slash command dispatching, active setup inspection,
 * and detailed evidence-based setup breakdowns.
 */

import { config } from '../config/config';
import { TelegramUser } from '../models/TelegramUser';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
import { getInstrumentMapping } from '../config/instrumentRegistry';
import { activeSetupService } from './activeSetupService';

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

interface KeyboardButton {
  text: string;
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup?: {
    inline_keyboard?: InlineKeyboardButton[][];
    keyboard?: KeyboardButton[][];
    resize_keyboard?: boolean;
    persistent?: boolean;
  };
}

/**
 * Escapes reserved HTML characters for Telegram HTML mode
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Checks if a URL is valid for Telegram inline button (must be HTTPS and not localhost)
 */
export function isValidTelegramUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('https://') && !url.includes('localhost') && !url.includes('127.0.0.1');
}

// Persistent main menu keyboard shown at bottom of chat
const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '🎯 Active Setups' }, { text: '📡 My Watchlist' }],
    [{ text: '📊 System Status' }, { text: '⚙️ Alert Settings' }],
    [{ text: '🌐 Web Terminal Info' }, { text: '📖 Help Guide' }],
  ],
  resize_keyboard: true,
};

class TelegramBotService {
  private botToken: string;
  private isPolling: boolean = false;
  private lastUpdateId: number = 0;
  private pollingTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.botToken = config.telegramBotToken;
  }

  public isConfigured(): boolean {
    return !!this.botToken && this.botToken.length > 10;
  }

  /**
   * Send a message to a specific Telegram Chat ID
   */
  public async sendMessage(
    chatId: number | string,
    text: string,
    options: SendMessageOptions = { parse_mode: 'HTML', disable_web_page_preview: true }
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[TelegramBot] Cannot send message — TELEGRAM_BOT_TOKEN not configured.');
      return false;
    }

    try {
      // Sanitize inline keyboard URLs if any (filter out localhost)
      if (options.reply_markup?.inline_keyboard) {
        options.reply_markup.inline_keyboard = options.reply_markup.inline_keyboard.map(row =>
          row.map(btn => {
            if (btn.url && !isValidTelegramUrl(btn.url)) {
              return { text: btn.text, callback_data: btn.callback_data || 'cmd_terminal_info' };
            }
            return btn;
          })
        );
      }

      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...options,
        }),
      });

      const data: any = await res.json();
      if (!data.ok) {
        console.error(`[TelegramBot] Send failed to chatId ${chatId}:`, data.description);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[TelegramBot] Network error sending to ${chatId}:`, err);
      return false;
    }
  }

  /**
   * Start long-polling for incoming Telegram updates and commands
   */
  public startPolling(): void {
    if (!this.isConfigured()) {
      console.log('[TelegramBot] Polling not started: TELEGRAM_BOT_TOKEN is not configured in backend/.env');
      return;
    }
    if (this.isPolling) return;

    this.isPolling = true;
    console.log(`[TelegramBot] Official Bot polling active for @${config.telegramBotUsername}`);
    this.pollUpdates();
  }

  public stopPolling(): void {
    this.isPolling = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
    console.log('[TelegramBot] Polling stopped');
  }

  private async pollUpdates(): Promise<void> {
    if (!this.isPolling) return;

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
      const res = await fetch(url);
      const data: any = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          this.lastUpdateId = update.update_id;
          if (update.message) {
            await this.handleIncomingMessage(update.message);
          } else if (update.callback_query) {
            await this.handleCallbackQuery(update.callback_query);
          }
        }
      }
    } catch (err) {
      console.warn('[TelegramBot] Poll error:', err);
    }

    if (this.isPolling) {
      this.pollingTimeout = setTimeout(() => this.pollUpdates(), 1000);
    }
  }

  /**
   * Main router for slash commands, keyboard menu taps & text messages
   */
  private async handleIncomingMessage(msg: any): Promise<void> {
    const chatId = msg.chat?.id;
    const rawText = (msg.text || '').trim();
    const fromUsername = msg.from?.username || '';
    const firstName = msg.from?.first_name || 'Trader';

    if (!chatId || !rawText) return;

    // Normalize text / menu taps
    let command = rawText.toLowerCase();
    if (rawText === '🎯 Active Setups' || rawText === 'Active Setups') command = '/setups';
    if (rawText === '📡 My Watchlist' || rawText === 'My Watchlist') command = '/watchlist';
    if (rawText === '📊 System Status' || rawText === 'System Status') command = '/status';
    if (rawText === '⚙️ Alert Settings' || rawText === 'Alert Settings') command = '/settings';
    if (rawText === '📖 Help Guide' || rawText === 'Help Guide') command = '/help';
    if (rawText === '🌐 Web Terminal Info' || rawText === 'Web Terminal Info') {
      await this.sendMessage(chatId, `🌐 <b>SMC Market Analyzer Web Terminal:</b>\n\nAccess your live trading workspace at:\n<code>${config.frontendOrigin}</code>`, {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Find or Auto-provision user record for this chatId
    let user = await TelegramUser.findOne({ chatId });
    if (!user) {
      user = await TelegramUser.create({
        userId: `tg_${chatId}`,
        chatId,
        telegramUsername: fromUsername,
        firstName,
        isConnected: true,
        connectedAt: new Date(),
        lastActiveAt: new Date(),
        watchlist: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT'],
        settings: {
          minQuality: 'HIGH',
          timeframes: { htf: '4H', intermediate: '1H', setup: '15M', entry: '5M' },
          sessions: ['London', 'New York', 'London / New York Overlap'],
          newsFilter: 'BLOCK_HIGH',
          alertTypes: {
            newSetup: true,
            entryApproaching: true,
            entryTriggered: true,
            tp1: true,
            tp2: true,
            tp3: true,
            sl: true,
            invalidated: true,
            expired: false,
          },
          isMuted: false,
        },
      });
    } else {
      user.lastActiveAt = new Date();
      if (!user.isConnected) {
        user.isConnected = true;
      }
      await user.save();
    }

    // Handle /start and /start <code>
    if (command.startsWith('/start')) {
      const parts = rawText.split(' ');
      const code = parts[1]?.trim().toUpperCase();

      if (code) {
        await this.handleConnectCode(chatId, code, fromUsername, firstName);
        return;
      }

      const welcome = `🏛️ <b>SMC MARKET ANALYZER — AI STRUCTURAL BOT</b>\n\n` +
        `Welcome, <b>${escapeHtml(firstName)}</b>! You are connected to the institutional Smart Money Concept analysis & real-time alert engine.\n\n` +
        `⚡ <b>Institutional Confluence Engine:</b>\n` +
        `• <b>Live Market Feeds:</b> Forex (Yahoo), Gold (COMEX), Crypto (Binance)\n` +
        `• <b>Deterministic SMC:</b> BOS, MSS, Sweeps, FVGs, Order Blocks, Dealing Ranges\n` +
        `• <b>Proactive Alerts:</b> Grade <b>A/A+ Setups Pushed Automatically</b>\n` +
        `• <b>Active Watchlist:</b> ${user.watchlist.join(', ')}\n\n` +
        `Use the menu buttons below to inspect active setups or configure alerts.`;

      await this.sendMessage(chatId, welcome, {
        parse_mode: 'HTML',
        reply_markup: {
          ...MAIN_MENU_KEYBOARD,
          inline_keyboard: [
            [
              { text: '🎯 Active Setups', callback_data: 'cmd_setups' },
              { text: '📡 Watchlist', callback_data: 'cmd_watchlist' },
            ],
            [
              { text: '⚙️ Settings', callback_data: 'cmd_settings' },
              { text: '📊 System Status', callback_data: 'cmd_status' },
            ],
          ],
        },
      });
      return;
    }

    // Handle /connect <code>
    if (command.startsWith('/connect')) {
      const parts = rawText.split(' ');
      const code = parts[1]?.trim().toUpperCase();
      if (!code) {
        await this.sendMessage(chatId, '⚠️ Please provide your connection code.\nExample: <code>/connect ABC123</code>');
        return;
      }
      await this.handleConnectCode(chatId, code, fromUsername, firstName);
      return;
    }

    // Handle /help
    if (command === '/help') {
      const helpMsg = `📖 <b>SMC Bot Command Guide:</b>\n\n` +
        `• <code>/setups</code> — View ALL active high-quality SMC setups from database\n` +
        `• <code>/status</code> — Live feed status, AI engine & active setups\n` +
        `• <code>/watchlist</code> — Show your monitored instruments\n` +
        `• <code>/add &lt;symbol&gt;</code> — Add pair (e.g. <code>/add EURUSD</code>, <code>/add XAUUSD</code>)\n` +
        `• <code>/remove &lt;symbol&gt;</code> — Remove pair from watchlist\n` +
        `• <code>/settings</code> — View and adjust alert filters\n` +
        `• <code>/alerts</code> — View recent alert history\n` +
        `• <code>/stop</code> — Pause all alert notifications\n` +
        `• <code>/resume</code> — Resume alert notifications\n` +
        `• <code>/help</code> — Show this guide`;

      await this.sendMessage(chatId, helpMsg, {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Handle /status
    if (command === '/status') {
      const openSetups = await activeSetupService.getActiveSetups();
      const statusMsg = `📊 <b>SMC Analyzer Live System Status:</b>\n\n` +
        `🤖 <b>Bot Engine:</b> 🟢 Operational (@${config.telegramBotUsername})\n` +
        `📡 <b>Market Feeds:</b> 🟢 Live (Yahoo Finance & Binance)\n` +
        `🧠 <b>AI Intelligence:</b> 🟢 Active (Deterministic + Confluence)\n` +
        `🔔 <b>Notifications:</b> ${user.settings.isMuted ? '🔴 Paused (/resume)' : '🟢 Active'}\n` +
        `🎯 <b>Min Quality Threshold:</b> Grade <b>${user.settings.minQuality}</b> (Score ≥ 75)\n` +
        `🛡️ <b>News Protection:</b> ${user.settings.newsFilter}\n` +
        `📋 <b>Active Watchlist (${user.watchlist.length}):</b> ${user.watchlist.join(', ')}\n` +
        `📈 <b>Active Setups in DB:</b> <b>${openSetups.length} Open</b>\n\n` +
        `<i>Web Terminal: ${config.frontendOrigin}</i>`;

      await this.sendMessage(chatId, statusMsg, {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Handle /watchlist
    if (command === '/watchlist') {
      const list = user.watchlist.map(s => `• <b>${s}</b>`).join('\n');
      const msg = `📋 <b>Your Monitored Watchlist:</b>\n\n${list}\n\n` +
        `<i>Add or remove with <code>/add EURUSD</code> or <code>/remove EURUSD</code></i>`;
      await this.sendMessage(chatId, msg, {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Handle /add <symbol>
    if (command.startsWith('/add')) {
      const sym = rawText.split(' ')[1]?.trim().toUpperCase().replace('/', '');
      if (!sym) {
        await this.sendMessage(chatId, '⚠️ Please specify a symbol to add. Example: <code>/add EURUSD</code>');
        return;
      }
      const mapping = getInstrumentMapping(sym);
      if (!mapping && !['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'US500', 'NAS100'].includes(sym)) {
        await this.sendMessage(chatId, `⚠️ Symbol <b>${escapeHtml(sym)}</b> is not supported.\nSupported: EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSDT, ETHUSDT, SOLUSDT, US500, NAS100.`);
        return;
      }
      if (!user.watchlist.includes(sym)) {
        user.watchlist.push(sym);
        await user.save();
        await this.sendMessage(chatId, `✅ Added <b>${escapeHtml(sym)}</b> to your watchlist.\nCurrent Watchlist: ${user.watchlist.join(', ')}`, {
          parse_mode: 'HTML',
          reply_markup: MAIN_MENU_KEYBOARD,
        });
      } else {
        await this.sendMessage(chatId, `ℹ️ <b>${escapeHtml(sym)}</b> is already in your watchlist.`, {
          parse_mode: 'HTML',
          reply_markup: MAIN_MENU_KEYBOARD,
        });
      }
      return;
    }

    // Handle /remove <symbol>
    if (command.startsWith('/remove')) {
      const sym = rawText.split(' ')[1]?.trim().toUpperCase().replace('/', '');
      if (!sym) {
        await this.sendMessage(chatId, '⚠️ Please specify a symbol to remove. Example: <code>/remove EURUSD</code>');
        return;
      }
      user.watchlist = user.watchlist.filter(s => s !== sym);
      await user.save();
      await this.sendMessage(chatId, `✅ Removed <b>${escapeHtml(sym)}</b> from watchlist.\nCurrent Watchlist: ${user.watchlist.join(', ') || 'Empty'}`, {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Handle /stop & /resume
    if (command === '/stop') {
      user.settings.isMuted = true;
      await user.save();
      await this.sendMessage(chatId, '🔕 <b>Alerts Paused</b>. You will not receive notifications until you send /resume.', {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }
    if (command === '/resume') {
      user.settings.isMuted = false;
      await user.save();
      await this.sendMessage(chatId, '🔔 <b>Alerts Resumed</b>. You will now receive high-quality SMC setup notifications.', {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Handle /settings
    if (command === '/settings') {
      const s = user.settings;
      const settingsMsg = `⚙️ <b>Your Alert Preferences:</b>\n\n` +
        `• <b>Min Setup Quality:</b> ${s.minQuality} (Grade A/A+ ≥ 75)\n` +
        `• <b>News Filter:</b> ${s.newsFilter} (Blocks alerts during high-impact events)\n` +
        `• <b>Active Sessions:</b> ${s.sessions.join(', ')}\n` +
        `• <b>Timeframes:</b> HTF: ${s.timeframes.htf} | Setup: ${s.timeframes.setup} | Entry: ${s.timeframes.entry}\n` +
        `• <b>Status:</b> ${s.isMuted ? '🔴 Paused' : '🟢 Active'}\n\n` +
        `<i>Customize from Web Terminal for fine-grained control.</i>`;

      await this.sendMessage(chatId, settingsMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          ...MAIN_MENU_KEYBOARD,
          inline_keyboard: [
            [
              { text: s.isMuted ? '🔔 Resume Alerts' : '🔕 Pause Alerts', callback_data: s.isMuted ? 'action_resume' : 'action_stop' },
            ],
          ],
        },
      });
      return;
    }

    // Handle /setups (Returns ALL active setups without arbitrary limit)
    if (command === '/setups') {
      const openSetups = await activeSetupService.getActiveSetups();
      if (openSetups.length === 0) {
        await this.sendMessage(chatId, 'ℹ️ <b>No Active Open Setups in Database</b>\n\nThe background scanner is continuously evaluating watchlist pairs for high-confluence Grade A setups.', {
          parse_mode: 'HTML',
          reply_markup: MAIN_MENU_KEYBOARD,
        });
        return;
      }

      let msg = `📊 <b>ACTIVE SETUPS — ${openSetups.length}</b>\n\n` +
        `<i>Tap any setup button below to view detailed evidence and structural reasoning:</i>\n\n`;

      const inlineKeyboardButtons: InlineKeyboardButton[][] = [];

      openSetups.forEach((a, idx) => {
        const isBull = a.direction === 'BULLISH';
        const icon = isBull ? '🟢' : '🔴';
        msg += `<b>${idx + 1}. ${icon} ${a.symbol} (${a.timeframe}) — ${a.direction}</b>\n` +
          `• <b>ID:</b> <code>${a.analysisId}</code>\n` +
          `• <b>Entry:</b> <code>${a.entryPrice}</code> | <b>Target:</b> <code>${a.targetPrice}</code> (<b>${a.riskRewardRatio}R</b>)\n` +
          `• <b>Grade:</b> ${a.setupQuality?.grade} (${a.setupQuality?.totalScore}/100)\n\n`;

        // 2 buttons per row
        const btnText = `${icon} ${a.symbol} (${a.direction})`;
        const callbackData = `view_setup_${a.analysisId}`;

        if (idx % 2 === 0) {
          inlineKeyboardButtons.push([{ text: btnText, callback_data: callbackData }]);
        } else {
          inlineKeyboardButtons[inlineKeyboardButtons.length - 1].push({ text: btnText, callback_data: callbackData });
        }
      });

      await this.sendMessage(chatId, msg, {
        parse_mode: 'HTML',
        reply_markup: {
          ...MAIN_MENU_KEYBOARD,
          inline_keyboard: inlineKeyboardButtons,
        },
      });
      return;
    }

    // Handle /alerts
    if (command === '/alerts') {
      const logs = await TelegramAlertLog.find({ chatId }).sort({ sentAt: -1 }).limit(8).lean();
      if (logs.length === 0) {
        await this.sendMessage(chatId, 'ℹ️ No recent alert notifications logged for your account.', {
          parse_mode: 'HTML',
          reply_markup: MAIN_MENU_KEYBOARD,
        });
        return;
      }
      let logMsg = `📜 <b>Recent Alert Notifications (${logs.length}):</b>\n\n`;
      for (const l of logs) {
        logMsg += `• <b>${l.alertType}</b> — ${l.symbol} (${new Date(l.sentAt).toLocaleTimeString()} UTC)\n` +
          `  <i>${l.stage} — Status: ${l.deliveryStatus}</i>\n\n`;
      }
      await this.sendMessage(chatId, logMsg, {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // Fallback response for unhandled text
    await this.sendMessage(chatId, `ℹ️ Command not recognized. Use the menu buttons below or type <code>/help</code>.`, {
      parse_mode: 'HTML',
      reply_markup: MAIN_MENU_KEYBOARD,
    });
  }

  /**
   * Handle secure pairing code handshake
   */
  private async handleConnectCode(
    chatId: number,
    code: string,
    telegramUsername: string,
    firstName: string
  ): Promise<void> {
    const now = new Date();
    const user = await TelegramUser.findOne({
      connectionCode: code,
      codeExpiresAt: { $gt: now },
    });

    if (!user) {
      await this.sendMessage(
        chatId,
        `❌ <b>Invalid or Expired Connection Code</b>\n\nPlease generate a fresh code on the website and try again:\n<code>/connect YOUR_CODE</code>`,
        { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD }
      );
      return;
    }

    // Successfully link Telegram Chat ID
    user.chatId = chatId;
    user.telegramUsername = telegramUsername;
    user.firstName = firstName;
    user.isConnected = true;
    user.connectedAt = now;
    user.lastActiveAt = now;
    user.connectionCode = undefined;
    user.codeExpiresAt = undefined;
    await user.save();

    const successMsg = `🎉 <b>Account Successfully Connected!</b>\n\n` +
      `👤 <b>User ID:</b> <code>${user.userId}</code>\n` +
      `📡 <b>Active Watchlist:</b> ${user.watchlist.join(', ')}\n` +
      `⚡ <b>Alerts:</b> 🟢 Enabled (High-Quality Setups Only)\n\n` +
      `You will now receive real-time structural intelligence alerts directly in this chat.`;

    await this.sendMessage(chatId, successMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        ...MAIN_MENU_KEYBOARD,
        inline_keyboard: [
          [
            { text: '🎯 Active Setups', callback_data: 'cmd_setups' },
            { text: '📡 Watchlist', callback_data: 'cmd_watchlist' },
          ],
        ],
      },
    });
  }

  /**
   * Handle inline button callbacks (including setup detail inspection)
   */
  private async handleCallbackQuery(cb: any): Promise<void> {
    const chatId = cb.message?.chat?.id;
    const data = cb.data;
    if (!chatId || !data) return;

    if (data === 'action_stop') {
      await TelegramUser.updateOne({ chatId }, { $set: { 'settings.isMuted': true } });
      await this.sendMessage(chatId, '🔕 Alerts Paused. Use /resume to reactivate.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
    } else if (data === 'action_resume') {
      await TelegramUser.updateOne({ chatId }, { $set: { 'settings.isMuted': false } });
      await this.sendMessage(chatId, '🔔 Alerts Resumed.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
    } else if (data === 'cmd_setups') {
      await this.handleIncomingMessage({ chat: { id: chatId }, text: '/setups' });
    } else if (data === 'cmd_watchlist') {
      await this.handleIncomingMessage({ chat: { id: chatId }, text: '/watchlist' });
    } else if (data === 'cmd_settings') {
      await this.handleIncomingMessage({ chat: { id: chatId }, text: '/settings' });
    } else if (data === 'cmd_status') {
      await this.handleIncomingMessage({ chat: { id: chatId }, text: '/status' });
    } else if (data === 'cmd_terminal_info') {
      await this.sendMessage(chatId, `🌐 <b>SMC Market Analyzer Web Terminal:</b>\n<code>${config.frontendOrigin}</code>`, { parse_mode: 'HTML' });
    } else if (data.startsWith('view_setup_')) {
      const analysisId = data.replace('view_setup_', '');
      const d = await activeSetupService.getSetupDetails(analysisId);

      if (!d) {
        await this.sendMessage(chatId, '⚠️ Setup record not found or no longer active.', { parse_mode: 'HTML' });
        return;
      }

      const isBull = d.direction === 'BULLISH';
      const icon = isBull ? '🟢' : '🔴';

      const evidenceList = d.evidenceChecklist
        .map(e => `${e.passed ? '✓' : '✗'} <b>${escapeHtml(e.label)}:</b> ${escapeHtml(e.note)}`)
        .join('\n');

      const detailMsg = `📊 <b>${icon} ${escapeHtml(d.symbol)} — ${d.direction} SETUP DETAILS</b>\n` +
        `<code>Setup ID: ${d.analysisId}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎯 <b>SETUP MODEL:</b>\n` +
        `<code>${escapeHtml(d.setupModel)}</code>\n\n` +
        `⚡ <b>TRIGGER:</b>\n` +
        `<i>${escapeHtml(d.trigger)}</i>\n\n` +
        `💡 <b>WHY THIS SETUP EXISTS:</b>\n` +
        `${escapeHtml(d.whyOccurred)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧠 <b>STRUCTURAL EVIDENCE CHECKLIST:</b>\n` +
        `${evidenceList}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 <b>ENTRY ZONE:</b> <code>${d.entryPrice}</code>\n` +
        `<i>${escapeHtml(d.entryReason)}</i>\n\n` +
        `🛑 <b>INVALIDATION:</b> <code>${d.invalidationPrice}</code>\n` +
        `<i>${escapeHtml(d.invalidationReason)}</i>\n\n` +
        `🎯 <b>TARGET:</b> <code>${d.targetPrice}</code> (<b>${d.riskRewardRatio}R</b>)\n` +
        `<i>${escapeHtml(d.targetReason)}</i>\n\n` +
        `📡 <b>CURRENT MONITORING:</b>\n` +
        `• <b>Status:</b> ${escapeHtml(d.currentMonitoringState.monitoringStatus)}\n` +
        `• <b>Grade:</b> ${d.quality.grade} (${d.quality.totalScore}/100)`;

      await this.sendMessage(chatId, detailMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '◀ Back to Active Setups', callback_data: 'cmd_setups' },
            ],
          ],
        },
      });
    }
  }
}

export const telegramBot = new TelegramBotService();
