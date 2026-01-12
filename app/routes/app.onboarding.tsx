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
import { useTranslation } from "react-i18next";
import { logger } from "../lib/logger.server";
import { PLAN_NAMES, isValidPlanName } from "../config/billing";

export const handle = {
  i18n: "common",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  logger.debug({ shop: session.shop }, 'Loading onboarding page');

  // Check if user already has a subscription
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: PLAN_NAMES as any,
    isTest: process.env.NODE_ENV !== "production",
  });

  // If user already has a subscription, redirect to dashboard
  if (hasActivePayment) {
    logger.info({ shop: session.shop }, 'User already has subscription, redirecting to dashboard');
    return redirect("/app");
  }

  return json({
    shop: session.shop,
    isTestMode: process.env.NODE_ENV !== "production",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  logger.info({ shop: session.shop, plan }, 'Plan selected in onboarding');

  if (!plan || !isValidPlanName(plan)) {
    logger.warn({ shop: session.shop, plan }, 'Invalid plan selected');
    return json({ error: "Invalid plan selected" }, { status: 400 });
  }

  // Create billing request with 7-day free trial
  const { confirmationUrl } = await billing.request({
    plan: plan as any,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
  });

  logger.info({
    shop: session.shop,
    plan,
    isTestMode: process.env.NODE_ENV !== "production"
  }, 'Redirecting to Shopify billing confirmation (7-day trial)');

  // Redirect to Shopify's billing confirmation page
  return redirect(confirmationUrl);
};

export default function OnboardingPage() {
  const { shop, isTestMode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const { t } = useTranslation();

  const handleSubscribe = (plan: string) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  const plans = [
    {
      id: "BYOK Plan",
      name: "BYOK",
      price: 5,
      description: "Bring Your Own API Key",
      badge: "Budget Friendly",
      badgeTone: "info" as const,
      features: [
        "OpenAI integration needed by the user",
        "Advanced analytics and insights",
        "Custom N8N webhook integration",
        "Sentiment analysis and intent tracking",
        "User profiling and personalization",
        "Product click tracking",
      ],
    },
    {
      id: "Starter Plan",
      name: "Starter",
      price: 25,
      description: "Perfect for small stores",
      badge: "Most Popular",
      badgeTone: "attention" as const,
      features: [
        "1,000 conversations/month",
        "Advanced analytics and insights",
        "Custom N8N webhook integration",
        "Sentiment analysis and intent tracking",
        "User profiling and personalization",
        "Product click tracking",
      ],
    },
    {
      id: "Professional Plan",
      name: "Professional",
      price: 79,
      description: "For growing businesses",
      badge: "Best Value",
      badgeTone: "success" as const,
      features: [
        "Unlimited conversations",
        "Advanced analytics and insights",
        "Custom N8N webhook integration",
        "Sentiment analysis and intent tracking",
        "User profiling and personalization",
        "Product click tracking",
        "Priority support (24/7)",
      ],
    },
  ];

  return (
    <Page>
      <Layout>
        {/* Hero Section */}
        <Layout.Section>
          <Box paddingBlockEnd="600">
            <BlockStack gap="400" align="center">
              <Text as="h1" variant="heading2xl" alignment="center">
                Choose Your Plan
              </Text>
              <Text as="p" variant="bodyLg" alignment="center" tone="subdued">
                Start your 7-day free trial • No credit card required • Cancel anytime
              </Text>
              <Badge tone="success" size="large">
                💳 7-Day Free Trial Included
              </Badge>
            </BlockStack>
          </Box>
        </Layout.Section>

        {/* Test Mode Banner */}
        {isTestMode && (
          <Layout.Section>
            <Banner tone="info">
              <Text as="p" variant="bodyMd">
                <strong>Test Mode:</strong> You're in development mode. Billing charges will not be applied.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Error Banner */}
        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">{actionData.error}</Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Plan Cards */}
        <Layout.Section>
          <InlineStack gap="400" wrap={true} align="center">
            {plans.map((plan) => (
              <Box key={plan.id} minWidth="300px" maxWidth="400px">
                <Card>
                  <BlockStack gap="500">
                    {/* Header */}
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Text as="h2" variant="headingLg" fontWeight="bold">
                          {plan.name}
                        </Text>
                        <Badge tone={plan.badgeTone}>{plan.badge}</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {plan.description}
                      </Text>
                    </BlockStack>

                    {/* Pricing */}
                    <BlockStack gap="200">
                      <InlineStack gap="100" blockAlign="end">
                        <Text as="h3" variant="heading3xl" fontWeight="bold">
                          ${plan.price}
                        </Text>
                        <Text as="span" variant="bodyLg" tone="subdued">
                          /month
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        After 7-day free trial
                      </Text>
                    </BlockStack>

                    <Divider />

                    {/* Features */}
                    <BlockStack gap="300">
                      <Text as="p" variant="headingSm" fontWeight="semibold">
                        What's Included:
                      </Text>
                      <List type="bullet">
                        {plan.features.map((feature, idx) => (
                          <List.Item key={idx}>
                            <Text as="span" variant="bodyMd">
                              {feature}
                            </Text>
                          </List.Item>
                        ))}
                      </List>
                    </BlockStack>

                    {/* CTA Button */}
                    <Box paddingBlockStart="200">
                      <Button
                        variant="primary"
                        size="large"
                        fullWidth
                        tone={plan.id === "Professional Plan" ? "success" : undefined}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        Start 7-Day Free Trial
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>
            ))}
          </InlineStack>
        </Layout.Section>

        {/* Trust Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400" align="center">
              <Text as="h3" variant="headingMd" alignment="center">
                Why Choose Our Chatbot?
              </Text>
              <InlineStack gap="800" align="center" wrap={true}>
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    ✓
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    7-Day Free Trial
                  </Text>
                </BlockStack>
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    ✓
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Cancel Anytime
                  </Text>
                </BlockStack>
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    ✓
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No Setup Fees
                  </Text>
                </BlockStack>
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    ✓
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Instant Activation
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* FAQ */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd" alignment="center">
                Frequently Asked Questions
              </Text>

              <Divider />

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  How does the 7-day free trial work?
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Start using the full features of your selected plan immediately. You won't be charged for 7 days.
                  Cancel anytime during the trial period without any charges.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  Can I change my plan later?
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Yes! You can upgrade or downgrade your plan at any time from the billing page.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  What happens with the BYOK plan?
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  With Bring Your Own Key, you'll provide your own OpenAI API key and pay AI expenses directly to OpenAI.
                  You only pay us $5/month for the chatbot interface.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
