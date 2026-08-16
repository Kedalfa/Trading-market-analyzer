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
 * GET /api/telegram/diagnostics — Comprehensive End-to-End Alert Health & Pipeline Diagnostics
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
        scannerWorker: {
          ...scannerHealth,
          status: 'ONLINE',
        },
        outcomeMonitor: {
          ...monitorHealth,
          status: 'ONLINE',
        },
        subscribers: {
          totalConnected: connectedUsers.length,
          users: connectedUsers.map(u => ({
            userId: u.userId,
            chatId: u.chatId,
            telegramUsername: u.telegramUsername,
            firstName: u.firstName,
            watchlist: u.watchlist,
            isMuted: u.settings.isMuted,
          })),
        },
        activeSetupsCount: openSetups.length,
        metrics: {
          totalSent,
          totalFailed,
          recentAlerts,
        },
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /diagnostics:', err);
    res.status(500).json({ success: false, error: 'Diagnostics query failed' });
  }
});

/**
 * GET /api/telegram/health — Proactive Alert Engine Health Check
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
        metrics: {
          totalSent,
          totalFailed,
          recentAlerts,
        },
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /health:', err);
    res.status(500).json({ success: false, error: 'Health check query failed' });
  }
});

/**
 * Helper to get or create the default Telegram user document
 */
async function getOrCreateUser(userId = 'user_1') {
  let user = await TelegramUser.findOne({ userId });
  if (!user) {
    user = await TelegramUser.create({
      userId,
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
  }
  return user;
}

/**
 * GET /api/telegram/status — check Telegram connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'user_1';
    const user = await getOrCreateUser(userId);

    res.json({
      success: true,
      data: {
        isConfigured: telegramBot.isConfigured(),
        botUsername: config.telegramBotUsername,
        isConnected: user.isConnected,
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        connectedAt: user.connectedAt,
        watchlist: user.watchlist,
        settings: user.settings,
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] GET /status:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
});

/**
 * POST /api/telegram/generate-code — generate temporary pairing code
 */
router.post('/generate-code', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_1';
    const user = await getOrCreateUser(userId);

    // Generate random 6-character alphanumeric code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.connectionCode = code;
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
        instructions: `Open Telegram, search for @${botUsername} or click the link, and send: /connect ${code}`,
      },
    });
  } catch (err) {
    console.error('[TelegramRoutes] POST /generate-code:', err);
    res.status(500).json({ success: false, error: 'Failed to generate code' });
  }
});

/**
 * POST /api/telegram/disconnect — unlink Telegram account
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_1';
    const user = await getOrCreateUser(userId);

    user.isConnected = false;
    user.chatId = undefined;
    user.telegramUsername = undefined;
    user.connectionCode = undefined;
    user.codeExpiresAt = undefined;
    await user.save();

    res.json({ success: true, message: 'Telegram unlinked successfully' });
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

    const user = await getOrCreateUser(userId);
    if (watchlist && Array.isArray(watchlist)) {
      user.watchlist = watchlist;
    }
    if (settings) {
      user.settings = { ...user.settings, ...settings };
    }
    await user.save();

    res.json({ success: true, data: { watchlist: user.watchlist, settings: user.settings } });
  } catch (err) {
    console.error('[TelegramRoutes] PATCH /settings:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * POST /api/telegram/test-alert — send test verification alert
 */
router.post('/test-alert', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_1';
    const user = await getOrCreateUser(userId);

    if (!user.isConnected || !user.chatId) {
      return res.status(400).json({ success: false, error: 'Telegram is not connected for this account' });
    }

    const testMsg = `🔔 <b>SMC Analyzer — Test Notification</b>\n\n` +
      `✅ Your Telegram AI Structural Intelligence Alert connection is <b>active and verified</b>.\n` +
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
  const log = (msg: string) => {
    traceLogs.push(msg);
    console.log(msg);
  };

  try {
    const reqSetupId = req.body.setupId;
    let analysis = reqSetupId
      ? await Analysis.findOne({ analysisId: reqSetupId }).lean()
      : await Analysis.findOne({ 'outcome.status': 'OPEN' }).sort({ savedAt: -1 }).lean();

    if (!analysis) {
      return res.status(404).json({ success: false, error: 'No active setup found to dispatch' });
    }

    log(`[SETUP] Setup detected: setupId=${analysis.analysisId}, symbol=${analysis.symbol}, timeframe=${analysis.timeframe}, status=${analysis.outcome?.status || 'OPEN'}`);

    const symClean = analysis.symbol.replace('/', '').toUpperCase();
    const users = await TelegramUser.find({
      isConnected: true,
      chatId: { $exists: true },
      'settings.isMuted': false,
      watchlist: { $in: [symClean, analysis.symbol] },
    });

    log(`[TELEGRAM] Found ${users.length} connected subscribers monitoring ${analysis.symbol}`);

    if (users.length === 0) {
      return res.json({ success: false, message: `No active subscribers found monitoring ${analysis.symbol}`, traceLogs });
    }

    const details = await activeSetupService.getSetupDetails(analysis.analysisId);
    if (!details) {
      return res.status(500).json({ success: false, error: 'Failed to generate setup explanation details' });
    }

    const isBull = analysis.direction === 'BULLISH';
    const icon = isBull ? '🟢' : '🔴';
    const decimals = analysis.symbol.includes('USDT') ? 2 : 5;

    const evidenceBullets = details.evidenceChecklist
      .map(e => `${e.passed ? '✓' : '✗'} <b>${escapeHtml(e.label)}:</b> ${escapeHtml(e.note)}`)
      .join('\n');

    const message = `🔥 <b>HIGH-QUALITY SMC SETUP (LIVE ALERT)</b>\n\n` +
      `<b>${icon} ${analysis.symbol} (${analysis.timeframe}) — ${analysis.direction}</b>\n` +
      `<code>Setup ID: ${analysis.analysisId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎯 <b>SETUP MODEL:</b>\n` +
      `<code>${escapeHtml(details.setupModel)}</code>\n\n` +
      `⚡ <b>TRIGGER:</b>\n` +
      `<i>${escapeHtml(details.trigger)}</i>\n\n` +
      `💡 <b>WHY THIS SETUP EXISTS:</b>\n` +
      `${escapeHtml(details.whyOccurred)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 <b>EXECUTION LEVELS:</b>\n` +
      `• <b>Entry:</b> <code>${analysis.entryPrice.toFixed(decimals)}</code>\n` +
      `• <b>Invalidation (SL):</b> <code>${analysis.invalidationPrice.toFixed(decimals)}</code>\n` +
      `• <b>Target (TP):</b> <code>${analysis.targetPrice.toFixed(decimals)}</code>\n` +
      `• <b>R:R Ratio:</b> <b>${analysis.riskRewardRatio.toFixed(1)}R</b>\n` +
      `• <b>Confidence:</b> Grade <b>${analysis.setupQuality.grade}</b> (${analysis.setupQuality.totalScore}/100)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🧠 <b>STRUCTURAL EVIDENCE CHECKLIST:</b>\n` +
      `${evidenceBullets}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Status: 🟢 Active Monitoring</i>`;

    let deliveredCount = 0;

    for (const user of users) {
      if (!user.chatId) continue;
      log(`[TELEGRAM] User resolved: userId=${user.userId}, chatId=${user.chatId}, firstName=${user.firstName}`);
      log(`[TELEGRAM] Sending setup message to chatId ${user.chatId}...`);

      const sent = await telegramBot.sendMessage(user.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎯 View Setup Details', callback_data: `view_setup_${analysis.analysisId}` },
              { text: '📋 Active Setups', callback_data: 'cmd_setups' },
            ],
          ],
        },
      });

      log(`[TELEGRAM] Telegram API response for ${user.chatId}: ${sent ? 'HTTP 200 SUCCESS' : 'FAILED'}`);

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

export default router;
