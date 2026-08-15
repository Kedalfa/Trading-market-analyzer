/**
 * Frontend market data fetcher.
 * Routes ALL data fetching through the backend API.
 * No direct calls to Binance or any external service from the browser.
 */

import { Candle, Instrument, MarketDataResponse } from '@/types/market';
import { fetchMarketData as backendFetchMarketData } from '@/services/api';

export async function fetchMarketData(
  instrument: Instrument,
  timeframe: string,
  limit = 250
): Promise<MarketDataResponse> {
  const apiResponse = await backendFetchMarketData(instrument.id, timeframe, limit);

  return {
    instrument,
    timeframe,
    candles: apiResponse.candles as Candle[],
    quote: apiResponse.quote,
    status: apiResponse.status || (apiResponse.isRealTime ? 'LIVE' : 'UNAVAILABLE'),
    lastUpdated: apiResponse.lastUpdated,
    provider: apiResponse.provider,
    isRealTime: apiResponse.isRealTime,
    statusMessage: apiResponse.statusMessage,
  };
}

// Keep utility functions for internal engine use
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
