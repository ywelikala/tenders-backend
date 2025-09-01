import Tender from '../models/Tender.js';
import { UserSubscription } from '../models/Subscription.js';
import fs from 'fs/promises';
import path from 'path';

// @desc    Get all tenders with filtering and pagination
// @route   GET /api/tenders
// @access  Public
export const getTenders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      province,
      status = 'published',
      search,
      sortBy = 'createdAt',
      order = 'desc',
      visibility = 'public'
    } = req.query;

    // Build query
    const query = {
      isActive: true,
      status
    };

    // Add visibility filter based on user authentication
    if (!req.user) {
      query.visibility = 'public';
    } else if (visibility === 'premium' || visibility === 'registered') {
      // Check user subscription for premium content
      if (visibility === 'premium') {
        const subscription = await UserSubscription.findOne({ user: req.user.id });
        if (!subscription || !['premium', 'enterprise'].includes(subscription.plan)) {
          query.visibility = { $in: ['public', 'registered'] };
        } else {
          query.visibility = { $in: ['public', 'registered', 'premium'] };
        }
      } else {
        query.visibility = { $in: ['public', 'registered'] };
      }
    }

    // Add filters
    if (category) {
      query.category = category;
    }

    if (province) {
      query['location.province'] = province;
    }

    // Add search functionality
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sortOrder = order === 'desc' ? -1 : 1;
    const sort = { [sortBy]: sortOrder };

    // Add text score for search queries
    if (search) {
      sort.score = { $meta: 'textScore' };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tenders, total] = await Promise.all([
      Tender.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'firstName lastName company')
        .lean(),
      Tender.countDocuments(query)
    ]);

    // Track tender views for authenticated users
    if (req.user && tenders.length > 0) {
      const subscription = await UserSubscription.findOne({ user: req.user.id });
      if (subscription) {
        await subscription.incrementUsage('tenderViews');
      }
    }

    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        tenders,
        pagination: {
          current: parseInt(page),
          total: totalPages,
          count: tenders.length,
          totalCount: total,
          hasNext,
          hasPrev
        }
      }
    });
  } catch (error) {
    console.error('Get tenders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tenders'
    });
  }
};

// @desc    Get single tender
// @route   GET /api/tenders/:id
// @access  Public
export const getTender = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id)
      .populate('createdBy', 'firstName lastName company email phone')
      .populate('updatedBy', 'firstName lastName');

    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check visibility permissions
    if (tender.visibility === 'registered' && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view this tender'
      });
    }

    if (tender.visibility === 'premium') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Premium subscription required to view this tender'
        });
      }

      const subscription = await UserSubscription.findOne({ user: req.user.id });
      if (!subscription || !['premium', 'enterprise'].includes(subscription.plan)) {
        return res.status(403).json({
          success: false,
          message: 'Premium subscription required to view this tender'
        });
      }
    }

    // Increment view count
    await tender.incrementView();

    // Track user tender view if authenticated
    if (req.user) {
      const subscription = await UserSubscription.findOne({ user: req.user.id });
      if (subscription) {
        const canView = await subscription.canPerformAction('view_tender');
        if (!canView) {
          return res.status(403).json({
            success: false,
            message: 'Tender view limit exceeded for your subscription plan'
          });
        }
        await subscription.incrementUsage('tenderViews');
      }

      // Update user's last tender view
      await req.user.incrementTenderView();
    }

    res.status(200).json({
      success: true,
      data: {
        tender
      }
    });
  } catch (error) {
    console.error('Get tender error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching tender'
    });
  }
};

// @desc    Create new tender
// @route   POST /api/tenders
// @access  Private
export const createTender = async (req, res) => {
  try {
    // Check if user can upload tenders
    const subscription = await UserSubscription.findOne({ user: req.user.id });
    if (subscription) {
      const canUpload = await subscription.canPerformAction('upload_tender');
      if (!canUpload) {
        return res.status(403).json({
          success: false,
          message: 'Tender upload limit exceeded or not allowed for your subscription plan'
        });
      }
    }

    // Add creator to tender data
    const tenderData = {
      ...req.body,
      createdBy: req.user.id
    };

    const tender = await Tender.create(tenderData);

    // Increment user's tender upload count
    if (subscription) {
      await subscription.incrementUsage('tenderUploads');
    }

    // Populate creator information
    await tender.populate('createdBy', 'firstName lastName company');

    res.status(201).json({
      success: true,
      message: 'Tender created successfully',
      data: {
        tender
      }
    });
  } catch (error) {
    console.error('Create tender error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Tender with this reference number already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating tender'
    });
  }
};

// @desc    Update tender
// @route   PUT /api/tenders/:id
// @access  Private
export const updateTender = async (req, res) => {
  try {
    let tender = await Tender.findById(req.params.id);

    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check ownership or admin role
    if (tender.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this tender'
      });
    }

    // Add updater to tender data
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    tender = await Tender.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('createdBy', 'firstName lastName company')
     .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Tender updated successfully',
      data: {
        tender
      }
    });
  } catch (error) {
    console.error('Update tender error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender ID'
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Tender with this reference number already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating tender'
    });
  }
};

// @desc    Delete tender
// @route   DELETE /api/tenders/:id
// @access  Private
export const deleteTender = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);

    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check ownership or admin role
    if (tender.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this tender'
      });
    }

    // Soft delete by setting isActive to false
    tender.isActive = false;
    tender.updatedBy = req.user.id;
    await tender.save();

    // Delete associated files
    if (tender.documents && tender.documents.length > 0) {
      for (const document of tender.documents) {
        try {
          const filePath = path.join(process.cwd(), document.url);
          await fs.unlink(filePath);
        } catch (fileError) {
          console.error('Error deleting file:', fileError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Tender deleted successfully'
    });
  } catch (error) {
    console.error('Delete tender error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting tender'
    });
  }
};

// @desc    Get tender statistics
// @route   GET /api/tenders/stats
// @access  Public
export const getTenderStats = async (req, res) => {
  try {
    const [
      totalTenders,
      liveTenders,
      todayTenders,
      closedTenders,
      categoryStats
    ] = await Promise.all([
      Tender.countDocuments({ isActive: true }),
      Tender.countDocuments({ 
        status: 'published', 
        isActive: true,
        'dates.closing': { $gte: new Date() }
      }),
      Tender.countDocuments({
        status: 'published',
        isActive: true,
        'dates.published': {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      Tender.countDocuments({ 
        status: 'closed', 
        isActive: true 
      }),
      Tender.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalTenders,
        liveTenders,
        todayTenders,
        closedTenders,
        categoryStats
      }
    });
  } catch (error) {
    console.error('Get tender stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tender statistics'
    });
  }
};

// @desc    Get user's tenders
// @route   GET /api/tenders/user/my-tenders
// @access  Private
export const getMyTenders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build query
    const query = {
      createdBy: req.user.id,
      isActive: true
    };

    if (status) {
      query.status = status;
    }

    // Build sort object
    const sortOrder = order === 'desc' ? -1 : 1;
    const sort = { [sortBy]: sortOrder };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tenders, total] = await Promise.all([
      Tender.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Tender.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        tenders,
        pagination: {
          current: parseInt(page),
          total: totalPages,
          count: tenders.length,
          totalCount: total,
          hasNext,
          hasPrev
        }
      }
    });
  } catch (error) {
    console.error('Get my tenders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your tenders'
    });
  }
};