/**
 * Yahoo Finance Real Market Data Service
 * Provides genuine, non-synthetic OHLCV candles and real-time quotes for Forex (EURUSD=X, GBPUSD=X, JPY=X),
 * Commodities (GC=F Gold), and Indices (^GSPC, ^IXIC).
 * ZERO fake/synthetic fallback: if provider fails, returns null.
 */
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
export declare function mapTimeframeToYahoo(tf: string): {
    interval: string;
    range: string;
};
/**
 * Fetch genuine OHLCV candles from Yahoo Finance v8 chart API
 */
export declare function fetchYahooCandles(yahooSymbol: string, timeframe: string, limit?: number): Promise<{
    candles: RealCandle[];
    quote: RealQuote;
} | null>;
//# sourceMappingURL=yahooMarketService.d.ts.map