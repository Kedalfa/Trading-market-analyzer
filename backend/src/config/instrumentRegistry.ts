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
  provider: 'binance' | 'yahoo' | 'twelvedata' | 'finnhub' | 'exness';
  providerSymbol: string;
  exnessSymbol?: string;
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
    provider: 'exness',
    providerSymbol: 'EURUSD=X',
    exnessSymbol: 'EURUSD',
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
    provider: 'exness',
    providerSymbol: 'GBPUSD=X',
    exnessSymbol: 'GBPUSD',
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
    provider: 'exness',
    providerSymbol: 'JPY=X',
    exnessSymbol: 'USDJPY',
    isActive: true,
  },

  // ── Crypto (Spot / CFD) ─────────────────────────────────────────
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
    provider: 'exness',
    providerSymbol: 'BTCUSDT',
    exnessSymbol: 'BTCUSD',
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
    provider: 'exness',
    providerSymbol: 'ETHUSDT',
    exnessSymbol: 'ETHUSD',
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
    provider: 'exness',
    providerSymbol: 'SOLUSDT',
    exnessSymbol: 'SOLUSD',
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
    provider: 'exness',
    providerSymbol: 'PAXGUSDT', // London Bullion physical spot gold backed 1:1
    exnessSymbol: 'XAUUSD',
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
    provider: 'exness',
    providerSymbol: '^GSPC',
    exnessSymbol: 'US500',
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
    provider: 'exness',
    providerSymbol: '^IXIC',
    exnessSymbol: 'USTEC', // Exness lists Nasdaq 100 as USTEC or USTECm
    isActive: true,
  },
];

// O(1) lookup maps (populated once at module load)
const _byId = new Map<string, InstrumentMapping>();
const _byProviderSymbol = new Map<string, InstrumentMapping>();
const _byExnessSymbol = new Map<string, InstrumentMapping>();

for (const inst of INSTRUMENT_REGISTRY) {
  _byId.set(inst.id, inst);
  _byProviderSymbol.set(inst.providerSymbol, inst);
  if (inst.exnessSymbol) {
    _byExnessSymbol.set(inst.exnessSymbol.toUpperCase(), inst);
    _byExnessSymbol.set(`${inst.exnessSymbol.toUpperCase()}M`, inst); // Support standard mini/micro 'm' suffix
  }
}

export function getInstrumentMapping(id: string): InstrumentMapping | undefined {
  const clean = id.replace(/[\/\-_]/g, '').toUpperCase();
  return _byId.get(id) ?? _byId.get(clean) ?? _byProviderSymbol.get(id) ?? _byExnessSymbol.get(clean);
}

export function resolveExnessSymbol(instrumentId: string, accountType: string = 'standard'): string {
  const mapping = getInstrumentMapping(instrumentId);
  const baseExnessSymbol = mapping?.exnessSymbol || instrumentId.replace(/[\/\-_]/g, '').toUpperCase();
  
  // Standard accounts in Exness MT4/MT5 typically append 'm' (e.g. EURUSDm, XAUUSDm, USTECm)
  // Raw Spread, Zero, and Pro accounts typically use raw root symbols (EURUSD, XAUUSD, USTEC)
  if (accountType === 'standard' && !baseExnessSymbol.endsWith('m') && !baseExnessSymbol.endsWith('M')) {
    return `${baseExnessSymbol}m`;
  }
  return baseExnessSymbol;
}
