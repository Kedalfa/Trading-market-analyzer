import { Candle } from '../../types/market';
import { FairValueGap, DisplacementMove } from '../../types/smc';

export interface FVGEngineOptions {
  minGapPipsMultiplier?: number; // Minimum gap threshold in terms of price %
  timeframe: string;
}

export function detectFairValueGaps(
  candles: Candle[],
  displacements: DisplacementMove[],
  options: FVGEngineOptions
): FairValueGap[] {
  const { timeframe, minGapPipsMultiplier = 0.0001 } = options;
  const fvgs: FairValueGap[] = [];

  if (candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Middle candle (the expansion/displacement candle)
    const c3 = candles[i];

    // 1. Bullish FVG: Gap between Candle 1 High and Candle 3 Low
    if (c3.low > c1.high) {
      const gapSize = c3.low - c1.high;
      const top = c3.low;
      const bottom = c1.high;
      const midpoint = (top + bottom) / 2;

      // Check if associated with displacement
      const isDisp = displacements.some(
        d => d.startIndex <= i - 1 && d.endIndex >= i - 1 && d.direction === 'BULLISH'
      );

      const fvg: FairValueGap = {
        id: `fvg-bull-${timeframe}-${c2.timestamp}`,
        type: 'BULLISH',
        top,
        bottom,
        midpoint,
        candle1Index: i - 2,
        candle2Index: i - 1,
        candle3Index: i,
        timestamp: c2.timestamp,
        timeframe,
        isMitigated: false,
        mitigationPercent: 0,
        isAssociatedWithDisplacement: isDisp,
        significance: isDisp ? 'HIGH' : gapSize / c2.open > 0.002 ? 'MEDIUM' : 'LOW'
      };

      // Check mitigation forward in time from candle i+1 to end
      for (let k = i + 1; k < candles.length; k++) {
        const futureBar = candles[k];
        if (futureBar.low <= top) {
          // Entered gap
          const penetration = top - futureBar.low;
          const pct = Math.min(100, Math.round((penetration / gapSize) * 100));
          fvg.mitigationPercent = Math.max(fvg.mitigationPercent, pct);

          if (futureBar.low <= bottom) {
            fvg.isMitigated = true;
            fvg.mitigationPercent = 100;
            fvg.mitigatedAtTimestamp = futureBar.timestamp;
            break;
          }
        }
      }

      fvgs.push(fvg);
    }

    // 2. Bearish FVG: Gap between Candle 1 Low and Candle 3 High
    if (c3.high < c1.low) {
      const gapSize = c1.low - c3.high;
      const top = c1.low;
      const bottom = c3.high;
      const midpoint = (top + bottom) / 2;

      const isDisp = displacements.some(
        d => d.startIndex <= i - 1 && d.endIndex >= i - 1 && d.direction === 'BEARISH'
      );

      const fvg: FairValueGap = {
        id: `fvg-bear-${timeframe}-${c2.timestamp}`,
        type: 'BEARISH',
        top,
        bottom,
        midpoint,
        candle1Index: i - 2,
        candle2Index: i - 1,
        candle3Index: i,
        timestamp: c2.timestamp,
        timeframe,
        isMitigated: false,
        mitigationPercent: 0,
        isAssociatedWithDisplacement: isDisp,
        significance: isDisp ? 'HIGH' : gapSize / c2.open > 0.002 ? 'MEDIUM' : 'LOW'
      };

      // Check mitigation forward in time
      for (let k = i + 1; k < candles.length; k++) {
        const futureBar = candles[k];
        if (futureBar.high >= bottom) {
          const penetration = futureBar.high - bottom;
          const pct = Math.min(100, Math.round((penetration / gapSize) * 100));
          fvg.mitigationPercent = Math.max(fvg.mitigationPercent, pct);

          if (futureBar.high >= top) {
            fvg.isMitigated = true;
            fvg.mitigationPercent = 100;
            fvg.mitigatedAtTimestamp = futureBar.timestamp;
            break;
          }
        }
      }

      fvgs.push(fvg);
    }
  }

  return fvgs;
}
