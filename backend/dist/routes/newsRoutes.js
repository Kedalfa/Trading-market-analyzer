"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const newsService_1 = require("../services/newsService");
const router = (0, express_1.Router)();
/**
 * GET /api/news/:instrumentId — get economic events relevant to this instrument
 */
router.get('/:instrumentId', (req, res) => {
    const { instrumentId } = req.params;
    try {
        const newsContext = (0, newsService_1.getEventsForInstrument)(instrumentId);
        res.json({ success: true, data: newsContext });
    }
    catch (err) {
        console.error('[News] Error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch news context' });
    }
});
exports.default = router;
//# sourceMappingURL=newsRoutes.js.map