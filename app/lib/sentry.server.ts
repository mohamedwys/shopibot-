import * as Sentry from '@sentry/remix';

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV;

/**
 * Initialize Sentry for server-side error tracking
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️ SENTRY_DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV || 'development',

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // Adjust in production (e.g., 0.1 for 10%)
    tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
      // HTTP integration for tracking API calls
      Sentry.httpIntegration({ tracing: true }),

      // Node profiling integration
      Sentry.nodeProfilingIntegration(),
    ],

    // Before sending error, filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-shopify-access-token'];
      }

      // Remove sensitive query parameters
      if (event.request?.query_string) {
        const sanitized = event.request.query_string
          .replace(/access_token=[^&]*/gi, 'access_token=[REDACTED]')
          .replace(/api_key=[^&]*/gi, 'api_key=[REDACTED]')
          .replace(/password=[^&]*/gi, 'password=[REDACTED]');
        event.request.query_string = sanitized;
      }

      // Remove PII from extra data
      if (event.extra) {
        delete event.extra['customerEmail'];
        delete event.extra['email'];
        delete event.extra['accessToken'];
      }

      return event;
    },

    // Ignore specific errors that are not actionable
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Network errors
      'NetworkError',
      'Network request failed',
      // Shopify session errors (handled gracefully)
      'Session not found',
      'Invalid session',
    ],
  });

  console.log('✅ Sentry initialized for server-side error tracking');
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message for non-error events
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) return;

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id?: string; shop?: string; email?: string }) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: user.id,
    username: user.shop,
    // Don't send email to Sentry (PII)
  });
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  category: string,
  message: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
  });
}
