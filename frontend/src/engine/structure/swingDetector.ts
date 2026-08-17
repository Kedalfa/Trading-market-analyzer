import { Candle } from '@/types/market';
import { SwingPoint, SwingType } from '@/types/structure';

export interface SwingDetectionConfig {
  leftBars: number;       // Bars to the left required to be lower/higher
  rightBars: number;      // Bars to the right required to be lower/higher
  timeframe: string;
  isInternal?: boolean;   // Whether this is looking for internal micro-structure
}

export function detectSwingPoints(
  candles: Candle[],
  config: SwingDetectionConfig
): SwingPoint[] {
  const { leftBars, rightBars, timeframe, isInternal = false } = config;
  const swings: SwingPoint[] = [];

  if (candles.length < leftBars + rightBars + 1) {
    return swings;
  }

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const current = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    // Check left bars (must be strictly lower for high, strictly higher for low)
    for (let l = 1; l <= leftBars; l++) {
      if (candles[i - l].high >= current.high) isSwingHigh = false;
      if (candles[i - l].low <= current.low) isSwingLow = false;
    }

    // Check right bars
    for (let r = 1; r <= rightBars; r++) {
      if (candles[i + r].high > current.high) isSwingHigh = false;
      if (candles[i + r].low < current.low) isSwingLow = false;
    }

    const confirmIndex = i + rightBars;
    const confirmTimestamp = candles[confirmIndex]?.timestamp || current.timestamp;

    if (isSwingHigh) {
      swings.push({
        id: `swing-high-${timeframe}-${i}-${current.timestamp}`,
        index: i,
        timestamp: current.timestamp,
        price: current.high,
        type: 'HIGH',
        timeframe,
        strength: leftBars,
        isInternal,
        confirmed: true,
        confirmationIndex: confirmIndex,
        confirmationTimestamp: confirmTimestamp,
        leftBars,
        rightBars,
      });
    }

    if (isSwingLow) {
      swings.push({
        id: `swing-low-${timeframe}-${i}-${current.timestamp}`,
        index: i,
        timestamp: current.timestamp,
        price: current.low,
        type: 'LOW',
        timeframe,
        strength: leftBars,
        isInternal,
        confirmed: true,
        confirmationIndex: confirmIndex,
        confirmationTimestamp: confirmTimestamp,
        leftBars,
        rightBars,
      });
    }
  }

  // Label HH, HL, LH, LL only by comparing against confirmed previous swing of the same type
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;

  for (const swing of swings) {
    if (swing.type === 'HIGH') {
      if (lastHigh) {
        swing.subType = swing.price > lastHigh.price ? 'HH' : 'LH';
      }
      lastHigh = swing;
    } else {
      if (lastLow) {
        swing.subType = swing.price > lastLow.price ? 'HL' : 'LL';
      }
      lastLow = swing;
    }
  }

  return swings;
}
