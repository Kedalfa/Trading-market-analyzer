import mongoose from 'mongoose';
import { config } from '../config/config';
import { Analysis } from '../models/Analysis';
import { TradeIdea } from '../models/TradeIdea';

async function resetTradeHistory() {
  try {
    console.log('=====================================================');
    console.log('🧹 SMC TRADE & ANALYSIS HISTORY RESET');
    console.log('=====================================================');
    console.log('[Reset] Connecting to MongoDB at', config.mongoUri);
    await mongoose.connect(config.mongoUri);
    console.log('[Reset] Connected successfully.');

    // Count before deletion
    const beforeAnalysisCount = await Analysis.countDocuments();
    const beforeTradeIdeaCount = await TradeIdea.countDocuments();
    console.log(`[Reset] Found ${beforeAnalysisCount} Analysis records.`);
    console.log(`[Reset] Found ${beforeTradeIdeaCount} TradeIdea records.`);

    // Delete all analyses and trade ideas
    const deletedAnalyses = await Analysis.deleteMany({});
    const deletedTradeIdeas = await TradeIdea.deleteMany({});

    console.log(`[Reset] Deleted ${deletedAnalyses.deletedCount} Analysis records.`);
    console.log(`[Reset] Deleted ${deletedTradeIdeas.deletedCount} TradeIdea records.`);

    // Verify clean state
    const afterAnalysisCount = await Analysis.countDocuments();
    const afterTradeIdeaCount = await TradeIdea.countDocuments();

    console.log('-----------------------------------------------------');
    console.log(`[Verification] Remaining Analysis records: ${afterAnalysisCount}`);
    console.log(`[Verification] Remaining TradeIdea records: ${afterTradeIdeaCount}`);

    if (afterAnalysisCount === 0 && afterTradeIdeaCount === 0) {
      console.log('✅ [SUCCESS] All trade & analysis records have been completely purged.');
      console.log('✅ [SUCCESS] Ready for fresh, structure-driven SMC setup detection.');
    } else {
      console.error('❌ [FAILURE] Records still exist in database!');
      process.exit(1);
    }

    console.log('=====================================================');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[Reset] Fatal error during trade history reset:', err);
    process.exit(1);
  }
}

resetTradeHistory();
