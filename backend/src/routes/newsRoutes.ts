import { Router, Request, Response } from 'express';
import { getEventsForInstrument, fetchLiveCalendarEvents } from '../services/newsService';

const router = Router();

/**
 * GET /api/news — get all global economic calendar events
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const events = await fetchLiveCalendarEvents();
    const now = Date.now();
    const eventsWithCountdown = events.map(e => ({
      ...e,
      timeUntilMinutes: Math.round((e.timestamp - now) / 60000),
    }));

    res.json({
      success: true,
      data: {
        provider: 'TradingView Global Economic Calendar Feed',
        totalEvents: eventsWithCountdown.length,
        events: eventsWithCountdown,
      },
    });
  } catch (err) {
    console.error('[News] Error fetching global calendar:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch economic calendar' });
  }
});

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
