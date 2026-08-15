import { Router, Request, Response } from 'express';
import { UserSettings } from '../models/UserSettings';

const router = Router();

const DEFAULT_USER = 'default';

/**
 * GET /api/settings — get user settings (single user mode: userId = 'default')
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Upsert: if no settings doc exists yet, create with defaults
    let settings = await UserSettings.findOne({ userId: DEFAULT_USER });
    if (!settings) {
      settings = await UserSettings.create({ userId: DEFAULT_USER });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[Settings] GET /:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/settings — replace user settings
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const settings = await UserSettings.findOneAndUpdate(
      { userId: DEFAULT_USER },
      { $set: req.body },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[Settings] PUT /:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * PATCH /api/settings/risk — update only risk fields
 */
router.patch('/risk', async (req: Request, res: Response) => {
  try {
    const { accountBalance, maxRiskPerTradePercent, maxDailyLossPercent, maxDrawdownPercent, minRiskRewardRatio } = req.body;
    const updates: Record<string, unknown> = {};
    if (accountBalance !== undefined) updates['riskSettings.accountBalance'] = accountBalance;
    if (maxRiskPerTradePercent !== undefined) updates['riskSettings.maxRiskPerTradePercent'] = maxRiskPerTradePercent;
    if (maxDailyLossPercent !== undefined) updates['riskSettings.maxDailyLossPercent'] = maxDailyLossPercent;
    if (maxDrawdownPercent !== undefined) updates['riskSettings.maxDrawdownPercent'] = maxDrawdownPercent;
    if (minRiskRewardRatio !== undefined) updates['riskSettings.minRiskRewardRatio'] = minRiskRewardRatio;

    const settings = await UserSettings.findOneAndUpdate(
      { userId: DEFAULT_USER },
      { $set: updates },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[Settings] PATCH /risk:', err);
    res.status(500).json({ success: false, error: 'Failed to update risk settings' });
  }
});

export default router;
