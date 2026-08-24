/**
 * Exness Broker & MetaTrader Gateway Service
 * Provides real-time quote streaming, historical OHLCV data, and account synchronization
 * for Exness MT4 / MT5 accounts via MetaApi / Exness Bridge API.
 */

import NodeCache from 'node-cache';
import { config } from '../config/config';
import { resolveExnessSymbol, getInstrumentMapping } from '../config/instrumentRegistry';

const quoteCache = new NodeCache({ stdTTL: 1 }); // 1s cache for tick quotes
const candleCache = new NodeCache({ stdTTL: 5 }); // 5s cache for candles
const accountCache = new NodeCache({ stdTTL: 10 }); // 10s cache for account info

export interface ExnessAccountInfo {
  accountId: string;
  login: string;
  server: string;
  name: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  credit: number;
  state: 'CONNECTED' | 'DISCONNECTED' | 'SYNCHRONIZING' | 'UNCONFIGURED';
  accountType: 'standard' | 'raw_spread' | 'pro' | 'zero';
  isAutoExecutionEnabled: boolean;
  lastUpdated: string;
}

export interface ExnessQuote {
  symbol: string;
  instrumentId: string;
  bid: number;
  ask: number;
  price: number;
  spread: number;
  timestamp: number;
  formattedTime: string;
  source: string;
  status: 'LIVE' | 'MARKET_CLOSED' | 'OFFLINE';
}

export interface ExnessCandle {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function mapTimeframeToExness(tf: string): string {
  switch (tf) {
    case '1M_MIN': return '1m';
    case '5M': return '5m';
    case '15M': return '15m';
    case '30M': return '30m';
    case '1H': return '1h';
    case '4H': return '4h';
    case '1D': return '1d';
    case '1W': return '1w';
    case '1M': return '1mn';
    default: return '15m';
  }
}

/**
 * Fetch live account state from Exness / MetaApi Gateway
 */
export async function getExnessAccountInfo(): Promise<ExnessAccountInfo> {
  const cacheKey = 'exness:account_info';
  const cached = accountCache.get<ExnessAccountInfo>(cacheKey);
  if (cached) return cached;

  const { accountId, token, server, accountType, autoExecute, apiUrl } = config.exness;

  if (!accountId || !token) {
    return {
      accountId: accountId || 'NOT_CONFIGURED',
      login: accountId || 'Offline',
      server: server || 'Exness-Real19',
      name: 'Exness MT5 Account',
      currency: 'USD',
      balance: 0,
      equity: 0,
      margin: 0,
      freeMargin: 0,
      marginLevel: 0,
      leverage: 2000,
      credit: 0,
      state: 'UNCONFIGURED',
      accountType,
      isAutoExecutionEnabled: autoExecute,
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const url = `${apiUrl}/users/current/accounts/${accountId}/information`;
    const res = await fetch(url, {
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data: any = await res.json();
      const info: ExnessAccountInfo = {
        accountId,
        login: String(data.login || accountId),
        server: data.server || server,
        name: data.name || 'Exness Live Account',
        currency: data.currency || 'USD',
        balance: Number(data.balance ?? 0),
        equity: Number(data.equity ?? data.balance ?? 0),
        margin: Number(data.margin ?? 0),
        freeMargin: Number(data.freeMargin ?? data.equity ?? 0),
        marginLevel: Number(data.marginLevel ?? 0),
        leverage: Number(data.leverage ?? 2000),
        credit: Number(data.credit ?? 0),
        state: data.state === 'DEPLOYED' || data.connected ? 'CONNECTED' : 'SYNCHRONIZING',
        accountType,
        isAutoExecutionEnabled: autoExecute,
        lastUpdated: new Date().toISOString(),
      };
      accountCache.set(cacheKey, info);
      return info;
    }
  } catch (err: any) {
    console.warn(`[EXNESS] Account info fetch error: ${err.message}`);
  }

  // Standby response when credentials configured but network or server syncing
  return {
    accountId,
    login: accountId,
    server,
    name: 'Exness Account',
    currency: 'USD',
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    marginLevel: 0,
    leverage: 2000,
    credit: 0,
    state: 'SYNCHRONIZING',
    accountType,
    isAutoExecutionEnabled: autoExecute,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Fetch real-time tick quote for an instrument directly from Exness
 */
export async function fetchExnessQuote(instrumentId: string): Promise<ExnessQuote | null> {
  const mapping = getInstrumentMapping(instrumentId);
  if (!mapping) return null;

  const exnessSymbol = resolveExnessSymbol(instrumentId, config.exness.accountType);
  const cacheKey = `exness:quote:${exnessSymbol}`;
  const cached = quoteCache.get<ExnessQuote>(cacheKey);
  if (cached) return cached;

  const { accountId, token, apiUrl } = config.exness;
  if (!accountId || !token) return null;

  try {
    const url = `${apiUrl}/users/current/accounts/${accountId}/symbols/${encodeURIComponent(exnessSymbol)}/current-price`;
    const res = await fetch(url, {
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data: any = await res.json();
      const bid = Number(data.bid);
      const ask = Number(data.ask);
      const price = Number(((bid + ask) / 2).toFixed(mapping.assetClass === 'forex' ? 5 : 2));
      const spread = Number((ask - bid).toFixed(mapping.assetClass === 'forex' ? 5 : 2));
      const timestamp = data.time ? new Date(data.time).getTime() : Date.now();

      const quote: ExnessQuote = {
        symbol: exnessSymbol,
        instrumentId: mapping.id,
        bid,
        ask,
        price,
        spread,
        timestamp,
        formattedTime: new Date(timestamp).toUTCString().slice(17, 25) + ' UTC',
        source: `Exness (${config.exness.server})`,
        status: 'LIVE',
      };

      quoteCache.set(cacheKey, quote);
      return quote;
    }
  } catch (err: any) {
    // Non-blocking: will fallback to primary Yahoo/Binance feeds if Exness quote is unconfigured or offline
  }

  return null;
}

/**
 * Fetch historical OHLCV candles from Exness
 */
export async function fetchExnessCandles(
  instrumentId: string,
  timeframe: string,
  limit = 250
): Promise<ExnessCandle[] | null> {
  const mapping = getInstrumentMapping(instrumentId);
  if (!mapping) return null;

  const exnessSymbol = resolveExnessSymbol(instrumentId, config.exness.accountType);
  const exnessTf = mapTimeframeToExness(timeframe);
  const cacheKey = `exness:candles:${exnessSymbol}:${timeframe}:${limit}`;
  const cached = candleCache.get<ExnessCandle[]>(cacheKey);
  if (cached) return cached;

  const { accountId, token, apiUrl } = config.exness;
  if (!accountId || !token) return null;

  try {
    const url = `${apiUrl}/users/current/accounts/${accountId}/historical-market-data/symbols/${encodeURIComponent(exnessSymbol)}/timeframes/${exnessTf}/candles?limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const candles: ExnessCandle[] = data.map((c: any) => ({
          timestamp: new Date(c.time).getTime(),
          time: new Date(c.time).toISOString(),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.tickVolume || c.volume || 0),
        }));

        candleCache.set(cacheKey, candles);
        return candles;
      }
    }
  } catch (err: any) {
    console.warn(`[EXNESS] Candle fetch error for ${exnessSymbol}: ${err.message}`);
  }

  return null;
}
