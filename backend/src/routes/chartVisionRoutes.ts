import { Router, Request, Response } from 'express';
import { analyzeScreenshotImage } from '../services/chartVisionService';

const router = Router();

/**
 * POST /api/chart-vision/analyze
 * Analyzes uploaded screenshot in complete isolation from live market feeds
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid imageBase64 payload.',
      });
    }

    const result = await analyzeScreenshotImage(imageBase64);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[ChartVision] Error analyzing screenshot:', err);
    res.status(500).json({
      success: false,
      error: 'Chart Vision analysis engine encountered an error while processing the screenshot.',
    });
  }
});

export default router;
