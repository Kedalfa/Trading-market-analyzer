'use client';

import React from 'react';
import { Instrument, RealQuote } from '@/types/market';
import { Activity, AlertCircle, CheckCircle2, Clock, Globe, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

interface ChartDataFreshnessBadgeProps {
  instrument: Instrument;
  quote?: RealQuote;
  status: 'LIVE' | 'MARKET_CLOSED' | 'DELAYED' | 'UNAVAILABLE';
  provider: string;
  lastUpdated: number;
  isRealTime: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ChartDataFreshnessBadge({
  instrument,
  quote,
  status,
  provider,
  lastUpdated,
  isRealTime,
  onRefresh,
  isRefreshing,
}: ChartDataFreshnessBadgeProps) {
  const isLive = status === 'LIVE' && isRealTime;
  const isClosed = status === 'MARKET_CLOSED';
  const isDelayed = status === 'DELAYED';
  const isUnavailable = status === 'UNAVAILABLE' || !isRealTime;

  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toUTCString().slice(17, 25) + ' UTC'
    : '—';

  return (
    <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-[#080d19] border-b border-[#1a253e] text-xs gap-2">
      {/* Left: Symbol, Quote & Bid/Ask */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Indicator Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
            isLive
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950'
              : isClosed
              ? 'bg-slate-800 text-slate-300 border-slate-600'
              : isDelayed
              ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              : 'bg-rose-950/60 text-rose-300 border-rose-500/40 animate-pulse'
          }`}
        >
          {isLive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE FEED</span>
            </>
          ) : isClosed ? (
            <>
              <Clock className="w-3 h-3 text-slate-400" />
              <span>MARKET CLOSED</span>
            </>
          ) : isDelayed ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>DELAYED FEED</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-rose-400" />
              <span>CONNECTION LOST</span>
            </>
          )}
        </div>

        {/* Live Price Tag */}
        {quote?.price != null && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-extrabold text-white">
              {quote.price.toFixed(instrument.assetClass === 'forex' ? 5 : 2)}
            </span>
          </div>
        )}

        {/* Real Bid & Ask (ONLY when genuinely provided) */}
        {quote?.bid != null && quote?.ask != null && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 border-l border-slate-800 pl-2">
            <span>
              Bid: <strong className="text-slate-200">{quote.bid.toFixed(instrument.assetClass === 'forex' ? 5 : 2)}</strong>
            </span>
            <span>
              Ask: <strong className="text-slate-200">{quote.ask.toFixed(instrument.assetClass === 'forex' ? 5 : 2)}</strong>
            </span>
            {quote.spread != null && (
              <span className="text-slate-500">
                Spread: <strong className="text-amber-300">{quote.spread.toFixed(instrument.assetClass === 'forex' ? 5 : 2)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Provider & Freshness Timestamp */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3 text-blue-400" />
          <span>Source: <strong className="text-slate-300">{provider}</strong></span>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Updated: <strong className="text-slate-300 font-mono">{formattedLastUpdated}</strong></span>
        </div>
      </div>
    </div>
  );
}
