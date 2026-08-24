import { FullSMCPipelineResult } from '../engine';
import { StructuredSMCAnalysis, TradingScenario, SetupQualityScore, SetupScoreComponent } from '../types/ai';
import { NewsContext } from '../types/news';
import { STRATEGY_RULESETS } from '../engine/rulesets/smcRulesets';
import { calculateATR } from '../engine/displacement/displacementEngine';

export function generateStructuredSMCAnalysis(
  pipeline: FullSMCPipelineResult,
  news: NewsContext,
  rulesetKey = 'standard_smc',
  htfPipeline?: FullSMCPipelineResult
): StructuredSMCAnalysis {
  const { instrument, timeframe, lastPrice, candles, structure, liquidityPools, displacements, fairValueGaps, orderBlocks, dealingRange, sessionStatus } = pipeline;
  const ruleset = STRATEGY_RULESETS[rulesetKey] || STRATEGY_RULESETS.standard_smc;

  // 1. Instrument-Specific Volatility & Precision Normalization
  const isForex = instrument.assetClass === 'forex';
  const isJpy = instrument.id.includes('JPY') || instrument.symbol.includes('JPY');
  const decimals = isForex ? (isJpy ? 3 : 5) : 2;
  const pipSize = instrument.pipSize > 0 ? instrument.pipSize : (isForex ? (isJpy ? 0.01 : 0.0001) : 0.1);

  const atrs = calculateATR(candles, 14);
  const currentATR = atrs.length > 0 ? atrs[atrs.length - 1] : (lastPrice * 0.002);
  const volatilityBuffer = Math.max(pipSize * 3, currentATR * 0.15);

  // 2. HTF Bias & Intermediate Trend
  const htfBias = htfPipeline ? htfPipeline.structure.currentTrend : structure.currentTrend;
  const intermediateStructure = structure.currentTrend;

  // 3. Liquidity Pools & Sweeps
  const buysidePools = liquidityPools.filter(p => p.direction === 'BUYSIDE' && p.price > lastPrice).sort((a, b) => a.price - b.price);
  const sellsidePools = liquidityPools.filter(p => p.direction === 'SELLSIDE' && p.price < lastPrice).sort((a, b) => b.price - a.price);
  const nearestBuyside = buysidePools[0] || null;
  const nearestSellside = sellsidePools[0] || null;
  const sweptLiquidity = liquidityPools.filter(p => p.status === 'SWEPT' || p.status === 'SWEPT_CONFIRMED');
  const recentSweep = sweptLiquidity[sweptLiquidity.length - 1] || null;

  // 4. Relevant Active Zones
  const activeOrderBlocks = orderBlocks.filter(ob => ob.validityStatus === 'ACTIVE' || ob.validityStatus === 'BREAKER');
  const unmitigatedFVGs = fairValueGaps.filter(fvg => !fvg.isMitigated);

  const bullOB = activeOrderBlocks.find(ob => ob.type === 'BULLISH');
  const bearOB = activeOrderBlocks.find(ob => ob.type === 'BEARISH');
  const bullBreaker = activeOrderBlocks.find(ob => ob.validityStatus === 'BREAKER' && ob.type === 'BULLISH');
  const bearBreaker = activeOrderBlocks.find(ob => ob.validityStatus === 'BREAKER' && ob.type === 'BEARISH');
  const unmitigatedBullFVG = unmitigatedFVGs.find(f => f.type === 'BULLISH');
  const unmitigatedBearFVG = unmitigatedFVGs.find(f => f.type === 'BEARISH');

  // ── 5. STRUCTURE-DRIVEN BULLISH SETUP GENERATION ──────────────────────
  let bullIdentified = false;
  let bullEntryReason = '';
  let bullEntryStructureType: TradingScenario['entryStructureType'] = 'NONE';
  let bullEntryStructureId: string | undefined = undefined;
  let bullEntryTop = 0;
  let bullEntryBottom = 0;
  let bullSourceCandleIds: number[] | undefined = undefined;

  // Prioritize concrete structural zones
  if (unmitigatedBullFVG) {
    bullIdentified = true;
    bullEntryStructureType = 'FVG';
    bullEntryStructureId = unmitigatedBullFVG.id;
    bullEntryTop = unmitigatedBullFVG.top;
    bullEntryBottom = unmitigatedBullFVG.bottom;
    bullEntryReason = `Unmitigated Bullish FVG [${bullEntryBottom.toFixed(decimals)} - ${bullEntryTop.toFixed(decimals)}] at displacement origin`;
    bullSourceCandleIds = [unmitigatedBullFVG.candle1Index, unmitigatedBullFVG.candle3Index];
  } else if (bullOB) {
    bullIdentified = true;
    bullEntryStructureType = 'ORDER_BLOCK';
    bullEntryStructureId = bullOB.id;
    bullEntryTop = bullOB.topPrice;
    bullEntryBottom = bullOB.bottomPrice;
    bullEntryReason = `Active Bullish Order Block [${bullEntryBottom.toFixed(decimals)} - ${bullEntryTop.toFixed(decimals)}] institutional demand zone`;
    bullSourceCandleIds = [bullOB.originCandleIndex];
  } else if (bullBreaker) {
    bullIdentified = true;
    bullEntryStructureType = 'BREAKER_BLOCK';
    bullEntryStructureId = bullBreaker.id;
    bullEntryTop = bullBreaker.topPrice;
    bullEntryBottom = bullBreaker.bottomPrice;
    bullEntryReason = `Bullish Breaker Block retest zone [${bullEntryBottom.toFixed(decimals)} - ${bullEntryTop.toFixed(decimals)}]`;
  } else if (recentSweep && recentSweep.direction === 'SELLSIDE' && lastPrice > recentSweep.price) {
    bullIdentified = true;
    bullEntryStructureType = 'LIQUIDITY_SWEEP_RECLAIM';
    bullEntryStructureId = recentSweep.id;
    bullEntryTop = lastPrice;
    bullEntryBottom = recentSweep.price;
    bullEntryReason = `Sell-side liquidity sweep reclaim at ${recentSweep.price.toFixed(decimals)}`;
  } else if (dealingRange && dealingRange.currentZone === 'DISCOUNT' && structure.swings.length > 0) {
    const recentSwingLow = structure.swings.filter(s => s.type === 'LOW').pop();
    if (recentSwingLow && recentSwingLow.price < lastPrice) {
      bullIdentified = true;
      bullEntryStructureType = 'PREMIUM_DISCOUNT_EQUILIBRIUM';
      bullEntryTop = dealingRange.equilibrium;
      bullEntryBottom = recentSwingLow.price;
      bullEntryReason = `Discount dealing range demand confluence with swing low at ${recentSwingLow.price.toFixed(decimals)}`;
    }
  }

  // Bullish Entry Level (Top of demand zone)
  const bullEntry = bullIdentified ? bullEntryTop : 0;

  // Bullish Structural SL
  let bullSLStructureType: TradingScenario['slStructureType'] = 'SWING_LOW';
  let bullSLStructurePrice = 0;
  if (bullOB) {
    bullSLStructurePrice = bullOB.bottomPrice;
    bullSLStructureType = 'ORDER_BLOCK_INVALIDATION';
  } else if (unmitigatedBullFVG) {
    bullSLStructurePrice = unmitigatedBullFVG.bottom;
    bullSLStructureType = 'FVG_INVALIDATION';
  } else if (recentSweep && recentSweep.direction === 'SELLSIDE') {
    bullSLStructurePrice = recentSweep.price;
    bullSLStructureType = 'LIQUIDITY_SWEEP_EXTREME';
  } else if (dealingRange) {
    bullSLStructurePrice = dealingRange.rangeLow;
    bullSLStructureType = 'DEALING_RANGE_EXTREME';
  } else {
    const lastLow = structure.swings.filter(s => s.type === 'LOW').pop();
    bullSLStructurePrice = lastLow ? lastLow.price : (bullEntry - currentATR);
  }

  const bullSL = bullIdentified ? Number((bullSLStructurePrice - volatilityBuffer).toFixed(decimals)) : 0;
  const bullSLReason = `Structural invalidation ${volatilityBuffer.toFixed(decimals)} below ${bullSLStructureType.replace(/_/g, ' ').toLowerCase()} (${bullSLStructurePrice.toFixed(decimals)})`;

  // Bullish Structural Take Profit (Opposing Liquidity)
  let bullTP1 = 0;
  let bullTP2 = 0;
  let bullTPReason = '';
  let bullTPStructureType: TradingScenario['tpStructureType'] = 'EXTERNAL_LIQUIDITY_POOL';
  let bullTPStructureId: string | undefined = undefined;

  const validBuysideTargets = liquidityPools.filter(p => p.direction === 'BUYSIDE' && p.price > (bullEntry || lastPrice)).sort((a, b) => a.price - b.price);
  const opposingBearOB = activeOrderBlocks.find(ob => ob.type === 'BEARISH' && ob.bottomPrice > bullEntry);
  const opposingBearFVG = unmitigatedFVGs.find(f => f.type === 'BEARISH' && f.bottom > bullEntry);

  if (validBuysideTargets.length > 0) {
    const primeTarget = validBuysideTargets[validBuysideTargets.length > 1 ? 1 : 0];
    bullTP2 = primeTarget.price;
    bullTP1 = validBuysideTargets[0].price;
    bullTPStructureType = (primeTarget.type === 'EQH' || primeTarget.type === 'PDH' || primeTarget.type === 'PWH') ? 'EQUAL_HIGHS' : 'EXTERNAL_LIQUIDITY_POOL';
    bullTPStructureId = primeTarget.id;
    bullTPReason = `Buy-side liquidity pool resting at ${bullTP2.toFixed(decimals)} (${primeTarget.type})`;
  } else if (opposingBearOB) {
    bullTP2 = opposingBearOB.bottomPrice;
    bullTP1 = (bullEntry + bullTP2) / 2;
    bullTPStructureType = 'OPPOSING_ORDER_BLOCK';
    bullTPStructureId = opposingBearOB.id;
    bullTPReason = `Opposing Bearish Order Block supply barrier at ${bullTP2.toFixed(decimals)}`;
  } else if (opposingBearFVG) {
    bullTP2 = opposingBearFVG.bottom;
    bullTP1 = (bullEntry + bullTP2) / 2;
    bullTPStructureType = 'OPPOSING_FVG';
    bullTPStructureId = opposingBearFVG.id;
    bullTPReason = `Opposing Bearish FVG imbalance fill at ${bullTP2.toFixed(decimals)}`;
  } else if (dealingRange && dealingRange.rangeHigh > bullEntry) {
    bullTP2 = dealingRange.rangeHigh;
    bullTP1 = dealingRange.equilibrium > bullEntry ? dealingRange.equilibrium : (bullEntry + bullTP2) / 2;
    bullTPStructureType = 'DEALING_RANGE_EXPANSION';
    bullTPReason = `Dealing range premium external high at ${bullTP2.toFixed(decimals)}`;
  } else {
    bullIdentified = false;
  }

  // Bullish Risk / Reward & Entry Distance Validation
  const bullRisk = bullEntry - bullSL;
  const bullReward = bullTP2 - bullEntry;
  const bullRR = (bullRisk > 0 && bullReward > 0) ? Number((bullReward / bullRisk).toFixed(2)) : 0;
  const bullEntryDist = Math.abs(lastPrice - bullEntry);
  const bullEntryDistPercent = Number(((bullEntryDist / lastPrice) * 100).toFixed(2));
  const bullEntryDistATR = Number((bullEntryDist / currentATR).toFixed(2));

  let bullProximity: TradingScenario['entryProximityState'] = 'PENDING';
  if (bullEntryDistATR <= 0.6 || bullEntryDistPercent <= 0.35) {
    bullProximity = 'APPROACHING';
  } else if (bullEntryDistATR > 2.5) {
    bullProximity = 'TOO_FAR';
  }

  // Hard Geometry Sanity Validation
  const isBullGeometryValid = bullIdentified && (bullSL < bullEntry) && (bullEntry < bullTP2) && (bullRR >= 1.5);
  if (!isBullGeometryValid) {
    bullIdentified = false;
  }

  const lastSwingLow = structure.swings.filter(s => s.type === 'LOW').pop();

  const bullishScenario: TradingScenario = {
    id: `scenario-bull-${pipeline.calculationTimestamp}`,
    type: 'BULLISH',
    probabilityGrade: (isBullGeometryValid && structure.currentTrend === 'BULLISH' && bullProximity !== 'TOO_FAR') ? 'HIGH_PROBABILITY' : 'CONDITIONAL',
    title: isBullGeometryValid ? 'Bullish Structure-Driven Long Setup' : 'Bullish Scenario (Awaiting Structural Confirmation)',
    narrative: isBullGeometryValid
      ? `Structural demand established at ${bullEntryReason}. SL anchored at ${bullSL.toFixed(decimals)}. Primary target draw on liquidity at ${bullTP2.toFixed(decimals)} (R:R = 1:${bullRR}).`
      : 'No actionable bullish setup: Insufficient unmitigated demand structure or invalid risk/reward geometry.',
    conditionsRequired: [
      `Price must hold strictly above structural invalidation at ${bullSL.toFixed(decimals)}`,
      `Orderly retracement into Demand Zone [${bullEntryBottom.toFixed(decimals)} - ${bullEntryTop.toFixed(decimals)}]`,
      'Lower timeframe rejection candle confirming institutional absorption'
    ],
    invalidationTrigger: `Decisive candle body close below ${bullSL.toFixed(decimals)} violates bullish order flow.`,
    invalidationPrice: Number(bullSL.toFixed(decimals)),
    potentialTargets: [
      { label: 'Target 1 (Internal Liquidity / Partial TP)', price: Number(bullTP1.toFixed(decimals)), description: 'Internal liquidity / 50% dealing range equilibrium', targetType: 'INTERNAL_LIQUIDITY' },
      { label: 'Target 2 (Major Buy-Side Liquidity Pool)', price: Number(bullTP2.toFixed(decimals)), description: bullTPReason, targetType: bullTPStructureType, targetStructureId: bullTPStructureId }
    ],
    idealEntryZone: {
      topPrice: Number(bullEntryTop.toFixed(decimals)),
      bottomPrice: Number(bullEntryBottom.toFixed(decimals)),
      referenceZone: bullEntryReason || 'Demand Invalidation Zone'
    },
    isStructureIdentified: isBullGeometryValid,
    entryReason: bullEntryReason || 'No valid bullish entry structure identified',
    entryStructureType: bullEntryStructureType,
    entryStructureId: bullEntryStructureId,
    entryZoneHigh: Number(bullEntryTop.toFixed(decimals)),
    entryZoneLow: Number(bullEntryBottom.toFixed(decimals)),
    supportingSwing: lastSwingLow ? {
      type: 'SWING_LOW',
      price: lastSwingLow.price,
    } : undefined,
    supportingLiquidity: nearestBuyside ? {
      type: 'BUYSIDE',
      price: nearestBuyside.price,
      status: nearestBuyside.status,
    } : undefined,
    timeframe,
    sourceCandleIds: bullSourceCandleIds,
    slReason: bullSLReason,
    slStructureType: bullSLStructureType,
    slStructurePrice: Number(bullSLStructurePrice.toFixed(decimals)),
    slBufferUsed: Number(volatilityBuffer.toFixed(decimals)),
    tpReason: bullTPReason || 'No structural target identified',
    tpStructureType: bullTPStructureType,
    tpStructureId: bullTPStructureId,
    tpDistanceFromEntry: Number(bullReward.toFixed(decimals)),
    calculatedRR: bullRR,
    currentPriceAtCreation: lastPrice,
    entryDistance: Number(bullEntryDist.toFixed(decimals)),
    entryDistancePercent: bullEntryDistPercent,
    entryDistanceInATR: bullEntryDistATR,
    entryProximityState: bullProximity,
  };

  // ── 6. STRUCTURE-DRIVEN BEARISH SETUP GENERATION ─────────────────────
  let bearIdentified = false;
  let bearEntryReason = '';
  let bearEntryStructureType: TradingScenario['entryStructureType'] = 'NONE';
  let bearEntryStructureId: string | undefined = undefined;
  let bearEntryTop = 0;
  let bearEntryBottom = 0;
  let bearSourceCandleIds: number[] | undefined = undefined;

  // Prioritize concrete structural zones
  if (unmitigatedBearFVG) {
    bearIdentified = true;
    bearEntryStructureType = 'FVG';
    bearEntryStructureId = unmitigatedBearFVG.id;
    bearEntryTop = unmitigatedBearFVG.top;
    bearEntryBottom = unmitigatedBearFVG.bottom;
    bearEntryReason = `Unmitigated Bearish FVG [${bearEntryBottom.toFixed(decimals)} - ${bearEntryTop.toFixed(decimals)}] at displacement origin`;
    bearSourceCandleIds = [unmitigatedBearFVG.candle1Index, unmitigatedBearFVG.candle3Index];
  } else if (bearOB) {
    bearIdentified = true;
    bearEntryStructureType = 'ORDER_BLOCK';
    bearEntryStructureId = bearOB.id;
    bearEntryTop = bearOB.topPrice;
    bearEntryBottom = bearOB.bottomPrice;
    bearEntryReason = `Active Bearish Order Block [${bearEntryBottom.toFixed(decimals)} - ${bearEntryTop.toFixed(decimals)}] institutional supply zone`;
    bearSourceCandleIds = [bearOB.originCandleIndex];
  } else if (bearBreaker) {
    bearIdentified = true;
    bearEntryStructureType = 'BREAKER_BLOCK';
    bearEntryStructureId = bearBreaker.id;
    bearEntryTop = bearBreaker.topPrice;
    bearEntryBottom = bearBreaker.bottomPrice;
    bearEntryReason = `Bearish Breaker Block retest zone [${bearEntryBottom.toFixed(decimals)} - ${bearEntryTop.toFixed(decimals)}]`;
  } else if (recentSweep && recentSweep.direction === 'BUYSIDE' && lastPrice < recentSweep.price) {
    bearIdentified = true;
    bearEntryStructureType = 'LIQUIDITY_SWEEP_RECLAIM';
    bearEntryStructureId = recentSweep.id;
    bearEntryTop = recentSweep.price;
    bearEntryBottom = lastPrice;
    bearEntryReason = `Buy-side liquidity sweep rejection at ${recentSweep.price.toFixed(decimals)}`;
  } else if (dealingRange && dealingRange.currentZone === 'PREMIUM' && structure.swings.length > 0) {
    const recentSwingHigh = structure.swings.filter(s => s.type === 'HIGH').pop();
    if (recentSwingHigh && recentSwingHigh.price > lastPrice) {
      bearIdentified = true;
      bearEntryStructureType = 'PREMIUM_DISCOUNT_EQUILIBRIUM';
      bearEntryTop = recentSwingHigh.price;
      bearEntryBottom = dealingRange.equilibrium;
      bearEntryReason = `Premium dealing range supply confluence with swing high at ${recentSwingHigh.price.toFixed(decimals)}`;
    }
  }

  // Bearish Entry Level (Bottom of supply zone)
  const bearEntry = bearIdentified ? bearEntryBottom : 0;

  // Bearish Structural SL
  let bearSLStructureType: TradingScenario['slStructureType'] = 'SWING_HIGH';
  let bearSLStructurePrice = 0;
  if (bearOB) {
    bearSLStructurePrice = bearOB.topPrice;
    bearSLStructureType = 'ORDER_BLOCK_INVALIDATION';
  } else if (unmitigatedBearFVG) {
    bearSLStructurePrice = unmitigatedBearFVG.top;
    bearSLStructureType = 'FVG_INVALIDATION';
  } else if (recentSweep && recentSweep.direction === 'BUYSIDE') {
    bearSLStructurePrice = recentSweep.price;
    bearSLStructureType = 'LIQUIDITY_SWEEP_EXTREME';
  } else if (dealingRange) {
    bearSLStructurePrice = dealingRange.rangeHigh;
    bearSLStructureType = 'DEALING_RANGE_EXTREME';
  } else {
    const lastHigh = structure.swings.filter(s => s.type === 'HIGH').pop();
    bearSLStructurePrice = lastHigh ? lastHigh.price : (bearEntry + currentATR);
  }

  const bearSL = bearIdentified ? Number((bearSLStructurePrice + volatilityBuffer).toFixed(decimals)) : 0;
  const bearSLReason = `Structural invalidation ${volatilityBuffer.toFixed(decimals)} above ${bearSLStructureType.replace(/_/g, ' ').toLowerCase()} (${bearSLStructurePrice.toFixed(decimals)})`;

  // Bearish Structural Take Profit (Opposing Liquidity)
  let bearTP1 = 0;
  let bearTP2 = 0;
  let bearTPReason = '';
  let bearTPStructureType: TradingScenario['tpStructureType'] = 'EXTERNAL_LIQUIDITY_POOL';
  let bearTPStructureId: string | undefined = undefined;

  const validSellsideTargets = liquidityPools.filter(p => p.direction === 'SELLSIDE' && p.price < (bearEntry || lastPrice)).sort((a, b) => b.price - a.price);
  const opposingBullOB = activeOrderBlocks.find(ob => ob.type === 'BULLISH' && ob.topPrice < bearEntry);
  const opposingBullFVG = unmitigatedFVGs.find(f => f.type === 'BULLISH' && f.top < bearEntry);

  if (validSellsideTargets.length > 0) {
    const primeTarget = validSellsideTargets[validSellsideTargets.length > 1 ? 1 : 0];
    bearTP2 = primeTarget.price;
    bearTP1 = validSellsideTargets[0].price;
    bearTPStructureType = (primeTarget.type === 'EQL' || primeTarget.type === 'PDL' || primeTarget.type === 'PWL') ? 'EQUAL_LOWS' : 'EXTERNAL_LIQUIDITY_POOL';
    bearTPStructureId = primeTarget.id;
    bearTPReason = `Sell-side liquidity pool resting at ${bearTP2.toFixed(decimals)} (${primeTarget.type})`;
  } else if (opposingBullOB) {
    bearTP2 = opposingBullOB.topPrice;
    bearTP1 = (bearEntry + bearTP2) / 2;
    bearTPStructureType = 'OPPOSING_ORDER_BLOCK';
    bearTPStructureId = opposingBullOB.id;
    bearTPReason = `Opposing Bullish Order Block demand barrier at ${bearTP2.toFixed(decimals)}`;
  } else if (opposingBullFVG) {
    bearTP2 = opposingBullFVG.top;
    bearTP1 = (bearEntry + bearTP2) / 2;
    bearTPStructureType = 'OPPOSING_FVG';
    bearTPStructureId = opposingBullFVG.id;
    bearTPReason = `Opposing Bullish FVG imbalance fill at ${bearTP2.toFixed(decimals)}`;
  } else if (dealingRange && dealingRange.rangeLow < bearEntry) {
    bearTP2 = dealingRange.rangeLow;
    bearTP1 = dealingRange.equilibrium < bearEntry ? dealingRange.equilibrium : (bearEntry + bearTP2) / 2;
    bearTPStructureType = 'DEALING_RANGE_EXPANSION';
    bearTPReason = `Dealing range discount external low at ${bearTP2.toFixed(decimals)}`;
  } else {
    bearIdentified = false;
  }

  // Bearish Risk / Reward & Entry Distance Validation
  const bearRisk = bearSL - bearEntry;
  const bearReward = bearEntry - bearTP2;
  const bearRR = (bearRisk > 0 && bearReward > 0) ? Number((bearReward / bearRisk).toFixed(2)) : 0;
  const bearEntryDist = Math.abs(lastPrice - bearEntry);
  const bearEntryDistPercent = Number(((bearEntryDist / lastPrice) * 100).toFixed(2));
  const bearEntryDistATR = Number((bearEntryDist / currentATR).toFixed(2));

  let bearProximity: TradingScenario['entryProximityState'] = 'PENDING';
  if (bearEntryDistATR <= 0.6 || bearEntryDistPercent <= 0.35) {
    bearProximity = 'APPROACHING';
  } else if (bearEntryDistATR > 2.5) {
    bearProximity = 'TOO_FAR';
  }

  // Hard Geometry Sanity Validation
  const isBearGeometryValid = bearIdentified && (bearTP2 < bearEntry) && (bearEntry < bearSL) && (bearRR >= 1.5);
  if (!isBearGeometryValid) {
    bearIdentified = false;
  }

  const lastSwingHigh = structure.swings.filter(s => s.type === 'HIGH').pop();

  const bearishScenario: TradingScenario = {
    id: `scenario-bear-${pipeline.calculationTimestamp}`,
    type: 'BEARISH',
    probabilityGrade: (isBearGeometryValid && structure.currentTrend === 'BEARISH' && bearProximity !== 'TOO_FAR') ? 'HIGH_PROBABILITY' : 'CONDITIONAL',
    title: isBearGeometryValid ? 'Bearish Structure-Driven Short Setup' : 'Bearish Scenario (Awaiting Structural Confirmation)',
    narrative: isBearGeometryValid
      ? `Structural supply established at ${bearEntryReason}. SL anchored at ${bearSL.toFixed(decimals)}. Primary target draw on liquidity at ${bearTP2.toFixed(decimals)} (R:R = 1:${bearRR}).`
      : 'No actionable bearish setup: Insufficient unmitigated supply structure or invalid risk/reward geometry.',
    conditionsRequired: [
      `Price must hold strictly below structural invalidation at ${bearSL.toFixed(decimals)}`,
      `Orderly retracement into Supply Zone [${bearEntryBottom.toFixed(decimals)} - ${bearEntryTop.toFixed(decimals)}]`,
      'Bearish Market Structure Shift (MSS) or rejection candle confirming supply emergence'
    ],
    invalidationTrigger: `Decisive candle body close above ${bearSL.toFixed(decimals)} violates bearish order flow.`,
    invalidationPrice: Number(bearSL.toFixed(decimals)),
    potentialTargets: [
      { label: 'Target 1 (Internal Liquidity / Partial TP)', price: Number(bearTP1.toFixed(decimals)), description: 'Internal liquidity / 50% dealing range equilibrium', targetType: 'INTERNAL_LIQUIDITY' },
      { label: 'Target 2 (Major Sell-Side Liquidity Pool)', price: Number(bearTP2.toFixed(decimals)), description: bearTPReason, targetType: bearTPStructureType, targetStructureId: bearTPStructureId }
    ],
    idealEntryZone: {
      topPrice: Number(bearEntryTop.toFixed(decimals)),
      bottomPrice: Number(bearEntryBottom.toFixed(decimals)),
      referenceZone: bearEntryReason || 'Supply Invalidation Zone'
    },
    isStructureIdentified: isBearGeometryValid,
    entryReason: bearEntryReason || 'No valid bearish entry structure identified',
    entryStructureType: bearEntryStructureType,
    entryStructureId: bearEntryStructureId,
    entryZoneHigh: Number(bearEntryTop.toFixed(decimals)),
    entryZoneLow: Number(bearEntryBottom.toFixed(decimals)),
    supportingSwing: lastSwingHigh ? {
      type: 'SWING_HIGH',
      price: lastSwingHigh.price,
    } : undefined,
    supportingLiquidity: nearestSellside ? {
      type: 'SELLSIDE',
      price: nearestSellside.price,
      status: nearestSellside.status,
    } : undefined,
    timeframe,
    sourceCandleIds: bearSourceCandleIds,
    slReason: bearSLReason,
    slStructureType: bearSLStructureType,
    slStructurePrice: Number(bearSLStructurePrice.toFixed(decimals)),
    slBufferUsed: Number(volatilityBuffer.toFixed(decimals)),
    tpReason: bearTPReason || 'No structural target identified',
    tpStructureType: bearTPStructureType,
    tpStructureId: bearTPStructureId,
    tpDistanceFromEntry: Number(bearReward.toFixed(decimals)),
    calculatedRR: bearRR,
    currentPriceAtCreation: lastPrice,
    entryDistance: Number(bearEntryDist.toFixed(decimals)),
    entryDistancePercent: bearEntryDistPercent,
    entryDistanceInATR: bearEntryDistATR,
    entryProximityState: bearProximity,
  };

  // ── 7. Evidence-Based Setup Quality Score Calculation ────────────────
  const bulletPoints: string[] = [];
  const conflictingSignals: string[] = [];

  bulletPoints.push(`${htfBias} higher-timeframe market structure context`);
  if (structure.lastBOS) bulletPoints.push(`Confirmed BOS in ${structure.lastBOS.direction.toLowerCase()} direction at ${structure.lastBOS.breakPrice.toFixed(decimals)}`);
  if (structure.lastMSS) bulletPoints.push(`Confirmed Market Structure Shift (MSS) at ${structure.lastMSS.breakPrice.toFixed(decimals)}`);
  if (recentSweep) bulletPoints.push(`Recent ${recentSweep.direction.toLowerCase()} liquidity sweep at ${recentSweep.price.toFixed(decimals)} (${recentSweep.status})`);
  if (unmitigatedBullFVG) bulletPoints.push(`Active unmitigated Bullish FVG [${unmitigatedBullFVG.bottom.toFixed(decimals)} - ${unmitigatedBullFVG.top.toFixed(decimals)}]`);
  if (unmitigatedBearFVG) bulletPoints.push(`Active unmitigated Bearish FVG [${unmitigatedBearFVG.bottom.toFixed(decimals)} - ${unmitigatedBearFVG.top.toFixed(decimals)}]`);
  if (dealingRange) bulletPoints.push(`Price is situated in ${dealingRange.currentZone} zone of dealing range [${dealingRange.rangeLow.toFixed(decimals)} - ${dealingRange.rangeHigh.toFixed(decimals)}]`);

  if (htfBias === 'BULLISH' && structure.currentTrend === 'BEARISH') {
    conflictingSignals.push('HTF Macro Trend is Bullish while local structure is currently printing Lower Lows (Counter-trend retracement).');
  }
  if (htfBias === 'BEARISH' && structure.currentTrend === 'BULLISH') {
    conflictingSignals.push('HTF Macro Trend is Bearish while local structure is printing Higher Highs (Potential deep retracement or trend reversal).');
  }
  if (dealingRange?.currentZone === 'PREMIUM' && structure.currentTrend === 'BULLISH') {
    conflictingSignals.push('Price is in Premium zone: Long entries carry higher risk without deep retracement to discount demand.');
  }
  if (dealingRange?.currentZone === 'DISCOUNT' && structure.currentTrend === 'BEARISH') {
    conflictingSignals.push('Price is in Discount zone: Short entries carry higher risk without retracement to premium supply.');
  }

  const isSetupActive = isBullGeometryValid || isBearGeometryValid;

  const scoreComponents: SetupScoreComponent[] = [
    {
      category: 'HTF Trend Alignment',
      score: htfBias === structure.currentTrend ? 9 : 4,
      maxScore: 10,
      weight: 0.20,
      reason: htfBias === structure.currentTrend ? 'Strong confluence between HTF bias and execution timeframe' : 'Execution timeframe is in counter-trend retracement',
      isPositive: htfBias === structure.currentTrend
    },
    {
      category: 'Market Structure Confirmation',
      score: structure.lastMSS ? 10 : structure.lastBOS ? 8 : 4,
      maxScore: 10,
      weight: 0.20,
      reason: structure.lastMSS ? 'Confirmed Market Structure Shift (MSS) with displacement close' : structure.lastBOS ? 'Confirmed Break of Structure (BOS)' : 'No recent structural break confirmed',
      isPositive: !!(structure.lastMSS || structure.lastBOS)
    },
    {
      category: 'Institutional Structure & Zones',
      score: isSetupActive ? 9 : 3,
      maxScore: 10,
      weight: 0.20,
      reason: isSetupActive ? 'Legitimate institutional FVG or Order Block identified with structural invalidation' : 'No clean unmitigated FVG or Order Block identified',
      isPositive: isSetupActive
    },
    {
      category: 'Liquidity Sweep State',
      score: recentSweep?.status === 'SWEPT_CONFIRMED' ? 10 : recentSweep?.status === 'SWEPT' ? 7 : 4,
      maxScore: 10,
      weight: 0.15,
      reason: recentSweep ? `${recentSweep.type} pool swept with rejection` : 'No clean liquidity sweep identified immediately preceding current price',
      isPositive: !!recentSweep
    },
    {
      category: 'Session Confluence',
      score: sessionStatus.activeOverlap ? 10 : sessionStatus.currentSessions.some(s => s.isActive) ? 8 : 5,
      maxScore: 10,
      weight: 0.10,
      reason: sessionStatus.activeOverlap ? 'High institutional volume during London/NY Overlap' : 'Active major trading session',
      isPositive: sessionStatus.currentSessions.some(s => s.isActive)
    },
    {
      category: 'Macro Economic Risk',
      score: news.hasImminentHighImpactEvent ? 2 : 9,
      maxScore: 10,
      weight: 0.15,
      reason: news.hasImminentHighImpactEvent ? 'High-impact scheduled event imminent (spread/volatility risk)' : 'No imminent high-impact macro disruptions in next 60m',
      isPositive: !news.hasImminentHighImpactEvent
    }
  ];

  const rawWeightedScore = Math.round(
    scoreComponents.reduce((acc, c) => acc + (c.score / c.maxScore) * c.weight * 100, 0)
  );

  const totalWeightedScore = isSetupActive ? rawWeightedScore : Math.min(55, rawWeightedScore);
  const grade = totalWeightedScore >= 85 ? 'A+' : totalWeightedScore >= 75 ? 'A' : totalWeightedScore >= 60 ? 'B' : 'C';

  const setupQuality: SetupQualityScore = {
    totalScore: totalWeightedScore,
    grade,
    components: scoreComponents,
    summary: `Setup Quality Grade: ${grade} (${totalWeightedScore}/100). ${scoreComponents.filter(c => !c.isPositive).map(c => c.reason).join('. ')}`
  };

  return {
    analysisId: `analysis-${instrument.id}-${timeframe}-${pipeline.calculationTimestamp}`,
    timestamp: pipeline.calculationTimestamp,
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    currentPrice: lastPrice,
    timeframeHierarchy: {
      higher: htfPipeline?.timeframe || '4H',
      intermediate: timeframe,
      setup: '15M',
      entry: '5M'
    },
    rulesetUsed: ruleset.name,
    marketOverview: {
      htfBias,
      intermediateStructure,
      lowerTimeframeStatus: structure.lastMSS ? 'MSS in progress' : 'Consolidating in dealing range',
      summary: `Market condition is currently ${structure.currentTrend.toLowerCase()} on the ${timeframe} timeframe. HTF context is ${htfBias.toLowerCase()}. Price is trading at ${lastPrice.toFixed(decimals)} within the ${dealingRange?.currentZone || 'active'} dealing range.`
    },
    structuralEvidence: {
      bulletPoints,
      conflictingSignals
    },
    liquidityMap: {
      nearestBuyside,
      nearestSellside,
      majorLiquidityPools: liquidityPools,
      sweptLiquidity,
      nextTargetSummary: `Primary draw on liquidity is resting at ${structure.currentTrend === 'BULLISH' ? (bullTP2 > 0 ? bullTP2.toFixed(decimals) + ' (Buy-side)' : 'None') : (bearTP2 > 0 ? bearTP2.toFixed(decimals) + ' (Sell-side)' : 'None')}.`
    },
    relevantZones: {
      activeOrderBlocks,
      unmitigatedFVGs,
      dealingRange,
      displacements
    },
    newsContext: {
      relevantEvents: news.upcomingEvents.slice(0, 3),
      riskWarning: news.warningMessage
    },
    sessionContext: {
      activeSessions: sessionStatus.currentSessions.filter(s => s.isActive),
      sessionNotes: sessionStatus.activeOverlap ? 'Currently in high-volume London/New York overlap window.' : `Active session(s): ${sessionStatus.currentSessions.filter(s => s.isActive).map(s => s.displayName).join(', ') || 'Off-peak'}.`
    },
    scenarios: {
      bullish: bullishScenario,
      bearish: bearishScenario
    },
    setupQuality,
    educationalNotes: [
      {
        concept: 'Market Structure & Swings',
        explanation: 'SMC relies on sequences of Higher Highs / Higher Lows (bullish) and Lower Highs / Lower Lows (bearish). Structural breaks are confirmed strictly by candle body closes beyond swing extremes.',
        chartApplication: `On this chart, the last confirmed swing high is at ${(dealingRange?.rangeHigh || 0).toFixed(decimals)} and swing low is at ${(dealingRange?.rangeLow || 0).toFixed(decimals)}.`
      },
      {
        concept: 'Fair Value Gap (FVG)',
        explanation: 'A 3-candle imbalance created when price aggressively expands, leaving an unpriced range between candle 1 and candle 3 wicks.',
        chartApplication: `There are currently ${unmitigatedFVGs.length} active unmitigated FVGs on this timeframe.`
      }
    ]
  };
}
