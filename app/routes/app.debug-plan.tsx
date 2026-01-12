/**
 * Debug Route - Plan & Conversation Usage Diagnostics
 *
 * This route helps diagnose plan and conversation usage issues.
 * Access: /app/debug-plan
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, BlockStack, Banner, List, Badge, Divider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { checkBillingStatus, getPlanLimits } from "../lib/billing.server";
import { prisma as db } from "../db.server";
import { getConversationUsage } from "../lib/conversation-usage.server";
import { normalizePlanCode, PlanCode, CODE_TO_BILLING_NAME } from "../lib/plans.config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ✅ SECURITY FIX: Block access to debug routes in production
  if (process.env.NODE_ENV === 'production') {
    throw new Response("Not Found", { status: 404 });
  }

  const { billing, session } = await authenticate.admin(request);

  // Step 1: Get database settings
  const dbSettings = await db.widgetSettings.findUnique({
    where: { shop: session.shop },
    select: { id: true, shop: true, plan: true }
  });

  // Step 2: Get billing status from Shopify
  const billingStatus = await checkBillingStatus(billing);

  // Step 3: Normalize plan codes
  const dbPlanOriginal = dbSettings?.plan || 'BASIC';
  const dbPlanNormalized = normalizePlanCode(dbPlanOriginal);
  const billingPlanOriginal = billingStatus.activePlan;
  const billingPlanNormalized = billingPlanOriginal ? normalizePlanCode(billingPlanOriginal) : null;

  // Step 4: Get plan limits
  const limitsFromDb = getPlanLimits(dbPlanNormalized);
  const limitsFromBilling = billingPlanNormalized ? getPlanLimits(billingPlanNormalized) : null;

  // Step 5: Get conversation usage
  let conversationUsage = null;
  let usageError = null;
  try {
    conversationUsage = await getConversationUsage(session.shop, billing);
  } catch (error) {
    usageError = error instanceof Error ? error.message : String(error);
  }

  // Step 6: Count conversations directly
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const directCount = await db.conversation.count({
    where: {
      shop: session.shop,
      timestamp: { gte: startOfMonth }
    }
  });

  return json({
    shop: session.shop,
    database: {
      hasSettings: !!dbSettings,
      settingsId: dbSettings?.id,
      planOriginal: dbPlanOriginal,
      planNormalized: dbPlanNormalized,
      planExpected: CODE_TO_BILLING_NAME[dbPlanNormalized as keyof typeof CODE_TO_BILLING_NAME]
    },
    billing: {
      hasActivePayment: billingStatus.hasActivePayment,
      subscriptionCount: billingStatus.appSubscriptions.length,
      planOriginal: billingPlanOriginal,
      planNormalized: billingPlanNormalized,
      planExpected: billingPlanNormalized ? CODE_TO_BILLING_NAME[billingPlanNormalized as keyof typeof CODE_TO_BILLING_NAME] : null
    },
    limits: {
      fromDatabase: {
        maxConversations: limitsFromDb.maxConversations,
        isInfinity: limitsFromDb.maxConversations === Infinity,
        hasCustomWebhook: limitsFromDb.hasCustomWebhook,
        hasAdvancedAnalytics: limitsFromDb.hasAdvancedAnalytics
      },
      fromBilling: limitsFromBilling ? {
        maxConversations: limitsFromBilling.maxConversations,
        isInfinity: limitsFromBilling.maxConversations === Infinity,
        hasCustomWebhook: limitsFromBilling.hasCustomWebhook,
        hasAdvancedAnalytics: limitsFromBilling.hasAdvancedAnalytics
      } : null
    },
    usage: conversationUsage ? {
      used: conversationUsage.used,
      limit: conversationUsage.limit,
      percentUsed: conversationUsage.percentUsed,
      isUnlimited: conversationUsage.isUnlimited,
      currentPlan: conversationUsage.currentPlan,
      resetDate: conversationUsage.resetDate,
      periodStart: conversationUsage.periodStart
    } : null,
    usageError,
    directCount,
    planCodes: {
      BYOK: PlanCode.BYOK,
      STARTER: PlanCode.STARTER,
      PROFESSIONAL: PlanCode.PROFESSIONAL
    }
  });
};

export default function DebugPlanPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page
      title="Plan & Usage Diagnostics"
      backAction={{ content: "Settings", url: "/app/settings" }}
    >
      <Layout>
        {/* Shop Info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Shop Information</Text>
              <Text variant="bodyMd" as="p">
                <strong>Shop:</strong> {data.shop}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Database Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Database Settings</Text>

              {data.database.hasSettings ? (
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>Settings Record:</strong> <Badge tone="success">Found</Badge>
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Settings ID:</strong> {data.database.settingsId}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Plan (Raw from DB):</strong> <Badge tone="info">{data.database.planOriginal}</Badge>
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Plan (Normalized):</strong> <Badge tone="success">{data.database.planNormalized}</Badge>
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Expected Billing Name:</strong> {data.database.planExpected}
                  </Text>
                </BlockStack>
              ) : (
                <Banner tone="warning">
                  <Text variant="bodyMd" as="p">
                    No settings found in database!
                  </Text>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Shopify Billing */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Shopify Billing Status</Text>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  <strong>Active Payment:</strong> {' '}
                  <Badge tone={data.billing.hasActivePayment ? "success" : "critical"}>
                    {data.billing.hasActivePayment ? "Yes" : "No"}
                  </Badge>
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>Subscription Count:</strong> {data.billing.subscriptionCount}
                </Text>
                {data.billing.planOriginal ? (
                  <>
                    <Text variant="bodyMd" as="p">
                      <strong>Plan (From Shopify):</strong> <Badge tone="info">{data.billing.planOriginal}</Badge>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Plan (Normalized):</strong> <Badge tone="success">{data.billing.planNormalized}</Badge>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Expected Billing Name:</strong> {data.billing.planExpected}
                    </Text>
                  </>
                ) : (
                  <Banner tone="warning">
                    <Text variant="bodyMd" as="p">
                      No active plan found in Shopify billing
                    </Text>
                  </Banner>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Plan Limits */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Plan Limits</Text>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">From Database Plan</Text>
                <List type="bullet">
                  <List.Item>
                    <strong>Max Conversations:</strong>{' '}
                    <Badge tone={data.limits.fromDatabase.isInfinity ? "success" : "info"}>
                      {data.limits.fromDatabase.isInfinity ? "Infinity (Unlimited)" : data.limits.fromDatabase.maxConversations}
                    </Badge>
                  </List.Item>
                  <List.Item>
                    <strong>Custom Webhook:</strong>{' '}
                    <Badge tone={data.limits.fromDatabase.hasCustomWebhook ? "success" : "attention"}>
                      {data.limits.fromDatabase.hasCustomWebhook ? "Yes" : "No"}
                    </Badge>
                  </List.Item>
                  <List.Item>
                    <strong>Advanced Analytics:</strong>{' '}
                    <Badge tone={data.limits.fromDatabase.hasAdvancedAnalytics ? "success" : "attention"}>
                      {data.limits.fromDatabase.hasAdvancedAnalytics ? "Yes" : "No"}
                    </Badge>
                  </List.Item>
                </List>
              </BlockStack>

              {data.limits.fromBilling && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">From Billing Plan</Text>
                    <List type="bullet">
                      <List.Item>
                        <strong>Max Conversations:</strong>{' '}
                        <Badge tone={data.limits.fromBilling.isInfinity ? "success" : "info"}>
                          {data.limits.fromBilling.isInfinity ? "Infinity (Unlimited)" : data.limits.fromBilling.maxConversations}
                        </Badge>
                      </List.Item>
                      <List.Item>
                        <strong>Custom Webhook:</strong>{' '}
                        <Badge tone={data.limits.fromBilling.hasCustomWebhook ? "success" : "attention"}>
                          {data.limits.fromBilling.hasCustomWebhook ? "Yes" : "No"}
                        </Badge>
                      </List.Item>
                      <List.Item>
                        <strong>Advanced Analytics:</strong>{' '}
                        <Badge tone={data.limits.fromBilling.hasAdvancedAnalytics ? "success" : "attention"}>
                          {data.limits.fromBilling.hasAdvancedAnalytics ? "Yes" : "No"}
                        </Badge>
                      </List.Item>
                    </List>
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Conversation Usage */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Conversation Usage</Text>

              {data.usageError ? (
                <Banner tone="critical">
                  <Text variant="bodyMd" as="p">
                    <strong>Error:</strong> {data.usageError}
                  </Text>
                </Banner>
              ) : data.usage ? (
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>Used:</strong> {data.usage.used}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Limit:</strong>{' '}
                    <Badge tone={data.usage.isUnlimited ? "success" : "info"}>
                      {data.usage.isUnlimited ? "Infinity (Unlimited)" : data.usage.limit}
                    </Badge>
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Percent Used:</strong> {data.usage.percentUsed}%
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Is Unlimited:</strong>{' '}
                    <Badge tone={data.usage.isUnlimited ? "success" : "critical"}>
                      {data.usage.isUnlimited ? "TRUE ✓" : "FALSE ✗"}
                    </Badge>
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Current Plan:</strong> {data.usage.currentPlan}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Reset Date:</strong> {new Date(data.usage.resetDate).toLocaleDateString()}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Period Start:</strong> {new Date(data.usage.periodStart).toLocaleDateString()}
                  </Text>
                </BlockStack>
              ) : (
                <Banner tone="warning">
                  <Text variant="bodyMd" as="p">
                    No usage data available
                  </Text>
                </Banner>
              )}

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Direct Database Count</Text>
                <Text variant="bodyMd" as="p">
                  <strong>Conversations This Month:</strong> {data.directCount}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Plan Codes Reference */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Plan Code Reference</Text>
              <List type="bullet">
                <List.Item>BYOK: {data.planCodes.BYOK}</List.Item>
                <List.Item>STARTER: {data.planCodes.STARTER}</List.Item>
                <List.Item>PROFESSIONAL: {data.planCodes.PROFESSIONAL}</List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Diagnosis */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Diagnosis & Recommendations</Text>

              {data.database.planOriginal !== data.database.planNormalized && (
                <Banner tone="warning">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      ⚠️ Database has legacy plan code
                    </Text>
                    <Text variant="bodyMd" as="p">
                      Database has "{data.database.planOriginal}" but should be "{data.database.planNormalized}".
                      Visit /app/settings to trigger automatic migration.
                    </Text>
                  </BlockStack>
                </Banner>
              )}

              {data.usage && !data.usage.isUnlimited && (data.database.planNormalized === 'BYOK' || data.database.planNormalized === 'PROFESSIONAL') && (
                <Banner tone="critical">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      🔴 BUG DETECTED: Unlimited plan showing as limited!
                    </Text>
                    <Text variant="bodyMd" as="p">
                      Your plan is {data.database.planNormalized} which should be unlimited, but isUnlimited = {data.usage.isUnlimited ? 'true' : 'false'}.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      This suggests the conversation usage calculation is using the wrong plan data.
                    </Text>
                  </BlockStack>
                </Banner>
              )}

              {!data.billing.hasActivePayment && (
                <Banner tone="warning">
                  <Text variant="bodyMd" as="p">
                    No active Shopify billing subscription detected.
                  </Text>
                </Banner>
              )}

              {data.limits.fromDatabase.hasCustomWebhook && data.database.planNormalized === 'BYOK' && (
                <Banner tone="warning">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      ⚠️ Configuration Issue: BYOK plan has hasCustomWebhook=true
                    </Text>
                    <Text variant="bodyMd" as="p">
                      BYOK plan should not have custom webhook feature. This should only be available on Professional plan.
                    </Text>
                  </BlockStack>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
