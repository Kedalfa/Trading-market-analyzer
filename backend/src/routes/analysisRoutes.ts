import { Router, Request, Response } from 'express';
import { Analysis } from '../models/Analysis';
import { runMonitoringCycle } from '../services/analysisOutcomeMonitor';
import { activeSetupService } from '../services/activeSetupService';

const router = Router();

/**
 * GET /api/analyses/active — list all OPEN active setups using unified ActiveSetupService
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const symbol = req.query.symbol as string | undefined;
    const setups = await activeSetupService.getActiveSetups({ symbol });
    res.json({ success: true, count: setups.length, data: setups });
  } catch (err) {
    console.error('[Analyses] GET /active:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch active setups' });
  }
});

/**
 * GET /api/analyses/export — export filtered analyses/journal to CSV
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      timeframe,
      direction,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    const filter: Record<string, any> = {};
    if (symbol && String(symbol).toUpperCase() !== 'ALL') {
      filter.symbol = String(symbol).toUpperCase();
    }
    if (timeframe && String(timeframe).toUpperCase() !== 'ALL') {
      filter.timeframe = String(timeframe);
    }
    if (direction && String(direction).toUpperCase() !== 'ALL') {
      filter.direction = String(direction).toUpperCase();
    }
    if (status && String(status).toUpperCase() !== 'ALL') {
      filter['outcome.status'] = String(status).toUpperCase();
    }

    if (startDate || endDate) {
      filter.savedAt = {};
      if (startDate) {
        const start = new Date(String(startDate));
        start.setHours(0, 0, 0, 0);
        filter.savedAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        filter.savedAt.$lte = end;
      }
    }

    if (search && String(search).trim().length > 0) {
      const s = String(search).trim();
      const regex = new RegExp(s, 'i');
      filter.$or = [
        { symbol: regex },
        { analysisId: regex },
        { rulesetUsed: regex },
        { 'outcome.triggerReason': regex },
      ];
    }

    const analyses = await Analysis.find(filter).sort({ savedAt: -1 }).lean();

    // Generate CSV Header & Rows
    const csvRows: string[] = [];
    csvRows.push([
      'Trade ID',
      'Date (UTC)',
      'Instrument',
      'Direction',
      'Timeframe',
      'Entry Price',
      'Stop Loss',
      'Target (TP)',
      'Invalidation',
      'R:R Ratio',
      'Setup Grade',
      'Setup Score',
      'Outcome Status',
      'Observed Price',
      'Max Favorable (MFE)',
      'Max Adverse (MAE)',
      'Resolution Time (Mins)',
      'Ruleset Used',
      'Resolution Trigger Fact',
    ].map(col => `"${col}"`).join(','));

    for (const a of analyses) {
      const row = [
        a.analysisId || '',
        new Date(a.savedAt).toISOString(),
        a.symbol || '',
        a.direction || '',
        a.timeframe || '',
        a.entryPrice != null ? a.entryPrice : '',
        a.stopLossPrice != null ? a.stopLossPrice : '',
        a.targetPrice != null ? a.targetPrice : '',
        a.invalidationPrice != null ? a.invalidationPrice : '',
        a.riskRewardRatio != null ? a.riskRewardRatio : '',
        a.setupQuality?.grade || '',
        a.setupQuality?.totalScore || '',
        a.outcome?.status || 'OPEN',
        a.outcome?.observedPrice != null ? a.outcome.observedPrice : '',
        a.outcome?.maxFavorableExcursion != null ? a.outcome.maxFavorableExcursion : '',
        a.outcome?.maxAdverseExcursion != null ? a.outcome.maxAdverseExcursion : '',
        a.outcome?.timeToResolutionMinutes != null ? a.outcome.timeToResolutionMinutes : '',
        a.rulesetUsed || '',
        (a.outcome?.triggerReason || '').replace(/"/g, '""'),
      ];
      csvRows.push(row.map(val => `"${val}"`).join(','));
    }

    const filename = `smc_trading_journal_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvRows.join('\n'));
  } catch (err) {
    console.error('[Analyses] GET /export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export analyses' });
  }
});

/**
 * GET /api/analyses/:analysisId/details — get detailed evidence-based breakdown & reasoning
 */
router.get('/:analysisId/details', async (req: Request, res: Response) => {
  try {
    const details = await activeSetupService.getSetupDetails(req.params.analysisId);
    if (!details) {
      return res.status(404).json({ success: false, error: 'Setup record not found' });
    }
    res.json({ success: true, data: details });
  } catch (err) {
    console.error('[Analyses] GET /:id/details:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch setup details' });
  }
});

/**
 * POST /api/analyses — save a new analysis snapshot (starts in OPEN status)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    const initialOutcome = body.outcome || {
      status: 'OPEN',
      monitoringStatus: 'Active Monitoring Initialized',
      auditTrail: [
        {
          previousStatus: 'NEW',
          newStatus: 'OPEN',
          timestamp: new Date(),
          triggerReason: 'Initial analysis snapshot saved to database',
          observedPrice: body.currentPrice,
        },
      ],
    };

    const doc = {
      ...body,
      outcome: initialOutcome,
    };

    const analysis = await Analysis.findOneAndUpdate(
      { analysisId: body.analysisId },
      { $set: doc },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({ success: true, data: analysis });
  } catch (err) {
    console.error('[Analyses] POST /:', err);
    res.status(500).json({ success: false, error: 'Failed to save analysis snapshot' });
  }
});

/**
 * GET /api/analyses — list analyses with server-side date range, search, filters & summary metrics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      timeframe,
      direction,
      status,
      startDate,
      endDate,
      search,
      page = '1',
      pageSize = '20',
      limit,
      skip,
    } = req.query;

    const filter: Record<string, any> = {};
    if (symbol && String(symbol).toUpperCase() !== 'ALL') {
      filter.symbol = String(symbol).toUpperCase();
    }
    if (timeframe && String(timeframe).toUpperCase() !== 'ALL') {
      filter.timeframe = String(timeframe);
    }
    if (direction && String(direction).toUpperCase() !== 'ALL') {
      filter.direction = String(direction).toUpperCase();
    }
    if (status && String(status).toUpperCase() !== 'ALL') {
      filter['outcome.status'] = String(status).toUpperCase();
    }

    // Precise Server-Side Date Range Filter
    if (startDate || endDate) {
      filter.savedAt = {};
      if (startDate) {
        const start = new Date(String(startDate));
        start.setHours(0, 0, 0, 0);
        filter.savedAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        filter.savedAt.$lte = end;
      }
    }

    // Search query across symbol, ID, ruleset, and trigger reason
    if (search && String(search).trim().length > 0) {
      const s = String(search).trim();
      const regex = new RegExp(s, 'i');
      filter.$or = [
        { symbol: regex },
        { analysisId: regex },
        { rulesetUsed: regex },
        { 'outcome.triggerReason': regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const size = limit
      ? Math.min(parseInt(String(limit), 10), 100)
      : Math.min(parseInt(String(pageSize), 10) || 20, 100);
    const skipNum = skip != null ? parseInt(String(skip), 10) : (pageNum - 1) * size;

    const [analyses, total, allFiltered] = await Promise.all([
      Analysis.find(filter)
        .sort({ savedAt: -1 })
        .skip(skipNum)
        .limit(size)
        .lean(),
      Analysis.countDocuments(filter),
      Analysis.find(filter, { outcome: 1, riskRewardRatio: 1 }).lean(),
    ]);

    // Calculate Summary Statistics for the selected filter & date range
    let winCount = 0;
    let lossCount = 0;
    let breakEvenCount = 0;
    let openCount = 0;
    let totalRealizedR = 0;
    let totalRRSum = 0;
    let largestWin = 0;
    let largestLoss = 0;
    let winRSum = 0;
    let lossRSum = 0;

    for (const item of allFiltered) {
      const st = item.outcome?.status || 'OPEN';
      const rr = item.riskRewardRatio || 2;
      totalRRSum += rr;

      if (st === 'TARGET_HIT') {
        winCount++;
        totalRealizedR += rr;
        winRSum += rr;
        if (rr > largestWin) largestWin = rr;
      } else if (st === 'STOPPED_OUT') {
        lossCount++;
        totalRealizedR -= 1; // 1R standard risk
        lossRSum += 1;
        if (1 > largestLoss) largestLoss = 1;
      } else if (st === 'INVALIDATED' || st === 'EXPIRED') {
        breakEvenCount++;
      } else if (st === 'OPEN') {
        openCount++;
      }
    }

    const closedTrades = winCount + lossCount;
    const winRate = closedTrades > 0 ? Number(((winCount / closedTrades) * 100).toFixed(1)) : 0;
    const avgRR = allFiltered.length > 0 ? Number((totalRRSum / allFiltered.length).toFixed(2)) : 0;
    const avgPL = closedTrades > 0 ? Number((totalRealizedR / closedTrades).toFixed(2)) : 0;
    const profitFactor = lossRSum > 0 ? Number((winRSum / lossRSum).toFixed(2)) : (winRSum > 0 ? 999 : 0);

    const summaryStats = {
      totalTrades: total,
      closedTrades,
      openTrades: openCount,
      winningTrades: winCount,
      losingTrades: lossCount,
      breakEvenTrades: breakEvenCount,
      winRate,
      totalRealizedR: Number(totalRealizedR.toFixed(2)),
      avgPL,
      avgRR,
      largestWin,
      largestLoss,
      profitFactor,
    };

    res.json({
      success: true,
      data: analyses,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
      summaryStats,
    });
  } catch (err) {
    console.error('[Analyses] GET /:', err);
    res.status(500).json({ success: false, error: 'Failed to list analyses' });
  }
});

/**
 * POST /api/analyses/evaluate-now — trigger immediate background evaluation
 */
router.post('/evaluate-now', async (_req: Request, res: Response) => {
  try {
    await runMonitoringCycle();
    res.json({ success: true, message: 'Monitoring cycle executed successfully' });
  } catch (err) {
    console.error('[Analyses] Evaluate now:', err);
    res.status(500).json({ success: false, error: 'Failed to evaluate outcomes' });
  }
});

/**
 * GET /api/analyses/:analysisId
 */
router.get('/:analysisId', async (req: Request, res: Response) => {
  try {
    const analysis = await Analysis.findOne({ analysisId: req.params.analysisId }).lean();
    if (!analysis) return res.status(404).json({ success: false, error: 'Analysis not found' });
    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[Analyses] GET /:id:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analysis' });
  }
});

/**
 * DELETE /api/analyses/:analysisId
 */
router.delete('/:analysisId', async (req: Request, res: Response) => {
  try {
    const result = await Analysis.deleteOne({ analysisId: req.params.analysisId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Analysis not found' });
    res.json({ success: true, message: 'Analysis deleted' });
  } catch (err) {
    console.error('[Analyses] DELETE:', err);
    res.status(500).json({ success: false, error: 'Failed to delete analysis' });
  }
});

export default router;
