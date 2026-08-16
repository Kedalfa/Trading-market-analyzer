import { Candle } from '@/types/market';
import { SwingPoint } from '@/types/structure';
import { DealingRange } from '@/types/smc';

export function calculateDealingRange(
  candles: Candle[],
  swings: SwingPoint[],
  timeframe: string
): DealingRange | null {
  if (candles.length === 0 || swings.length < 2) return null;

  const currentPrice = candles[candles.length - 1].close;

  // Find the most recent major swing high and swing low
  const recentHigh = [...swings].reverse().find(s => s.type === 'HIGH');
  const recentLow = [...swings].reverse().find(s => s.type === 'LOW');

  if (!recentHigh || !recentLow) return null;

  const rangeHigh = recentHigh.price;
  const rangeLow = recentLow.price;
  const diff = rangeHigh - rangeLow;

  if (diff <= 0) return null;

  const equilibrium = rangeLow + diff * 0.5;
  const oteLower = rangeLow + diff * 0.618;
  const oteUpper = rangeLow + diff * 0.786;

  let currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
  if (currentPrice > equilibrium + diff * 0.05) {
    currentZone = 'PREMIUM';
  } else if (currentPrice < equilibrium - diff * 0.05) {
    currentZone = 'DISCOUNT';
  }

  return {
    id: `range-${timeframe}-${recentHigh.timestamp}-${recentLow.timestamp}`,
    timeframe,
    rangeHigh,
    rangeLow,
    equilibrium,
    oteUpper,
    oteLower,
    currentZone,
    highSwing: recentHigh,
    lowSwing: recentLow
  };
}
