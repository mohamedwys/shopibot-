/**
 * Security Headers Middleware
 *
 * This module provides security headers to protect against common web vulnerabilities.
 * Implements OWASP security best practices and Shopify App Store requirements.
 */

export interface SecurityHeadersConfig {
  /** Enable Content Security Policy */
  enableCSP?: boolean;
  /** Enable strict transport security */
  enableHSTS?: boolean;
  /** Enable frame protection */
  enableFrameProtection?: boolean;
  /** Enable XSS protection */
  enableXSSProtection?: boolean;
  /** Enable content type sniffing protection */
  enableNoSniff?: boolean;
  /** Enable referrer policy */
  enableReferrerPolicy?: boolean;
  /** Enable permissions policy */
  enablePermissionsPolicy?: boolean;
}

/**
 * Default security headers configuration
 */
const DEFAULT_CONFIG: SecurityHeadersConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableFrameProtection: true,
  enableXSSProtection: true,
  enableNoSniff: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,
};

/**
 * Get comprehensive security headers
 *
 * @param config - Optional configuration to override defaults
 * @returns Headers object with security headers
 */
export function getSecurityHeaders(
  config: SecurityHeadersConfig = DEFAULT_CONFIG
): HeadersInit {
  const headers: Record<string, string> = {};

  // Content Security Policy (CSP)
  // Prevents XSS attacks by controlling which resources can be loaded
  if (config.enableCSP) {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.shopify.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://cdn.shopify.com",
      "connect-src 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com",
      "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  // HTTP Strict Transport Security (HSTS)
  // Forces HTTPS connections for security
  if (config.enableHSTS) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  // X-Frame-Options
  // Prevents clickjacking attacks
  if (config.enableFrameProtection) {
    // Allow framing from Shopify admin
    headers['X-Frame-Options'] = 'ALLOW-FROM https://admin.shopify.com';
  }

  // X-Content-Type-Options
  // Prevents MIME type sniffing
  if (config.enableNoSniff) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // X-XSS-Protection
  // Enables browser XSS protection (legacy but still useful)
  if (config.enableXSSProtection) {
    headers['X-XSS-Protection'] = '1; mode=block';
  }

  // Referrer-Policy
  // Controls referrer information sent with requests
  if (config.enableReferrerPolicy) {
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  }

  // Permissions-Policy (formerly Feature-Policy)
  // Controls which browser features can be used
  if (config.enablePermissionsPolicy) {
    headers['Permissions-Policy'] = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', ');
  }

  // X-Content-Type-Options
  // Prevents browsers from interpreting files as a different MIME type
  headers['X-Content-Type-Options'] = 'nosniff';

  // X-DNS-Prefetch-Control
  // Controls DNS prefetching
  headers['X-DNS-Prefetch-Control'] = 'off';

  // X-Download-Options
  // Prevents Internet Explorer from executing downloads
  headers['X-Download-Options'] = 'noopen';

  // X-Permitted-Cross-Domain-Policies
  // Controls cross-domain policy files (Flash, PDF, etc.)
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';

  return headers;
}

/**
 * Get API-specific security headers
 * More permissive CSP for API endpoints
 */
export function getAPISecurityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
  };
}

/**
 * Get webhook-specific security headers
 * Minimal headers for webhook endpoints
 */
export function getWebhookSecurityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow', // Don't index webhook endpoints
  };
}

/**
 * Merge security headers with existing headers
 *
 * @param existingHeaders - Existing headers object or Headers instance
 * @param securityHeaders - Security headers to merge
 * @returns Combined headers
 */
export function mergeSecurityHeaders(
  existingHeaders: HeadersInit | Headers,
  securityHeaders: HeadersInit = getSecurityHeaders()
): HeadersInit {
  const merged: Record<string, string> = {};

  // Convert existing headers to object
  if (existingHeaders instanceof Headers) {
    existingHeaders.forEach((value, key) => {
      merged[key] = value;
    });
  } else if (Array.isArray(existingHeaders)) {
    existingHeaders.forEach(([key, value]) => {
      merged[key] = value;
    });
  } else {
    Object.assign(merged, existingHeaders);
  }

  // Add security headers (don't override existing)
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (!merged[key]) {
      merged[key] = value;
    }
  });

  return merged;
}

/**
 * Apply security headers to a Response
 *
 * @param response - Response to add headers to
 * @param config - Optional security headers configuration
 * @returns Response with security headers
 */
export function applySecurityHeaders(
  response: Response,
  config?: SecurityHeadersConfig
): Response {
  const securityHeaders = getSecurityHeaders(config);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  });

  return response;
}

/**
 * Log security header violations (for monitoring)
 */
export function logSecurityViolation(
  violationType: string,
  details: Record<string, any>
): void {
  console.warn(`🚨 Security Violation: ${violationType}`, details);

  // In production, integrate with monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry.captureMessage(`Security violation: ${violationType}`, { extra: details });
    // Example: DataDog.increment('security.violation', { type: violationType });
  }
}

/**
 * Validate request origin against allowed patterns
 *
 * @param origin - Request origin
 * @param allowedPatterns - Array of allowed origin patterns
 * @returns True if origin is allowed
 */
export function validateOrigin(
  origin: string | null,
  allowedPatterns: (string | RegExp)[]
): boolean {
  if (!origin) return false;

  return allowedPatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(origin);
    }
    return pattern === origin;
  });
}

/**
 * Security headers for Shopify embedded apps
 */
export function getEmbeddedAppSecurityHeaders(): HeadersInit {
  return {
    // More permissive CSP for embedded apps
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com",
      "style-src 'self' 'unsafe-inline' https://cdn.shopify.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://cdn.shopify.com",
      "connect-src 'self' https://*.myshopify.com https://*.shopify.com",
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

/**
 * Check if request is from Shopify admin
 */
export function isShopifyAdminRequest(request: Request): boolean {
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');

  return !!(
    (referer && referer.includes('admin.shopify.com')) ||
    (origin && origin.includes('admin.shopify.com'))
  );
}

/**
 * Get security headers based on request context
 */
export function getContextualSecurityHeaders(request: Request): HeadersInit {
  const url = new URL(request.url);

  // Webhook endpoints
  if (url.pathname.startsWith('/webhooks/')) {
    return getWebhookSecurityHeaders();
  }

  // API endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/apps/')) {
    return getAPISecurityHeaders();
  }

  // Embedded app pages
  if (isShopifyAdminRequest(request)) {
    return getEmbeddedAppSecurityHeaders();
  }

  // Default security headers
  return getSecurityHeaders();
}
