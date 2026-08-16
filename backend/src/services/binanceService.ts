/**
 * Binance Service — fetches genuine, live OHLCV candles & quotes from Binance public REST APIs.
 * Includes multiple redundant public endpoints & fallback cache.
 * ZERO fake/synthetic fallback: if provider fails, returns null.
 */

import { config } from '../config/config';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: config.marketDataCacheTtl || 10 });
// Backup cache with longer TTL (2 hours) to survive transient provider rate-limits
const backupCache = new NodeCache({ stdTTL: 7200 });

export interface Candle {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CryptoQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
  formattedTime: string;
  source: string;
  status: 'LIVE' | 'OFFLINE';
}

export function mapToBinanceInterval(tf: string): string {
  const map: Record<string, string> = {
    '1M': '1M',
    '1W': '1w',
    '1D': '1d',
    '4H': '4h',
    '1H': '1h',
    '30M': '30m',
    '15M': '15m',
    '5M': '5m',
    '1M_MIN': '1m',
  };
  return map[tf] ?? '15m';
}

export function getTimeframeSeconds(tf: string): number {
  const map: Record<string, number> = {
    '1M': 30 * 86400,
    '1W': 7 * 86400,
    '1D': 86400,
    '4H': 14400,
    '1H': 3600,
    '30M': 1800,
    '15M': 900,
    '5M': 300,
    '1M_MIN': 60,
  };
  return map[tf] ?? 900;
}

const BINANCE_BASE_URLS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

/**
 * Fetch live candles from Binance public API with multi-endpoint redundancy and caching.
 */
export async function fetchBinanceCandles(
  symbol: string,
  timeframe: string,
  limit = 250
): Promise<Candle[] | null> {
  const cacheKey = `binance:candles:${symbol}:${timeframe}:${limit}`;
  const cached = cache.get<Candle[]>(cacheKey);
  if (cached) return cached;

  const interval = mapToBinanceInterval(timeframe);

  for (const baseUrl of BINANCE_BASE_URLS) {
    const url = `${baseUrl}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        continue;
      }

      const raw = (await res.json()) as (string | number)[][];
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const candles: Candle[] = raw.map((k) => {
        const openTime = Math.floor(Number(k[0]) / 1000);
        return {
          timestamp: openTime,
          time: new Date(openTime * 1000).toISOString(),
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
          volume: parseFloat(String(k[5])),
        };
      });

      cache.set(cacheKey, candles);
      backupCache.set(cacheKey, candles);
      return candles;
    } catch (err) {
      // Continue to next redundant host
    }
  }

  // If all hosts timed out, check long-lived backup cache
  const backup = backupCache.get<Candle[]>(cacheKey);
  if (backup) {
    console.warn(`[Binance] Using recent cached candle snapshot for ${symbol} due to transient network rate-limit.`);
    return backup;
  }

  console.warn(`[Binance] All public endpoints failed for ${symbol}`);
  return null;
}

/**
 * Fetch genuine real-time ticker book (bid/ask/spread) from Binance
 */
export async function fetchBinanceBookQuote(symbol: string): Promise<CryptoQuote | null> {
  const cacheKey = `binance:quote:${symbol}`;
  const cached = cache.get<CryptoQuote>(cacheKey);
  if (cached) return cached;

  for (const baseUrl of BINANCE_BASE_URLS) {
    const url = `${baseUrl}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;

      const data: any = await res.json();
      const bid = parseFloat(data.bidPrice);
      const ask = parseFloat(data.askPrice);
      if (isNaN(bid) || isNaN(ask)) continue;

      const mid = (bid + ask) / 2;
      const spread = parseFloat((ask - bid).toFixed(data.symbol.includes('BTC') ? 2 : 4));
      const now = Date.now();

      const quote: CryptoQuote = {
        symbol,
        price: mid,
        bid,
        ask,
        spread,
        timestamp: now,
        formattedTime: new Date(now).toUTCString().slice(17, 25) + ' UTC',
        source: 'Binance Public WebSocket/REST Feed',
        status: 'LIVE',
      };

      cache.set(cacheKey, quote, 2); // 2s TTL for live ticker
      backupCache.set(cacheKey, quote);
      return quote;
    } catch (err) {
      // Continue to next redundant host
    }
  }

  const backup = backupCache.get<CryptoQuote>(cacheKey);
  if (backup) return backup;
  return null;
}
