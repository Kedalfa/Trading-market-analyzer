'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { listAnalyses, deleteAnalysis, getExportAnalysesCsvUrl } from '@/services/api';
import { SetupDetailModal } from './SetupDetailModal';
import {
  History, CheckCircle2, Trash2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Target, XCircle, AlertCircle, TrendingUp,
  Clock, Shield, Award, ChevronDown, ChevronUp, Zap, Radio,
  Sparkles, Download, FileText, Calendar, Search, Filter,
  ChevronLeft, ChevronRight, BarChart2, PieChart, Activity
} from 'lucide-react';

interface AuditEntry {
  previousStatus: string;
  newStatus: string;
  timestamp: string;
  triggerPrice?: number;
  triggerReason: string;
  observedPrice?: number;
}

interface SavedAnalysis {
  analysisId: string;
  symbol: string;
  instrumentId: string;
  timeframe: string;
  currentPrice: number;
  direction: 'BULLISH' | 'BEARISH';
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  invalidationPrice: number;
  riskRewardRatio: number;
  rulesetUsed: string;
  htfBias: 'BULLISH' | 'BEARISH' | 'RANGING';
  setupQuality: { totalScore: number; grade: string };
  savedAt: string;
  outcome: {
    status: 'OPEN' | 'WAITING_FOR_ENTRY' | 'APPROACHING_ENTRY' | 'ENTRY_REACHED' | 'TARGET_HIT' | 'STOPPED_OUT' | 'INVALIDATED' | 'EXPIRED' | 'AMBIGUOUS' | 'MONITORING_PAUSED';
    isApproachingEntry?: boolean;
    entryApproachingNotified?: boolean;
    entryTriggeredNotified?: boolean;
    invalidatedReason?: string;
    supersededBySetupId?: string;
    entryReachedAt?: string;
    completedAt?: string;
    resolvedAt?: string;
    triggerPrice?: number;
    triggerReason?: string;
    observedPrice?: number;
    timeToResolutionMinutes?: number;
    maxFavorableExcursion?: number;
    maxAdverseExcursion?: number;
    monitoringStatus?: string;
    auditTrail: AuditEntry[];
  };
}

interface SummaryStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  activeTrades?: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  totalRealizedR: number;
  avgPL: number;
  avgRR: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
}

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export function HistoryView() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Filter states
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  // Helper to compute date range from presets
  const getDateRange = useCallback((): { startDate?: string; endDate?: string } => {
    if (datePreset === 'CUSTOM') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (datePreset === 'TODAY') {
      return { startDate: todayStr, endDate: todayStr };
    }

    if (datePreset === 'YESTERDAY') {
      const yest = new Date(now.getTime() - 86400000);
      const yestStr = yest.toISOString().slice(0, 10);
      return { startDate: yestStr, endDate: yestStr };
    }

    if (datePreset === '7D') {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { startDate: start.toISOString().slice(0, 10), endDate: todayStr };
    }

    if (datePreset === '30D') {
      const start = new Date(now.getTime() - 30 * 86400000);
      return { startDate: start.toISOString().slice(0, 10), endDate: todayStr };
    }

    if (datePreset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString().slice(0, 10), endDate: todayStr };
    }

    if (datePreset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    }

    return {};
  }, [datePreset, customStartDate, customEndDate]);

  const loadAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      const result = await listAnalyses({
        direction: filterDirection !== 'ALL' ? filterDirection : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        symbol: filterSymbol !== 'ALL' ? filterSymbol : undefined,
        search: searchQuery.trim() || undefined,
        startDate,
        endDate,
        page,
        pageSize,
      });

      setAnalyses((result.data as unknown) as SavedAnalysis[]);
      setTotal(result.total);
      setTotalPages(result.totalPages || 1);
      if (result.summaryStats) {
        setSummaryStats(result.summaryStats);
      }
    } catch (err) {
      console.error('[HistoryView] Failed to load analyses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterDirection, filterStatus, filterSymbol, searchQuery, getDateRange, page, pageSize]);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  // Reset to page 1 on filter changes
  const handleFilterChange = (setter: () => void) => {
    setPage(1);
    setter();
  };

  const handleClearFilters = () => {
    setFilterDirection('ALL');
    setFilterStatus('ALL');
    setFilterSymbol('ALL');
    setSearchQuery('');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setPage(1);
  };

  // Trigger server-side background evaluation immediately
  const handleEvaluateNow = async () => {
    setIsEvaluating(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/analyses/evaluate-now`, { method: 'POST' });
      await loadAnalyses();
    } catch (err) {
      console.error('[HistoryView] Evaluate now failed:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleDelete = async (analysisId: string) => {
    if (!confirm('Delete this saved analysis record from MongoDB?')) return;
    try {
      await deleteAnalysis(analysisId);
      setAnalyses(prev => prev.filter(a => a.analysisId !== analysisId));
      setTotal(t => Math.max(0, t - 1));
    } catch (err) {
      console.error('[HistoryView] Delete failed:', err);
    }
  };

  // Download filtered CSV
  const handleDownloadCsv = () => {
    const { startDate, endDate } = getDateRange();
    const url = getExportAnalysesCsvUrl({
      direction: filterDirection !== 'ALL' ? filterDirection : undefined,
      status: filterStatus !== 'ALL' ? filterStatus : undefined,
      symbol: filterSymbol !== 'ALL' ? filterSymbol : undefined,
      search: searchQuery.trim() || undefined,
      startDate,
      endDate,
    });
    window.open(url, '_blank');
  };

  const gradeColor = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (grade === 'B') return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (grade === 'C') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
  };

  const renderStatusBadge = (outcome: SavedAnalysis['outcome']) => {
    const s = outcome?.status || 'OPEN';

    if (outcome?.isApproachingEntry || s === 'APPROACHING_ENTRY') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-950 text-amber-300 border border-amber-400/60 shadow-md shadow-amber-950/60 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
          ⚠️ APPROACHING ENTRY
        </span>
      );
    }

    switch (s) {
      case 'ENTRY_REACHED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-400/60 shadow-md shadow-emerald-950/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            ENTRY REACHED — TRADE ACTIVE
          </span>
        );
      case 'WAITING_FOR_ENTRY':
      case 'OPEN':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3 text-slate-400" />
            WAITING FOR ENTRY
          </span>
        );
      case 'TARGET_HIT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            TARGET HIT
          </span>
        );
      case 'STOPPED_OUT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" />
            STOPPED OUT
          </span>
        );
      case 'INVALIDATED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            INVALIDATED
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3 h-3 text-slate-500" />
            EXPIRED
          </span>
        );
      case 'AMBIGUOUS':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950/80 text-orange-300 border border-orange-500/40">
            <AlertCircle className="w-3 h-3 text-orange-400" />
            AMBIGUOUS
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-500/40 animate-pulse">
            <Radio className="w-3 h-3 text-blue-400" />
            MONITORING ACTIVE
          </span>
        );
    }
  };

  /**
   * Dynamically renders context-aware top metric cards based on the selected tab/filter
   */
  const renderContextAwareMetrics = () => {
    if (!summaryStats) return null;

    // 1. ENTRY_REACHED (Trade Active)
    if (filterStatus === 'ENTRY_REACHED') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div className="p-3 rounded-xl bg-gradient-to-b from-[#0c1a1f] to-[#0b101d] border border-emerald-500/50 text-center shadow-md shadow-emerald-950/40">
            <span className="text-emerald-400 text-[10px] block uppercase font-bold">Active Trades (Entry Reached)</span>
            <strong className="text-emerald-300 text-xl font-mono">
              {summaryStats.totalTrades}
            </strong>
            <span className="text-[10px] text-emerald-500/80 block">In-Trade Market Execution Active</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Average Planned R:R</span>
            <strong className="text-purple-300 text-xl font-mono">{summaryStats.avgRR}R</strong>
            <span className="text-[10px] text-slate-500 block">Active Setups Target / Risk Profile</span>
          </div>
        </div>
      );
    }

    // 2. WAITING_FOR_ENTRY (Pending Retracement)
    if (filterStatus === 'WAITING_FOR_ENTRY') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div className="p-3 rounded-xl bg-[#0b101d] border border-amber-500/40 text-center">
            <span className="text-amber-400 text-[10px] block uppercase font-bold">Waiting for Entry</span>
            <strong className="text-amber-300 text-xl font-mono">
              {summaryStats.totalTrades}
            </strong>
            <span className="text-[10px] text-slate-500 block">Pending Order Block Retracement</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Average Planned R:R</span>
            <strong className="text-purple-300 text-xl font-mono">{summaryStats.avgRR}R</strong>
            <span className="text-[10px] text-slate-500 block">Planned Target / Risk Profile</span>
          </div>
        </div>
      );
    }

    // 3. TARGET_HIT (Completed Winners)
    if (filterStatus === 'TARGET_HIT') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 rounded-xl bg-[#0b101d] border border-emerald-500/40 text-center">
            <span className="text-emerald-400 text-[10px] block uppercase font-bold">Target Hits</span>
            <strong className="text-emerald-300 text-base font-mono">
              {summaryStats.totalTrades}
            </strong>
            <span className="text-[10px] text-slate-500 block">Total Winning Trades</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Realized Gain (R)</span>
            <strong className="text-emerald-400 text-base font-mono">
              +{summaryStats.totalRealizedR}R
            </strong>
            <span className="text-[10px] text-slate-500 block">Avg +{summaryStats.avgPL}R / win</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Average Target R:R</span>
            <strong className="text-purple-300 text-base font-mono">{summaryStats.avgRR}R</strong>
            <span className="text-[10px] text-slate-500 block">Won Target / Risk Ratio</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Profit Factor</span>
            <strong className="text-blue-300 text-base font-mono">
              {summaryStats.profitFactor === 999 ? '∞' : summaryStats.profitFactor}
            </strong>
            <span className="text-[10px] text-slate-500 block">Zero Loss on Target Hits</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Largest Win</span>
            <strong className="text-emerald-400 text-base font-mono">+{summaryStats.largestWin}R</strong>
            <span className="text-[10px] text-slate-500 block">Max Single Trade Excursion</span>
          </div>
        </div>
      );
    }

    // 4. STOPPED_OUT (Completed Losses)
    if (filterStatus === 'STOPPED_OUT') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          <div className="p-3 rounded-xl bg-[#0b101d] border border-rose-500/40 text-center">
            <span className="text-rose-400 text-[10px] block uppercase font-bold">Stopped Out</span>
            <strong className="text-rose-300 text-base font-mono">
              {summaryStats.totalTrades}
            </strong>
            <span className="text-[10px] text-slate-500 block">Total Stopped Out Trades</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Realized Loss (R)</span>
            <strong className="text-rose-400 text-base font-mono">
              {summaryStats.totalRealizedR}R
            </strong>
            <span className="text-[10px] text-slate-500 block">Standard 1R Risk / Trade</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Average Planned R:R</span>
            <strong className="text-purple-300 text-base font-mono">{summaryStats.avgRR}R</strong>
            <span className="text-[10px] text-slate-500 block">Planned Target / Risk Setup</span>
          </div>
        </div>
      );
    }

    // 5. INVALIDATED (Structural Bias Voided)
    if (filterStatus === 'INVALIDATED') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div className="p-3 rounded-xl bg-[#0b101d] border border-amber-500/40 text-center">
            <span className="text-amber-400 text-[10px] block uppercase font-bold">Invalidated Analyses</span>
            <strong className="text-amber-300 text-xl font-mono">
              {summaryStats.totalTrades}
            </strong>
            <span className="text-[10px] text-slate-500 block">Structural Bias Voided (0.0R P/L)</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Average Planned R:R</span>
            <strong className="text-purple-300 text-xl font-mono">{summaryStats.avgRR}R</strong>
            <span className="text-[10px] text-slate-500 block">Pre-Invalidation R:R Plan</span>
          </div>
        </div>
      );
    }

    // 6. Default: 'ALL' Overall Dataset View
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
          <span className="text-slate-400 text-[10px] block uppercase font-bold">Total Trades</span>
          <strong className="text-white text-base font-mono">
            {summaryStats.totalTrades}
          </strong>
          <span className="text-[10px] text-slate-500 block">{summaryStats.openTrades} Open / {summaryStats.closedTrades} Closed</span>
        </div>

        <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
          <span className="text-slate-400 text-[10px] block uppercase font-bold">Win Rate</span>
          <strong className={`text-base font-mono ${summaryStats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {summaryStats.winRate}%
          </strong>
          <span className="text-[10px] text-slate-500 block">
            {summaryStats.winningTrades}W / {summaryStats.losingTrades}L
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
          <span className="text-slate-400 text-[10px] block uppercase font-bold">Realized R Multiple</span>
          <strong className={`text-base font-mono ${summaryStats.totalRealizedR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {summaryStats.totalRealizedR > 0 ? `+${summaryStats.totalRealizedR}R` : `${summaryStats.totalRealizedR}R`}
          </strong>
          <span className="text-[10px] text-slate-500 block">Avg {summaryStats.avgPL}R / closed</span>
        </div>

        <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
          <span className="text-slate-400 text-[10px] block uppercase font-bold">Average R:R</span>
          <strong className="text-purple-300 text-base font-mono">{summaryStats.avgRR}R</strong>
          <span className="text-[10px] text-slate-500 block">Target / Risk ratio</span>
        </div>

        <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
          <span className="text-slate-400 text-[10px] block uppercase font-bold">Profit Factor</span>
          <strong className="text-blue-300 text-base font-mono">
            {summaryStats.profitFactor === 999 ? '∞' : summaryStats.profitFactor}
          </strong>
          <span className="text-[10px] text-slate-500 block">Win R / Loss R</span>
        </div>

        <div className="p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-center">
          <span className="text-slate-400 text-[10px] block uppercase font-bold">Largest Win</span>
          <strong className="text-emerald-400 text-base font-mono">+{summaryStats.largestWin}R</strong>
          <span className="text-[10px] text-slate-500 block">{summaryStats.breakEvenTrades} Break-Even</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Analysis History</h1>
            {!isLoading && (
              <span className="text-xs text-slate-500 font-normal">
                ({total} verified records matching filter)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Evaluate Now */}
          <button
            onClick={handleEvaluateNow}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
            title="Trigger immediate background market data check for all OPEN & ACTIVE analyses"
          >
            <Zap className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            {isEvaluating ? 'Checking Feeds…' : 'Evaluate Open Setups'}
          </button>

          {/* Export CSV Report */}
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
            title="Download CSV report of currently filtered trades"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            onClick={loadAnalyses}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh from MongoDB"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dynamically Rendered Context-Aware Summary Metrics */}
      {renderContextAwareMetrics()}

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-xl bg-[#0b101d] border border-[#1e293b] space-y-3">
        {/* Row 1: Date Presets & Custom Range */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" /> Date Filter:
            </span>
            {[
              { key: 'ALL', label: 'All Time' },
              { key: 'TODAY', label: 'Today' },
              { key: 'YESTERDAY', label: 'Yesterday' },
              { key: '7D', label: 'Last 7 Days' },
              { key: '30D', label: 'Last 30 Days' },
              { key: 'THIS_MONTH', label: 'This Month' },
              { key: 'LAST_MONTH', label: 'Last Month' },
              { key: 'CUSTOM', label: 'Custom Range' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => handleFilterChange(() => setDatePreset(p.key as DatePreset))}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === p.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#0e1628] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Clear Filters */}
          <button
            onClick={handleClearFilters}
            className="text-xs text-slate-400 hover:text-rose-300 font-semibold px-2 py-1 rounded bg-slate-800/60 transition-colors"
          >
            Clear Filters
          </button>
        </div>

        {/* Row 2: Custom Date Pickers (if CUSTOM selected) */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0e1628] border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => handleFilterChange(() => setCustomStartDate(e.target.value))}
                className="bg-[#0b101d] border border-slate-700 text-white px-2 py-1 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => handleFilterChange(() => setCustomEndDate(e.target.value))}
                className="bg-[#0b101d] border border-slate-700 text-white px-2 py-1 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Row 3: Status, Direction, and Search Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex bg-[#0e1628] p-1 rounded-lg border border-slate-800 text-xs gap-1 flex-wrap">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'ENTRY_REACHED', label: '🟢 Entry Reached' },
                { key: 'WAITING_FOR_ENTRY', label: '⏳ Waiting Entry' },
                { key: 'TARGET_HIT', label: 'Target Hit' },
                { key: 'STOPPED_OUT', label: 'Stopped Out' },
                { key: 'INVALIDATED', label: 'Invalidated' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => handleFilterChange(() => setFilterStatus(s.key))}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filterStatus === s.key ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Direction Filter */}
            <div className="flex bg-[#0e1628] p-1 rounded-lg border border-slate-800 text-xs gap-1">
              {(['ALL', 'BULLISH', 'BEARISH'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => handleFilterChange(() => setFilterDirection(b))}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filterDirection === b
                      ? b === 'BULLISH' ? 'bg-emerald-600 text-white'
                        : b === 'BEARISH' ? 'bg-rose-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {b === 'ALL' ? 'All Sides' : b}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search symbol, ID, ruleset…"
              value={searchQuery}
              onChange={e => handleFilterChange(() => setSearchQuery(e.target.value))}
              className="w-full bg-[#0e1628] border border-slate-800 text-white text-xs pl-9 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Content Table / Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Querying verified trade journal records from MongoDB…</span>
        </div>
      ) : analyses.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-[#0b101d] border border-[#1e293b] space-y-3">
          <History className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-slate-300 font-bold text-base">No Trades Found for the Selected Period</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            Try adjusting your date range or filters to inspect earlier trades and market analysis records.
          </p>
          <button
            onClick={handleClearFilters}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all"
          >
            Clear Date Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analyses.map((analysis) => {
            const isBull = analysis.direction === 'BULLISH';
            const isExpanded = expandedAuditId === analysis.analysisId;
            const isEntryReached = analysis.outcome?.status === 'ENTRY_REACHED';
            const livePrice = analysis.outcome?.observedPrice ?? analysis.currentPrice;

            return (
              <div
                key={analysis.analysisId}
                className={`p-4 rounded-xl space-y-3 transition-all flex flex-col justify-between ${
                  isEntryReached
                    ? 'bg-gradient-to-b from-[#0c1a1f] to-[#0b101d] border-2 border-emerald-500/60 shadow-lg shadow-emerald-950/40'
                    : 'bg-[#0b101d] border border-[#1e293b] hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Status Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#17223b]">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                        isBull
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {isBull ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {analysis.direction}
                      </span>
                      <strong className="text-white text-sm">{analysis.symbol}</strong>
                      <span className="text-slate-500 text-xs">({analysis.timeframe})</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${gradeColor(analysis.setupQuality.grade)}`}>
                        Grade {analysis.setupQuality.grade}
                      </span>
                    </div>

                    {renderStatusBadge(analysis.outcome)}
                  </div>

                  {/* Price Level Matrix (Includes live updating price) */}
                  <div className="grid grid-cols-5 gap-1.5 text-center text-xs my-3">
                    <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Entry Price</span>
                      <strong className="text-blue-300 font-mono">{analysis.entryPrice}</strong>
                    </div>
                    <div className={`p-2 rounded border ${
                      isEntryReached
                        ? 'bg-emerald-950/40 border-emerald-500/40'
                        : 'bg-[#0e1628] border-slate-800'
                    }`}>
                      <span className="text-slate-400 text-[10px] block">Live Price</span>
                      <strong className={`font-mono ${isEntryReached ? 'text-emerald-300 font-bold' : 'text-slate-200'}`}>
                        {livePrice}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Stop Loss</span>
                      <strong className="text-rose-400 font-mono">{analysis.stopLossPrice}</strong>
                    </div>
                    <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Target (TP)</span>
                      <strong className="text-emerald-400 font-mono">{analysis.targetPrice}</strong>
                    </div>
                    <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">R:R Ratio</span>
                      <strong className="text-purple-300 font-mono">{analysis.riskRewardRatio}R</strong>
                    </div>
                  </div>

                  {/* Resolution & Excursions Box */}
                  <div className="p-2.5 rounded-lg bg-black/30 border border-slate-800 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Monitoring Status:</span>
                      <span className={`font-mono font-semibold ${isEntryReached ? 'text-emerald-300' : 'text-slate-200'}`}>
                        {analysis.outcome?.monitoringStatus || 'Active'}
                      </span>
                    </div>

                    {isEntryReached && analysis.outcome?.entryReachedAt && (
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-mono">
                        <span>Trade Activated:</span>
                        <span>{new Date(analysis.outcome.entryReachedAt).toUTCString().slice(17, 25)} UTC</span>
                      </div>
                    )}

                    {(analysis.outcome?.invalidatedReason || analysis.outcome?.triggerReason) && (
                      <div className="flex items-start gap-1 text-slate-300">
                        <strong className="text-slate-400 shrink-0">Resolution Fact:</strong>
                        <span className="font-semibold text-white">
                          {analysis.outcome?.invalidatedReason || analysis.outcome?.triggerReason}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-400 block">Max Favorable (MFE):</span>
                        <strong className="text-emerald-400">+{analysis.outcome?.maxFavorableExcursion ?? 0}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Max Adverse (MAE):</span>
                        <strong className="text-rose-400">-{analysis.outcome?.maxAdverseExcursion ?? 0}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Audit Trail Accordion */}
                  {isExpanded && analysis.outcome?.auditTrail && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 text-[10px] font-mono">
                      <strong className="text-slate-300 block mb-1">Server Audit Trail:</strong>
                      {analysis.outcome.auditTrail.map((entry, idx) => (
                        <div key={idx} className="p-1 rounded bg-black/40 border border-slate-800 flex items-center justify-between">
                          <span className="text-blue-300">{entry.previousStatus} → {entry.newStatus}</span>
                          <span className="text-slate-400">{new Date(entry.timestamp).toLocaleTimeString()} UTC</span>
                          <span className="text-slate-300">{entry.triggerReason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-[#17223b] text-[11px] text-slate-400">
                  <span className="font-mono text-[10px]">
                    Created: {new Date(analysis.savedAt).toLocaleDateString()} {new Date(analysis.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDetailId(analysis.analysisId)}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-950/40 border border-blue-800/40 font-semibold transition-colors text-[10px]"
                      title="View immutable structural evidence & reasoning breakdown"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      Reasoning
                    </button>

                    <button
                      onClick={() => setExpandedAuditId(isExpanded ? null : analysis.analysisId)}
                      className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 text-[10px]"
                    >
                      Audit {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleDelete(analysis.analysisId)}
                      className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b101d] border border-[#1e293b] text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{(page - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-white">{Math.min(page * pageSize, total)}</strong> of{' '}
            <strong className="text-white">{total}</strong> records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleFilterChange(() => setPage(p => Math.max(1, p - 1)))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-[#0e1628] hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pNum = i + 1;
              if (totalPages > 5 && page > 3) {
                pNum = page - 2 + i;
                if (pNum > totalPages) pNum = totalPages - 4 + i;
              }
              return (
                <button
                  key={pNum}
                  onClick={() => handleFilterChange(() => setPage(pNum))}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    page === pNum ? 'bg-blue-600 text-white' : 'bg-[#0e1628] text-slate-400 hover:text-white'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => handleFilterChange(() => setPage(p => Math.min(totalPages, p + 1)))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-[#0e1628] hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Immutable Reasoning Detail Modal */}
      {selectedDetailId && (
        <SetupDetailModal
          analysisId={selectedDetailId}
          onClose={() => setSelectedDetailId(null)}
        />
      )}
    </div>
  );
}
