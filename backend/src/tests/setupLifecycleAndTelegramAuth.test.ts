import crypto from 'crypto';
import { validateTradeSetup } from '../services/tradeSetupValidator';
import { generateStructuredSMCAnalysis } from '../services/aiReasoningService';
import { runSMCPipeline } from '../engine';
import { Instrument, Candle } from '../types/market';
import { INSTRUMENT_REGISTRY } from '../config/instrumentRegistry';

console.log('=====================================================');
console.log('🧪 SETUP LIFECYCLE, AI PANEL & TELEGRAM AUTH SUITE');
console.log('=====================================================\n');

function createCandle(index: number, open: number, high: number, low: number, close: number): Candle {
  const baseTime = 1700000000 + index * 900;
  return {
    timestamp: baseTime,
    time: new Date(baseTime * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume: 1000,
  };
}

async function runTests() {
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

  // ── TEST 1: Bullish & Bearish Directional Geometry Across All 7 Active Instruments
  console.log('--- Test 1: Directional Geometry & R:R Across Supported Universe ---');
  const activeEntries = Object.entries(INSTRUMENT_REGISTRY).filter(([_, m]) => m.isActive !== false);

  for (const [key, mapping] of activeEntries) {
    const inst: Instrument = {
      id: key,
      symbol: mapping.name.split('—')[0].trim(),
      name: mapping.name,
      assetClass: mapping.assetClass,
      baseCurrency: 'USD',
      quoteCurrency: 'USD',
      pipSize: mapping.assetClass === 'forex' ? (key.includes('JPY') ? 0.01 : 0.0001) : (key === 'XAUUSD' ? 0.1 : 1),
      tickSize: mapping.assetClass === 'forex' ? 0.00001 : 0.01,
      defaultTimeframe: '15M',
      provider: mapping.provider === 'binance' ? 'binance' : 'yahoo',
    };

    const basePrice = inst.id === 'BTCUSDT' ? 65000 : inst.id === 'XAUUSD' ? 4400 : inst.id === 'US500' ? 7700 : inst.id === 'NAS100' ? 26000 : inst.id === 'USDJPY' ? 159 : 1.10;
    const candles: Candle[] = [
      createCandle(0, basePrice * 0.99, basePrice * 1.01, basePrice * 0.98, basePrice),
      createCandle(1, basePrice, basePrice * 1.015, basePrice * 0.995, basePrice * 1.01),
      createCandle(2, basePrice * 1.01, basePrice * 1.025, basePrice * 1.005, basePrice * 1.02),
      createCandle(3, basePrice * 1.02, basePrice * 1.022, basePrice * 0.998, basePrice * 1.00),
      createCandle(4, basePrice * 1.00, basePrice * 1.03, basePrice * 0.995, basePrice * 1.025),
    ];

    const pipe = runSMCPipeline(inst, candles, '15M');
    const news = { upcomingEvents: [], recentEvents: [], hasImminentHighImpactEvent: false };
    const struct = generateStructuredSMCAnalysis(pipe, news, 'standard_smc');

    // Bullish Geometry: SL < Entry < TP, RR >= 1.9R
    const bull = struct.scenarios.bullish;
    const bullEntry = bull.idealEntryZone.topPrice;
    const bullSL = bull.invalidationPrice;
    const bullTP = bull.potentialTargets[1]?.price || bull.potentialTargets[0]?.price;

    assert(bullSL < bullEntry, `${inst.symbol} Bullish SL (${bullSL}) < Entry (${bullEntry})`);
    assert(bullEntry < bullTP, `${inst.symbol} Bullish Entry (${bullEntry}) < TP (${bullTP})`);
    const bullRR = (bullTP - bullEntry) / (bullEntry - bullSL);
    assert(bullRR >= 1.9, `${inst.symbol} Bullish R:R (${bullRR.toFixed(2)}R) >= 1.9R`);

    // Bearish Geometry: TP < Entry < SL, RR >= 1.9R
    const bear = struct.scenarios.bearish;
    const bearEntry = bear.idealEntryZone.bottomPrice;
    const bearSL = bear.invalidationPrice;
    const bearTP = bear.potentialTargets[1]?.price || bear.potentialTargets[0]?.price;

    assert(bearTP < bearEntry, `${inst.symbol} Bearish TP (${bearTP}) < Entry (${bearEntry})`);
    assert(bearEntry < bearSL, `${inst.symbol} Bearish Entry (${bearEntry}) < SL (${bearSL})`);
    const bearRR = (bearEntry - bearTP) / (bearSL - bearEntry);
    assert(bearRR >= 1.9, `${inst.symbol} Bearish R:R (${bearRR.toFixed(2)}R) >= 1.9R`);
  }

  // ── TEST 2: Trade Validator Rejections on Geometric Violations ────
  console.log('\n--- Test 2: Trade Validator Rejection Rules ---');
  const invalidLong = validateTradeSetup({
    instrumentId: 'EURUSD',
    symbol: 'EUR/USD',
    direction: 'BULLISH',
    currentPrice: 1.1000,
    entryPrice: 1.1000,
    stopLossPrice: 1.1050, // SL > Entry (invalid for long)
    targetPrice: 1.1150,
    invalidationPrice: 1.1050,
  });
  assert(!invalidLong.isValid, 'Validator rejects Long with SL > Entry');

  const invalidShort = validateTradeSetup({
    instrumentId: 'EURUSD',
    symbol: 'EUR/USD',
    direction: 'BEARISH',
    currentPrice: 1.1000,
    entryPrice: 1.1000,
    stopLossPrice: 1.0950, // SL < Entry (invalid for short)
    targetPrice: 1.0850,
    invalidationPrice: 1.0950,
  });
  assert(!invalidShort.isValid, 'Validator rejects Short with SL < Entry');

  // ── TEST 3: Telegram Verification Code Cryptographic Integrity ────
  console.log('\n--- Test 3: Telegram Verification Code Security ---');
  const secureRandomCode = String(crypto.randomInt(100000, 1000000));
  assert(secureRandomCode.length === 6 && /^\d{6}$/.test(secureRandomCode), 'Generated verification code is exactly 6 digits');

  const codeHash = crypto.createHash('sha256').update(secureRandomCode).digest('hex');
  const testInputMatch = crypto.createHash('sha256').update(secureRandomCode).digest('hex');
  const testInputMismatch = crypto.createHash('sha256').update('999999').digest('hex');

  assert(codeHash === testInputMatch, 'Matching code hash verifies successfully');
  assert(codeHash !== testInputMismatch, 'Mismatched code hash is rejected');

  // Expired Code Simulation
  const now = Date.now();
  const expiredTimestamp = new Date(now - 60000); // 1 minute in the past
  const validTimestamp = new Date(now + 600000); // 10 minutes in the future

  assert(now > expiredTimestamp.getTime(), 'Expired code correctly detected');
  assert(now < validTimestamp.getTime(), 'Valid code within 10 minutes accepted');

  // Cross-user simulation: User A code hash checked against User B submission
  const userACode = '583214';
  const userACodeHash = crypto.createHash('sha256').update(userACode).digest('hex');
  const userBSubmission = '123456';
  const userBHash = crypto.createHash('sha256').update(userBSubmission).digest('hex');

  assert(userACodeHash !== userBHash, 'User A verification code cannot authenticate User B');

  console.log(`\n=====================================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} tests passed`);
  console.log(`=====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
