import mongoose from 'mongoose';
import { config } from '../config/config';
import { Analysis, IAnalysis } from '../models/Analysis';
import { evaluateAnalysisOutcome } from '../services/analysisOutcomeMonitor';

console.log('=====================================================');
console.log('🧪 OFFLINE / RECONNECT RECOVERY & HISTORICAL REPLAY');
console.log('=====================================================\n');

async function runOfflineRecoveryTests() {
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
  await Analysis.deleteMany({ analysisId: { $regex: /^RECOVERY-/ } });

  const nowSec = Math.floor(Date.now() / 1000);
  const baseTimeSec = nowSec - 7200; // Setup created 2 hours ago

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
      savedAt: new Date(baseTimeSec * 1000),
      outcome: {
        status: 'WAITING_FOR_ENTRY',
        monitoringStatus: 'Waiting for Entry',
        lastProcessedBarTimestamp: baseTimeSec,
        auditTrail: [
          {
            previousStatus: 'NEW',
            newStatus: 'WAITING_FOR_ENTRY',
            timestamp: new Date(baseTimeSec * 1000),
            triggerReason: 'Initial setup created before disconnect',
            observedPrice: 1.0870,
          },
        ],
      },
      ...overrides,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Offline Entry Reached during disconnection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 1: Entry Reached During Offline Outage ---');
  const setup1 = createMockAnalysis('RECOVERY-01-ENTRY');
  await setup1.save();

  // Replayed historical bars missed while offline (Bar 1: 1.0865, Bar 2 touches entry 1.0850)
  const missedBars1 = [
    { timestamp: baseTimeSec + 900, open: 1.0870, high: 1.0872, low: 1.0860, close: 1.0865, volume: 1000 },
    { timestamp: baseTimeSec + 1800, open: 1.0865, high: 1.0868, low: 1.0848, close: 1.0852, volume: 1500 }, // Touched entry 1.0850
    { timestamp: baseTimeSec + 2700, open: 1.0852, high: 1.0858, low: 1.0850, close: 1.0855, volume: 1200 },
  ];

  await evaluateAnalysisOutcome(setup1, missedBars1, { price: 1.0855, bid: 1.0854, ask: 1.0855 }, true);
  assert(setup1.outcome.status === 'ENTRY_REACHED', 'Test 1.1: Replayed entry touch transitions to ENTRY_REACHED');
  assert(setup1.outcome.entryReachedAt?.getTime() === (baseTimeSec + 1800) * 1000, 'Test 1.2: Exact historical bar timestamp recorded as entryReachedAt');
  assert(setup1.outcome.lastProcessedBarTimestamp === baseTimeSec + 2700, 'Test 1.3: lastProcessedBarTimestamp updated to latest replayed bar');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Offline Pre-Entry Invalidation (Priority over later price movement)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 2: Pre-Entry Invalidation During Offline Outage ---');
  const setup2 = createMockAnalysis('RECOVERY-02-INVALIDATED');
  await setup2.save();

  // Replayed bars: Bar 1 opens below invalidation (1.0820 < 1.0830)
  const missedBars2 = [
    { timestamp: baseTimeSec + 900, open: 1.0820, high: 1.0825, low: 1.0815, close: 1.0818, volume: 2000 },
    { timestamp: baseTimeSec + 1800, open: 1.0818, high: 1.0855, low: 1.0815, close: 1.0850, volume: 3000 }, // Bounces back to entry later
  ];

  await evaluateAnalysisOutcome(setup2, missedBars2, { price: 1.0850, bid: 1.0849, ask: 1.0850 }, true);
  assert(setup2.outcome.status === 'INVALIDATED', 'Test 2.1: Pre-entry invalidation recognized during replay');
  assert(setup2.outcome.resolvedAt?.getTime() === (baseTimeSec + 900) * 1000, 'Test 2.2: Exact invalidation timestamp preserved');
  assert(setup2.outcome.entryReachedAt == null, 'Test 2.3: Later price bounce to entry does NOT activate invalidated setup');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Full Trade Lifecycle Offline (Waiting -> Entry Reached -> Target Hit)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 3: Full Multi-Bar Lifecycle Replay (Entry -> Target Hit) ---');
  const setup3 = createMockAnalysis('RECOVERY-03-FULL-TP');
  await setup3.save();

  const missedBars3 = [
    { timestamp: baseTimeSec + 900, open: 1.0865, high: 1.0868, low: 1.0848, close: 1.0852, volume: 1500 },  // Bar 1: Touches entry (1.0850)
    { timestamp: baseTimeSec + 1800, open: 1.0852, high: 1.0880, low: 1.0851, close: 1.0875, volume: 2000 }, // Bar 2: Expands in profit
    { timestamp: baseTimeSec + 2700, open: 1.0875, high: 1.0905, low: 1.0870, close: 1.0902, volume: 2500 }, // Bar 3: Hits TP (1.0900)
  ];

  await evaluateAnalysisOutcome(setup3, missedBars3, { price: 1.0902, bid: 1.0901, ask: 1.0902 }, true);
  assert(setup3.outcome.status === 'TARGET_HIT', 'Test 3.1: Sequential replay recovers complete trade to TARGET_HIT');
  assert(setup3.outcome.entryReachedAt?.getTime() === (baseTimeSec + 900) * 1000, 'Test 3.2: Entry timestamp preserved from Bar 1');
  assert(setup3.outcome.targetHitAt?.getTime() === (baseTimeSec + 2700) * 1000, 'Test 3.3: Target Hit timestamp preserved from Bar 3');
  assert(setup3.outcome.maxFavorableExcursion! > 0, 'Test 3.4: Max Favorable Excursion calculated across replayed bars');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Full Trade Lifecycle Offline (Waiting -> Entry Reached -> Stopped Out)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 4: Full Multi-Bar Lifecycle Replay (Entry -> Stopped Out) ---');
  const setup4 = createMockAnalysis('RECOVERY-04-FULL-SL');
  await setup4.save();

  const missedBars4 = [
    { timestamp: baseTimeSec + 900, open: 1.0865, high: 1.0868, low: 1.0848, close: 1.0852, volume: 1500 },  // Bar 1: Touches entry (1.0850)
    { timestamp: baseTimeSec + 1800, open: 1.0852, high: 1.0855, low: 1.0825, close: 1.0828, volume: 2000 }, // Bar 2: Plunges and hits SL (1.0830)
  ];

  await evaluateAnalysisOutcome(setup4, missedBars4, { price: 1.0828, bid: 1.0827, ask: 1.0828 }, true);
  assert(setup4.outcome.status === 'STOPPED_OUT', 'Test 4.1: Sequential replay recovers trade to STOPPED_OUT');
  assert(setup4.outcome.entryReachedAt?.getTime() === (baseTimeSec + 900) * 1000, 'Test 4.2: Entry timestamp preserved from Bar 1');
  assert(setup4.outcome.stoppedOutAt?.getTime() === (baseTimeSec + 1800) * 1000, 'Test 4.3: Stopped Out timestamp preserved from Bar 2');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Same-Bar Dual Breach Disambiguation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 5: Ambiguous Same-Bar Dual Breach Replay ---');
  const setup5 = createMockAnalysis('RECOVERY-05-AMBIGUOUS');
  await setup5.save();

  const ambiguousBar = [
    { timestamp: baseTimeSec + 900, open: 1.0870, high: 1.0875, low: 1.0825, close: 1.0835, volume: 3000 } // Spans entry (1.0850) and stop (1.0830)
  ];

  await evaluateAnalysisOutcome(setup5, ambiguousBar, { price: 1.0835, bid: 1.0834, ask: 1.0835 }, true);
  assert(setup5.outcome.status === 'AMBIGUOUS', 'Test 5.1: Ambiguous single-bar breach correctly flagged AMBIGUOUS');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Recovery Idempotency (Repeated Replay Passes on Same Window)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 6: Replay Idempotency across Redundant Passes ---');
  const setup6 = createMockAnalysis('RECOVERY-06-IDEMPOTENT');
  await setup6.save();

  // Pass 1
  await evaluateAnalysisOutcome(setup6, missedBars3, { price: 1.0902, bid: 1.0901, ask: 1.0902 }, true);
  const auditCount1 = setup6.outcome.auditTrail.length;
  const status1 = setup6.outcome.status;

  // Pass 2 (Redundant replay pass on identical market data)
  await evaluateAnalysisOutcome(setup6, missedBars3, { price: 1.0902, bid: 1.0901, ask: 1.0902 }, true);
  assert(setup6.outcome.status === status1, 'Test 6.1: State remains unchanged on repeated recovery passes');
  assert(setup6.outcome.auditTrail.length === auditCount1, 'Test 6.2: Zero duplicate audit entries created during redundant replay');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Stale Setup Expiration during Extended Offline Outage
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Recovery Test 7: Stale Expiration after Extended Outage ---');
  const oldCreationDate = new Date(Date.now() - 80 * 3600 * 1000); // 80 hours ago
  const setup7 = createMockAnalysis('RECOVERY-07-EXPIRED', { savedAt: oldCreationDate });
  await setup7.save();

  await evaluateAnalysisOutcome(setup7, [], { price: 1.0870, bid: 1.0869, ask: 1.0870 }, true);
  assert(setup7.outcome.status === 'INVALIDATED', 'Test 7.1: Stale setup cleanly marked INVALIDATED upon reconnect');
  assert(setup7.outcome.invalidatedReason?.includes('SETUP_EXPIRED'), 'Test 7.2: Invalidation reason is SETUP_EXPIRED');

  // Clean up test documents
  await Analysis.deleteMany({ analysisId: { $regex: /^RECOVERY-/ } });
  await mongoose.disconnect();

  console.log(`\n=====================================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} offline recovery tests passed`);
  console.log(`=====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runOfflineRecoveryTests().catch(err => {
  console.error('Offline recovery test failed with error:', err);
  process.exit(1);
});
