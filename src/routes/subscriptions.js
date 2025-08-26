import express from 'express';
import Joi from 'joi';
import {
  getPlans,
  createCheckoutSession,
  verifyCheckoutSession,
  getCurrentSubscription,
  cancelSubscription,
  handleStripeWebhook,
  getSubscriptionUsage
} from '../controllers/subscriptionController.js';
import { authenticate as auth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

// Validation schemas
const createCheckoutSessionSchema = Joi.object({
  planId: Joi.string().valid('basic', 'professional', 'enterprise').required().messages({
    'any.only': 'Invalid plan ID. Must be one of: basic, professional, enterprise',
    'any.required': 'Plan ID is required'
  })
});

const verifySessionSchema = Joi.object({
  sessionId: Joi.string().min(10).required().messages({
    'string.min': 'Invalid session ID format',
    'any.required': 'Session ID is required'
  })
});

const router = express.Router();

// Public routes
/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', getPlans);

/**
 * @route   POST /api/subscriptions/webhook
 * @desc    Handle Stripe webhooks
 * @access  Public (Stripe)
 * @note    This endpoint needs raw body, so it should be before express.json() middleware
 */
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Protected routes (require authentication)
/**
 * @route   POST /api/subscriptions/create-checkout-session
 * @desc    Create Stripe checkout session
 * @access  Private
 */
router.post(
  '/create-checkout-session',
  auth,
  validate(createCheckoutSessionSchema),
  createCheckoutSession
);

/**
 * @route   GET /api/subscriptions/verify-session/:sessionId
 * @desc    Verify Stripe checkout session
 * @access  Private
 */
router.get(
  '/verify-session/:sessionId',
  auth,
  (req, res, next) => {
    // Move sessionId from params to body for validation
    req.body = { sessionId: req.params.sessionId };
    next();
  },
  validate(verifySessionSchema),
  verifyCheckoutSession
);

/**
 * @route   GET /api/subscriptions/current
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get('/current', auth, getCurrentSubscription);

/**
 * @route   GET /api/subscriptions/usage
 * @desc    Get current user's subscription usage stats
 * @access  Private
 */
router.get('/usage', auth, getSubscriptionUsage);

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel current subscription
 * @access  Private
 */
router.post('/cancel', auth, cancelSubscription);

/**
 * @route   GET /api/subscriptions
 * @desc    Legacy endpoint for backward compatibility
 * @access  Public
 */
router.get('/', getPlans);

export default router;