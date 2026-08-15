/**
 * Binance Service — fetches genuine, live OHLCV candles & quotes from the Binance public REST API.
 * ZERO fake/synthetic fallback: if provider fails, returns null.
 */
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
export declare function mapToBinanceInterval(tf: string): string;
export declare function getTimeframeSeconds(tf: string): number;
/**
 * Fetch live candles from Binance public API with caching.
 */
export declare function fetchBinanceCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[] | null>;
/**
 * Fetch genuine real-time ticker book (bid/ask/spread) from Binance
 */
export declare function fetchBinanceBookQuote(symbol: string): Promise<CryptoQuote | null>;
//# sourceMappingURL=binanceService.d.ts.map