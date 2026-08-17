/**
 * Symbol & Provider Mapping Abstraction
 * Properly maps display symbols (e.g. EUR/USD) to provider-specific endpoints.
 */

export interface InstrumentMapping {
  id: string;
  displaySymbol: string;
  name: string;
  assetClass: 'forex' | 'crypto' | 'indices' | 'commodities';
  baseCurrency: string;
  quoteCurrency: string;
  pipSize: number;
  tickSize: number;
  defaultTimeframe: string;
  provider: 'binance' | 'yahoo' | 'twelvedata' | 'finnhub';
  providerSymbol: string;
  isActive: boolean;
}

export const INSTRUMENT_REGISTRY: InstrumentMapping[] = [
  // ── Forex (OTC Currency Pairs) ──────────────────────────────────
  {
    id: 'EURUSD',
    displaySymbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    assetClass: 'forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    pipSize: 0.0001,
    tickSize: 0.00001,
    defaultTimeframe: '15M',
    provider: 'yahoo',
    providerSymbol: 'EURUSD=X',
    isActive: true,
  },
  {
    id: 'GBPUSD',
    displaySymbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    assetClass: 'forex',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    pipSize: 0.0001,
    tickSize: 0.00001,
    defaultTimeframe: '15M',
    provider: 'yahoo',
    providerSymbol: 'GBPUSD=X',
    isActive: true,
  },
  {
    id: 'USDJPY',
    displaySymbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    assetClass: 'forex',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    pipSize: 0.01,
    tickSize: 0.001,
    defaultTimeframe: '15M',
    provider: 'yahoo',
    providerSymbol: 'JPY=X',
    isActive: true,
  },

  // ── Crypto (Binance Spot) ───────────────────────────────────────
  {
    id: 'BTCUSDT',
    displaySymbol: 'BTC/USDT',
    name: 'Bitcoin / Tether Spot',
    assetClass: 'crypto',
    baseCurrency: 'BTC',
    quoteCurrency: 'USDT',
    pipSize: 1.0,
    tickSize: 0.01,
    defaultTimeframe: '15M',
    provider: 'binance',
    providerSymbol: 'BTCUSDT',
    isActive: true,
  },
  {
    id: 'ETHUSDT',
    displaySymbol: 'ETH/USDT',
    name: 'Ethereum / Tether Spot',
    assetClass: 'crypto',
    baseCurrency: 'ETH',
    quoteCurrency: 'USDT',
    pipSize: 0.1,
    tickSize: 0.01,
    defaultTimeframe: '15M',
    provider: 'binance',
    providerSymbol: 'ETHUSDT',
    isActive: false, // Deactivated from live universe per trading requirement
  },
  {
    id: 'SOLUSDT',
    displaySymbol: 'SOL/USDT',
    name: 'Solana / Tether Spot',
    assetClass: 'crypto',
    baseCurrency: 'SOL',
    quoteCurrency: 'USDT',
    pipSize: 0.01,
    tickSize: 0.001,
    defaultTimeframe: '15M',
    provider: 'binance',
    providerSymbol: 'SOLUSDT',
    isActive: false, // Deactivated from live universe per trading requirement
  },

  // ── Commodities (Spot Metals) ───────────────────────────────────
  {
    id: 'XAUUSD',
    displaySymbol: 'XAU/USD',
    name: 'XAU/USD — Spot Gold',
    assetClass: 'commodities',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    pipSize: 0.1,
    tickSize: 0.01,
    defaultTimeframe: '15M',
    provider: 'binance',
    providerSymbol: 'PAXGUSDT', // London Bullion physical spot gold backed 1:1
    isActive: true,
  },

  // ── Indices ─────────────────────────────────────────────────────
  {
    id: 'US500',
    displaySymbol: 'S&P 500',
    name: 'S&P 500 Index',
    assetClass: 'indices',
    baseCurrency: 'USD',
    quoteCurrency: 'USD',
    pipSize: 0.25,
    tickSize: 0.01,
    defaultTimeframe: '15M',
    provider: 'yahoo',
    providerSymbol: '^GSPC',
    isActive: true,
  },
  {
    id: 'NAS100',
    displaySymbol: 'NAS100',
    name: 'Nasdaq 100 Index',
    assetClass: 'indices',
    baseCurrency: 'USD',
    quoteCurrency: 'USD',
    pipSize: 0.25,
    tickSize: 0.01,
    defaultTimeframe: '15M',
    provider: 'yahoo',
    providerSymbol: '^IXIC',
    isActive: true,
  },
];

export function getInstrumentMapping(id: string): InstrumentMapping | undefined {
  return INSTRUMENT_REGISTRY.find(i => i.id === id || i.providerSymbol === id);
}
