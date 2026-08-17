'use client';

import React, { useState, useEffect } from 'react';
import { Instrument, RealQuote } from '@/types/market';
import { Activity, AlertCircle, CheckCircle2, Clock, Globe, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

interface ChartDataFreshnessBadgeProps {
  instrument: Instrument;
  quote?: RealQuote;
  status: 'LIVE' | 'MARKET_CLOSED' | 'DELAYED' | 'UNAVAILABLE' | 'STALE';
  provider: string;
  lastUpdated: number;
  isRealTime: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenHealthModal?: () => void;
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
  onOpenHealthModal,
}: ChartDataFreshnessBadgeProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    const updateElapsed = () => {
      if (!lastUpdated) return;
      const sec = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000));
      setElapsedSeconds(sec);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 500);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const isMarketClosed = status === 'MARKET_CLOSED' || quote?.status === 'MARKET_CLOSED';
  const isStale = status === 'STALE' || quote?.status === 'STALE' || (elapsedSeconds >= 20 && !isMarketClosed);
  const isLive = !isMarketClosed && !isStale && status !== 'UNAVAILABLE' && isRealTime;
  const isUnavailable = status === 'UNAVAILABLE' || !isRealTime;

  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toUTCString().slice(17, 25) + ' UTC'
    : '—';

  const elapsedText = elapsedSeconds < 2
    ? 'Just now'
    : elapsedSeconds < 60
    ? `${elapsedSeconds}s ago`
    : `${Math.floor(elapsedSeconds / 60)}m ago`;

  return (
    <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-[#080d19] border-b border-[#1a253e] text-xs gap-2">
      {/* Left: Symbol, Quote & Bid/Ask */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Indicator Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
            isLive
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950'
              : isMarketClosed
              ? 'bg-slate-800 text-slate-300 border-slate-600'
              : isStale
              ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              : 'bg-rose-950/60 text-rose-300 border-rose-500/40 animate-pulse'
          }`}
        >
          {isLive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE FEED</span>
            </>
          ) : isMarketClosed ? (
            <>
              <Clock className="w-3 h-3 text-slate-400" />
              <span>MARKET CLOSED</span>
            </>
          ) : isStale ? (
            <>
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>STALE FEED ({elapsedText})</span>
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
            {instrument.id === 'XAUUSD' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                Spot Gold (PAXG)
              </span>
            )}
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
        <button
          onClick={onOpenHealthModal}
          title="Click to view full market-data feeds health matrix"
          className="flex items-center gap-1 hover:text-blue-300 transition-colors px-2 py-0.5 rounded hover:bg-slate-800 border border-transparent hover:border-slate-700"
        >
          <Globe className="w-3 h-3 text-blue-400" />
          <span>Source: <strong className="text-slate-300 underline decoration-blue-500/50">{provider}</strong></span>
        </button>

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Updated: <strong className="text-slate-300 font-mono">{formattedLastUpdated}</strong></span>
          <span className="text-[10px] text-slate-500 font-mono">({elapsedText})</span>
        </div>
      </div>
    </div>
  );
}
