import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  // Check if shop has an active subscription
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: ["Starter Plan", "Professional Plan"],
    isTest: process.env.NODE_ENV !== "production", // Test mode in development
  });

  return json({
    hasActivePayment,
    appSubscriptions,
    shop: session.shop,
    isTestMode: process.env.NODE_ENV !== "production",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  if (!plan || !["Starter Plan", "Professional Plan"].includes(plan)) {
    return json({ error: "Invalid plan selected" }, { status: 400 });
  }

  // Request billing with the selected plan
  const billingCheck = await billing.require({
    plans: [plan],
    isTest: process.env.NODE_ENV !== "production",
    onFailure: async () => {
      // Billing check failed - redirect to billing page
      return redirect("/app/billing");
    },
  });

  // If we get here, billing was confirmed or subscription was created
  // Redirect to dashboard
  return redirect("/app");
};

export default function BillingPage() {
  const { hasActivePayment, appSubscriptions, shop, isTestMode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const activePlan = appSubscriptions?.[0];

  const handleSubscribe = (plan: string) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Choose Your Plan"
      subtitle={`Select the perfect plan for ${shop}`}
    >
      <Layout>
        {isTestMode && (
          <Layout.Section>
            <Banner tone="info">
              <p>
                <strong>Test Mode Active:</strong> You won't be charged during development.
                Billing will be activated in production.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {hasActivePayment && activePlan && (
          <Layout.Section>
            <Banner tone="success">
              <p>
                You're currently subscribed to <strong>{activePlan.name}</strong>.
                {activePlan.trialDays && activePlan.trialDays > 0 && (
                  <> You have {activePlan.trialDays} days remaining in your trial.</>
                )}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="400" align="center">
            {/* Starter Plan Card */}
            <Box width="50%">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingLg">
                      Starter Plan
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Perfect for small stores getting started
                    </Text>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="heading2xl">
                        $25
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        / month
                      </Text>
                    </InlineStack>
                    <Badge tone="info">7-day free trial</Badge>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="300">
                    <Text as="p" variant="headingSm">
                      What's included:
                    </Text>
                    <List type="bullet">
                      <List.Item>Up to 1,000 conversations/month</List.Item>
                      <List.Item>AI-powered product recommendations</List.Item>
                      <List.Item>Basic analytics dashboard</List.Item>
                      <List.Item>Email support</List.Item>
                      <List.Item>Widget customization</List.Item>
                    </List>
                  </BlockStack>

                  <Button
                    variant="primary"
                    onClick={() => handleSubscribe("Starter Plan")}
                    disabled={hasActivePayment && activePlan?.name === "Starter Plan"}
                  >
                    {hasActivePayment && activePlan?.name === "Starter Plan"
                      ? "Current Plan"
                      : "Subscribe to Starter"}
                  </Button>
                </BlockStack>
              </Card>
            </Box>

            {/* Professional Plan Card */}
            <Box width="50%">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <InlineStack gap="200" align="space-between">
                      <Text as="h2" variant="headingLg">
                        Professional Plan
                      </Text>
                      <Badge tone="success">Popular</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      For growing businesses that need more
                    </Text>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="heading2xl">
                        $79
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        / month
                      </Text>
                    </InlineStack>
                    <Badge tone="info">7-day free trial</Badge>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="300">
                    <Text as="p" variant="headingSm">
                      Everything in Starter, plus:
                    </Text>
                    <List type="bullet">
                      <List.Item><strong>Unlimited conversations</strong></List.Item>
                      <List.Item>Advanced analytics & insights</List.Item>
                      <List.Item>Custom N8N webhook integration</List.Item>
                      <List.Item>Priority support (24/7)</List.Item>
                      <List.Item>Sentiment analysis & intent tracking</List.Item>
                      <List.Item>User profiling & personalization</List.Item>
                      <List.Item>Product click tracking</List.Item>
                    </List>
                  </BlockStack>

                  <Button
                    variant="primary"
                    tone="success"
                    onClick={() => handleSubscribe("Professional Plan")}
                    disabled={hasActivePayment && activePlan?.name === "Professional Plan"}
                  >
                    {hasActivePayment && activePlan?.name === "Professional Plan"
                      ? "Current Plan"
                      : "Subscribe to Professional"}
                  </Button>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Frequently Asked Questions
              </Text>

              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Can I change plans later?
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    What happens after the 7-day trial?
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    After your trial ends, you'll be charged monthly. You can cancel anytime during or after the trial period.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Do you offer refunds?
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Yes, we offer a 30-day money-back guarantee. If you're not satisfied, contact support for a full refund.
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
