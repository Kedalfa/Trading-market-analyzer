'use client';

import React, { useState } from 'react';
import { FullSMCPipelineResult } from '@/engine';
import { analyzeChartScreenshot, VisionAnalysisMode } from '@/services/visionService';
import {
  VisionAnalysisResult,
  VisionAnnotationItem,
  VisionSetup,
  AnnotationType
} from '@/types/vision';
import {
  X, Upload, RefreshCw, Eye, Layers, CheckCircle2,
  AlertTriangle, Shield, TrendingUp, Target, ArrowRight,
  Info, Sparkles, Sliders, CheckSquare, Square, Zap
} from 'lucide-react';

interface VisionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipeline?: FullSMCPipelineResult | null;
}

export function VisionComparisonModal({ isOpen, onClose, pipeline }: VisionComparisonModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysisResult | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<VisionAnnotationItem | null>(null);

  // Layer Visibility Filters
  const [visibleLayers, setVisibleLayers] = useState({
    structure: true,
    liquidity: true,
    fvg: true,
    orderBlocks: true,
    dealingRange: true,
    setup: true,
  });

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        runAnalysis(base64, 'FULL');
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async (base64: string, mode: VisionAnalysisMode = 'FULL') => {
    setIsAnalyzing(true);
    setSelectedAnnotation(null);
    try {
      const result = await analyzeChartScreenshot(base64, pipeline, mode);
      setAnalysisResult(result);
      if (result.annotations.length > 0) {
        setSelectedAnnotation(result.annotations[0]);
      }
    } catch (err) {
      console.error('[VisionModal] Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleLayer = (layerKey: keyof typeof visibleLayers) => {
    setVisibleLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Filter annotations based on active layer toggles
  const filteredAnnotations = analysisResult?.annotations.filter(ann => {
    if (ann.category === 'Structure' && !visibleLayers.structure) return false;
    if (ann.category === 'Liquidity' && !visibleLayers.liquidity) return false;
    if (ann.category === 'Imbalance' && !visibleLayers.fvg) return false;
    if (ann.category === 'Institutional' && !visibleLayers.orderBlocks) return false;
    if (ann.category === 'DealingRange' && !visibleLayers.dealingRange) return false;
    if (ann.category === 'Setup' && !visibleLayers.setup) return false;
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5">
      <div className="flex flex-col w-full max-w-6xl h-[92vh] bg-[#0b101d] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e293b] bg-[#0e1628]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Chart Vision SMC Detection & Interactive Overlay</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  VISUAL AI + DETERMINISTIC SMC
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Upload any chart image to extract, annotate, and explain SMC structures interactively
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Distinction Banner: Screenshot Analysis vs Current Market Feed */}
        <div className="flex flex-wrap items-center justify-between px-5 py-2 bg-[#080d19] border-b border-[#17223b] text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-bold text-[11px]">
              📷 Screenshot Analysis
            </span>
            <span className="text-slate-400">
              This analysis describes the technical structures shown in the uploaded screenshot.
            </span>
          </div>

          {pipeline && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Current Live Terminal Asset: <strong className="text-slate-200">{pipeline.instrument.symbol}</strong> ({pipeline.timeframe})</span>
            </div>
          )}
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Interactive Canvas & Action Controls */}
          <div className="flex-1 flex flex-col p-4 border-r border-[#1e293b] overflow-y-auto space-y-4">
            {/* Upload Area (when no image) */}
            {!imagePreview ? (
              <label className="flex-1 flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl bg-[#090e1a] cursor-pointer transition-all min-h-[350px]">
                <div className="p-4 rounded-full bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <strong className="text-slate-200 text-base">Upload Chart Screenshot</strong>
                <span className="text-slate-500 text-xs mt-1 text-center max-w-sm">
                  TradingView, MetaTrader, or custom chart images (PNG, JPG, WebP). Full SMC structures will be detected and annotated.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <>
                {/* Action Controls Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-[#0e1628] border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => runAnalysis(imagePreview, 'FULL')}
                      disabled={isAnalyzing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Run Full SMC Analysis
                    </button>

                    <button
                      onClick={() => runAnalysis(imagePreview, 'STRUCTURE')}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      Structure (BOS/MSS)
                    </button>

                    <button
                      onClick={() => runAnalysis(imagePreview, 'FVG')}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      FVGs
                    </button>

                    <button
                      onClick={() => runAnalysis(imagePreview, 'ORDER_BLOCKS')}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      Order Blocks
                    </button>

                    <button
                      onClick={() => runAnalysis(imagePreview, 'SETUP')}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      Find Potential Setup
                    </button>
                  </div>

                  <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer font-medium">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload New</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {/* Layer Visibility Toggles */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-[#090e1a] border border-[#1e293b] text-xs">
                  <span className="text-slate-500 font-bold flex items-center gap-1 mr-1">
                    <Sliders className="w-3.5 h-3.5" /> Layers:
                  </span>

                  {[
                    { key: 'structure', label: 'Market Structure' },
                    { key: 'liquidity', label: 'Liquidity & Sweeps' },
                    { key: 'fvg', label: 'Fair Value Gaps' },
                    { key: 'orderBlocks', label: 'Order Blocks' },
                    { key: 'dealingRange', label: 'Dealing Range' },
                    { key: 'setup', label: 'Potential Setup' },
                  ].map(l => {
                    const isActive = visibleLayers[l.key as keyof typeof visibleLayers];
                    return (
                      <button
                        key={l.key}
                        onClick={() => toggleLayer(l.key as keyof typeof visibleLayers)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                            : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-600'}`} />
                        {l.label}
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Chart Vision Image & SVG Annotation Canvas */}
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black flex-1 min-h-[380px] max-h-[520px] flex items-center justify-center select-none group">
                  {/* Base Screenshot */}
                  <img
                    src={imagePreview}
                    alt="Uploaded Chart"
                    className="object-contain w-full h-full max-h-[520px]"
                  />

                  {/* Loading Spinner during analysis */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-30">
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                      <span className="text-white font-bold text-sm">Performing Computer Vision & SMC Detection…</span>
                      <span className="text-slate-400 text-xs">Swings • Liquidity Pools • FVGs • Order Blocks • Scenarios</span>
                    </div>
                  )}

                  {/* SVG Interactive Overlay */}
                  {!isAnalyzing && analysisResult && (
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-auto"
                    >
                      {/* 1. Dealing Range Equilibrium */}
                      {visibleLayers.dealingRange && (
                        <g className="cursor-pointer" onClick={() => setSelectedAnnotation(analysisResult.annotations.find(a => a.type === 'DEALING_RANGE') || null)}>
                          <line x1="0" y1="50" x2="100" y2="50" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="1.5 1" opacity="0.8" />
                          <rect x="2" y="48" width="18" height="4" rx="0.5" fill="#0b101d" stroke="#38bdf8" strokeWidth="0.3" />
                          <text x="11" y="50.8" fill="#38bdf8" fontSize="2.2" fontWeight="bold" textAnchor="middle">EQ 50%</text>
                        </g>
                      )}

                      {/* 2. Order Blocks & FVG Imbalance Boxes */}
                      {filteredAnnotations.map(ann => {
                        if (ann.type === 'FVG' && ann.coordinates.widthPct && ann.coordinates.heightPct) {
                          const isSelected = selectedAnnotation?.id === ann.id;
                          return (
                            <g key={ann.id} className="cursor-pointer" onClick={() => setSelectedAnnotation(ann)}>
                              <rect
                                x={ann.coordinates.xPct}
                                y={ann.coordinates.yPct}
                                width={ann.coordinates.widthPct}
                                height={ann.coordinates.heightPct}
                                fill="rgba(16, 185, 129, 0.2)"
                                stroke={isSelected ? '#38bdf8' : '#10b981'}
                                strokeWidth={isSelected ? '0.8' : '0.4'}
                                strokeDasharray={isSelected ? 'none' : '1 0.5'}
                              />
                              <text
                                x={ann.coordinates.xPct + 1}
                                y={ann.coordinates.yPct + 3}
                                fill="#10b981"
                                fontSize="2.2"
                                fontWeight="bold"
                              >
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        if (ann.type === 'ORDER_BLOCK' && ann.coordinates.widthPct && ann.coordinates.heightPct) {
                          const isSelected = selectedAnnotation?.id === ann.id;
                          return (
                            <g key={ann.id} className="cursor-pointer" onClick={() => setSelectedAnnotation(ann)}>
                              <rect
                                x={ann.coordinates.xPct}
                                y={ann.coordinates.yPct}
                                width={ann.coordinates.widthPct}
                                height={ann.coordinates.heightPct}
                                fill="rgba(139, 92, 246, 0.25)"
                                stroke={isSelected ? '#38bdf8' : '#8b5cf6'}
                                strokeWidth={isSelected ? '0.8' : '0.4'}
                              />
                              <text
                                x={ann.coordinates.xPct + 1}
                                y={ann.coordinates.yPct + 3}
                                fill="#a78bfa"
                                fontSize="2.2"
                                fontWeight="bold"
                              >
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        if (ann.type === 'POTENTIAL_SETUP' && ann.coordinates.widthPct && ann.coordinates.heightPct) {
                          return (
                            <g key={ann.id} className="cursor-pointer" onClick={() => setSelectedAnnotation(ann)}>
                              <rect
                                x={ann.coordinates.xPct}
                                y={ann.coordinates.yPct}
                                width={ann.coordinates.widthPct}
                                height={ann.coordinates.heightPct}
                                fill="rgba(56, 189, 248, 0.15)"
                                stroke="#38bdf8"
                                strokeWidth="0.6"
                                strokeDasharray="1 1"
                              />
                              <rect x={ann.coordinates.xPct} y={ann.coordinates.yPct - 3.5} width="22" height="3.5" rx="0.5" fill="#0369a1" />
                              <text x={ann.coordinates.xPct + 11} y={ann.coordinates.yPct - 1} fill="#ffffff" fontSize="2" fontWeight="bold" textAnchor="middle">
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        // Lines: BOS, Liquidity, Sweeps
                        if (ann.coordinates.x2Pct != null && ann.coordinates.y2Pct != null) {
                          const isSelected = selectedAnnotation?.id === ann.id;
                          const isSweep = ann.type === 'LIQUIDITY_SWEEP';
                          const isBSL = ann.type === 'LIQUIDITY_POOL';
                          const strokeColor = isSweep ? '#f59e0b' : isBSL ? '#38bdf8' : '#10b981';

                          return (
                            <g key={ann.id} className="cursor-pointer" onClick={() => setSelectedAnnotation(ann)}>
                              <line
                                x1={ann.coordinates.xPct}
                                y1={ann.coordinates.yPct}
                                x2={ann.coordinates.x2Pct}
                                y2={ann.coordinates.y2Pct}
                                stroke={isSelected ? '#ffffff' : strokeColor}
                                strokeWidth={isSweep ? '0.7' : '0.5'}
                                strokeDasharray={isSweep ? '1.5 1' : '1 1'}
                              />
                              <rect
                                x={(ann.coordinates.xPct + ann.coordinates.x2Pct) / 2 - 10}
                                y={ann.coordinates.yPct - 2.5}
                                width="20"
                                height="3.5"
                                rx="0.5"
                                fill="#0b101d"
                                stroke={strokeColor}
                                strokeWidth="0.3"
                              />
                              <text
                                x={(ann.coordinates.xPct + ann.coordinates.x2Pct) / 2}
                                y={ann.coordinates.yPct - 0.2}
                                fill={strokeColor}
                                fontSize="2"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        // Points: Swings
                        if (ann.type === 'SWING_HIGH' || ann.type === 'SWING_LOW') {
                          const isHigh = ann.type === 'SWING_HIGH';
                          const isSelected = selectedAnnotation?.id === ann.id;
                          return (
                            <g key={ann.id} className="cursor-pointer" onClick={() => setSelectedAnnotation(ann)}>
                              <circle
                                cx={ann.coordinates.xPct}
                                cy={ann.coordinates.yPct}
                                r={isSelected ? '1.5' : '1'}
                                fill={isHigh ? '#38bdf8' : '#f43f5e'}
                                stroke="#ffffff"
                                strokeWidth="0.2"
                              />
                              <text
                                x={ann.coordinates.xPct}
                                y={isHigh ? ann.coordinates.yPct - 2 : ann.coordinates.yPct + 3.5}
                                fill={isHigh ? '#38bdf8' : '#f43f5e'}
                                fontSize="2.2"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        return null;
                      })}
                    </svg>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Interactive Click-to-Explain Card & Setup Detection Breakdown */}
          <div className="w-full md:w-96 flex flex-col p-4 bg-[#090e1a] overflow-y-auto space-y-4 text-xs">
            {/* Selected Annotation Details Card */}
            {selectedAnnotation ? (
              <div className="p-4 rounded-xl bg-[#0e1628] border border-blue-500/40 space-y-3 shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-blue-600/20 text-blue-400">
                      <Info className="w-4 h-4" />
                    </span>
                    <strong className="text-white text-sm">{selectedAnnotation.label}</strong>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {selectedAnnotation.confidence} CONFIDENCE
                  </span>
                </div>

                {selectedAnnotation.subLabel && (
                  <p className="text-slate-300 font-medium text-xs">{selectedAnnotation.subLabel}</p>
                )}

                {/* Price / Bounds Fact */}
                {selectedAnnotation.priceRange && (
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
                    <span className="text-slate-400 block text-[10px]">Zone Bounds:</span>
                    <strong className="text-blue-300">{selectedAnnotation.priceRange.bottom.toFixed(5)} — {selectedAnnotation.priceRange.top.toFixed(5)}</strong>
                  </div>
                )}

                {selectedAnnotation.priceLevel && (
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
                    <span className="text-slate-400 block text-[10px]">Reference Level:</span>
                    <strong className="text-blue-300">{selectedAnnotation.priceLevel.toFixed(5)}</strong>
                  </div>
                )}

                {/* Detection Formula & Why Detected */}
                <div className="space-y-1 text-[11px]">
                  <span className="text-slate-400 font-semibold block">SMC Detection Logic:</span>
                  <p className="text-slate-300 leading-relaxed bg-black/30 p-2 rounded border border-slate-800">
                    {selectedAnnotation.whyDetected}
                  </p>
                </div>

                {/* Status & Structural Meaning */}
                <div className="space-y-1 text-[11px]">
                  <span className="text-slate-400 font-semibold block">Status & Confluence:</span>
                  <div className="flex items-start gap-1.5 text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{selectedAnnotation.status}</span>
                  </div>
                  {selectedAnnotation.relatedStructure && (
                    <p className="text-slate-400 text-[10px] mt-1 pl-5">
                      {selectedAnnotation.relatedStructure}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl bg-[#0e1628] border border-slate-800 space-y-2">
                <Info className="w-8 h-8 text-slate-600 mx-auto" />
                <strong className="text-slate-300 block">Click Any Annotation on Chart</strong>
                <p className="text-slate-500 text-xs">
                  Click on any detected BOS, FVG, Order Block, or Liquidity Pool on the image to view technical explanations.
                </p>
              </div>
            )}

            {/* Potential Setup Breakdown */}
            {analysisResult?.setup && (
              <div className="p-4 rounded-xl bg-[#0e1628] border border-[#1e293b] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <strong className="text-white text-xs">{analysisResult.setup.title}</strong>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold text-xs">
                    {analysisResult.setup.riskRewardRatio}R
                  </span>
                </div>

                {/* Sizing & Levels */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Entry Zone</span>
                    <strong className="text-blue-300 font-mono">{analysisResult.setup.entryZone.topPrice}</strong>
                  </div>
                  <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Invalidation</span>
                    <strong className="text-rose-400 font-mono">{analysisResult.setup.invalidationPrice}</strong>
                  </div>
                  <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Target (TP)</span>
                    <strong className="text-emerald-400 font-mono">{analysisResult.setup.targetPrice}</strong>
                  </div>
                </div>

                {/* Evidence Checklist */}
                <div className="space-y-1.5 text-[11px]">
                  <span className="text-slate-400 font-semibold block">Setup Evidence Breakdown:</span>
                  {analysisResult.setup.evidenceChecklist.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-black/30 border border-slate-800 text-[10px]">
                      <span className="flex items-center gap-1 text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        {ev.label}
                      </span>
                      <span className="text-slate-400 font-mono">{ev.note}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-500 italic pt-1">
                  {analysisResult.setup.disclaimer}
                </p>
              </div>
            )}

            {/* Conflict Detection Summary */}
            {analysisResult && analysisResult.conflicts.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 space-y-2 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Visual vs Tick Fact Conflict:</span>
                </div>
                {analysisResult.conflicts.map((conf, i) => (
                  <p key={i} className="text-slate-300 leading-tight text-[10px]">
                    {conf.explanation}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
