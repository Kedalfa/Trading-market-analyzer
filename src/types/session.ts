export type SessionName = 'SYDNEY' | 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'LONDON_NY_OVERLAP';

export interface TradingSession {
  name: SessionName;
  displayName: string;
  startHourUTC: number;
  endHourUTC: number;
  isActive: boolean;
  highPrice?: number;
  lowPrice?: number;
  openPrice?: number;
  closePrice?: number;
  sweptHigh: boolean;
  sweptLow: boolean;
}

export interface SessionStatus {
  currentSessions: TradingSession[];
  upcomingSession: {
    name: SessionName;
    displayName: string;
    startsInMinutes: number;
  } | null;
  activeOverlap: boolean;
  currentUtcTime: string;
}
