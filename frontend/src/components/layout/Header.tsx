'use client';

import React, { useState, useEffect } from 'react';
import { Instrument } from '@/types/market';
import { STRATEGY_RULESETS } from '@/engine/rulesets/smcRulesets';
import { SessionStatus } from '@/types/session';
import {
  Activity, Clock, Upload, BookOpen,
  Cpu, History, Send
} from 'lucide-react';

interface HeaderProps {
  instruments: Instrument[];           // loaded dynamically from backend
  selectedInstrument: Instrument;
  onSelectInstrument: (inst: Instrument) => void;
  selectedTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  selectedRuleset: string;
  onSelectRuleset: (ruleId: string) => void;
  sessionStatus?: SessionStatus;
  onOpenVisionModal: () => void;
  onOpenTelegramModal: () => void;
  activeTab: 'analyzer' | 'history' | 'journal_export' | 'learn';
  setActiveTab: (tab: 'analyzer' | 'history' | 'journal_export' | 'learn') => void;
}

const TIMEFRAMES = ['1D', '4H', '1H', '15M', '5M', '1M_MIN'];

export function Header({
  instruments,
  selectedInstrument,
  onSelectInstrument,
  selectedTimeframe,
  onSelectTimeframe,
  selectedRuleset,
  onSelectRuleset,
  sessionStatus,
  onOpenVisionModal,
  onOpenTelegramModal,
  activeTab,
  setActiveTab
}: HeaderProps) {
  // Real-time continuous timestamp clock (no drift, updates every 1000ms)
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [activeSessionName, setActiveSessionName] = useState<string>('Live Session');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const utcSeconds = now.getUTCSeconds();

      // Format UTC time: HH:mm:ss UTC
      const formatted = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')} UTC`;
      setCurrentTimeStr(formatted);

      // Determine active trading session dynamically
      if (utcHours >= 13 && (utcHours < 16 || (utcHours === 16 && utcMinutes <= 30))) {
        setActiveSessionName('London / NY Overlap');
      } else if (utcHours >= 8 && utcHours < 17) {
        setActiveSessionName('London Session');
      } else if (utcHours >= 13 && utcHours < 22) {
        setActiveSessionName('New York Session');
      } else if (utcHours >= 0 && utcHours < 9) {
        setActiveSessionName('Asian / Tokyo');
      } else {
        setActiveSessionName('After-Hours / Sydney');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex flex-col border-b border-[#1e293b] bg-[#0c1222] sticky top-0 z-30">
      {/* Top Main Navigation Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#17223b]">
        {/* Brand Logo & Clean Platform Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight leading-tight">
              SMC Market Analyzer
            </h1>
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

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Real-time Timestamp Clock & Active Session */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#090f1d] border border-[#1f2d4e] text-xs">
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="font-mono text-slate-200 font-semibold">
              {currentTimeStr || sessionStatus?.currentUtcTime || 'UTC CLOCK'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50 font-medium">
              {activeSessionName}
            </span>
          </div>

          {/* Chart Vision Upload */}
          <button
            onClick={onOpenVisionModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all shadow-sm"
            title="Upload chart screenshot for vision analysis & conflict detection"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chart Vision</span>
          </button>

          {/* Telegram AI Alerts Button */}
          <button
            onClick={onOpenTelegramModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition-all shadow-sm"
            title="Configure Telegram AI Alerts & Watchlist"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>Telegram Bot</span>
          </button>
        </div>
      </div>

      {/* Sub-bar: Instrument, Timeframe, Ruleset Controls */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-[#090f1d] gap-3 text-xs">
        {/* Instrument Selector — dynamically loaded from MongoDB */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Instrument:</span>
          <select
            value={selectedInstrument.id}
            onChange={e => {
              const inst = instruments.find(i => i.id === e.target.value);
              if (inst) onSelectInstrument(inst);
            }}
            className="bg-[#0e1628] border border-[#1e293b] text-white font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {instruments.map(i => (
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
