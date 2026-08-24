'use client';

import React, { useState, useEffect } from 'react';
import { fetchMarketDataHealth, MarketDataHealthResponse } from '@/services/api';
import { 
  Activity, CheckCircle2, Clock, Globe, RefreshCw, 
  ShieldCheck, Wifi, WifiOff, X, AlertTriangle, Cpu
} from 'lucide-react';

interface MarketDataHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarketDataHealthModal({ isOpen, onClose }: MarketDataHealthModalProps) {
  const [data, setData] = useState<MarketDataHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetchMarketDataHealth();
      setData(res);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[MarketHealthModal] Error fetching health matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadHealth();

    if (!autoRefresh) return;
    const timer = setInterval(loadHealth, 2000);
    return () => clearInterval(timer);
  }, [isOpen, autoRefresh]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl max-h-[90vh] bg-[#0c1222] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e293b] bg-[#0f172a]/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Live Market Data Health & Feeds Matrix
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
                  data?.systemStatus === 'HEALTHY'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950 text-amber-300 border-amber-500/40'
                }`}>
                  {data?.systemStatus || 'CONNECTING'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time telemetry from Exness Broker (MT5) & institutional market data gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setAutoRefresh(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                autoRefresh
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {autoRefresh ? '● Auto (2s)' : 'Paused'}
            </button>

            <button
              onClick={loadHealth}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Table Matrix */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-[#1e293b] bg-[#080d19]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#0e1628] text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Instrument</th>
                  <th className="py-3 px-4 font-semibold">Asset Class</th>
                  <th className="py-3 px-4 font-semibold">Feed Source</th>
                  <th className="py-3 px-4 font-semibold">Provider Symbol</th>
                  <th className="py-3 px-4 font-semibold text-right">Live Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Bid / Ask</th>
                  <th className="py-3 px-4 font-semibold text-right">Feed Age</th>
                  <th className="py-3 px-4 font-semibold text-center">Feed Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17223b]">
                {data?.instruments.map((inst) => {
                  const isForex = inst.assetClass === 'forex';
                  const isLive = inst.status === 'LIVE';
                  const isClosed = inst.status === 'MARKET_CLOSED';

                  return (
                    <tr
                      key={inst.instrumentId}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Instrument Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white font-mono">{inst.symbol}</div>
                        <div className="text-[10px] text-slate-400">{inst.displayName}</div>
                      </td>

                      {/* Asset Class */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          {inst.assetClass}
                        </span>
                      </td>

                      {/* Feed Source */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                          <Globe className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                          <span className="font-semibold">{inst.provider === 'exness' ? 'Exness (MT5)' : inst.provider}</span>
                        </div>
                      </td>

                      {/* Provider Symbol */}
                      <td className="py-3.5 px-4">
                        <code className="text-blue-300 font-mono text-[11px] bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/40">
                          {inst.providerSymbol}
                        </code>
                      </td>

                      {/* Live Price */}
                      <td className="py-3.5 px-4 text-right">
                        {inst.price != null ? (
                          <span className="font-mono font-extrabold text-sm text-white">
                            {inst.price.toFixed(isForex ? 5 : 2)}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>

                      {/* Bid / Ask */}
                      <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                        {inst.bid != null && inst.ask != null ? (
                          <div className="space-y-0.5">
                            <span className="text-emerald-400">{inst.bid.toFixed(isForex ? 5 : 2)}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-rose-400">{inst.ask.toFixed(isForex ? 5 : 2)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Mid/Last</span>
                        )}
                      </td>

                      {/* Latency / Age */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {inst.dataAgeMs != null ? (
                          <span className={`text-[11px] font-bold ${
                            inst.dataAgeMs < 2000
                              ? 'text-emerald-400'
                              : inst.dataAgeMs < 10000
                              ? 'text-blue-400'
                              : 'text-amber-400'
                          }`}>
                            {inst.dataAgeMs < 1000
                              ? `${inst.dataAgeMs}ms`
                              : `${(inst.dataAgeMs / 1000).toFixed(1)}s`}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Market Session */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-[11px]">{inst.session}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${
                          isLive
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950'
                            : isClosed
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-amber-950 text-amber-300 border-amber-500/40'
                        }`}>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Verification Protocol Banner */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 flex items-start gap-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-blue-200">Institutional Market Integrity & Spot Gold Verification</strong>
              <p className="text-slate-300 leading-relaxed">
                All quotes originate directly from authorized live market endpoints. Spot Gold (<code className="text-blue-300">XAU/USD</code>) is mapped to continuous London vault-backed physical spot bullion (<code className="text-blue-300">PAXGUSDT</code>) with millisecond book depth to prevent Gold Futures (<code className="text-blue-300">GC=F</code>) contract roll divergence.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0e1628] flex items-center justify-between text-xs text-slate-400">
          <div>
            Last checked: <strong className="text-slate-200 font-mono">{lastRefreshed ? lastRefreshed.toUTCString().slice(17, 25) + ' UTC' : '—'}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
