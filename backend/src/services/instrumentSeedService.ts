/**
 * Instrument seed service — idempotent upsert of instrument metadata to MongoDB.
 * Run once at server startup (and safe to re-run).
 */

import { Instrument } from '../models/Instrument';
import { INSTRUMENT_SEED } from '../config/instrumentSeed';

export async function seedInstruments(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const inst of INSTRUMENT_SEED) {
    const existing = await Instrument.findOne({ id: inst.id });
    if (!existing) {
      await Instrument.create(inst);
      created++;
    } else {
      // Update mutable fields (not id/symbol/assetClass which are stable)
      existing.name = inst.name;
      existing.pipSize = inst.pipSize;
      existing.tickSize = inst.tickSize;
      existing.defaultTimeframe = inst.defaultTimeframe;
      existing.provider = inst.provider as 'binance' | 'yahoo' | 'custom';
      existing.isActive = inst.isActive;
      await existing.save();
      updated++;
    }
  }

  if (created > 0 || updated > 0) {
    console.log(`[Seed] Instruments: ${created} created, ${updated} updated`);
  }
}
