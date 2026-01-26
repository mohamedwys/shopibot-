/**
 * TypeScript Type Definitions
 *
 * This file contains all shared TypeScript interfaces and types
 * for the application.
 */

import type { PlanCodeType } from './plans.config';

/**
 * Widget Settings stored in database
 */
export interface WidgetSettings {
  id?: number;
  shop: string;
  enabled: boolean;
  position: string;
  buttonText: string;
  chatTitle: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  primaryColor: string;
  interfaceLanguage: string;
  plan: PlanCodeType;
  openaiApiKey?: string | null;
  apiKeyLastUpdated?: Date | string | null;
  apiKeyLastTested?: Date | string | null;
  apiKeyStatus?: string | null;
  webhookUrl?: string | null;
  workflowType?: 'DEFAULT' | 'CUSTOM';
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // Quick Button Visibility Settings
  bestSellersVisible?: boolean;
  newArrivalsVisible?: boolean;
  onSaleVisible?: boolean;
  recommendationsVisible?: boolean;
  shippingVisible?: boolean;
  returnsVisible?: boolean;
  trackOrderVisible?: boolean;
  helpVisible?: boolean;
}

/**
 * Quick Button Visibility Configuration
 * Used for structured access to button visibility settings
 */
export interface QuickButtonVisibility {
  bestSellers: boolean;
  newArrivals: boolean;
  onSale: boolean;
  recommendations: boolean;
  shipping: boolean;
  returns: boolean;
  trackOrder: boolean;
  help: boolean;
}

/**
 * Quick Button ID type for type-safe button references
 */
export type QuickButtonId = keyof QuickButtonVisibility;

/**
 * Conversation Usage Data
 */
export interface ConversationUsage {
  /** Number of conversations used this month */
  used: number;

  /** Maximum conversations allowed (Infinity for unlimited) */
  limit: number;

  /** Percentage of limit used (0-100, always 0 for unlimited) */
  percentUsed: number;

  /** Whether this plan has unlimited conversations */
  isUnlimited: boolean;

  /** Current plan identifier */
  currentPlan: string;

  /** Date when usage resets (1st of next month) */
  resetDate?: Date | string;

  /** Start of current billing period */
  periodStart?: Date | string;
}

/**
 * BYOK Usage Data (token and cost tracking)
 */
export interface BYOKUsage {
  /** Total tokens used this month */
  tokensUsed: number;

  /** Estimated cost in USD */
  costUSD: number;

  /** Number of requests made */
  requestCount: number;

  /** Average tokens per request */
  avgTokensPerRequest: number;

  /** Last updated timestamp */
  lastUpdated: Date | string;
}

/**
 * Billing Status from Shopify
 */
export interface BillingStatus {
  /** Whether shop has active payment */
  hasActivePayment: boolean;

  /** Active subscriptions */
  appSubscriptions: any[];

  /** Active plan name (billing name format) */
  activePlan: string | null;
}

/**
 * Chat Context (passed to AI)
 */
export interface ChatContext {
  customerId?: string;
  customerEmail?: string;
  sessionId?: string;
  locale?: string;
  previousMessages?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  isFirstMessage?: boolean;
  sentiment?: string;
  intent?: string;
  shopDomain?: string;
  languageInstruction?: string;
  timestamp?: string;
  userAgent?: string;
  referer?: string;
  plan?: string;
  openaiApiKey?: string;
  [key: string]: any;
}

/**
 * N8N Response
 */
export interface N8NResponse {
  message: string;
  recommendations?: any[];
  quickReplies?: string[];
  suggestedActions?: string[];
  confidence?: number;
  messageType?: string;
  requiresHumanEscalation?: boolean;
}

/**
 * API Response for chat endpoint
 */
export interface ChatResponse {
  response?: string;
  message: string;
  messageType: string;
  recommendations: any[];
  quickReplies: string[];
  suggestedActions?: string[];
  confidence: number;
  sentiment: string;
  requiresHumanEscalation: boolean;
  timestamp: string;
  sessionId: string;
  analytics: {
    intentDetected: string;
    subIntent?: string;
    sentiment: string;
    confidence: number;
    productsShown: number;
    responseTime: number;
    isSupportIntent: boolean;
    isProductIntent: boolean;
  };
  metadata?: {
    intent: string;
    sentiment: string;
    responseTime: number;
  };
  success: boolean;
  error?: string;
  conversationsUsed?: number;
  conversationLimit?: number;
  currentPlan?: string;
  upgradeUrl?: string;
  upgradeAvailable?: boolean;
}

/**
 * Action Data (form submission response)
 */
export interface ActionData {
  success: boolean;
  message?: string;
  details?: string;
  errors?: Record<string, string>;
}

/**
 * Loader Data for app.settings.tsx
 */
export interface SettingsLoaderData {
  settings: WidgetSettings;
  conversationUsage: ConversationUsage | null;
  planLimits: ReturnType<typeof import('./plans.config').getPlanLimits>;
  activePlan: string | null;
}

/**
 * Loader Data for api.widget-settings.tsx
 */
export interface WidgetSettingsLoaderData {
  settings: WidgetSettings;
  conversationUsage?: ConversationUsage | null;
}
