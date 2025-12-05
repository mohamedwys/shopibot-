import * as Sentry from '@sentry/react';

const SENTRY_DSN = typeof window !== 'undefined' ? window.ENV?.SENTRY_DSN : undefined;
const NODE_ENV = typeof window !== 'undefined' ? window.ENV?.NODE_ENV : undefined;

/**
 * Initialize Sentry for client-side error tracking
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️ SENTRY_DSN not configured - client-side error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Replay sessions for debugging
    replaysSessionSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Before sending error, filter out sensitive data
    beforeSend(event) {
      // Remove cookies and sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['cookie'];
        delete event.request.headers['authorization'];
      }

      // Remove PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            delete breadcrumb.data.email;
            delete breadcrumb.data.customerEmail;
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop limit exceeded',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // Shopify App Bridge
      'Shopify App Bridge',
    ],
  });

  console.log('✅ Sentry initialized for client-side error tracking');
}

/**
 * Error Boundary component for React
 */
export const SentryErrorBoundary = Sentry.withErrorBoundary;

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!SENTRY_DSN) return;

  Sentry.captureException(error, {
    extra: context,
  });
}
