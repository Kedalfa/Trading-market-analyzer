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
export declare const INSTRUMENT_REGISTRY: InstrumentMapping[];
export declare function getInstrumentMapping(id: string): InstrumentMapping | undefined;
//# sourceMappingURL=instrumentRegistry.d.ts.map