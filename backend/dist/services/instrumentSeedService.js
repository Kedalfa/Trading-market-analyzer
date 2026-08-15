"use strict";
/**
 * Instrument seed service — idempotent upsert of instrument metadata to MongoDB.
 * Run once at server startup (and safe to re-run).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedInstruments = seedInstruments;
const Instrument_1 = require("../models/Instrument");
const instrumentSeed_1 = require("../config/instrumentSeed");
async function seedInstruments() {
    let created = 0;
    let updated = 0;
    for (const inst of instrumentSeed_1.INSTRUMENT_SEED) {
        const existing = await Instrument_1.Instrument.findOne({ id: inst.id });
        if (!existing) {
            await Instrument_1.Instrument.create(inst);
            created++;
        }
        else {
            // Update mutable fields (not id/symbol/assetClass which are stable)
            existing.name = inst.name;
            existing.pipSize = inst.pipSize;
            existing.tickSize = inst.tickSize;
            existing.defaultTimeframe = inst.defaultTimeframe;
            existing.provider = inst.provider;
            existing.isActive = inst.isActive;
            await existing.save();
            updated++;
        }
    }
    if (created > 0 || updated > 0) {
        console.log(`[Seed] Instruments: ${created} created, ${updated} updated`);
    }
}
//# sourceMappingURL=instrumentSeedService.js.map