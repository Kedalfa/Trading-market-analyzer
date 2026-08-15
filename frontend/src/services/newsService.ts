/**
 * Frontend news service — thin wrapper around the backend API.
 * News context is fetched from the backend which applies caching.
 * NOT called directly in pipeline anymore — page.tsx fetches it then passes it in.
 */

import { NewsContext } from '@/types/news';
import { Instrument } from '@/types/market';
import { fetchNews } from '@/services/api';

/**
 * Fetch economic events from the backend for a given instrument.
 * Returns a NewsContext compatible with the existing AI reasoning service.
 */
export async function getEconomicEventsForInstrument(instrument: Instrument): Promise<NewsContext> {
  const data = await fetchNews(instrument.id);

  // Cast backend response to frontend NewsContext type
  return {
    upcomingEvents: data.upcomingEvents as NewsContext['upcomingEvents'],
    recentEvents: data.recentEvents as NewsContext['recentEvents'],
    hasImminentHighImpactEvent: data.hasImminentHighImpactEvent,
    warningMessage: data.warningMessage,
  };
}
