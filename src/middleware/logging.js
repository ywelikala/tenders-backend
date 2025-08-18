import morgan from 'morgan';
import logger from '../utils/logger.js';

// Custom morgan tokens
morgan.token('user-id', (req) => req.user?.id || 'anonymous');
morgan.token('user-email', (req) => req.user?.email || 'N/A');
morgan.token('real-ip', (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.ip;
});

// Morgan format for development
const developmentFormat = ':method :url :status :res[content-length] - :response-time ms - :user-email (:user-id) - :real-ip';

// Morgan format for production (no sensitive data)
const productionFormat = ':method :url :status :res[content-length] - :response-time ms - :real-ip';

// Request logging middleware
export const requestLogger = process.env.NODE_ENV === 'production'
  ? morgan(productionFormat, { 
      stream: logger.stream,
      skip: (req, res) => res.statusCode < 400 // Only log errors in production
    })
  : morgan(developmentFormat, { 
      stream: logger.stream 
    });

// Enhanced request/response logging middleware
export const enhancedLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  logger.debug('Request Started', {
    method: req.method,
    url: req.url,
    ip: req.headers['x-forwarded-for'] || req.ip,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    userId: req.user?.id,
    userEmail: req.user?.email,
  });

  // Log request body for POST/PUT/PATCH (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    sensitiveFields.forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });
    
    logger.debug('Request Body', {
      url: req.url,
      method: req.method,
      body: sanitizedBody,
    });
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.debug('Request Completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      responseSize: JSON.stringify(body).length,
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow Request', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }
    
    return originalJson.call(this, body);
  };

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('Request Error', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.headers['x-forwarded-for'] || req.ip,
        userId: req.user?.id,
      });
    }
  });

  next();
};

// Error logging middleware
export const errorLogger = (error, req, res, next) => {
  logger.error('Request Error', {
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    ip: req.headers['x-forwarded-for'] || req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  next(error);
};

export default {
  requestLogger,
  enhancedLogger,
  errorLogger,
};