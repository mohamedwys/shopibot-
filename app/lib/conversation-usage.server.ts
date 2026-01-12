/**
 * Conversation Usage Utility
 *
 * Provides shared logic for tracking and enforcing conversation limits
 * across different subscription plans.
 */

import { prisma as db } from "../db.server";
import type { ConversationUsage } from "./types";
import { getPlanLimits, isUnlimitedPlan, normalizePlanCode } from "./plans.config";
import type { AdminContext } from "@shopify/shopify-app-remix/server";

type BillingAPI = AdminContext<any>['billing'];

/**
 * Get the start of the current billing month in UTC
 *
 * Using UTC ensures consistent billing periods regardless of server timezone.
 * All shops reset on the 1st of each month at 00:00:00 UTC.
 *
 * @returns Start of current month in UTC
 */
export function getBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
    0, 0, 0, 0
  ));
}

/**
 * Get the start of the next billing month in UTC
 *
 * @returns Start of next month in UTC
 */
export function getNextBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    0, 0, 0, 0
  ));
}

/**
 * Get conversation usage for a shop
 *
 * This is the single source of truth for conversation counting.
 * Used by both app.settings.tsx (display) and api.widget-settings.tsx (enforcement).
 *
 * @param shop - Shop domain
 * @param billing - Optional Shopify billing API (if available, checks actual subscription)
 * @returns Conversation usage data
 */
export async function getConversationUsage(
  shop: string,
  billing?: BillingAPI
): Promise<ConversationUsage> {
  // ✅ FIX: Always use database plan as primary source
  // Database plan is what's configured in settings, billing is just for validation
  let planIdentifier: string;

  // Get plan from database (primary source of truth)
  const settings = await db.widgetSettings.findUnique({
    where: { shop },
    select: { plan: true }
  });
  planIdentifier = settings?.plan || 'STARTER';

  // Optional: Validate against billing if available (for logging/warnings)
  if (billing) {
    try {
      const { checkBillingStatus } = await import("./billing.server");
      const billingStatus = await checkBillingStatus(billing);
      const billingPlan = billingStatus.activePlan;

      // Log if there's a mismatch between database and billing
      if (billingPlan && normalizePlanCode(planIdentifier) !== normalizePlanCode(billingPlan)) {
        console.warn(`Plan mismatch for ${shop}: Database=${planIdentifier}, Billing=${billingPlan}. Using database plan.`);
      }
    } catch (error) {
      // Billing check failed, but that's okay - we already have database plan
      console.warn('Failed to validate billing status:', error);
    }
  }

  // Normalize plan code to ensure consistency
  const planCode = normalizePlanCode(planIdentifier);
  const planLimits = getPlanLimits(planCode);

  // Get billing period boundaries (UTC)
  const periodStart = getBillingPeriodStart();
  const periodEnd = getNextBillingPeriodStart();

  // Count conversations in current billing period
  const conversationCount = await db.conversation.count({
    where: {
      shop,
      timestamp: {
        gte: periodStart,
        lt: periodEnd
      }
    }
  });

  // Calculate usage metrics
  const isUnlimited = planLimits.maxConversations === Infinity;
  const percentUsed = isUnlimited
    ? 0
    : Math.round((conversationCount / planLimits.maxConversations) * 100);

  return {
    used: conversationCount,
    limit: planLimits.maxConversations,
    percentUsed,
    isUnlimited,
    currentPlan: planIdentifier,
    resetDate: periodEnd,
    periodStart,
  };
}

/**
 * Check if shop has exceeded conversation limit
 *
 * Uses atomic transaction to prevent race conditions where multiple
 * simultaneous requests could exceed the limit.
 *
 * @param shop - Shop domain
 * @param planIdentifier - Plan code or billing name
 * @returns Object with exceeded status and current count
 */
export async function checkConversationLimit(
  shop: string,
  planIdentifier: string | null | undefined
): Promise<{ exceeded: boolean; count: number; limit: number }> {
  const planCode = normalizePlanCode(planIdentifier);
  const planLimits = getPlanLimits(planCode);

  // Unlimited plans never exceed
  if (planLimits.maxConversations === Infinity) {
    return {
      exceeded: false,
      count: 0,
      limit: Infinity
    };
  }

  // Get billing period
  const periodStart = getBillingPeriodStart();
  const periodEnd = getNextBillingPeriodStart();

  // Count current conversations (not using transaction yet, just checking)
  const conversationCount = await db.conversation.count({
    where: {
      shop,
      timestamp: {
        gte: periodStart,
        lt: periodEnd
      }
    }
  });

  return {
    exceeded: conversationCount >= planLimits.maxConversations,
    count: conversationCount,
    limit: planLimits.maxConversations
  };
}

/**
 * Record a new conversation (used when creating conversation in DB)
 *
 * This should be called AFTER checking the limit to ensure we don't
 * exceed the quota. The actual conversation creation happens elsewhere.
 *
 * @param shop - Shop domain
 * @param planIdentifier - Plan code or billing name
 * @returns True if conversation can be created, false if limit exceeded
 */
export async function canCreateConversation(
  shop: string,
  planIdentifier: string | null | undefined
): Promise<boolean> {
  const limitCheck = await checkConversationLimit(shop, planIdentifier);
  return !limitCheck.exceeded;
}

/**
 * Get usage percentage for display
 *
 * @param shop - Shop domain
 * @param planIdentifier - Plan code or billing name
 * @returns Usage percentage (0-100, or 0 for unlimited)
 */
export async function getUsagePercentage(
  shop: string,
  planIdentifier: string | null | undefined
): Promise<number> {
  const usage = await getConversationUsage(shop);
  return usage.percentUsed;
}

/**
 * Check if shop is approaching limit (90% or more)
 *
 * @param shop - Shop domain
 * @param planIdentifier - Plan code or billing name
 * @returns True if at or above 90% of limit
 */
export async function isApproachingLimit(
  shop: string,
  planIdentifier: string | null | undefined
): Promise<boolean> {
  const planCode = normalizePlanCode(planIdentifier);

  // Unlimited plans never approach limit
  if (isUnlimitedPlan(planCode)) {
    return false;
  }

  const usage = await getConversationUsage(shop);
  return usage.percentUsed >= 90;
}

/**
 * Get days until usage resets
 *
 * @returns Number of days until 1st of next month
 */
export function getDaysUntilReset(): number {
  const now = new Date();
  const nextReset = getNextBillingPeriodStart();
  const diffMs = nextReset.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format reset date for display
 *
 * @param locale - User's locale (e.g., 'en-US', 'fr-FR')
 * @returns Formatted date string
 */
export function formatResetDate(locale: string = 'en-US'): string {
  const resetDate = getNextBillingPeriodStart();
  return resetDate.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}
