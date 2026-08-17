import { FullSMCPipelineResult } from '../engine';
import { StructuredSMCAnalysis, TradingScenario, SetupQualityScore, SetupScoreComponent } from '../types/ai';
import { NewsContext } from '../types/news';
import { STRATEGY_RULESETS } from '../engine/rulesets/smcRulesets';

export function generateStructuredSMCAnalysis(
  pipeline: FullSMCPipelineResult,
  news: NewsContext,
  rulesetKey = 'standard_smc',
  htfPipeline?: FullSMCPipelineResult
): StructuredSMCAnalysis {
  const { instrument, timeframe, lastPrice, structure, liquidityPools, displacements, fairValueGaps, orderBlocks, dealingRange, sessionStatus } = pipeline;
  const ruleset = STRATEGY_RULESETS[rulesetKey] || STRATEGY_RULESETS.standard_smc;

  // 1. HTF Bias & Intermediate Trend
  const htfBias = htfPipeline ? htfPipeline.structure.currentTrend : structure.currentTrend;
  const intermediateStructure = structure.currentTrend;

  // 2. Identify nearest liquidity pools
  const buysidePools = liquidityPools.filter(p => p.direction === 'BUYSIDE' && p.price > lastPrice).sort((a, b) => a.price - b.price);
  const sellsidePools = liquidityPools.filter(p => p.direction === 'SELLSIDE' && p.price < lastPrice).sort((a, b) => b.price - a.price);
  const nearestBuyside = buysidePools[0] || null;
  const nearestSellside = sellsidePools[0] || null;
  const sweptLiquidity = liquidityPools.filter(p => p.status === 'SWEPT' || p.status === 'SWEPT_CONFIRMED');

  // 3. Relevant Active Zones
  const activeOrderBlocks = orderBlocks.filter(ob => ob.validityStatus === 'ACTIVE' || ob.validityStatus === 'BREAKER');
  const unmitigatedFVGs = fairValueGaps.filter(fvg => !fvg.isMitigated);

  // 4. Structural Evidence Compilation
  const bulletPoints: string[] = [];
  const conflictingSignals: string[] = [];

  // HTF Bias Evidence
  bulletPoints.push(`${htfBias} higher-timeframe market structure context`);

  // BOS / CHoCH Evidence
  if (structure.lastBOS) {
    bulletPoints.push(`Latest BOS detected in ${structure.lastBOS.direction.toLowerCase()} direction at ${structure.lastBOS.breakPrice.toFixed(4)}`);
  }
  if (structure.lastMSS) {
    bulletPoints.push(`Market Structure Shift (MSS) confirmed with aggressive displacement at ${structure.lastMSS.breakPrice.toFixed(4)}`);
  }
  if (structure.lastCHoCH) {
    bulletPoints.push(`Change of Character (CHoCH) observed at ${structure.lastCHoCH.breakPrice.toFixed(4)}`);
  }

  // Sweeps Evidence
  const recentSweep = sweptLiquidity[sweptLiquidity.length - 1];
  if (recentSweep) {
    bulletPoints.push(`Recent ${recentSweep.direction.toLowerCase()} liquidity sweep at ${recentSweep.price.toFixed(4)} (${recentSweep.status})`);
  }

  // FVG & OB Evidence
  const unmitigatedBullFVG = unmitigatedFVGs.find(f => f.type === 'BULLISH');
  const unmitigatedBearFVG = unmitigatedFVGs.find(f => f.type === 'BEARISH');
  if (unmitigatedBullFVG) {
    bulletPoints.push(`Active unmitigated Bullish FVG [${unmitigatedBullFVG.bottom.toFixed(4)} - ${unmitigatedBullFVG.top.toFixed(4)}]`);
  }
  if (unmitigatedBearFVG) {
    bulletPoints.push(`Active unmitigated Bearish FVG [${unmitigatedBearFVG.bottom.toFixed(4)} - ${unmitigatedBearFVG.top.toFixed(4)}]`);
  }

  // Dealing Range
  if (dealingRange) {
    bulletPoints.push(`Price is currently situated in the ${dealingRange.currentZone} zone of dealing range [${dealingRange.rangeLow.toFixed(4)} - ${dealingRange.rangeHigh.toFixed(4)}]`);
  }

  // Detect Conflicting Signals
  if (htfBias === 'BULLISH' && structure.currentTrend === 'BEARISH') {
    conflictingSignals.push('HTF Macro Trend is Bullish while local structure is currently printing Lower Lows (Counter-trend pullback phase).');
  }
  if (htfBias === 'BEARISH' && structure.currentTrend === 'BULLISH') {
    conflictingSignals.push('HTF Macro Trend is Bearish while local structure is printing Higher Highs (Potential deep retracement or trend reversal).');
  }
  if (dealingRange?.currentZone === 'PREMIUM' && structure.currentTrend === 'BULLISH') {
    conflictingSignals.push('Price is in Premium zone: Long entries carry higher risk without deep retracement to discount or FVG.');
  }

  // 5. Evidence-Based Setup Quality Score Calculation
  const scoreComponents: SetupScoreComponent[] = [
    {
      category: 'HTF Trend Alignment',
      score: htfBias === structure.currentTrend ? 9 : 4,
      maxScore: 10,
      weight: 0.20,
      reason: htfBias === structure.currentTrend ? 'Strong confluence between HTF bias and intermediate structure' : 'Intermediate structure is in counter-trend retracement',
      isPositive: htfBias === structure.currentTrend
    },
    {
      category: 'Market Structure Confirmation',
      score: structure.lastMSS ? 9 : structure.lastBOS ? 8 : 5,
      maxScore: 10,
      weight: 0.20,
      reason: structure.lastMSS ? 'Confirmed Market Structure Shift (MSS) with impulsive candle close' : structure.lastBOS ? 'Confirmed Break of Structure (BOS)' : 'No recent clean structural break confirmed',
      isPositive: !!(structure.lastMSS || structure.lastBOS)
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
      category: 'Institutional Imbalance (FVG / OB)',
      score: (unmitigatedBullFVG || unmitigatedBearFVG) && activeOrderBlocks.length > 0 ? 9 : 6,
      maxScore: 10,
      weight: 0.15,
      reason: 'Valid unmitigated Fair Value Gap aligned with active Order Block origin',
      isPositive: true
    },
    {
      category: 'Session Confluence',
      score: sessionStatus.activeOverlap ? 10 : sessionStatus.currentSessions.some(s => s.isActive) ? 8 : 5,
      maxScore: 10,
      weight: 0.15,
      reason: sessionStatus.activeOverlap ? 'High institutional volume during London/NY Overlap' : 'Active major trading session',
      isPositive: sessionStatus.currentSessions.some(s => s.isActive)
    },
    {
      category: 'Macro Economic Risk',
      score: news.hasImminentHighImpactEvent ? 2 : 9,
      maxScore: 10,
      weight: 0.15,
      reason: news.hasImminentHighImpactEvent ? 'High-impact scheduled event imminent (spread/volatility risk)' : 'No imminent high-impact macro disruptions in the next 60m',
      isPositive: !news.hasImminentHighImpactEvent
    }
  ];

  const totalWeightedScore = Math.round(
    scoreComponents.reduce((acc, c) => acc + (c.score / c.maxScore) * c.weight * 100, 0)
  );

  const grade = totalWeightedScore >= 85 ? 'A+' : totalWeightedScore >= 75 ? 'A' : totalWeightedScore >= 60 ? 'B' : 'C';

  const setupQuality: SetupQualityScore = {
    totalScore: totalWeightedScore,
    grade,
    components: scoreComponents,
    summary: `Setup Quality Grade: ${grade} (${totalWeightedScore}/100). ${scoreComponents.filter(c => !c.isPositive).map(c => c.reason).join('. ')}`
  };

  // 6. Bullish & Bearish Probabilistic Scenarios with Strict Directional Geometry
  const bullOB = activeOrderBlocks.find(ob => ob.type === 'BULLISH');
  const bearOB = activeOrderBlocks.find(ob => ob.type === 'BEARISH');

  const isForex = instrument.assetClass === 'forex';
  const decimals = isForex ? 5 : 2;
  const bufferPips = instrument.pipSize > 0 ? instrument.pipSize * 5 : lastPrice * 0.001;

  // ── Bullish Scenario Geometry (SL < Entry < TP, RR >= 2.0R) ─────────
  const rawBullEntryTop = unmitigatedBullFVG?.top || bullOB?.topPrice || lastPrice * 0.998;
  const rawBullEntryBottom = unmitigatedBullFVG?.bottom || bullOB?.bottomPrice || (rawBullEntryTop - bufferPips);
  const bullEntry = rawBullEntryTop;

  const rawBullSL = unmitigatedBullFVG?.bottom || bullOB?.bottomPrice || dealingRange?.rangeLow || (bullEntry - bufferPips * 3);
  const bullSL = Math.min(rawBullSL, bullEntry - bufferPips);
  const bullRisk = Math.max(bufferPips, bullEntry - bullSL);

  const minBullTarget = bullEntry + bullRisk * 2.0;
  const rawBullTarget = nearestBuyside && nearestBuyside.price > bullEntry ? nearestBuyside.price : minBullTarget;
  const targetBuysidePrice = Math.max(rawBullTarget, minBullTarget);
  const bullTarget1 = (bullEntry + targetBuysidePrice) / 2;

  const bullishScenario: TradingScenario = {
    id: `scenario-bull-${pipeline.calculationTimestamp}`,
    type: 'BULLISH',
    probabilityGrade: structure.currentTrend === 'BULLISH' ? 'HIGH_PROBABILITY' : 'CONDITIONAL',
    title: 'Bullish Continuation / Retracement Long Setup',
    narrative: `Evidence favors a bullish expansion toward buy-side liquidity (${targetBuysidePrice.toFixed(decimals)}) if price respects the discount dealing range and unmitigated institutional demand.`,
    conditionsRequired: [
      `Price must hold above the key swing low at ${bullSL.toFixed(decimals)}`,
      `Retracement into Bullish Demand Zone [${rawBullEntryBottom.toFixed(decimals)} - ${rawBullEntryTop.toFixed(decimals)}]`,
      'Lower timeframe rejection candle confirming demand absorption'
    ],
    invalidationTrigger: `Decisive candle close below ${bullSL.toFixed(decimals)} invalidates the bullish thesis and suggests structural shift to bearish.`,
    invalidationPrice: Number(bullSL.toFixed(decimals)),
    potentialTargets: [
      { label: 'Target 1 (Internal Liquidity)', price: Number(bullTarget1.toFixed(decimals)), description: '50% Dealing range equilibrium / intermediate swing high' },
      { label: 'Target 2 (Major Buy-Side Liquidity)', price: Number(targetBuysidePrice.toFixed(decimals)), description: 'Major Equal Highs / Previous Day High liquidity pool' }
    ],
    idealEntryZone: {
      topPrice: Number(rawBullEntryTop.toFixed(decimals)),
      bottomPrice: Number(rawBullEntryBottom.toFixed(decimals)),
      referenceZone: 'Unmitigated Bullish FVG + Order Block Discount Zone'
    }
  };

  // ── Bearish Scenario Geometry (TP < Entry < SL, RR >= 2.0R) ────────
  const rawBearEntryTop = unmitigatedBearFVG?.top || bearOB?.topPrice || (lastPrice * 1.002 + bufferPips);
  const rawBearEntryBottom = unmitigatedBearFVG?.bottom || bearOB?.bottomPrice || lastPrice * 1.002;
  const bearEntry = rawBearEntryBottom;

  const rawBearSL = unmitigatedBearFVG?.top || bearOB?.topPrice || dealingRange?.rangeHigh || (bearEntry + bufferPips * 3);
  const bearSL = Math.max(rawBearSL, bearEntry + bufferPips);
  const bearRisk = Math.max(bufferPips, bearSL - bearEntry);

  const minBearTarget = bearEntry - bearRisk * 2.0;
  const rawBearTarget = nearestSellside && nearestSellside.price < bearEntry ? nearestSellside.price : minBearTarget;
  const targetSellsidePrice = Math.min(rawBearTarget, minBearTarget);
  const bearTarget1 = (bearEntry + targetSellsidePrice) / 2;

  const bearishScenario: TradingScenario = {
    id: `scenario-bear-${pipeline.calculationTimestamp}`,
    type: 'BEARISH',
    probabilityGrade: structure.currentTrend === 'BEARISH' ? 'HIGH_PROBABILITY' : 'CONDITIONAL',
    title: 'Bearish Continuation / Liquidity Sweep Short Setup',
    narrative: `Evidence favors a bearish decline toward sell-side liquidity (${targetSellsidePrice.toFixed(decimals)}) if price rejects the premium dealing range or confirms a liquidity grab above highs.`,
    conditionsRequired: [
      `Price must remain capped below the key swing high at ${bearSL.toFixed(decimals)}`,
      `Rejection from Bearish Supply Zone [${rawBearEntryBottom.toFixed(decimals)} - ${rawBearEntryTop.toFixed(decimals)}]`,
      'Bearish Market Structure Shift (MSS) on execution timeframe'
    ],
    invalidationTrigger: `Decisive candle close above ${bearSL.toFixed(decimals)} violates bearish order flow and voids the short scenario.`,
    invalidationPrice: Number(bearSL.toFixed(decimals)),
    potentialTargets: [
      { label: 'Target 1 (Internal SSL)', price: Number(bearTarget1.toFixed(decimals)), description: 'Intermediate swing low sell-side liquidity' },
      { label: 'Target 2 (Major Sell-Side Liquidity)', price: Number(targetSellsidePrice.toFixed(decimals)), description: 'Major Equal Lows / Previous Day Low pool' }
    ],
    idealEntryZone: {
      topPrice: Number(rawBearEntryTop.toFixed(decimals)),
      bottomPrice: Number(rawBearEntryBottom.toFixed(decimals)),
      referenceZone: 'Unmitigated Bearish FVG + Premium Supply Zone'
    }
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
      summary: `Market condition is currently ${structure.currentTrend.toLowerCase()} on the ${timeframe} timeframe. HTF context is ${htfBias.toLowerCase()}. Price is trading at ${lastPrice.toFixed(4)} within the ${dealingRange?.currentZone || 'active'} dealing range.`
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
      nextTargetSummary: `Primary draw on liquidity is resting at ${structure.currentTrend === 'BULLISH' ? targetBuysidePrice.toFixed(4) + ' (Buy-side)' : targetSellsidePrice.toFixed(4) + ' (Sell-side)'}.`
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
        explanation: 'SMC relies on sequence of Higher Highs / Higher Lows (bullish) and Lower Highs / Lower Lows (bearish). Structural breaks are confirmed strictly by candle body closes beyond swing extremes.',
        chartApplication: `On this chart, the last confirmed swing high is at ${(dealingRange?.rangeHigh || 0).toFixed(4)} and swing low is at ${(dealingRange?.rangeLow || 0).toFixed(4)}.`
      },
      {
        concept: 'Fair Value Gap (FVG)',
        explanation: 'A 3-candle imbalance created when price aggressively expands, leaving an unpriced range between candle 1 and candle 3 wicks.',
        chartApplication: `There are currently ${unmitigatedFVGs.length} active unmitigated FVGs on this timeframe.`
      }
    ]
  };
}
