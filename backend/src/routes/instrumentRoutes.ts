import { Router, Request, Response } from 'express';
import { Instrument } from '../models/Instrument';

const router = Router();

// GET /api/instruments — list all active instruments
router.get('/', async (_req: Request, res: Response) => {
  try {
    const instruments = await Instrument.find({ isActive: true }).lean();
    res.json({ success: true, data: instruments });
  } catch (err) {
    console.error('[Instruments] GET /:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch instruments' });
  }
});

// GET /api/instruments/:id — get single instrument
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const instrument = await Instrument.findOne({ id: req.params.id, isActive: true }).lean();
    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrument not found' });
    }
    res.json({ success: true, data: instrument });
  } catch (err) {
    console.error('[Instruments] GET /:id:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch instrument' });
  }
});

export default router;
