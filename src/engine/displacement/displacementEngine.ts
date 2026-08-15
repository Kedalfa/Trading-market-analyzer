import { Candle } from '@/types/market';
import { DisplacementMove } from '@/types/smc';

export interface DisplacementEngineOptions {
  atrPeriod?: number;
  bodyRatioThreshold?: number;   // Minimum body / range ratio (e.g. 0.65)
  atrMultiplierThreshold?: number; // Minimum candle range / ATR ratio (e.g. 1.4x ATR)
}

// Calculate Average True Range
export function calculateATR(candles: Candle[], period = 14): number[] {
  const atrs: number[] = [];
  if (candles.length === 0) return atrs;

  const trs: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trs.push(tr);
  }

  // Simple Moving Average of True Range for initial ATR
  let sum = 0;
  for (let i = 0; i < trs.length; i++) {
    sum += trs[i];
    if (i >= period) {
      sum -= trs[i - period];
      atrs.push(sum / period);
    } else {
      atrs.push(sum / (i + 1));
    }
  }

  return atrs;
}

export function detectDisplacements(
  candles: Candle[],
  options: DisplacementEngineOptions = {}
): DisplacementMove[] {
  const {
    atrPeriod = 14,
    bodyRatioThreshold = 0.60,
    atrMultiplierThreshold = 1.35
  } = options;

  const displacements: DisplacementMove[] = [];
  if (candles.length < atrPeriod + 2) return displacements;

  const atrs = calculateATR(candles, atrPeriod);

  let i = 0;
  while (i < candles.length) {
    const c = candles[i];
    const atr = atrs[i] || (c.high - c.low);
    const range = c.high - c.low;
    const body = Math.abs(c.close - c.open);
    const bodyRatio = range > 0 ? body / range : 0;
    const isBullish = c.close > c.open;

    // Check if single candle satisfies displacement criteria
    if (range >= atr * atrMultiplierThreshold && bodyRatio >= bodyRatioThreshold) {
      let startIndex = i;
      let endIndex = i;
      let consecutive = 1;
      let totalBody = body;
      let totalRange = range;

      // Check for consecutive expansion in the same direction
      while (endIndex + 1 < candles.length) {
        const next = candles[endIndex + 1];
        const nextRange = next.high - next.low;
        const nextBody = Math.abs(next.close - next.open);
        const nextIsBullish = next.close > next.open;

        if (nextIsBullish === isBullish && nextBody / nextRange >= 0.5 && nextRange >= atr * 0.9) {
          endIndex++;
          consecutive++;
          totalBody += nextBody;
          totalRange += nextRange;
        } else {
          break;
        }
      }

      const startCandle = candles[startIndex];
      const endCandle = candles[endIndex];
      const priceChangePct = ((endCandle.close - startCandle.open) / startCandle.open) * 100;

      displacements.push({
        id: `disp-${startIndex}-${startCandle.timestamp}`,
        startIndex,
        endIndex,
        startTimestamp: startCandle.timestamp,
        endTimestamp: endCandle.timestamp,
        direction: isBullish ? 'BULLISH' : 'BEARISH',
        priceChangePercent: Number(priceChangePct.toFixed(2)),
        relativeVolatility: Number((totalRange / (atr * consecutive)).toFixed(2)),
        consecutiveCandles: consecutive,
        averageBodyPercent: Number(((totalBody / totalRange) * 100).toFixed(1)),
        associatedFVGIds: []
      });

      i = endIndex + 1;
    } else {
      i++;
    }
  }

  return displacements;
}
