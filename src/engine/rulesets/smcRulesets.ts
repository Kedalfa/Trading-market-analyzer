export interface StrategyRuleset {
  id: string;
  name: string;
  description: string;
  requiredConditions: string[];
  confirmationTriggers: string[];
  invalidationRules: string[];
  recommendedTimeframes: {
    htf: string;
    itf: string;
    ltf: string;
  };
}

export const STRATEGY_RULESETS: Record<string, StrategyRuleset> = {
  standard_smc: {
    id: 'standard_smc',
    name: 'Standard Smart Money Concepts (SMC)',
    description: 'Comprehensive structural analysis combining external swing structure, internal liquidity sweeps, Fair Value Gaps, and Order Blocks.',
    requiredConditions: [
      'Higher timeframe structural trend alignment (BOS confirmed by candle body close)',
      'Identified Buy-Side or Sell-Side liquidity pool',
      'Displacement candle exceeding 1.35x Average True Range (ATR)',
      'Valid unmitigated Fair Value Gap or active Order Block'
    ],
    confirmationTriggers: [
      'Lower timeframe Market Structure Shift (MSS) with candle body close',
      'Retracement into Premium/Discount equilibrium zone (>50% dealing range)',
      'Reaction candle rejecting Order Block / Consequent Encroachment of FVG'
    ],
    invalidationRules: [
      'Candle close violating the origin of the displacement move',
      'Structural break in opposing direction on intermediate timeframe',
      'Complete fill and close beyond the protective Order Block'
    ],
    recommendedTimeframes: {
      htf: '4H',
      itf: '1H',
      ltf: '15M'
    }
  },
  ict_2022: {
    id: 'ict_2022',
    name: 'ICT 2022 Mentorship Model',
    description: 'Strict ICT setup: Liquidity sweep of session/key high-low, immediate Market Structure Shift (MSS) with displacement, entry at the Fair Value Gap (FVG).',
    requiredConditions: [
      'Liquidity pool (EQH/EQL, Session H/L, PDH/PDL) swept during London or NY session',
      'Aggressive displacement creating a clean 3-candle Fair Value Gap (FVG)',
      'Market Structure Shift (MSS) breaking previous swing point with impulse'
    ],
    confirmationTriggers: [
      'Price taps into the FVG (Consequent Encroachment 50% level)',
      'Clear draw on liquidity (untested opposing liquidity pool or FVG)'
    ],
    invalidationRules: [
      'Price closes beyond the swing high/low that caused the displacement',
      'No reaction inside the FVG zone'
    ],
    recommendedTimeframes: {
      htf: '1H',
      itf: '15M',
      ltf: '5M'
    }
  },
  htf_institutional: {
    id: 'htf_institutional',
    name: 'Higher-Timeframe Institutional Flow',
    description: 'Swing trading model focusing on Daily/4H dealing ranges, institutional order blocks, and discount/premium equilibrium.',
    requiredConditions: [
      'Price situated in deep Discount (<50%) for Longs or deep Premium (>50%) for Shorts',
      'Major Daily/4H Order Block untouched or tested with wick rejection',
      'Macro weekly trend alignment'
    ],
    confirmationTriggers: [
      '4H or 1H Change of Character (CHoCH)',
      'Clean volume expansion out of the institutional zone'
    ],
    invalidationRules: [
      'Daily candle close through the extreme of the 4H Order Block'
    ],
    recommendedTimeframes: {
      htf: '1D',
      itf: '4H',
      ltf: '1H'
    }
  }
};
