'use client';

import React, { useState } from 'react';
import { EDUCATIONAL_CONCEPTS } from '@/services/educationalService';
import { EducationalConcept } from '@/types/ai';
import { 
  X, BookOpen, CheckCircle2, AlertTriangle, HelpCircle, 
  Sparkles, ShieldAlert, Binary, Search 
} from 'lucide-react';

interface EducationalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConceptId?: string;
}

export function EducationalModal({ isOpen, onClose, initialConceptId }: EducationalModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initialConceptId || 'bos');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const concept: EducationalConcept = EDUCATIONAL_CONCEPTS[selectedId] || EDUCATIONAL_CONCEPTS.bos;

  const allConcepts = Object.values(EDUCATIONAL_CONCEPTS).filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col md:flex-row w-full max-w-5xl h-[85vh] bg-[#0b101d] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Left Concept Sidebar */}
        <div className="w-full md:w-72 bg-[#090e1a] border-r border-[#1e293b] p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">SMC Knowledge Hub</h3>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search SMC concepts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0e1628] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {allConcepts.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2.5 rounded-xl transition-all ${
                  selectedId === item.id
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-[#0e1628] hover:text-white'
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
          <div className="flex items-center justify-between p-5 border-b border-[#1e293b] bg-[#0e1628] sticky top-0 z-10">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{concept.category}</span>
              <h2 className="text-xl font-black text-white">{concept.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6 text-sm leading-relaxed text-slate-300">
            {/* Summary Callout */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-200 font-medium">
              {concept.summary}
            </div>

            {/* Visual SVG Concept Diagram */}
            <div className="p-4 rounded-xl bg-[#080d18] border border-[#1e293b] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Algorithmic Structure Diagram
                </span>
                <span className="text-[10px] text-slate-500 font-mono">MODEL VISUALIZATION</span>
              </div>
              <div className="w-full h-40 bg-[#060a14] rounded-lg border border-slate-800 flex items-center justify-center p-4">
                {/* SVG Visualizations based on concept */}
                {concept.id === 'bos' && (
                  <svg width="340" height="120" viewBox="0 0 340 120" className="text-emerald-400">
                    <polyline points="20,100 80,40 140,80 220,20 280,60" fill="none" stroke="#60a5fa" strokeWidth="3" />
                    <line x1="80" y1="40" x2="260" y2="40" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
                    <circle cx="80" cy="40" r="4" fill="#60a5fa" />
                    <text x="85" y="32" fill="#60a5fa" fontSize="10" fontWeight="bold">Swing High</text>
                    <rect x="180" y="30" width="40" height="18" fill="#10b981" rx="3" />
                    <text x="188" y="43" fill="#ffffff" fontSize="10" fontWeight="bold">BOS</text>
                    <text x="230" y="16" fill="#10b981" fontSize="10" fontWeight="bold">New HH (Confirmed)</text>
                  </svg>
                )}
                {concept.id === 'choch' && (
                  <svg width="340" height="120" viewBox="0 0 340 120">
                    <polyline points="20,90 70,40 120,70 170,20 240,110" fill="none" stroke="#f43f5e" strokeWidth="3" />
                    <line x1="120" y1="70" x2="280" y2="70" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" />
                    <circle cx="120" cy="70" r="4" fill="#38bdf8" />
                    <text x="75" y="85" fill="#38bdf8" fontSize="10" fontWeight="bold">Higher Low (HL)</text>
                    <rect x="200" y="60" width="50" height="18" fill="#ef4444" rx="3" />
                    <text x="207" y="73" fill="#ffffff" fontSize="10" fontWeight="bold">CHoCH</text>
                  </svg>
                )}
                {concept.id === 'fvg' && (
                  <svg width="340" height="120" viewBox="0 0 340 120">
                    {/* Candle 1 */}
                    <rect x="60" y="70" width="20" height="30" fill="#10b981" />
                    <line x1="70" y1="55" x2="70" y2="105" stroke="#10b981" strokeWidth="2" />
                    {/* Candle 2 (Displacement) */}
                    <rect x="110" y="20" width="24" height="80" fill="#10b981" />
                    <line x1="122" y1="10" x2="122" y2="105" stroke="#10b981" strokeWidth="2" />
                    {/* Candle 3 */}
                    <rect x="160" y="10" width="20" height="30" fill="#10b981" />
                    <line x1="170" y1="5" x2="170" y2="45" stroke="#10b981" strokeWidth="2" />
                    {/* FVG Zone */}
                    <rect x="80" y="45" width="160" height="10" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeDasharray="2 2" />
                    <text x="170" y="54" fill="#34d399" fontSize="10" fontWeight="bold">Bullish FVG Imbalance</text>
                  </svg>
                )}
                {concept.id === 'orderblock' && (
                  <svg width="340" height="120" viewBox="0 0 340 120">
                    {/* Down candle before massive pump */}
                    <rect x="60" y="60" width="22" height="40" fill="#ef4444" />
                    {/* Big green expansion */}
                    <rect x="100" y="15" width="24" height="85" fill="#10b981" />
                    {/* Order block zone */}
                    <rect x="60" y="60" width="200" height="40" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth="1.5" />
                    <text x="140" y="85" fill="#c084fc" fontSize="11" fontWeight="bold">+Order Block Demand</text>
                  </svg>
                )}
                {concept.id === 'liquidity_sweep' && (
                  <svg width="340" height="120" viewBox="0 0 340 120">
                    <line x1="20" y1="40" x2="300" y2="40" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                    <text x="25" y="32" fill="#f59e0b" fontSize="10" fontWeight="bold">Equal Highs (EQH) Buy-Side Liquidity</text>
                    {/* Sweep candle */}
                    <rect x="180" y="45" width="20" height="35" fill="#ef4444" />
                    <line x1="190" y1="20" x2="190" y2="85" stroke="#ef4444" strokeWidth="2" />
                    <circle cx="190" cy="20" r="4" fill="#f59e0b" />
                    <text x="205" y="25" fill="#f87171" fontSize="10" fontWeight="bold">⚡ Wick Sweep (Stop Hunt)</text>
                  </svg>
                )}
                {concept.id !== 'bos' && concept.id !== 'choch' && concept.id !== 'fvg' && concept.id !== 'orderblock' && concept.id !== 'liquidity_sweep' && (
                  <div className="text-slate-400 text-xs font-mono">Institutional Concept Visualizer Active</div>
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
