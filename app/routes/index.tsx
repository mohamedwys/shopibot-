import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Badge,
  ProgressBar,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { checkBillingStatus } from "../lib/billing.server";
import { AnalyticsService } from "../services/analytics.service";
import db from "../db.server";
import { useTranslation, I18nextProvider } from "react-i18next";
import { getLocaleFromRequest } from "../i18n/i18next.server";
import i18nClient from "../i18n/i18next.client"; // client-side i18next for React
import { LanguageSwitcher } from "../components/LanguageSwitcher";


export const handle = {
  i18n: "common",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  // Get locale from request (cookie or query param)
  const locale = await getLocaleFromRequest(request);

  // Load translation function for "common" namespace
  const t = i18nClient.getFixedT(locale, "common");

  const billingStatus = await checkBillingStatus(billing);
  const analyticsService = new AnalyticsService();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  try {
    const overview = await analyticsService.getOverview(session.shop, {
      startDate: thirtyDaysAgo,
      endDate: now,
      days: 30,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySessions = await db.chatSession.count({
      where: {
        shop: session.shop,
        lastMessageAt: { gte: todayStart },
      },
    });

    type RecentMessage = {
      content: string | null;
      intent: string | null;
    };

    const recentMessages: RecentMessage[] = await db.chatMessage.findMany({
      where: {
        session: { shop: session.shop },
        role: "user",
        timestamp: { gte: thirtyDaysAgo },
      },
      select: { content: true, intent: true },
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    const intentCounts: Record<string, { count: number; example: string }> = {};

    recentMessages.forEach((msg) => {
      if (msg.intent && msg.content) {
        // Initialize if missing
        if (!intentCounts[msg.intent]) {
          intentCounts[msg.intent] = { count: 0, example: msg.content };
        }

        // Use non-null assertion because we just initialized it
        intentCounts[msg.intent]!.count++;
      }
    });

    const topQuestions = Object.entries(intentCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([_, data]) => ({
        question: data.example,
        count: data.count,
      }));

    const satisfaction =
      overview.sentimentBreakdown?.positive && overview.totalMessages > 0
        ? ((overview.sentimentBreakdown.positive / overview.totalMessages) * 5).toFixed(1)
        : "0.0";

    const stats = {
      totalConversations: overview.totalSessions || 0,
      activeToday: todaySessions || 0,
      avgResponseTime: overview.avgResponseTime
        ? `${(overview.avgResponseTime / 1000).toFixed(1)}s`
        : "0.0s",
      customerSatisfaction: parseFloat(satisfaction) || 0,
      topQuestions:
        topQuestions.length > 0
          ? topQuestions
          : [{ question: t("dashboard.noQuestionsYet"), count: 0 }],
    };

    return json({ stats, billingStatus, locale });
  } catch (error) {
    return json({
      stats: {
        totalConversations: 0,
        activeToday: 0,
        avgResponseTime: "0.0s",
        customerSatisfaction: 0,
        topQuestions: [{ question: t("dashboard.noDataAvailable"), count: 0 }],
      },
      billingStatus,
      locale,
    });
  }
};


export default function Index() {
  const { stats, billingStatus, locale } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
  <I18nextProvider i18n={i18nClient}>
    <Page
      title={t("dashboard.title")}
      subtitle={t("dashboard.subtitle")}
    >
      <Layout>
        {/* Billing Status Banner */}
        {!billingStatus.hasActivePayment && (
          <Layout.Section>
            <Banner
              title={t("dashboard.unlockPotential")}
              tone="warning"
              action={{
                content: t("dashboard.viewPlans"),
                url: "/app/billing",
              }}
            >
              <p>
                {t("dashboard.freeTierMessage")}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {billingStatus.hasActivePayment && billingStatus.activePlan && (
          <Layout.Section>
            <Banner
              title={`✓ ${billingStatus.activePlan} ${t("dashboard.planActive")}`}
              tone="success"
              action={{
                content: t("dashboard.manageBilling"),
                url: "/app/billing",
              }}
            >
              <p>
                {t("dashboard.subscriptionActive")}
                {billingStatus.appSubscriptions[0]?.test && (
                  <> {t("dashboard.testModeNote")}</>
                )}
              </p>
            </Banner>
          </Layout.Section>
        )}
        
        <LanguageSwitcher currentLocale={locale} />


        {/* Key Metrics Section */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              {t("dashboard.performanceOverview")}
            </Text>

            <InlineStack gap="400" wrap={false}>
              <Box width="25%">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.totalConversations")}
                      </Text>
                      <Badge tone="info">{t("dashboard.allTime")}</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {stats.totalConversations.toLocaleString()}
                    </Text>
                    <Box>
                      <Text variant="bodySm" as="p" tone="success">
                        {t("dashboard.growthLastMonth")}
                      </Text>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="25%">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.activeToday")}
                      </Text>
                      <Badge tone="success">{t("dashboard.live")}</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {stats.activeToday}
                    </Text>
                    <Box>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("dashboard.conversationsStarted")}
                      </Text>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="25%">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.responseTime")}
                      </Text>
                      <Badge tone="attention">{t("dashboard.avg")}</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {stats.avgResponseTime}
                    </Text>
                    <Box>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("dashboard.aiProcessingSpeed")}
                      </Text>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="25%">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.satisfactionScore")}
                      </Text>
                      <Badge tone="success">{t("dashboard.excellent")}</Badge>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="heading2xl" as="p" fontWeight="bold">
                        {stats.customerSatisfaction}
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.outOf5")}
                      </Text>
                    </InlineStack>
                    <Box>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("dashboard.basedOnFeedback")}
                      </Text>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>
            </InlineStack>
          </BlockStack>
        </Layout.Section>

        {/* Main Content Grid */}
        <Layout.Section>
          <InlineStack gap="400" align="start">
            {/* Widget Status Card */}
            <Box width="50%">
              <Card>
                <BlockStack gap="500">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h3" fontWeight="bold">
                      {t("dashboard.systemStatus")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.monitorComponents")}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="400">
                    {/* AI Assistant Status */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.aiAssistant")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.coreChatbot")}
                          </Text>
                        </BlockStack>
                        <Badge tone="success" size="medium">{t("dashboard.active")}</Badge>
                      </InlineStack>
                    </Box>

                    <Divider />

                    {/* Theme Integration */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.themeIntegration")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.widgetEmbedded")}
                          </Text>
                        </BlockStack>
                        <Badge tone="success" size="medium">{t("dashboard.enabled")}</Badge>
                      </InlineStack>
                    </Box>

                    <Divider />

                    {/* N8N Connection */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.n8nWebhook")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.advancedWorkflow")}
                          </Text>
                        </BlockStack>
                        <Badge tone="warning" size="medium">{t("dashboard.fallback")}</Badge>
                      </InlineStack>
                    </Box>

                    <Divider />

                    {/* Analytics Tracking */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.analyticsTracking")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.dataCollection")}
                          </Text>
                        </BlockStack>
                        <Badge tone="success" size="medium">{t("dashboard.running")}</Badge>
                      </InlineStack>
                    </Box>
                  </BlockStack>

                  <Box paddingBlockStart="200">
                    <Button variant="primary" size="large" fullWidth url="/app/settings">
                      {t("dashboard.configureSettings")}
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            </Box>

            {/* Top Questions Card */}
            <Box width="50%">
              <Card>
                <BlockStack gap="500">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h3" fontWeight="bold">
                          {t("dashboard.topQuestions")}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {t("dashboard.mostAsked")}
                        </Text>
                      </BlockStack>
                      <Badge>{t("dashboard.last7Days")}</Badge>
                    </InlineStack>
                  </BlockStack>

                  <BlockStack gap="300">
                    {stats.topQuestions.map((item, index) => {
                      // Calculate percentage based on the highest count in the list
                      const maxCount = Math.max(...stats.topQuestions.map(q => q.count), 1);
                      const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                      return (
                        <Box key={index}>
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="bodyMd" as="p">
                                {index + 1}. {item.question}
                              </Text>
                              <Badge tone="info">{item.count > 0 ? `${item.count}${t("dashboard.timesAsked")}` : t("dashboard.new")}</Badge>
                            </InlineStack>
                            <ProgressBar progress={percentage} size="small" tone="primary" />
                          </BlockStack>
                        </Box>
                      );
                    })}
                  </BlockStack>

                  <Box paddingBlockStart="200">
                    <Button size="large" fullWidth url="/app/sales-assistant">
                      {t("dashboard.viewFullAnalytics")}
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Setup Progress Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingLg" as="h3" fontWeight="bold">
                    {t("dashboard.setupProgress")}
                  </Text>
                  <Badge tone="success">{t("dashboard.stepsCompleted")}</Badge>
                </InlineStack>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("dashboard.completeSteps")}
                </Text>
              </BlockStack>

              <Box paddingBlockStart="200" paddingBlockEnd="200">
                <ProgressBar progress={75} size="medium" tone="success" />
              </Box>

              <BlockStack gap="400">
                {/* Step 1 - Completed */}
                <Card background="bg-surface-secondary">
                  <InlineStack gap="400" align="start" blockAlign="center">
                    <Box>
                      <Badge tone="success" size="large">✓</Badge>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="bodyLg" as="p" fontWeight="semibold">
                        {t("dashboard.step1Title")}
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.step1Desc")}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>

                {/* Step 2 - Completed */}
                <Card background="bg-surface-secondary">
                  <InlineStack gap="400" align="start" blockAlign="center">
                    <Box>
                      <Badge tone="success" size="large">✓</Badge>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="bodyLg" as="p" fontWeight="semibold">
                        {t("dashboard.step2Title")}
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.step2Desc")}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>

                {/* Step 3 - Completed */}
                <Card background="bg-surface-secondary">
                  <InlineStack gap="400" align="start" blockAlign="center">
                    <Box>
                      <Badge tone="success" size="large">✓</Badge>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="bodyLg" as="p" fontWeight="semibold">
                        {t("dashboard.step3Title")}
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.step3Desc")}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>

                {/* Step 4 - Optional */}
                <Card>
                  <InlineStack gap="400" align="start" blockAlign="center">
                    <Box>
                      <Badge tone="attention" size="large">○</Badge>
                    </Box>
                    <Box width="100%">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            <Text variant="bodyLg" as="p" fontWeight="semibold">
                              {t("dashboard.step4Title")}
                            </Text>
                            <Badge tone="info">{t("dashboard.optional")}</Badge>
                          </InlineStack>
                          <Text variant="bodyMd" as="p" tone="subdued">
                            {t("dashboard.step4Desc")}
                          </Text>
                        </BlockStack>
                        <Button url="/app/settings">
                          {t("dashboard.connectNow")}
                        </Button>
                      </InlineStack>
                    </Box>
                  </InlineStack>
                </Card>
              </BlockStack>

              <Divider />

              <InlineStack gap="300">
                <Button variant="primary" url="/app/settings">
                  {t("dashboard.customizeWidget")}
                </Button>
                <Button url="/app/sales-assistant">
                  {t("dashboard.testChat")}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              {t("dashboard.quickActions")}
            </Text>

            <InlineStack gap="400" wrap={false}>
              <Box width="33.33%">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {t("dashboard.viewAnalyticsTitle")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.viewAnalyticsDesc")}
                    </Text>
                    <Box paddingBlockStart="200">
                      <Button fullWidth url="/app/sales-assistant">
                        {t("dashboard.openAnalytics")}
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="33.33%">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {t("dashboard.widgetSettingsTitle")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.widgetSettingsDesc")}
                    </Text>
                    <Box paddingBlockStart="200">
                      <Button fullWidth url="/app/settings">
                        {t("dashboard.configure")}
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="33.33%">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {t("dashboard.upgradePlanTitle")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.upgradePlanDesc")}
                    </Text>
                    <Box paddingBlockStart="200">
                      <Button fullWidth tone="success" url="/app/billing">
                        {t("dashboard.viewPlansAction")}
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
    </I18nextProvider>

  );
}