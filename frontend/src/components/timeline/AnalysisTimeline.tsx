'use client';

import React from 'react';
import { FullSMCPipelineResult } from '@/engine';
import { Clock, Zap, Target, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

interface AnalysisTimelineProps {
  pipeline: FullSMCPipelineResult;
  onSelectConcept?: (conceptId: string) => void;
}

export function AnalysisTimeline({ pipeline, onSelectConcept }: AnalysisTimelineProps) {
  // Aggregate chronological structural events
  const events: { timestamp: number; timeStr: string; type: string; title: string; detail: string; badgeColor: string; conceptId?: string }[] = [];

  // 1. Add Liquidity events
  pipeline.liquidityPools.forEach(pool => {
    events.push({
      timestamp: pool.timestamp,
      timeStr: new Date(pool.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'LIQUIDITY',
      title: `${pool.direction === 'BUYSIDE' ? 'Buy-Side' : 'Sell-Side'} Liquidity (${pool.type})`,
      detail: `Pool identified at ${pool.price.toFixed(pipeline.instrument.assetClass === 'forex' ? 4 : 2)}`,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      conceptId: 'liquidity_sweep'
    });

    if (pool.sweepTimestamp) {
      events.push({
        timestamp: pool.sweepTimestamp,
        timeStr: new Date(pool.sweepTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'SWEEP',
        title: `Liquidity Swept (${pool.type})`,
        detail: `Wicked past ${pool.price.toFixed(pipeline.instrument.assetClass === 'forex' ? 4 : 2)} (${pool.status})`,
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        conceptId: 'liquidity_sweep'
      });
    }
  });

  // 2. Add Displacement events
  pipeline.displacements.forEach(disp => {
    events.push({
      timestamp: disp.startTimestamp,
      timeStr: new Date(disp.startTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'DISPLACEMENT',
      title: `${disp.direction} Displacement Detected`,
      detail: `Expansive move (${disp.priceChangePercent}%) exceeding ${disp.relativeVolatility}x ATR`,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      conceptId: 'mss'
    });
  });

  // 3. Add BOS / MSS breaks
  pipeline.structure.breaks.forEach(brk => {
    events.push({
      timestamp: brk.breakingTimestamp,
      timeStr: new Date(brk.breakingTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: brk.breakType,
      title: `${brk.direction} ${brk.breakType}`,
      detail: `Structure break confirmed at ${brk.breakPrice.toFixed(pipeline.instrument.assetClass === 'forex' ? 4 : 2)}`,
      badgeColor: brk.direction === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      conceptId: brk.breakType === 'MSS' ? 'mss' : brk.breakType === 'CHOCH' ? 'choch' : 'bos'
    });
  });

  // 4. Add FVG formations
  pipeline.fairValueGaps.forEach(fvg => {
    events.push({
      timestamp: fvg.timestamp,
      timeStr: new Date(fvg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'FVG',
      title: `${fvg.type} FVG Formed`,
      detail: `Imbalance range [${fvg.bottom.toFixed(pipeline.instrument.assetClass === 'forex' ? 4 : 2)} - ${fvg.top.toFixed(pipeline.instrument.assetClass === 'forex' ? 4 : 2)}]`,
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      conceptId: 'fvg'
    });
  });

  // Sort chronologically and take latest 12 events
  const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp).slice(-12);

  return (
    <div className="w-full bg-[#0b101d] rounded-xl border border-[#1e293b] p-3.5 space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-[#17223b]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="font-bold text-white text-xs tracking-wide">Analysis Timeline & Chronological Setup Progression</span>
        </div>
        <span className="text-[11px] text-slate-400">Step-by-step institutional order flow evolution</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto py-2">
        {sortedEvents.length === 0 ? (
          <div className="text-slate-500 text-xs py-2">No structural milestone events detected in current slice.</div>
        ) : (
          sortedEvents.map((ev, i) => (
            <div 
              key={i}
              onClick={() => ev.conceptId && onSelectConcept?.(ev.conceptId)}
              className="flex-shrink-0 w-52 p-2.5 rounded-lg bg-[#0e1628] border border-[#1e293b] hover:border-blue-500/50 cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-400">{ev.timeStr}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${ev.badgeColor}`}>
                  {ev.type}
                </span>
              </div>
              <strong className="text-slate-200 text-xs block truncate">{ev.title}</strong>
              <p className="text-slate-400 text-[10.5px] leading-tight line-clamp-2">{ev.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
