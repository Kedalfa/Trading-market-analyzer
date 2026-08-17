/**
 * Deterministic Trade Setup Validator & Trading Integrity Engine (Frontend)
 * Authoritative pre-publish and pre-save gate for all SMC setups.
 */

export interface TradeSetupValidationInput {
  analysisId?: string;
  symbol: string;
  instrumentId: string;
  direction: 'BULLISH' | 'BEARISH' | string;
  currentPrice: number;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  invalidationPrice?: number;
  structuralEvidence?: string[];
  rulesetUsed?: string;
}

export interface TradeSetupValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  actualRR: number;
  geometryValid: boolean;
  structuralSLValid: boolean;
  structuralTPValid: boolean;
  instrumentSupported: boolean;
  timestamp: string;
}

export const ACTIVE_SUPPORTED_INSTRUMENTS = [
  'BTCUSDT',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'XAUUSD',
  'US500',
  'NAS100',
];

export const DEACTIVATED_INSTRUMENTS = ['ETHUSDT', 'SOLUSDT'];

export function validateTradeSetup(setup: TradeSetupValidationInput): TradeSetupValidationResult {
  const now = new Date().toISOString();
  const instClean = setup.instrumentId.replace(/[\/\-_]/g, '').toUpperCase();
  const dir = setup.direction?.toUpperCase();

  // 1. Supported Instrument Gate
  if (DEACTIVATED_INSTRUMENTS.includes(instClean)) {
    const reason = `SETUP_REJECTED: Instrument ${instClean} is currently deactivated from the live analysis universe.`;
    console.warn(`[TradeValidator] ${reason}`);
    return {
      isValid: false,
      rejectionReason: reason,
      actualRR: 0,
      geometryValid: false,
      structuralSLValid: false,
      structuralTPValid: false,
      instrumentSupported: false,
      timestamp: now,
    };
  }

  if (!ACTIVE_SUPPORTED_INSTRUMENTS.includes(instClean)) {
    const reason = `SETUP_REJECTED: Instrument ${instClean} is not in the supported active universe.`;
    console.warn(`[TradeValidator] ${reason}`);
    return {
      isValid: false,
      rejectionReason: reason,
      actualRR: 0,
      geometryValid: false,
      structuralSLValid: false,
      structuralTPValid: false,
      instrumentSupported: false,
      timestamp: now,
    };
  }

  // 2. Numerical Values Sanity
  const entry = Number(setup.entryPrice);
  const stop = Number(setup.stopLossPrice);
  const target = Number(setup.targetPrice);
  const current = Number(setup.currentPrice);
  const invalidation = setup.invalidationPrice != null ? Number(setup.invalidationPrice) : stop;

  if (isNaN(entry) || isNaN(stop) || isNaN(target) || entry <= 0 || stop <= 0 || target <= 0) {
    const reason = `SETUP_REJECTED: Malformed price levels (Entry: ${entry}, SL: ${stop}, TP: ${target}).`;
    console.warn(`[TradeValidator] ${reason}`);
    return {
      isValid: false,
      rejectionReason: reason,
      actualRR: 0,
      geometryValid: false,
      structuralSLValid: false,
      structuralTPValid: false,
      instrumentSupported: true,
      timestamp: now,
    };
  }

  // 3. Hard Directional Geometry Validation
  if (dir === 'BULLISH' || dir === 'LONG') {
    if (stop >= entry) {
      const reason = `SETUP_REJECTED: Bullish setup has Stop Loss (${stop}) >= Entry (${entry}). Expected SL < Entry.`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: false,
        structuralSLValid: false,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (target <= entry) {
      const reason = `SETUP_REJECTED: Bullish setup has Take Profit (${target}) <= Entry (${entry}). Expected TP > Entry.`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: false,
        structuralSLValid: true,
        structuralTPValid: false,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (invalidation > entry) {
      const reason = `SETUP_REJECTED: Bullish structural invalidation level (${invalidation}) is above Entry (${entry}).`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: true,
        structuralSLValid: false,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (current >= target) {
      const reason = `SETUP_REJECTED: Setup is stale/already completed (Current Price: ${current} >= TP: ${target}).`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: true,
        structuralSLValid: true,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (current <= stop) {
      const reason = `SETUP_REJECTED: Setup is already stopped out/invalidated (Current Price: ${current} <= SL: ${stop}).`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: true,
        structuralSLValid: true,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    // 4. Exact Unrounded Risk-to-Reward Calculation
    const rawRisk = entry - stop;
    const rawReward = target - entry;
    const preciseRisk = Math.round(rawRisk * 1e8);
    const preciseReward = Math.round(rawReward * 1e8);
    const actualRR = (preciseRisk > 0 && preciseReward > 0) ? (preciseReward / preciseRisk) : 0;

    if (actualRR < 1.9) {
      const reason = `SETUP_REJECTED: Calculated Risk-to-Reward ratio (${actualRR.toFixed(4)}R) is below the required minimum of 1.9R.`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR,
        geometryValid: true,
        structuralSLValid: true,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    return {
      isValid: true,
      actualRR,
      geometryValid: true,
      structuralSLValid: true,
      structuralTPValid: true,
      instrumentSupported: true,
      timestamp: now,
    };
  }

  if (dir === 'BEARISH' || dir === 'SHORT') {
    if (stop <= entry) {
      const reason = `SETUP_REJECTED: Bearish setup has Stop Loss (${stop}) <= Entry (${entry}). Expected SL > Entry.`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: false,
        structuralSLValid: false,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (target >= entry) {
      const reason = `SETUP_REJECTED: Bearish setup has Take Profit (${target}) >= Entry (${entry}). Expected TP < Entry.`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: false,
        structuralSLValid: true,
        structuralTPValid: false,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (invalidation < entry) {
      const reason = `SETUP_REJECTED: Bearish structural invalidation level (${invalidation}) is below Entry (${entry}).`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: true,
        structuralSLValid: false,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (current <= target) {
      const reason = `SETUP_REJECTED: Setup is stale/already completed (Current Price: ${current} <= TP: ${target}).`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: true,
        structuralSLValid: true,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    if (current >= stop) {
      const reason = `SETUP_REJECTED: Setup is already stopped out/invalidated (Current Price: ${current} >= SL: ${stop}).`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR: 0,
        geometryValid: true,
        structuralSLValid: true,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    // 4. Exact Unrounded Risk-to-Reward Calculation
    const rawRisk = stop - entry;
    const rawReward = entry - target;
    const preciseRisk = Math.round(rawRisk * 1e8);
    const preciseReward = Math.round(rawReward * 1e8);
    const actualRR = (preciseRisk > 0 && preciseReward > 0) ? (preciseReward / preciseRisk) : 0;

    if (actualRR < 1.9) {
      const reason = `SETUP_REJECTED: Calculated Risk-to-Reward ratio (${actualRR.toFixed(4)}R) is below the required minimum of 1.9R.`;
      console.warn(`[TradeValidator] ${reason}`);
      return {
        isValid: false,
        rejectionReason: reason,
        actualRR,
        geometryValid: true,
        structuralSLValid: true,
        structuralTPValid: true,
        instrumentSupported: true,
        timestamp: now,
      };
    }

    return {
      isValid: true,
      actualRR,
      geometryValid: true,
      structuralSLValid: true,
      structuralTPValid: true,
      instrumentSupported: true,
      timestamp: now,
    };
  }

  const reason = `SETUP_REJECTED: Invalid trade direction '${setup.direction}'. Must be BULLISH or BEARISH.`;
  console.warn(`[TradeValidator] ${reason}`);
  return {
    isValid: false,
    rejectionReason: reason,
    actualRR: 0,
    geometryValid: false,
    structuralSLValid: false,
    structuralTPValid: false,
    instrumentSupported: true,
    timestamp: now,
  };
}
