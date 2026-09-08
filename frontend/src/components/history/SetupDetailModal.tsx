'use client';

import React, { useState, useEffect } from 'react';
import { fetchSetupDetails } from '@/services/api';
import {
  X, CheckCircle2, Shield, Target, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, Award, Sparkles,
  Zap, Eye, RefreshCw, FileText, Layers
} from 'lucide-react';

interface SetupDetailModalProps {
  analysisId: string | null;
  onClose: () => void;
}

export function SetupDetailModal({ analysisId, onClose }: SetupDetailModalProps) {
  const [details, setDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!analysisId) return;
    let isMounted = true;
    setIsLoading(true);

    fetchSetupDetails(analysisId)
      .then(data => {
        if (isMounted) setDetails(data);
      })
      .catch(err => {
        console.error('[SetupDetailModal] Error fetching setup details:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [analysisId]);

  if (!analysisId) return null;

  const isBull = details?.direction === 'BULLISH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-[#0b101d] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b] bg-[#0e1628]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              isBull
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-600/20 text-rose-400 border-rose-500/40'
            }`}>
              {isBull ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  {details ? `${details.symbol} (${details.timeframe}) — ${details.direction}` : 'Setup Reasoning & Evidence'}
                </h2>
                {details && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Grade {details.quality.grade} ({details.quality.totalScore}/100)
                  </span>
                )}
                {details && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                    {details.analysisId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Immutable structural evidence & rationale snapshot (No look-ahead bias)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 space-x-3 text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span>Loading verified evidence record from database…</span>
            </div>
          ) : !details ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Setup details record could not be loaded.
            </div>
          ) : (
            <>
              {/* 1. Model & Trigger Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900 border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    SMC Setup Model:
                  </span>
                  <span className="font-mono text-slate-200 font-semibold bg-black/40 px-2.5 py-0.5 rounded border border-slate-800">
                    {details.setupModel}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-amber-300">Trigger:</strong> {details.trigger}
                </div>
              </div>

              {/* 2. Why This Setup Exists */}
              <div className="p-4 rounded-xl bg-[#0e1628] border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Why This Setup Exists
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {details.whyOccurred}
                </p>
              </div>

              {/* 3. Structural Evidence Checklist */}
              <div className="p-4 rounded-xl bg-[#0e1628] border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Verified Structural Confluence Evidence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {details.evidenceChecklist.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                        item.passed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                          : 'bg-slate-900/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${item.passed ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <div>
                        <strong className={item.passed ? 'text-white' : 'text-slate-400'}>{item.label}</strong>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Execution Levels & Rationale */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Entry Zone */}
                <div className="p-4 rounded-xl bg-[#0e1628] border border-blue-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">Entry Zone</span>
                    <strong className="text-blue-300 font-mono text-sm">{details.entryPrice}</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                    {details.entryReason}
                  </p>
                </div>

                {/* Invalidation / Stop */}
                <div className="p-4 rounded-xl bg-[#0e1628] border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">Invalidation (SL)</span>
                    <strong className="text-rose-400 font-mono text-sm">{details.stopLossPrice}</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                    {details.invalidationReason}
                  </p>
                </div>

                {/* Targets — multi-TP if available, single fallback for legacy records */}
                <div className="p-4 rounded-xl bg-[#0e1628] border border-emerald-500/30 space-y-2">
                  <span className="text-slate-400 font-bold text-xs block">
                    Targets ({details.riskRewardRatio}R to TP2)
                  </span>
                  <div className="space-y-1.5">
                    {details.takeProfit1 != null ? (
                      <>
                        <div className="flex items-center justify-between p-1.5 rounded bg-emerald-950/20 border border-emerald-900/40">
                          <span className="text-slate-400 text-[11px]">TP1 <span className="text-slate-600">(Partial / Internal)</span></span>
                          <strong className="text-emerald-300 font-mono text-xs">{details.takeProfit1}</strong>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded bg-emerald-950/30 border border-emerald-600/40">
                          <span className="text-slate-400 text-[11px]">TP2 <span className="text-slate-600">(Primary Target)</span></span>
                          <strong className="text-emerald-400 font-mono text-xs">{details.takeProfit2 ?? details.targetPrice}</strong>
                        </div>
                        {details.takeProfit3 != null && (
                          <div className="flex items-center justify-between p-1.5 rounded bg-emerald-950/20 border border-emerald-400/30">
                            <span className="text-slate-400 text-[11px]">TP3 <span className="text-slate-600">(Runner)</span></span>
                            <strong className="text-emerald-200 font-mono text-xs">{details.takeProfit3}</strong>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between p-1.5 rounded bg-emerald-950/30 border border-emerald-600/40">
                        <span className="text-slate-400 text-[11px]">Target</span>
                        <strong className="text-emerald-400 font-mono text-xs">{details.targetPrice}</strong>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                    {details.targetReason}
                  </p>
                </div>
              </div>

              {/* 5. Live Monitoring & Excursion State */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-400">Monitoring State:</span>
                  <strong className="text-white font-mono">{details.currentMonitoringState.monitoringStatus}</strong>
                </div>

                <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                  <span>MFE: <strong className="text-emerald-400">+{details.currentMonitoringState.maxFavorableExcursion ?? 0}</strong></span>
                  <span>MAE: <strong className="text-rose-400">-{details.currentMonitoringState.maxAdverseExcursion ?? 0}</strong></span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0e1628] border-t border-[#1e293b] flex items-center justify-between text-xs text-slate-400">
          <span>Created: {details ? new Date(details.savedAt).toUTCString() : '—'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
