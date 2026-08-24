import mongoose from 'mongoose';
import { config } from '../config/config';
import { Analysis, IAnalysis } from '../models/Analysis';
import { evaluateAnalysisOutcome, TERMINAL_STATUSES } from '../services/analysisOutcomeMonitor';

console.log('=====================================================');
console.log('🧪 SMC DETERMINISTIC INVALIDATION & LIFECYCLE SUITE');
console.log('=====================================================\n');

async function runLifecycleTests() {
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
  await Analysis.deleteMany({ analysisId: { $regex: /^TEST-/ } });

  const nowSec = Math.floor(Date.now() / 1000);

  function createMockAnalysis(id: string, overrides: Partial<IAnalysis> = {}): IAnalysis {
    return new Analysis({
      analysisId: id,
      symbol: 'EUR/USD',
      instrumentId: 'EURUSD',
      timeframe: '15M',
      htfTimeframe: '4H',
      currentPrice: 1.0870,
      rulesetUsed: 'standard_smc',
      direction: 'BULLISH',
      entryPrice: 1.0850,
      stopLossPrice: 1.0830,
      targetPrice: 1.0900,
      invalidationPrice: 1.0830,
      riskRewardRatio: 2.5,
      htfBias: 'BULLISH',
      intermediateStructure: 'BULLISH',
      structuralEvidence: ['Bullish FVG at displacement origin'],
      conflictingSignals: [],
      bullishScenario: {},
      bearishScenario: {},
      setupQuality: { totalScore: 85, grade: 'A', components: [] },
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
            triggerReason: 'Initial setup created',
            observedPrice: 1.0870,
          },
        ],
      },
      ...overrides,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A: Valid setup -> Price approaches entry -> Entry reached -> Active
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario A: Clean Entry Progression (Approaching -> Entry Reached) ---');
  const setupA = createMockAnalysis('TEST-A-EURUSD-01');
  await setupA.save();

  // 1. Tick: Price at 1.0853 (Within 5 pips proximity -> Approaching)
  await evaluateAnalysisOutcome(setupA, [], { price: 1.0853, bid: 1.0852, ask: 1.0853 });
  assert(setupA.outcome.status === 'WAITING_FOR_ENTRY' && setupA.outcome.isApproachingEntry === true, 'TEST A.1: Approaching entry sub-state activated when within threshold');

  // 2. Tick: Price touches 1.0850 via executable Ask -> Entry Reached
  await evaluateAnalysisOutcome(setupA, [], { price: 1.0850, bid: 1.0849, ask: 1.0850 });
  assert(setupA.outcome.status === 'ENTRY_REACHED', 'TEST A.2: Status transitions to ENTRY_REACHED when Ask touches entry');
  assert(setupA.outcome.entryReachedAt != null, 'TEST A.3: entryReachedAt timestamp is recorded');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B: Pre-entry structural invalidation occurs before entry -> INVALIDATED
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario B: Pre-Entry Structural Invalidation (Priority Over Entry) ---');
  const setupB = createMockAnalysis('TEST-B-EURUSD-02');
  await setupB.save();

  // Price gaps down below invalidation (open 1.0820 < SL 1.0830) without filling entry
  const candleB = [
    { timestamp: nowSec + 60, open: 1.0820, high: 1.0825, low: 1.0815, close: 1.0818, volume: 1000 }
  ];
  await evaluateAnalysisOutcome(setupB, candleB, { price: 1.0818, bid: 1.0817, ask: 1.0818 });
  assert(setupB.outcome.status === 'INVALIDATED', 'TEST B.1: Setup is marked INVALIDATED (not Stopped Out) before entry');
  assert(setupB.outcome.invalidatedReason?.includes('invalidation'), 'TEST B.2: Precise structural invalidation reason is recorded');
  assert(setupB.outcome.entryReachedAt == null, 'TEST B.3: entryReachedAt remains unset');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C: Waiting Entry -> Invalidation occurs -> Disappears from Waiting Entry
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario C: Immediate Removal from Waiting Setups upon Invalidation ---');
  const setupC = createMockAnalysis('TEST-C-EURUSD-03');
  await setupC.save();

  const activeBeforeC = await Analysis.find({ 'outcome.status': { $in: ['OPEN', 'WAITING_FOR_ENTRY', 'APPROACHING_ENTRY'] } });
  assert(activeBeforeC.some(a => a.analysisId === 'TEST-C-EURUSD-03'), 'TEST C.1: Setup is present in active waiting list initially');

  // Trigger invalidation
  await evaluateAnalysisOutcome(setupC, [], { price: 1.0810, bid: 1.0809, ask: 1.0810 });
  const activeAfterC = await Analysis.find({ 'outcome.status': { $in: ['OPEN', 'WAITING_FOR_ENTRY', 'APPROACHING_ENTRY'] } });
  assert(!activeAfterC.some(a => a.analysisId === 'TEST-C-EURUSD-03'), 'TEST C.2: Setup immediately disappears from waiting list upon invalidation');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D: Invalidated setup -> Price later touches old entry -> MUST Remain INVALIDATED
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario D: Terminal Invalidation Immutability (Never Re-activates) ---');
  const setupD = createMockAnalysis('TEST-D-EURUSD-04');
  await setupD.save();

  // Invalidate first
  await evaluateAnalysisOutcome(setupD, [], { price: 1.0820, bid: 1.0819, ask: 1.0820 });
  assert(setupD.outcome.status === 'INVALIDATED', 'TEST D.1: Setup invalidated');

  // Price later bounces back and hits the old entry level (1.0850)
  await evaluateAnalysisOutcome(setupD, [], { price: 1.0850, bid: 1.0849, ask: 1.0850 });
  assert(setupD.outcome.status === 'INVALIDATED', 'TEST D.2: Status remains strictly INVALIDATED even after price visits entry');
  assert(setupD.outcome.entryReachedAt == null, 'TEST D.3: entryReachedAt was never set');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E: Entry Reached -> Price reaches SL -> STOPPED_OUT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario E: Post-Entry Stop Loss (STOPPED_OUT, not Invalidated) ---');
  const setupE = createMockAnalysis('TEST-E-EURUSD-05');
  await setupE.save();

  // 1. Enter trade
  await evaluateAnalysisOutcome(setupE, [], { price: 1.0850, bid: 1.0849, ask: 1.0850 });
  assert(setupE.outcome.status === 'ENTRY_REACHED', 'TEST E.1: Trade is active');

  // 2. Price hits SL (1.0830)
  await evaluateAnalysisOutcome(setupE, [], { price: 1.0829, bid: 1.0828, ask: 1.0829 });
  assert(setupE.outcome.status === 'STOPPED_OUT', 'TEST E.2: Post-entry loss is marked STOPPED_OUT (not Invalidated)');
  assert(setupE.outcome.stoppedOutAt != null, 'TEST E.3: stoppedOutAt is recorded');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST F: Entry Reached -> Price reaches TP -> TARGET_HIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario F: Post-Entry Take Profit (TARGET_HIT) ---');
  const setupF = createMockAnalysis('TEST-F-EURUSD-06');
  await setupF.save();

  // 1. Enter trade
  await evaluateAnalysisOutcome(setupF, [], { price: 1.0850, bid: 1.0849, ask: 1.0850 });
  // 2. Hit target (1.0900)
  await evaluateAnalysisOutcome(setupF, [], { price: 1.0905, bid: 1.0904, ask: 1.0905 });
  assert(setupF.outcome.status === 'TARGET_HIT', 'TEST F.1: Status transitions to TARGET_HIT');
  assert(setupF.outcome.targetHitAt != null, 'TEST F.2: targetHitAt is recorded');
  assert(setupF.outcome.maxFavorableExcursion! > 0, 'TEST F.3: Max Favorable Excursion (MFE) is recorded');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST G: Same-Candle Conflict Resolution (Ambiguous bar without guessing)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario G: Same-Candle Entry & Invalidation Conflict ---');
  const setupG = createMockAnalysis('TEST-G-EURUSD-07');
  await setupG.save();

  // Candle spans both entry (1.0850) and stop (1.0830) starting from 1.0870
  const conflictCandle = [
    { timestamp: nowSec + 120, open: 1.0870, high: 1.0875, low: 1.0825, close: 1.0835, volume: 2000 }
  ];
  await evaluateAnalysisOutcome(setupG, conflictCandle, { price: 1.0835, bid: 1.0834, ask: 1.0835 });
  assert(setupG.outcome.status === 'AMBIGUOUS', 'TEST G.1: Dual-breach same-bar event marked AMBIGUOUS (never falsely claimed Entry Reached)');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST H: Idempotency (Multiple monitoring cycles on identical market state)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario H: Idempotency & Audit Trail Deduplication ---');
  const setupH = createMockAnalysis('TEST-H-EURUSD-08');
  await setupH.save();

  // Trigger Entry
  await evaluateAnalysisOutcome(setupH, [], { price: 1.0850, bid: 1.0849, ask: 1.0850 });
  const auditLength1 = setupH.outcome.auditTrail.length;

  // Run 5 identical cycles
  for (let i = 0; i < 5; i++) {
    await evaluateAnalysisOutcome(setupH, [], { price: 1.0850, bid: 1.0849, ask: 1.0850 });
  }
  assert(setupH.outcome.auditTrail.length === auditLength1, 'TEST H.1: Multiple monitoring cycles produce no duplicate audit transitions');
  assert(setupH.outcome.status === 'ENTRY_REACHED', 'TEST H.2: State remains stable across redundant evaluations');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST I: Setup Expiration (Stale setups past validity window)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario I: Setup Expiration (Stale Window Elapsed) ---');
  const staleDate = new Date(Date.now() - 75 * 3600 * 1000); // 75 hours ago
  const setupI = createMockAnalysis('TEST-I-EURUSD-09', { savedAt: staleDate });
  await setupI.save();

  await evaluateAnalysisOutcome(setupI, [], { price: 1.0870, bid: 1.0869, ask: 1.0870 });
  assert(setupI.outcome.status === 'INVALIDATED', 'TEST I.1: Stale setup transitioned to INVALIDATED');
  assert(setupI.outcome.invalidatedReason?.includes('SETUP_EXPIRED'), 'TEST I.2: Invalidation reason is SETUP_EXPIRED');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST J: Independent Setups on Same Instrument
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario J: Multi-Setup Isolation on Same Instrument ---');
  const setupJ1 = createMockAnalysis('TEST-J-EURUSD-10-LONG', {
    direction: 'BULLISH',
    entryPrice: 1.0850,
    stopLossPrice: 1.0830,
    invalidationPrice: 1.0830,
  });
  const setupJ2 = createMockAnalysis('TEST-J-EURUSD-11-SHORT', {
    direction: 'BEARISH',
    entryPrice: 1.0920,
    stopLossPrice: 1.0950,
    invalidationPrice: 1.0950,
    targetPrice: 1.0850,
  });
  await setupJ1.save();
  await setupJ2.save();

  // Invalidate J1 by dropping price below 1.0830
  await evaluateAnalysisOutcome(setupJ1, [], { price: 1.0820, bid: 1.0819, ask: 1.0820 });
  assert(setupJ1.outcome.status === 'INVALIDATED', 'TEST J.1: Long setup invalidated by downward drop');

  // J2 (Short setup) is evaluated with same tick -> should still be WAITING_FOR_ENTRY
  await evaluateAnalysisOutcome(setupJ2, [], { price: 1.0820, bid: 1.0819, ask: 1.0820 });
  assert(setupJ2.outcome.status === 'WAITING_FOR_ENTRY', 'TEST J.2: Short setup remains valid and waiting (unaffected by J1)');

  // Clean up test documents
  await Analysis.deleteMany({ analysisId: { $regex: /^TEST-/ } });
  await mongoose.disconnect();

  console.log(`\n=====================================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} lifecycle tests passed`);
  console.log(`=====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runLifecycleTests().catch(err => {
  console.error('Lifecycle test failed with error:', err);
  process.exit(1);
});
