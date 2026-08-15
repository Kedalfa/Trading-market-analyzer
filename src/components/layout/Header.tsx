'use client';

import React from 'react';
import { Instrument, Timeframe } from '@/types/market';
import { SUPPORTED_INSTRUMENTS } from '@/engine/data/instruments';
import { STRATEGY_RULESETS } from '@/engine/rulesets/smcRulesets';
import { SessionStatus } from '@/types/session';
import { 
  Activity, Clock, Upload, PlayCircle, BookOpen, 
  TrendingUp, Shield, Cpu, HelpCircle, History 
} from 'lucide-react';

interface HeaderProps {
  selectedInstrument: Instrument;
  onSelectInstrument: (inst: Instrument) => void;
  selectedTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  selectedRuleset: string;
  onSelectRuleset: (ruleId: string) => void;
  sessionStatus?: SessionStatus;
  isReplayMode: boolean;
  onToggleReplayMode: () => void;
  onOpenVisionModal: () => void;
  onOpenEducationModal: () => void;
  onOpenRiskModal: () => void;
  activeTab: 'analyzer' | 'history' | 'journal_export' | 'learn';
  setActiveTab: (tab: 'analyzer' | 'history' | 'journal_export' | 'learn') => void;
}

const TIMEFRAMES = ['1D', '4H', '1H', '15M', '5M', '1M_MIN'];

export function Header({
  selectedInstrument,
  onSelectInstrument,
  selectedTimeframe,
  onSelectTimeframe,
  selectedRuleset,
  onSelectRuleset,
  sessionStatus,
  isReplayMode,
  onToggleReplayMode,
  onOpenVisionModal,
  onOpenEducationModal,
  onOpenRiskModal,
  activeTab,
  setActiveTab
}: HeaderProps) {
  return (
    <header className="flex flex-col border-b border-[#1e293b] bg-[#0c1222] sticky top-0 z-30">
      {/* Top Main Navigation Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#17223b]">
        {/* Brand Logo & Platform Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-tight">SMC Market Analyzer</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO TERMINAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Institutional Order Flow & AI Scenario Intelligence</p>
          </div>
        </div>

        {/* Center Primary Tab Navigation */}
        <nav className="flex items-center bg-[#080d1a] p-1 rounded-xl border border-[#1e293b]">
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'analyzer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Market Analyzer
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Analysis History
          </button>
          <button
            onClick={() => setActiveTab('learn')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'learn'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            SMC Learning Center
          </button>
        </nav>

        {/* Right Session Clock & Quick Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Real-time Session Clock Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#090f1d] border border-[#1f2d4e] text-xs">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-slate-300 font-medium">
              {sessionStatus?.currentUtcTime || 'UTC CLOCK'}
            </span>
          </div>

          {/* Screenshot Computer Vision Upload */}
          <button
            onClick={onOpenVisionModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all"
            title="Upload chart screenshot for vision analysis & conflict detection"
          >
            <Upload className="w-3.5 h-3.5" />
            Chart Vision
          </button>

          {/* Backtest / Replay Mode Toggle */}
          <button
            onClick={onToggleReplayMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isReplayMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/30'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            {isReplayMode ? 'Replay Active' : 'Bar Replay'}
          </button>

          {/* Position & Risk Calculator */}
          <button
            onClick={onOpenRiskModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all"
          >
            <Shield className="w-3.5 h-3.5" />
            Risk & Trade Idea
          </button>

          {/* Educational Concept Guide */}
          <button
            onClick={onOpenEducationModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Explain SMC Concepts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-bar: Instrument, Timeframe, Ruleset Controls */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-[#090f1d] gap-3 text-xs">
        {/* Instrument Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Instrument:</span>
          <select
            value={selectedInstrument.id}
            onChange={e => {
              const inst = SUPPORTED_INSTRUMENTS.find(i => i.id === e.target.value);
              if (inst) onSelectInstrument(inst);
            }}
            className="bg-[#0e1628] border border-[#1e293b] text-white font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {SUPPORTED_INSTRUMENTS.map(i => (
              <option key={i.id} value={i.id}>
                {i.symbol} — {i.name} ({i.assetClass.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium mr-1">Timeframe:</span>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tf === '1M_MIN' ? '1m' : tf}
            </button>
          ))}
        </div>

        {/* Strategy Ruleset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Strategy Ruleset:</span>
          <select
            value={selectedRuleset}
            onChange={e => onSelectRuleset(e.target.value)}
            className="bg-[#0e1628] border border-[#1e293b] text-blue-300 font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {Object.values(STRATEGY_RULESETS).map(rule => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
