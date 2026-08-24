import mongoose from 'mongoose';
import { config } from '../config/config';
import { Analysis } from '../models/Analysis';

async function runAudit() {
  try {
    console.log('[Audit] Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);
    console.log('[Audit] Connected successfully.');

    const totalCount = await Analysis.countDocuments();
    console.log(`[Audit] Total Analysis records in database: ${totalCount}`);

    // 1. Check duplicate analysisId
    const idAgg = await Analysis.aggregate([
      { $group: { _id: '$analysisId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    console.log(`[Audit] Duplicate analysisId occurrences: ${idAgg.length}`);
    if (idAgg.length > 0) {
      console.log('[Audit] Duplicates by analysisId:', JSON.stringify(idAgg, null, 2));
    }

    // 2. Check duplicate structural fingerprint (symbol + timeframe + direction + entryPrice + stopLossPrice + targetPrice)
    const fingerprintAgg = await Analysis.aggregate([
      {
        $group: {
          _id: {
            symbol: '$symbol',
            timeframe: '$timeframe',
            direction: '$direction',
            entryPrice: '$entryPrice',
            stopLossPrice: '$stopLossPrice',
            targetPrice: '$targetPrice'
          },
          count: { $sum: 1 },
          ids: { $push: '$analysisId' },
          savedDates: { $push: '$savedAt' },
          statuses: { $push: '$outcome.status' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    console.log(`[Audit] Potential duplicate setups (identical fingerprint): ${fingerprintAgg.length}`);
    if (fingerprintAgg.length > 0) {
      console.log('[Audit] Duplicate setups details:');
      for (const item of fingerprintAgg) {
        console.log(`- ${item._id.symbol} (${item._id.timeframe}) ${item._id.direction} Entry: ${item._id.entryPrice}, SL: ${item._id.stopLossPrice}, TP: ${item._id.targetPrice} | Count: ${item.count} | IDs: ${item.ids.join(', ')}`);
      }
    }

    // 3. Status distribution
    const statusDist = await Analysis.aggregate([
      { $group: { _id: '$outcome.status', count: { $sum: 1 } } }
    ]);
    console.log('[Audit] Status distribution:');
    for (const s of statusDist) {
      console.log(`  ${s._id || 'UNDEFINED'}: ${s.count}`);
    }

    // 4. Instrument breakdown
    const instDist = await Analysis.aggregate([
      { $group: { _id: '$symbol', count: { $sum: 1 } } }
    ]);
    console.log('[Audit] Symbol breakdown:');
    for (const inst of instDist) {
      console.log(`  ${inst._id}: ${inst.count}`);
    }

    await mongoose.disconnect();
    console.log('[Audit] Completed and disconnected.');
  } catch (err) {
    console.error('[Audit] Error running audit:', err);
    process.exit(1);
  }
}

runAudit();
