/**
 * Plan Configuration - Single Source of Truth
 *
 * This file defines all subscription plans and their features.
 * All other files should import and use these constants.
 */

/**
 * Plan codes used in the database (widgetSettings.plan field)
 */
export const PlanCode = {
  BYOK: 'BYOK',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
} as const;

export type PlanCodeType = typeof PlanCode[keyof typeof PlanCode];

/**
 * Plan names used in Shopify billing API
 */
export const PlanBillingName = {
  BYOK: 'BYOK Plan',
  STARTER: 'Starter Plan',
  PROFESSIONAL: 'Professional Plan',
} as const;

export type PlanBillingNameType = typeof PlanBillingName[keyof typeof PlanBillingName];

/**
 * Plan limits and features
 */
export interface PlanLimits {
  maxConversations: number;
  hasAdvancedAnalytics: boolean;
  hasCustomWebhook: boolean;
  hasPrioritySupport: boolean;
  hasSentimentAnalysis: boolean;
}

/**
 * Plan configuration
 */
export interface PlanConfig {
  code: PlanCodeType;
  billingName: PlanBillingNameType;
  displayName: string;
  price: number;
  currency: string;
  limits: PlanLimits;
  description: string;
}

/**
 * All plan configurations
 */
export const PLAN_CONFIGS: Record<PlanCodeType, PlanConfig> = {
  [PlanCode.BYOK]: {
    code: PlanCode.BYOK,
    billingName: PlanBillingName.BYOK,
    displayName: 'BYOK (Bring Your Own Key)',
    price: 5,
    currency: 'USD',
    limits: {
      maxConversations: Infinity,
      hasAdvancedAnalytics: false,
      hasCustomWebhook: false,
      hasPrioritySupport: false,
      hasSentimentAnalysis: false,
    },
    description: 'Use your own OpenAI API key for unlimited conversations at minimal cost',
  },
  [PlanCode.STARTER]: {
    code: PlanCode.STARTER,
    billingName: PlanBillingName.STARTER,
    displayName: 'Starter',
    price: 25,
    currency: 'USD',
    limits: {
      maxConversations: 1000,
      hasAdvancedAnalytics: false,
      hasCustomWebhook: false,
      hasPrioritySupport: false,
      hasSentimentAnalysis: false,
    },
    description: 'Perfect for small stores getting started with AI chat',
  },
  [PlanCode.PROFESSIONAL]: {
    code: PlanCode.PROFESSIONAL,
    billingName: PlanBillingName.PROFESSIONAL,
    displayName: 'Professional',
    price: 79,
    currency: 'USD',
    limits: {
      maxConversations: Infinity,
      hasAdvancedAnalytics: true,
      hasCustomWebhook: true,
      hasPrioritySupport: true,
      hasSentimentAnalysis: true,
    },
    description: 'Unlimited conversations with advanced features for growing businesses',
  },
} as const;

/**
 * Mapping: Billing Name → Plan Code
 */
export const BILLING_NAME_TO_CODE: Record<PlanBillingNameType, PlanCodeType> = {
  [PlanBillingName.BYOK]: PlanCode.BYOK,
  [PlanBillingName.STARTER]: PlanCode.STARTER,
  [PlanBillingName.PROFESSIONAL]: PlanCode.PROFESSIONAL,
};

/**
 * Mapping: Plan Code → Billing Name
 */
export const CODE_TO_BILLING_NAME: Record<PlanCodeType, PlanBillingNameType> = {
  [PlanCode.BYOK]: PlanBillingName.BYOK,
  [PlanCode.STARTER]: PlanBillingName.STARTER,
  [PlanCode.PROFESSIONAL]: PlanBillingName.PROFESSIONAL,
};

/**
 * Legacy plan code mappings (for backward compatibility with existing database data)
 * These should be migrated over time
 */
export const LEGACY_PLAN_CODE_MAPPING: Record<string, PlanCodeType> = {
  'BASIC': PlanCode.STARTER,
  'UNLIMITED': PlanCode.PROFESSIONAL,
  'BYOK': PlanCode.BYOK,
  // Also support billing names directly
  'BYOK Plan': PlanCode.BYOK,
  'Starter Plan': PlanCode.STARTER,
  'Professional Plan': PlanCode.PROFESSIONAL,
};

/**
 * Helper: Convert any plan identifier to canonical plan code
 *
 * @param planIdentifier - Can be legacy code, billing name, or current code
 * @returns Canonical plan code or STARTER as fallback
 */
export function normalizePlanCode(planIdentifier: string | null | undefined): PlanCodeType {
  if (!planIdentifier) {
    return PlanCode.STARTER;
  }

  // Check if it's already a valid plan code
  if (Object.values(PlanCode).includes(planIdentifier as PlanCodeType)) {
    return planIdentifier as PlanCodeType;
  }

  // Check if it's a billing name
  if (planIdentifier in BILLING_NAME_TO_CODE) {
    return BILLING_NAME_TO_CODE[planIdentifier as PlanBillingNameType];
  }

  // Check legacy mappings
  if (planIdentifier in LEGACY_PLAN_CODE_MAPPING) {
    return LEGACY_PLAN_CODE_MAPPING[planIdentifier];
  }

  // Fallback to STARTER
  console.warn(`Unknown plan identifier: ${planIdentifier}, falling back to STARTER`);
  return PlanCode.STARTER;
}

/**
 * Helper: Get plan config by any identifier
 *
 * @param planIdentifier - Can be legacy code, billing name, or current code
 * @returns Plan configuration
 */
export function getPlanConfig(planIdentifier: string | null | undefined): PlanConfig {
  const code = normalizePlanCode(planIdentifier);
  return PLAN_CONFIGS[code];
}

/**
 * Helper: Get plan limits by any identifier
 *
 * @param planIdentifier - Can be legacy code, billing name, or current code
 * @returns Plan limits
 */
export function getPlanLimits(planIdentifier: string | null | undefined): PlanLimits {
  return getPlanConfig(planIdentifier).limits;
}

/**
 * Helper: Get billing name by any identifier
 *
 * @param planIdentifier - Can be legacy code, billing name, or current code
 * @returns Billing name for Shopify API
 */
export function getPlanBillingName(planIdentifier: string | null | undefined): PlanBillingNameType {
  const code = normalizePlanCode(planIdentifier);
  return CODE_TO_BILLING_NAME[code];
}

/**
 * Helper: Check if plan has unlimited conversations
 *
 * @param planIdentifier - Can be legacy code, billing name, or current code
 * @returns True if plan has unlimited conversations
 */
export function isUnlimitedPlan(planIdentifier: string | null | undefined): boolean {
  const limits = getPlanLimits(planIdentifier);
  return limits.maxConversations === Infinity;
}

/**
 * Helper: Get all billing names for Shopify API
 *
 * @returns Array of all billing names
 */
export function getAllBillingNames(): PlanBillingNameType[] {
  return Object.values(PlanBillingName);
}

/**
 * Helper: Get plan display options for UI dropdowns
 *
 * @returns Array of plan options with label and value
 */
export function getPlanOptions() {
  return Object.values(PLAN_CONFIGS).map(config => ({
    label: `${config.displayName} ($${config.price}/${config.currency === 'USD' ? 'month' : config.currency})`,
    value: config.code,
    config,
  }));
}
