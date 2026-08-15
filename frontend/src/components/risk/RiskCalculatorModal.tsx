'use client';

import React, { useState, useEffect } from 'react';
import { Instrument } from '@/types/market';
import { StructuredSMCAnalysis } from '@/types/ai';
import { calculatePositionSize, createTradeIdeaFromAnalysis } from '@/services/riskService';
import { saveTradeIdea, updateRiskSettings, type RiskSettings } from '@/services/api';
import { RiskSettings as TradeRiskSettings, TradeIdea } from '@/types/trade';
import {
  X, Shield, Calculator, CheckCircle2, AlertTriangle,
  Copy, Send, Save
} from 'lucide-react';

interface RiskCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: Instrument;
  analysis: StructuredSMCAnalysis;
  initialDirection?: 'LONG' | 'SHORT';
  riskSettings?: RiskSettings;   // loaded from MongoDB
}

const DEFAULT_RISK: TradeRiskSettings = {
  accountBalance: 10000,
  maxRiskPerTradePercent: 1.0,
  maxDailyLossPercent: 3.0,
  maxDrawdownPercent: 5.0,
  minRiskRewardRatio: 2.0,
};

export function RiskCalculatorModal({
  isOpen,
  onClose,
  instrument,
  analysis,
  initialDirection = 'LONG',
  riskSettings,
}: RiskCalculatorModalProps) {
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>(initialDirection);

  // Initialise from MongoDB settings, or sensible default
  const [settings, setSettings] = useState<TradeRiskSettings>(
    riskSettings ? { ...DEFAULT_RISK, ...riskSettings } : DEFAULT_RISK
  );

  // Sync if parent updates the settings prop (e.g. after backend loads)
  useEffect(() => {
    if (riskSettings) {
      setSettings(prev => ({ ...prev, ...riskSettings }));
    }
  }, [riskSettings]);

  const activeScenario = direction === 'LONG' ? analysis.scenarios.bullish : analysis.scenarios.bearish;
  const [entryPrice, setEntryPrice] = useState<number>(
    direction === 'LONG' ? activeScenario.idealEntryZone.topPrice : activeScenario.idealEntryZone.bottomPrice
  );
  const [stopLossPrice, setStopLossPrice] = useState<number>(activeScenario.invalidationPrice);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(
    activeScenario.potentialTargets[1]?.price || activeScenario.potentialTargets[0]?.price || analysis.currentPrice * 1.02
  );

  const [copied, setCopied] = useState(false);
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const sc = direction === 'LONG' ? analysis.scenarios.bullish : analysis.scenarios.bearish;
    setEntryPrice(direction === 'LONG' ? sc.idealEntryZone.topPrice : sc.idealEntryZone.bottomPrice);
    setStopLossPrice(sc.invalidationPrice);
    setTakeProfitPrice(
      sc.potentialTargets[1]?.price || sc.potentialTargets[0]?.price || analysis.currentPrice * (direction === 'LONG' ? 1.02 : 0.98)
    );
  }, [direction, analysis]);

  if (!isOpen) return null;

  const calculation = calculatePositionSize(instrument, entryPrice, stopLossPrice, takeProfitPrice, settings);
  const tradeIdea = createTradeIdeaFromAnalysis(analysis, direction, instrument, settings);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(tradeIdea, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Save trade idea to MongoDB via backend API */
  const handleSaveToJournal = async () => {
    setSavedStatus('saving');
    try {
      await saveTradeIdea({
        ideaId: tradeIdea.id,
        analysisId: tradeIdea.analysisId,
        symbol: tradeIdea.symbol,
        instrumentId: instrument.id,
        direction: tradeIdea.direction,
        setupType: tradeIdea.setupType,
        timeframe: tradeIdea.timeframe,
        entryPrice: tradeIdea.entryPrice,
        stopLossPrice: tradeIdea.stopLossPrice,
        targetPrice: tradeIdea.targetPrice,
        riskRewardRatio: tradeIdea.riskRewardRatio,
        positionCalculation: tradeIdea.positionCalculation,
        evidenceSummary: tradeIdea.evidenceSummary,
        invalidationConditions: tradeIdea.invalidationConditions,
        newsRestrictions: tradeIdea.newsRestrictions,
        status: 'PENDING',
      });

      // Persist updated risk settings to MongoDB
      await updateRiskSettings({
        accountBalance: settings.accountBalance,
        maxRiskPerTradePercent: settings.maxRiskPerTradePercent,
        maxDailyLossPercent: settings.maxDailyLossPercent,
        maxDrawdownPercent: settings.maxDrawdownPercent,
        minRiskRewardRatio: settings.minRiskRewardRatio,
      });

      setSavedStatus('saved');
      setTimeout(() => setSavedStatus('idle'), 3000);
    } catch (err) {
      console.error('[RiskModal] Save failed:', err);
      setSavedStatus('error');
      setTimeout(() => setSavedStatus('idle'), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-[#0b101d] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e293b] bg-[#0e1628]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Risk Calculator & Trade Idea Hub</h2>
              <p className="text-xs text-slate-400">Position sizing — settings auto-saved to MongoDB</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Direction Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#090e1a] border border-[#1e293b]">
            <span className="font-bold text-slate-200">Trade Direction:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection('LONG')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                  direction === 'LONG'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                LONG (Bullish)
              </button>
              <button
                onClick={() => setDirection('SHORT')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                  direction === 'SHORT'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                SHORT (Bearish)
              </button>
            </div>
          </div>

          {/* Risk Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">Account Balance ($):</label>
              <input
                type="number"
                value={settings.accountBalance}
                onChange={e => setSettings({ ...settings, accountBalance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1628] border border-[#1e293b] text-white font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">Risk Per Trade (%):</label>
              <input
                type="number"
                step="0.1"
                value={settings.maxRiskPerTradePercent}
                onChange={e => setSettings({ ...settings, maxRiskPerTradePercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1628] border border-[#1e293b] text-white font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">Min Target R:R:</label>
              <input
                type="number"
                step="0.5"
                value={settings.minRiskRewardRatio}
                onChange={e => setSettings({ ...settings, minRiskRewardRatio: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1628] border border-[#1e293b] text-white font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Price Levels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-blue-400 font-semibold">Entry Price:</label>
              <input
                type="number"
                step={instrument.assetClass === 'forex' ? '0.0001' : '0.1'}
                value={entryPrice}
                onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1628] border border-blue-500/40 text-blue-300 font-mono font-bold focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-rose-400 font-semibold">Stop Loss (Invalidation):</label>
              <input
                type="number"
                step={instrument.assetClass === 'forex' ? '0.0001' : '0.1'}
                value={stopLossPrice}
                onChange={e => setStopLossPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1628] border border-rose-500/40 text-rose-300 font-mono font-bold focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-emerald-400 font-semibold">Take Profit (Target):</label>
              <input
                type="number"
                step={instrument.assetClass === 'forex' ? '0.0001' : '0.1'}
                value={takeProfitPrice}
                onChange={e => setTakeProfitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#0e1628] border border-emerald-500/40 text-emerald-300 font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Calculated Output Matrix */}
          <div className="p-4 rounded-xl bg-[#090e1a] border border-[#1f2d4e] space-y-3">
            <span className="font-bold text-white text-xs block">Execution Sizing & Risk Matrix</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-lg bg-[#0e1628] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Monetary Risk</span>
                <strong className="text-rose-400 font-mono text-sm">${calculation.riskAmountDollars}</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#0e1628] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Potential Profit</span>
                <strong className="text-emerald-400 font-mono text-sm">${calculation.potentialRewardDollars}</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#0e1628] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Risk / Reward</span>
                <strong className={`font-mono text-sm ${calculation.riskRewardRatio >= settings.minRiskRewardRatio ? 'text-emerald-400' : 'text-amber-400'}`}>
                  1 : {calculation.riskRewardRatio}R
                </strong>
              </div>
              <div className="p-3 rounded-lg bg-[#0e1628] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">
                  {instrument.assetClass === 'forex' ? 'Position (Lots)' : 'Units'}
                </span>
                <strong className="text-white font-mono text-sm">
                  {instrument.assetClass === 'forex' ? calculation.lotSize : calculation.units}
                </strong>
              </div>
            </div>

            {calculation.riskWarnings.map((w, idx) => (
              <div key={idx} className="flex items-center gap-2 text-amber-300 text-[11px] p-2 rounded bg-amber-950/20 border border-amber-800/40">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Trade Idea JSON'}
            </button>

            <button
              onClick={handleSaveToJournal}
              disabled={savedStatus === 'saving'}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all ${
                savedStatus === 'saved'
                  ? 'bg-emerald-700 text-white shadow-emerald-600/30'
                  : savedStatus === 'error'
                  ? 'bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {savedStatus === 'saving' ? 'Saving to MongoDB…'
                : savedStatus === 'saved' ? 'Saved to MongoDB!'
                : savedStatus === 'error' ? 'Save Failed — Check Backend'
                : 'Save Trade Idea to MongoDB'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
