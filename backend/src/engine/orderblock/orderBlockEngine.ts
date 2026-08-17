import { Candle } from '../../types/market';
import { OrderBlock, DisplacementMove } from '../../types/smc';
import { StructureBreak } from '../../types/structure';

export function detectOrderBlocks(
  candles: Candle[],
  displacements: DisplacementMove[],
  breaks: StructureBreak[],
  timeframe: string
): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  const seenOriginTimestamps = new Set<string>();

  if (candles.length < 5) return orderBlocks;

  for (let dIdx = 0; dIdx < displacements.length; dIdx++) {
    const disp = displacements[dIdx];
    const startIndex = disp.startIndex;
    if (startIndex < 1) continue;

    // Look back 1-3 candles before displacement for origin institutional accumulation/distribution candle
    if (disp.direction === 'BULLISH') {
      // Find last bearish candle before upward displacement
      let originIdx = startIndex - 1;
      while (originIdx >= 0 && candles[originIdx].close > candles[originIdx].open && startIndex - originIdx < 3) {
        originIdx--;
      }

      if (originIdx >= 0) {
        const origin = candles[originIdx];
        const originKey = `bull-${origin.timestamp}`;

        // Deduplicate order blocks originating from the exact same candle
        if (seenOriginTimestamps.has(originKey)) continue;
        seenOriginTimestamps.add(originKey);

        const topPrice = Math.max(origin.open, origin.close, origin.high);
        const bottomPrice = origin.low;

        // Check if there is an associated structure break near this displacement
        const assocBreak = breaks.find(
          b => b.direction === 'BULLISH' && b.breakingTimestamp >= disp.startTimestamp
        );

        const ob: OrderBlock = {
          id: `ob-bull-${timeframe}-${origin.timestamp}-${dIdx}`,
          type: 'BULLISH',
          isBreaker: false,
          topPrice,
          bottomPrice,
          originCandleIndex: originIdx,
          originTimestamp: origin.timestamp,
          timeframe,
          isMitigated: false,
          touchCount: 0,
          associatedDisplacementIndex: startIndex,
          associatedStructureBreak: assocBreak,
          validityStatus: 'ACTIVE',
          classificationReason: `Last down-close candle before ${disp.priceChangePercent}% bullish displacement ${assocBreak ? 'that produced ' + assocBreak.breakType : ''}`
        };

        // Evaluate mitigation / breaker status forward in time
        for (let k = disp.endIndex + 1; k < candles.length; k++) {
          const bar = candles[k];
          if (bar.low <= topPrice && bar.low >= bottomPrice) {
            ob.touchCount++;
            ob.isMitigated = true;
            ob.mitigationTimestamp = bar.timestamp;
            ob.validityStatus = 'MITIGATED';
          } else if (bar.close < bottomPrice) {
            // Violated: turns into Bearish Breaker Block
            ob.validityStatus = 'BREAKER';
            ob.isBreaker = true;
            ob.classificationReason += ' (Failed support transformed into Bearish Breaker)';
            break;
          }
        }

        orderBlocks.push(ob);
      }
    } else { // BEARISH DISPLACEMENT
      let originIdx = startIndex - 1;
      while (originIdx >= 0 && candles[originIdx].close < candles[originIdx].open && startIndex - originIdx < 3) {
        originIdx--;
      }

      if (originIdx >= 0) {
        const origin = candles[originIdx];
        const originKey = `bear-${origin.timestamp}`;

        // Deduplicate order blocks originating from the exact same candle
        if (seenOriginTimestamps.has(originKey)) continue;
        seenOriginTimestamps.add(originKey);

        const topPrice = origin.high;
        const bottomPrice = Math.min(origin.open, origin.close, origin.low);

        const assocBreak = breaks.find(
          b => b.direction === 'BEARISH' && b.breakingTimestamp >= disp.startTimestamp
        );

        const ob: OrderBlock = {
          id: `ob-bear-${timeframe}-${origin.timestamp}-${dIdx}`,
          type: 'BEARISH',
          isBreaker: false,
          topPrice,
          bottomPrice,
          originCandleIndex: originIdx,
          originTimestamp: origin.timestamp,
          timeframe,
          isMitigated: false,
          touchCount: 0,
          associatedDisplacementIndex: startIndex,
          associatedStructureBreak: assocBreak,
          validityStatus: 'ACTIVE',
          classificationReason: `Last up-close candle before ${disp.priceChangePercent}% bearish displacement ${assocBreak ? 'that produced ' + assocBreak.breakType : ''}`
        };

        for (let k = disp.endIndex + 1; k < candles.length; k++) {
          const bar = candles[k];
          if (bar.high >= bottomPrice && bar.high <= topPrice) {
            ob.touchCount++;
            ob.isMitigated = true;
            ob.mitigationTimestamp = bar.timestamp;
            ob.validityStatus = 'MITIGATED';
          } else if (bar.close > topPrice) {
            // Violated: turns into Bullish Breaker Block
            ob.validityStatus = 'BREAKER';
            ob.isBreaker = true;
            ob.classificationReason += ' (Failed resistance transformed into Bullish Breaker)';
            break;
          }
        }

        orderBlocks.push(ob);
      }
    }
  }

  return orderBlocks;
}
