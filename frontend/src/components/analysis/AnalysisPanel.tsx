'use client';

import React, { useState } from 'react';
import { StructuredSMCAnalysis, TradingScenario } from '@/types/ai';
import { Instrument } from '@/types/market';
import { 
  TrendingUp, TrendingDown, AlertCircle, ShieldAlert, CheckCircle2, 
  Target, Crosshair, Award, ArrowUpRight, ArrowDownRight, Compass,
  Layers, ExternalLink, BookmarkPlus
} from 'lucide-react';

interface AnalysisPanelProps {
  analysis: StructuredSMCAnalysis;
  instrument: Instrument;
  onCreateTradeIdea: (direction: 'LONG' | 'SHORT') => void;
  onSaveAnalysis: () => void;
  onSelectConcept: (conceptId: string) => void;
}

export function AnalysisPanel({
  analysis,
  instrument,
  onCreateTradeIdea,
  onSaveAnalysis,
  onSelectConcept
}: AnalysisPanelProps) {
  const [selectedScenarioTab, setSelectedScenarioTab] = useState<'bullish' | 'bearish'>('bullish');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeScenario = selectedScenarioTab === 'bullish' ? analysis.scenarios.bullish : analysis.scenarios.bearish;
  const isBullBias = analysis.marketOverview.htfBias === 'BULLISH';

  const handleSave = () => {
    onSaveAnalysis();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Instrument-aware price decimal places: JPY = 3, standard forex = 5, non-forex = 2
  const priceDp = instrument.assetClass !== 'forex' ? 2
    : ((instrument.symbol || instrument.id || '').toUpperCase().includes('JPY') ? 3 : 5);

  return (
    <div className="flex flex-col h-full w-full bg-[#0b101d] rounded-xl border border-[#1e293b] overflow-y-auto">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#1e293b] bg-[#0e1628] flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-400" />
          <h2 className="font-bold text-white text-sm tracking-wide">AI Structural Intelligence</h2>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
            savedSuccess 
              ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          {savedSuccess ? 'Saved!' : 'Save Analysis'}
        </button>
      </div>

      <div className="p-4 space-y-4 text-xs">
        {/* 1. Setup Quality Score Box */}
        <div className="p-3.5 rounded-xl bg-[#090f1d] border border-[#1f2d4e]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-200">Setup Quality Score</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md font-extrabold text-xs ${
                analysis.setupQuality.grade === 'A+' || analysis.setupQuality.grade === 'A'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : analysis.setupQuality.grade === 'B'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                Grade {analysis.setupQuality.grade} ({analysis.setupQuality.totalScore}/100)
              </span>
            </div>
          </div>

          {/* Component Score Progress Bars */}
          <div className="space-y-2 mt-3">
            {analysis.setupQuality.components.map((comp, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{comp.category}</span>
                  <span className={comp.isPositive ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                    {comp.score}/{comp.maxScore}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${comp.isPositive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${(comp.score / comp.maxScore) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Market Overview Card */}
        <div className="p-3.5 rounded-xl bg-[#090f1d] border border-[#1f2d4e] space-y-2">
          <span className="font-bold text-slate-300 block">Market Overview</span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-[#0e1628] border border-slate-800">
              <span className="text-slate-400 block">HTF Macro Bias:</span>
              <strong className={isBullBias ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {analysis.marketOverview.htfBias}
              </strong>
            </div>
            <div className="p-2 rounded-lg bg-[#0e1628] border border-slate-800">
              <span className="text-slate-400 block">Local Structure:</span>
              <strong className="text-blue-400 font-bold">
                {analysis.marketOverview.intermediateStructure}
              </strong>
            </div>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11.5px]">
            {analysis.marketOverview.summary}
          </p>
        </div>

        {/* 3. Probabilistic Scenario Selector & Details */}
        <div className="p-3.5 rounded-xl bg-[#090f1d] border border-[#1f2d4e] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200">Probabilistic Scenarios</span>
            <div className="flex bg-[#0e1628] p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setSelectedScenarioTab('bullish')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  selectedScenarioTab === 'bullish'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bullish
              </button>
              <button
                onClick={() => setSelectedScenarioTab('bearish')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  selectedScenarioTab === 'bearish'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bearish
              </button>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${
            selectedScenarioTab === 'bullish' 
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' 
              : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <strong className="text-white text-xs font-bold">{activeScenario.title}</strong>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-current font-semibold">
                {activeScenario.probabilityGrade.replace('_', ' ')}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-normal mb-2.5">
              {activeScenario.narrative}
            </p>

            {/* Conditions Required */}
            <div className="space-y-1 mt-2">
              <span className="font-semibold text-[11px] text-slate-300 block">Required Conditions:</span>
              {activeScenario.conditionsRequired.map((cond, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{cond}</span>
                </div>
              ))}
            </div>

            {/* Invalidation Trigger */}
            <div className="mt-3 p-2 rounded bg-black/40 border border-amber-500/30 text-amber-300 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Invalidation Trigger:</span>
              </div>
              <p className="text-slate-300">{activeScenario.invalidationTrigger}</p>
            </div>

            {/* Key Targets */}
            <div className="mt-3 space-y-1">
              <span className="font-semibold text-[11px] text-slate-300 block">Potential Targets:</span>
              {activeScenario.potentialTargets.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800 text-[11px]">
                  <span className="text-slate-400">{t.label}</span>
                  <span className="font-mono font-bold text-white">
                    {t.price.toFixed(priceDp)}
                  </span>
                </div>
              ))}
            </div>

            {/* Create Trade Idea Button */}
            <button
              onClick={() => onCreateTradeIdea(selectedScenarioTab === 'bullish' ? 'LONG' : 'SHORT')}
              className={`w-full mt-3 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all ${
                selectedScenarioTab === 'bullish'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Generate {selectedScenarioTab === 'bullish' ? 'Long' : 'Short'} Trade Idea & Position Sizing
            </button>
          </div>
        </div>

        {/* 4. Conflicting Signals Alert if any */}
        {analysis.structuralEvidence.conflictingSignals.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-700/50 text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Conflicting Signals Detected</span>
            </div>
            {analysis.structuralEvidence.conflictingSignals.map((conf, i) => (
              <p key={i} className="text-slate-300 text-[11px] pl-5">• {conf}</p>
            ))}
          </div>
        )}

        {/* 5. Nearest Liquidity Targets */}
        <div className="p-3.5 rounded-xl bg-[#090f1d] border border-[#1f2d4e] space-y-2">
          <span className="font-bold text-slate-300 block">Liquidity Map</span>
          <div className="space-y-1.5 text-[11px]">
            {analysis.liquidityMap.nearestBuyside && (
              <div className="flex items-center justify-between p-2 rounded bg-[#0e1628] border border-blue-900/40">
                <span className="text-blue-300 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Nearest Buy-Side (BSL)
                </span>
                <span className="font-mono font-bold text-white">
                  {analysis.liquidityMap.nearestBuyside.price.toFixed(priceDp)}
                </span>
              </div>
            )}

            {analysis.liquidityMap.nearestSellside && (
              <div className="flex items-center justify-between p-2 rounded bg-[#0e1628] border border-rose-900/40">
                <span className="text-rose-300 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Nearest Sell-Side (SSL)
                </span>
                <span className="font-mono font-bold text-white">
                  {analysis.liquidityMap.nearestSellside.price.toFixed(priceDp)}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {analysis.liquidityMap.nextTargetSummary}
          </p>
        </div>
      </div>
    </div>
  );
}
