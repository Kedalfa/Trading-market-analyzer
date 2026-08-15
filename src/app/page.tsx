'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Instrument } from '@/types/market';
import { SUPPORTED_INSTRUMENTS } from '@/engine/data/instruments';
import { fetchMarketData } from '@/engine/data/marketDataFetcher';
import { runSMCPipeline, FullSMCPipelineResult } from '@/engine';
import { getEconomicEventsForInstrument } from '@/services/newsService';
import { generateStructuredSMCAnalysis } from '@/services/aiReasoningService';
import { StructuredSMCAnalysis } from '@/types/ai';

import { Header } from '@/components/layout/Header';
import { TradingChart } from '@/components/chart/TradingChart';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { AnalysisTimeline } from '@/components/timeline/AnalysisTimeline';
import { EducationalModal } from '@/components/education/EducationalModal';
import { VisionComparisonModal } from '@/components/vision/VisionComparisonModal';
import { RiskCalculatorModal } from '@/components/risk/RiskCalculatorModal';
import { ReplayController } from '@/components/replay/ReplayController';
import { HistoryView } from '@/components/history/HistoryView';
import { EDUCATIONAL_CONCEPTS } from '@/services/educationalService';

import { 
  RefreshCw, AlertTriangle, BookOpen, Layers, 
  TrendingUp, Shield, Sparkles 
} from 'lucide-react';

export default function SMCMarketAnalyzerApp() {
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(SUPPORTED_INSTRUMENTS[0]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('15M');
  const [selectedRuleset, setSelectedRuleset] = useState<string>('standard_smc');
  const [activeTab, setActiveTab] = useState<'analyzer' | 'history' | 'journal_export' | 'learn'>('analyzer');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pipelineResult, setPipelineResult] = useState<FullSMCPipelineResult | null>(null);
  const [htfPipelineResult, setHtfPipelineResult] = useState<FullSMCPipelineResult | null>(null);
  const [analysis, setAnalysis] = useState<StructuredSMCAnalysis | null>(null);

  // Modals state
  const [isEducationOpen, setIsEducationOpen] = useState<boolean>(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string>('bos');
  const [isVisionOpen, setIsVisionOpen] = useState<boolean>(false);
  const [isRiskOpen, setIsRiskOpen] = useState<boolean>(false);
  const [riskInitialDirection, setRiskInitialDirection] = useState<'LONG' | 'SHORT'>('LONG');

  // Backtest / Replay Mode state
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  // Load and analyze market data on selection change
  useEffect(() => {
    let isMounted = true;
    async function loadPipeline() {
      setIsLoading(true);
      try {
        // 1. Fetch current timeframe candles
        const data = await fetchMarketData(selectedInstrument, selectedTimeframe, 220);
        // 2. Fetch HTF candles for macro confluence (4H or 1D)
        const htfTimeframe = selectedTimeframe === '1D' ? '1W' : selectedTimeframe === '4H' ? '1D' : '4H';
        const htfData = await fetchMarketData(selectedInstrument, htfTimeframe, 150);

        if (!isMounted) return;

        // 3. Run deterministic SMC mathematical engines
        const pipe = runSMCPipeline(selectedInstrument, data.candles, selectedTimeframe);
        const htfPipe = runSMCPipeline(selectedInstrument, htfData.candles, htfTimeframe);

        // 4. Retrieve economic news context
        const news = getEconomicEventsForInstrument(selectedInstrument);

        // 5. Synthesize structured AI analysis & probabilistic scenarios
        const structAnalysis = generateStructuredSMCAnalysis(pipe, news, selectedRuleset, htfPipe);

        setPipelineResult(pipe);
        setHtfPipelineResult(htfPipe);
        setAnalysis(structAnalysis);
        setReplayIndex(pipe.candles.length - 1);
      } catch (err) {
        console.error('Failed to run SMC pipeline:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPipeline();
    return () => { isMounted = false; };
  }, [selectedInstrument, selectedTimeframe, selectedRuleset]);

  const handleOpenConcept = (conceptId: string) => {
    setSelectedConceptId(conceptId);
    setIsEducationOpen(true);
  };

  const handleCreateTradeIdea = (direction: 'LONG' | 'SHORT') => {
    setRiskInitialDirection(direction);
    setIsRiskOpen(true);
  };

  const handleSaveAnalysis = () => {
    if (!analysis) return;
    const existing = JSON.parse(localStorage.getItem('smc_saved_analyses') || '[]');
    existing.unshift({
      id: analysis.analysisId,
      timestamp: analysis.timestamp,
      symbol: analysis.symbol,
      timeframe: analysis.timeframeHierarchy.intermediate,
      currentPrice: analysis.currentPrice,
      predictedDirection: analysis.marketOverview.htfBias === 'BULLISH' ? 'BULLISH' : 'BEARISH',
      confidenceScore: analysis.setupQuality.totalScore,
      setupGrade: analysis.setupQuality.grade,
      entryZone: analysis.scenarios.bullish.idealEntryZone.referenceZone,
      invalidationPrice: analysis.scenarios.bullish.invalidationPrice,
      targetPrice: analysis.scenarios.bullish.potentialTargets[1]?.price || analysis.currentPrice * 1.02
    });
    localStorage.setItem('smc_saved_analyses', JSON.stringify(existing));
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Institutional Navigation Header */}
      <Header
        selectedInstrument={selectedInstrument}
        onSelectInstrument={setSelectedInstrument}
        selectedTimeframe={selectedTimeframe}
        onSelectTimeframe={setSelectedTimeframe}
        selectedRuleset={selectedRuleset}
        onSelectRuleset={setSelectedRuleset}
        sessionStatus={pipelineResult?.sessionStatus}
        isReplayMode={isReplayMode}
        onToggleReplayMode={() => setIsReplayMode(!isReplayMode)}
        onOpenVisionModal={() => setIsVisionOpen(true)}
        onOpenEducationModal={() => handleOpenConcept('bos')}
        onOpenRiskModal={() => setIsRiskOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Terminal View Container */}
      <main className="flex-1 flex flex-col p-3 lg:p-4 gap-3 max-w-[1920px] mx-auto w-full">
        {/* Tab 1: Primary Market Analyzer Terminal */}
        {activeTab === 'analyzer' && (
          <>
            {/* Replay Bar Controller (when active) */}
            {isReplayMode && pipelineResult && (
              <ReplayController
                totalBars={pipelineResult.candles.length}
                currentReplayIndex={replayIndex}
                onChangeReplayIndex={setReplayIndex}
                onExitReplay={() => setIsReplayMode(false)}
              />
            )}

            {/* Imminent News Alert Warning Banner if present */}
            {analysis?.newsContext.riskWarning && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs shadow-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold">{analysis.newsContext.riskWarning}</span>
              </div>
            )}

            {/* Main Center & Right Workspaces */}
            {isLoading || !pipelineResult || !analysis ? (
              <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center space-y-4 rounded-2xl bg-[#0b101d] border border-[#1e293b]">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="font-bold text-slate-300 text-sm">
                  Computing Deterministic SMC Structures for {selectedInstrument.symbol}...
                </span>
                <span className="text-slate-500 text-xs">
                  Swings • Liquidity Pools • FVGs • Order Blocks • Dealing Ranges • AI Reasoning
                </span>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3 min-h-[560px]">
                {/* Center Candlestick Chart Area (8 cols on large screens) */}
                <div className="xl:col-span-8 flex flex-col h-[560px] xl:h-auto min-h-[500px]">
                  <TradingChart
                    pipeline={pipelineResult}
                    onSelectConcept={handleOpenConcept}
                    replayIndex={isReplayMode ? replayIndex : undefined}
                  />
                </div>

                {/* Right AI Structural Intelligence & Scenarios Panel (4 cols) */}
                <div className="xl:col-span-4 flex flex-col h-[560px] xl:h-auto min-h-[500px]">
                  <AnalysisPanel
                    analysis={analysis}
                    instrument={selectedInstrument}
                    onCreateTradeIdea={handleCreateTradeIdea}
                    onSaveAnalysis={handleSaveAnalysis}
                    onSelectConcept={handleOpenConcept}
                  />
                </div>
              </div>
            )}

            {/* Bottom Chronological Analysis Timeline */}
            {pipelineResult && (
              <AnalysisTimeline
                pipeline={pipelineResult}
                onSelectConcept={handleOpenConcept}
              />
            )}
          </>
        )}

        {/* Tab 2: Analysis History View */}
        {activeTab === 'history' && (
          <HistoryView />
        )}

        {/* Tab 3: Learning Center Interactive Catalog */}
        {activeTab === 'learn' && (
          <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
            <div className="pb-4 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-400" />
                <h1 className="text-xl font-bold text-white">Smart Money Concepts Interactive Academy</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Institutional market microstructure, order block validation, and displacement mechanics
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(EDUCATIONAL_CONCEPTS).map(concept => (
                <div
                  key={concept.id}
                  onClick={() => handleOpenConcept(concept.id)}
                  className="p-5 rounded-2xl bg-[#0b101d] border border-[#1e293b] hover:border-blue-500/50 cursor-pointer space-y-3 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">
                      {concept.category}
                    </span>
                    <span className="text-slate-500 text-xs group-hover:text-blue-400 transition-colors">
                      Learn More →
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                    {concept.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {concept.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Educational Deep Dive Concept Modal */}
      <EducationalModal
        isOpen={isEducationOpen}
        onClose={() => setIsEducationOpen(false)}
        initialConceptId={selectedConceptId}
      />

      {/* Vision & Screenshot Conflict Detector Modal */}
      {pipelineResult && (
        <VisionComparisonModal
          isOpen={isVisionOpen}
          onClose={() => setIsVisionOpen(false)}
          pipeline={pipelineResult}
        />
      )}

      {/* Risk Calculator & Trade Idea Hub Modal */}
      {analysis && (
        <RiskCalculatorModal
          isOpen={isRiskOpen}
          onClose={() => setIsRiskOpen(false)}
          instrument={selectedInstrument}
          analysis={analysis}
          initialDirection={riskInitialDirection}
        />
      )}
    </div>
  );
}
