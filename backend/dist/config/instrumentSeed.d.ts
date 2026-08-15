/**
 * Instrument seed data — seeded to MongoDB on first startup.
 * Prices are NOT stored here (fetched live from providers).
 * Only metadata that is stable.
 */
export declare const INSTRUMENT_SEED: {
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    baseCurrency: string;
    quoteCurrency: string;
    pipSize: number;
    tickSize: number;
    defaultTimeframe: string;
    provider: string;
    isActive: boolean;
}[];
//# sourceMappingURL=instrumentSeed.d.ts.map