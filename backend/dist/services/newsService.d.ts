/**
 * News / Economic Calendar Service
 * Fetches events from ForexFactory RSS (public) with fallback to structured mock data.
 * All timestamps are computed relative to NOW — nothing hardcoded.
 */
export interface EconomicEvent {
    id: string;
    title: string;
    currency: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    timestamp: number;
    formattedTime: string;
    forecast?: string;
    previous?: string;
    actual?: string;
    timeUntilMinutes: number;
    isHighImpact: boolean;
    affectedInstruments: string[];
}
/**
 * Get economic events relevant to the given instrument.
 */
export declare function getEventsForInstrument(instrumentId: string): {
    upcomingEvents: EconomicEvent[];
    recentEvents: EconomicEvent[];
    hasImminentHighImpactEvent: boolean;
    warningMessage?: string;
};
//# sourceMappingURL=newsService.d.ts.map