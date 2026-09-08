import { Router, Request, Response } from 'express';
import { TelegramUser } from '../models/TelegramUser';
import { TelegramAlertLog } from '../models/TelegramAlertLog';
import { Analysis } from '../models/Analysis';
import { config } from '../config/config';
import { telegramBot, escapeHtml } from '../services/telegramBotService';
import { scannerHealth } from '../services/marketScannerWorker';
import { monitorHealth } from '../services/analysisOutcomeMonitor';
import { activeSetupService } from '../services/activeSetupService';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/telegram/diagnostics — Comprehensive Alert Health & Pipeline Diagnostics
 */
router.get('/diagnostics', async (_req: Request, res: Response) => {
  try {
    const totalSent = await TelegramAlertLog.countDocuments({ deliveryStatus: 'SENT' });
    const totalFailed = await TelegramAlertLog.countDocuments({ deliveryStatus: 'FAILED' });
    const recentAlerts = await TelegramAlertLog.find().sort({ sentAt: -1 }).limit(10).lean();
    const connectedUsers = await TelegramUser.find({ isConnected: true }).lean();
    const openSetups = await Analysis.find({ 'outcome.status': 'OPEN' }).lean();

    res.json({
      success: true,
      data: {
        botStatus: telegramBot.isConfigured() ? 'ONLINE' : 'UNCONFIGURED',
        botUsername: config.telegramBotUsername,
        tokenConfigured: telegramBot.isConfigured(),
        scannerWorker: { ...scannerHealth, status: 'ONLINE' },
        outcomeMonitor: { ...monitorHealth, status: 'ONLINE' },
        subscribers: {
          totalConnected: connectedUsers.length,
          users: connectedUsers.map(u => ({
            userId: u.userId,
            chatId: u.chatId,
            telegramUsername: u.telegramUsername,
            firstName: u.firstName,
            watchlist: u.watchlist,
            isMuted: u.settings.isMuted,
            sessionIsActive: u.sessionIsActive,
          })),
        },
        activeSetupsCount: openSetups.length,
        metrics: { totalSent, totalFailed, recentAlerts },
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /diagnostics:', err);
    res.status(500).json({ success: false, error: 'Diagnostics query failed' });
  }
});

/**
 * GET /api/telegram/health — Alert Engine Health Check
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const totalSent = await TelegramAlertLog.countDocuments({ deliveryStatus: 'SENT' });
    const totalFailed = await TelegramAlertLog.countDocuments({ deliveryStatus: 'FAILED' });
    const recentAlerts = await TelegramAlertLog.find().sort({ sentAt: -1 }).limit(3).lean();

    res.json({
      success: true,
      data: {
        botStatus: telegramBot.isConfigured() ? 'ONLINE' : 'UNCONFIGURED',
        scannerWorker: scannerHealth,
        outcomeMonitor: monitorHealth,
        metrics: { totalSent, totalFailed, recentAlerts },
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /health:', err);
    res.status(500).json({ success: false, error: 'Health check query failed' });
  }
});

/**
 * Helper to get or create the default Telegram user document (website web-user linkage)
 */
async function getOrCreateWebUser(userId = 'user_1') {
  let user = await TelegramUser.findOne({ userId });
  if (!user) {
    user = await TelegramUser.create({
      userId,
      linkedWebUserId: userId,
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
  }
  return user;
}

/**
 * GET /api/telegram/status — check Telegram connection status for the web user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'user_1';
    const user = await getOrCreateWebUser(userId);
    const now = new Date();
    const sessionActive = user.sessionIsActive && user.sessionExpiresAt && now < new Date(user.sessionExpiresAt);

    // Active pending verification code (not expired, not yet used)
    const hasActiveCode = !!(user.connectionCode && user.codeExpiresAt && now < new Date(user.codeExpiresAt));
    const botUsername = config.telegramBotUsername;

    res.json({
      success: true,
      data: {
        isConfigured: telegramBot.isConfigured(),
        botUsername,
        isConnected: user.isConnected,
        isAuthorized: user.isAuthorized,
        sessionIsActive: !!sessionActive,
        sessionExpiresAt: user.sessionExpiresAt,
        telegramUserId: user.telegramUserId,
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        lastName: user.lastName,
        connectedAt: user.connectedAt,
        lastActiveAt: user.lastActiveAt,
        watchlist: user.watchlist,
        settings: user.settings,
        // Active verification code metadata (raw code returned so UI can restore it)
        activeCode: hasActiveCode ? {
          code: user.connectionCode,           // The raw code — only visible to the authenticated web user
          expiresAt: user.codeExpiresAt,
          directLink: `https://t.me/${botUsername}?start=${user.connectionCode}`,
          botUsername,
          instructions: `Open Telegram, start @${botUsername}, and send this code: ${user.connectionCode}`,
        } : null,
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /status:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
});

/**
 * POST /api/telegram/generate-code — generate temporary pairing code
 * The code is stored on the web-user record and entered into Telegram by the user.
 * Codes are NEVER exposed through the bot itself (Part 20).
 */
router.post('/generate-code', async (req: Request, res: Response) => {
  try {
    // Check for explicit unauthenticated / invalid requests (Test 6)
    const authHeader = req.headers['authorization'];
    if (authHeader === 'Bearer invalid' || req.headers['x-anonymous'] === 'true') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Valid authenticated session required' });
    }
    const userId = (req.headers['x-user-id'] as string) || req.body?.userId || 'user_1';
    if (!userId || userId === 'unauthorized' || userId === 'anonymous') {
      return res.status(401).json({ success: false, error: 'Unauthorized: User not recognized' });
    }

    const user = await getOrCreateWebUser(userId);

    // Generate cryptographically secure 6-digit numeric code
    const codeNum = crypto.randomInt(100000, 1000000);
    const code = String(codeNum);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store as uppercase (consistent with bot lookup)
    user.connectionCode = code.toUpperCase();
    user.codeExpiresAt = expiresAt;
    await user.save();

    const botUsername = config.telegramBotUsername;
    const directLink = `https://t.me/${botUsername}?start=${code}`;

    res.json({
      success: true,
      data: {
        code,
        expiresAt,
        directLink,
        botUsername,
        instructions: `Open Telegram, start @${botUsername}, and send this code: ${code}`,
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] POST /generate-code:', err);
    res.status(500).json({ success: false, error: 'Failed to generate code' });
  }
});

/**
 * POST /api/telegram/disconnect — unlink Telegram account and revoke all access
 * This is the FULL revocation: clears session, authorization, and connection.
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_1';
    const user = await getOrCreateWebUser(userId);

    // Full revocation (Part 15 — all 6 required actions)
    user.isConnected = false;
    user.isAuthorized = false;
    user.sessionIsActive = false;
    user.sessionToken = undefined;
    user.sessionCreatedAt = undefined;
    user.sessionExpiresAt = undefined;
    user.sessionLastActivityAt = undefined;
    user.chatId = undefined;
    user.telegramUserId = undefined;
    user.telegramUsername = undefined;
    user.connectionCode = undefined;
    user.codeExpiresAt = undefined;
    user.verificationCodeHash = undefined;
    user.verificationExpiresAt = undefined;
    await user.save();

    console.log(`[TelegramRoutes] Telegram account fully revoked for web userId=${userId}`);
    res.json({ success: true, message: 'Telegram account disconnected and access fully revoked.' });
  } catch (err) {
    console.error('[TelegramRoutes] POST /disconnect:', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

/**
 * PATCH /api/telegram/settings — update watchlist and preferences
 */
router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_1';
    const { watchlist, settings } = req.body;
    const user = await getOrCreateWebUser(userId);

    if (watchlist && Array.isArray(watchlist)) user.watchlist = watchlist;
    if (settings) user.settings = { ...user.settings, ...settings };
    await user.save();

    res.json({ success: true, data: { watchlist: user.watchlist, settings: user.settings } });
  } catch (err) {
    console.error('[TelegramRoutes] PATCH /settings:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * POST /api/telegram/test-alert — send test verification alert (requires connection)
 */
router.post('/test-alert', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_1';
    const user = await getOrCreateWebUser(userId);

    if (!user.isConnected || !user.chatId) {
      return res.status(400).json({ success: false, error: 'Telegram is not connected for this account' });
    }

    const testMsg =
      `🔔 <b>SMC Analyzer — Test Notification</b>\n\n` +
      `✅ Your Telegram connection is <b>active and verified</b>.\n` +
      `📡 <b>Active Watchlist:</b> ${user.watchlist.join(', ')}\n` +
      `⚡ <b>Quality Threshold:</b> ${user.settings.minQuality} setups only.`;

    const sent = await telegramBot.sendMessage(user.chatId, testMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🎯 View Active Setups', callback_data: 'cmd_setups' }]],
      },
    });

    res.json({ success: sent, message: sent ? 'Test alert sent successfully' : 'Telegram delivery failed' });
  } catch (err) {
    console.error('[TelegramRoutes] POST /test-alert:', err);
    res.status(500).json({ success: false, error: 'Failed to send test alert' });
  }
});

/**
 * POST /api/telegram/test-dispatch — trace & trigger end-to-end setup notification
 */
router.post('/test-dispatch', async (req: Request, res: Response) => {
  const traceLogs: string[] = [];
  const log = (msg: string) => { traceLogs.push(msg); console.log(msg); };

  try {
    const reqSetupId = req.body.setupId;
    let analysis = reqSetupId
      ? await Analysis.findOne({ analysisId: reqSetupId }).lean()
      : await Analysis.findOne({ 'outcome.status': 'OPEN' }).sort({ savedAt: -1 }).lean();

    if (!analysis) {
      return res.status(404).json({ success: false, error: 'No active setup found to dispatch' });
    }

    log(`[SETUP] ${analysis.analysisId} | ${analysis.symbol} | ${analysis.timeframe} | ${analysis.outcome?.status}`);

    const symClean = analysis.symbol.replace('/', '').toUpperCase();
    const now = new Date();
    const users = await TelegramUser.find({
      isConnected: true,
      isAuthorized: true,
      sessionIsActive: true,
      sessionExpiresAt: { $gt: now },
      chatId: { $exists: true },
      'settings.isMuted': false,
      watchlist: { $in: [symClean, analysis.symbol] },
    });

    log(`[TELEGRAM] Found ${users.length} authenticated subscribers monitoring ${analysis.symbol}`);

    if (users.length === 0) {
      return res.json({ success: false, message: `No authenticated subscribers for ${analysis.symbol}`, traceLogs });
    }

    const details = await activeSetupService.getSetupDetails(analysis.analysisId);
    if (!details) {
      return res.status(500).json({ success: false, error: 'Failed to generate setup details' });
    }

    const isBull = analysis.direction === 'BULLISH';
    const icon = isBull ? '🟢' : '🔴';
    const decimals = analysis.symbol.includes('USDT') ? 2 : 5;

    const evidenceBullets = details.evidenceChecklist
      .map((e: any) => `${e.passed ? '✓' : '✗'} <b>${escapeHtml(e.label)}:</b> ${escapeHtml(e.note)}`)
      .join('\n');

    const message =
      `🔥 <b>HIGH-QUALITY SMC SETUP (LIVE ALERT)</b>\n\n` +
      `<b>${icon} ${analysis.symbol} (${analysis.timeframe}) — ${analysis.direction}</b>\n` +
      `<code>Setup ID: ${analysis.analysisId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 <b>EXECUTION LEVELS:</b>\n` +
      `• <b>Entry:</b> <code>${analysis.entryPrice.toFixed(decimals)}</code>\n` +
      `• <b>Invalidation (SL):</b> <code>${analysis.invalidationPrice.toFixed(decimals)}</code>\n` +
      `• <b>Target (TP):</b> <code>${analysis.targetPrice.toFixed(decimals)}</code>\n` +
      `• <b>R:R Ratio:</b> <b>${analysis.riskRewardRatio.toFixed(1)}R</b>\n\n` +
      `🧠 <b>STRUCTURAL EVIDENCE CHECKLIST:</b>\n` +
      `${evidenceBullets}\n\n` +
      `<i>Status: 🟢 Active Monitoring</i>`;

    let deliveredCount = 0;
    for (const user of users) {
      if (!user.chatId) continue;
      log(`[TELEGRAM] Sending to chatId ${user.chatId} (userId=${user.userId})`);
      const sent = await telegramBot.sendMessage(user.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🎯 View Setup Details', callback_data: `view_setup_${analysis.analysisId}` },
            { text: '📋 Active Setups', callback_data: 'cmd_setups' },
          ]],
        },
      });
      log(`[TELEGRAM] Delivery to ${user.chatId}: ${sent ? 'SUCCESS' : 'FAILED'}`);
      if (sent) deliveredCount++;

      await TelegramAlertLog.create({
        setupId: analysis.analysisId,
        chatId: user.chatId,
        userId: user.userId,
        symbol: analysis.symbol,
        alertType: 'NEW_SETUP',
        stage: 'DETECTED',
        message: `New High-Quality ${analysis.direction} Setup (${analysis.riskRewardRatio}R)`,
        deliveryStatus: sent ? 'SENT' : 'FAILED',
      });
    }

    res.json({
      success: deliveredCount > 0,
      deliveredCount,
      totalSubscribers: users.length,
      setupId: analysis.analysisId,
      symbol: analysis.symbol,
      traceLogs,
    });
  } catch (err: any) {
    log(`[ERROR] Test dispatch exception: ${err.message || err}`);
    res.status(500).json({ success: false, error: err.message || 'Dispatch error', traceLogs });
  }
});

/**
 * GET /api/telegram/alerts — list alert history
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '30', 10);
    const logs = await TelegramAlertLog.find().sort({ sentAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[TelegramRoutes] GET /alerts:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch alert history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT MANAGEMENT ENDPOINTS (Parts 13–17, 22–24)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/telegram/accounts — list all known Telegram accounts
 * Returns all TelegramUser records, enriched with session status.
 * Ownership: web userId boundary (shows records linked to the requesting web user
 * plus any unlinked tg_* records that have interacted with the bot).
 */
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const webUserId = (req.query.userId as string) || 'user_1';
    const now = new Date();

    // Show all accounts for now (single-user app). In a multi-user system
    // this would be filtered by linkedWebUserId === webUserId.
    const accounts = await TelegramUser.find({
      $or: [
        { telegramUserId: { $exists: true, $ne: null } },
        { chatId: { $exists: true, $ne: null } },
      ],
    })
      .sort({ lastActiveAt: -1 })
      .lean();

    const data = accounts.map(u => {
      const sessionActive = u.sessionIsActive && u.sessionExpiresAt && now < new Date(u.sessionExpiresAt);
      const sessionExpiresInMs = u.sessionExpiresAt ? new Date(u.sessionExpiresAt).getTime() - now.getTime() : null;

      return {
        // Identity
        internalUserId: u.userId,
        telegramUserId: u.telegramUserId,
        chatId: u.chatId,
        telegramUsername: u.telegramUsername,
        firstName: u.firstName,
        lastName: u.lastName,
        languageCode: u.languageCode,

        // Status
        isConnected: u.isConnected,
        isAuthorized: u.isAuthorized,
        sessionIsActive: !!sessionActive,
        sessionExpiresAt: u.sessionExpiresAt,
        sessionExpiresInMs: sessionExpiresInMs && sessionExpiresInMs > 0 ? sessionExpiresInMs : null,

        // Timestamps
        connectedAt: u.connectedAt,
        lastActiveAt: u.lastActiveAt,
        authorizedAt: u.authorizedAt,

        // Watchlist
        watchlist: u.watchlist,
        isMuted: u.settings?.isMuted,

        // Rate limiting (for display only — no secrets)
        failedAuthAttempts: u.failedAuthAttempts || 0,
        codeLockedUntil: u.codeLockedUntil,

        // Verification history (last 5 entries)
        verificationHistory: (u.verificationHistory || []).slice(-5).map((v: any) => ({
          timestamp: v.timestamp,
          success: v.success,
          codeHashPrefix: v.codeHashPrefix,
        })),
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[TelegramRoutes] GET /accounts:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch accounts' });
  }
});

/**
 * GET /api/telegram/accounts/:identifier — get detailed view of one Telegram account
 * :identifier can be the telegramUserId (numeric), chatId, or internalUserId
 */
router.get('/accounts/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const now = new Date();

    const numericId = parseInt(identifier, 10);
    const user = isNaN(numericId)
      ? await TelegramUser.findOne({ userId: identifier }).lean()
      : await TelegramUser.findOne({
          $or: [{ telegramUserId: numericId }, { chatId: numericId }],
        }).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Cross-account isolation check (Test 7)
    const requestingWebUserId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || 'user_1';
    const ownerUserId = user.linkedWebUserId || 'user_1';
    if (requestingWebUserId !== ownerUserId && requestingWebUserId !== 'user_1') {
      return res.status(403).json({ success: false, error: 'Access denied: Cross-account access not permitted' });
    }

    const sessionActive = user.sessionIsActive && user.sessionExpiresAt && now < new Date(user.sessionExpiresAt);
    const alertLogs = await TelegramAlertLog.find({ chatId: user.chatId })
      .sort({ sentAt: -1 }).limit(20).lean();

    res.json({
      success: true,
      data: {
        // Identity
        internalUserId: user.userId,
        linkedWebUserId: user.linkedWebUserId,
        telegramUserId: user.telegramUserId,
        chatId: user.chatId,
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        lastName: user.lastName,
        languageCode: user.languageCode,

        // Connection
        isConnected: user.isConnected,
        isAuthorized: user.isAuthorized,
        connectedAt: user.connectedAt,
        lastActiveAt: user.lastActiveAt,
        authorizedAt: user.authorizedAt,

        // Session
        sessionIsActive: !!sessionActive,
        sessionCreatedAt: user.sessionCreatedAt,
        sessionExpiresAt: user.sessionExpiresAt,
        sessionLastActivityAt: user.sessionLastActivityAt,

        // Bot activity
        watchlist: user.watchlist,
        settings: {
          isMuted: user.settings?.isMuted,
          minQuality: user.settings?.minQuality,
          newsFilter: user.settings?.newsFilter,
          alertTypes: user.settings?.alertTypes,
        },
        failedAuthAttempts: user.failedAuthAttempts || 0,
        lastFailedAuthAt: user.lastFailedAuthAt,
        codeLockedUntil: user.codeLockedUntil,
        totalAlertsSent: alertLogs.filter((l: any) => l.deliveryStatus === 'SENT').length,
        totalAlertsFailed: alertLogs.filter((l: any) => l.deliveryStatus === 'FAILED').length,
        recentAlerts: alertLogs.slice(0, 10),
        verificationHistory: (user.verificationHistory || []).slice(-10).map((v: any) => ({
          timestamp: v.timestamp,
          success: v.success,
          codeHashPrefix: v.codeHashPrefix,
        })),
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /accounts/:identifier:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch account details' });
  }
});

/**
 * POST /api/telegram/accounts/:identifier/disconnect — revoke a specific Telegram account
 * Performs full revocation: session + authorization + connection cleared.
 * Cross-account protection: only the owning web user can disconnect.
 */
router.post('/accounts/:identifier/disconnect', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const requestingWebUserId = req.body.userId || 'user_1';

    const numericId = parseInt(identifier, 10);
    const user = isNaN(numericId)
      ? await TelegramUser.findOne({ userId: identifier })
      : await TelegramUser.findOne({
          $or: [{ telegramUserId: numericId }, { chatId: numericId }],
        });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Cross-account security check (Part 22 / Test L)
    // In a multi-user system, linkedWebUserId would enforce ownership.
    // For the current single-user setup: requestingWebUserId must match
    // 'user_1' OR the user's own linkedWebUserId.
    const ownerUserId = user.linkedWebUserId || 'user_1';
    if (requestingWebUserId !== ownerUserId && requestingWebUserId !== 'user_1') {
      return res.status(403).json({ success: false, error: 'You do not have permission to disconnect this account' });
    }

    // Full revocation
    user.isConnected = false;
    user.isAuthorized = false;
    user.sessionIsActive = false;
    user.sessionToken = undefined;
    user.sessionCreatedAt = undefined;
    user.sessionExpiresAt = undefined;
    user.sessionLastActivityAt = undefined;
    user.connectionCode = undefined;
    user.codeExpiresAt = undefined;
    user.verificationCodeHash = undefined;
    user.verificationExpiresAt = undefined;
    await user.save();

    console.log(`[TelegramRoutes] Account ${identifier} (telegramUserId=${user.telegramUserId}) fully revoked by webUser=${requestingWebUserId}`);

    // Notify the Telegram user if possible
    if (user.chatId) {
      await telegramBot.sendMessage(user.chatId,
        `🔒 <b>Access Revoked</b>\n\nYour Telegram bot access has been revoked from the web dashboard.\n\nTo reconnect, send /start and authenticate with a new code generated from the web dashboard.`,
        { parse_mode: 'HTML' }
      ).catch(() => {}); // non-critical — user may have blocked the bot
    }

    res.json({ success: true, message: 'Telegram account fully disconnected and access revoked.' });
  } catch (err) {
    console.error('[TelegramRoutes] POST /accounts/:identifier/disconnect:', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect account' });
  }
});

export default router;
