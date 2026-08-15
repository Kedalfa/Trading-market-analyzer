"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Analysis_1 = require("../models/Analysis");
const router = (0, express_1.Router)();
/**
 * POST /api/analyses — save a new analysis
 */
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        // Prevent duplicates — upsert by analysisId
        const analysis = await Analysis_1.Analysis.findOneAndUpdate({ analysisId: body.analysisId }, { $set: body }, { upsert: true, new: true, runValidators: true });
        res.status(201).json({ success: true, data: analysis });
    }
    catch (err) {
        console.error('[Analyses] POST /:', err);
        res.status(500).json({ success: false, error: 'Failed to save analysis' });
    }
});
/**
 * GET /api/analyses — list analyses with optional filters
 * Query params: symbol, timeframe, direction, grade, limit, skip
 */
router.get('/', async (req, res) => {
    try {
        const { symbol, timeframe, htfBias, grade, limit = '50', skip = '0', } = req.query;
        const filter = {};
        if (symbol)
            filter.symbol = String(symbol).toUpperCase();
        if (timeframe)
            filter.timeframe = String(timeframe);
        if (htfBias)
            filter.htfBias = String(htfBias).toUpperCase();
        if (grade)
            filter['setupQuality.grade'] = String(grade).toUpperCase();
        const [analyses, total] = await Promise.all([
            Analysis_1.Analysis.find(filter)
                .sort({ savedAt: -1 })
                .skip(parseInt(String(skip), 10))
                .limit(Math.min(parseInt(String(limit), 10), 200))
                .lean(),
            Analysis_1.Analysis.countDocuments(filter),
        ]);
        res.json({ success: true, data: analyses, total, limit: parseInt(String(limit), 10), skip: parseInt(String(skip), 10) });
    }
    catch (err) {
        console.error('[Analyses] GET /:', err);
        res.status(500).json({ success: false, error: 'Failed to list analyses' });
    }
});
/**
 * GET /api/analyses/:analysisId — get a single analysis
 */
router.get('/:analysisId', async (req, res) => {
    try {
        const analysis = await Analysis_1.Analysis.findOne({ analysisId: req.params.analysisId }).lean();
        if (!analysis)
            return res.status(404).json({ success: false, error: 'Analysis not found' });
        res.json({ success: true, data: analysis });
    }
    catch (err) {
        console.error('[Analyses] GET /:id:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch analysis' });
    }
});
/**
 * PATCH /api/analyses/:analysisId/outcome — update the outcome of an analysis
 */
router.patch('/:analysisId/outcome', async (req, res) => {
    try {
        const { status, maxFavorableExcursion, maxAdverseExcursion, notes } = req.body;
        const analysis = await Analysis_1.Analysis.findOneAndUpdate({ analysisId: req.params.analysisId }, {
            $set: {
                'outcome.status': status,
                'outcome.resolvedAt': status !== 'OPEN' ? new Date() : undefined,
                'outcome.maxFavorableExcursion': maxFavorableExcursion,
                'outcome.maxAdverseExcursion': maxAdverseExcursion,
                'outcome.notes': notes,
            },
        }, { new: true });
        if (!analysis)
            return res.status(404).json({ success: false, error: 'Analysis not found' });
        res.json({ success: true, data: analysis });
    }
    catch (err) {
        console.error('[Analyses] PATCH outcome:', err);
        res.status(500).json({ success: false, error: 'Failed to update outcome' });
    }
});
/**
 * DELETE /api/analyses/:analysisId
 */
router.delete('/:analysisId', async (req, res) => {
    try {
        const result = await Analysis_1.Analysis.deleteOne({ analysisId: req.params.analysisId });
        if (result.deletedCount === 0)
            return res.status(404).json({ success: false, error: 'Analysis not found' });
        res.json({ success: true, message: 'Analysis deleted' });
    }
    catch (err) {
        console.error('[Analyses] DELETE:', err);
        res.status(500).json({ success: false, error: 'Failed to delete analysis' });
    }
});
exports.default = router;
//# sourceMappingURL=analysisRoutes.js.map