import express from 'express';
import {
  getUserAlerts,
  getAlert,
  createAlert,
  updateAlert,
  deleteAlert,
  toggleAlert,
  testAlert,
  sendTestEmail,
  getAlertStats
} from '../controllers/alertController.js';
import { authenticate } from '../middleware/auth.js';
import { validateAlertConfiguration } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/alerts/stats - Get alert statistics and summary
router.get('/stats', getAlertStats);

// GET /api/alerts - Get all alert configurations for the user
router.get('/', getUserAlerts);

// GET /api/alerts/:id - Get specific alert configuration
router.get('/:id', getAlert);

// POST /api/alerts - Create new alert configuration
router.post('/', validateAlertConfiguration, createAlert);

// PUT /api/alerts/:id - Update alert configuration
router.put('/:id', validateAlertConfiguration, updateAlert);

// DELETE /api/alerts/:id - Delete alert configuration
router.delete('/:id', deleteAlert);

// PATCH /api/alerts/:id/toggle - Toggle alert active status
router.patch('/:id/toggle', toggleAlert);

// POST /api/alerts/:id/test - Test alert configuration against existing tenders
router.post('/:id/test', testAlert);

// POST /api/alerts/:id/send-test-email - Send test email for alert configuration
router.post('/:id/send-test-email', sendTestEmail);

export default router;