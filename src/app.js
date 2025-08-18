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

// Connect to database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  credentials: true,
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:8080']
}));

// Logging middleware (before all other middleware)
app.use(requestLogger);
if (process.env.NODE_ENV === 'development') {
  app.use(enhancedLogger);
}

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