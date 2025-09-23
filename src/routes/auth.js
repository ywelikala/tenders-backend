import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  googleLogin,
  facebookLogin
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema
} from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', googleLogin);
router.post('/facebook', facebookLogin);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.put('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/verify-email/:token', verifyEmail);

// Protected routes
router.use(authenticate);
router.post('/logout', logout);
router.get('/me', getMe);
router.put('/profile', validate(updateProfileSchema), updateProfile);
router.put('/change-password', validate(changePasswordSchema), changePassword);

export default router;