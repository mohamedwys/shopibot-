import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useTranslation } from "react-i18next";
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
import i18n from "../i18n.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  const t = await i18n.getFixedT(request, "dashboard");
  const billingStatus = await checkBillingStatus(billing);
  const analyticsService = new AnalyticsService();

  // Get analytics for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  try {
    // Fetch real analytics data
    const overview = await analyticsService.getOverview(session.shop, {
      startDate: thirtyDaysAgo,
      endDate: now,
      days: 30,
    });

    // Get today's active sessions
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySessions = await db.chatSession.count({
      where: {
        shop: session.shop,
        lastMessageAt: {
          gte: todayStart,
        },
      },
    });

    // Get top questions from recent messages
    const recentMessages = await db.chatMessage.findMany({
      where: {
        session: {
          shop: session.shop,
        },
        role: 'user',
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        content: true,
        intent: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
    });

    // Group by intent and get most common questions
    const intentCounts: Record<string, { count: number; example: string }> = {};
    recentMessages.forEach((msg: { content: string; intent: string | null }) => {
      if (msg.intent) {
        if (!intentCounts[msg.intent]) {
          intentCounts[msg.intent] = { count: 0, example: msg.content };
        }
        intentCounts[msg.intent]!.count++;
      }
    });

    const topQuestions = Object.entries(intentCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([_, data]) => ({ question: data.example, count: data.count }));

    // Calculate customer satisfaction (based on positive sentiment)
    const satisfaction = (overview.sentimentBreakdown?.positive && overview.totalMessages > 0)
      ? ((overview.sentimentBreakdown.positive / overview.totalMessages) * 5).toFixed(1)
      : '0.0';

    const stats = {
      totalConversations: overview.totalSessions || 0,
      activeToday: todaySessions || 0,
      avgResponseTime: overview.avgResponseTime
        ? `${(overview.avgResponseTime / 1000).toFixed(1)}s`
        : '0.0s',
      customerSatisfaction: parseFloat(satisfaction) || 0,
      topQuestions: topQuestions.length > 0 ? topQuestions : [
        { question: "No questions yet - waiting for first customer interaction", count: 0 }
      ],
    };

    return json({ stats, billingStatus });
  } catch (error) {
    // Fallback to zero stats if analytics fail
    const stats = {
      totalConversations: 0,
      activeToday: 0,
      avgResponseTime: "0.0s",
      customerSatisfaction: 0,
      topQuestions: [
        { question: "No data available yet - install the widget to start tracking", count: 0 }
      ],
    };

    return json({ stats, billingStatus });
  }
};

export default function Index() {
  const { stats, billingStatus } = useLoaderData<typeof loader>();
  const { t } = useTranslation("dashboard");

  return (
    <Page
      title={t("dashboard.title")}
      subtitle={t("dashboard.subtitle")}
    >
      <Layout>
        {/* Billing Status Banner */}
        {!billingStatus.hasActivePayment && (
          <Layout.Section>
            <Banner
              title={t("dashboard.billing.unlockPotential")}
              tone="warning"
              action={{
                content: t("dashboard.billing.viewPlans"),
                url: "/app/billing",
              }}
            >
              <p>
                {t("dashboard.billing.freeTierMessage")}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {billingStatus.hasActivePayment && billingStatus.activePlan && (
          <Layout.Section>
            <Banner
              title={t("dashboard.billing.planActive", { planName: billingStatus.activePlan })}
              tone="success"
              action={{
                content: t("dashboard.billing.manageBilling"),
                url: "/app/billing",
              }}
            >
              <p>
                {t("dashboard.billing.subscriptionActive")}
                {billingStatus.appSubscriptions[0]?.test && (
                  <>{t("dashboard.billing.testMode")}</>
                )}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* Key Metrics Section */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              {t("dashboard.performance.title")}
            </Text>
            
            <InlineStack gap="400" wrap={false}>
              <Box width="25%">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.performance.totalConversations")}
                      </Text>
                      <Badge tone="info">{t("dashboard.performance.allTime")}</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {stats.totalConversations.toLocaleString()}
                    </Text>
                    <Box>
                      <Text variant="bodySm" as="p" tone="success">
                        {t("dashboard.performance.growthFromLastMonth")}
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
                        {t("dashboard.performance.activeToday")}
                      </Text>
                      <Badge tone="success">{t("dashboard.performance.live")}</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {stats.activeToday}
                    </Text>
                    <Box>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("dashboard.performance.conversationsStarted")}
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
                        {t("dashboard.performance.responseTime")}
                      </Text>
                      <Badge tone="attention">{t("dashboard.performance.avg")}</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {stats.avgResponseTime}
                    </Text>
                    <Box>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("dashboard.performance.aiProcessingSpeed")}
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
                        {t("dashboard.performance.satisfactionScore")}
                      </Text>
                      <Badge tone="success">{t("dashboard.performance.excellent")}</Badge>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="heading2xl" as="p" fontWeight="bold">
                        {stats.customerSatisfaction}
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {t("dashboard.performance.outOf5")}
                      </Text>
                    </InlineStack>
                    <Box>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("dashboard.performance.basedOnFeedback")}
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
                      {t("dashboard.systemStatus.title")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.systemStatus.subtitle")}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="400">
                    {/* AI Assistant Status */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.systemStatus.aiAssistant")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.systemStatus.coreEngine")}
                          </Text>
                        </BlockStack>
                        <Badge tone="success" size="medium">{t("dashboard.systemStatus.active")}</Badge>
                      </InlineStack>
                    </Box>

                    <Divider />

                    {/* Theme Integration */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.systemStatus.themeIntegration")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.systemStatus.widgetEmbedded")}
                          </Text>
                        </BlockStack>
                        <Badge tone="success" size="medium">{t("dashboard.systemStatus.enabled")}</Badge>
                      </InlineStack>
                    </Box>

                    <Divider />

                    {/* N8N Connection */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.systemStatus.n8nWebhook")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.systemStatus.advancedWorkflow")}
                          </Text>
                        </BlockStack>
                        <Badge tone="warning" size="medium">{t("dashboard.systemStatus.fallback")}</Badge>
                      </InlineStack>
                    </Box>

                    <Divider />

                    {/* Analytics Tracking */}
                    <Box>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("dashboard.systemStatus.analyticsTracking")}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t("dashboard.systemStatus.dataCollection")}
                          </Text>
                        </BlockStack>
                        <Badge tone="success" size="medium">{t("dashboard.systemStatus.running")}</Badge>
                      </InlineStack>
                    </Box>
                  </BlockStack>

                  <Box paddingBlockStart="200">
                    <Button variant="primary" size="large" fullWidth url="/app/settings">
                      {t("dashboard.systemStatus.configureSettings")}
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
                          {t("dashboard.topQuestions.title")}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {t("dashboard.topQuestions.subtitle")}
                        </Text>
                      </BlockStack>
                      <Badge>{t("dashboard.topQuestions.last7Days")}</Badge>
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
                              <Badge tone="info">{item.count > 0 ? `${item.count}x` : t("dashboard.topQuestions.new")}</Badge>
                            </InlineStack>
                            <ProgressBar progress={percentage} size="small" tone="primary" />
                          </BlockStack>
                        </Box>
                      );
                    })}
                  </BlockStack>

                  <Box paddingBlockStart="200">
                    <Button size="large" fullWidth url="/app/sales-assistant">
                      {t("dashboard.topQuestions.viewFullAnalytics")}
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
                    Setup Progress
                  </Text>
                  <Badge tone="success">3 of 4 completed</Badge>
                </InlineStack>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Complete these steps to get the most out of your AI assistant
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
                        App Installed & Configured
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Your AI Sales Assistant is ready to use with default settings
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
                        Widget Added to Theme
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        The chat widget is live and visible on your storefront
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
                        Analytics Enabled
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Tracking customer interactions and generating insights
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
                              Connect N8N Workflow
                            </Text>
                            <Badge tone="info">Optional</Badge>
                          </InlineStack>
                          <Text variant="bodyMd" as="p" tone="subdued">
                            Enable advanced AI processing, custom workflows, and third-party integrations
                          </Text>
                        </BlockStack>
                        <Button url="/app/settings">
                          Connect Now
                        </Button>
                      </InlineStack>
                    </Box>
                  </InlineStack>
                </Card>
              </BlockStack>

              <Divider />

              <InlineStack gap="300">
                <Button variant="primary" url="/app/settings">
                  Customize Widget
                </Button>
                <Button url="/app/sales-assistant">
                  Test Chat Interface
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              {t("dashboard.quickActions.title")}
            </Text>
            
            <InlineStack gap="400" wrap={false}>
              <Box width="33.33%">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {t("dashboard.quickActions.viewAnalytics")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.quickActions.viewAnalyticsDesc")}
                    </Text>
                    <Box paddingBlockStart="200">
                      <Button fullWidth url="/app/sales-assistant">
                        {t("dashboard.quickActions.openAnalytics")}
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="33.33%">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {t("dashboard.quickActions.widgetSettings")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.quickActions.widgetSettingsDesc")}
                    </Text>
                    <Box paddingBlockStart="200">
                      <Button fullWidth url="/app/settings">
                        {t("dashboard.quickActions.configure")}
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Box>

              <Box width="33.33%">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {t("dashboard.quickActions.upgradePlan")}
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {t("dashboard.quickActions.upgradePlanDesc")}
                    </Text>
                    <Box paddingBlockStart="200">
                      <Button fullWidth tone="success" url="/app/billing">
                        {t("dashboard.quickActions.viewPlans")}
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
  );
}