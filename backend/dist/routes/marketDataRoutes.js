"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Instrument_1 = require("../models/Instrument");
const instrumentRegistry_1 = require("../config/instrumentRegistry");
const binanceService_1 = require("../services/binanceService");
const yahooMarketService_1 = require("../services/yahooMarketService");
const router = (0, express_1.Router)();
/**
 * GET /api/market-data/:instrumentId?timeframe=15M&limit=250
 * Fetches verified, genuine OHLCV candles from the appropriate market data provider.
 * ZERO fake data fallback.
 */
router.get('/:instrumentId', async (req, res) => {
    const { instrumentId } = req.params;
    const timeframe = req.query.timeframe || '15M';
    const limit = Math.min(parseInt(req.query.limit || '250', 10), 500);
    try {
        const mapping = (0, instrumentRegistry_1.getInstrumentMapping)(instrumentId);
        const instrument = mapping || (await Instrument_1.Instrument.findOne({ id: instrumentId, isActive: true }).lean());
        if (!instrument) {
            return res.status(404).json({ success: false, error: `Instrument '${instrumentId}' not registered` });
        }
        let candles = null;
        let quoteInfo = null;
        let providerName = 'Official Provider';
        let isRealTime = false;
        let dataStatus = 'UNAVAILABLE';
        const displaySym = mapping?.displaySymbol || instrument.symbol || instrumentId;
        // ── 1. Binance Crypto Feed ──────────────────────────────────────
        if (instrument.provider === 'binance') {
            providerName = 'Binance Public Market Feed';
            const [binanceCandles, binanceQuote] = await Promise.all([
                (0, binanceService_1.fetchBinanceCandles)(instrumentId, timeframe, limit),
                (0, binanceService_1.fetchBinanceBookQuote)(instrumentId),
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
            const yahooSymbol = mapping?.providerSymbol || instrument.providerSymbol || (instrumentId === 'EURUSD' ? 'EURUSD=X' :
                instrumentId === 'GBPUSD' ? 'GBPUSD=X' :
                    instrumentId === 'USDJPY' ? 'JPY=X' :
                        instrumentId === 'XAUUSD' ? 'GC=F' :
                            instrumentId === 'US500' ? '^GSPC' :
                                instrumentId === 'NAS100' ? '^IXIC' : instrumentId);
            providerName = 'Yahoo Finance Institutional Feed';
            const result = await (0, yahooMarketService_1.fetchYahooCandles)(yahooSymbol, timeframe, limit);
            if (result && result.candles.length > 0) {
                candles = result.candles;
                quoteInfo = result.quote;
                isRealTime = true;
                dataStatus = result.quote.status || 'LIVE';
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
    }
    catch (err) {
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
router.get('/:instrumentId/quote', async (req, res) => {
    const { instrumentId } = req.params;
    try {
        const mapping = (0, instrumentRegistry_1.getInstrumentMapping)(instrumentId);
        const provider = mapping?.provider || 'yahoo';
        if (provider === 'binance') {
            const quote = await (0, binanceService_1.fetchBinanceBookQuote)(instrumentId);
            if (quote) {
                return res.json({ success: true, data: quote });
            }
        }
        else {
            const yahooSymbol = mapping?.providerSymbol || (instrumentId === 'EURUSD' ? 'EURUSD=X' :
                instrumentId === 'GBPUSD' ? 'GBPUSD=X' :
                    instrumentId === 'USDJPY' ? 'JPY=X' :
                        instrumentId === 'XAUUSD' ? 'GC=F' :
                            instrumentId === 'US500' ? '^GSPC' : '^IXIC');
            const result = await (0, yahooMarketService_1.fetchYahooCandles)(yahooSymbol, '1M_MIN', 2);
            if (result?.quote) {
                return res.json({ success: true, data: result.quote });
            }
        }
        res.status(503).json({ success: false, error: 'Live quote unavailable' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve quote' });
    }
});
exports.default = router;
//# sourceMappingURL=marketDataRoutes.js.map