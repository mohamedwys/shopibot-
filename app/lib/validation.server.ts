import { z } from 'zod';

/**
 * Input Validation Schemas
 *
 * This file contains Zod schemas for validating all API inputs.
 * Using Zod prevents injection attacks, data corruption, and unexpected errors.
 */

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Shopify domain validation
 * Ensures domain follows .myshopify.com format or is a valid custom domain
 */
export const shopDomainSchema = z.string()
  .min(1, 'Shop domain is required')
  .max(255, 'Shop domain too long')
  .regex(
    /^[a-z0-9-]+\.myshopify\.com$|^[a-z0-9-]+\.[a-z]{2,}$/i,
    'Invalid shop domain format'
  );

/**
 * Session ID validation
 * Accepts any string format (UUID, custom format like session_timestamp_random)
 */
export const sessionIdSchema = z.string()
  .min(1, 'Session ID cannot be empty')
  .max(200, 'Session ID too long')
  .optional();

/**
 * Customer ID validation
 */
export const customerIdSchema = z.string()
  .min(1, 'Customer ID cannot be empty')
  .max(100, 'Customer ID too long')
  .optional();

/**
 * URL validation
 */
export const urlSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL too long');

/**
 * Color hex code validation
 */
export const hexColorSchema = z.string()
  .regex(/^#([0-9A-Fa-f]{3}){1,2}$/, 'Invalid hex color format');

/**
 * Position validation for widget
 */
export const positionSchema = z.enum([
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left'
], {
  errorMap: () => ({ message: 'Invalid position value' })
});

// ============================================================================
// Chat/Message Schemas
// ============================================================================

/**
 * User message validation for chat
 */
export const userMessageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(2000, 'Message too long (max 2000 characters)')
  .trim()
  .refine(
    (msg) => msg.length > 0,
    'Message cannot be only whitespace'
  );

/**
 * Chat context validation
 * All fields are optional/nullable to support various widget implementations
 * Uses passthrough() to allow additional fields
 * Note: .nullish() allows both null and undefined values
 */
export const chatContextSchema = z.object({
  previousMessages: z.array(z.string()).nullish(),
  sessionId: z.string().min(1).max(200).nullish(),
  customerId: z.string().min(1).max(100).nullish(),
  shopDomain: z.string().max(255).nullish(), // Relaxed validation for widget compatibility
  sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).nullish(),
  intent: z.string().max(50).nullish(),
  timestamp: z.string().datetime().nullish(),
  userAgent: z.string().max(500).nullish(),
  referer: z.string().max(2048).nullish(),
  page: z.string().max(2048).nullish(),
  productId: z.string().max(100).nullish(), // Widget sends null when no product
  conversationHistory: z.array(z.any()).nullish(),
}).passthrough().optional();

/**
 * Product recommendation validation
 */
export const productRecommendationSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500),
  handle: z.string().min(1).max(255),
  price: z.string().regex(/^\d+(\.\d{2})?$/, 'Invalid price format'),
  image: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  relevanceScore: z.number().min(0).max(100).optional(),
});

/**
 * Chat request validation (for sales assistant API)
 * Supports both direct API calls and widget requests
 * Uses passthrough() to allow additional fields for flexibility
 */
export const chatRequestSchema = z.object({
  userMessage: userMessageSchema.optional(),
  message: userMessageSchema.optional(), // Alternative field name
  sessionId: z.string().min(1).max(200).optional(),
  customerId: z.string().min(1).max(100).optional(),
  context: chatContextSchema.optional(),
  products: z.array(z.object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    description: z.string().optional(),
    price: z.string(),
    image: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough().refine(
  (data) => data.userMessage || data.message,
  'Either userMessage or message is required'
);

// ============================================================================
// Widget Settings Schemas
// ============================================================================

/**
 * Widget settings validation
 */
export const widgetSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  position: positionSchema.default('bottom-right'),
  buttonText: z.string()
    .min(1, 'Button text cannot be empty')
    .max(50, 'Button text too long')
    .default('Ask AI Assistant'),
  chatTitle: z.string()
    .min(1, 'Chat title cannot be empty')
    .max(100, 'Chat title too long')
    .default('AI Sales Assistant'),
  welcomeMessage: z.string()
    .min(1, 'Welcome message cannot be empty')
    .max(500, 'Welcome message too long')
    .default('Hello! How can I help you today?'),
  inputPlaceholder: z.string()
    .min(1, 'Input placeholder cannot be empty')
    .max(100, 'Input placeholder too long')
    .default('Ask me anything...'),
  primaryColor: hexColorSchema.default('#e620e6'),
  webhookUrl: urlSchema.optional(),
}).partial();

// ============================================================================
// GDPR Webhook Schemas
// ============================================================================

/**
 * Customer data request payload validation
 */
export const customerDataRequestSchema = z.object({
  shop_id: z.number().positive(),
  shop_domain: shopDomainSchema,
  customer: z.object({
    id: z.number().positive(),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
});

/**
 * Customer redact payload validation
 */
export const customerRedactSchema = z.object({
  shop_id: z.number().positive(),
  shop_domain: shopDomainSchema,
  customer: z.object({
    id: z.number().positive(),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
});

/**
 * Shop redact payload validation
 */
export const shopRedactSchema = z.object({
  shop_id: z.number().positive(),
  shop_domain: shopDomainSchema,
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Shop query parameter validation
 */
export const shopQuerySchema = z.object({
  shop: shopDomainSchema,
});

/**
 * Optional shop query parameter
 */
export const optionalShopQuerySchema = z.object({
  shop: shopDomainSchema.optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate and parse data with a Zod schema
 * Returns either parsed data or validation errors
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for user-friendly display
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(errors: z.ZodError, status = 400) {
  return {
    error: 'Validation failed',
    details: formatZodErrors(errors),
    status,
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type WidgetSettings = z.infer<typeof widgetSettingsSchema>;
export type CustomerDataRequest = z.infer<typeof customerDataRequestSchema>;
export type CustomerRedact = z.infer<typeof customerRedactSchema>;
export type ShopRedact = z.infer<typeof shopRedactSchema>;
export type ProductRecommendation = z.infer<typeof productRecommendationSchema>;
