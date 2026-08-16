'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Candle, Instrument, RealQuote } from '@/types/market';
import { FullSMCPipelineResult } from '@/engine';
import { ChartDataFreshnessBadge } from './ChartDataFreshnessBadge';
import { 
  Eye, EyeOff, Layers, ZoomIn, ZoomOut, RotateCcw, 
  Info, TrendingUp, AlertTriangle, ShieldCheck, WifiOff,
  ChevronLeft, ChevronRight, MoveHorizontal, Sparkles, X, CheckCircle2
} from 'lucide-react';

export interface ChartLayerSettings {
  showSwings: boolean;
  showBOS: boolean;
  showCHoCH: boolean;
  showLiquidity: boolean;
  showFVG: boolean;
  showOrderBlocks: boolean;
  showDealingRange: boolean;
  showSessions: boolean;
  showVolume: boolean;
}

export interface SelectedStructureInfo {
  type: 'BOS' | 'MSS' | 'CHOCH' | 'FVG' | 'ORDER_BLOCK' | 'LIQUIDITY_SWEEP' | 'DEALING_RANGE' | 'SWING';
  title: string;
  direction?: 'BULLISH' | 'BEARISH';
  price?: number;
  priceTop?: number;
  priceBottom?: number;
  timeframe?: string;
  whyDetected: string;
  brokenLevel?: number;
  brokenStructureType?: string;
  confirmationTimestamp?: number;
  originTimestamp?: number;
  details: { label: string; value: string }[];
}

interface TradingChartProps {
  pipeline: FullSMCPipelineResult | null;
  quote?: RealQuote;
  dataStatus?: 'LIVE' | 'MARKET_CLOSED' | 'DELAYED' | 'UNAVAILABLE';
  providerName?: string;
  lastUpdated?: number;
  isRealTime?: boolean;
  errorMessage?: string;
  onSelectConcept?: (conceptId: string) => void;
  replayIndex?: number; // When in backtest replay mode
}

export function TradingChart({
  pipeline,
  quote,
  dataStatus = 'LIVE',
  providerName = 'Official Institutional Feed',
  lastUpdated = Date.now(),
  isRealTime = true,
  errorMessage,
  onSelectConcept,
  replayIndex,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [viewOffset, setViewOffset] = useState(0); // Offset in bars back into history
  const [visibleBarsCount, setVisibleBarsCount] = useState(80); // Zoom level
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructureInfo | null>(null);

  // Drag-to-Pan interaction state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const [layers, setLayers] = useState<ChartLayerSettings>({
    showSwings: true,
    showBOS: true,
    showCHoCH: true,
    showLiquidity: true,
    showFVG: true,
    showOrderBlocks: true,
    showDealingRange: true,
    showSessions: true,
    showVolume: true,
  });

  // Track window resizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(480, containerRef.current.clientHeight),
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter candles based on replayIndex if in backtest mode
  const activeCandles = useMemo(() => {
    if (!pipeline?.candles) return [];
    if (replayIndex !== undefined && replayIndex >= 0) {
      return pipeline.candles.slice(0, replayIndex + 1);
    }
    return pipeline.candles;
  }, [pipeline?.candles, replayIndex]);

  const maxOffset = useMemo(() => {
    return Math.max(0, activeCandles.length - visibleBarsCount);
  }, [activeCandles.length, visibleBarsCount]);

  // Clamp viewOffset when candles or zoom changes
  useEffect(() => {
    if (viewOffset > maxOffset) {
      setViewOffset(maxOffset);
    }
  }, [maxOffset, viewOffset]);

  // Slice visible window of candles based on offset and zoom
  const visibleCandles = useMemo(() => {
    if (activeCandles.length === 0) return [];
    const endIndex = activeCandles.length - viewOffset;
    const startIndex = Math.max(0, endIndex - visibleBarsCount);
    return activeCandles.slice(startIndex, endIndex);
  }, [activeCandles, viewOffset, visibleBarsCount]);

  // Calculate high/low price bounds for visible window with buffer
  const priceBounds = useMemo(() => {
    if (visibleCandles.length === 0) return { min: 0, max: 100 };
    let min = Infinity;
    let max = -Infinity;

    visibleCandles.forEach(c => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    });

    // Also include Order Block & FVG price extents if visible
    if (pipeline?.orderBlocks && layers.showOrderBlocks) {
      pipeline.orderBlocks.forEach(ob => {
        if (ob.bottomPrice < min) min = ob.bottomPrice;
        if (ob.topPrice > max) max = ob.topPrice;
      });
    }

    if (pipeline?.fairValueGaps && layers.showFVG) {
      pipeline.fairValueGaps.forEach(fvg => {
        if (fvg.bottom < min) min = fvg.bottom;
        if (fvg.top > max) max = fvg.top;
      });
    }

    const padding = (max - min) * 0.08 || 1;
    return { min: min - padding, max: max + padding };
  }, [visibleCandles, pipeline, layers.showOrderBlocks, layers.showFVG]);

  // Pixel mapping functions
  const chartWidth = Math.max(100, dimensions.width - 70); // Space for right Y-axis
  const chartHeight = Math.max(100, dimensions.height - 35); // Space for bottom X-axis
  const barWidth = Math.max(2, (chartWidth / visibleBarsCount) * 0.7);

  const priceToY = useCallback((p: number) => {
    const range = priceBounds.max - priceBounds.min;
    if (range <= 0) return chartHeight / 2;
    return chartHeight - ((p - priceBounds.min) / range) * chartHeight;
  }, [priceBounds, chartHeight]);

  const candleIndexToX = useCallback((timestamp: number) => {
    const idx = visibleCandles.findIndex(c => c.timestamp === timestamp);
    if (idx === -1) {
      if (visibleCandles.length === 0) return -100;
      if (timestamp < visibleCandles[0].timestamp) return -100;
      return chartWidth + 100;
    }
    const step = chartWidth / visibleBarsCount;
    return idx * step + step / 2;
  }, [visibleCandles, chartWidth, visibleBarsCount]);

  // Zoom controls
  const handleZoom = (delta: number) => {
    setVisibleBarsCount(prev => {
      const next = prev + delta;
      return Math.min(220, Math.max(25, next));
    });
  };

  const handleResetPan = () => {
    setViewOffset(0);
    setVisibleBarsCount(80);
    setSelectedStructure(null);
  };

  // Drag-to-Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startOffsetRef.current = viewOffset;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const step = chartWidth / visibleBarsCount;
    const barDelta = Math.round(deltaX / step);

    const newOffset = Math.min(maxOffset, Math.max(0, startOffsetRef.current + barDelta));
    setViewOffset(newOffset);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Touch Support for Mobile / Tablet Dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      startXRef.current = e.touches[0].clientX;
      startOffsetRef.current = viewOffset;
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - startXRef.current;
    const step = chartWidth / visibleBarsCount;
    const barDelta = Math.round(deltaX / step);

    const newOffset = Math.min(maxOffset, Math.max(0, startOffsetRef.current + barDelta));
    setViewOffset(newOffset);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const toggleLayer = (layer: keyof ChartLayerSettings) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (!pipeline || activeCandles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0b101d] rounded-2xl border border-[#1e293b] text-center space-y-4">
        <WifiOff className="w-12 h-12 text-slate-500 animate-pulse" />
        <h3 className="text-base font-bold text-slate-200">Awaiting Real Market Data Feed</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          {errorMessage || 'Connecting to live market data provider... Verified real-time ticks will render dynamically.'}
        </p>
      </div>
    );
  }

  const currentPrice = quote?.price || pipeline.lastPrice;
  const isForex = pipeline.instrument.assetClass === 'forex';
  const decimals = isForex ? 5 : 2;

  return (
    <div className="flex-1 flex flex-col bg-[#0b101d] rounded-2xl border border-[#1e293b] overflow-hidden shadow-2xl relative select-none">
      {/* 1. Live Data Freshness Badge Top Header */}
      <ChartDataFreshnessBadge
        instrument={pipeline.instrument}
        quote={quote}
        status={dataStatus}
        provider={providerName}
        lastUpdated={lastUpdated}
        isRealTime={isRealTime}
      />

      {/* 2. Layer Toggles Bar & Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-1.5 bg-[#090f1d] border-b border-[#1a2642] text-[11px] gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" /> Layers:
          </span>

          <button
            onClick={() => toggleLayer('showBOS')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showBOS ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            BOS
          </button>
          <button
            onClick={() => toggleLayer('showCHoCH')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showCHoCH ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            MSS / CHoCH
          </button>
          <button
            onClick={() => toggleLayer('showOrderBlocks')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showOrderBlocks ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Order Blocks
          </button>
          <button
            onClick={() => toggleLayer('showFVG')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showFVG ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            FVGs
          </button>
          <button
            onClick={() => toggleLayer('showLiquidity')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showLiquidity ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Liquidity
          </button>
          <button
            onClick={() => toggleLayer('showDealingRange')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showDealingRange ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Premium / Discount
          </button>
          <button
            onClick={() => toggleLayer('showSwings')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              layers.showSwings ? 'bg-pink-600/30 text-pink-300 border border-pink-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Swings
          </button>
        </div>

        {/* Pan Navigation & Zoom Buttons */}
        <div className="flex items-center gap-1">
          {viewOffset > 0 && (
            <span className="text-[10px] text-amber-400 font-mono font-semibold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50">
              Scrolled {viewOffset} bars back
            </span>
          )}

          <button
            onClick={() => setViewOffset(prev => Math.min(maxOffset, prev + 15))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Scroll Left (Earlier in History)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setViewOffset(prev => Math.max(0, prev - 15))}
            disabled={viewOffset === 0}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Scroll Right (Latest Bars)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetPan}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Reset Pan & Zoom to Live"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            onClick={() => handleZoom(-15)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom In (Fewer Bars)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleZoom(15)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom Out (More Bars)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Main SVG Interactive Chart Area with Full Drag-to-Pan & Clickable Structures */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative flex-1 w-full bg-[#080d1a] overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <svg 
          width={dimensions.width} 
          height={dimensions.height}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="discountGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.01" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          {/* Grid Lines Horizontal */}
          {[0.2, 0.4, 0.6, 0.8].map((pct, i) => {
            const y = chartHeight * pct;
            const priceVal = priceBounds.max - pct * (priceBounds.max - priceBounds.min);
            return (
              <g key={`grid-h-${i}`}>
                <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.8" />
                <text x={chartWidth + 6} y={y + 3} fill="#64748b" fontSize="10" fontFamily="monospace">
                  {priceVal.toFixed(isForex ? 4 : 1)}
                </text>
              </g>
            );
          })}

          {/* Dealing Range & Premium / Discount Overlay */}
          {layers.showDealingRange && pipeline.dealingRange && (
            <g 
              className="cursor-pointer pointer-events-auto" 
              onClick={() => {
                if (!pipeline.dealingRange) return;
                setSelectedStructure({
                  type: 'DEALING_RANGE',
                  title: 'Dealing Range & Equilibrium (50%)',
                  timeframe: pipeline.timeframe,
                  whyDetected: `Calculated mathematical dealing range between HTF Swing High (${pipeline.dealingRange.rangeHigh.toFixed(decimals)}) and Swing Low (${pipeline.dealingRange.rangeLow.toFixed(decimals)}). Equilibrium (50%) is positioned at ${pipeline.dealingRange.equilibrium.toFixed(decimals)}. Current price is in the ${currentPrice >= pipeline.dealingRange.equilibrium ? 'PREMIUM (Sell-Side Bias)' : 'DISCOUNT (Buy-Side Bias)'} zone.`,
                  priceTop: pipeline.dealingRange.rangeHigh,
                  priceBottom: pipeline.dealingRange.rangeLow,
                  details: [
                    { label: 'Range High', value: pipeline.dealingRange.rangeHigh.toFixed(decimals) },
                    { label: 'Range Low', value: pipeline.dealingRange.rangeLow.toFixed(decimals) },
                    { label: 'Equilibrium (50%)', value: pipeline.dealingRange.equilibrium.toFixed(decimals) },
                    { label: 'Current Zone', value: currentPrice >= pipeline.dealingRange.equilibrium ? 'Premium (>50%)' : 'Discount (<50%)' },
                  ]
                });
              }}
            >
              <rect
                x="0"
                y={priceToY(pipeline.dealingRange.rangeHigh)}
                width={chartWidth}
                height={Math.max(2, priceToY(pipeline.dealingRange.equilibrium) - priceToY(pipeline.dealingRange.rangeHigh))}
                fill="url(#premiumGrad)"
                stroke="#ef4444"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <text x="12" y={priceToY(pipeline.dealingRange.rangeHigh) + 14} fill="#f87171" fontSize="10" fontWeight="bold">
                PREMIUM ZONE (Sell Side Bias)
              </text>

              <line
                x1="0"
                y1={priceToY(pipeline.dealingRange.equilibrium)}
                x2={chartWidth}
                y2={priceToY(pipeline.dealingRange.equilibrium)}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text x={chartWidth - 120} y={priceToY(pipeline.dealingRange.equilibrium) - 4} fill="#38bdf8" fontSize="10" fontWeight="bold">
                EQ 50% ({pipeline.dealingRange.equilibrium.toFixed(decimals)})
              </text>

              <rect
                x="0"
                y={priceToY(pipeline.dealingRange.equilibrium)}
                width={chartWidth}
                height={Math.max(2, priceToY(pipeline.dealingRange.rangeLow) - priceToY(pipeline.dealingRange.equilibrium))}
                fill="url(#discountGrad)"
                stroke="#10b981"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <text x="12" y={priceToY(pipeline.dealingRange.rangeLow) - 8} fill="#34d399" fontSize="10" fontWeight="bold">
                DISCOUNT ZONE (Buy Side Bias)
              </text>
            </g>
          )}

          {/* Fair Value Gaps (FVGs) */}
          {layers.showFVG && pipeline.fairValueGaps.map((fvg, fvgIdx) => {
            const isBull = fvg.type === 'BULLISH';
            const color = isBull ? '#10b981' : '#ef4444';
            const yTop = priceToY(fvg.top);
            const yBottom = priceToY(fvg.bottom);
            const height = Math.max(3, Math.abs(yBottom - yTop));
            const startX = candleIndexToX(fvg.timestamp);

            return (
              <g
                key={`fvg-${fvg.id}-${fvgIdx}`}
                className="cursor-pointer pointer-events-auto"
                onClick={() => setSelectedStructure({
                  type: 'FVG',
                  title: `${isBull ? '+FVG Bullish' : '-FVG Bearish'} Imbalance Zone`,
                  direction: fvg.type,
                  timeframe: pipeline.timeframe,
                  originTimestamp: fvg.timestamp,
                  priceTop: fvg.top,
                  priceBottom: fvg.bottom,
                  whyDetected: `A 3-candle displacement sequence created an unmitigated price imbalance between candle 1 wick (${fvg.bottom.toFixed(decimals)}) and candle 3 wick (${fvg.top.toFixed(decimals)}). Price departed impulsively without balance, leaving an institutional retest draw.`,
                  details: [
                    { label: 'Zone Range', value: `${fvg.bottom.toFixed(decimals)} — ${fvg.top.toFixed(decimals)}` },
                    { label: 'Formed At', value: `${new Date(fvg.timestamp * 1000).toUTCString()}` },
                    { label: 'Execution Timeframe', value: pipeline.timeframe },
                    { label: 'Status', value: fvg.isMitigated ? 'Mitigated' : 'Unmitigated (Active Draw)' },
                  ]
                })}
              >
                <rect
                  x={Math.max(0, startX)}
                  y={Math.min(yTop, yBottom)}
                  width={Math.max(10, chartWidth - startX)}
                  height={height}
                  fill={color}
                  fillOpacity={fvg.isMitigated ? 0.08 : 0.22}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray={fvg.isMitigated ? '2 2' : 'none'}
                />
                <text
                  x={Math.max(10, startX + 4)}
                  y={Math.min(yTop, yBottom) + 11}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                >
                  {isBull ? '+FVG' : '-FVG'} {fvg.isMitigated ? '(Mitigated)' : ''}
                </text>
              </g>
            );
          })}

          {/* Order Blocks */}
          {layers.showOrderBlocks && pipeline.orderBlocks.map((ob, obIdx) => {
            const isBull = ob.type === 'BULLISH';
            const color = isBull ? '#059669' : '#dc2626';
            const yTop = priceToY(ob.topPrice);
            const yBottom = priceToY(ob.bottomPrice);
            const height = Math.max(3, Math.abs(yBottom - yTop));
            const startX = candleIndexToX(ob.originTimestamp);

            return (
              <g
                key={`ob-${ob.id}-${obIdx}`}
                className="cursor-pointer pointer-events-auto"
                onClick={() => setSelectedStructure({
                  type: 'ORDER_BLOCK',
                  title: `${isBull ? 'Bullish Demand' : 'Bearish Supply'} Order Block`,
                  direction: ob.type,
                  timeframe: pipeline.timeframe,
                  originTimestamp: ob.originTimestamp,
                  priceTop: ob.topPrice,
                  priceBottom: ob.bottomPrice,
                  whyDetected: ob.classificationReason || `Identified as the last ${isBull ? 'bearish' : 'bullish'} candle body prior to an explosive institutional displacement leg that broke market structure. Serves as a primary institutional mitigation entry zone.`,
                  details: [
                    { label: 'Zone Range', value: `${ob.bottomPrice.toFixed(decimals)} — ${ob.topPrice.toFixed(decimals)}` },
                    { label: 'Origin Time', value: `${new Date(ob.originTimestamp * 1000).toUTCString()}` },
                    { label: 'Classification', value: ob.validityStatus },
                    { label: 'Mitigation Status', value: ob.isMitigated ? 'Mitigated' : 'Unmitigated (Fresh)' },
                  ]
                })}
              >
                <rect
                  x={Math.max(0, startX)}
                  y={Math.min(yTop, yBottom)}
                  width={Math.max(10, chartWidth - startX)}
                  height={height}
                  fill={color}
                  fillOpacity={ob.isMitigated ? 0.08 : 0.25}
                  stroke={color}
                  strokeWidth="1.2"
                  strokeDasharray={ob.isMitigated ? '3 2' : 'none'}
                />
                <text
                  x={Math.max(10, startX + 4)}
                  y={Math.min(yTop, yBottom) + 11}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                >
                  {isBull ? 'BULLISH OB' : 'BEARISH OB'} {ob.isMitigated ? '(Mitigated)' : ''}
                </text>
              </g>
            );
          })}

          {/* Liquidity Pools & Sweeps */}
          {layers.showLiquidity && pipeline.liquidityPools.map(pool => {
            const y = priceToY(pool.price);
            const isSwept = pool.status === 'SWEPT' || pool.status === 'SWEPT_CONFIRMED';
            const strokeColor = pool.direction === 'BUYSIDE' ? '#38bdf8' : '#f43f5e';

            return (
              <g
                key={pool.id}
                className="cursor-pointer pointer-events-auto"
                onClick={() => setSelectedStructure({
                  type: 'LIQUIDITY_SWEEP',
                  title: `${pool.direction === 'BUYSIDE' ? 'Buy-Side Liquidity (BSL)' : 'Sell-Side Liquidity (SSL)'} Pool`,
                  price: pool.price,
                  timeframe: pipeline.timeframe,
                  originTimestamp: pool.timestamp,
                  whyDetected: `Identified cluster of resting liquidity orders at ${pool.price.toFixed(decimals)}. ${isSwept ? 'Price previously swept this level with a wick excursion and reclaimed structure.' : 'Level remains un-swept and acts as a magnetic draw on liquidity.'}`,
                  details: [
                    { label: 'Pool Level', value: pool.price.toFixed(decimals) },
                    { label: 'Pool Classification', value: pool.type },
                    { label: 'Sweep Status', value: isSwept ? '⚡ Swept & Reclaimed' : '🎯 Active Liquidity Draw' },
                  ]
                })}
              >
                <line
                  x1="0"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke={strokeColor}
                  strokeWidth={isSwept ? '1.5' : '1'}
                  strokeDasharray={isSwept ? '4 2' : '2 2'}
                />
                <circle cx={chartWidth - 20} cy={y} r="3" fill={strokeColor} />
                <text
                  x="14"
                  y={y - 4}
                  fill={strokeColor}
                  fontSize="9"
                  fontWeight="bold"
                >
                  {pool.type} ({pool.price.toFixed(decimals)}) {isSwept ? '⚡ SWEPT' : 'POOL'}
                </text>
              </g>
            );
          })}

          {/* BOS & MSS / CHoCH Break of Structure Lines */}
          {(layers.showBOS || layers.showCHoCH) && pipeline.structure.breaks.map((brk, brkIdx) => {
            const isCHoCH = brk.breakType === 'CHOCH' || brk.breakType === 'MSS';
            if (isCHoCH && !layers.showCHoCH) return null;
            if (!isCHoCH && !layers.showBOS) return null;

            const swingX = candleIndexToX(brk.brokenSwing.timestamp);
            const breakX = candleIndexToX(brk.breakingTimestamp);
            const y = priceToY(brk.breakPrice);

            if (breakX < -50 || swingX > chartWidth + 50) return null;
            const color = brk.direction === 'BULLISH' ? '#10b981' : '#ef4444';

            return (
              <g 
                key={`break-${brk.id}-${brkIdx}`} 
                className="cursor-pointer pointer-events-auto"
                onClick={() => setSelectedStructure({
                  type: brk.breakType === 'MSS' ? 'MSS' : isCHoCH ? 'CHOCH' : 'BOS',
                  title: `${brk.direction} ${brk.breakType} (${pipeline.timeframe})`,
                  direction: brk.direction,
                  timeframe: pipeline.timeframe,
                  price: brk.breakPrice,
                  brokenLevel: brk.brokenSwing.price,
                  brokenStructureType: brk.brokenSwing.type === 'HIGH' ? 'Swing High' : 'Swing Low',
                  originTimestamp: brk.brokenSwing.timestamp,
                  confirmationTimestamp: brk.breakingTimestamp,
                  whyDetected: `${brk.direction} ${brk.breakType} was confirmed because the ${pipeline.timeframe} candle closed decisively ${brk.direction === 'BULLISH' ? 'above the previously confirmed Swing High' : 'below the previously confirmed Swing Low'} at ${brk.brokenSwing.price.toFixed(decimals)}.`,
                  details: [
                    { label: 'Broken Swing Level', value: brk.brokenSwing.price.toFixed(decimals) },
                    { label: 'Broken Structure', value: brk.brokenSwing.type === 'HIGH' ? 'Swing High (SH)' : 'Swing Low (SL)' },
                    { label: 'Confirmation Candle', value: `${new Date(brk.breakingTimestamp * 1000).toUTCString()}` },
                    { label: 'Confirmation Rule', value: 'Candle Body Close Beyond Structure' },
                    { label: 'Execution Timeframe', value: pipeline.timeframe },
                  ]
                })}
              >
                <line
                  x1={Math.max(0, swingX)}
                  y1={y}
                  x2={Math.min(chartWidth, breakX)}
                  y2={y}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={(swingX + breakX) / 2 - 22}
                  y={y - 9}
                  width={44}
                  height={16}
                  rx="3"
                  fill="#0e1526"
                  stroke={color}
                  strokeWidth="1"
                />
                <text
                  x={(swingX + breakX) / 2}
                  y={y + 3}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {brk.breakType}
                </text>
              </g>
            );
          })}

          {/* Visual Highlight Reference Lines for Selected Structure */}
          {selectedStructure?.originTimestamp && (
            <line
              x1={candleIndexToX(selectedStructure.originTimestamp)}
              y1={0}
              x2={candleIndexToX(selectedStructure.originTimestamp)}
              y2={chartHeight}
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.7"
            />
          )}

          {selectedStructure?.confirmationTimestamp && (
            <line
              x1={candleIndexToX(selectedStructure.confirmationTimestamp)}
              y1={0}
              x2={candleIndexToX(selectedStructure.confirmationTimestamp)}
              y2={chartHeight}
              stroke="#10b981"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.7"
            />
          )}

          {/* Genuine Candlesticks Layer */}
          {visibleCandles.map((c) => {
            const x = candleIndexToX(c.timestamp);
            const yOpen = priceToY(c.open);
            const yClose = priceToY(c.close);
            const yHigh = priceToY(c.high);
            const yLow = priceToY(c.low);

            const isBull = c.close >= c.open;
            const candleColor = isBull ? '#10b981' : '#ef4444';
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

            const isHighlighted = (selectedStructure?.originTimestamp === c.timestamp) || (selectedStructure?.confirmationTimestamp === c.timestamp);

            return (
              <g 
                key={`candle-${c.timestamp}`} 
                className="pointer-events-auto cursor-crosshair"
                onMouseEnter={() => setHoveredCandle(c)}
                onMouseLeave={() => setHoveredCandle(null)}
              >
                {isHighlighted && (
                  <rect
                    x={x - barWidth - 2}
                    y={yHigh - 4}
                    width={barWidth * 2 + 4}
                    height={Math.max(10, yLow - yHigh + 8)}
                    fill="#38bdf8"
                    fillOpacity="0.2"
                    stroke="#38bdf8"
                    strokeWidth="1"
                    rx="3"
                  />
                )}
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                <rect
                  x={x - barWidth / 2}
                  y={bodyTop}
                  width={barWidth}
                  height={bodyHeight}
                  fill={isBull ? '#10b981' : '#ef4444'}
                  stroke={candleColor}
                  strokeWidth="0.8"
                  rx="1"
                />
              </g>
            );
          })}

          {/* Swing High / Low Markers */}
          {layers.showSwings && pipeline.structure.swings.map(s => {
            const x = candleIndexToX(s.timestamp);
            if (x < 0 || x > chartWidth) return null;
            const y = priceToY(s.price);

            const isHigh = s.type === 'HIGH';
            const color = isHigh ? '#38bdf8' : '#f43f5e';

            return (
              <g 
                key={s.id} 
                className="pointer-events-auto cursor-pointer"
                onClick={() => setSelectedStructure({
                  type: 'SWING',
                  title: `Confirmed ${isHigh ? 'Swing High (SH)' : 'Swing Low (SL)'}`,
                  price: s.price,
                  timeframe: pipeline.timeframe,
                  originTimestamp: s.timestamp,
                  whyDetected: `Structural ${isHigh ? 'Swing High' : 'Swing Low'} was confirmed because the ${pipeline.timeframe} surrounding candles satisfy the multi-bar fractal pivot definition. Price reached ${s.price.toFixed(decimals)}.`,
                  details: [
                    { label: 'Pivot Price', value: s.price.toFixed(decimals) },
                    { label: 'Classification', value: s.subType || (isHigh ? 'Swing High (SH)' : 'Swing Low (SL)') },
                    { label: 'Confirmed At', value: `${new Date(s.timestamp * 1000).toUTCString()}` },
                    { label: 'Execution Timeframe', value: pipeline.timeframe },
                  ]
                })}
              >
                <circle cx={x} cy={y} r="3" fill={color} />
                <text
                  x={x}
                  y={isHigh ? y - 8 : y + 14}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {s.subType || (isHigh ? 'SH' : 'SL')}
                </text>
              </g>
            );
          })}

          {/* Live Price Tag Line on Right Axis */}
          <line
            x1="0"
            y1={priceToY(currentPrice)}
            x2={chartWidth}
            y2={priceToY(currentPrice)}
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <rect
            x={chartWidth}
            y={priceToY(currentPrice) - 10}
            width="68"
            height="20"
            fill="#10b981"
            rx="3"
          />
          <text
            x={chartWidth + 34}
            y={priceToY(currentPrice) + 4}
            fill="#080d1a"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {currentPrice.toFixed(isForex ? 4 : 1)}
          </text>
        </svg>

        {/* 4. Clickable SMC Structure Inspector Card (Anchored Over Chart) */}
        {selectedStructure && (
          <div className="absolute top-4 left-4 z-40 w-80 sm:w-96 p-4 rounded-xl bg-[#0e1628]/95 backdrop-blur-md border border-blue-500/50 shadow-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <strong className="text-white text-xs font-bold font-mono">
                  {selectedStructure.title}
                </strong>
              </div>
              <button
                onClick={() => setSelectedStructure(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                Why was this detected?
              </span>
              <p className="leading-relaxed text-[11px] bg-black/40 p-2.5 rounded-lg border border-slate-800/80">
                {selectedStructure.whyDetected}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {selectedStructure.details.map((d, i) => (
                <div key={i} className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">{d.label}</span>
                  <strong className="text-slate-200">{d.value}</strong>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
              <span>🎯 Origin & confirmation candles highlighted</span>
              <button
                onClick={() => setSelectedStructure(null)}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Hovered Candle HUD Tooltip */}
        {hoveredCandle && (
          <div className="absolute top-2 right-4 pointer-events-none p-2 rounded-lg bg-[#0e1628]/90 backdrop-blur-md border border-slate-800 text-[10px] font-mono flex items-center gap-3 text-slate-300 shadow-lg">
            <span>O: <strong className="text-white">{hoveredCandle.open.toFixed(decimals)}</strong></span>
            <span>H: <strong className="text-emerald-400">{hoveredCandle.high.toFixed(decimals)}</strong></span>
            <span>L: <strong className="text-rose-400">{hoveredCandle.low.toFixed(decimals)}</strong></span>
            <span>C: <strong className="text-white">{hoveredCandle.close.toFixed(decimals)}</strong></span>
            <span>T: <strong className="text-slate-400">{new Date(hoveredCandle.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
