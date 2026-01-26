/**
 * Policy Cache Service
 *
 * Caches shop policies to avoid excessive Shopify API calls.
 * Policies don't change frequently, so we cache them with a reasonable TTL.
 *
 * ✅ Features:
 * - In-memory cache with TTL (default 1 hour)
 * - Automatic cache invalidation
 * - Graceful fallback on fetch errors
 * - Multi-tenant support (caches per shop)
 */

import { createLogger } from '../lib/logger.server';

const logger = createLogger({ service: 'PolicyCacheService' });

export interface CachedShopPolicies {
  shopName: string | null;
  returns: string | null;
  shipping: string | null;
  privacy: string | null;
  termsOfService: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  fetchedAt: number;
}

interface CacheEntry {
  policies: CachedShopPolicies;
  expiresAt: number;
}

// In-memory cache for shop policies
const policyCache = new Map<string, CacheEntry>();

// Default TTL: 1 hour (policies don't change often)
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

// Stale TTL: 24 hours (use stale data if fetch fails)
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Get cached policies for a shop
 * Returns null if not cached or expired
 */
export function getCachedPolicies(shopDomain: string): CachedShopPolicies | null {
  const entry = policyCache.get(shopDomain);

  if (!entry) {
    return null;
  }

  const now = Date.now();

  // Check if cache is still fresh
  if (now < entry.expiresAt) {
    logger.debug({ shop: shopDomain, age: now - entry.policies.fetchedAt }, 'Cache hit (fresh)');
    return entry.policies;
  }

  // Check if we can use stale data (within stale TTL)
  if (now < entry.policies.fetchedAt + STALE_CACHE_TTL_MS) {
    logger.debug({ shop: shopDomain }, 'Cache hit (stale but usable)');
    return entry.policies;
  }

  // Cache is too old, remove it
  policyCache.delete(shopDomain);
  return null;
}

/**
 * Store policies in cache
 */
export function setCachedPolicies(
  shopDomain: string,
  policies: Omit<CachedShopPolicies, 'fetchedAt'>,
  ttlMs: number = DEFAULT_CACHE_TTL_MS
): void {
  const now = Date.now();

  const entry: CacheEntry = {
    policies: {
      ...policies,
      fetchedAt: now,
    },
    expiresAt: now + ttlMs,
  };

  policyCache.set(shopDomain, entry);
  logger.debug({ shop: shopDomain, ttlMs }, 'Policies cached');
}

/**
 * Invalidate cache for a shop (call when policies are updated)
 */
export function invalidatePolicyCache(shopDomain: string): void {
  policyCache.delete(shopDomain);
  logger.debug({ shop: shopDomain }, 'Policy cache invalidated');
}

/**
 * Clear entire cache (for maintenance)
 */
export function clearPolicyCache(): void {
  policyCache.clear();
  logger.info('Policy cache cleared');
}

/**
 * Get cache statistics
 */
export function getPolicyCacheStats(): { size: number; shops: string[] } {
  return {
    size: policyCache.size,
    shops: Array.from(policyCache.keys()),
  };
}

/**
 * Fetch shop policies from Shopify REST Admin API
 * This function should be called from the route handler
 *
 * Note: Uses REST API /admin/api/2024-01/policies.json as GraphQL doesn't expose policies
 */
export async function fetchShopPolicies(
  shopDomain: string,
  adminRest: { get: (params: { path: string }) => Promise<any> },
  shopName?: string
): Promise<CachedShopPolicies | null> {
  // Check cache first
  const cached = getCachedPolicies(shopDomain);
  if (cached) {
    return cached;
  }

  try {
    logger.info({ shop: shopDomain }, 'Fetching shop policies from Shopify REST API');

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Policy fetch timeout')), 10000)
    );

    // Use REST API endpoint for policies
    const responsePromise = adminRest.get({
      path: 'policies',
    });

    const response = await Promise.race([
      responsePromise,
      timeoutPromise,
    ]) as any;

    const data = await response.json();

    // Check for errors
    if (data?.errors) {
      logger.error({
        shop: shopDomain,
        errors: data.errors,
      }, 'REST API errors when fetching shop policies');
      return null;
    }

    // Parse policies array
    // Each policy has: id, title, body, url, created_at, updated_at
    const policiesArray = data?.policies || [];

    // Map policy titles to our structure
    const policyMap: Record<string, string | null> = {};
    for (const policy of policiesArray) {
      if (policy?.title && policy?.body) {
        // Normalize title to match our keys
        const normalizedTitle = policy.title.toLowerCase();
        if (normalizedTitle.includes('refund') || normalizedTitle.includes('return')) {
          policyMap['returns'] = policy.body;
        } else if (normalizedTitle.includes('shipping') || normalizedTitle.includes('delivery')) {
          policyMap['shipping'] = policy.body;
        } else if (normalizedTitle.includes('privacy')) {
          policyMap['privacy'] = policy.body;
        } else if (normalizedTitle.includes('terms') || normalizedTitle.includes('service')) {
          policyMap['termsOfService'] = policy.body;
        }
      }
    }

    const policies: Omit<CachedShopPolicies, 'fetchedAt'> = {
      shopName: shopName || shopDomain,
      returns: policyMap['returns'] || null,
      shipping: policyMap['shipping'] || null,
      privacy: policyMap['privacy'] || null,
      termsOfService: policyMap['termsOfService'] || null,
      contactEmail: null, // Will be fetched separately if needed
      contactPhone: null,
    };

    // Cache the policies
    setCachedPolicies(shopDomain, policies);

    logger.info({
      shop: shopDomain,
      hasReturns: !!policies.returns,
      hasShipping: !!policies.shipping,
      hasPrivacy: !!policies.privacy,
      policiesFound: policiesArray.length,
    }, 'Shop policies fetched and cached');

    return {
      ...policies,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    logger.error({
      shop: shopDomain,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to fetch shop policies');

    // Try to return stale cached data if available
    const stale = getCachedPolicies(shopDomain);
    if (stale) {
      logger.info({ shop: shopDomain }, 'Using stale cached policies after fetch failure');
      return stale;
    }

    return null;
  }
}

/**
 * Convert CachedShopPolicies to ShopPolicies format for N8N service
 */
export function toShopPoliciesFormat(cached: CachedShopPolicies | null): {
  shopName?: string;
  returns?: string | null;
  shipping?: string | null;
  privacy?: string | null;
  termsOfService?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
} | undefined {
  if (!cached) {
    return undefined;
  }

  return {
    shopName: cached.shopName || undefined,
    returns: cached.returns,
    shipping: cached.shipping,
    privacy: cached.privacy,
    termsOfService: cached.termsOfService,
    contactEmail: cached.contactEmail,
    contactPhone: cached.contactPhone,
  };
}
