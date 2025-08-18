import express from 'express';
import {
  getSubscriptionPlans,
  getMySubscription,
  subscribeToPlan,
  cancelSubscription,
  getSubscriptionUsage,
  getSubscriptionHistory,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getAllSubscriptions
} from '../controllers/subscriptionController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/plans', getSubscriptionPlans);

// Protected routes
router.use(authenticate);
router.get('/my-subscription', getMySubscription);
router.post('/subscribe', subscribeToPlan);
router.post('/cancel', cancelSubscription);
router.get('/usage', getSubscriptionUsage);
router.get('/history', getSubscriptionHistory);

// Admin routes
router.use(authorize('admin'));
router.post('/admin/plans', createSubscriptionPlan);
router.put('/admin/plans/:id', updateSubscriptionPlan);
router.get('/admin/subscriptions', getAllSubscriptions);

export default router;