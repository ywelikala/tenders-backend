import express from 'express';
import {
  uploadTenderDocuments,
  downloadTenderDocument,
  deleteTenderDocument,
  getTenderDocuments,
  uploadProfileImage,
  getFileStats
} from '../controllers/fileController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import {
  uploadTenderDocuments as uploadTenderDocsMiddleware,
  uploadProfileImage as uploadProfileImageMiddleware,
  handleUploadError,
  processTenderDocuments,
  validateFileRequirements
} from '../middleware/upload.js';

const router = express.Router();

// Tender document routes
router.get('/tender/:tenderId/documents', optionalAuth, getTenderDocuments);
router.get('/tender/:tenderId/documents/:documentId', optionalAuth, downloadTenderDocument);

// Protected routes
router.use(authenticate);

// Tender document upload/management
router.post(
  '/tender/:tenderId/documents',
  uploadTenderDocsMiddleware.array('documents'),
  handleUploadError,
  processTenderDocuments,
  validateFileRequirements,
  uploadTenderDocuments
);

router.delete('/tender/:tenderId/documents/:documentId', deleteTenderDocument);

// Profile image upload
router.post(
  '/profile/image',
  uploadProfileImageMiddleware.single('image'),
  handleUploadError,
  uploadProfileImage
);

// Admin routes
router.get('/stats', authorize('admin'), getFileStats);

export default router;