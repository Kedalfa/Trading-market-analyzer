/**
 * Yahoo Finance Real Market Data Service
 * Provides genuine, non-synthetic OHLCV candles and real-time quotes for Forex (EURUSD=X, GBPUSD=X, JPY=X),
 * Commodities (GC=F Gold), and Indices (^GSPC, ^IXIC).
 * ZERO fake/synthetic fallback: if provider fails, returns null.
 */

import NodeCache from 'node-cache';
import { config } from '../config/config';

const cache = new NodeCache({ stdTTL: config.marketDataCacheTtl || 15 });

export interface RealCandle {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RealQuote {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  spread?: number;
  timestamp: number;
  formattedTime: string;
  source: string;
  status: 'LIVE' | 'MARKET_CLOSED' | 'DELAYED';
}

/**
 * Map UI timeframe to Yahoo Finance interval & range
 */
export function mapTimeframeToYahoo(tf: string): { interval: string; range: string } {
  switch (tf) {
    case '1M_MIN': return { interval: '1m', range: '1d' };
    case '5M': return { interval: '5m', range: '5d' };
    case '15M': return { interval: '15m', range: '5d' };
    case '30M': return { interval: '30m', range: '1mo' };
    case '1H': return { interval: '60m', range: '1mo' };
    case '4H': return { interval: '60m', range: '3mo' };
    case '1D': return { interval: '1d', range: '1y' };
    case '1W': return { interval: '1wk', range: '2y' };
    case '1M': return { interval: '1mo', range: '5y' };
    default: return { interval: '15m', range: '5d' };
  }
}

/**
 * Fetch genuine OHLCV candles from Yahoo Finance v8 chart API
 */
export async function fetchYahooCandles(
  yahooSymbol: string,
  timeframe: string,
  limit = 250
): Promise<{ candles: RealCandle[]; quote: RealQuote } | null> {
  const cacheKey = `yahoo:candles:${yahooSymbol}:${timeframe}:${limit}`;
  const cached = cache.get<{ candles: RealCandle[]; quote: RealQuote }>(cacheKey);
  if (cached) return cached;

  const { interval, range } = mapTimeframeToYahoo(timeframe);
  const endpoints = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=true&events=div%7Csplit`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=true&events=div%7Csplit`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Referer': 'https://finance.yahoo.com',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const data: any = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const timestamps: number[] = result.timestamp || [];
      const quoteData = result.indicators?.quote?.[0];
      if (!quoteData || timestamps.length === 0) continue;

      const opens = quoteData.open || [];
      const highs = quoteData.high || [];
      const lows = quoteData.low || [];
      const closes = quoteData.close || [];
      const volumes = quoteData.volume || [];

      const candles: RealCandle[] = [];
      const isForex = yahooSymbol.includes('=X') && !yahooSymbol.includes('JPY');

      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        const v = volumes[i] ?? 0;

        if (o == null || h == null || l == null || c == null) continue;

        candles.push({
          timestamp: ts,
          time: new Date(ts * 1000).toISOString(),
          open: Number(o.toFixed(isForex ? 5 : 2)),
          high: Number(h.toFixed(isForex ? 5 : 2)),
          low: Number(l.toFixed(isForex ? 5 : 2)),
          close: Number(c.toFixed(isForex ? 5 : 2)),
          volume: Math.round(v),
        });
      }

      if (candles.length === 0) continue;

      // Slice to requested limit
      const trimmedCandles = candles.slice(-limit);

      // Extract quote metadata
      const meta = result.meta || {};
      const regularMarketPrice = meta.regularMarketPrice ?? trimmedCandles[trimmedCandles.length - 1].close;
      const regularMarketTime = meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();

      const bid = meta.bid != null ? Number(meta.bid) : undefined;
      const ask = meta.ask != null ? Number(meta.ask) : undefined;
      const spread = (bid != null && ask != null) ? Number((ask - bid).toFixed(5)) : undefined;

      const quote: RealQuote = {
        symbol: yahooSymbol,
        price: Number(regularMarketPrice),
        bid,
        ask,
        spread,
        timestamp: regularMarketTime,
        formattedTime: new Date(regularMarketTime).toUTCString().slice(17, 25) + ' UTC',
        source: 'Yahoo Finance Real-Time Market Feed',
        status: 'LIVE',
      };

      const payload = { candles: trimmedCandles, quote };
      cache.set(cacheKey, payload);
      return payload;
    } catch (err) {
      console.warn(`[YahooFinance] Failed endpoint ${url}:`, err);
    }
  }

  return null;
}
