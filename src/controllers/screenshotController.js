import Screenshot from '../models/Screenshot.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Save a screenshot to the database
 * @route POST /api/screenshots
 * @access Public (for scraper use)
 */
export const saveScreenshot = async (req, res, next) => {
  try {
    const {
      filename,
      originalName,
      contentType,
      imageData, // base64 encoded string
      source = 'tender-scraper',
      description,
      metadata = {},
      tags = []
    } = req.body;

    // Validate required fields
    if (!filename || !originalName || !contentType || !imageData) {
      logger.warn('Screenshot upload failed - missing required fields', {
        hasFilename: !!filename,
        hasOriginalName: !!originalName,
        hasContentType: !!contentType,
        hasImageData: !!imageData,
        source
      });
      return next(new AppError('Missing required fields: filename, originalName, contentType, imageData', 400));
    }

    // Validate content type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      return next(new AppError(`Invalid content type. Allowed types: ${allowedTypes.join(', ')}`, 400));
    }

    // Convert base64 to buffer
    let imageBuffer;
    try {
      // Remove data URL prefix if present (data:image/png;base64,...)
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      logger.error('Failed to decode base64 image data', { error: error.message });
      return next(new AppError('Invalid base64 image data', 400));
    }

    // Create screenshot document
    const screenshot = new Screenshot({
      filename,
      originalName,
      contentType,
      size: imageBuffer.length,
      imageData: imageBuffer,
      source,
      description,
      metadata: {
        ...metadata,
        timestamp: new Date(),
        // Add request info for debugging
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.ip,
      },
      tags: Array.isArray(tags) ? tags : []
    });

    await screenshot.save();

    logger.info('Screenshot saved successfully', {
      id: screenshot._id,
      filename: screenshot.filename,
      size: screenshot.sizeFormatted,
      source: screenshot.source,
      environment: screenshot.metadata.environment,
      cloudRunJobName: screenshot.metadata.cloudRunJobName
    });

    // Return success response without image data
    res.status(201).json({
      success: true,
      message: 'Screenshot saved successfully',
      data: {
        id: screenshot._id,
        filename: screenshot.filename,
        originalName: screenshot.originalName,
        contentType: screenshot.contentType,
        size: screenshot.size,
        sizeFormatted: screenshot.sizeFormatted,
        source: screenshot.source,
        description: screenshot.description,
        metadata: screenshot.metadata,
        tags: screenshot.tags,
        createdAt: screenshot.createdAt
      }
    });
  } catch (error) {
    logger.error('Error saving screenshot', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get list of screenshots
 * @route GET /api/screenshots
 * @access Private (admin only)
 */
export const getScreenshots = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      source,
      environment,
      tags
    } = req.query;

    const query = {};
    
    if (source) query.source = source;
    if (environment) query['metadata.environment'] = environment;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select: '-imageData' // Exclude binary data from list
    };

    const screenshots = await Screenshot.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit)
      .select(options.select);

    const total = await Screenshot.countDocuments(query);

    logger.info('Screenshots retrieved', {
      count: screenshots.length,
      total,
      page: options.page,
      limit: options.limit,
      filters: query
    });

    res.status(200).json({
      success: true,
      data: screenshots,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (error) {
    logger.error('Error retrieving screenshots', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get a specific screenshot by ID
 * @route GET /api/screenshots/:id
 * @access Private (admin only)
 */
export const getScreenshot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeImage = false } = req.query;

    const selectFields = includeImage ? '' : '-imageData';
    const screenshot = await Screenshot.findById(id).select(selectFields);

    if (!screenshot) {
      return next(new AppError('Screenshot not found', 404));
    }

    // Increment view count
    if (!includeImage) {
      await screenshot.incrementViewCount();
    }

    logger.info('Screenshot retrieved', {
      id: screenshot._id,
      filename: screenshot.filename,
      includeImage,
      viewCount: screenshot.viewCount
    });

    res.status(200).json({
      success: true,
      data: screenshot
    });
  } catch (error) {
    logger.error('Error retrieving screenshot', {
      id: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get screenshot image data
 * @route GET /api/screenshots/:id/image
 * @access Private (admin only)
 */
export const getScreenshotImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const screenshot = await Screenshot.findById(id).select('imageData contentType filename');

    if (!screenshot) {
      return next(new AppError('Screenshot not found', 404));
    }

    // Set appropriate headers
    res.set({
      'Content-Type': screenshot.contentType,
      'Content-Length': screenshot.imageData.length,
      'Content-Disposition': `inline; filename="${screenshot.filename}"`
    });

    logger.info('Screenshot image served', {
      id: screenshot._id,
      filename: screenshot.filename,
      contentType: screenshot.contentType,
      size: screenshot.imageData.length
    });

    res.send(screenshot.imageData);
  } catch (error) {
    logger.error('Error serving screenshot image', {
      id: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Delete a screenshot
 * @route DELETE /api/screenshots/:id
 * @access Private (admin only)
 */
export const deleteScreenshot = async (req, res, next) => {
  try {
    const { id } = req.params;

    const screenshot = await Screenshot.findById(id);

    if (!screenshot) {
      return next(new AppError('Screenshot not found', 404));
    }

    await Screenshot.findByIdAndDelete(id);

    logger.info('Screenshot deleted', {
      id: screenshot._id,
      filename: screenshot.filename,
      source: screenshot.source
    });

    res.status(200).json({
      success: true,
      message: 'Screenshot deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting screenshot', {
      id: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Get recent scraper screenshots
 * @route GET /api/screenshots/scraper/recent
 * @access Private (admin only)
 */
export const getRecentScraperScreenshots = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const screenshots = await Screenshot.getRecentScraperScreenshots(parseInt(limit));

    logger.info('Recent scraper screenshots retrieved', {
      count: screenshots.length,
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: screenshots
    });
  } catch (error) {
    logger.error('Error retrieving recent scraper screenshots', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Cleanup old screenshots
 * @route DELETE /api/screenshots/cleanup/:days
 * @access Private (admin only)
 */
export const cleanupOldScreenshots = async (req, res, next) => {
  try {
    const { days = 30 } = req.params;

    const result = await Screenshot.cleanupOldScreenshots(parseInt(days));

    logger.info('Old screenshots cleaned up', {
      daysOld: parseInt(days),
      deletedCount: result.deletedCount
    });

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old screenshots`,
      deletedCount: result.deletedCount,
      daysOld: parseInt(days)
    });
  } catch (error) {
    logger.error('Error cleaning up old screenshots', {
      days: req.params.days,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};