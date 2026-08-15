"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Instrument_1 = require("../models/Instrument");
const router = (0, express_1.Router)();
// GET /api/instruments — list all active instruments
router.get('/', async (_req, res) => {
    try {
        const instruments = await Instrument_1.Instrument.find({ isActive: true }).lean();
        res.json({ success: true, data: instruments });
    }
    catch (err) {
        console.error('[Instruments] GET /:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch instruments' });
    }
});
// GET /api/instruments/:id — get single instrument
router.get('/:id', async (req, res) => {
    try {
        const instrument = await Instrument_1.Instrument.findOne({ id: req.params.id, isActive: true }).lean();
        if (!instrument) {
            return res.status(404).json({ success: false, error: 'Instrument not found' });
        }
        res.json({ success: true, data: instrument });
    }
    catch (err) {
        console.error('[Instruments] GET /:id:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch instrument' });
    }
});
exports.default = router;
//# sourceMappingURL=instrumentRoutes.js.map