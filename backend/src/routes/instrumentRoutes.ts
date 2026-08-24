import { Router, Request, Response } from 'express';
import { Instrument } from '../models/Instrument';
import { INSTRUMENT_REGISTRY } from '../config/instrumentRegistry';

const router = Router();

// GET /api/instruments — list all active instruments
router.get('/', async (_req: Request, res: Response) => {
  try {
    let instruments = await Instrument.find({ isActive: true }).lean();
    if (!instruments || instruments.length === 0) {
      instruments = INSTRUMENT_REGISTRY.filter(i => i.isActive).map(i => ({
        id: i.id,
        symbol: i.displaySymbol,
        name: i.name,
        assetClass: i.assetClass,
        baseCurrency: i.baseCurrency,
        quoteCurrency: i.quoteCurrency,
        pipSize: i.pipSize,
        tickSize: i.tickSize,
        defaultTimeframe: i.defaultTimeframe,
        provider: i.provider,
        isActive: i.isActive,
      })) as any;
    }
    res.json({ success: true, data: instruments });
  } catch (err) {
    console.error('[Instruments] GET /:', err);
    const fallback = INSTRUMENT_REGISTRY.filter(i => i.isActive).map(i => ({
      id: i.id,
      symbol: i.displaySymbol,
      name: i.name,
      assetClass: i.assetClass,
      baseCurrency: i.baseCurrency,
      quoteCurrency: i.quoteCurrency,
      pipSize: i.pipSize,
      tickSize: i.tickSize,
      defaultTimeframe: i.defaultTimeframe,
      provider: i.provider,
      isActive: i.isActive,
    }));
    res.json({ success: true, data: fallback });
  }
});

// GET /api/instruments/:id — get single instrument
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const clean = req.params.id.replace(/[\/\-_]/g, '').toUpperCase();
    let instrument = await Instrument.findOne({ id: clean, isActive: true }).lean();
    if (!instrument) {
      const reg = INSTRUMENT_REGISTRY.find(i => i.id === clean && i.isActive);
      if (reg) {
        instrument = {
          id: reg.id,
          symbol: reg.displaySymbol,
          name: reg.name,
          assetClass: reg.assetClass,
          baseCurrency: reg.baseCurrency,
          quoteCurrency: reg.quoteCurrency,
          pipSize: reg.pipSize,
          tickSize: reg.tickSize,
          defaultTimeframe: reg.defaultTimeframe,
          provider: reg.provider,
          isActive: reg.isActive,
        } as any;
      }
    }
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
