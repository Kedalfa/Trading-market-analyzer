'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { listAnalyses, deleteAnalysis, updateAnalysisOutcome } from '@/services/api';
import {
  History, CheckCircle2, Trash2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Target, XCircle, AlertCircle, TrendingUp
} from 'lucide-react';

interface SavedAnalysis {
  analysisId: string;
  symbol: string;
  instrumentId: string;
  timeframe: string;
  currentPrice: number;
  rulesetUsed: string;
  htfBias: 'BULLISH' | 'BEARISH' | 'RANGING';
  setupQuality: { totalScore: number; grade: string };
  bullishScenario: { potentialTargets?: { price: number }[]; invalidationPrice?: number };
  bearishScenario: { potentialTargets?: { price: number }[]; invalidationPrice?: number };
  savedAt: string;
  outcome?: { status: 'OPEN' | 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED'; notes?: string };
}

const OUTCOME_STATUS_OPTIONS = ['OPEN', 'TARGET_HIT', 'STOPPED_OUT', 'INVALIDATED'] as const;

export function HistoryView() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterBias, setFilterBias] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED'>('ALL');

  const loadAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterBias !== 'ALL') params.htfBias = filterBias;

      const result = await listAnalyses({
        htfBias: filterBias !== 'ALL' ? filterBias : undefined,
        limit: 100,
      });

      // Client-side status filter (could be moved to backend)
      let data = result.data as SavedAnalysis[];
      if (filterStatus !== 'ALL') {
        data = data.filter(a => a.outcome?.status === filterStatus);
      }

      setAnalyses(data);
      setTotal(result.total);
    } catch (err) {
      console.error('[HistoryView] Failed to load analyses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterBias, filterStatus]);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const handleDelete = async (analysisId: string) => {
    if (!confirm('Delete this saved analysis?')) return;
    try {
      await deleteAnalysis(analysisId);
      setAnalyses(prev => prev.filter(a => a.analysisId !== analysisId));
    } catch (err) {
      console.error('[HistoryView] Delete failed:', err);
    }
  };

  const handleUpdateOutcome = async (
    analysisId: string,
    status: typeof OUTCOME_STATUS_OPTIONS[number]
  ) => {
    try {
      await updateAnalysisOutcome(analysisId, { status });
      setAnalyses(prev =>
        prev.map(a => a.analysisId === analysisId
          ? { ...a, outcome: { ...a.outcome, status } }
          : a
        )
      );
    } catch (err) {
      console.error('[HistoryView] Outcome update failed:', err);
    }
  };

  const gradeColor = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (grade === 'B') return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (grade === 'C') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
  };

  const statusIcon = (status?: string) => {
    if (status === 'TARGET_HIT') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === 'STOPPED_OUT') return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
    if (status === 'INVALIDATED') return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
    return <Target className="w-3.5 h-3.5 text-blue-400" />;
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">SMC Analysis History</h1>
            {!isLoading && (
              <span className="text-xs text-slate-500 font-normal">({total} total in database)</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Persistent analyses stored in MongoDB — track predictions, invalidations, and outcomes
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Bias Filter */}
          <div className="flex bg-[#0e1628] p-1 rounded-xl border border-slate-800 text-xs gap-1">
            {(['ALL', 'BULLISH', 'BEARISH'] as const).map(b => (
              <button
                key={b}
                onClick={() => setFilterBias(b)}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filterBias === b
                    ? b === 'BULLISH' ? 'bg-emerald-600 text-white'
                      : b === 'BEARISH' ? 'bg-rose-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {b === 'ALL' ? 'All Biases' : b}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-[#0e1628] p-1 rounded-xl border border-slate-800 text-xs gap-1">
            {(['ALL', 'OPEN', 'TARGET_HIT', 'STOPPED_OUT'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                  filterStatus === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={loadAnalyses}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Loading from MongoDB…</span>
        </div>
      ) : analyses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0b101d] border border-[#1e293b] space-y-3">
          <History className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-slate-300 font-bold text-base">No Saved Analyses Found</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            Run a market analysis and click "Save Analysis" to store it in MongoDB and track outcomes here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analyses.map((analysis) => {
            const isBull = analysis.htfBias === 'BULLISH';
            const target = isBull
              ? analysis.bullishScenario?.potentialTargets?.[0]?.price
              : analysis.bearishScenario?.potentialTargets?.[0]?.price;
            const invalidation = isBull
              ? analysis.bullishScenario?.invalidationPrice
              : analysis.bearishScenario?.invalidationPrice;

            return (
              <div
                key={analysis.analysisId}
                className="p-4 rounded-xl bg-[#0b101d] border border-[#1e293b] hover:border-slate-700 space-y-3 transition-all"
              >
                {/* Title Row */}
                <div className="flex items-center justify-between pb-2 border-b border-[#17223b]">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                      isBull
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {isBull ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {analysis.htfBias}
                    </span>
                    <strong className="text-white text-sm">{analysis.symbol}</strong>
                    <span className="text-slate-500 text-xs">({analysis.timeframe})</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${gradeColor(analysis.setupQuality.grade)}`}>
                      {analysis.setupQuality.grade}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(analysis.savedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Price Matrix */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Entry Price</span>
                    <strong className="text-blue-300 font-mono">{analysis.currentPrice.toFixed(4)}</strong>
                  </div>
                  <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Target</span>
                    <strong className="text-emerald-400 font-mono">{target?.toFixed(4) ?? '—'}</strong>
                  </div>
                  <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Invalidation</span>
                    <strong className="text-rose-400 font-mono">{invalidation?.toFixed(4) ?? '—'}</strong>
                  </div>
                </div>

                {/* Quality Score */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Setup Quality Score:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          analysis.setupQuality.totalScore >= 75 ? 'bg-emerald-500'
                          : analysis.setupQuality.totalScore >= 50 ? 'bg-amber-500'
                          : 'bg-rose-500'
                        }`}
                        style={{ width: `${analysis.setupQuality.totalScore}%` }}
                      />
                    </div>
                    <span className="font-mono text-slate-300">{analysis.setupQuality.totalScore}/100</span>
                  </div>
                </div>

                {/* Outcome Status + Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[#17223b] gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    {statusIcon(analysis.outcome?.status)}
                    <select
                      value={analysis.outcome?.status ?? 'OPEN'}
                      onChange={e => handleUpdateOutcome(
                        analysis.analysisId,
                        e.target.value as typeof OUTCOME_STATUS_OPTIONS[number]
                      )}
                      className="bg-[#0e1628] border border-slate-700 text-slate-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {OUTCOME_STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleDelete(analysis.analysisId)}
                    className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                    title="Delete analysis"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
