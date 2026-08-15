import { EducationalConcept } from '@/types/ai';

export const EDUCATIONAL_CONCEPTS: Record<string, EducationalConcept> = {
  bos: {
    id: 'bos',
    name: 'Break of Structure (BOS)',
    category: 'Structure',
    summary: 'A continuation signal where price breaks past a previous swing point in the direction of the dominant trend.',
    detailedExplanation: 'Break of Structure occurs when price creates a new swing extreme by closing beyond the prior swing high (in an uptrend) or swing low (in a downtrend). In institutional trading, a true BOS confirms that the dominant trend remains intact and that institutions are actively defending order blocks in the direction of order flow.',
    detectionFormula: 'Uptrend: Candle body close > Previous Swing High. Downtrend: Candle body close < Previous Swing Low.',
    tradingRules: [
      'Look for BOS only in the direction of the higher timeframe trend.',
      'Require a full candle body close beyond the swing point, not merely a wick.',
      'Expect price to pull back to an unmitigated FVG or Order Block after a BOS occurs.'
    ],
    invalidationRules: [
      'If price only wicks beyond the swing and promptly reverses, treat it as a liquidity sweep, not a BOS.',
      'If price fails to make a new high after a pullback, monitor for Change of Character (CHoCH).'
    ],
    commonMistakes: [
      'Mistaking internal structure breaks for major macro trend breaks.',
      'Entering immediately on the breakout rather than waiting for the discounted retracement.'
    ],
    visualDiagramType: 'bos'
  },
  choch: {
    id: 'choch',
    name: 'Change of Character (CHoCH)',
    category: 'Structure',
    summary: 'The earliest signal of a potential trend reversal, marked by the first structural break against the prevailing trend.',
    detailedExplanation: 'In a bullish trend, price creates Higher Highs and Higher Lows. A CHoCH happens when price breaks the most recent Higher Low for the first time. Conversely, in a downtrend, a CHoCH happens when price breaks the most recent Lower High. It signals that institutional order flow has shifted.',
    detectionFormula: 'Bullish Reversal: First candle close above the last Lower High. Bearish Reversal: First candle close below the last Higher Low.',
    tradingRules: [
      'A CHoCH on a lower timeframe (e.g. 5M/15M) inside a higher timeframe (e.g. 4H) key zone provides high-probability trade confirmation.',
      'Always verify if the move prior to CHoCH took major liquidity (swept highs or lows).'
    ],
    invalidationRules: [
      'If price immediately re-breaks in the original trend direction, the CHoCH was a false alarm or stop hunt.'
    ],
    commonMistakes: [
      'Trading CHoCH in the middle of nowhere without higher-timeframe confluence.'
    ],
    visualDiagramType: 'choch'
  },
  mss: {
    id: 'mss',
    name: 'Market Structure Shift (MSS)',
    category: 'Structure',
    summary: 'An aggressive, impulsive structural shift accompanied by clear displacement candles and Fair Value Gaps.',
    detailedExplanation: 'While CHoCH marks any initial break, a Market Structure Shift (MSS) specifically demands institutional displacement (large energetic candles, high volume, and imbalance/FVGs). It is the cornerstone of the ICT 2022 entry model.',
    detectionFormula: 'CHoCH + Average Candle Body > 60% of range + creation of a 3-candle Fair Value Gap.',
    tradingRules: [
      'Wait for the MSS displacement to finish, then set a limit order inside the newly formed FVG.'
    ],
    invalidationRules: [
      'If the origin candle of the displacement move is closed through, the MSS is invalidated.'
    ],
    commonMistakes: [
      'Chasing price at the tip of the displacement instead of waiting for the pullback.'
    ],
    visualDiagramType: 'mss'
  },
  fvg: {
    id: 'fvg',
    name: 'Fair Value Gap (FVG)',
    category: 'Imbalance',
    summary: 'A 3-candle price imbalance where heavy institutional buying or selling leaves unfilled orders in the market.',
    detailedExplanation: 'An FVG occurs when price expands so rapidly that there is a void between Candle 1 and Candle 3. In a Bullish FVG, Candle 1 High does not overlap Candle 3 Low. Markets have an algorithmic tendency to reprice back into this gap to restore equilibrium before resuming the move.',
    detectionFormula: 'Bullish: Candle 3 Low > Candle 1 High. Bearish: Candle 3 High < Candle 1 Low. Consequent Encroachment (CE) = 50% midpoint.',
    tradingRules: [
      'Look for reactions at the top boundary or the 50% midpoint (Consequent Encroachment).',
      'Unmitigated FVGs in the discount zone for longs or premium zone for shorts offer highest edge.'
    ],
    invalidationRules: [
      'A full candle body close through the opposite boundary marks the FVG as completely violated.'
    ],
    commonMistakes: [
      'Treating every tiny gap as an FVG without looking at displacement context.'
    ],
    visualDiagramType: 'fvg'
  },
  orderblock: {
    id: 'orderblock',
    name: 'Institutional Order Block (OB)',
    category: 'Institutional Zones',
    summary: 'The final opposing candle prior to an impulsive displacement move that broke market structure.',
    detailedExplanation: 'Institutions build massive positions over time. The last down-candle before a violent rally represents institutional accumulation where unfilled orders remain. When price returns to this origin zone, institutions defend their positions, creating sharp price rejections.',
    detectionFormula: 'Last opposing candle preceding a Displacement move that caused a BOS or MSS.',
    tradingRules: [
      'Bullish OB: Enter as price tests the open or 50% of the last bearish candle.',
      'Place stop loss securely beyond the wick extreme of the Order Block.'
    ],
    invalidationRules: [
      'If price closes with full body beyond the Order Block wick, it becomes violated and converts into a Breaker Block.'
    ],
    commonMistakes: [
      'Marking any random red or green candle as an order block without requiring a structural break.'
    ],
    visualDiagramType: 'orderblock'
  },
  liquidity_sweep: {
    id: 'liquidity_sweep',
    name: 'Liquidity Sweep (Stop Hunt / Grab)',
    category: 'Liquidity',
    summary: 'Price probing beyond obvious support/resistance or equal highs/lows to trigger retail stops before violently reversing.',
    detailedExplanation: 'Retail traders place stop-losses in predictable clusters (above equal highs or below equal lows). Smart money algorithms intentionally drive price into these liquidity pools to fill large institutional orders, then reverse rapidly.',
    detectionFormula: 'Price wicks past Equal Highs/Lows or Previous Day High/Low, then immediately closes back inside the range.',
    tradingRules: [
      'Do NOT enter when price first touches the liquidity pool.',
      'Wait for the sweep wick, followed by a candle closing back inside the range and an MSS on a lower timeframe.'
    ],
    invalidationRules: [
      'If price breaks out and continues expanding without reversing, it is a genuine breakout, not a sweep.'
    ],
    commonMistakes: [
      'Assuming every high or low is a reversal point without waiting for confirmation.'
    ],
    visualDiagramType: 'liquidity_sweep'
  },
  premium_discount: {
    id: 'premium_discount',
    name: 'Premium / Discount & Dealing Range',
    category: 'Institutional Zones',
    summary: 'Dividing the current swing range into Equilibrium (50%), Premium (expensive), and Discount (cheap).',
    detailedExplanation: 'Smart money algorithms aim to buy wholesale (Discount) and sell retail (Premium). In a bullish trend, long entries should strictly be taken below the 50% equilibrium level. In a bearish trend, short entries should strictly be taken above the 50% equilibrium level.',
    detectionFormula: 'Range = Swing High - Swing Low. Equilibrium = 50%. Discount = 0% to 50%. Premium = 50% to 100%. OTE = 61.8% to 78.6%.',
    tradingRules: [
      'Never buy in deep premium or sell in deep discount unless taking partial profits.',
      'Combine Discount zone with an unmitigated Bullish FVG / Order Block for optimal trade entries.'
    ],
    invalidationRules: [
      'A break beyond the major range high/low establishes a new dealing range.'
    ],
    commonMistakes: [
      'Taking long positions when price is already 80% into the premium zone.'
    ],
    visualDiagramType: 'premium_discount'
  }
};
