'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Candle, Instrument, RealQuote } from '@/types/market';
import { FullSMCPipelineResult } from '@/engine';
import { ChartDataFreshnessBadge } from './ChartDataFreshnessBadge';
import { 
  Eye, EyeOff, Layers, ZoomIn, ZoomOut, RotateCcw, 
  Info, TrendingUp, AlertTriangle, ShieldCheck, WifiOff 
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
  const [viewOffset, setViewOffset] = useState(0);
  const [visibleBarsCount, setVisibleBarsCount] = useState(80);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

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

  // Sliced visible candles for viewport
  const visibleCandles = useMemo(() => {
    const total = activeCandles.length;
    const end = Math.max(visibleBarsCount, total - viewOffset);
    const start = Math.max(0, end - visibleBarsCount);
    return activeCandles.slice(start, end);
  }, [activeCandles, visibleBarsCount, viewOffset]);

  // Calculate price bounds for current visible viewport
  const priceBounds = useMemo(() => {
    if (visibleCandles.length === 0) return { min: 0, max: 100 };
    const min = Math.min(...visibleCandles.map(c => c.low));
    const max = Math.max(...visibleCandles.map(c => c.high));
    const padding = (max - min) * 0.08 || 1;
    return { min: min - padding, max: max + padding };
  }, [visibleCandles]);

  // Coordinate mapping utilities
  const chartHeight = dimensions.height - 60;
  const chartWidth = dimensions.width - 70;
  const barWidth = visibleCandles.length > 0 ? Math.max(3, (chartWidth / visibleCandles.length) * 0.7) : 4;
  const barSpacing = visibleCandles.length > 0 ? chartWidth / visibleCandles.length : 10;

  const priceToY = (price: number) => {
    const range = priceBounds.max - priceBounds.min;
    if (range === 0) return chartHeight / 2;
    return chartHeight - ((price - priceBounds.min) / range) * chartHeight;
  };

  const candleIndexToX = (candleTimestamp: number) => {
    const idx = visibleCandles.findIndex(c => c.timestamp === candleTimestamp);
    if (idx === -1) {
      if (visibleCandles.length === 0) return -100;
      const firstTs = visibleCandles[0].timestamp;
      const lastTs = visibleCandles[visibleCandles.length - 1].timestamp;
      if (candleTimestamp < firstTs) return -50;
      if (candleTimestamp > lastTs) return chartWidth + 50;
      return -50;
    }
    return idx * barSpacing + barSpacing / 2;
  };

  const handleZoom = (delta: number) => {
    setVisibleBarsCount(prev => Math.min(200, Math.max(25, prev + delta)));
  };

  const toggleLayer = (key: keyof ChartLayerSettings) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // If no pipeline / market data is unavailable:
  if (!pipeline || activeCandles.length === 0) {
    return (
      <div className="flex flex-col h-full w-full bg-[#0b101d] rounded-xl border border-[#1e293b] overflow-hidden items-center justify-center p-8 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-300">
          <WifiOff className="w-10 h-10 mx-auto mb-2 text-rose-400 animate-pulse" />
          <h3 className="text-base font-bold text-white">Live Market Data Unavailable</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            {errorMessage || 'Unable to establish authoritative live feed connection. Production charts do NOT substitute fake data.'}
          </p>
        </div>
      </div>
    );
  }

  const isForex = pipeline.instrument.assetClass === 'forex';
  const currentPrice = quote?.price ?? pipeline.lastPrice;

  return (
    <div className="flex flex-col h-full w-full bg-[#0b101d] rounded-xl border border-[#1e293b] overflow-hidden select-none">
      {/* 1. Real-Time Data Freshness & Quote Header */}
      <ChartDataFreshnessBadge
        instrument={pipeline.instrument}
        quote={quote}
        status={dataStatus}
        provider={providerName}
        lastUpdated={lastUpdated}
        isRealTime={isRealTime}
      />

      {/* 2. Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#0e1628] border-b border-[#1e293b] gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wide text-base">{pipeline.instrument.symbol}</span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {pipeline.timeframe}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Current Live Price Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Live Price:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {currentPrice.toFixed(isForex ? 5 : 2)}
            </span>
          </div>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => toggleLayer('showBOS')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              layers.showBOS ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            BOS/MSS
          </button>
          <button
            onClick={() => toggleLayer('showLiquidity')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              layers.showLiquidity ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Liquidity Pools
          </button>
          <button
            onClick={() => toggleLayer('showFVG')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              layers.showFVG ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            FVG Imbalance
          </button>
          <button
            onClick={() => toggleLayer('showOrderBlocks')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              layers.showOrderBlocks ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Order Blocks
          </button>
          <button
            onClick={() => toggleLayer('showDealingRange')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              layers.showDealingRange ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'bg-slate-800/40 text-slate-400'
            }`}
          >
            Premium/Discount
          </button>
          <button
            onClick={() => toggleLayer('showSwings')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              layers.showSwings ? 'bg-slate-700 text-slate-200' : 'bg-slate-800/40 text-slate-500'
            }`}
          >
            Swings
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={() => handleZoom(-15)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(15)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Main SVG Interactive Chart Area */}
      <div 
        ref={containerRef}
        className="relative flex-1 w-full bg-[#080d1a] cursor-crosshair overflow-hidden"
      >
        <svg 
          width={dimensions.width} 
          height={dimensions.height}
          className="absolute inset-0 w-full h-full"
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
            <g className="cursor-pointer" onClick={() => onSelectConcept?.('premium_discount')}>
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
              <text x={chartWidth - 110} y={priceToY(pipeline.dealingRange.equilibrium) - 4} fill="#38bdf8" fontSize="10" fontWeight="bold">
                EQ 50% ({pipeline.dealingRange.equilibrium.toFixed(isForex ? 4 : 2)})
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

          {/* Fair Value Gaps (FVG) */}
          {layers.showFVG && pipeline.fairValueGaps.map(fvg => {
            const startX = candleIndexToX(fvg.timestamp);
            if (startX < -100 || startX > chartWidth + 50) return null;

            const yTop = priceToY(fvg.top);
            const yBottom = priceToY(fvg.bottom);
            const height = Math.max(3, yBottom - yTop);
            const fvgWidth = Math.min(chartWidth - startX, 220);

            const isBull = fvg.type === 'BULLISH';
            const color = isBull ? '#10b981' : '#ef4444';
            const fillColor = isBull ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

            return (
              <g 
                key={fvg.id} 
                className="cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onSelectConcept?.('fvg')}
              >
                <rect
                  x={startX}
                  y={yTop}
                  width={fvgWidth}
                  height={height}
                  fill={fillColor}
                  stroke={color}
                  strokeWidth={fvg.isMitigated ? '0.6' : '1.2'}
                  strokeDasharray={fvg.isMitigated ? '3 3' : 'none'}
                />
                <line
                  x1={startX}
                  y1={priceToY(fvg.midpoint)}
                  x2={startX + fvgWidth}
                  y2={priceToY(fvg.midpoint)}
                  stroke={color}
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                  opacity="0.7"
                />
                <text
                  x={startX + 6}
                  y={yTop + 12}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                >
                  {isBull ? '+FVG' : '-FVG'} {fvg.isMitigated ? `(${fvg.mitigationPercent}% Mitigated)` : 'Active'}
                </text>
              </g>
            );
          })}

          {/* Institutional Order Blocks */}
          {layers.showOrderBlocks && pipeline.orderBlocks.map(ob => {
            const startX = candleIndexToX(ob.originTimestamp);
            if (startX < -100 || startX > chartWidth + 50) return null;

            const yTop = priceToY(ob.topPrice);
            const yBottom = priceToY(ob.bottomPrice);
            const height = Math.max(3, yBottom - yTop);
            const obWidth = Math.min(chartWidth - startX, 240);

            const isBull = ob.type === 'BULLISH';
            const color = ob.isBreaker ? '#f59e0b' : isBull ? '#8b5cf6' : '#ec4899';
            const fillColor = ob.isBreaker 
              ? 'rgba(245, 158, 11, 0.18)' 
              : isBull ? 'rgba(139, 92, 246, 0.18)' : 'rgba(236, 72, 153, 0.18)';

            return (
              <g 
                key={ob.id} 
                className="cursor-pointer hover:opacity-90"
                onClick={() => onSelectConcept?.('orderblock')}
              >
                <rect
                  x={startX}
                  y={yTop}
                  width={obWidth}
                  height={height}
                  fill={fillColor}
                  stroke={color}
                  strokeWidth="1.2"
                />
                <text
                  x={startX + 6}
                  y={yTop + 12}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                >
                  {ob.isBreaker ? 'BREAKER BLOCK' : isBull ? '+OB (Demand)' : '-OB (Supply)'}
                </text>
              </g>
            );
          })}

          {/* Liquidity Pools & Sweeps */}
          {layers.showLiquidity && pipeline.liquidityPools.map(pool => {
            const y = priceToY(pool.price);
            if (y < 0 || y > chartHeight) return null;

            const isSwept = pool.status === 'SWEPT' || pool.status === 'SWEPT_CONFIRMED';
            const strokeColor = isSwept ? '#f59e0b' : pool.direction === 'BUYSIDE' ? '#38bdf8' : '#fb7185';

            return (
              <g 
                key={pool.id} 
                className="cursor-pointer"
                onClick={() => onSelectConcept?.('liquidity_sweep')}
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
                  {pool.type} ({pool.price.toFixed(isForex ? 4 : 2)}) {isSwept ? '⚡ SWEPT' : 'POOL'}
                </text>
              </g>
            );
          })}

          {/* BOS & CHoCH Structure Break Lines */}
          {(layers.showBOS || layers.showCHoCH) && pipeline.structure.breaks.map(brk => {
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
                key={brk.id} 
                className="cursor-pointer"
                onClick={() => onSelectConcept?.(brk.breakType === 'MSS' ? 'mss' : isCHoCH ? 'choch' : 'bos')}
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
                  x={(swingX + breakX) / 2 - 20}
                  y={y - 9}
                  width="40"
                  height="16"
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

          {/* Genuine Candlesticks Layer */}
          {visibleCandles.map((c, i) => {
            const x = i * barSpacing + barSpacing / 2;
            const yOpen = priceToY(c.open);
            const yClose = priceToY(c.close);
            const yHigh = priceToY(c.high);
            const yLow = priceToY(c.low);

            const isBull = c.close >= c.open;
            const candleColor = isBull ? '#10b981' : '#ef4444';
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

            return (
              <g 
                key={`candle-${c.timestamp}`} 
                onMouseEnter={() => setHoveredCandle(c)}
                onMouseLeave={() => setHoveredCandle(null)}
              >
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
              <g key={s.id}>
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
            x={chartWidth + 6}
            y={priceToY(currentPrice) + 4}
            fill="#ffffff"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {currentPrice.toFixed(isForex ? 5 : 2)}
          </text>
        </svg>

        {/* Hovered Candlestick Info Box */}
        {hoveredCandle && (
          <div className="absolute top-3 left-3 bg-[#0e1628]/95 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-3 text-slate-300 backdrop-blur z-20">
            <span>T: {new Date(hoveredCandle.timestamp * 1000).toLocaleTimeString()}</span>
            <span>O: <strong className="text-white">{hoveredCandle.open}</strong></span>
            <span>H: <strong className="text-emerald-400">{hoveredCandle.high}</strong></span>
            <span>L: <strong className="text-rose-400">{hoveredCandle.low}</strong></span>
            <span>C: <strong className="text-white">{hoveredCandle.close}</strong></span>
            <span>V: <strong className="text-blue-400">{hoveredCandle.volume}</strong></span>
          </div>
        )}
      </div>

      {/* 4. Bottom Status / Sessions Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#090e1a] border-t border-[#1e293b] text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <strong className="text-slate-200">Data Feed:</strong> {providerName}
          </span>
          <span className="text-slate-500">|</span>
          <span>Bars: <strong className="text-slate-300">{visibleCandles.length}</strong></span>
          <span>FVGs: <strong className="text-slate-300">{pipeline.fairValueGaps.length}</strong></span>
          <span>Order Blocks: <strong className="text-slate-300">{pipeline.orderBlocks.length}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          {pipeline.sessionStatus.currentSessions.filter(s => s.isActive).map(sess => (
            <span key={sess.name} className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[11px] font-medium">
              {sess.displayName}
            </span>
          ))}
          {pipeline.sessionStatus.activeOverlap && (
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
              London/NY Overlap
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
