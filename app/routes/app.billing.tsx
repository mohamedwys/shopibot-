import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useTranslation } from "react-i18next";
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
import i18n from "../i18n.server";

// Specify which i18n namespaces this route needs
export const handle = {
  i18n: ["billing", "common"],
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const t = await i18n.getFixedT(request, "billing");

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: ["Starter Plan", "Professional Plan"] as any,
    isTest: process.env.NODE_ENV !== "production",
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

  const billingCheck = await billing.require({
    plans: [plan] as any,
    isTest: process.env.NODE_ENV !== "production",
    onFailure: async () => {
      return redirect("/app/billing");
    },
  });

  return redirect("/app");
};

export default function BillingPage() {
  const { hasActivePayment, appSubscriptions, shop, isTestMode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const { t } = useTranslation("billing");

  const activePlan = appSubscriptions?.[0];

  const handleSubscribe = (plan: string) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  return (
    <Page title={t("billing.title")}>
      <Layout>
        {/* Hero Section */}
        <Layout.Section>
          <Box paddingBlockEnd="600">
            <BlockStack gap="300" align="center">
              <Text as="h1" variant="heading2xl" alignment="center">
                {t("billing.hero.title")}
              </Text>
              <Text as="p" variant="bodyLg" alignment="center" tone="subdued">
                {t("billing.hero.subtitle")}
              </Text>
            </BlockStack>
          </Box>
        </Layout.Section>

        {/* Status Banners */}
        {isTestMode && (
          <Layout.Section>
            <Banner tone="info">
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {t("billing.status.testMode")}
                </Text>
                <Text as="p" variant="bodyMd">
                  {t("billing.status.testModeDesc")}
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {hasActivePayment && activePlan && (
          <Layout.Section>
            <Banner tone="success">
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd">
                  <strong>{t("billing.status.activeSubscription")}</strong> {activePlan.name}
                </Text>
                {activePlan.trialDays && activePlan.trialDays > 0 && (
                  <Text as="p" variant="bodyMd">
                    {t("billing.status.trialDays", { days: activePlan.trialDays })}
                  </Text>
                )}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">{actionData.error}</Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Pricing Cards */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            {/* Starter Plan */}
            <Box width="50%" minWidth="400px">
              <Card>
                <BlockStack gap="500">
                  {/* Header */}
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text as="h2" variant="headingLg" fontWeight="bold">
                        {t("billing.plans.starter.title")}
                      </Text>
                      <Badge tone="attention">{t("billing.plans.starter.badge")}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {t("billing.plans.starter.description")}
                    </Text>
                  </BlockStack>

                  {/* Pricing */}
                  <BlockStack gap="100">
                    <InlineStack gap="100" blockAlign="end">
                      <Text as="h3" variant="heading3xl" fontWeight="bold">
                        {t("billing.plans.starter.price")}
                      </Text>
                      <Text as="span" variant="bodyLg" tone="subdued">
                        {t("billing.plans.starter.period")}
                      </Text>
                    </InlineStack>
                    <Badge tone="info">{t("billing.plans.starter.trialBadge")}</Badge>
                  </BlockStack>

                  <Divider />

                  {/* Features */}
                  <BlockStack gap="400">
                    <Text as="p" variant="headingSm" fontWeight="semibold">
                      {t("billing.plans.starter.included")}
                    </Text>
                    <List type="bullet">
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.starter.features.conversations")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.starter.features.recommendations")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.starter.features.analytics")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.starter.features.support")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.starter.features.customization")}
                        </Text>
                      </List.Item>
                    </List>
                  </BlockStack>

                  {/* CTA Button */}
                  <Button
                    variant="primary"
                    size="large"
                    fullWidth
                    onClick={() => handleSubscribe("Starter Plan")}
                    disabled={hasActivePayment && activePlan?.name === "Starter Plan"}
                  >
                    {hasActivePayment && activePlan?.name === "Starter Plan"
                      ? t("billing.plans.starter.currentPlan")
                      : t("billing.plans.starter.startTrial")}
                  </Button>
                </BlockStack>
              </Card>
            </Box>

            {/* Professional Plan */}
            <Box width="50%" minWidth="400px">
              <Card background="bg-surface-selected">
                <BlockStack gap="500">
                  {/* Header */}
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text as="h2" variant="headingLg" fontWeight="bold">
                        {t("billing.plans.professional.title")}
                      </Text>
                      <Badge tone="success">{t("billing.plans.professional.badge")}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {t("billing.plans.professional.description")}
                    </Text>
                  </BlockStack>

                  {/* Pricing */}
                  <BlockStack gap="100">
                    <InlineStack gap="100" blockAlign="end">
                      <Text as="h3" variant="heading3xl" fontWeight="bold">
                        {t("billing.plans.professional.price")}
                      </Text>
                      <Text as="span" variant="bodyLg" tone="subdued">
                        {t("billing.plans.professional.period")}
                      </Text>
                    </InlineStack>
                    <Badge tone="info">{t("billing.plans.professional.trialBadge")}</Badge>
                  </BlockStack>

                  <Divider />

                  {/* Features */}
                  <BlockStack gap="400">
                    <Text as="p" variant="headingSm" fontWeight="semibold">
                      {t("billing.plans.professional.included")}
                    </Text>
                    <List type="bullet">
                      <List.Item>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {t("billing.plans.professional.features.unlimited")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.professional.features.advancedAnalytics")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.professional.features.n8nIntegration")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.professional.features.prioritySupport")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.professional.features.sentimentAnalysis")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.professional.features.userProfiling")}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          {t("billing.plans.professional.features.productTracking")}
                        </Text>
                      </List.Item>
                    </List>
                  </BlockStack>

                  {/* CTA Button */}
                  <Button
                    variant="primary"
                    tone="success"
                    size="large"
                    fullWidth
                    onClick={() => handleSubscribe("Professional Plan")}
                    disabled={hasActivePayment && activePlan?.name === "Professional Plan"}
                  >
                    {hasActivePayment && activePlan?.name === "Professional Plan"
                      ? t("billing.plans.professional.currentPlan")
                      : t("billing.plans.professional.startTrial")}
                  </Button>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Comparison Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingLg" alignment="center">
                {t("billing.comparison.title")}
              </Text>
              <Divider />
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.comparison.features.conversations")}
                  </Text>
                  <InlineStack gap="800">
                    <Text as="span" variant="bodyMd">{t("billing.comparison.features.conversationsStarter")}</Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{t("billing.comparison.features.conversationsPro")}</Text>
                  </InlineStack>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.comparison.features.recommendations")}
                  </Text>
                  <InlineStack gap="800">
                    <Text as="span" variant="bodyMd">✓</Text>
                    <Text as="span" variant="bodyMd">✓</Text>
                  </InlineStack>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.comparison.features.analytics")}
                  </Text>
                  <InlineStack gap="800">
                    <Text as="span" variant="bodyMd">{t("billing.comparison.features.analyticsStarter")}</Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{t("billing.comparison.features.analyticsPro")}</Text>
                  </InlineStack>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.comparison.features.n8n")}
                  </Text>
                  <InlineStack gap="800">
                    <Text as="span" variant="bodyMd">–</Text>
                    <Text as="span" variant="bodyMd">✓</Text>
                  </InlineStack>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.comparison.features.support")}
                  </Text>
                  <InlineStack gap="800">
                    <Text as="span" variant="bodyMd">{t("billing.comparison.features.supportStarter")}</Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{t("billing.comparison.features.supportPro")}</Text>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* FAQ Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text as="h3" variant="headingLg" alignment="center">
                {t("billing.faq.title")}
              </Text>

              <BlockStack gap="400">
                <BlockStack gap="400">
                  <Text as="p" variant="bodyLg" fontWeight="semibold">
                    {t("billing.faq.changePlans.question")}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.faq.changePlans.answer")}
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="400">
                  <Text as="p" variant="bodyLg" fontWeight="semibold">
                    {t("billing.faq.afterTrial.question")}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.faq.afterTrial.answer")}
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="400">
                  <Text as="p" variant="bodyLg" fontWeight="semibold">
                    {t("billing.faq.refunds.question")}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.faq.refunds.answer")}
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="400">
                  <Text as="p" variant="bodyLg" fontWeight="semibold">
                    {t("billing.faq.conversationDefinition.question")}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {t("billing.faq.conversationDefinition.answer")}
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Trust Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400" align="center">
              <Text as="p" variant="bodyLg" alignment="center" tone="subdued">
                {t("billing.trust.title")}
              </Text>
              <InlineStack gap="600" align="center">
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {t("billing.trust.satisfaction.value")}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("billing.trust.satisfaction.label")}
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {t("billing.trust.support.value")}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("billing.trust.support.label")}
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {t("billing.trust.guarantee.value")}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("billing.trust.guarantee.label")}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}