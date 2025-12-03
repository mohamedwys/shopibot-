import crypto from 'crypto';

/**
 * Webhook Signature Verification
 *
 * This module provides utilities for verifying Shopify webhook signatures.
 * CRITICAL for GDPR webhooks to ensure they're actually from Shopify.
 *
 * Shopify signs webhooks with HMAC-SHA256 using the app's client secret.
 */

/**
 * Verify Shopify webhook signature
 *
 * @param body - Raw request body (string or Buffer)
 * @param signature - HMAC signature from X-Shopify-Hmac-SHA256 header
 * @param secret - Shopify app client secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  body: string | Buffer,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.error('❌ Webhook verification failed: No signature provided');
    return false;
  }

  if (!secret) {
    console.error('❌ Webhook verification failed: No secret configured');
    return false;
  }

  try {
    // Compute HMAC-SHA256 of the body
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    // Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hmac)
    );

    if (!isValid) {
      console.error('❌ Webhook verification failed: Signature mismatch');
      console.error('Expected:', hmac);
      console.error('Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Webhook verification error:', error);
    return false;
  }
}

/**
 * Extract webhook signature from request headers
 *
 * @param request - Request object
 * @returns HMAC signature or null
 */
export function getWebhookSignature(request: Request): string | null {
  return request.headers.get('X-Shopify-Hmac-SHA256');
}

/**
 * Extract webhook topic from request headers
 *
 * @param request - Request object
 * @returns Webhook topic (e.g., "customers/data_request")
 */
export function getWebhookTopic(request: Request): string | null {
  return request.headers.get('X-Shopify-Topic');
}

/**
 * Extract shop domain from request headers
 *
 * @param request - Request object
 * @returns Shop domain (e.g., "my-store.myshopify.com")
 */
export function getWebhookShop(request: Request): string | null {
  return request.headers.get('X-Shopify-Shop-Domain');
}

/**
 * Extract webhook ID from request headers
 *
 * @param request - Request object
 * @returns Webhook ID
 */
export function getWebhookId(request: Request): string | null {
  return request.headers.get('X-Shopify-Webhook-Id');
}

/**
 * Verify webhook request and extract metadata
 *
 * @param request - Request object
 * @param body - Raw request body
 * @param secret - Shopify app client secret
 * @returns Verification result with metadata
 */
export async function verifyWebhookRequest(
  request: Request,
  body: string | Buffer,
  secret: string
): Promise<{
  isValid: boolean;
  topic: string | null;
  shop: string | null;
  webhookId: string | null;
  error?: string;
}> {
  const signature = getWebhookSignature(request);
  const topic = getWebhookTopic(request);
  const shop = getWebhookShop(request);
  const webhookId = getWebhookId(request);

  // Verify signature
  const isValid = verifyWebhookSignature(body, signature, secret);

  if (!isValid) {
    return {
      isValid: false,
      topic,
      shop,
      webhookId,
      error: 'Invalid webhook signature',
    };
  }

  // Additional validation
  if (!topic) {
    return {
      isValid: false,
      topic,
      shop,
      webhookId,
      error: 'Missing webhook topic',
    };
  }

  if (!shop) {
    return {
      isValid: false,
      topic,
      shop,
      webhookId,
      error: 'Missing shop domain',
    };
  }

  return {
    isValid: true,
    topic,
    shop,
    webhookId,
  };
}

/**
 * Create a middleware-style webhook verifier
 *
 * @param secret - Shopify app client secret
 * @returns Verification function
 */
export function createWebhookVerifier(secret: string) {
  return async (request: Request, body: string | Buffer) => {
    return verifyWebhookRequest(request, body, secret);
  };
}

/**
 * Log webhook verification failure for monitoring
 */
export function logWebhookVerificationFailure(
  topic: string | null,
  shop: string | null,
  error: string,
  metadata?: Record<string, any>
): void {
  console.error('🚨 Webhook verification failed', {
    topic,
    shop,
    error,
    ...metadata,
  });

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry.captureMessage('Webhook verification failed', { extra: { topic, shop, error } });
    // Example: DataDog.increment('webhook.verification.failed', { topic, shop });
  }
}

/**
 * Verify webhook and return appropriate error response if invalid
 *
 * @param request - Request object
 * @param body - Raw request body
 * @param secret - Shopify app client secret
 * @returns null if valid, error Response if invalid
 */
export async function verifyWebhookOrError(
  request: Request,
  body: string | Buffer,
  secret: string
): Promise<Response | null> {
  const verification = await verifyWebhookRequest(request, body, secret);

  if (!verification.isValid) {
    logWebhookVerificationFailure(
      verification.topic,
      verification.shop,
      verification.error || 'Unknown error',
      { webhookId: verification.webhookId }
    );

    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }

  return null;
}

/**
 * Extract and validate webhook payload
 *
 * @param body - Raw request body
 * @returns Parsed JSON payload or null
 */
export function parseWebhookPayload<T = any>(body: string): T | null {
  try {
    return JSON.parse(body);
  } catch (error) {
    console.error('❌ Failed to parse webhook payload:', error);
    return null;
  }
}

/**
 * Check if webhook is a test/development webhook
 * Shopify sends test webhooks with specific patterns
 */
export function isTestWebhook(payload: any): boolean {
  // Check if it's a test webhook (Shopify uses specific test IDs)
  return !!(
    payload?.id === 0 ||
    payload?.id === 1 ||
    payload?.test === true ||
    payload?.email?.includes('test@example.com')
  );
}

/**
 * Validate webhook topic against expected topics
 *
 * @param topic - Actual webhook topic
 * @param expectedTopics - Array of expected topics
 * @returns True if topic is expected
 */
export function validateWebhookTopic(
  topic: string | null,
  expectedTopics: string[]
): boolean {
  if (!topic) return false;
  return expectedTopics.includes(topic);
}

/**
 * GDPR webhook topics that require special handling
 */
export const GDPR_WEBHOOK_TOPICS = [
  'customers/data_request',
  'customers/redact',
  'shop/redact',
] as const;

/**
 * Check if webhook is a GDPR webhook
 */
export function isGDPRWebhook(topic: string | null): boolean {
  if (!topic) return false;
  return (GDPR_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}

/**
 * Mandatory Shopify webhook topics
 */
export const MANDATORY_WEBHOOK_TOPICS = [
  ...GDPR_WEBHOOK_TOPICS,
  'app/uninstalled',
] as const;

/**
 * Check if webhook is mandatory
 */
export function isMandatoryWebhook(topic: string | null): boolean {
  if (!topic) return false;
  return (MANDATORY_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}

/**
 * Get webhook secret from environment
 * Falls back to Shopify API secret if WEBHOOK_SECRET not set
 */
export function getWebhookSecret(): string {
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET;

  if (!webhookSecret) {
    console.error('🚨 CRITICAL: SHOPIFY_API_SECRET not configured!');
    console.error('💡 Webhook verification will fail without this secret.');
    throw new Error('SHOPIFY_API_SECRET environment variable is required for webhook verification');
  }

  return webhookSecret;
}

/**
 * Replay attack prevention - check webhook timestamp
 * Shopify webhooks include a timestamp, we should reject old webhooks
 *
 * @param webhookId - Webhook ID (includes timestamp)
 * @param maxAgeSeconds - Maximum age in seconds (default: 5 minutes)
 * @returns True if webhook is fresh
 */
export function isWebhookFresh(
  webhookId: string | null,
  maxAgeSeconds: number = 300
): boolean {
  if (!webhookId) return false;

  try {
    // Shopify webhook IDs are timestamps
    const timestamp = parseInt(webhookId, 10);
    const now = Date.now() / 1000;
    const age = now - timestamp;

    if (age > maxAgeSeconds) {
      console.warn(`⚠️ Old webhook detected: ${age}s old (max: ${maxAgeSeconds}s)`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to parse webhook timestamp:', error);
    return false;
  }
}
