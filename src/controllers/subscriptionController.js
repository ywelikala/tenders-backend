import stripeService from '../services/stripeService.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Get available subscription plans
 */
export const getPlans = async (req, res) => {
  try {
    const plans = stripeService.getPlans();
    
    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans'
    });
  }
};

/**
 * Create Stripe checkout session
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    // Check if user already has an active subscription
    const user = await User.findById(userId);
    if (user.subscription.status === 'active' && user.subscription.plan !== 'free') {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    const session = await stripeService.createCheckoutSession(userId, planId);
    
    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

/**
 * Verify checkout session
 */
export const verifyCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const result = await stripeService.verifyCheckoutSession(sessionId);
    
    res.status(200).json({
      success: result.success,
      data: result.user ? {
        subscription: result.user.subscription
      } : null,
      message: result.message
    });
  } catch (error) {
    logger.error('Error verifying checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify checkout session'
    });
  }
};

/**
 * Get user's current subscription
 */
export const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('subscription');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user.subscription
    });
  } catch (error) {
    logger.error('Error fetching current subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription'
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await stripeService.cancelSubscription(userId);
    
    res.status(200).json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period'
    });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

/**
 * Handle Stripe webhooks
 */
export const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing Stripe signature'
      });
    }

    const result = await stripeService.handleWebhook(req.body, signature);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get subscription usage stats
 */
export const getSubscriptionUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('subscription usage');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const usageData = {
      plan: user.subscription.plan,
      status: user.subscription.status,
      features: user.subscription.features,
      usage: {
        tenderViewsThisMonth: user.usage.tenderViewsThisMonth,
        maxTenderViews: user.subscription.features.maxTenderViews,
        remainingViews: user.subscription.features.maxTenderViews === -1 
          ? 'Unlimited' 
          : Math.max(0, user.subscription.features.maxTenderViews - user.usage.tenderViewsThisMonth)
      },
      nextBillingDate: user.subscription.nextBillingDate,
      lastPaymentDate: user.subscription.lastPaymentDate
    };

    res.status(200).json({
      success: true,
      data: usageData
    });
  } catch (error) {
    logger.error('Error fetching subscription usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription usage'
    });
  }
};