import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define custom JSON format for Cloud Run
const cloudRunFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Output JSON that Cloud Logging can parse
    return JSON.stringify({
      severity: level.toUpperCase(), // Cloud Logging expects this field
      message,
      timestamp,
      ...meta,
    });
  })
);

// Define colorful format for local development
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Decide transports
const transports = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? cloudRunFormat : devFormat,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  transports,
  exitOnError: false,
});

// Add stream for morgan integration
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Custom logging helpers
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
