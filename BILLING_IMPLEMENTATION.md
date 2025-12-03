# Billing Implementation Guide

## Overview

This app uses Shopify's native billing API to charge merchants for app usage. Two pricing tiers are available with 7-day free trials.

## Pricing Plans

### Starter Plan
- **Price:** $25/month
- **Trial:** 7 days free
- **Features:**
  - Up to 1,000 conversations/month
  - AI-powered product recommendations
  - Basic analytics dashboard
  - Email support
  - Widget customization

### Professional Plan
- **Price:** $79/month
- **Trial:** 7 days free
- **Features:**
  - **Unlimited conversations**
  - Advanced analytics & insights
  - Custom N8N webhook integration
  - Priority support (24/7)
  - Sentiment analysis & intent tracking
  - User profiling & personalization
  - Product click tracking

---

## Implementation Details

### 1. Billing Configuration

**File:** `app/shopify.server.ts`

```typescript
billing: {
  "Starter Plan": {
    amount: 25.0,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 7,
  },
  "Professional Plan": {
    amount: 79.0,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 7,
  },
},
```

### 2. Billing Routes

#### Billing Page: `/app/billing`
**File:** `app/routes/app.billing.tsx`

- Displays both pricing plans with feature lists
- Shows current subscription status
- Handles plan selection and subscription
- Test mode banner for development

**Key Functions:**
- `loader()` - Checks billing status
- `action()` - Processes plan subscriptions

#### Protected Routes
Routes that require active subscription:
- `/app/analytics` - Advanced analytics (Professional only)
- `/app/settings` - Custom webhook configuration (Professional only)

### 3. Billing Utilities

**File:** `app/lib/billing.server.ts`

**Helper Functions:**

```typescript
// Check billing status
await checkBillingStatus(billing);

// Require billing (redirect if no subscription)
await requireBilling(billing);

// Check for specific plans
await hasProfessionalPlan(billing);
await hasStarterPlan(billing);

// Get plan limits
const limits = getPlanLimits(activePlan);
```

**Plan Limits:**

```typescript
// Starter Plan
{
  maxConversations: 1000,
  hasAdvancedAnalytics: false,
  hasCustomWebhook: false,
  hasPrioritySupport: false,
  hasSentimentAnalysis: false,
}

// Professional Plan
{
  maxConversations: Infinity,
  hasAdvancedAnalytics: true,
  hasCustomWebhook: true,
  hasPrioritySupport: true,
  hasSentimentAnalysis: true,
}
```

### 4. Dashboard Integration

**File:** `app/routes/app._index.tsx`

The dashboard displays:
- ✅ Active subscription banner with plan name
- ⚠️ Warning banner if no active subscription
- Link to billing page for upgrades/changes

---

## Testing Billing

### Development Mode (Test Mode)

In development (`NODE_ENV !== "production"`):
- Billing is in **test mode**
- No actual charges are made
- Subscriptions work normally but marked as "test"
- Banner displays: "Test mode - you won't be charged"

### Production Mode

In production:
- Real billing charges apply
- Merchants are charged via Shopify
- 7-day free trial applies
- Charges appear on merchant's Shopify bill

### Testing Workflow

1. **Navigate to `/app`** - Dashboard shows "no subscription" banner
2. **Click "View Plans"** - Go to billing page
3. **Select a plan** - Click "Subscribe to Starter" or "Subscribe to Professional"
4. **Shopify confirmation** - Shopify shows billing confirmation screen
5. **Approve** - Merchant approves the charge
6. **Redirect** - Return to dashboard with active subscription

---

## Usage in Code

### Protect a Route

```typescript
import { requireBilling } from "~/lib/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  // Require active subscription - redirects to /app/billing if none
  await requireBilling(billing);

  // Continue with route logic...
};
```

### Check Plan Level

```typescript
import { checkBillingStatus, getPlanLimits } from "~/lib/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const billingStatus = await checkBillingStatus(billing);
  const limits = getPlanLimits(billingStatus.activePlan);

  if (!limits.hasAdvancedAnalytics) {
    // Redirect to upgrade page or show upgrade banner
  }

  // ...
};
```

### Feature-Gating

```typescript
// In analytics route
const { billing } = await authenticate.admin(request);
const hasPro = await hasProfessionalPlan(billing);

return json({
  advancedFeatures: hasPro, // Only show advanced features to Pro users
  // ...
});
```

---

## Billing Webhooks

### app/uninstalled
When the app is uninstalled, the subscription is automatically cancelled by Shopify.

### Subscription Changes
Shopify handles subscription changes automatically:
- **Upgrade:** Prorated charge applied immediately
- **Downgrade:** Change applies at next billing cycle
- **Cancellation:** Subscription remains active until end of billing period

---

## Common Issues

### Issue: "Billing not required" in development

**Cause:** Test mode is active
**Solution:** This is expected behavior - billing works but doesn't charge

### Issue: Infinite redirect loop

**Cause:** Route protection checking billing on billing page itself
**Solution:** Never use `requireBilling()` on `/app/billing` route

### Issue: Plan limits not enforced

**Cause:** Not checking limits in route logic
**Solution:** Use `getPlanLimits()` and enforce in application code

---

## App Store Submission

Before submitting to Shopify App Store:

1. ✅ Test both plans in development
2. ✅ Test plan upgrades/downgrades
3. ✅ Test billing cancellation
4. ✅ Verify test mode banner only shows in development
5. ✅ Set correct pricing in Partner Dashboard
6. ✅ Document pricing clearly in App Store listing
7. ✅ Provide value justification for each tier

---

## Environment Variables

No additional environment variables needed. Billing uses:

- `NODE_ENV` - Determines test mode vs production
- `SHOPIFY_API_KEY` - From existing config
- `SHOPIFY_API_SECRET` - From existing config

---

## Future Enhancements

Potential improvements:

1. **Annual Billing** - Add annual plans with discount
2. **Usage-Based Pricing** - Charge per conversation above limits
3. **Free Tier** - Limited free plan (100 conversations/month)
4. **Enterprise Plan** - Custom pricing for large merchants
5. **Add-Ons** - Optional features (extra languages, custom branding)

---

## Support Resources

- [Shopify Billing API Docs](https://shopify.dev/docs/apps/build/billing)
- [Remix Billing Guide](https://shopify.dev/docs/api/app-bridge-library)
- [App Store Pricing Guidelines](https://shopify.dev/docs/apps/launch/app-store-review-guidelines#pricing)

---

**Last Updated:** December 2, 2025
**Status:** ✅ Implemented and Ready for Testing
