import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    // Format meta information
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Define file format (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}${metaStr}`;
    }
    
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  })
);

// Define transports
const transports = [];

// Console transport
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: format,
      level: process.env.LOG_LEVEL || 'debug'
    })
  );
}

// File transports
if (process.env.NODE_ENV !== 'test') {
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '../../logs');
  
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: fileFormat,
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    })
  );

  // HTTP log file (for morgan integration)
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      format: fileFormat,
      level: 'http',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Add stream for morgan integration
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Custom logging methods
logger.request = (req, res, duration) => {
  const { method, url, ip, headers } = req;
  const { statusCode } = res;
  
  logger.http('HTTP Request', {
    method,
    url,
    ip,
    userAgent: headers['user-agent'],
    statusCode,
    duration: duration ? `${duration}ms` : undefined,
    userId: req.user?.id,
  });
};

logger.auth = (action, userId, email, ip, success = true, error = null) => {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Auth: ${action}`, {
    userId,
    email,
    ip,
    success,
    error: error?.message,
  });
};

logger.database = (action, collection, query = {}, error = null) => {
  const level = error ? 'error' : 'debug';
  logger.log(level, `Database: ${action}`, {
    collection,
    query: JSON.stringify(query),
    error: error?.message,
  });
};

logger.validation = (field, value, error) => {
  logger.warn('Validation Error', {
    field,
    value: typeof value === 'string' ? value.substring(0, 50) : value,
    error,
  });
};

logger.security = (event, details, level = 'warn') => {
  logger.log(level, `Security: ${event}`, details);
};

logger.file = (action, filename, size, userId, error = null) => {
  const level = error ? 'error' : 'info';
  logger.log(level, `File: ${action}`, {
    filename,
    size,
    userId,
    error: error?.message,
  });
};

logger.performance = (operation, duration, details = {}) => {
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...details,
  });
};

// Error handling
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

export default logger;