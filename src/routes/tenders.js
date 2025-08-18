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
router.get('/:id', optionalAuth, getTender);

// Protected routes
router.use(authenticate);
router.get('/user/my-tenders', getMyTenders);
router.post('/', validate(createTenderSchema), createTender);
router.put('/:id', validate(updateTenderSchema), updateTender);
router.delete('/:id', deleteTender);

export default router;