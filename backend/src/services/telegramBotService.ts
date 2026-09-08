/**
 * Telegram Bot API Service
 *
 * Security model:
 * ─────────────────────────────────────────────────────────────────
 * 1. Every /start ALWAYS resets the current session. Re-auth is
 *    required on every fresh /start (Part 6 / Test G).
 * 2. isUserAuthenticated() evaluates sessionIsActive AND sessionExpiresAt.
 *    A stale isAuthorized flag alone is NOT sufficient.
 * 3. handleCallbackQuery() checks authentication at entry — no bypass.
 * 4. NO hardcoded admin Telegram IDs exist anywhere in this file.
 * 5. /getcode and /request_code are NOT supported — codes are
 *    generated on the website only (Part 20).
 * 6. The authoritative Telegram identity is the numeric Telegram
 *    user ID stored in telegramUserId, not username or display name.
 * ─────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
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

/** Escapes reserved HTML characters for Telegram HTML mode */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Checks if a URL is valid for Telegram inline button */
export function isValidTelegramUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('https://') && !url.includes('localhost') && !url.includes('127.0.0.1');
}

// SESSION_DURATION: 24 hours. Session is always reset on /start (Part 6).
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// Rate limiting: max failed code attempts before lockout
const MAX_CODE_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Auth-gate inline button (only button shown to unauthenticated users)
const AUTH_GATE_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🌐 Open Web Dashboard to Get Your Code', callback_data: 'cmd_how_to_connect' }],
  ],
};

// Protected main menu (shown only to authenticated users)
const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '🎯 Active Setups' }, { text: '📡 My Watchlist' }],
    [{ text: '📊 System Status' }, { text: '⚙️ Alert Settings' }],
    [{ text: '🌐 Web Terminal Info' }, { text: '📖 Help Guide' }],
  ],
  resize_keyboard: true,
};

/** The single auth gate message. No trading info. No menus. */
function buildAuthGateMessage(firstName: string): string {
  return (
    `🔐 <b>VERIFICATION REQUIRED</b>\n\n` +
    `Welcome, <b>${escapeHtml(firstName)}</b>.\n\n` +
    `This bot provides private SMC trading signals and live setup alerts.\n` +
    `<b>You must verify your account before accessing any protected information.</b>\n\n` +
    `<b>How to connect:</b>\n` +
    `1. Open the web dashboard\n` +
    `2. Navigate to <b>Telegram → Generate Code</b>\n` +
    `3. Copy the 6-digit verification code\n` +
    `4. Send that code here as a plain message\n\n` +
    `<i>Codes expire in 10 minutes and are single-use.</i>`
  );
}

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

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION UTILITY — Single source of truth for session validity
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns true ONLY if the user has an active, non-expired session.
   * isAuthorized alone is NOT sufficient — the session must still be live.
   */
  private isUserAuthenticated(user: any): boolean {
    if (!user) return false;
    if (!user.sessionIsActive) return false;
    if (!user.sessionExpiresAt) return false;
    return new Date() < new Date(user.sessionExpiresAt);
  }

  /**
   * Creates a fresh session for the user. Called after successful code verification.
   */
  private async createSession(user: any, now: Date = new Date()): Promise<string> {
    const token = crypto.randomUUID();
    user.sessionToken = token;
    user.sessionCreatedAt = now;
    user.sessionExpiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    user.sessionLastActivityAt = now;
    user.sessionIsActive = true;
    user.isAuthorized = true;
    user.authorizedAt = now;
    await user.save();
    return token;
  }

  /**
   * Destroys the current session. Called on /start (always), disconnect, revoke.
   */
  private async destroySession(user: any): Promise<void> {
    user.sessionToken = undefined;
    user.sessionCreatedAt = undefined;
    user.sessionExpiresAt = undefined;
    user.sessionLastActivityAt = undefined;
    user.sessionIsActive = false;
    // Do NOT set isAuthorized=false here — that is a permanent authorization flag.
    // The session is what controls live bot access (Part 6).
    await user.save();
  }

  /**
   * Touches the session last-activity timestamp without creating a new session.
   */
  private async touchSession(user: any): Promise<void> {
    user.sessionLastActivityAt = new Date();
    user.lastActiveAt = new Date();
    await user.save();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────────────────

  public async sendMessage(
    chatId: number | string,
    text: string,
    options: SendMessageOptions = { parse_mode: 'HTML', disable_web_page_preview: true }
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[TelegramBot] Cannot send — TELEGRAM_BOT_TOKEN not configured.');
      return false;
    }

    try {
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
        body: JSON.stringify({ chat_id: chatId, text, ...options }),
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

  // ─────────────────────────────────────────────────────────────────────────
  // POLLING
  // ─────────────────────────────────────────────────────────────────────────

  public startPolling(): void {
    if (!this.isConfigured()) {
      console.log('[TelegramBot] Polling not started: TELEGRAM_BOT_TOKEN is not configured.');
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

  // ─────────────────────────────────────────────────────────────────────────
  // INCOMING MESSAGE HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  private async handleIncomingMessage(msg: any): Promise<void> {
    const chatId: number = msg.chat?.id;
    const rawText: string = (msg.text || '').trim();

    // Authoritative Telegram numeric user ID — never use username/display name for auth
    const telegramUserId: number = msg.from?.id;
    const fromUsername: string = msg.from?.username || '';
    const firstName: string = msg.from?.first_name || 'Trader';
    const lastName: string = msg.from?.last_name || '';
    const languageCode: string = msg.from?.language_code || '';

    if (!chatId || !rawText) return;

    // ── Normalize menu button taps ───────────────────────────────────────
    let command = rawText.toLowerCase();
    if (rawText === '🎯 Active Setups' || rawText === 'Active Setups') command = '/setups';
    if (rawText === '📡 My Watchlist' || rawText === 'My Watchlist') command = '/watchlist';
    if (rawText === '📊 System Status' || rawText === 'System Status') command = '/status';
    if (rawText === '⚙️ Alert Settings' || rawText === 'Alert Settings') command = '/settings';
    if (rawText === '📖 Help Guide' || rawText === 'Help Guide') command = '/help';
    if (rawText === '🌐 Web Terminal Info' || rawText === 'Web Terminal Info') {
      // Web Terminal Info is safe to show without auth
      await this.sendMessage(chatId,
        `🌐 <b>SMC Market Analyzer Web Terminal:</b>\n\n<code>${config.frontendOrigin}</code>\n\n<i>Generate your verification code from the dashboard to connect this bot.</i>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // ── Look up user record by telegramUserId (authoritative numeric ID) ─
    // Fall back to chatId for legacy records without telegramUserId yet
    let user = telegramUserId
      ? await TelegramUser.findOne({ telegramUserId })
      : await TelegramUser.findOne({ chatId });

    // ─────────────────────────────────────────────────────────────────────
    // /start — ALWAYS resets the session. Re-auth required every /start.
    // This is the Part 6 session boundary.
    // ─────────────────────────────────────────────────────────────────────
    if (command.startsWith('/start')) {
      const parts = rawText.split(' ');
      const inlineCode = parts[1]?.trim(); // /start <code> from direct link

      if (!user) {
        // First-time user: create a minimal record (not connected, not authorized)
        user = await TelegramUser.create({
          userId: `tg_${telegramUserId || chatId}`,
          linkedWebUserId: 'user_1',
          telegramUserId: telegramUserId || undefined,
          chatId,
          telegramUsername: fromUsername,
          firstName,
          lastName,
          languageCode,
          isConnected: false,
          isAuthorized: false,
          sessionIsActive: false,
          failedAuthAttempts: 0,
          watchlist: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT'],
          settings: {
            minQuality: 'HIGH',
            timeframes: { htf: '4H', intermediate: '1H', setup: '15M', entry: '5M' },
            sessions: ['London', 'New York', 'London / New York Overlap'],
            newsFilter: 'BLOCK_HIGH',
            alertTypes: {
              newSetup: true, entryApproaching: true, entryTriggered: true,
              tp1: true, tp2: true, tp3: true, sl: true, invalidated: true, expired: false,
            },
            isMuted: false,
          },
        });
      } else {
        // Existing user: update identity fields
        if (telegramUserId && !user.telegramUserId) user.telegramUserId = telegramUserId;
        if (chatId && !user.chatId) user.chatId = chatId;
        if (fromUsername) user.telegramUsername = fromUsername;
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (languageCode) user.languageCode = languageCode;
      }

      // ALWAYS destroy the current session on /start (Part 6 requirement)
      await this.destroySession(user);
      console.log(`[TelegramBot] /start from telegramUserId=${telegramUserId}, chatId=${chatId} — session reset, re-auth required.`);

      // If a code was passed via deep link (/start <code>): try to verify it immediately
      if (inlineCode) {
        await this.handleConnectCode(chatId, user, inlineCode, fromUsername, firstName, telegramUserId);
        return;
      }

      // No code: show auth gate only
      await this.sendMessage(chatId, buildAuthGateMessage(firstName), {
        parse_mode: 'HTML',
        reply_markup: AUTH_GATE_KEYBOARD,
      });
      return;
    }

    // For all other messages: we need a user record
    if (!user) {
      // Complete stranger, no record at all
      await this.sendMessage(chatId, `🔐 <b>Verification Required</b>\n\nPlease send /start to begin the authentication process.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    // Update identity fields on any interaction
    if (telegramUserId && !user.telegramUserId) user.telegramUserId = telegramUserId;
    if (chatId && user.chatId !== chatId) user.chatId = chatId;
    user.lastActiveAt = new Date();
    // (save happens below or in specific handlers)

    // ── /revoke or /disconnect ───────────────────────────────────────────
    if (command === '/revoke' || command === '/disconnect') {
      await this.destroySession(user);
      user.isAuthorized = false;
      user.isConnected = false;
      user.connectionCode = undefined;
      user.codeExpiresAt = undefined;
      user.verificationCodeHash = undefined;
      user.verificationExpiresAt = undefined;
      await user.save();

      await this.sendMessage(chatId,
        `🔒 <b>Session Terminated</b>\n\nYour bot session has been ended. Send /start to begin a new authentication session.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // ── 5/6-digit code submission (raw text) ─────────────────────────────
    const isNumericCode = /^\d{5,6}$/.test(rawText.trim());
    if (isNumericCode) {
      await this.handleVerifyCode(chatId, user, rawText.trim(), telegramUserId);
      return;
    }

    // ── /verify <code> ───────────────────────────────────────────────────
    if (command.startsWith('/verify')) {
      const codeInput = rawText.split(' ')[1]?.trim();
      await this.handleVerifyCode(chatId, user, codeInput, telegramUserId);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // AUTHENTICATION GUARD — All protected commands below this line
    // The session must be active and non-expired.
    // ─────────────────────────────────────────────────────────────────────
    if (!this.isUserAuthenticated(user)) {
      await user.save(); // save lastActiveAt update
      await this.sendMessage(chatId,
        `🔐 <b>Authentication Required</b>\n\nYour session has expired or is not active.\n\nSend /start to begin a new verification session, then enter your code from the web dashboard.`,
        {
          parse_mode: 'HTML',
          reply_markup: AUTH_GATE_KEYBOARD,
        }
      );
      return;
    }

    // Authenticated: touch session activity
    await this.touchSession(user);

    // ── /connect <code> (alternative to deep link) ──────────────────────
    if (command.startsWith('/connect')) {
      const code = rawText.split(' ')[1]?.trim();
      if (!code) {
        await this.sendMessage(chatId, '⚠️ Usage: <code>/connect YOUR_CODE</code>\n\nGenerate a code from the web dashboard first.', { parse_mode: 'HTML' });
        return;
      }
      // If already authenticated, they don't need to reconnect
      await this.sendMessage(chatId, '✅ <b>You are already authenticated.</b>\n\nYour session is active. Use the menu to access setups.', {
        parse_mode: 'HTML',
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      return;
    }

    // ── /help ────────────────────────────────────────────────────────────
    if (command === '/help') {
      const helpMsg =
        `📖 <b>SMC Bot Command Guide:</b>\n\n` +
        `• <code>/setups</code> — View ALL active high-quality SMC setups\n` +
        `• <code>/status</code> — Live feed status &amp; active setups summary\n` +
        `• <code>/watchlist</code> — Show your monitored instruments\n` +
        `• <code>/add &lt;symbol&gt;</code> — Add pair (e.g. <code>/add EURUSD</code>)\n` +
        `• <code>/remove &lt;symbol&gt;</code> — Remove pair from watchlist\n` +
        `• <code>/settings</code> — View alert preferences\n` +
        `• <code>/alerts</code> — View recent alert history\n` +
        `• <code>/stop</code> — Pause all notifications\n` +
        `• <code>/resume</code> — Resume notifications\n` +
        `• <code>/start</code> — Begin a new session (requires re-verification)\n\n` +
        `<i>To revoke access: send /revoke</i>`;

      await this.sendMessage(chatId, helpMsg, { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }

    // ── /status ──────────────────────────────────────────────────────────
    if (command === '/status') {
      const openSetups = await activeSetupService.getActiveSetups();
      const sessionExpiresIn = user.sessionExpiresAt
        ? Math.max(0, Math.round((new Date(user.sessionExpiresAt).getTime() - Date.now()) / 60000))
        : 0;
      const statusMsg =
        `📊 <b>SMC Analyzer Live System Status:</b>\n\n` +
        `🤖 <b>Bot Engine:</b> 🟢 Operational (@${config.telegramBotUsername})\n` +
        `📡 <b>Market Feeds:</b> 🟢 Live\n` +
        `🔒 <b>Session:</b> 🟢 Active (expires in ${sessionExpiresIn}m)\n` +
        `🔔 <b>Notifications:</b> ${user.settings.isMuted ? '🔴 Paused (/resume)' : '🟢 Active'}\n` +
        `🎯 <b>Min Quality:</b> Grade <b>${user.settings.minQuality}</b>\n` +
        `🛡️ <b>News Protection:</b> ${user.settings.newsFilter}\n` +
        `📋 <b>Watchlist (${user.watchlist.length}):</b> ${user.watchlist.join(', ')}\n` +
        `📈 <b>Active Setups in DB:</b> <b>${openSetups.length} Open</b>\n\n` +
        `<i>Web Terminal: ${config.frontendOrigin}</i>`;

      await this.sendMessage(chatId, statusMsg, { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }

    // ── /watchlist ───────────────────────────────────────────────────────
    if (command === '/watchlist') {
      const list = user.watchlist.map((s: string) => `• <b>${s}</b>`).join('\n');
      await this.sendMessage(chatId,
        `📋 <b>Your Monitored Watchlist:</b>\n\n${list}\n\n<i>Add/remove: <code>/add EURUSD</code> or <code>/remove EURUSD</code></i>`,
        { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD }
      );
      return;
    }

    // ── /add <symbol> ────────────────────────────────────────────────────
    if (command.startsWith('/add')) {
      const sym = rawText.split(' ')[1]?.trim().toUpperCase().replace('/', '');
      if (!sym) {
        await this.sendMessage(chatId, '⚠️ Please specify a symbol. Example: <code>/add EURUSD</code>', { parse_mode: 'HTML' });
        return;
      }
      const supported = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'US500', 'NAS100'];
      const mapping = getInstrumentMapping(sym);
      if (!mapping && !supported.includes(sym)) {
        await this.sendMessage(chatId, `⚠️ Symbol <b>${escapeHtml(sym)}</b> is not supported.\nSupported: ${supported.join(', ')}.`, { parse_mode: 'HTML' });
        return;
      }
      if (!user.watchlist.includes(sym)) {
        user.watchlist.push(sym);
        await user.save();
        await this.sendMessage(chatId, `✅ Added <b>${escapeHtml(sym)}</b>. Watchlist: ${user.watchlist.join(', ')}`, { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      } else {
        await this.sendMessage(chatId, `ℹ️ <b>${escapeHtml(sym)}</b> is already in your watchlist.`, { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      }
      return;
    }

    // ── /remove <symbol> ─────────────────────────────────────────────────
    if (command.startsWith('/remove')) {
      const sym = rawText.split(' ')[1]?.trim().toUpperCase().replace('/', '');
      if (!sym) {
        await this.sendMessage(chatId, '⚠️ Please specify a symbol. Example: <code>/remove EURUSD</code>', { parse_mode: 'HTML' });
        return;
      }
      user.watchlist = user.watchlist.filter((s: string) => s !== sym);
      await user.save();
      await this.sendMessage(chatId, `✅ Removed <b>${escapeHtml(sym)}</b>. Watchlist: ${user.watchlist.join(', ') || 'Empty'}`, { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }

    // ── /stop & /resume ──────────────────────────────────────────────────
    if (command === '/stop') {
      user.settings.isMuted = true;
      await user.save();
      await this.sendMessage(chatId, '🔕 <b>Alerts Paused.</b> Send /resume to reactivate.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }
    if (command === '/resume') {
      user.settings.isMuted = false;
      await user.save();
      await this.sendMessage(chatId, '🔔 <b>Alerts Resumed.</b> You will now receive high-quality SMC setup notifications.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }

    // ── /settings ────────────────────────────────────────────────────────
    if (command === '/settings') {
      const s = user.settings;
      const settingsMsg =
        `⚙️ <b>Your Alert Preferences:</b>\n\n` +
        `• <b>Min Setup Quality:</b> ${s.minQuality}\n` +
        `• <b>News Filter:</b> ${s.newsFilter}\n` +
        `• <b>Active Sessions:</b> ${s.sessions.join(', ')}\n` +
        `• <b>Timeframes:</b> HTF: ${s.timeframes.htf} | Setup: ${s.timeframes.setup} | Entry: ${s.timeframes.entry}\n` +
        `• <b>Status:</b> ${s.isMuted ? '🔴 Paused' : '🟢 Active'}\n\n` +
        `<i>Customize from Web Terminal for fine-grained control.</i>`;

      await this.sendMessage(chatId, settingsMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          ...MAIN_MENU_KEYBOARD,
          inline_keyboard: [[
            { text: s.isMuted ? '🔔 Resume Alerts' : '🔕 Pause Alerts', callback_data: s.isMuted ? 'action_resume' : 'action_stop' },
          ]],
        },
      });
      return;
    }

    // ── /setups ──────────────────────────────────────────────────────────
    if (command === '/setups') {
      const openSetups = await activeSetupService.getActiveSetups();
      if (openSetups.length === 0) {
        await this.sendMessage(chatId,
          'ℹ️ <b>No Active Open Setups in Database</b>\n\nThe background scanner is continuously evaluating watchlist pairs for high-confluence Grade A setups.',
          { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD }
        );
        return;
      }

      let msg = `📊 <b>ACTIVE SETUPS — ${openSetups.length}</b>\n\n` +
        `<i>Tap any setup button below to view detailed evidence and structural reasoning:</i>\n\n`;

      const inlineKeyboardButtons: InlineKeyboardButton[][] = [];
      openSetups.forEach((a: any, idx: number) => {
        const isBull = a.direction === 'BULLISH';
        const icon = isBull ? '🟢' : '🔴';
        const tp1 = a.takeProfit1;
        const tp2 = a.takeProfit2 || a.targetPrice;
        const tp3 = a.takeProfit3;
        msg +=
          `<b>${idx + 1}. ${icon} ${a.symbol} (${a.timeframe}) — ${a.direction}</b>\n` +
          `• <b>ID:</b> <code>${a.analysisId}</code>\n` +
          `• <b>Entry:</b> <code>${a.entryPrice}</code> | <b>SL:</b> <code>${a.stopLossPrice}</code>\n` +
          (tp1 != null ? `• <b>TP1:</b> <code>${tp1}</code>\n` : '') +
          `• <b>TP2:</b> <code>${tp2}</code> (<b>${a.riskRewardRatio}R</b>)\n` +
          (tp3 != null ? `• <b>TP3:</b> <code>${tp3}</code>\n` : '') +
          `• <b>Grade:</b> ${a.setupQuality?.grade} (${a.setupQuality?.totalScore}/100)\n\n`;

        const btnText = `${icon} ${a.symbol} (${a.direction})`;
        if (idx % 2 === 0) {
          inlineKeyboardButtons.push([{ text: btnText, callback_data: `view_setup_${a.analysisId}` }]);
        } else {
          inlineKeyboardButtons[inlineKeyboardButtons.length - 1].push({ text: btnText, callback_data: `view_setup_${a.analysisId}` });
        }
      });

      await this.sendMessage(chatId, msg, {
        parse_mode: 'HTML',
        reply_markup: { ...MAIN_MENU_KEYBOARD, inline_keyboard: inlineKeyboardButtons },
      });
      return;
    }

    // ── /alerts ──────────────────────────────────────────────────────────
    if (command === '/alerts') {
      const logs = await TelegramAlertLog.find({ chatId }).sort({ sentAt: -1 }).limit(8).lean();
      if (logs.length === 0) {
        await this.sendMessage(chatId, 'ℹ️ No recent alert notifications logged for your account.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      let logMsg = `📜 <b>Recent Alert Notifications (${logs.length}):</b>\n\n`;
      for (const l of logs) {
        logMsg += `• <b>${l.alertType}</b> — ${l.symbol} (${new Date(l.sentAt).toLocaleTimeString()} UTC)\n` +
          `  <i>${l.stage} — Status: ${l.deliveryStatus}</i>\n\n`;
      }
      await this.sendMessage(chatId, logMsg, { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }

    // Fallback
    await this.sendMessage(chatId,
      `ℹ️ Command not recognized. Use the menu buttons below or type <code>/help</code>.`,
      { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACK QUERY HANDLER — Auth check at ENTRY, before any data access
  // ─────────────────────────────────────────────────────────────────────────

  private async handleCallbackQuery(cb: any): Promise<void> {
    const chatId: number = cb.message?.chat?.id;
    const telegramUserId: number = cb.from?.id;
    const data: string = cb.data;
    if (!chatId || !data) return;

    // Acknowledge the callback (prevents Telegram "loading" spinner)
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id }),
      });
    } catch { /* non-critical */ }

    // ── UNAUTHENTICATED CALLBACKS (safe to handle without auth) ──────────
    if (data === 'cmd_how_to_connect') {
      await this.sendMessage(chatId,
        `🌐 <b>How to Connect:</b>\n\n` +
        `1. Open the web dashboard: <code>${config.frontendOrigin}</code>\n` +
        `2. Click <b>Telegram</b> → <b>Generate Connection Code</b>\n` +
        `3. Copy the 6-digit code\n` +
        `4. Return here and send the code as a plain message\n\n` +
        `<i>Codes expire in 10 minutes and are single-use.</i>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // ── AUTHENTICATION GUARD FOR ALL PROTECTED CALLBACKS ─────────────────
    // Look up user by telegramUserId (authoritative), fallback to chatId
    const user = telegramUserId
      ? await TelegramUser.findOne({ telegramUserId })
      : await TelegramUser.findOne({ chatId });

    if (!this.isUserAuthenticated(user)) {
      const firstName = cb.from?.first_name || 'Trader';
      await this.sendMessage(chatId,
        `🔐 <b>Authentication Required</b>\n\nSend /start to begin a new verification session, then enter your code from the web dashboard.`,
        { parse_mode: 'HTML', reply_markup: AUTH_GATE_KEYBOARD }
      );
      return;
    }

    // Authenticated: touch session
    await this.touchSession(user!);

    // ── PROTECTED CALLBACKS ──────────────────────────────────────────────
    if (data === 'action_stop') {
      await TelegramUser.updateOne({ _id: user!._id }, { $set: { 'settings.isMuted': true } });
      await this.sendMessage(chatId, '🔕 Alerts Paused. Use /resume to reactivate.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
    } else if (data === 'action_resume') {
      await TelegramUser.updateOne({ _id: user!._id }, { $set: { 'settings.isMuted': false } });
      await this.sendMessage(chatId, '🔔 Alerts Resumed.', { parse_mode: 'HTML', reply_markup: MAIN_MENU_KEYBOARD });
    } else if (data === 'cmd_setups') {
      await this.handleIncomingMessage({ chat: { id: chatId }, from: cb.from, text: '/setups' });
    } else if (data === 'cmd_watchlist') {
      await this.handleIncomingMessage({ chat: { id: chatId }, from: cb.from, text: '/watchlist' });
    } else if (data === 'cmd_settings') {
      await this.handleIncomingMessage({ chat: { id: chatId }, from: cb.from, text: '/settings' });
    } else if (data === 'cmd_status') {
      await this.handleIncomingMessage({ chat: { id: chatId }, from: cb.from, text: '/status' });
    } else if (data === 'cmd_terminal_info') {
      await this.sendMessage(chatId,
        `🌐 <b>SMC Market Analyzer Web Terminal:</b>\n<code>${config.frontendOrigin}</code>`,
        { parse_mode: 'HTML' }
      );
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
        .map((e: any) => `${e.passed ? '✓' : '✗'} <b>${escapeHtml(e.label)}:</b> ${escapeHtml(e.note)}`)
        .join('\n');

      const detailMsg =
        `📊 <b>${icon} ${escapeHtml(d.symbol)} — ${d.direction} SETUP DETAILS</b>\n` +
        `<code>Setup ID: ${d.analysisId}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎯 <b>SETUP MODEL:</b>\n<code>${escapeHtml(d.setupModel)}</code>\n\n` +
        `⚡ <b>TRIGGER:</b>\n<i>${escapeHtml(d.trigger)}</i>\n\n` +
        `💡 <b>WHY THIS SETUP EXISTS:</b>\n${escapeHtml(d.whyOccurred)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧠 <b>STRUCTURAL EVIDENCE CHECKLIST:</b>\n${evidenceList}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 <b>ENTRY ZONE:</b> <code>${d.entryPrice}</code>\n` +
        `<i>${escapeHtml(d.entryReason)}</i>\n\n` +
        `🛑 <b>INVALIDATION:</b> <code>${d.invalidationPrice}</code>\n` +
        `<i>${escapeHtml(d.invalidationReason)}</i>\n\n` +
        `🎯 <b>TAKE PROFITS:</b>\n` +
        (d.takeProfit1 != null ? `• <b>TP1</b> (Partial): <code>${d.takeProfit1}</code>\n` : '') +
        `• <b>TP2</b> (Primary): <code>${d.targetPrice}</code> (<b>${d.riskRewardRatio}R</b>)\n` +
        (d.takeProfit3 != null ? `• <b>TP3</b> (Runner): <code>${d.takeProfit3}</code>\n` : '') +
        `<i>${escapeHtml(d.targetReason)}</i>\n\n` +
        `📡 <b>CURRENT MONITORING:</b>\n` +
        `• <b>Status:</b> ${escapeHtml(d.currentMonitoringState.monitoringStatus)}\n` +
        `• <b>Grade:</b> ${d.quality.grade} (${d.quality.totalScore}/100)`;

      await this.sendMessage(chatId, detailMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '◀ Back to Active Setups', callback_data: 'cmd_setups' }]],
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONNECT CODE HANDLER — Called after /start <code> deep link
  // Validates the website-generated connectionCode and creates a session
  // ─────────────────────────────────────────────────────────────────────────

  private async handleConnectCode(
    chatId: number,
    user: any,
    code: string,
    telegramUsername: string,
    firstName: string,
    telegramUserId?: number
  ): Promise<void> {
    const now = new Date();
    const codeUpper = code.toUpperCase().trim();

    // Find web account record that has this code pending
    const codeOwner = await TelegramUser.findOne({
      connectionCode: codeUpper,
      codeExpiresAt: { $gt: now },
    });

    if (!codeOwner) {
      await this.sendMessage(chatId,
        `❌ <b>Invalid or Expired Code</b>\n\nThis connection code is not valid or has expired.\n\nPlease generate a fresh code from the web dashboard and try again.`,
        { parse_mode: 'HTML', reply_markup: AUTH_GATE_KEYBOARD }
      );
      return;
    }

    // Link Telegram identity to the web account record
    codeOwner.telegramUserId = telegramUserId || undefined;
    codeOwner.chatId = chatId;
    codeOwner.telegramUsername = telegramUsername;
    codeOwner.firstName = firstName;
    codeOwner.isConnected = true;
    codeOwner.connectedAt = now;
    codeOwner.connectionCode = undefined; // Single-use: consumed
    codeOwner.codeExpiresAt = undefined;
    codeOwner.failedAuthAttempts = 0;
    codeOwner.codeLockedUntil = undefined;

    // Remove temporary or duplicate user doc BEFORE saving codeOwner to avoid unique index violation on telegramUserId
    const targetTgId = telegramUserId || undefined;
    if (targetTgId) {
      await TelegramUser.deleteMany({
        _id: { $ne: codeOwner._id },
        $or: [{ telegramUserId: targetTgId }, { chatId }],
      });
    } else if (user && user.id !== codeOwner.id && user.userId.startsWith('tg_')) {
      try { await user.deleteOne(); } catch { /* ignore */ }
    }

    // Create authenticated session
    await this.createSession(codeOwner, now);

    console.log(`[TelegramBot] Telegram user ${telegramUserId} authenticated via code. Session created.`);

    const successMsg =
      `✅ <b>AUTHENTICATION SUCCESSFUL — ACCESS GRANTED</b>\n\n` +
      `Welcome to the <b>SMC Institutional Signal Engine</b>, <b>${escapeHtml(firstName)}</b>!\n\n` +
      `⚡ <b>Privileges Unlocked:</b>\n` +
      `• Real-Time Grade A/A+ Trade Setup Alerts\n` +
      `• Automatic Entry Approaching &amp; Trigger Notifications\n` +
      `• Live Target Hit &amp; Invalidation Updates\n` +
      `• Complete Structural Evidence Inspections\n\n` +
      `<b>Active Watchlist:</b> ${codeOwner.watchlist.join(', ')}\n\n` +
      `Use the menu below to explore active setups:`;

    await this.sendMessage(chatId, successMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        ...MAIN_MENU_KEYBOARD,
        inline_keyboard: [
          [{ text: '🎯 Active Setups', callback_data: 'cmd_setups' }, { text: '📡 Watchlist', callback_data: 'cmd_watchlist' }],
        ],
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFY CODE — For raw 5/6-digit text input after /start
  // ─────────────────────────────────────────────────────────────────────────

  public async handleVerifyCode(chatId: number, user: any, codeInput?: string, telegramUserId?: number): Promise<void> {
    if (!codeInput || !/^\d{5,6}$/.test(codeInput.trim())) {
      await this.sendMessage(chatId,
        `⚠️ Please send your 5 or 6-digit verification code as a plain message.\n\nGenerate a code from the web dashboard first.`,
        { parse_mode: 'HTML', reply_markup: AUTH_GATE_KEYBOARD }
      );
      return;
    }

    const now = new Date();

    // ── Lockout check ───────────────────────────────────────────────────
    if (user.codeLockedUntil && now < new Date(user.codeLockedUntil)) {
      const waitMin = Math.ceil((new Date(user.codeLockedUntil).getTime() - now.getTime()) / 60000);
      await this.sendMessage(chatId,
        `🔒 <b>Too Many Failed Attempts</b>\n\nYour account is temporarily locked. Please wait <b>${waitMin} minute(s)</b> before trying again.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Look for a web account record with this connection code
    const codeUpper = codeInput.trim().toUpperCase();
    const codeOwner = await TelegramUser.findOne({
      connectionCode: codeUpper,
      codeExpiresAt: { $gt: now },
    });

    if (!codeOwner) {
      // Check if code exists but expired (give better error message)
      const expiredRecord = await TelegramUser.findOne({ connectionCode: codeUpper });
      if (expiredRecord) {
        await this.sendMessage(chatId,
          `⌛ <b>Code Expired</b>\n\nThis verification code has expired (10-minute limit).\nPlease generate a new code from the web dashboard.`,
          { parse_mode: 'HTML', reply_markup: AUTH_GATE_KEYBOARD }
        );
        return;
      }

      // Invalid code: increment failure counter
      user.failedAuthAttempts = (user.failedAuthAttempts || 0) + 1;
      user.lastFailedAuthAt = now;

      const hashPrefix = `${codeUpper.slice(0, 4)}**`;
      user.verificationHistory = [
        ...(user.verificationHistory || []).slice(-9),
        { timestamp: now, success: false, codeHashPrefix: hashPrefix },
      ];

      if (user.failedAuthAttempts >= MAX_CODE_ATTEMPTS) {
        user.codeLockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
        await user.save();
        await this.sendMessage(chatId,
          `❌ <b>Too Many Failed Attempts</b>\n\nYour account has been temporarily locked for 15 minutes.\nGenerate a new code from the web dashboard after the lockout expires.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const remaining = MAX_CODE_ATTEMPTS - user.failedAuthAttempts;
      await user.save();
      await this.sendMessage(chatId,
        `❌ <b>Invalid Verification Code</b>\n\nThis code is not valid. Please check the code from your web dashboard.\n\n<i>${remaining} attempt(s) remaining before temporary lockout.</i>`,
        { parse_mode: 'HTML', reply_markup: AUTH_GATE_KEYBOARD }
      );
      return;
    }

    // Valid code found: link and authenticate
    codeOwner.telegramUserId = telegramUserId || user.telegramUserId;
    codeOwner.chatId = chatId;
    codeOwner.telegramUsername = user.telegramUsername;
    codeOwner.firstName = user.firstName;
    codeOwner.isConnected = true;
    codeOwner.connectedAt = now;
    codeOwner.connectionCode = undefined; // Single-use: consumed immediately
    codeOwner.codeExpiresAt = undefined;
    codeOwner.failedAuthAttempts = 0;
    codeOwner.codeLockedUntil = undefined;

    const hashPrefix = `${codeUpper.slice(0, 4)}**`;
    codeOwner.verificationHistory = [
      ...(codeOwner.verificationHistory || []).slice(-9),
      { timestamp: now, success: true, codeHashPrefix: hashPrefix },
    ];

    // Remove temporary or duplicate user doc BEFORE saving codeOwner to avoid unique index violation on telegramUserId
    const targetTgId = telegramUserId || user?.telegramUserId;
    if (targetTgId) {
      await TelegramUser.deleteMany({
        _id: { $ne: codeOwner._id },
        $or: [{ telegramUserId: targetTgId }, { chatId }],
      });
    } else if (user && user.id !== codeOwner.id && user.userId.startsWith('tg_')) {
      try { await user.deleteOne(); } catch { /* ignore */ }
    }

    await this.createSession(codeOwner, now);

    console.log(`[TelegramBot] Telegram user ${telegramUserId} authenticated via code input. Session created.`);

    const successMsg =
      `✅ <b>VERIFICATION SUCCESSFUL — ACCESS GRANTED</b>\n\n` +
      `Welcome to the <b>SMC Institutional Signal Engine</b>!\n\n` +
      `⚡ <b>Privileges Unlocked:</b>\n` +
      `• Real-Time Grade A/A+ Trade Setup Alerts\n` +
      `• Automatic Entry Approaching &amp; Trigger Notifications\n` +
      `• Live Target Hit &amp; Invalidation Updates\n` +
      `• Complete Structural Evidence Inspections\n\n` +
      `Use the menu below to explore active setups:`;

    await this.sendMessage(chatId, successMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        ...MAIN_MENU_KEYBOARD,
        inline_keyboard: [
          [{ text: '🎯 Active Setups', callback_data: 'cmd_setups' }, { text: '📡 Watchlist', callback_data: 'cmd_watchlist' }],
        ],
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Kept for backward compatibility with handleRequestVerificationCode
  // calls from old code paths — now returns an error since codes are website-only
  // ─────────────────────────────────────────────────────────────────────────
  public async handleRequestVerificationCode(chatId: number, _user: any): Promise<void> {
    await this.sendMessage(chatId,
      `🌐 <b>Verification Codes Are Generated on the Web Dashboard</b>\n\n` +
      `For security, codes can only be generated from the authenticated web interface.\n\n` +
      `Open: <code>${config.frontendOrigin}</code>\n` +
      `Navigate to <b>Telegram → Generate Code</b>\n` +
      `Then enter the code here.`,
      { parse_mode: 'HTML', reply_markup: AUTH_GATE_KEYBOARD }
    );
  }
}

export const telegramBot = new TelegramBotService();
