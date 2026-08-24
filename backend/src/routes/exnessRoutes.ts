import { Router, Request, Response } from 'express';
import { config } from '../config/config';
import { getExnessAccountInfo } from '../services/exnessService';
import {
  executeExnessTrade,
  getExnessOpenPositions,
  closeExnessPosition,
  SMCTradeExecutionRequest,
} from '../services/exnessExecutionService';

const router = Router();

/**
 * GET /api/exness/status
 * Returns current Exness account connectivity and equity status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const accountInfo = await getExnessAccountInfo();
    res.json({
      success: true,
      data: accountInfo,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/exness/positions
 * Returns active positions on Exness
 */
router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const positions = await getExnessOpenPositions();
    res.json({
      success: true,
      data: positions,
      count: positions.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/exness/execute
 * Executes or places a trade order on Exness
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const body: SMCTradeExecutionRequest = req.body;
    if (!body.instrumentId || !body.direction || !body.entryPrice || !body.stopLoss || !body.takeProfit1) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: instrumentId, direction, entryPrice, stopLoss, takeProfit1',
      });
    }

    const result = await executeExnessTrade(body);
    res.json({
      success: result.success,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/exness/close-position
 * Closes an open Exness position
 */
router.post('/close-position', async (req: Request, res: Response) => {
  try {
    const { positionId } = req.body;
    if (!positionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing positionId parameter',
      });
    }

    const result = await closeExnessPosition(positionId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/exness/settings
 * Updates runtime Exness settings (auto-execute, risk %, account type)
 */
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const { enabled, autoExecute, maxRiskPercent, accountType, server, accountId, token } = req.body;

    if (enabled !== undefined) config.exness.enabled = Boolean(enabled);
    if (autoExecute !== undefined) config.exness.autoExecute = Boolean(autoExecute);
    if (maxRiskPercent !== undefined) config.exness.maxRiskPercent = parseFloat(maxRiskPercent);
    if (accountType) config.exness.accountType = accountType;
    if (server) config.exness.server = server;
    if (accountId) config.exness.accountId = accountId;
    if (token) config.exness.token = token;

    const updatedAccount = await getExnessAccountInfo();
    res.json({
      success: true,
      message: 'Exness settings updated successfully',
      data: {
        config: {
          enabled: config.exness.enabled,
          autoExecute: config.exness.autoExecute,
          maxRiskPercent: config.exness.maxRiskPercent,
          accountType: config.exness.accountType,
          server: config.exness.server,
          accountId: config.exness.accountId ? `${config.exness.accountId.slice(0, 4)}***` : '',
        },
        account: updatedAccount,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
