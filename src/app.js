import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import errorHandler from './middleware/errorHandler.js';
import { generalLimiter, authLimiter, passwordResetLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import logger from './utils/logger.js';
import { requestLogger, enhancedLogger, errorLogger } from './middleware/logging.js';

// Import routes
import authRoutes from './routes/auth.js';
import tenderRoutes from './routes/tenders.js';
import subscriptionRoutes from './routes/subscriptions.js';
import fileRoutes from './routes/files.js';

// Load environment variables
dotenv.config();

// Initialize logger
logger.info('Starting Tender Portal Backend Server', {
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  port: process.env.PORT || 3000,
});

// Check critical environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', {
    missing: missingEnvVars,
    environment: process.env.NODE_ENV
  });
  process.exit(1);
}

logger.debug('Environment variables check', {
  hasJwtSecret: !!process.env.JWT_SECRET,
  hasMongoUri: !!process.env.MONGODB_URI,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

// Connect to database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const getCorsOrigins = () => {
  // Allow override via environment variable
  if (process.env.CORS_ORIGINS) {
    const origins = process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
    logger.info('Using CORS origins from environment variable', { origins });
    return origins;
  }
  
  if (process.env.NODE_ENV === 'production') {
    const origins = [
      'https://lankatender.com',
      'https://www.lankatender.com',
      // Add any additional production domains here
    ];
    logger.info('Using production CORS origins', { origins });
    return origins;
  }
  
  const origins = [
    'http://localhost:3000',
    'http://localhost:8080', 
    'http://127.0.0.1:8080',
    // Add any additional development domains here
  ];
  logger.info('Using development CORS origins', { origins });
  return origins;
};

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    const allowedOrigins = getCorsOrigins();
    
    // Log CORS request for debugging
    logger.debug('CORS request received', {
      requestOrigin: origin,
      allowedOrigins: allowedOrigins,
      isAllowed: !origin || allowedOrigins.includes(origin)
    });
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logger.warn('CORS origin rejected', {
        requestOrigin: origin,
        allowedOrigins: allowedOrigins
      });
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  maxAge: 86400,
  optionsSuccessStatus: 200 // Support legacy browsers
}));

// Logging middleware (before all other middleware)
app.use(requestLogger);
if (process.env.NODE_ENV === 'development') {
  app.use(enhancedLogger);
}

// Stripe webhook endpoint needs raw body
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/files', uploadLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Enhanced API health check
app.get('/api/health', (req, res) => {
  logger.debug('API health check requested');
  
  const healthCheck = {
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected', // TODO: Add actual database health check
    services: {
      auth: true,
      tenders: true,
      files: true,
    }
  };
  
  logger.info('Health check completed', { healthCheck });
  res.status(200).json(healthCheck);
});

// Handle preflight requests for subscription routes specifically
app.options('/api/subscriptions/*', (req, res) => {
  logger.debug('Preflight request for subscription route', {
    method: req.method,
    url: req.originalUrl,
    origin: req.headers.origin,
    headers: req.headers
  });
  res.sendStatus(200);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/files', fileRoutes);

// Serve static files (uploaded files)
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.headers['x-forwarded-for'] || req.ip,
  });
  
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error logging middleware (before error handler)
app.use(errorLogger);

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV,
      pid: process.pid,
    });
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;