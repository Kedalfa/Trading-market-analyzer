'use client';

import React, { useState } from 'react';
import { FullSMCPipelineResult } from '@/engine';
import { analyzeChartScreenshot } from '@/services/visionService';
import { VisionComparisonResult } from '@/types/vision';
import { 
  X, Upload, Image as ImageIcon, AlertTriangle, ShieldCheck, 
  CheckCircle2, AlertCircle, ArrowRight, Eye, RefreshCw 
} from 'lucide-react';

interface VisionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipeline: FullSMCPipelineResult;
}

export function VisionComparisonModal({ isOpen, onClose, pipeline }: VisionComparisonModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<VisionComparisonResult | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        runVisionAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const runVisionAnalysis = async (base64: string) => {
    setIsAnalyzing(true);
    // Execute vision service comparison
    const comparison = await analyzeChartScreenshot(base64, pipeline);
    setResult(comparison);
    setIsAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-[#0b101d] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e293b] bg-[#0e1628]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Chart Screenshot Vision & Conflict Detector</h2>
              <p className="text-xs text-slate-400">Verifying secondary visual drawings against authoritative tick OHLC data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Hierarchy Rule Alert */}
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-200">
            <strong className="block mb-1 text-white">Data Hierarchy Principle:</strong>
            Authoritative Market Data &gt; Detected Chart Structures &gt; Screenshot Interpretation &gt; AI Assumptions. If visual markings conflict with OHLC prices, the mathematical data strictly takes precedence.
          </div>

          {/* Upload Area */}
          {!imagePreview ? (
            <label className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl bg-[#090e1a] cursor-pointer transition-all">
              <Upload className="w-10 h-10 text-indigo-400 mb-3" />
              <strong className="text-slate-200 text-sm">Upload or Drop Chart Screenshot</strong>
              <span className="text-slate-500 text-xs mt-1">TradingView, MetaTrader, or custom chart images (PNG, JPG, WebP)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Image Preview */}
              <div className="space-y-2">
                <span className="font-bold text-slate-300">Uploaded Screenshot:</span>
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black max-h-64 flex items-center justify-center">
                  <img src={imagePreview} alt="Screenshot" className="object-contain max-h-64 w-full" />
                </div>
                <label className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 cursor-pointer font-semibold mt-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Upload different chart image
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {/* Vision Inspection Findings */}
              <div className="space-y-2">
                <span className="font-bold text-slate-300">Vision Engine Observations:</span>
                {isAnalyzing ? (
                  <div className="p-8 rounded-xl bg-[#0e1628] border border-slate-800 flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-slate-400">Inspecting visual candlesticks and levels...</span>
                  </div>
                ) : result ? (
                  <div className="p-4 rounded-xl bg-[#0e1628] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Detected Symbol: <strong className="text-white">{result.visionDetection.symbolDetected || 'Auto'}</strong></span>
                      <span>Detected TF: <strong className="text-blue-400">{result.visionDetection.timeframeDetected || 'Auto'}</strong></span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <span className="text-slate-400 font-semibold">Identified Visual Zones:</span>
                      {result.visionDetection.identifiedZones.map((z, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-indigo-300 font-bold">{z.type}</span>
                          <span className="text-slate-300">{z.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Conflict Analysis Section */}
          {result && (
            <div className="space-y-3 mt-4">
              <span className="font-bold text-white text-sm block">Authoritative Market Data vs Visual Conflict Audit</span>

              {result.conflicts.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-white">No Visual vs Data Discrepancies Found</strong>
                    <span>Visual chart markings and tick-level OHLC calculations are in complete agreement.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {result.conflicts.map((conf, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/50 text-amber-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-300 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Discrepancy: {conf.category.replace('_', ' ')}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-black/40 border border-amber-900/40">
                          <span className="text-slate-400 block font-semibold">Screenshot Appearance:</span>
                          <span className="text-amber-100">{conf.visualObservation}</span>
                        </div>
                        <div className="p-2 rounded bg-black/40 border border-blue-900/40">
                          <span className="text-slate-400 block font-semibold">Authoritative OHLC Data Fact:</span>
                          <span className="text-blue-200">{conf.authoritativeDataFact}</span>
                        </div>
                      </div>

                      <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                        <strong>Resolution:</strong> {conf.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
