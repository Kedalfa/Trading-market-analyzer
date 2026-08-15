export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'HOLIDAY';

export interface EconomicEvent {
  id: string;
  title: string;
  currency: string;
  impact: ImpactLevel;
  timestamp: number;      // Unix timestamp (ms or s)
  formattedTime: string;  // e.g. "14:30 EST"
  forecast?: string;
  previous?: string;
  actual?: string;
  timeUntilMinutes: number; // Negative if past
  isHighImpact: boolean;
  affectedInstruments: string[];
}

export interface NewsContext {
  upcomingEvents: EconomicEvent[];
  recentEvents: EconomicEvent[];
  hasImminentHighImpactEvent: boolean; // within next 60 mins
  warningMessage?: string;
}
