'use client';

import React, { useState } from 'react';
import { EDUCATIONAL_CONCEPTS } from '@/services/educationalService';
import { EducationalConcept } from '@/types/ai';
import { 
  X, BookOpen, CheckCircle2, AlertTriangle, HelpCircle, 
  Sparkles, ShieldAlert, Binary, Search, TrendingUp, TrendingDown,
  Layers, ArrowRight, Activity
} from 'lucide-react';

interface EducationalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConceptId?: string;
}

export function EducationalModal({ isOpen, onClose, initialConceptId }: EducationalModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initialConceptId || 'bos');
  const [searchQuery, setSearchQuery] = useState('');
  const [directionMode, setDirectionMode] = useState<'BULLISH' | 'BEARISH'>('BULLISH');

  // Update selectedId if initialConceptId changes on open
  React.useEffect(() => {
    if (initialConceptId && EDUCATIONAL_CONCEPTS[initialConceptId]) {
      setSelectedId(initialConceptId);
    }
  }, [initialConceptId]);

  if (!isOpen) return null;

  const concept: EducationalConcept = EDUCATIONAL_CONCEPTS[selectedId] || EDUCATIONAL_CONCEPTS.bos;

  const allConcepts = Object.values(EDUCATIONAL_CONCEPTS).filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="flex flex-col md:flex-row w-full max-w-5xl h-[90vh] max-h-[850px] bg-[#0b101d] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Left Concept Sidebar */}
        <div className="w-full md:w-72 bg-[#090e1a] border-r border-[#1e293b] p-4 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">SMC Knowledge Hub</h3>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search concepts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0e1628] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {allConcepts.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2.5 rounded-xl transition-all ${
                  selectedId === item.id
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-[#0e1628] hover:text-white border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="text-xs font-semibold">{item.name}</div>
                <div className={`text-[10px] mt-0.5 ${selectedId === item.id ? 'text-blue-200' : 'text-slate-500'}`}>
                  {item.category}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Deep Dive Explanation View */}
        <div className="flex-1 flex flex-col bg-[#0b101d] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1e293b] bg-[#0e1628] sticky top-0 z-10">
            <div>
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">{concept.category}</span>
              <h2 className="text-lg sm:text-xl font-black text-white">{concept.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-6 text-sm leading-relaxed text-slate-300">
            {/* Summary Callout */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-200 font-medium text-xs sm:text-sm">
              {concept.summary}
            </div>

            {/* Model Visualization Card */}
            <div className="p-4 rounded-xl bg-[#080d18] border border-[#1e293b] space-y-3 shadow-inner">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Algorithmic Structure Model
                </span>

                <div className="flex items-center gap-2">
                  <div className="flex bg-[#0e1628] p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      onClick={() => setDirectionMode('BULLISH')}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 ${
                        directionMode === 'BULLISH'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" /> Bullish
                    </button>
                    <button
                      onClick={() => setDirectionMode('BEARISH')}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 ${
                        directionMode === 'BEARISH'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingDown className="w-3 h-3" /> Bearish
                    </button>
                  </div>

                  <span className="text-[10px] text-blue-400 font-mono font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                    CANONICAL SMC
                  </span>
                </div>
              </div>

              {/* Dynamic SVG Diagram Box */}
              <div className="w-full min-h-[220px] bg-[#060a14] rounded-xl border border-slate-800 flex items-center justify-center p-3 overflow-x-auto">
                {/* 1. BOS (Break of Structure) */}
                {concept.id === 'bos' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    {directionMode === 'BULLISH' ? (
                      <>
                        {/* Bullish BOS Path */}
                        <polyline points="30,150 110,70 180,120 300,40 370,90 470,20" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {/* Break Line */}
                        <line x1="110" y1="70" x2="340" y2="70" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />
                        <circle cx="110" cy="70" r="4.5" fill="#60a5fa" />
                        <text x="70" y="60" fill="#93c5fd" fontSize="11" fontWeight="bold">Swing High (1)</text>

                        {/* BOS Tag */}
                        <rect x="230" y="58" width="55" height="22" rx="4" fill="#10b981" />
                        <text x="257" y="73" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">BOS</text>

                        <circle cx="300" cy="40" r="4.5" fill="#10b981" />
                        <text x="310" y="32" fill="#34d399" fontSize="11" fontWeight="bold">New HH (Body Close)</text>
                        
                        <circle cx="180" cy="120" r="4" fill="#38bdf8" />
                        <text x="180" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">Higher Low (HL)</text>
                      </>
                    ) : (
                      <>
                        {/* Bearish BOS Path */}
                        <polyline points="30,40 110,120 180,70 300,150 370,100 470,170" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {/* Break Line */}
                        <line x1="110" y1="120" x2="340" y2="120" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
                        <circle cx="110" cy="120" r="4.5" fill="#f43f5e" />
                        <text x="70" y="140" fill="#fda4af" fontSize="11" fontWeight="bold">Swing Low (1)</text>

                        {/* BOS Tag */}
                        <rect x="230" y="110" width="55" height="22" rx="4" fill="#ef4444" />
                        <text x="257" y="125" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">BOS</text>

                        <circle cx="300" cy="150" r="4.5" fill="#ef4444" />
                        <text x="310" y="165" fill="#f87171" fontSize="11" fontWeight="bold">New LL (Body Close)</text>

                        <circle cx="180" cy="70" r="4" fill="#fb7185" />
                        <text x="180" y="55" fill="#94a3b8" fontSize="10" textAnchor="middle">Lower High (LH)</text>
                      </>
                    )}
                  </svg>
                )}

                {/* 2. CHoCH (Change of Character) */}
                {concept.id === 'choch' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    {directionMode === 'BULLISH' ? (
                      <>
                        {/* Bullish CHoCH: Downtrend transitioning to uptrend */}
                        <polyline points="30,40 90,110 150,60 220,145 320,30 380,80 470,20" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {/* Prior Lower High Level */}
                        <line x1="150" y1="60" x2="350" y2="60" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />
                        <circle cx="150" cy="60" r="4.5" fill="#fb7185" />
                        <text x="120" y="48" fill="#fda4af" fontSize="10" fontWeight="bold">Prior Lower High (LH)</text>

                        <circle cx="220" cy="145" r="4.5" fill="#f43f5e" />
                        <text x="220" y="165" fill="#94a3b8" fontSize="10" textAnchor="middle">Final Lower Low (LL)</text>

                        {/* CHoCH Tag */}
                        <rect x="250" y="48" width="60" height="22" rx="4" fill="#10b981" />
                        <text x="280" y="63" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">CHoCH</text>
                        <text x="350" y="40" fill="#34d399" fontSize="11" fontWeight="bold">First Trend Break</text>
                      </>
                    ) : (
                      <>
                        {/* Bearish CHoCH: Uptrend transitioning to downtrend */}
                        <polyline points="30,150 90,70 150,120 220,35 320,150 380,100 470,165" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {/* Prior Higher Low Level */}
                        <line x1="150" y1="120" x2="350" y2="120" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
                        <circle cx="150" cy="120" r="4.5" fill="#38bdf8" />
                        <text x="110" y="140" fill="#93c5fd" fontSize="10" fontWeight="bold">Prior Higher Low (HL)</text>

                        <circle cx="220" cy="35" r="4.5" fill="#10b981" />
                        <text x="220" y="22" fill="#94a3b8" fontSize="10" textAnchor="middle">Final Higher High (HH)</text>

                        {/* CHoCH Tag */}
                        <rect x="250" y="110" width="60" height="22" rx="4" fill="#ef4444" />
                        <text x="280" y="125" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">CHoCH</text>
                        <text x="350" y="145" fill="#f87171" fontSize="11" fontWeight="bold">First Trend Break</text>
                      </>
                    )}
                  </svg>
                )}

                {/* 3. MSS (Market Structure Shift) — Complete Structural Sequence */}
                {concept.id === 'mss' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    {directionMode === 'BULLISH' ? (
                      <>
                        {/* 1. Bearish Structure Leg */}
                        <polyline points="20,40 70,110 120,65 180,140" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="3 3" />
                        
                        {/* 2. Liquidity Sweep at Lows */}
                        <line x1="50" y1="130" x2="220" y2="130" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="30" y="125" fill="#f59e0b" fontSize="10" fontWeight="bold">Sell-Side Liquidity (SSL)</text>
                        <circle cx="180" cy="140" r="4.5" fill="#f59e0b" />
                        <text x="180" y="158" fill="#fbbf24" fontSize="10" fontWeight="bold" textAnchor="middle">⚡ SSL Swept</text>

                        {/* 3. Violent Bullish Displacement Leg */}
                        <polyline points="180,140 280,25" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
                        
                        {/* Broken Lower High Level */}
                        <line x1="120" y1="65" x2="330" y2="65" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
                        <circle cx="120" cy="65" r="4" fill="#f87171" />
                        <text x="80" y="55" fill="#fda4af" fontSize="10" fontWeight="bold">Prior Lower High</text>

                        {/* MSS Badge */}
                        <rect x="230" y="52" width="65" height="24" rx="4" fill="#10b981" stroke="#059669" strokeWidth="1" />
                        <text x="262" y="68" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">BULLISH MSS</text>

                        {/* FVG Formed in Displacement */}
                        <rect x="200" y="70" width="70" height="35" fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeDasharray="2 2" />
                        <text x="235" y="92" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">+FVG Imbalance</text>

                        {/* 4. Retracement into FVG for Entry */}
                        <polyline points="280,25 330,85 460,15" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="330" cy="85" r="4.5" fill="#38bdf8" />
                        <text x="365" y="95" fill="#38bdf8" fontSize="11" fontWeight="bold">🎯 Optimal Entry</text>
                      </>
                    ) : (
                      <>
                        {/* 1. Bullish Structure Leg */}
                        <polyline points="20,150 70,80 120,125 180,50" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3 3" />
                        
                        {/* 2. Liquidity Sweep at Highs */}
                        <line x1="50" y1="60" x2="220" y2="60" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="30" y="55" fill="#f59e0b" fontSize="10" fontWeight="bold">Buy-Side Liquidity (BSL)</text>
                        <circle cx="180" cy="50" r="4.5" fill="#f59e0b" />
                        <text x="180" y="35" fill="#fbbf24" fontSize="10" fontWeight="bold" textAnchor="middle">⚡ BSL Swept</text>

                        {/* 3. Violent Bearish Displacement Leg */}
                        <polyline points="180,50 280,165" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
                        
                        {/* Broken Higher Low Level */}
                        <line x1="120" y1="125" x2="330" y2="125" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" />
                        <circle cx="120" cy="125" r="4" fill="#34d399" />
                        <text x="80" y="140" fill="#93c5fd" fontSize="10" fontWeight="bold">Prior Higher Low</text>

                        {/* MSS Badge */}
                        <rect x="230" y="112" width="65" height="24" rx="4" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
                        <text x="262" y="128" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">BEARISH MSS</text>

                        {/* -FVG Formed in Displacement */}
                        <rect x="200" y="80" width="70" height="35" fill="rgba(239,68,68,0.25)" stroke="#ef4444" strokeDasharray="2 2" />
                        <text x="235" y="102" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">-FVG Imbalance</text>

                        {/* 4. Retracement into FVG for Entry */}
                        <polyline points="280,165 330,95 460,175" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="330" cy="95" r="4.5" fill="#f43f5e" />
                        <text x="365" y="90" fill="#f87171" fontSize="11" fontWeight="bold">🎯 Optimal Short Entry</text>
                      </>
                    )}
                  </svg>
                )}

                {/* 4. Fair Value Gap (FVG) */}
                {concept.id === 'fvg' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    {directionMode === 'BULLISH' ? (
                      <>
                        {/* Candle 1 (Bullish) */}
                        <rect x="80" y="110" width="28" height="40" fill="#10b981" rx="1" />
                        <line x1="94" y1="90" x2="94" y2="160" stroke="#10b981" strokeWidth="2" />
                        <text x="94" y="175" fill="#94a3b8" fontSize="10" textAnchor="middle">Candle 1</text>
                        <circle cx="94" cy="90" r="3" fill="#38bdf8" />
                        <text x="40" y="93" fill="#38bdf8" fontSize="10" fontWeight="bold">C1 High</text>

                        {/* Candle 2 (Displacement Large Body) */}
                        <rect x="150" y="30" width="34" height="120" fill="#10b981" rx="2" />
                        <line x1="167" y1="15" x2="167" y2="165" stroke="#10b981" strokeWidth="2.5" />
                        <text x="167" y="180" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">Displacement</text>

                        {/* Candle 3 (Bullish) */}
                        <rect x="230" y="15" width="28" height="35" fill="#10b981" rx="1" />
                        <line x1="244" y1="5" x2="244" y2="60" stroke="#10b981" strokeWidth="2" />
                        <text x="244" y="175" fill="#94a3b8" fontSize="10" textAnchor="middle">Candle 3</text>
                        <circle cx="244" cy="60" r="3" fill="#f59e0b" />
                        <text x="290" y="63" fill="#f59e0b" fontSize="10" fontWeight="bold">C3 Low</text>

                        {/* FVG Imbalance Zone between C1 High (90) and C3 Low (60) */}
                        <rect x="80" y="60" width="360" height="30" fill="rgba(16,185,129,0.22)" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
                        
                        {/* Consequent Encroachment (50% Midpoint) */}
                        <line x1="80" y1="75" x2="440" y2="75" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="360" y="72" fill="#38bdf8" fontSize="10" fontWeight="bold">CE 50% Midpoint</text>
                        <text x="360" y="86" fill="#34d399" fontSize="11" fontWeight="bold">+Bullish FVG</text>
                      </>
                    ) : (
                      <>
                        {/* Candle 1 (Bearish) */}
                        <rect x="80" y="30" width="28" height="40" fill="#ef4444" rx="1" />
                        <line x1="94" y1="15" x2="94" y2="85" stroke="#ef4444" strokeWidth="2" />
                        <text x="94" y="100" fill="#94a3b8" fontSize="10" textAnchor="middle">Candle 1</text>
                        <circle cx="94" cy="85" r="3" fill="#38bdf8" />
                        <text x="40" y="88" fill="#38bdf8" fontSize="10" fontWeight="bold">C1 Low</text>

                        {/* Candle 2 (Displacement Large Body Bearish) */}
                        <rect x="150" y="30" width="34" height="120" fill="#ef4444" rx="2" />
                        <line x1="167" y1="15" x2="167" y2="165" stroke="#ef4444" strokeWidth="2.5" />
                        <text x="167" y="180" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">Displacement</text>

                        {/* Candle 3 (Bearish) */}
                        <rect x="230" y="125" width="28" height="35" fill="#ef4444" rx="1" />
                        <line x1="244" y1="115" x2="244" y2="170" stroke="#ef4444" strokeWidth="2" />
                        <text x="244" y="185" fill="#94a3b8" fontSize="10" textAnchor="middle">Candle 3</text>
                        <circle cx="244" cy="115" r="3" fill="#f59e0b" />
                        <text x="290" y="118" fill="#f59e0b" fontSize="10" fontWeight="bold">C3 High</text>

                        {/* -FVG Imbalance Zone between C1 Low (85) and C3 High (115) */}
                        <rect x="80" y="85" width="360" height="30" fill="rgba(239,68,68,0.22)" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                        
                        {/* Consequent Encroachment (50% Midpoint) */}
                        <line x1="80" y1="100" x2="440" y2="100" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="360" y="97" fill="#38bdf8" fontSize="10" fontWeight="bold">CE 50% Midpoint</text>
                        <text x="360" y="112" fill="#f87171" fontSize="11" fontWeight="bold">-Bearish FVG</text>
                      </>
                    )}
                  </svg>
                )}

                {/* 5. Institutional Order Block (OB) */}
                {concept.id === 'orderblock' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    {directionMode === 'BULLISH' ? (
                      <>
                        {/* Origin Down Candle before rally */}
                        <rect x="70" y="85" width="28" height="50" fill="#ef4444" rx="1" />
                        <line x1="84" y1="70" x2="84" y2="150" stroke="#ef4444" strokeWidth="2" />
                        <text x="84" y="168" fill="#fda4af" fontSize="10" textAnchor="middle">Origin Down-Candle</text>

                        {/* Huge Bullish Displacement Candles */}
                        <rect x="115" y="25" width="30" height="110" fill="#10b981" rx="1" />
                        <line x1="130" y1="15" x2="130" y2="145" stroke="#10b981" strokeWidth="2" />
                        
                        <rect x="160" y="10" width="30" height="70" fill="#10b981" rx="1" />
                        <line x1="175" y1="5" x2="175" y2="90" stroke="#10b981" strokeWidth="2" />

                        {/* Order Block Demand Projection Zone */}
                        <rect x="70" y="70" width="370" height="80" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth="1.5" />
                        
                        {/* Mitigation Retracement Path */}
                        <polyline points="175,10 260,10 330,85 440,20" fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="330" cy="85" r="4.5" fill="#8b5cf6" />
                        
                        <text x="360" y="100" fill="#c084fc" fontSize="11" fontWeight="bold">+Demand Order Block</text>
                        <text x="360" y="115" fill="#a78bfa" fontSize="10">Mitigation & Institutional Retest</text>
                      </>
                    ) : (
                      <>
                        {/* Origin Up Candle before collapse */}
                        <rect x="70" y="35" width="28" height="50" fill="#10b981" rx="1" />
                        <line x1="84" y1="20" x2="84" y2="100" stroke="#10b981" strokeWidth="2" />
                        <text x="84" y="15" fill="#86efac" fontSize="10" textAnchor="middle">Origin Up-Candle</text>

                        {/* Huge Bearish Displacement Candles */}
                        <rect x="115" y="45" width="30" height="110" fill="#ef4444" rx="1" />
                        <line x1="130" y1="35" x2="130" y2="165" stroke="#ef4444" strokeWidth="2" />
                        
                        <rect x="160" y="90" width="30" height="70" fill="#ef4444" rx="1" />
                        <line x1="175" y1="80" x2="175" y2="170" stroke="#ef4444" strokeWidth="2" />

                        {/* Order Block Supply Projection Zone */}
                        <rect x="70" y="20" width="370" height="80" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" />
                        
                        {/* Mitigation Retracement Path */}
                        <polyline points="175,160 260,160 330,85 440,160" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="330" cy="85" r="4.5" fill="#ef4444" />
                        
                        <text x="360" y="45" fill="#f87171" fontSize="11" fontWeight="bold">-Supply Order Block</text>
                        <text x="360" y="60" fill="#fca5a5" fontSize="10">Mitigation & Institutional Retest</text>
                      </>
                    )}
                  </svg>
                )}

                {/* 6. Liquidity Sweep (Stop Grab) */}
                {concept.id === 'liquidity_sweep' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    {directionMode === 'BULLISH' ? (
                      <>
                        {/* Sell-side liquidity pool line at bottom */}
                        <line x1="30" y1="130" x2="450" y2="130" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="40" y="122" fill="#f59e0b" fontSize="10" fontWeight="bold">Sell-Side Liquidity Pool (Equal Lows / Stops)</text>
                        
                        {/* Swing path forming equal lows */}
                        <polyline points="50,70 110,130 160,85 220,130 260,95" fill="none" stroke="#64748b" strokeWidth="2" />
                        
                        {/* The Sweep Candle Piercing Through then Closing Back Above */}
                        <rect x="300" y="85" width="26" height="40" fill="#10b981" rx="1" />
                        <line x1="313" y1="70" x2="313" y2="165" stroke="#10b981" strokeWidth="2" />
                        
                        <circle cx="313" cy="165" r="5" fill="#ef4444" />
                        <text x="313" y="180" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">Wick Grab</text>

                        {/* Reversal Arrow */}
                        <path d="M 335,100 Q 380,40 440,30" fill="none" stroke="#10b981" strokeWidth="3" markerEnd="url(#arrow)" />
                        <text x="360" y="65" fill="#34d399" fontSize="11" fontWeight="bold">⚡ Violent Liquidity Reversal</text>
                      </>
                    ) : (
                      <>
                        {/* Buy-side liquidity pool line at top */}
                        <line x1="30" y1="55" x2="450" y2="55" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="40" y="45" fill="#f59e0b" fontSize="10" fontWeight="bold">Buy-Side Liquidity Pool (Equal Highs / Buy Stops)</text>
                        
                        {/* Swing path forming equal highs */}
                        <polyline points="50,120 110,55 160,105 220,55 260,90" fill="none" stroke="#64748b" strokeWidth="2" />
                        
                        {/* The Sweep Candle Piercing Through then Closing Back Below */}
                        <rect x="300" y="65" width="26" height="40" fill="#ef4444" rx="1" />
                        <line x1="313" y1="20" x2="313" y2="120" stroke="#ef4444" strokeWidth="2" />
                        
                        <circle cx="313" cy="20" r="5" fill="#ef4444" />
                        <text x="313" y="12" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">Wick Grab</text>

                        {/* Reversal Arrow */}
                        <path d="M 335,90 Q 380,140 440,160" fill="none" stroke="#ef4444" strokeWidth="3" />
                        <text x="360" y="135" fill="#f87171" fontSize="11" fontWeight="bold">⚡ Violent Liquidity Reversal</text>
                      </>
                    )}
                  </svg>
                )}

                {/* 7. Premium / Discount & Dealing Range */}
                {concept.id === 'premium_discount' && (
                  <svg width="500" height="190" viewBox="0 0 500 190" className="w-full max-w-[500px] select-none">
                    <defs>
                      <linearGradient id="premModalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="discModalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
                      </linearGradient>
                    </defs>

                    {/* 100% Range High */}
                    <line x1="40" y1="25" x2="460" y2="25" stroke="#ef4444" strokeWidth="2" />
                    <text x="45" y="18" fill="#f87171" fontSize="10" fontWeight="bold">100% — Swing High (Range High)</text>

                    {/* Premium Zone Box (50% - 100%) */}
                    <rect x="40" y="25" width="420" height="65" fill="url(#premModalGrad)" stroke="#ef4444" strokeDasharray="2 2" strokeWidth="0.8" />
                    <text x="60" y="55" fill="#fca5a5" fontSize="12" fontWeight="bold">PREMIUM ZONE (Sell Side Bias / Expensive)</text>
                    <text x="60" y="70" fill="#94a3b8" fontSize="10">High Probability Zone for Shorting & Taking Profit</text>

                    {/* 50% Equilibrium Line */}
                    <line x1="30" y1="90" x2="470" y2="90" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
                    <text x="370" y="85" fill="#38bdf8" fontSize="11" fontWeight="bold">50% EQUILIBRIUM</text>

                    {/* Discount Zone Box (0% - 50%) */}
                    <rect x="40" y="90" width="420" height="65" fill="url(#discModalGrad)" stroke="#10b981" strokeDasharray="2 2" strokeWidth="0.8" />
                    <text x="60" y="125" fill="#86efac" fontSize="12" fontWeight="bold">DISCOUNT ZONE (Buy Side Bias / Wholesale)</text>
                    <text x="60" y="140" fill="#94a3b8" fontSize="10">High Probability Zone for Long Entries & Accumulation</text>

                    {/* 0% Range Low */}
                    <line x1="40" y1="155" x2="460" y2="155" stroke="#10b981" strokeWidth="2" />
                    <text x="45" y="172" fill="#34d399" fontSize="10" fontWeight="bold">0% — Swing Low (Range Low)</text>

                    {/* OTE Golden Pocket Zone */}
                    <rect x="360" y="105" width="90" height="35" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth="1" rx="2" />
                    <text x="405" y="120" fill="#fbbf24" fontSize="9" fontWeight="bold" textAnchor="middle">OTE Golden Zone</text>
                    <text x="405" y="132" fill="#fde68a" fontSize="8" textAnchor="middle">61.8% – 78.6%</text>
                  </svg>
                )}
              </div>

              {/* Step Sequence Breakdown */}
              <div className="p-3 rounded-lg bg-[#0e1628] border border-slate-800 text-xs">
                <span className="text-slate-400 font-bold block mb-1.5 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-blue-400" /> Structural Sequence Checklist:
                </span>
                {concept.id === 'mss' && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-rose-400 block">1. Prior Trend</strong>
                      <span className="text-slate-400">Clear swing sequence</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-amber-400 block">2. Liquidity Sweep</strong>
                      <span className="text-slate-400">Stop run on key pool</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">3. Displacement</strong>
                      <span className="text-slate-400">Energy & +FVG created</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-blue-400 block">4. Shift Confirmed</strong>
                      <span className="text-slate-400">Body close past LH/HL</span>
                    </div>
                  </div>
                )}
                {concept.id === 'premium_discount' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-rose-400 block">Premium (&gt;50%)</strong>
                      <span className="text-slate-400">Short entries & profit targets</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-blue-400 block">Equilibrium (50%)</strong>
                      <span className="text-slate-400">Fair value midpoint anchor</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">Discount (&lt;50%)</strong>
                      <span className="text-slate-400">Long entries & accumulation</span>
                    </div>
                  </div>
                )}
                {concept.id === 'bos' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-blue-400 block">1. Confirmed Pivot</strong>
                      <span className="text-slate-400">Established Swing High/Low</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">2. Trend Expansion</strong>
                      <span className="text-slate-400">Push in dominant trend</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-purple-400 block">3. Body Close</strong>
                      <span className="text-slate-400">Confirmed new extreme</span>
                    </div>
                  </div>
                )}
                {concept.id === 'choch' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-rose-400 block">1. Maturing Trend</strong>
                      <span className="text-slate-400">Extended HH/HL or LH/LL</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-amber-400 block">2. Counter Break</strong>
                      <span className="text-slate-400">First break of last HL/LH</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">3. Order Flow Shift</strong>
                      <span className="text-slate-400">Reversal alert initiated</span>
                    </div>
                  </div>
                )}
                {concept.id === 'fvg' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-blue-400 block">1. Candle 1 Wick</strong>
                      <span className="text-slate-400">Starting boundary anchor</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">2. Candle 2 Surge</strong>
                      <span className="text-slate-400">Aggressive displacement</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-amber-400 block">3. Candle 3 Gap</strong>
                      <span className="text-slate-400">Unbalanced void created</span>
                    </div>
                  </div>
                )}
                {concept.id === 'orderblock' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-purple-400 block">1. Origin Candle</strong>
                      <span className="text-slate-400">Last opposing position</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">2. Displacement Break</strong>
                      <span className="text-slate-400">BOS or MSS created</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-blue-400 block">3. Unmitigated Retest</strong>
                      <span className="text-slate-400">Institutional defense entry</span>
                    </div>
                  </div>
                )}
                {concept.id === 'liquidity_sweep' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-amber-400 block">1. Equal Highs/Lows</strong>
                      <span className="text-slate-400">Obvious retail stop clusters</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-rose-400 block">2. Wick Penetration</strong>
                      <span className="text-slate-400">Stop loss liquidity triggered</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <strong className="text-emerald-400 block">3. Reclaim & Reverse</strong>
                      <span className="text-slate-400">Fast close back in range</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Explanation */}
            <div>
              <h4 className="font-bold text-white text-sm mb-2">Institutional Mechanics</h4>
              <p className="text-slate-300">{concept.detailedExplanation}</p>
            </div>

            {/* Mathematical / Algorithmic Formula */}
            <div className="p-3.5 rounded-xl bg-[#090f1d] border border-[#1f2d4e] space-y-1">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Binary className="w-3.5 h-3.5 text-blue-400" /> Algorithmic Detection Rule:
              </span>
              <p className="font-mono text-xs text-blue-300">{concept.detectionFormula}</p>
            </div>

            {/* Trading & Execution Rules */}
            <div>
              <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Key Trading Rules
              </h4>
              <div className="space-y-1.5">
                {concept.tradingRules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#0e1628] border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-slate-300 text-xs">{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invalidation Rules & Traps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Invalidation Conditions
                </div>
                {concept.invalidationRules.map((inv, i) => (
                  <p key={i} className="text-slate-300 text-xs pl-2">• {inv}</p>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Common Retail Pitfalls
                </div>
                {concept.commonMistakes.map((mistake, i) => (
                  <p key={i} className="text-slate-300 text-xs pl-2">• {mistake}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
