import { Candle } from '../../types/market';
import { SwingPoint, StructureBreak, MarketStructureResult } from '../../types/structure';
import { detectSwingPoints } from './swingDetector';

export interface StructureEngineOptions {
  swingSensitivityHTF?: { left: number; right: number };
  swingSensitivityLTF?: { left: number; right: number };
  requireBodyClose?: boolean; // If true, only candle close beyond swing constitutes valid BOS/CHoCH/MSS
}

export function analyzeMarketStructure(
  candles: Candle[],
  timeframe: string,
  options: StructureEngineOptions = {}
): MarketStructureResult {
  const {
    swingSensitivityHTF = { left: 4, right: 4 },
    swingSensitivityLTF = { left: 2, right: 2 },
    requireBodyClose = true,
  } = options;

  if (candles.length < 5) {
    return {
      timeframe,
      swings: [],
      breaks: [],
      currentTrend: 'RANGING',
      internalTrend: 'RANGING',
    };
  }

  // 1. Detect External (Major Structure) Swings
  const externalSwings = detectSwingPoints(candles, {
    leftBars: swingSensitivityHTF.left,
    rightBars: swingSensitivityHTF.right,
    timeframe,
    isInternal: false,
  });

  // 2. Detect Internal (Minor Micro-Structure) Swings
  const internalSwings = detectSwingPoints(candles, {
    leftBars: swingSensitivityLTF.left,
    rightBars: swingSensitivityLTF.right,
    timeframe,
    isInternal: true,
  });

  const breaks: StructureBreak[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
  let internalTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';

  // 3. Process candles chronologically forward (Zero Look-Ahead Bias)
  const confirmedSwings: SwingPoint[] = [];

  for (let cIdx = 0; cIdx < candles.length; cIdx++) {
    const candle = candles[cIdx];

    // Only make swings available for breaks once their right lookback bars have actually closed
    const newlyConfirmed = externalSwings.filter(s => (s.confirmationIndex ?? (s.index + swingSensitivityHTF.right)) === cIdx);
    confirmedSwings.push(...newlyConfirmed);

    // Active un-broken swing highs and lows
    const activeHighs = confirmedSwings.filter(s => s.type === 'HIGH' && !breaks.some(b => b.brokenSwing.id === s.id));
    const activeLows = confirmedSwings.filter(s => s.type === 'LOW' && !breaks.some(b => b.brokenSwing.id === s.id));

    const recentHigh = activeHighs[activeHighs.length - 1];
    const recentLow = activeLows[activeLows.length - 1];

    // ── Bullish Break Evaluation (Breaking Swing High) ────────────────
    if (recentHigh && cIdx > (recentHigh.confirmationIndex ?? recentHigh.index)) {
      const isBreakByClose = candle.close > recentHigh.price;
      const isBreakByWick = candle.high > recentHigh.price;
      const isValidBreak = requireBodyClose ? isBreakByClose : isBreakByWick;

      if (isValidBreak) {
        const candleRange = Math.max(0.00001, candle.high - candle.low);
        const bodySize = Math.max(0, candle.close - candle.open);
        const isDisplacementBody = (bodySize / candleRange) >= 0.55 && isBreakByClose;

        const isReversal = currentTrend === 'BEARISH';
        let breakType: 'BOS' | 'CHOCH' | 'MSS' = 'BOS';

        if (isReversal) {
          breakType = isDisplacementBody ? 'MSS' : 'CHOCH';
        } else {
          breakType = 'BOS';
        }

        breaks.push({
          id: `break-${breakType}-${candle.timestamp}`,
          breakType,
          direction: 'BULLISH',
          brokenSwing: recentHigh,
          breakingCandleIndex: cIdx,
          breakingTimestamp: candle.timestamp,
          breakPrice: recentHigh.price,
          candleClosePrice: candle.close,
          isWickBreakOnly: !isBreakByClose && isBreakByWick,
          timeframe,
          confidence: isBreakByClose ? (isDisplacementBody ? 95 : 85) : 60,
          description: `${breakType} Bullish: Price closed decisively above confirmed swing high (${recentHigh.price.toFixed(4)}) with ${isDisplacementBody ? 'strong institutional displacement' : 'structural break'}.`,
        });

        currentTrend = 'BULLISH';
      }
    }

    // ── Bearish Break Evaluation (Breaking Swing Low) ─────────────────
    if (recentLow && cIdx > (recentLow.confirmationIndex ?? recentLow.index)) {
      const isBreakByClose = candle.close < recentLow.price;
      const isBreakByWick = candle.low < recentLow.price;
      const isValidBreak = requireBodyClose ? isBreakByClose : isBreakByWick;

      if (isValidBreak) {
        const candleRange = Math.max(0.00001, candle.high - candle.low);
        const bodySize = Math.max(0, candle.open - candle.close);
        const isDisplacementBody = (bodySize / candleRange) >= 0.55 && isBreakByClose;

        const isReversal = currentTrend === 'BULLISH';
        let breakType: 'BOS' | 'CHOCH' | 'MSS' = 'BOS';

        if (isReversal) {
          breakType = isDisplacementBody ? 'MSS' : 'CHOCH';
        } else {
          breakType = 'BOS';
        }

        breaks.push({
          id: `break-${breakType}-${candle.timestamp}`,
          breakType,
          direction: 'BEARISH',
          brokenSwing: recentLow,
          breakingCandleIndex: cIdx,
          breakingTimestamp: candle.timestamp,
          breakPrice: recentLow.price,
          candleClosePrice: candle.close,
          isWickBreakOnly: !isBreakByClose && isBreakByWick,
          timeframe,
          confidence: isBreakByClose ? (isDisplacementBody ? 95 : 85) : 60,
          description: `${breakType} Bearish: Price closed decisively below confirmed swing low (${recentLow.price.toFixed(4)}) with ${isDisplacementBody ? 'strong institutional displacement' : 'structural break'}.`,
        });

        currentTrend = 'BEARISH';
      }
    }
  }

  // 4. Derive Internal Trend from the last 3 internal swings
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
    internalTrend,
  };
}
