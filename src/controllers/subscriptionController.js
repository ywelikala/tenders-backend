import { SubscriptionPlan, UserSubscription } from '../models/Subscription.js';
import User from '../models/User.js';

// @desc    Get all subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
export const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1 });

    res.status(200).json({
      success: true,
      data: {
        plans
      }
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription plans'
    });
  }
};

// @desc    Get user's current subscription
// @route   GET /api/subscriptions/my-subscription
// @access  Private
export const getMySubscription = async (req, res) => {
  try {
    const subscription = await UserSubscription.findOne({ user: req.user.id })
      .populate('user', 'firstName lastName email');

    if (!subscription) {
      // Create default free subscription
      const freeSubscription = await UserSubscription.create({
        user: req.user.id,
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        payment: {
          amount: 0,
          currency: 'LKR'
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          subscription: freeSubscription
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subscription
      }
    });
  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription'
    });
  }
};

// @desc    Subscribe to a plan
// @route   POST /api/subscriptions/subscribe
// @access  Private
export const subscribeToPlan = async (req, res) => {
  try {
    const { planName, billingCycle = 'monthly', paymentMethod, transactionId } = req.body;

    // Validate plan exists
    const plan = await SubscriptionPlan.findOne({ name: planName, isActive: true });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Check if user already has an active subscription
    const existingSubscription = await UserSubscription.findOne({ 
      user: req.user.id,
      status: 'active'
    });

    const now = new Date();
    let startDate = now;
    let endDate = new Date();
    
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const amount = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;

    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.plan = planName;
      existingSubscription.billingCycle = billingCycle;
      existingSubscription.endDate = endDate;
      existingSubscription.payment.amount = amount;
      existingSubscription.payment.method = paymentMethod;
      existingSubscription.payment.transactionId = transactionId;
      existingSubscription.payment.paymentDate = now;
      existingSubscription.nextBillingDate = endDate;
      existingSubscription.status = 'active';

      // Add to history
      existingSubscription.history.push({
        action: existingSubscription.plan === planName ? 'renewed' : 'upgraded',
        fromPlan: existingSubscription.plan,
        toPlan: planName,
        amount,
        reason: 'User subscription change'
      });

      await existingSubscription.save();

      // Update user subscription info
      await User.findByIdAndUpdate(req.user.id, {
        'subscription.plan': planName,
        'subscription.status': 'active',
        'subscription.endDate': endDate
      });

      return res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data: {
          subscription: existingSubscription
        }
      });
    }

    // Create new subscription
    const newSubscription = await UserSubscription.create({
      user: req.user.id,
      plan: planName,
      status: 'active',
      billingCycle,
      startDate,
      endDate,
      nextBillingDate: endDate,
      payment: {
        amount,
        currency: 'LKR',
        method: paymentMethod,
        transactionId,
        paymentDate: now
      },
      usage: {
        currentPeriodStart: now,
        currentPeriodEnd: endDate
      },
      history: [{
        action: 'created',
        toPlan: planName,
        amount,
        reason: 'Initial subscription'
      }]
    });

    // Update user subscription info
    await User.findByIdAndUpdate(req.user.id, {
      'subscription.plan': planName,
      'subscription.status': 'active',
      'subscription.startDate': startDate,
      'subscription.endDate': endDate,
      'subscription.features': plan.features
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription: newSubscription
      }
    });
  } catch (error) {
    console.error('Subscribe to plan error:', error);
    
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
      message: 'Server error while creating subscription'
    });
  }
};

// @desc    Cancel subscription
// @route   POST /api/subscriptions/cancel
// @access  Private
export const cancelSubscription = async (req, res) => {
  try {
    const { reason } = req.body;

    const subscription = await UserSubscription.findOne({ 
      user: req.user.id,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Don't cancel free plan
    if (subscription.plan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel free plan'
      });
    }

    // Update subscription
    subscription.status = 'cancelled';
    subscription.cancellation = {
      cancelledAt: new Date(),
      reason: reason || 'User requested cancellation'
    };
    subscription.autoRenew = false;

    // Add to history
    subscription.history.push({
      action: 'cancelled',
      fromPlan: subscription.plan,
      reason: reason || 'User requested cancellation'
    });

    await subscription.save();

    // Update user subscription info
    await User.findByIdAndUpdate(req.user.id, {
      'subscription.status': 'cancelled'
    });

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling subscription'
    });
  }
};

// @desc    Get subscription usage
// @route   GET /api/subscriptions/usage
// @access  Private
export const getSubscriptionUsage = async (req, res) => {
  try {
    const subscription = await UserSubscription.findOne({ user: req.user.id });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    // Get plan details for limits
    const plan = await SubscriptionPlan.findOne({ name: subscription.plan });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan details not found'
      });
    }

    const usageData = {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriod: {
        start: subscription.usage.currentPeriodStart,
        end: subscription.usage.currentPeriodEnd
      },
      usage: {
        tenderViews: {
          used: subscription.usage.tenderViews,
          limit: plan.features.maxTenderViews,
          unlimited: plan.features.maxTenderViews === -1
        },
        tenderUploads: {
          used: subscription.usage.tenderUploads,
          limit: plan.features.maxTenderUploads,
          unlimited: plan.features.maxTenderUploads === -1
        },
        documentsDownloaded: subscription.usage.documentsDownloaded,
        apiCalls: subscription.usage.apiCalls
      },
      features: plan.features,
      daysRemaining: subscription.daysRemaining
    };

    res.status(200).json({
      success: true,
      data: usageData
    });
  } catch (error) {
    console.error('Get subscription usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription usage'
    });
  }
};

// @desc    Get subscription history
// @route   GET /api/subscriptions/history
// @access  Private
export const getSubscriptionHistory = async (req, res) => {
  try {
    const subscription = await UserSubscription.findOne({ user: req.user.id });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        history: subscription.history.sort((a, b) => b.date - a.date)
      }
    });
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription history'
    });
  }
};

// @desc    Admin: Create subscription plan
// @route   POST /api/subscriptions/admin/plans
// @access  Private (Admin only)
export const createSubscriptionPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: {
        plan
      }
    });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan with this name already exists'
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
      message: 'Server error while creating subscription plan'
    });
  }
};

// @desc    Admin: Update subscription plan
// @route   PUT /api/subscriptions/admin/plans/:id
// @access  Private (Admin only)
export const updateSubscriptionPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: {
        plan
      }
    });
  } catch (error) {
    console.error('Update subscription plan error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID'
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
      message: 'Server error while updating subscription plan'
    });
  }
};

// @desc    Admin: Get all user subscriptions
// @route   GET /api/subscriptions/admin/subscriptions
// @access  Private (Admin only)
export const getAllSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      plan,
      status,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (plan) {
      query.plan = plan;
    }
    
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sortOrder = order === 'desc' ? -1 : 1;
    const sort = { [sortBy]: sortOrder };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [subscriptions, total] = await Promise.all([
      UserSubscription.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'firstName lastName email company')
        .lean(),
      UserSubscription.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          current: parseInt(page),
          total: totalPages,
          count: subscriptions.length,
          totalCount: total,
          hasNext,
          hasPrev
        }
      }
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscriptions'
    });
  }
};