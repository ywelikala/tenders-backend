import express from 'express';
import {
  saveScreenshot,
  getScreenshots,
  getScreenshot,
  getScreenshotImage,
  deleteScreenshot,
  getRecentScraperScreenshots,
  cleanupOldScreenshots
} from '../controllers/screenshotController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public route for scraper to save screenshots
router.post('/', saveScreenshot);

// Protected routes (admin only)
router.use(authenticate);
router.use(authorize('admin'));

// Get list of screenshots
router.get('/', getScreenshots);

// Get recent scraper screenshots
router.get('/scraper/recent', getRecentScraperScreenshots);

// Cleanup old screenshots
router.delete('/cleanup/:days', cleanupOldScreenshots);

// Get specific screenshot (metadata only)
router.get('/:id', getScreenshot);

// Get screenshot image data
router.get('/:id/image', getScreenshotImage);

// Delete screenshot
router.delete('/:id', deleteScreenshot);

export default router;