'use client';

import React, { useState, useEffect } from 'react';
import { TradeIdea, SavedAnalysisRecord } from '@/types/trade';
import { 
  History, Target, CheckCircle2, XCircle, Clock, 
  ExternalLink, Trash2, Filter, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';

interface HistoryViewProps {
  onLoadIdea?: (idea: TradeIdea) => void;
}

export function HistoryView({ onLoadIdea }: HistoryViewProps) {
  const [ideas, setIdeas] = useState<TradeIdea[]>([]);
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('smc_trade_ideas') || '[]');
    setIdeas(stored);
  }, []);

  const handleClearHistory = () => {
    if (confirm('Clear all saved analysis records?')) {
      localStorage.removeItem('smc_trade_ideas');
      setIdeas([]);
    }
  };

  const filteredIdeas = ideas.filter(i => {
    if (filterDirection === 'ALL') return true;
    return i.direction === filterDirection;
  });

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">SMC Analysis & Trade Idea History</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track previous predictions, invalidations, risk setups, and outcomes
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Direction Filter */}
          <div className="flex bg-[#0e1628] p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterDirection('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold ${filterDirection === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              All Setups
            </button>
            <button
              onClick={() => setFilterDirection('LONG')}
              className={`px-3 py-1 rounded-lg font-semibold ${filterDirection === 'LONG' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
            >
              Longs Only
            </button>
            <button
              onClick={() => setFilterDirection('SHORT')}
              className={`px-3 py-1 rounded-lg font-semibold ${filterDirection === 'SHORT' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
            >
              Shorts Only
            </button>
          </div>

          {ideas.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear History
            </button>
          )}
        </div>
      </div>

      {/* Ideas List */}
      {filteredIdeas.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0b101d] border border-[#1e293b] space-y-3">
          <History className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-slate-300 font-bold text-base">No Saved SMC Analyses Found</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            Generate and save trade ideas from the Market Analyzer to track setup quality and verify prediction vs reality.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIdeas.map((idea) => {
            const isLong = idea.direction === 'LONG';
            return (
              <div 
                key={idea.id}
                className="p-4 rounded-xl bg-[#0b101d] border border-[#1e293b] hover:border-slate-700 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#17223b]">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                      isLong ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {isLong ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {idea.direction}
                    </span>
                    <strong className="text-white text-sm">{idea.symbol}</strong>
                    <span className="text-slate-500 text-xs">({idea.timeframe})</span>
                  </div>

                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(idea.timestamp).toLocaleDateString()} {new Date(idea.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-slate-300 text-xs font-medium">{idea.setupType}</p>

                {/* Price Matrix */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Entry</span>
                    <strong className="text-blue-300 font-mono">{idea.entryPrice}</strong>
                  </div>
                  <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Stop Loss</span>
                    <strong className="text-rose-400 font-mono">{idea.stopLossPrice}</strong>
                  </div>
                  <div className="p-2 rounded bg-[#0e1628] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Take Profit</span>
                    <strong className="text-emerald-400 font-mono">{idea.targetPrice}</strong>
                  </div>
                </div>

                {/* Structural Evidence Summary */}
                <div className="space-y-1 text-[11px]">
                  <span className="text-slate-400 font-semibold">Supporting Confluences:</span>
                  {idea.evidenceSummary.map((ev, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>

                {/* Invalidation rule */}
                {idea.invalidationConditions.length > 0 && (
                  <div className="p-2 rounded bg-amber-950/20 border border-amber-800/30 text-amber-300 text-[11px]">
                    <strong>Invalidation:</strong> {idea.invalidationConditions[0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
