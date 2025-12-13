import pino from 'pino';

/**
 * Structured Logger for Production
 * 
 * Usage:
 *   logger.info('User authenticated');
 *   logger.error({ err }, 'Authentication failed');
 *   logger.debug({ userId, shopDomain }, 'Processing request');
 * 
 * Log Levels: trace, debug, info, warn, error, fatal
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

export const logger = pino({
  level: logLevel,
  
  // Redact sensitive fields automatically
  redact: {
    paths: [
      'headers.authorization',
      'headers.cookie',
      'headers["x-shopify-access-token"]',
      'body.password',
      'body.customerEmail',
      'body.email',
      'apiKey',
      'accessToken',
      'secret',
    ],
    remove: true,
  },

  // Pretty print in development
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    },
  } : undefined,

  // Base fields for all logs
  base: {
    env: process.env.NODE_ENV,
    app: 'Shopibot',
  },

  // Timestamp format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

/**
 * Create a child logger with additional context
 * 
 * @example
 * const requestLogger = createLogger({ requestId: '123', shop: 'example.myshopify.com' });
 * requestLogger.info('Processing request');
 */
export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Log error with proper error handling
 * 
 * @example
 * logError(error, 'Failed to process request', { userId: '123' });
 */
export function logError(
  error: unknown,
  message: string,
  context?: Record<string, unknown>
) {
  if (error instanceof Error) {
    logger.error({
      err: {
        message: error.message,
        name: error.name,
        stack: isDevelopment ? error.stack : undefined,
      },
      ...context,
    }, message);
  } else {
    logger.error({
      error: String(error),
      ...context,
    }, message);
  }
}

export default logger;
