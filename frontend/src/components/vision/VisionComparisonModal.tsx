'use client';

import React, { useState } from 'react';
import { analyzeChartScreenshot, VisionAnalysisMode } from '@/services/visionService';
import {
  VisionAnalysisResult,
  VisionAnnotationItem,
  VisionSetup,
} from '@/types/vision';
import {
  X, Upload, RefreshCw, Eye, Layers, CheckCircle2,
  AlertTriangle, Shield, TrendingUp, Target, ArrowRight,
  Info, Sparkles, Sliders, CheckSquare, Square, Zap,
  FileImage, Clock, Compass, HelpCircle, Activity
} from 'lucide-react';

interface VisionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VisionComparisonModal({ isOpen, onClose }: VisionComparisonModalProps) {
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
      // Clear previous results immediately
      setAnalysisResult(null);
      setSelectedAnnotation(null);

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
      const result = await analyzeChartScreenshot(base64, mode);
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

  const handleReset = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setSelectedAnnotation(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-fadeIn">
      <div className="flex flex-col w-full max-w-6xl h-[94vh] bg-[#0b101d] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e293b] bg-[#0e1628]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Chart Vision — Isolated Screenshot Analysis</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PURE IMAGE PARSER
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                100% independent visual SMC extraction (No live terminal bleed or pre-configured values)
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

        {/* Screenshot Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between px-5 py-2 bg-[#080d19] border-b border-[#17223b] text-xs gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-bold text-[11px]">
              📷 Uploaded Image Context
            </span>
            {analysisResult ? (
              <>
                <span className="text-slate-300 font-semibold">
                  Asset: <strong className="text-white">{analysisResult.symbolDetected}</strong>
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300">
                  Timeframe: <strong className="text-white">{analysisResult.timeframeDetected}</strong>
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300">
                  Trend: <strong className={analysisResult.visibleTrend === 'BULLISH' ? 'text-emerald-400' : analysisResult.visibleTrend === 'BEARISH' ? 'text-rose-400' : 'text-amber-400'}>{analysisResult.visibleTrend}</strong>
                </span>
              </>
            ) : (
              <span className="text-slate-500">Awaiting chart image upload…</span>
            )}
          </div>

          {imagePreview && (
            <button
              onClick={handleReset}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
            >
              Upload Different Chart
            </button>
          )}
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Image Canvas & Interactive Annotations */}
          <div className="flex-1 flex flex-col p-4 border-r border-[#1e293b] overflow-y-auto space-y-4">
            {!imagePreview ? (
              <label className="flex-1 flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl bg-[#090e1a] cursor-pointer transition-all min-h-[350px]">
                <div className="p-4 rounded-full bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <strong className="text-slate-200 text-base">Upload Any Chart Screenshot</strong>
                <span className="text-slate-500 text-xs mt-1 text-center max-w-sm">
                  TradingView, MetaTrader, or custom chart images (PNG, JPG, WebP). Candle structures and SMC zones will be extracted dynamically from the image.
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
                {/* Layer Visibility Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-[#0e1628] border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-semibold mr-1">Overlay Layers:</span>
                    {[
                      { key: 'structure', label: 'Swings & BOS', color: 'blue' },
                      { key: 'liquidity', label: 'Liquidity ⚡', color: 'amber' },
                      { key: 'fvg', label: 'FVG Imbalance', color: 'emerald' },
                      { key: 'orderBlocks', label: 'Order Blocks', color: 'purple' },
                      { key: 'dealingRange', label: 'Dealing Range EQ', color: 'cyan' },
                      { key: 'setup', label: 'Setup Zone', color: 'indigo' },
                    ].map(layer => {
                      const isActive = visibleLayers[layer.key as keyof typeof visibleLayers];
                      return (
                        <button
                          key={layer.key}
                          onClick={() => toggleLayer(layer.key as keyof typeof visibleLayers)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                            isActive
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                              : 'bg-slate-800/40 text-slate-500 border border-transparent'
                          }`}
                        >
                          {isActive ? <CheckSquare className="w-3 h-3 text-blue-400" /> : <Square className="w-3 h-3 text-slate-600" />}
                          {layer.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive Image & SVG Canvas */}
                <div className="relative flex-1 rounded-xl bg-[#060a12] border border-slate-800 overflow-hidden flex items-center justify-center min-h-[380px]">
                  {isAnalyzing && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm space-y-3">
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                      <strong className="text-white text-sm">Analyzing Screenshot Structure…</strong>
                      <span className="text-slate-400 text-xs">Extracting candles, swings, imbalances, and dealing ranges</span>
                    </div>
                  )}

                  {/* Uploaded Chart Image */}
                  <img
                    src={imagePreview}
                    alt="Uploaded chart"
                    className="w-full h-full object-contain max-h-[520px]"
                  />

                  {/* SVG Overlay using exact percentage coordinates from image parser */}
                  {analysisResult && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {filteredAnnotations.map((ann) => {
                        const isSelected = selectedAnnotation?.id === ann.id;

                        // 1. Box Annotations (FVG, Order Blocks, Setup Zone)
                        if (ann.coordinates.widthPct && ann.coordinates.heightPct) {
                          const isBull = ann.label.includes('+') || ann.label.includes('Bullish');
                          const isSetup = ann.type === 'POTENTIAL_SETUP';
                          const strokeColor = isSetup ? '#818cf8' : ann.category === 'Imbalance' ? (isBull ? '#10b981' : '#ef4444') : '#a855f7';
                          const fillColor = isSetup ? 'rgba(99, 102, 241, 0.20)' : ann.category === 'Imbalance' ? (isBull ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)') : 'rgba(168, 85, 247, 0.18)';

                          return (
                            <g
                              key={ann.id}
                              className="pointer-events-auto cursor-pointer"
                              onClick={() => setSelectedAnnotation(ann)}
                            >
                              <rect
                                x={`${ann.coordinates.xPct}%`}
                                y={`${ann.coordinates.yPct}%`}
                                width={`${ann.coordinates.widthPct}%`}
                                height={`${ann.coordinates.heightPct}%`}
                                fill={fillColor}
                                stroke={strokeColor}
                                strokeWidth={isSelected ? '2.5' : '1.5'}
                                strokeDasharray={isSetup ? '4 2' : 'none'}
                                rx="3"
                              />
                              <text
                                x={`${ann.coordinates.xPct + 1}%`}
                                y={`${ann.coordinates.yPct + 4}%`}
                                fill={strokeColor}
                                fontSize="10"
                                fontWeight="bold"
                              >
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        // 2. Line Annotations (BOS, MSS, Liquidity Pools, Dealing Range EQ)
                        if (ann.coordinates.x2Pct !== undefined && ann.coordinates.y2Pct !== undefined) {
                          const isEQ = ann.type === 'DEALING_RANGE';
                          const strokeColor = isEQ ? '#38bdf8' : ann.type === 'BOS' ? '#10b981' : ann.type === 'MSS' ? '#f59e0b' : '#f43f5e';

                          return (
                            <g
                              key={ann.id}
                              className="pointer-events-auto cursor-pointer"
                              onClick={() => setSelectedAnnotation(ann)}
                            >
                              <line
                                x1={`${ann.coordinates.xPct}%`}
                                y1={`${ann.coordinates.yPct}%`}
                                x2={`${ann.coordinates.x2Pct}%`}
                                y2={`${ann.coordinates.y2Pct}%`}
                                stroke={strokeColor}
                                strokeWidth={isSelected ? '2.5' : '1.5'}
                                strokeDasharray={isEQ ? '4 4' : '2 2'}
                              />
                              <text
                                x={`${ann.coordinates.xPct + 2}%`}
                                y={`${ann.coordinates.yPct - 1.5}%`}
                                fill={strokeColor}
                                fontSize="10"
                                fontWeight="bold"
                              >
                                {ann.label}
                              </text>
                            </g>
                          );
                        }

                        // 3. Point Pivot Annotations (Swing High / Swing Low)
                        const isHigh = ann.type === 'SWING_HIGH';
                        const color = isHigh ? '#38bdf8' : '#f43f5e';

                        return (
                          <g
                            key={ann.id}
                            className="pointer-events-auto cursor-pointer"
                            onClick={() => setSelectedAnnotation(ann)}
                          >
                            <circle
                              cx={`${ann.coordinates.xPct}%`}
                              cy={`${ann.coordinates.yPct}%`}
                              r={isSelected ? '6' : '4'}
                              fill={color}
                              stroke="#ffffff"
                              strokeWidth="1"
                            />
                            <text
                              x={`${ann.coordinates.xPct}%`}
                              y={`${isHigh ? ann.coordinates.yPct - 3 : ann.coordinates.yPct + 4}%`}
                              fill={color}
                              fontSize="10"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {ann.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Screenshot-Specific Analysis Panel (Scrollable) */}
          <div className="w-full md:w-[380px] lg:w-[420px] bg-[#090e1a] p-4 flex flex-col space-y-4 overflow-y-auto border-t md:border-t-0 md:border-l border-[#1e293b]">
            {!analysisResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Eye className="w-10 h-10 text-slate-600 animate-pulse" />
                <h3 className="text-slate-300 font-bold text-sm">No Chart Uploaded</h3>
                <p className="text-xs">Upload a chart image to view the screenshot-derived SMC analysis panel.</p>
              </div>
            ) : (
              <>
                {/* 1. Selected Visual Annotation Detail Box */}
                {selectedAnnotation && (
                  <div className="p-3.5 rounded-xl bg-[#0e1628] border border-blue-500/40 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {selectedAnnotation.category}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                        Confidence: {selectedAnnotation.confidence}
                      </span>
                    </div>

                    <strong className="text-white text-sm block">{selectedAnnotation.label}</strong>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedAnnotation.whyDetected}</p>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Status: <strong className="text-slate-200">{selectedAnnotation.status}</strong></span>
                      {selectedAnnotation.relatedStructure && (
                        <span className="text-blue-300 font-mono">{selectedAnnotation.relatedStructure}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Potential Setup Scenario (Derived Strictly from Image) */}
                {analysisResult.setup ? (
                  <div className="p-4 rounded-xl bg-gradient-to-b from-[#0f172a] to-[#0b101d] border border-indigo-500/40 space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        Screenshot Setup Scenario
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {analysisResult.setup.riskRewardRatio}R Potential
                      </span>
                    </div>

                    <h4 className="text-white font-bold text-sm">{analysisResult.setup.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{analysisResult.setup.narrative}</p>

                    {/* Entry / Stop / Target Levels */}
                    <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                      <div className="p-2 rounded bg-black/40 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Entry Zone</span>
                        <strong className="text-blue-300 font-mono text-[11px]">{analysisResult.setup.entryZone.topPrice}% - {analysisResult.setup.entryZone.bottomPrice}%</strong>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Invalidation</span>
                        <strong className="text-rose-400 font-mono text-[11px]">Y: {analysisResult.setup.invalidationPrice}%</strong>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Target</span>
                        <strong className="text-emerald-400 font-mono text-[11px]">Y: {analysisResult.setup.targetPrice}%</strong>
                      </div>
                    </div>

                    {/* Evidence Checklist */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                      <strong className="text-slate-300 text-[11px] block">Visual Confluence Evidence:</strong>
                      {analysisResult.setup.evidenceChecklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{item.label}: <strong className="text-white">{item.note}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#0e1628] border border-amber-500/30 text-xs text-amber-300 space-y-1">
                    <strong className="block text-white flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      No High-Probability Setup Forced
                    </strong>
                    <p className="text-slate-400 text-[11px]">
                      The uploaded screenshot does not exhibit sufficient directional displacement or clean confluence. Chart Vision does not force fake setups.
                    </p>
                  </div>
                )}

                {/* 3. Detected Structures Summary List */}
                <div className="space-y-2 text-xs">
                  <strong className="text-slate-300 block font-bold">Detected Visual SMC Structures ({analysisResult.annotations.length}):</strong>
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {analysisResult.annotations.map((ann) => (
                      <button
                        key={ann.id}
                        onClick={() => setSelectedAnnotation(ann)}
                        className={`w-full text-left p-2 rounded-lg border text-[11px] flex items-center justify-between transition-all ${
                          selectedAnnotation?.id === ann.id
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-[#0e1628] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="font-semibold">{ann.label}</span>
                        <span className="text-[10px] text-slate-500">{ann.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
