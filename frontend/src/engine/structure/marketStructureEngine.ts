import { Candle } from '@/types/market';
import { SwingPoint, StructureBreak, MarketStructureResult } from '@/types/structure';
import { detectSwingPoints } from './swingDetector';

export interface StructureEngineOptions {
  swingSensitivityHTF?: { left: number; right: number };
  swingSensitivityLTF?: { left: number; right: number };
  requireBodyClose?: boolean; // If true, only candle close beyond swing constitutes valid BOS/CHoCH
}

export function analyzeMarketStructure(
  candles: Candle[],
  timeframe: string,
  options: StructureEngineOptions = {}
): MarketStructureResult {
  const {
    swingSensitivityHTF = { left: 5, right: 5 },
    swingSensitivityLTF = { left: 2, right: 2 },
    requireBodyClose = true
  } = options;

  if (candles.length < 20) {
    return {
      timeframe,
      swings: [],
      breaks: [],
      currentTrend: 'RANGING',
      internalTrend: 'RANGING'
    };
  }

  // Detect External (Major) Swings
  const externalSwings = detectSwingPoints(candles, {
    leftBars: swingSensitivityHTF.left,
    rightBars: swingSensitivityHTF.right,
    timeframe,
    isInternal: false
  });

  // Detect Internal (Minor) Swings
  const internalSwings = detectSwingPoints(candles, {
    leftBars: swingSensitivityLTF.left,
    rightBars: swingSensitivityLTF.right,
    timeframe,
    isInternal: true
  });

  // Combine and sort by candle index
  const allSwings = [...externalSwings, ...internalSwings].sort((a, b) => a.index - b.index);

  // Track structure breaks (BOS, CHoCH, MSS)
  const breaks: StructureBreak[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
  let internalTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';

  // Process candles forward to detect structural breaks as they occur in time
  const activeSwings: SwingPoint[] = [];

  for (let cIdx = 0; cIdx < candles.length; cIdx++) {
    const candle = candles[cIdx];

    // Add newly confirmed external swings up to this point
    const confirmedNow = externalSwings.filter(s => s.index + swingSensitivityHTF.right === cIdx);
    activeSwings.push(...confirmedNow);

    // Look for breaks against the most recent significant high and low
    const recentHigh = [...activeSwings].reverse().find(s => s.type === 'HIGH');
    const recentLow = [...activeSwings].reverse().find(s => s.type === 'LOW');

    if (recentHigh && cIdx > recentHigh.index) {
      const isBreakByClose = candle.close > recentHigh.price;
      const isBreakByWick = candle.high > recentHigh.price;

      if ((requireBodyClose && isBreakByClose) || (!requireBodyClose && isBreakByWick)) {
        // Check if this break has already been recorded
        const alreadyBroken = breaks.some(b => b.brokenSwing.id === recentHigh.id);
        if (!alreadyBroken) {
          const isReversal = currentTrend === 'BEARISH';
          const breakType = isReversal ? 'CHOCH' : 'BOS';
          const isMSS = isReversal && (candle.close - candle.open) > (candle.high - candle.low) * 0.6; // Strong body

          breaks.push({
            id: `break-${breakType}-${candle.timestamp}`,
            breakType: isMSS ? 'MSS' : breakType,
            direction: 'BULLISH',
            brokenSwing: recentHigh,
            breakingCandleIndex: cIdx,
            breakingTimestamp: candle.timestamp,
            breakPrice: recentHigh.price,
            candleClosePrice: candle.close,
            isWickBreakOnly: !isBreakByClose && isBreakByWick,
            timeframe,
            confidence: isBreakByClose ? 90 : 60,
            description: `${breakType} Bullish: Price ${isBreakByClose ? 'closed above' : 'wicked through'} swing high at ${recentHigh.price.toFixed(4)}`
          });

          currentTrend = 'BULLISH';
        }
      }
    }

    if (recentLow && cIdx > recentLow.index) {
      const isBreakByClose = candle.close < recentLow.price;
      const isBreakByWick = candle.low < recentLow.price;

      if ((requireBodyClose && isBreakByClose) || (!requireBodyClose && isBreakByWick)) {
        const alreadyBroken = breaks.some(b => b.brokenSwing.id === recentLow.id);
        if (!alreadyBroken) {
          const isReversal = currentTrend === 'BULLISH';
          const breakType = isReversal ? 'CHOCH' : 'BOS';
          const isMSS = isReversal && (candle.open - candle.close) > (candle.high - candle.low) * 0.6;

          breaks.push({
            id: `break-${breakType}-${candle.timestamp}`,
            breakType: isMSS ? 'MSS' : breakType,
            direction: 'BEARISH',
            brokenSwing: recentLow,
            breakingCandleIndex: cIdx,
            breakingTimestamp: candle.timestamp,
            breakPrice: recentLow.price,
            candleClosePrice: candle.close,
            isWickBreakOnly: !isBreakByClose && isBreakByWick,
            timeframe,
            confidence: isBreakByClose ? 90 : 60,
            description: `${breakType} Bearish: Price ${isBreakByClose ? 'closed below' : 'wicked through'} swing low at ${recentLow.price.toFixed(4)}`
          });

          currentTrend = 'BEARISH';
        }
      }
    }
  }

  // Derive internal trend from the last 3 internal swings
  const last3Internal = internalSwings.slice(-3);
  if (last3Internal.length >= 2) {
    const last = last3Internal[last3Internal.length - 1];
    const prev = last3Internal[last3Internal.length - 2];
    if (last.price > prev.price && last.type === 'HIGH') {
      internalTrend = 'BULLISH';
    } else if (last.price < prev.price && last.type === 'LOW') {
      internalTrend = 'BEARISH';
    }
  }

  const lastBOS = [...breaks].reverse().find(b => b.breakType === 'BOS');
  const lastCHoCH = [...breaks].reverse().find(b => b.breakType === 'CHOCH');
  const lastMSS = [...breaks].reverse().find(b => b.breakType === 'MSS');

  return {
    timeframe,
    swings: externalSwings,
    breaks,
    currentTrend,
    lastBOS,
    lastCHoCH,
    lastMSS,
    internalTrend
  };
}
