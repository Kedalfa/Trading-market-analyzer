/**
 * Central API client — all frontend ↔ backend communication goes through here.
 * No data is stored in localStorage. All persistence goes to MongoDB via the backend.
 */

import { RealQuote } from '@/types/market';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `API error ${res.status} on ${path}`);
  }
  return json.data as T;
}

// ────────────────────────────────────────────────
// Instruments
// ────────────────────────────────────────────────
export async function fetchInstruments() {
  return apiFetch<Instrument[]>('/api/instruments');
}

export async function fetchInstrument(id: string) {
  return apiFetch<Instrument>(`/api/instruments/${id}`);
}

// ────────────────────────────────────────────────
// Market Data
// ────────────────────────────────────────────────
export interface MarketDataApiResponse {
  instrumentId: string;
  symbol: string;
  timeframe: string;
  candles: Candle[];
  quote?: RealQuote;
  status: 'LIVE' | 'MARKET_CLOSED' | 'DELAYED' | 'UNAVAILABLE';
  isRealTime: boolean;
  provider: string;
  lastUpdated: number;
  statusMessage: string;
}

export async function fetchMarketData(
  instrumentId: string,
  timeframe: string,
  limit = 250
): Promise<MarketDataApiResponse> {
  return apiFetch<MarketDataApiResponse>(
    `/api/market-data/${instrumentId}?timeframe=${timeframe}&limit=${limit}`
  );
}

export async function fetchRealtimeQuote(instrumentId: string): Promise<RealQuote> {
  return apiFetch<RealQuote>(`/api/market-data/${instrumentId}/quote`);
}

// ────────────────────────────────────────────────
// News / Economic Calendar
// ────────────────────────────────────────────────
export interface NewsApiResponse {
  upcomingEvents: EconomicEvent[];
  recentEvents: EconomicEvent[];
  hasImminentHighImpactEvent: boolean;
  warningMessage?: string;
}

export async function fetchNews(instrumentId: string): Promise<NewsApiResponse> {
  return apiFetch<NewsApiResponse>(`/api/news/${instrumentId}`);
}

// ────────────────────────────────────────────────
// Analyses
// ────────────────────────────────────────────────
export async function saveAnalysis(analysis: object) {
  return apiFetch<object>('/api/analyses', {
    method: 'POST',
    body: JSON.stringify(analysis),
  });
}

export async function listAnalyses(params?: {
  symbol?: string;
  timeframe?: string;
  htfBias?: string;
  grade?: string;
  limit?: number;
  skip?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.symbol) qs.set('symbol', params.symbol);
  if (params?.timeframe) qs.set('timeframe', params.timeframe);
  if (params?.htfBias) qs.set('htfBias', params.htfBias);
  if (params?.grade) qs.set('grade', params.grade);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.skip) qs.set('skip', String(params.skip));

  const url = `/api/analyses${qs.toString() ? '?' + qs.toString() : ''}`;
  const res = await fetch(`${BASE_URL}${url}`, { headers: { 'Content-Type': 'application/json' } });
  const json = await res.json();
  return { data: json.data as object[], total: json.total as number };
}

export async function updateAnalysisOutcome(
  analysisId: string,
  outcome: {
    status: 'OPEN' | 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED';
    maxFavorableExcursion?: number;
    maxAdverseExcursion?: number;
    notes?: string;
  }
) {
  return apiFetch<object>(`/api/analyses/${analysisId}/outcome`, {
    method: 'PATCH',
    body: JSON.stringify(outcome),
  });
}

export async function deleteAnalysis(analysisId: string) {
  return apiFetch<{ message: string }>(`/api/analyses/${analysisId}`, { method: 'DELETE' });
}

// ────────────────────────────────────────────────
// Trade Ideas
// ────────────────────────────────────────────────
export async function saveTradeIdea(idea: object) {
  return apiFetch<object>('/api/trade-ideas', {
    method: 'POST',
    body: JSON.stringify(idea),
  });
}

export async function listTradeIdeas(params?: {
  symbol?: string;
  direction?: string;
  status?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.symbol) qs.set('symbol', params.symbol);
  if (params?.direction) qs.set('direction', params.direction);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));

  const url = `/api/trade-ideas${qs.toString() ? '?' + qs.toString() : ''}`;
  const res = await fetch(`${BASE_URL}${url}`, { headers: { 'Content-Type': 'application/json' } });
  const json = await res.json();
  return { data: json.data as object[], total: json.total as number };
}

export async function updateTradeIdeaStatus(ideaId: string, status: string) {
  return apiFetch<object>(`/api/trade-ideas/${ideaId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteTradeIdea(ideaId: string) {
  return apiFetch<{ message: string }>(`/api/trade-ideas/${ideaId}`, { method: 'DELETE' });
}

// ────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────
export interface RiskSettings {
  accountBalance: number;
  maxRiskPerTradePercent: number;
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
  minRiskRewardRatio: number;
}

export interface UserSettingsResponse {
  userId: string;
  riskSettings: RiskSettings;
  defaultInstrumentId: string;
  defaultTimeframe: string;
  defaultRuleset: string;
  chartLayerDefaults: Record<string, boolean>;
}

export async function fetchSettings(): Promise<UserSettingsResponse> {
  return apiFetch<UserSettingsResponse>('/api/settings');
}

export async function updateRiskSettings(riskSettings: Partial<RiskSettings>) {
  return apiFetch<UserSettingsResponse>('/api/settings/risk', {
    method: 'PATCH',
    body: JSON.stringify(riskSettings),
  });
}

export async function updateSettings(settings: Partial<UserSettingsResponse>) {
  return apiFetch<UserSettingsResponse>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ────────────────────────────────────────────────
// Shared types (mirrored from backend for frontend use)
// ────────────────────────────────────────────────
export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClass: 'forex' | 'crypto' | 'indices' | 'commodities';
  baseCurrency: string;
  quoteCurrency: string;
  pipSize: number;
  tickSize: number;
  defaultTimeframe: string;
  provider: 'binance' | 'yahoo' | 'custom';
  isActive: boolean;
}

export interface Candle {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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
