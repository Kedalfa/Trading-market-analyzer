import { Candle } from '@/types/market';
import { TradingSession, SessionStatus, SessionName } from '@/types/session';

export function getSessionStatus(candles: Candle[], date = new Date()): SessionStatus {
  const currentUtcHour = date.getUTCHours();
  const currentUtcMinutes = date.getUTCMinutes();
  const currentDecimalTime = currentUtcHour + currentUtcMinutes / 60;

  // Session hours (UTC)
  const sessionDefs: { name: SessionName; displayName: string; start: number; end: number }[] = [
    { name: 'SYDNEY', displayName: 'Sydney Session', start: 21, end: 6 },
    { name: 'TOKYO', displayName: 'Asian / Tokyo Session', start: 0, end: 9 },
    { name: 'LONDON', displayName: 'London Session', start: 7, end: 16 },
    { name: 'NEW_YORK', displayName: 'New York Session', start: 12, end: 21 },
    { name: 'LONDON_NY_OVERLAP', displayName: 'London / NY Overlap', start: 12, end: 16 }
  ];

  const currentSessions: TradingSession[] = sessionDefs.map(def => {
    let isActive = false;
    if (def.start < def.end) {
      isActive = currentDecimalTime >= def.start && currentDecimalTime < def.end;
    } else {
      // Overnight wrap (e.g. Sydney 21 to 6)
      isActive = currentDecimalTime >= def.start || currentDecimalTime < def.end;
    }

    // Calculate session High / Low from available candles if timestamp falls within session
    let highPrice: number | undefined;
    let lowPrice: number | undefined;
    let openPrice: number | undefined;
    let closePrice: number | undefined;

    if (candles.length > 0) {
      const sessionBars = candles.filter(c => {
        const barDate = new Date(c.timestamp * 1000);
        const h = barDate.getUTCHours();
        if (def.start < def.end) {
          return h >= def.start && h < def.end;
        } else {
          return h >= def.start || h < def.end;
        }
      });

      if (sessionBars.length > 0) {
        highPrice = Math.max(...sessionBars.map(b => b.high));
        lowPrice = Math.min(...sessionBars.map(b => b.low));
        openPrice = sessionBars[0].open;
        closePrice = sessionBars[sessionBars.length - 1].close;
      }
    }

    return {
      name: def.name,
      displayName: def.displayName,
      startHourUTC: def.start,
      endHourUTC: def.end,
      isActive,
      highPrice,
      lowPrice,
      openPrice,
      closePrice,
      sweptHigh: false,
      sweptLow: false
    };
  });

  const activeOverlap = currentSessions.find(s => s.name === 'LONDON_NY_OVERLAP')?.isActive ?? false;

  return {
    currentSessions,
    upcomingSession: {
      name: 'NEW_YORK',
      displayName: 'New York Session',
      startsInMinutes: Math.max(0, Math.round((12 - currentDecimalTime) * 60))
    },
    activeOverlap,
    currentUtcTime: date.toISOString().slice(11, 19) + ' UTC'
  };
}
