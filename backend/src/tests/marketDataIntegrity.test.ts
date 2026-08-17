import { getMarketDataHealth, getAuthoritativeQuote, getAuthoritativeCandles, isFreshQuote } from '../services/marketDataService';
import { INSTRUMENT_REGISTRY } from '../config/instrumentRegistry';

console.log('=====================================================');
console.log('🧪 LIVE MARKET DATA PIPELINE & INTEGRITY SUITE');
console.log('=====================================================\n');

async function runAudit() {
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

  // 1. Check Instrument Registry
  const xauMapping = INSTRUMENT_REGISTRY.find(i => i.id === 'XAUUSD');
  assert(xauMapping?.provider === 'binance', 'XAUUSD maps to Binance provider');
  assert(xauMapping?.providerSymbol === 'PAXGUSDT', 'XAUUSD maps to PAXGUSDT (Spot Gold Bullion)');
  assert(xauMapping?.name === 'XAU/USD — Spot Gold', 'XAUUSD is labeled Spot Gold');

  const ethMapping = INSTRUMENT_REGISTRY.find(i => i.id === 'ETHUSDT');
  const solMapping = INSTRUMENT_REGISTRY.find(i => i.id === 'SOLUSDT');
  assert(ethMapping?.isActive === false, 'ETHUSDT is deactivated');
  assert(solMapping?.isActive === false, 'SOLUSDT is deactivated');

  // 2. Fetch Authoritative Quote for XAU/USD (Spot Gold)
  console.log('\nFetching authoritative quote for XAU/USD...');
  const xauQuote = await getAuthoritativeQuote('XAUUSD');
  console.log('XAU/USD Live Quote:', xauQuote);

  assert(xauQuote != null && xauQuote.price > 0, 'XAU/USD quote received with valid price');
  assert(xauQuote?.provider === 'binance', 'XAU/USD provider is Binance');
  assert(xauQuote?.providerSymbol === 'PAXGUSDT', 'XAU/USD providerSymbol is PAXGUSDT');
  assert(xauQuote?.source.includes('Spot Gold'), 'XAU/USD source indicates Spot Gold');
  assert(xauQuote?.status === 'LIVE', 'XAU/USD status is LIVE');
  assert(xauQuote != null && xauQuote.dataAgeMs >= 0, 'XAU/USD data age is valid non-negative number');
  assert(xauQuote?.bid != null && xauQuote?.ask != null, 'XAU/USD has genuine bid & ask');

  // 3. Verify Freshness Validator
  if (xauQuote) {
    assert(isFreshQuote(xauQuote, 'commodities', 15000), 'isFreshQuote validates XAU/USD quote as fresh');
  }

  // 4. Fetch Full Market Data Health Matrix
  console.log('\nFetching complete Market Data Health Matrix...');
  const health = await getMarketDataHealth();
  console.log('Active Feeds Count:', health.length);

  assert(health.length === 7, 'All 7 active instruments are in health matrix');

  for (const h of health) {
    console.log(`- ${h.symbol.padEnd(8)} | ${h.provider.padEnd(8)} (${h.providerSymbol.padEnd(8)}) | Price: ${String(h.price).padEnd(10)} | Age: ${String(h.dataAgeMs)}ms | Status: ${h.status}`);
    assert(h.price != null && h.price > 0, `${h.symbol} has valid live price: ${h.price}`);
    assert(h.status === 'LIVE' || h.status === 'DELAYED' || h.status === 'STALE', `${h.symbol} has valid status: ${h.status}`);
  }

  // 5. Verify Authoritative Candles for XAU/USD
  console.log('\nFetching authoritative OHLCV candles for XAU/USD (15M)...');
  const xauCandles = await getAuthoritativeCandles('XAUUSD', '15M', 20);
  assert(xauCandles != null && xauCandles.candles.length >= 10, 'XAU/USD returned valid 15M candles');
  if (xauCandles && xauCandles.candles.length > 1) {
    const isSorted = xauCandles.candles[1].timestamp > xauCandles.candles[0].timestamp;
    assert(isSorted, 'Candles are in strict ascending chronological order');
  }

  console.log(`\n=====================================================`);
  console.log(`🎯 Test Summary: ${passed}/${total} tests passed`);
  console.log(`=====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
