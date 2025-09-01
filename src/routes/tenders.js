import express from 'express';
import {
  getTenders,
  getTender,
  createTender,
  updateTender,
  deleteTender,
  getTenderStats,
  getMyTenders
} from '../controllers/tenderController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import {
  validate,
  createTenderSchema,
  updateTenderSchema
} from '../middleware/validation.js';

const router = express.Router();

// Public routes (with optional authentication)
router.get('/', optionalAuth, getTenders);
router.get('/stats', getTenderStats);

// Protected routes
router.use(authenticate);
router.get('/user/my-tenders', getMyTenders);

// Public routes (with optional authentication) - parametric routes last
router.get('/:id', optionalAuth, getTender);
router.post('/', validate(createTenderSchema), createTender);
router.put('/:id', validate(updateTenderSchema), updateTender);
router.delete('/:id', deleteTender);

export default router;