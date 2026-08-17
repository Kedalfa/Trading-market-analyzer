import { Candle } from '../../types/market';
import { SwingPoint } from '../../types/structure';
import { LiquidityPool, LiquidityType, SweepStatus } from '../../types/smc';

export interface LiquidityEngineOptions {
  tolerancePercent?: number; // Tolerance for Equal Highs/Lows (e.g. 0.08%)
  maxLookbackBars?: number;
}

export function detectLiquidityPools(
  candles: Candle[],
  swings: SwingPoint[],
  timeframe: string,
  options: LiquidityEngineOptions = {}
): LiquidityPool[] {
  const { tolerancePercent = 0.08, maxLookbackBars = 200 } = options;
  const pools: LiquidityPool[] = [];

  if (candles.length < 5) return pools;

  const relevantCandles = candles.slice(-maxLookbackBars);
  const currentPrice = candles[candles.length - 1].close;

  // 1. Detect Equal Highs (EQH)
  const highSwings = swings.filter(s => s.type === 'HIGH').slice(-15);
  for (let i = 0; i < highSwings.length; i++) {
    for (let j = i + 1; j < highSwings.length; j++) {
      const s1 = highSwings[i];
      const s2 = highSwings[j];
      const diffPct = (Math.abs(s1.price - s2.price) / s1.price) * 100;

      if (diffPct <= tolerancePercent) {
        const avgPrice = (s1.price + s2.price) / 2;
        pools.push({
          id: `eqh-${s1.timestamp}-${s2.timestamp}`,
          type: 'EQH',
          direction: 'BUYSIDE',
          price: avgPrice,
          secondaryPrice: s2.price,
          timestamp: s2.timestamp,
          timeframe,
          status: 'IDENTIFIED',
          description: `Equal Highs (EQH) at ${avgPrice.toFixed(4)} (Double top buy-side liquidity pool)`
        });
      }
    }
  }

  // 2. Detect Equal Lows (EQL)
  const lowSwings = swings.filter(s => s.type === 'LOW').slice(-15);
  for (let i = 0; i < lowSwings.length; i++) {
    for (let j = i + 1; j < lowSwings.length; j++) {
      const s1 = lowSwings[i];
      const s2 = lowSwings[j];
      const diffPct = (Math.abs(s1.price - s2.price) / s1.price) * 100;

      if (diffPct <= tolerancePercent) {
        const avgPrice = (s1.price + s2.price) / 2;
        pools.push({
          id: `eql-${s1.timestamp}-${s2.timestamp}`,
          type: 'EQL',
          direction: 'SELLSIDE',
          price: avgPrice,
          secondaryPrice: s2.price,
          timestamp: s2.timestamp,
          timeframe,
          status: 'IDENTIFIED',
          description: `Equal Lows (EQL) at ${avgPrice.toFixed(4)} (Double bottom sell-side liquidity pool)`
        });
      }
    }
  }

  // 3. Detect Major Swing High/Low Liquidity Pools (BSL / SSL)
  for (const swing of swings.slice(-6)) {
    if (swing.type === 'HIGH') {
      pools.push({
        id: `bsl-${swing.id}`,
        type: 'BSL',
        direction: 'BUYSIDE',
        price: swing.price,
        timestamp: swing.timestamp,
        timeframe,
        status: 'IDENTIFIED',
        description: `Buy-Side Liquidity (BSL) resting above swing high ${swing.price.toFixed(4)}`
      });
    } else {
      pools.push({
        id: `ssl-${swing.id}`,
        type: 'SSL',
        direction: 'SELLSIDE',
        price: swing.price,
        timestamp: swing.timestamp,
        timeframe,
        status: 'IDENTIFIED',
        description: `Sell-Side Liquidity (SSL) resting below swing low ${swing.price.toFixed(4)}`
      });
    }
  }

  // 4. Calculate Previous Day High/Low (PDH / PDL) if daily bars or enough hourly bars exist
  if (candles.length >= 24) {
    const oneDayBars = Math.min(candles.length, 24 * 4); // roughly 1-2 days
    const pastBars = candles.slice(-oneDayBars, -1);
    const pdh = Math.max(...pastBars.map(c => c.high));
    const pdl = Math.min(...pastBars.map(c => c.low));

    pools.push({
      id: `pdh-${candles[candles.length - 1].timestamp}`,
      type: 'PDH',
      direction: 'BUYSIDE',
      price: pdh,
      timestamp: pastBars[0].timestamp,
      timeframe,
      status: 'IDENTIFIED',
      description: `Previous Day High (PDH) at ${pdh.toFixed(4)}`
    });

    pools.push({
      id: `pdl-${candles[candles.length - 1].timestamp}`,
      type: 'PDL',
      direction: 'SELLSIDE',
      price: pdl,
      timestamp: pastBars[0].timestamp,
      timeframe,
      status: 'IDENTIFIED',
      description: `Previous Day Low (PDL) at ${pdl.toFixed(4)}`
    });
  }

  // 5. Evaluate Sweep State for each pool against subsequent price action
  for (const pool of pools) {
    const originIndex = candles.findIndex(c => c.timestamp >= pool.timestamp);
    if (originIndex === -1) continue;

    for (let k = originIndex + 1; k < candles.length; k++) {
      const bar = candles[k];

      if (pool.direction === 'BUYSIDE') {
        if (bar.high > pool.price) {
          // Wick or body penetrated above liquidity
          pool.sweepCandleIndex = k;
          pool.sweepTimestamp = bar.timestamp;
          pool.sweepExtremePrice = bar.high;

          // Check if candle closed back BELOW the level (Classic rejection sweep)
          if (bar.close < pool.price) {
            // Check subsequent candle for displacement / confirmation
            const nextBar = candles[k + 1];
            if (nextBar && nextBar.close < bar.low) {
              pool.status = 'SWEPT_CONFIRMED';
              pool.description += ` — Swept & Confirmed with bearish displacement at ${bar.time.slice(0, 16)}`;
            } else {
              pool.status = 'SWEPT';
              pool.description += ` — Swept at ${bar.time.slice(0, 16)} (Monitoring for confirmation)`;
            }
          } else {
            // Closed above: might be continuation or invalidated level
            pool.status = 'SWEPT';
          }
        }
      } else { // SELLSIDE
        if (bar.low < pool.price) {
          pool.sweepCandleIndex = k;
          pool.sweepTimestamp = bar.timestamp;
          pool.sweepExtremePrice = bar.low;

          // Check if candle closed back ABOVE the level
          if (bar.close > pool.price) {
            const nextBar = candles[k + 1];
            if (nextBar && nextBar.close > bar.high) {
              pool.status = 'SWEPT_CONFIRMED';
              pool.description += ` — Swept & Confirmed with bullish displacement at ${bar.time.slice(0, 16)}`;
            } else {
              pool.status = 'SWEPT';
              pool.description += ` — Swept at ${bar.time.slice(0, 16)} (Monitoring for confirmation)`;
            }
          } else {
            pool.status = 'SWEPT';
          }
        }
      }
    }
  }

  return pools;
}
