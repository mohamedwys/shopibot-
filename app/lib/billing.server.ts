import { redirect } from "@remix-run/node";
import type { AdminContext } from "@shopify/shopify-app-remix/server";
import { getAllBillingNames, getPlanLimits as getConfigPlanLimits, type PlanLimits } from "./plans.config";

/**
 * Billing utility functions for Shopify App
 *
 * Provides helpers to check billing status and enforce subscriptions
 */

// Type for the billing property from authenticate.admin()
// Using 'any' for the config parameter to avoid strict plan name checking
type BillingAPI = AdminContext<any>['billing'];

export interface BillingCheckResult {
  hasActivePayment: boolean;
  appSubscriptions: any[];
  activePlan: string | null;
}

/**
 * Check if shop has an active billing subscription
 *
 * @param billing - Billing API from authenticate.admin
 * @returns Billing status information
 */
export async function checkBillingStatus(
  billing: BillingAPI
): Promise<BillingCheckResult> {
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: getAllBillingNames() as any,
    isTest: process.env.NODE_ENV !== "production",
  });

  const activePlan = hasActivePayment && appSubscriptions.length > 0
    ? appSubscriptions[0].name
    : null;

  return {
    hasActivePayment,
    appSubscriptions,
    activePlan,
  };
}

/**
 * Require billing subscription - redirect to billing page if no active subscription
 *
 * Use this in loaders to protect routes that require a subscription
 *
 * DEVELOPMENT: Set SKIP_BILLING_CHECK=true to bypass billing in development
 *
 * @param billing - Billing API from authenticate.admin
 * @throws Redirect to /app/billing if no active subscription
 */
export async function requireBilling(
  billing: BillingAPI
): Promise<void> {
  // Allow bypassing billing check in development
  if (process.env.SKIP_BILLING_CHECK === "true") {
    return;
  }

  const billingCheck = await billing.require({
    plans: getAllBillingNames() as any,
    isTest: process.env.NODE_ENV !== "production",
    onFailure: async () => {
      // No active subscription - redirect to onboarding page
      throw redirect("/app/onboarding");
    },
  });

  // If we get here, billing is active
}

/**
 * Check if shop has Professional Plan subscription
 *
 * @param billing - Billing API from authenticate.admin
 * @returns True if shop has Professional Plan
 */
export async function hasProfessionalPlan(
  billing: BillingAPI
): Promise<boolean> {
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: ["Professional Plan"] as any,
    isTest: process.env.NODE_ENV !== "production",
  });

  return hasActivePayment && appSubscriptions.length > 0;
}

/**
 * Check if shop has Starter Plan subscription
 *
 * @param billing - Billing API from authenticate.admin
 * @returns True if shop has Starter Plan
 */
export async function hasStarterPlan(
  billing: BillingAPI
): Promise<boolean> {
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: ["Starter Plan"] as any,
    isTest: process.env.NODE_ENV !== "production",
  });

  return hasActivePayment && appSubscriptions.length > 0;
}

/**
 * Get plan limits based on subscription
 *
 * This is a wrapper around the centralized getPlanLimits from plans.config
 * to maintain backward compatibility.
 *
 * @param activePlan - Name of active plan (can be billing name, plan code, or legacy code)
 * @returns Plan limits configuration
 */
export function getPlanLimits(activePlan: string | null): PlanLimits {
  return getConfigPlanLimits(activePlan);
}
