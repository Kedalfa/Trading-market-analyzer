import { Instrument } from '@/types/market';
import { RiskSettings, PositionCalculation, TradeIdea } from '@/types/trade';
import { StructuredSMCAnalysis } from '@/types/ai';

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  accountBalance: 25000,
  maxRiskPerTradePercent: 1.0,
  maxDailyLossPercent: 3.0,
  maxDrawdownPercent: 5.0,
  minRiskRewardRatio: 2.0
};

export function calculatePositionSize(
  instrument: Instrument,
  entryPrice: number,
  stopLossPrice: number,
  takeProfitPrice: number,
  settings: RiskSettings = DEFAULT_RISK_SETTINGS
): PositionCalculation {
  const riskAmountDollars = (settings.accountBalance * settings.maxRiskPerTradePercent) / 100;
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  const rewardDistance = Math.abs(takeProfitPrice - entryPrice);

  const stopDistancePips = instrument.pipSize > 0 ? stopDistance / instrument.pipSize : stopDistance;
  const riskRewardRatio = stopDistance > 0 ? Number((rewardDistance / stopDistance).toFixed(2)) : 0;

  // Calculate units and lot size based on asset class
  let units = 0;
  let lotSize = 0;

  if (stopDistance > 0) {
    units = riskAmountDollars / stopDistance;
    if (instrument.assetClass === 'forex') {
      lotSize = Number((units / 100000).toFixed(2)); // Standard lots
    } else if (instrument.assetClass === 'crypto') {
      lotSize = Number(units.toFixed(4));
    } else {
      lotSize = Number(units.toFixed(2));
    }
  }

  const potentialRewardDollars = units * rewardDistance;
  const riskWarnings: string[] = [];

  if (riskRewardRatio < settings.minRiskRewardRatio) {
    riskWarnings.push(`Risk/Reward ratio (${riskRewardRatio}R) is below minimum threshold of ${settings.minRiskRewardRatio}R`);
  }

  if (stopDistancePips <= 0) {
    riskWarnings.push('Invalid Stop Loss price: Stop distance cannot be zero.');
  }

  const isWithinRiskLimits = riskWarnings.length === 0;

  return {
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    riskAmountDollars: Number(riskAmountDollars.toFixed(2)),
    potentialRewardDollars: Number(potentialRewardDollars.toFixed(2)),
    stopDistance: Number(stopDistance.toFixed(5)),
    stopDistancePips: Number(stopDistancePips.toFixed(1)),
    riskRewardRatio,
    lotSize,
    units: Number(units.toFixed(2)),
    isWithinRiskLimits,
    riskWarnings
  };
}

export function createTradeIdeaFromAnalysis(
  analysis: StructuredSMCAnalysis,
  direction: 'LONG' | 'SHORT',
  instrument: Instrument,
  settings: RiskSettings = DEFAULT_RISK_SETTINGS
): TradeIdea {
  const scenario = direction === 'LONG' ? analysis.scenarios.bullish : analysis.scenarios.bearish;
  const entryPrice = direction === 'LONG' ? scenario.idealEntryZone.topPrice : scenario.idealEntryZone.bottomPrice;
  const stopLossPrice = scenario.invalidationPrice;
  const targetPrice = scenario.potentialTargets[1]?.price || scenario.potentialTargets[0]?.price || (direction === 'LONG' ? entryPrice * 1.02 : entryPrice * 0.98);

  const positionCalc = calculatePositionSize(instrument, entryPrice, stopLossPrice, targetPrice, settings);

  return {
    id: `trade-idea-${Date.now()}`,
    analysisId: analysis.analysisId,
    timestamp: Date.now(),
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    direction,
    setupType: `${analysis.rulesetUsed} - ${scenario.title}`,
    timeframe: analysis.timeframeHierarchy.intermediate,
    entryPrice: Number(entryPrice.toFixed(instrument.assetClass === 'forex' ? 5 : 2)),
    stopLossPrice: Number(stopLossPrice.toFixed(instrument.assetClass === 'forex' ? 5 : 2)),
    targetPrice: Number(targetPrice.toFixed(instrument.assetClass === 'forex' ? 5 : 2)),
    riskRewardRatio: positionCalc.riskRewardRatio,
    positionCalculation: positionCalc,
    evidenceSummary: analysis.structuralEvidence.bulletPoints.slice(0, 4),
    invalidationConditions: [scenario.invalidationTrigger],
    newsRestrictions: analysis.newsContext.riskWarning ? [analysis.newsContext.riskWarning] : [],
    status: 'PENDING'
  };
}
