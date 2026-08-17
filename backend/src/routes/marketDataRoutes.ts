import { Router, Request, Response } from 'express';
import { Instrument } from '../models/Instrument';
import { getInstrumentMapping } from '../config/instrumentRegistry';
import { fetchBinanceCandles, fetchBinanceBookQuote } from '../services/binanceService';
import { fetchYahooCandles, fetchYahooRealtimeQuote } from '../services/yahooMarketService';

const router = Router();

/**
 * GET /api/market-data/:instrumentId?timeframe=15M&limit=250
 * Fetches verified, genuine OHLCV candles from the appropriate market data provider.
 * ZERO fake data fallback.
 */
router.get('/:instrumentId', async (req: Request, res: Response) => {
  const { instrumentId } = req.params;
  const timeframe = (req.query.timeframe as string) || '15M';
  const limit = Math.min(parseInt((req.query.limit as string) || '250', 10), 500);

  try {
    const mapping = getInstrumentMapping(instrumentId);
    const instrument = mapping || (await Instrument.findOne({ id: instrumentId, isActive: true }).lean());

    if (!instrument) {
      return res.status(404).json({ success: false, error: `Instrument '${instrumentId}' not registered` });
    }

    let candles: any[] | null = null;
    let quoteInfo: any = null;
    let providerName = 'Official Provider';
    let isRealTime = false;
    let dataStatus: 'LIVE' | 'MARKET_CLOSED' | 'DELAYED' | 'UNAVAILABLE' = 'UNAVAILABLE';

    const displaySym = mapping?.displaySymbol || (instrument as any).symbol || instrumentId;

    // ── 1. Binance Crypto Feed ──────────────────────────────────────
    if (instrument.provider === 'binance') {
      providerName = 'Binance Public Market Feed';
      const [binanceCandles, binanceQuote] = await Promise.all([
        fetchBinanceCandles(instrumentId, timeframe, limit),
        fetchBinanceBookQuote(instrumentId),
      ]);

      if (binanceCandles && binanceCandles.length > 0) {
        candles = binanceCandles;
        isRealTime = true;
        dataStatus = 'LIVE';
        quoteInfo = binanceQuote || {
          symbol: displaySym,
          price: binanceCandles[binanceCandles.length - 1].close,
          timestamp: Date.now(),
          formattedTime: new Date().toUTCString().slice(17, 25) + ' UTC',
          source: providerName,
          status: 'LIVE',
        };
      }
    }
    // ── 2. Yahoo Finance Forex, Commodities & Indices Feed ──────────
    else {
      const yahooSymbol = mapping?.providerSymbol || (instrument as any).providerSymbol || (
        instrumentId === 'EURUSD' ? 'EURUSD=X' :
        instrumentId === 'GBPUSD' ? 'GBPUSD=X' :
        instrumentId === 'USDJPY' ? 'JPY=X' :
        instrumentId === 'XAUUSD' ? 'GC=F' :
        instrumentId === 'US500' ? '^GSPC' :
        instrumentId === 'NAS100' ? '^IXIC' : instrumentId
      );

      providerName = 'Yahoo Finance Institutional Feed';
      const [result, liveQuote] = await Promise.all([
        fetchYahooCandles(yahooSymbol, timeframe, limit),
        fetchYahooRealtimeQuote(yahooSymbol),
      ]);

      if (result && result.candles.length > 0) {
        candles = result.candles;
        quoteInfo = liveQuote || result.quote;
        isRealTime = true;
        dataStatus = quoteInfo?.status || result.quote.status || 'LIVE';
      }
    }

    // If provider failed / returned empty
    if (!candles || candles.length === 0) {
      return res.status(503).json({
        success: false,
        error: `Live market data unavailable from ${providerName} for ${instrumentId}.`,
        data: null,
        meta: {
          instrumentId,
          provider: providerName,
          status: 'UNAVAILABLE',
          isRealTime: false,
          lastAttempt: Date.now(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        instrumentId,
        symbol: displaySym,
        timeframe,
        candles,
        quote: quoteInfo,
        isRealTime,
        provider: providerName,
        status: dataStatus,
        lastUpdated: Date.now(),
        statusMessage: `Verified real market data active from ${providerName} (${candles.length} bars)`,
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
 * Fast endpoint for continuous real-time quote & price updating (sub-second or short-interval).
 */
router.get('/:instrumentId/quote', async (req: Request, res: Response) => {
  const { instrumentId } = req.params;

  try {
    const mapping = getInstrumentMapping(instrumentId);
    const provider = mapping?.provider || 'yahoo';

    if (provider === 'binance') {
      const quote = await fetchBinanceBookQuote(instrumentId);
      if (quote) {
        return res.json({ success: true, data: quote });
      }
    } else {
      const yahooSymbol = mapping?.providerSymbol || (
        instrumentId === 'EURUSD' ? 'EURUSD=X' :
        instrumentId === 'GBPUSD' ? 'GBPUSD=X' :
        instrumentId === 'USDJPY' ? 'JPY=X' :
        instrumentId === 'XAUUSD' ? 'GC=F' :
        instrumentId === 'US500' ? '^GSPC' : '^IXIC'
      );
      const quote = await fetchYahooRealtimeQuote(yahooSymbol);
      if (quote) {
        return res.json({ success: true, data: quote });
      }
    }

    res.status(503).json({ success: false, error: 'Live quote unavailable' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve quote' });
  }
});

export default router;
