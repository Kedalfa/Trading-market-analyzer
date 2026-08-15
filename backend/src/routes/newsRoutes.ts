import { Router, Request, Response } from 'express';
import { getEventsForInstrument } from '../services/newsService';

const router = Router();

/**
 * GET /api/news/:instrumentId — get economic events relevant to this instrument
 */
router.get('/:instrumentId', (req: Request, res: Response) => {
  const { instrumentId } = req.params;

  try {
    const newsContext = getEventsForInstrument(instrumentId);
    res.json({ success: true, data: newsContext });
  } catch (err) {
    console.error('[News] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch news context' });
  }
});

export default router;
