import { Router, Request, Response } from 'express';
import { TradeIdea } from '../models/TradeIdea';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * POST /api/trade-ideas — save a trade idea from an analysis
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const ideaId = body.ideaId || `idea-${randomUUID()}`;

    const idea = await TradeIdea.findOneAndUpdate(
      { ideaId },
      { $set: { ...body, ideaId } },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({ success: true, data: idea });
  } catch (err) {
    console.error('[TradeIdeas] POST /:', err);
    res.status(500).json({ success: false, error: 'Failed to save trade idea' });
  }
});

/**
 * GET /api/trade-ideas — list trade ideas
 * Query params: symbol, direction, status, limit, skip
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbol, direction, status, limit = '50', skip = '0' } = req.query;

    const filter: Record<string, unknown> = {};
    if (symbol) filter.symbol = String(symbol).toUpperCase();
    if (direction) filter.direction = String(direction).toUpperCase();
    if (status) filter.status = String(status).toUpperCase();

    const [ideas, total] = await Promise.all([
      TradeIdea.find(filter)
        .sort({ createdAt: -1 })
        .skip(parseInt(String(skip), 10))
        .limit(Math.min(parseInt(String(limit), 10), 200))
        .lean(),
      TradeIdea.countDocuments(filter),
    ]);

    res.json({ success: true, data: ideas, total });
  } catch (err) {
    console.error('[TradeIdeas] GET /:', err);
    res.status(500).json({ success: false, error: 'Failed to list trade ideas' });
  }
});

/**
 * PATCH /api/trade-ideas/:ideaId/status — update status of a trade idea
 */
router.patch('/:ideaId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const idea = await TradeIdea.findOneAndUpdate(
      { ideaId: req.params.ideaId },
      { $set: { status } },
      { new: true }
    );
    if (!idea) return res.status(404).json({ success: false, error: 'Trade idea not found' });
    res.json({ success: true, data: idea });
  } catch (err) {
    console.error('[TradeIdeas] PATCH status:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

/**
 * DELETE /api/trade-ideas/:ideaId
 */
router.delete('/:ideaId', async (req: Request, res: Response) => {
  try {
    const result = await TradeIdea.deleteOne({ ideaId: req.params.ideaId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Trade idea not found' });
    res.json({ success: true, message: 'Trade idea deleted' });
  } catch (err) {
    console.error('[TradeIdeas] DELETE:', err);
    res.status(500).json({ success: false, error: 'Failed to delete trade idea' });
  }
});

export default router;
