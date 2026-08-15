import { EconomicEvent, NewsContext, ImpactLevel } from '@/types/news';
import { Instrument } from '@/types/market';

// Deterministic calendar data feed with live timestamps relative to current time
export function getEconomicEventsForInstrument(instrument: Instrument): NewsContext {
  const now = Date.now();
  const relevantCurrencies = [instrument.baseCurrency, instrument.quoteCurrency, 'USD'];

  // Base schedule of key macro events
  const mockCalendar: Omit<EconomicEvent, 'timeUntilMinutes' | 'timestamp' | 'formattedTime'>[] = [
    {
      id: 'event-nfp',
      title: 'Non-Farm Employment Change (NFP)',
      currency: 'USD',
      impact: 'HIGH',
      forecast: '185K',
      previous: '206K',
      isHighImpact: true,
      affectedInstruments: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'US500', 'NAS100']
    },
    {
      id: 'event-cpi',
      title: 'Consumer Price Index (CPI YoY)',
      currency: 'USD',
      impact: 'HIGH',
      forecast: '3.1%',
      previous: '3.0%',
      isHighImpact: true,
      affectedInstruments: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'US500']
    },
    {
      id: 'event-fomc',
      title: 'FOMC Interest Rate Decision & Statement',
      currency: 'USD',
      impact: 'HIGH',
      forecast: '5.50%',
      previous: '5.50%',
      isHighImpact: true,
      affectedInstruments: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'US500']
    },
    {
      id: 'event-ecb',
      title: 'ECB Monetary Policy Statement',
      currency: 'EUR',
      impact: 'HIGH',
      forecast: '3.75%',
      previous: '3.75%',
      isHighImpact: true,
      affectedInstruments: ['EURUSD']
    },
    {
      id: 'event-boe',
      title: 'BOE Official Bank Rate',
      currency: 'GBP',
      impact: 'HIGH',
      forecast: '5.25%',
      previous: '5.25%',
      isHighImpact: true,
      affectedInstruments: ['GBPUSD']
    },
    {
      id: 'event-pmi',
      title: 'S&P Global Manufacturing PMI',
      currency: 'USD',
      impact: 'MEDIUM',
      forecast: '49.8',
      previous: '49.6',
      isHighImpact: false,
      affectedInstruments: ['US500', 'NAS100', 'EURUSD']
    }
  ];

  // Distribute timestamps around current time
  const events: EconomicEvent[] = mockCalendar
    .filter(ev => relevantCurrencies.includes(ev.currency) || ev.affectedInstruments.includes(instrument.id))
    .map((ev, idx) => {
      // Create a distributed event schedule: some 2 hours ago, some in 45 mins, some tomorrow
      const minuteOffsets = [-120, 45, 180, 420, 1440, 2880];
      const offsetMin = minuteOffsets[idx % minuteOffsets.length];
      const eventTimestamp = now + offsetMin * 60 * 1000;
      const d = new Date(eventTimestamp);

      return {
        ...ev,
        timestamp: eventTimestamp,
        formattedTime: `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC`,
        timeUntilMinutes: offsetMin
      };
    });

  const upcomingEvents = events.filter(e => e.timeUntilMinutes > 0).sort((a, b) => a.timeUntilMinutes - b.timeUntilMinutes);
  const recentEvents = events.filter(e => e.timeUntilMinutes <= 0).sort((a, b) => b.timeUntilMinutes - a.timeUntilMinutes);

  const hasImminentHighImpactEvent = upcomingEvents.some(e => e.isHighImpact && e.timeUntilMinutes <= 60);

  let warningMessage: string | undefined;
  if (hasImminentHighImpactEvent) {
    const imminent = upcomingEvents.find(e => e.isHighImpact && e.timeUntilMinutes <= 60);
    warningMessage = `CAUTION: High-impact event "${imminent?.title}" is scheduled in ${imminent?.timeUntilMinutes} minutes. Expect severe slippage and potential spread expansion.`;
  }

  return {
    upcomingEvents,
    recentEvents,
    hasImminentHighImpactEvent,
    warningMessage
  };
}
