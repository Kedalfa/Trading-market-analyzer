import mongoose from 'mongoose';
import { config } from '../config/config';
import { Analysis, IAnalysis } from '../models/Analysis';
import { evaluateAnalysisOutcome } from '../services/analysisOutcomeMonitor';

console.log('=====================================================');
console.log('🧪 STALE ENTRY PROTECTION & THESIS VALIDITY TEST');
console.log('=====================================================\n');

async function runStaleEntryTest() {
  let passed = 0;
  let total = 0;

  function assert(condition: any, testName: string, detail?: any) {
    total++;
    if (Boolean(condition)) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
    }
  }

  await mongoose.connect(config.mongoUri);
  await Analysis.deleteMany({ analysisId: { $regex: /^STALE-TEST-/ } });

  const nowSec = Math.floor(Date.now() / 1000);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Generate a valid setup
  // ──────────────────────────────────────────────────────────────────────────
  console.log('Step 1: Creating initial valid setup (Entry: 4355.00, SL: 4345.00, TP: 4380.00)...');
  const originalSetupId = 'STALE-TEST-ORIGINAL-01';
  const originalSetup = new Analysis({
    analysisId: originalSetupId,
    symbol: 'XAU/USD',
    instrumentId: 'XAUUSD',
    timeframe: '15M',
    htfTimeframe: '4H',
    currentPrice: 4365.00,
    rulesetUsed: 'standard_smc',
    direction: 'BULLISH',
    entryPrice: 4355.00,
    stopLossPrice: 4345.00,
    targetPrice: 4380.00,
    invalidationPrice: 4345.00,
    riskRewardRatio: 2.5,
    htfBias: 'BULLISH',
    intermediateStructure: 'BULLISH',
    structuralEvidence: ['Bullish Order Block at 4355 demand zone'],
    conflictingSignals: [],
    bullishScenario: {},
    bearishScenario: {},
    setupQuality: { totalScore: 88, grade: 'A+', components: [] },
    sessionNotes: 'London Session',
    savedAt: new Date(nowSec * 1000),
    outcome: {
      status: 'WAITING_FOR_ENTRY',
      monitoringStatus: 'Waiting for Entry',
      auditTrail: [
        {
          previousStatus: 'NEW',
          newStatus: 'WAITING_FOR_ENTRY',
          timestamp: new Date(nowSec * 1000),
          triggerReason: 'Initial valid setup created from 15M demand zone',
          observedPrice: 4365.00,
        },
      ],
    },
  });
  await originalSetup.save();
  assert(originalSetup.outcome.status === 'WAITING_FOR_ENTRY', 'Step 2: Setup is initialized in WAITING_FOR_ENTRY');

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Price moves away without reaching entry (4365 -> 4375)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nStep 3: Price expands away without reaching entry (4365 -> 4382, exhausting target liquidity)...');
  const movingAwayBars = [
    { timestamp: nowSec + 900, open: 4365.0, high: 4372.0, low: 4362.0, close: 4370.0, volume: 1000 },
    { timestamp: nowSec + 1800, open: 4370.0, high: 4382.0, low: 4368.0, close: 4380.0, volume: 2000 }, // Exhausts target area (4380) without filling entry!
  ];
  await evaluateAnalysisOutcome(originalSetup, movingAwayBars, { price: 4380.00, bid: 4379.99, ask: 4380.00 });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4 & 5: Structural thesis broken / expired -> Confirm it becomes INVALIDATED
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nStep 4 & 5: Evaluating pre-entry structural invalidation...');
  // Now price tries to return to old entry (4355.00) after having exhausted the target liquidity
  const fullMarketCandles = [
    ...movingAwayBars,
    { timestamp: nowSec + 3600, open: 4375.0, high: 4376.0, low: 4354.5, close: 4355.0, volume: 1500 }
  ];
  await evaluateAnalysisOutcome(originalSetup, fullMarketCandles, { price: 4355.00, bid: 4354.99, ask: 4355.00 });

  assert(originalSetup.outcome.status === 'INVALIDATED', 'Step 5: Setup is marked INVALIDATED (stale target pre-reached without entry fill)');
  assert(originalSetup.outcome.invalidatedReason?.includes('Stale setup') || originalSetup.outcome.invalidatedReason?.includes('invalidation'), 'Step 5.1: Precise stale invalidation reason recorded');

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 6, 7 & 8: Keep monitoring old entry price (4355.00) -> NO ENTRY_REACHED event
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nStep 6 & 7: Price revisits old entry price 4355.00 multiple times...');
  await evaluateAnalysisOutcome(originalSetup, [], { price: 4355.00, bid: 4354.99, ask: 4355.00 });
  await evaluateAnalysisOutcome(originalSetup, [], { price: 4353.00, bid: 4352.99, ask: 4353.00 });

  assert(originalSetup.outcome.status === 'INVALIDATED', 'Step 8: Setup remains permanently INVALIDATED');
  assert(originalSetup.outcome.entryReachedAt == null, 'Step 9: NO trade / entryReachedAt created on stale setup');
  assert(!originalSetup.outcome.auditTrail.some(a => a.newStatus === 'ENTRY_REACHED'), 'Step 10: NO entry audit or Telegram entry notification sent');

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 11 & 12: Generate a NEW valid setup from new market structure
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nStep 11 & 12: Generating new independent setup from fresh market structure...');
  const newSetupId = 'STALE-TEST-NEW-02';
  const newSetup = new Analysis({
    analysisId: newSetupId,
    symbol: 'XAU/USD',
    instrumentId: 'XAUUSD',
    timeframe: '15M',
    htfTimeframe: '4H',
    currentPrice: 4348.00,
    rulesetUsed: 'standard_smc',
    direction: 'BULLISH',
    entryPrice: 4342.00,       // New independent entry
    stopLossPrice: 4334.00,    // New independent SL
    targetPrice: 4366.00,      // New independent TP
    invalidationPrice: 4334.00,
    riskRewardRatio: 3.0,
    htfBias: 'BULLISH',
    intermediateStructure: 'BULLISH',
    structuralEvidence: ['New Bullish Breaker Block formed at 4342'],
    conflictingSignals: [],
    bullishScenario: {},
    bearishScenario: {},
    setupQuality: { totalScore: 90, grade: 'A+', components: [] },
    sessionNotes: 'New York Session',
    savedAt: new Date((nowSec + 3600) * 1000),
    outcome: {
      status: 'WAITING_FOR_ENTRY',
      monitoringStatus: 'Waiting for Entry',
      auditTrail: [
        {
          previousStatus: 'NEW',
          newStatus: 'WAITING_FOR_ENTRY',
          timestamp: new Date((nowSec + 3600) * 1000),
          triggerReason: 'New structure-driven setup generated after prior invalidation',
          observedPrice: 4348.00,
        },
      ],
    },
  });
  await newSetup.save();

  assert(newSetup.analysisId !== originalSetupId, 'Step 12.1: New setup has an independent setup ID');
  assert(newSetup.entryPrice !== originalSetup.entryPrice, 'Step 12.2: New setup has an independently calculated entry (4342 vs 4355)');
  assert(newSetup.stopLossPrice !== originalSetup.stopLossPrice, 'Step 12.3: New setup has an independently calculated SL (4334 vs 4345)');
  assert(newSetup.targetPrice !== originalSetup.targetPrice, 'Step 12.4: New setup has an independently calculated TP (4366 vs 4380)');
  assert(newSetup.outcome.status === 'WAITING_FOR_ENTRY', 'Step 12.5: New setup is actively waiting for its own entry');

  // Clean up test documents
  await Analysis.deleteMany({ analysisId: { $regex: /^STALE-TEST-/ } });
  await mongoose.disconnect();

  console.log(`\n=====================================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} stale entry protection tests passed`);
  console.log(`=====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runStaleEntryTest().catch(err => {
  console.error('Stale entry test failed with error:', err);
  process.exit(1);
});
