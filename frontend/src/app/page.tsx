'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Instrument, RealQuote } from '@/types/market';
import { FullSMCPipelineResult, runSMCPipeline } from '@/engine';
import { StructuredSMCAnalysis } from '@/types/ai';
import { generateStructuredSMCAnalysis } from '@/services/aiReasoningService';

// Backend API client
import {
  fetchInstruments,
  fetchMarketData,
  fetchRealtimeQuote,
  fetchNews,
  fetchSettings,
  saveAnalysis,
  type Instrument as ApiInstrument,
  type UserSettingsResponse,
} from '@/services/api';

// Components
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
  RefreshCw, AlertTriangle, BookOpen, WifiOff,
  Activity, Shield, Cpu,
} from 'lucide-react';

function mapToFrontendInstrument(api: ApiInstrument): Instrument {
  return {
    id: api.id,
    symbol: api.symbol,
    name: api.name,
    assetClass: api.assetClass,
    baseCurrency: api.baseCurrency,
    quoteCurrency: api.quoteCurrency,
    pipSize: api.pipSize,
    tickSize: api.tickSize,
    defaultTimeframe: api.defaultTimeframe,
    provider: api.provider,
  };
}

export default function SMCMarketAnalyzerApp() {
  // ── Bootstrap state ──────────────────────────────────────────────
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettingsResponse | null>(null);
  const [backendStatus, setBackendStatus] = useState<'loading' | 'connected' | 'offline'>('loading');

  // ── Instrument / timeframe / ruleset selections ──────────────────
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('15M');
  const [selectedRuleset, setSelectedRuleset] = useState<string>('standard_smc');

  // ── Real-Time Market Data & Quotes ───────────────────────────────
  const [currentQuote, setCurrentQuote] = useState<RealQuote | null>(null);
  const [dataStatus, setDataStatus] = useState<'LIVE' | 'MARKET_CLOSED' | 'DELAYED' | 'UNAVAILABLE'>('LIVE');
  const [providerName, setProviderName] = useState<string>('Authoritative Market Feed');
  const [lastDataUpdate, setLastDataUpdate] = useState<number>(Date.now());
  const [isRealTime, setIsRealTime] = useState<boolean>(true);
  const [marketErrorMessage, setMarketErrorMessage] = useState<string | undefined>(undefined);

  // ── Analysis state ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'analyzer' | 'history' | 'journal_export' | 'learn'>('analyzer');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pipelineResult, setPipelineResult] = useState<FullSMCPipelineResult | null>(null);
  const [htfPipelineResult, setHtfPipelineResult] = useState<FullSMCPipelineResult | null>(null);
  const [analysis, setAnalysis] = useState<StructuredSMCAnalysis | null>(null);

  // ── Modals ───────────────────────────────────────────────────────
  const [isEducationOpen, setIsEducationOpen] = useState<boolean>(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string>('bos');
  const [isVisionOpen, setIsVisionOpen] = useState<boolean>(false);
  const [isRiskOpen, setIsRiskOpen] = useState<boolean>(false);
  const [riskInitialDirection, setRiskInitialDirection] = useState<'LONG' | 'SHORT'>('LONG');

  // ── Replay mode ──────────────────────────────────────────────────
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  // ── 1. Bootstrap: load instruments + settings from backend ───────
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 6;

    async function bootstrap() {
      try {
        const [apiInstruments, settings] = await Promise.all([
          fetchInstruments(),
          fetchSettings(),
        ]);

        if (!isMounted) return;

        const frontendInstruments = apiInstruments.map(mapToFrontendInstrument);
        setInstruments(frontendInstruments);
        setUserSettings(settings);

        const defaultInst = frontendInstruments.find(i => i.id === settings.defaultInstrumentId)
          ?? frontendInstruments[0];
        setSelectedInstrument(defaultInst);
        setSelectedTimeframe(settings.defaultTimeframe);
        setSelectedRuleset(settings.defaultRuleset);
        setBackendStatus('connected');
      } catch (err) {
        if (!isMounted) return;
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`[Bootstrap] Backend not ready yet, retrying (${retryCount}/${maxRetries})...`);
          setTimeout(bootstrap, 1200);
        } else {
          console.error('[Bootstrap] Backend unavailable after retries:', err);
          setBackendStatus('offline');
          setInstruments([]);
        }
      }
    }

    bootstrap();
    return () => { isMounted = false; };
  }, []);

  // ── 2. Run SMC pipeline when instrument/timeframe/ruleset changes ─
  useEffect(() => {
    if (!selectedInstrument || backendStatus === 'loading') return;

    let isMounted = true;
    async function loadPipeline() {
      if (!selectedInstrument) return;
      setIsLoading(true);
      setMarketErrorMessage(undefined);

      try {
        const htfTimeframe =
          selectedTimeframe === '1D' ? '1W'
          : selectedTimeframe === '4H' ? '1D'
          : '4H';

        // Fetch real market data
        const [marketData, htfMarketData, newsContext] = await Promise.all([
          fetchMarketData(selectedInstrument.id, selectedTimeframe, 220),
          fetchMarketData(selectedInstrument.id, htfTimeframe, 150),
          fetchNews(selectedInstrument.id),
        ]);

        if (!isMounted) return;

        // Check if genuine candles were returned
        if (!marketData.candles || marketData.candles.length === 0) {
          setDataStatus('UNAVAILABLE');
          setMarketErrorMessage(`Live market data unavailable from ${marketData.provider} for ${selectedInstrument.symbol}.`);
          setPipelineResult(null);
          setAnalysis(null);
          return;
        }

        // Set live metadata
        setDataStatus(marketData.status || 'LIVE');
        setProviderName(marketData.provider);
        setLastDataUpdate(marketData.lastUpdated);
        setIsRealTime(marketData.isRealTime);
        if (marketData.quote) {
          setCurrentQuote(marketData.quote);
        }

        // Run deterministic SMC mathematical engines
        const pipe = runSMCPipeline(selectedInstrument, marketData.candles, selectedTimeframe);
        const htfPipe = runSMCPipeline(selectedInstrument, htfMarketData.candles, htfTimeframe);

        // Synthesize structured AI analysis
        const structAnalysis = generateStructuredSMCAnalysis(pipe, newsContext, selectedRuleset, htfPipe);

        setPipelineResult(pipe);
        setHtfPipelineResult(htfPipe);
        setAnalysis(structAnalysis);
        setReplayIndex(pipe.candles.length - 1);
      } catch (err: any) {
        console.error('[Pipeline] Failed:', err);
        if (isMounted) {
          setDataStatus('UNAVAILABLE');
          setMarketErrorMessage(err?.message || 'Data connection lost. Live market feed unavailable.');
          setPipelineResult(null);
          setAnalysis(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPipeline();
    return () => { isMounted = false; };
  }, [selectedInstrument, selectedTimeframe, selectedRuleset, backendStatus]);

  // ── 3. Real-Time Quote Streaming / Polling (Never Frozen) ─────────
  useEffect(() => {
    if (!selectedInstrument || backendStatus !== 'connected' || isReplayMode) return;

    let isMounted = true;
    const intervalMs = selectedInstrument.provider === 'binance' ? 2000 : 4000;

    const pollQuote = async () => {
      try {
        const quote = await fetchRealtimeQuote(selectedInstrument.id);
        if (isMounted && quote) {
          setCurrentQuote(quote);
          setLastDataUpdate(quote.timestamp);
          setDataStatus(quote.status || 'LIVE');
          setIsRealTime(true);
        }
      } catch (err) {
        // Silent catch for background quote polling
      }
    };

    const timer = setInterval(pollQuote, intervalMs);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [selectedInstrument, backendStatus, isReplayMode]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleOpenConcept = (conceptId: string) => {
    setSelectedConceptId(conceptId);
    setIsEducationOpen(true);
  };

  const handleCreateTradeIdea = (direction: 'LONG' | 'SHORT') => {
    setRiskInitialDirection(direction);
    setIsRiskOpen(true);
  };

  const handleSaveAnalysis = async () => {
    if (!analysis || !selectedInstrument) return;
    try {
      await saveAnalysis({
        analysisId: analysis.analysisId,
        symbol: analysis.symbol,
        instrumentId: selectedInstrument.id,
        timeframe: analysis.timeframeHierarchy.intermediate,
        htfTimeframe: analysis.timeframeHierarchy.higher,
        currentPrice: currentQuote?.price ?? analysis.currentPrice,
        rulesetUsed: selectedRuleset,
        htfBias: analysis.marketOverview.htfBias,
        intermediateStructure: analysis.marketOverview.intermediateStructure,
        structuralEvidence: analysis.structuralEvidence.bulletPoints,
        conflictingSignals: analysis.structuralEvidence.conflictingSignals,
        bullishScenario: analysis.scenarios.bullish,
        bearishScenario: analysis.scenarios.bearish,
        setupQuality: analysis.setupQuality,
        newsRiskWarning: analysis.newsContext.riskWarning,
        sessionNotes: analysis.sessionContext.sessionNotes ?? '',
        savedAt: new Date().toISOString(),
        outcome: { status: 'OPEN' },
      });
      console.log('[Analysis] Saved to MongoDB');
    } catch (err) {
      console.error('[Analysis] Failed to save:', err);
    }
  };

  // ── Loading screen ────────────────────────────────────────────────
  if (backendStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Cpu className="w-7 h-7 text-white animate-pulse" />
          </div>
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="text-slate-300 text-sm font-semibold">Connecting to SMC Analyzer Backend…</span>
          <span className="text-slate-500 text-xs">Authenticating real-time feeds & MongoDB registry</span>
        </div>
      </div>
    );
  }

  // ── Offline screen ────────────────────────────────────────────────
  if (backendStatus === 'offline') {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-[#0b101d] border border-rose-500/30 max-w-md text-center">
          <WifiOff className="w-10 h-10 text-rose-400" />
          <h2 className="text-white font-bold text-lg">Backend Offline</h2>
          <p className="text-slate-400 text-sm">
            Cannot connect to <code className="text-blue-300">http://localhost:4000</code>.
          </p>
          <p className="text-slate-500 text-xs">
            Start the backend with: <code className="text-green-400 font-mono">npm run dev</code>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ── Main App ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Institutional Navigation Header */}
      {selectedInstrument && (
        <Header
          instruments={instruments}
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
      )}

      {/* Main Terminal View Container */}
      <main className="flex-1 flex flex-col p-3 lg:p-4 gap-3 max-w-[1920px] mx-auto w-full">
        {/* Tab 1: Primary Market Analyzer Terminal */}
        {activeTab === 'analyzer' && (
          <>
            {/* Replay Bar Controller */}
            {isReplayMode && pipelineResult && (
              <ReplayController
                totalBars={pipelineResult.candles.length}
                currentReplayIndex={replayIndex}
                onChangeReplayIndex={setReplayIndex}
                onExitReplay={() => setIsReplayMode(false)}
              />
            )}

            {/* Imminent News Alert */}
            {analysis?.newsContext.riskWarning && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs shadow-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold">{analysis.newsContext.riskWarning}</span>
              </div>
            )}

            {/* Main Chart + Analysis Panel */}
            {isLoading ? (
              <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center space-y-4 rounded-2xl bg-[#0b101d] border border-[#1e293b]">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="font-bold text-slate-300 text-sm">
                  Fetching Real Market Data & Computing SMC Structures for {selectedInstrument?.symbol}…
                </span>
                <span className="text-slate-500 text-xs">
                  Swings • Liquidity Pools • FVGs • Order Blocks • Dealing Ranges • AI Reasoning
                </span>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3 min-h-[560px]">
                <div className="xl:col-span-8 flex flex-col h-[560px] xl:h-auto min-h-[500px]">
                  <TradingChart
                    pipeline={pipelineResult}
                    quote={currentQuote || undefined}
                    dataStatus={dataStatus}
                    providerName={providerName}
                    lastUpdated={lastDataUpdate}
                    isRealTime={isRealTime}
                    errorMessage={marketErrorMessage}
                    onSelectConcept={handleOpenConcept}
                    replayIndex={isReplayMode ? replayIndex : undefined}
                  />
                </div>
                <div className="xl:col-span-4 flex flex-col h-[560px] xl:h-auto min-h-[500px]">
                  {analysis && selectedInstrument ? (
                    <AnalysisPanel
                      analysis={analysis}
                      instrument={selectedInstrument}
                      onCreateTradeIdea={handleCreateTradeIdea}
                      onSaveAnalysis={handleSaveAnalysis}
                      onSelectConcept={handleOpenConcept}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-[#0b101d] border border-[#1e293b] text-slate-500 text-xs">
                      <Shield className="w-8 h-8 text-slate-600 mb-2" />
                      <span>Analysis awaiting live market data feed</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Timeline */}
            {pipelineResult && (
              <AnalysisTimeline
                pipeline={pipelineResult}
                onSelectConcept={handleOpenConcept}
              />
            )}
          </>
        )}

        {/* Tab 2: Analysis History */}
        {activeTab === 'history' && <HistoryView />}

        {/* Tab 3: Learning Center */}
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
                    <span className="text-slate-500 text-xs group-hover:text-blue-400 transition-colors">Learn More →</span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                    {concept.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{concept.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <EducationalModal
        isOpen={isEducationOpen}
        onClose={() => setIsEducationOpen(false)}
        initialConceptId={selectedConceptId}
      />

      <VisionComparisonModal
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
        pipeline={pipelineResult}
      />

      {analysis && selectedInstrument && (
        <RiskCalculatorModal
          isOpen={isRiskOpen}
          onClose={() => setIsRiskOpen(false)}
          instrument={selectedInstrument}
          analysis={analysis}
          initialDirection={riskInitialDirection}
          riskSettings={userSettings?.riskSettings}
        />
      )}
    </div>
  );
}
