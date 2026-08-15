export type Timeframe = '1M' | '1W' | '1D' | '4H' | '1H' | '30M' | '15M' | '5M' | '1M_MIN';

export type AssetClass = 'forex' | 'crypto' | 'indices' | 'commodities';

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  baseCurrency: string;
  quoteCurrency: string;
  pipSize: number;
  tickSize: number;
  defaultTimeframe: string;
  provider: 'binance' | 'yahoo' | 'custom';
}

export interface Candle {
  timestamp: number; // Unix epoch in seconds
  time: string;      // ISO string or formatted date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MultiTimeframeSelection {
  higher: string;       // e.g. '4H' or '1D' (Macro Bias)
  intermediate: string; // e.g. '1H' (Structural Direction)
  setup: string;        // e.g. '15M' (Setup / Liquidity Sweeps)
  entry: string;        // e.g. '5M' (Execution / MSS)
}

export interface MarketDataResponse {
  instrument: Instrument;
  timeframe: string;
  candles: Candle[];
  lastUpdated: number;
  provider: string;
  isRealTime: boolean;
  statusMessage?: string;
}
