import { Router, Request, Response } from 'express';
import { getInstrumentMapping, INSTRUMENT_REGISTRY } from '../config/instrumentRegistry';
import {
  getAuthoritativeCandles,
  getAuthoritativeQuote,
  getMarketDataHealth,
  getMarketSessionInfo,
} from '../services/marketDataService';

const router = Router();

/**
 * GET /api/market-data/health
 * Returns comprehensive real-time health telemetry across all 7 supported instruments.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await getMarketDataHealth();
    const isAllConnected = health.every(h => h.status !== 'UNAVAILABLE');

    res.json({
      success: true,
      data: {
        systemStatus: isAllConnected ? 'HEALTHY' : 'DEGRADED',
        timestamp: Date.now(),
        formattedTime: new Date().toUTCString(),
        instruments: health,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Market data health check error: ${err?.message || 'Unknown error'}`,
    });
  }
});

/**
 * GET /api/market-data/:instrumentId?timeframe=15M&limit=250
 * Fetches verified, genuine OHLCV candles from the authoritative provider.
 * ZERO fake data fallback.
 */
router.get('/:instrumentId', async (req: Request, res: Response) => {
  const { instrumentId } = req.params;
  const timeframe = (req.query.timeframe as string) || '15M';
  const limit = Math.min(parseInt((req.query.limit as string) || '250', 10), 500);

  try {
    const mapping = getInstrumentMapping(instrumentId);
    if (mapping && !mapping.isActive) {
      return res.status(403).json({
        success: false,
        error: `Instrument '${instrumentId}' is currently deactivated from the live analysis universe.`,
      });
    }

    const data = await getAuthoritativeCandles(instrumentId, timeframe, limit);

    if (!data || !data.candles || data.candles.length === 0) {
      return res.status(503).json({
        success: false,
        error: `Live market data unavailable from authoritative feed for ${instrumentId}.`,
        data: null,
        meta: {
          instrumentId,
          status: 'UNAVAILABLE',
          isRealTime: false,
          lastAttempt: Date.now(),
        },
      });
    }

    const displaySym = mapping?.displaySymbol || instrumentId;

    res.json({
      success: true,
      data: {
        instrumentId,
        symbol: displaySym,
        displayName: mapping?.name || displaySym,
        timeframe,
        candles: data.candles,
        quote: data.quote,
        isRealTime: data.status === 'LIVE',
        provider: data.provider,
        status: data.status,
        lastUpdated: Date.now(),
        statusMessage: `Verified real market data active from ${data.provider} (${data.candles.length} bars)`,
      },
    });
  } catch (err: any) {
    console.error(`[MarketData] Error fetching ${instrumentId}:`, err);
    res.status(500).json({
      success: false,
      error: `Failed to fetch genuine market data for ${instrumentId}: ${err?.message || 'Network error'}`,
    });
  }
});

/**
 * GET /api/market-data/:instrumentId/quote
 * Fast endpoint for continuous real-time quote & price updating with full telemetry.
 */
router.get('/:instrumentId/quote', async (req: Request, res: Response) => {
  const { instrumentId } = req.params;

  try {
    const quote = await getAuthoritativeQuote(instrumentId);
    if (quote) {
      return res.json({ success: true, data: quote });
    }

    res.status(503).json({
      success: false,
      error: `Live quote unavailable from authoritative provider for ${instrumentId}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve quote' });
  }
});

export default router;
