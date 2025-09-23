import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const generateToken = (id) => {
  try {
    // Validate and sanitize JWT_EXPIRES_IN
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    // Handle numeric values (assume days if just a number)
    let validExpiresIn;
    if (jwtExpiresIn && jwtExpiresIn.trim() !== '' && jwtExpiresIn !== '0') {
      const trimmed = jwtExpiresIn.trim();
      // If it's just a number (like "7"), assume it means days
      if (/^\d+$/.test(trimmed)) {
        validExpiresIn = `${trimmed}d`;
      } else {
        validExpiresIn = trimmed;
      }
    } else {
      validExpiresIn = '7d';
    }
    
    logger.debug('JWT generation details', {
      userId: id,
      hasJwtSecret: !!process.env.JWT_SECRET,
      rawJwtExpiresIn: process.env.JWT_EXPIRES_IN,
      validExpiresIn: validExpiresIn
    });
    
    const token = jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: validExpiresIn
    });
    
    // Decode token to verify expiration time
    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now() / 1000);
    const expiry = decoded.exp;
    const duration = expiry - now;
    
    logger.debug('JWT token generated successfully', { 
      userId: id,
      tokenLength: token ? token.length : 0,
      expiresAt: new Date(expiry * 1000).toISOString(),
      durationSeconds: duration,
      isValidDuration: duration > 60 // Should be at least 1 minute
    });
    
    if (duration <= 0) {
      throw new Error(`JWT token has invalid expiration: expires in ${duration} seconds`);
    }
    
    return token;
  } catch (error) {
    logger.error('JWT token generation failed', error, { userId: id });
    throw error;
  }
};

const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  try {
    logger.debug('Generating JWT token', { userId: user._id });
    const token = generateToken(user._id);
    
    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    };

    // Remove password from output
    user.password = undefined;
    
    logger.debug('Sending token response', { 
      userId: user._id, 
      statusCode, 
      message,
      hasToken: !!token,
      cookieOptions 
    });

    res.status(statusCode)
      .cookie('token', token, cookieOptions)
      .json({
        success: true,
        message,
        token,
        data: {
          user
        }
      });
      
    logger.debug('Token response sent successfully', { userId: user._id });
  } catch (error) {
    logger.error('Error in sendTokenResponse', error, { userId: user._id });
    throw error;
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, company, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      company,
      phone,
      role
    });

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(20).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(emailVerificationToken)
      .digest('hex');
    
    await user.save({ validateBeforeSave: false });

    // TODO: Send verification email
    // await sendVerificationEmail(user, emailVerificationToken);

    sendTokenResponse(user, 201, res, 'User registered successfully. Please check your email to verify your account.');
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
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
      message: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const startTime = Date.now();
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;
  
  logger.info('Login attempt started', {
    email,
    ip,
    userAgent: req.headers['user-agent']
  });

  try {
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      logger.auth('Login failed - User not found', null, email, ip, false, new Error('User not found'));
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      logger.auth('Login failed - Account disabled', user._id, email, ip, false, new Error('Account disabled'));
      return res.status(401).json({
        success: false,
        message: 'Account is disabled. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.auth('Login failed - Invalid password', user._id, email, ip, false, new Error('Invalid password'));
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    logger.debug('Updating user last login', { userId: user._id });
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    logger.debug('User last login updated successfully', { userId: user._id });

    const duration = Date.now() - startTime;
    logger.auth('Login successful', user._id, email, ip, true);
    logger.performance('User login', duration, { userId: user._id, email });

    try {
      sendTokenResponse(user, 200, res, 'Login successful');
      logger.debug('Login completed successfully', { userId: user._id, email });
    } catch (tokenError) {
      logger.error('Failed to send token response after successful login', tokenError, {
        userId: user._id,
        email,
        ip
      });
      return res.status(500).json({
        success: false,
        message: 'Authentication successful but failed to generate session'
      });
    }
  } catch (error) {
    logger.auth('Login failed - Server error', null, email, ip, false, error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'subscription',
      select: 'plan status features usage'
    });

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'company', 'phone', 'preferences'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
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
      message: 'Server error during profile update'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // TODO: Send password reset email
    // await sendPasswordResetEmail(user, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset token sent to email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during forgot password'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Get hashed token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password reset successful');
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Get hashed token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Verify email
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
};

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Google OAuth login
// @route   POST /api/auth/google
// @access  Public
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    logger.info('Google login attempt', { email, googleId });

    // Check if user exists with this Google ID
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with this email
      user = await User.findOne({ email });

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        if (picture) user.profilePicture = picture;
        await user.save();
        logger.info('Linked Google account to existing user', { userId: user._id, email });
      } else {
        // Create new user
        user = await User.create({
          googleId,
          email,
          name,
          profilePicture: picture,
          isEmailVerified: true, // Google accounts are pre-verified
          role: 'user'
        });
        logger.info('Created new user from Google login', { userId: user._id, email });
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Google login'
    });
  }
};

// @desc    Facebook OAuth login
// @route   POST /api/auth/facebook
// @access  Public
export const facebookLogin = async (req, res) => {
  try {
    const { accessToken, userID } = req.body;

    if (!accessToken || !userID) {
      return res.status(400).json({
        success: false,
        message: 'Facebook access token and user ID are required'
      });
    }

    // Verify Facebook token and get user info
    const response = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );

    const facebookData = response.data;

    if (facebookData.id !== userID) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Facebook token'
      });
    }

    const email = facebookData.email;
    const name = facebookData.name;
    const picture = facebookData.picture?.data?.url;
    const facebookId = facebookData.id;

    logger.info('Facebook login attempt', { email, facebookId });

    // Check if user exists with this Facebook ID
    let user = await User.findOne({ facebookId });

    if (!user) {
      // Check if user exists with this email
      if (email) {
        user = await User.findOne({ email });
      }

      if (user) {
        // Link Facebook account to existing user
        user.facebookId = facebookId;
        if (picture) user.profilePicture = picture;
        await user.save();
        logger.info('Linked Facebook account to existing user', { userId: user._id, email });
      } else {
        // Create new user
        user = await User.create({
          facebookId,
          email: email || `facebook_${facebookId}@example.com`, // Fallback email
          name,
          profilePicture: picture,
          isEmailVerified: !!email, // Only verify if email provided
          role: 'user'
        });
        logger.info('Created new user from Facebook login', { userId: user._id, email });
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Facebook login successful',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    console.error('Facebook login error:', error);

    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Facebook access token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during Facebook login'
    });
  }
};