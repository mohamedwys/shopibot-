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
import { checkBillingStatus, requireBilling } from "../lib/billing.server";
import { AnalyticsService } from "../services/analytics.service";
import { prisma as db } from "../db.server";
import { useTranslation } from "react-i18next";
import { getLocaleFromRequest, i18nServer } from "../i18n/i18next.server";
import { logger } from "../lib/logger.server";

export const handle = {
  i18n: "common",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  // Require active billing subscription to access dashboard
  await requireBilling(billing);

  logger.debug({ shop: session.shop }, 'Session authenticated');
  const locale = await getLocaleFromRequest(request);
  const t = i18nServer.getFixedT(locale, "common");

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
        if (!intentCounts[msg.intent]) {
          intentCounts[msg.intent] = { count: 0, example: msg.content };
        }
        intentCounts[msg.intent]!.count++;
      }
    });

    const topQuestions = Object.entries(intentCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([, data]) => ({
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
  const { stats, billingStatus } = useLoaderData<typeof loader>();
  const { t } = useTranslation(); // ✅ Safe: runs only on client

  return (
    <Page title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
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
              <p>{t("dashboard.freeTierMessage")}</p>
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
                {billingStatus.appSubscriptions[0]?.test && <> {t("dashboard.testModeNote")}</>}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* Language Switcher */}
        {/* <Layout.Section>
          <LanguageSwitcher currentLocale={locale} />
        </Layout.Section> */}

        {/* Key Metrics Section */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              {t("dashboard.performanceOverview")}
            </Text>

            <InlineStack gap="400" wrap={false}>
              {[
                {
                  label: t("dashboard.totalConversations"),
                  value: stats.totalConversations.toLocaleString(),
                  badge: t("dashboard.allTime"),
                  note: t("dashboard.growthLastMonth"),
                },
                {
                  label: t("dashboard.activeToday"),
                  value: stats.activeToday,
                  badge: t("dashboard.live"),
                  note: t("dashboard.conversationsStarted"),
                },
                {
                  label: t("dashboard.responseTime"),
                  value: stats.avgResponseTime,
                  badge: t("dashboard.avg"),
                  note: t("dashboard.aiProcessingSpeed"),
                },
                {
                  label: t("dashboard.satisfactionScore"),
                  value: stats.customerSatisfaction,
                  badge: t("dashboard.excellent"),
                  note: t("dashboard.basedOnFeedback"),
                  suffix: t("dashboard.outOf5"),
                },
              ].map((metric, idx) => (
                <Box width="25%" key={idx}>
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {metric.label}
                        </Text>
                        <Badge tone="info">{metric.badge}</Badge>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="heading2xl" as="p" fontWeight="bold">
                          {metric.value}
                        </Text>
                        {metric.suffix && (
                          <Text variant="bodyMd" as="p" tone="subdued">
                            {metric.suffix}
                          </Text>
                        )}
                      </InlineStack>
                      <Box>
                        <Text variant="bodySm" as="p" tone="subdued">
                          {metric.note}
                        </Text>
                      </Box>
                    </BlockStack>
                  </Card>
                </Box>
              ))}
            </InlineStack>
          </BlockStack>
        </Layout.Section>

        {/* Main Content Grid */}
        <Layout.Section>
          <InlineStack gap="400" align="start">
            {/* System Status Card */}
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
                    {([
                      {
                        title: t("dashboard.aiAssistant"),
                        desc: t("dashboard.coreChatbot"),
                        badge: t("dashboard.active"),
                        tone: "success",
                      },
                      {
                        title: t("dashboard.themeIntegration"),
                        desc: t("dashboard.widgetEmbedded"),
                        badge: t("dashboard.enabled"),
                        tone: "success",
                      },
                      {
                        title: t("dashboard.n8nWebhook"),
                        desc: t("dashboard.advancedWorkflow"),
                        badge: t("dashboard.fallback"),
                        tone: "warning",
                      },
                      {
                        title: t("dashboard.analyticsTracking"),
                        desc: t("dashboard.dataCollection"),
                        badge: t("dashboard.running"),
                        tone: "success",
                      },
                    ] as const).map((item, i) => (
                      <Box key={i}>
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                              {item.title}
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              {item.desc}
                            </Text>
                          </BlockStack>
                          <Badge tone={item.tone} size="medium">
                            {item.badge}
                          </Badge>
                        </InlineStack>
                        {i < 3 && <Divider />}
                      </Box>
                    ))}
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

                  <BlockStack gap="300">
                    {stats.topQuestions.map((item, index) => {
                      const maxCount = Math.max(...stats.topQuestions.map((q) => q.count), 1);
                      const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                      return (
                        <Box key={index}>
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="bodyMd" as="p">
                                {index + 1}. {item.question}
                              </Text>
                              <Badge tone="info">
                                {item.count > 0
                                  ? `${item.count}${t("dashboard.timesAsked")}`
                                  : t("dashboard.new")}
                              </Badge>
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
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingLg" as="h3" fontWeight="bold">
                  {t("dashboard.setupProgress")}
                </Text>
                <Badge tone="success">{t("dashboard.stepsCompleted")}</Badge>
              </InlineStack>
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("dashboard.completeSteps")}
              </Text>

              <Box paddingBlock="200">
                <ProgressBar progress={75} size="medium" tone="success" />
              </Box>

              <BlockStack gap="400">
                {[
                  {
                    title: t("dashboard.step1Title"),
                    desc: t("dashboard.step1Desc"),
                    completed: true,
                  },
                  {
                    title: t("dashboard.step2Title"),
                    desc: t("dashboard.step2Desc"),
                    completed: true,
                  },
                  {
                    title: t("dashboard.step3Title"),
                    desc: t("dashboard.step3Desc"),
                    completed: true,
                  },
                  {
                    title: t("dashboard.step4Title"),
                    desc: t("dashboard.step4Desc"),
                    completed: false,
                    optional: true,
                  },
                ].map((step, i) => (
                  <Card key={i} background={step.completed ? "bg-surface-secondary" : undefined}>
                    <InlineStack gap="400" align="start" blockAlign="center">
                      <Box>
                        <Badge tone={step.completed ? "success" : "attention"} size="large">
                          {step.completed ? "✓" : "○"}
                        </Badge>
                      </Box>
                      <Box width="100%">
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="200">
                            <InlineStack gap="200" blockAlign="center">
                              <Text variant="bodyLg" as="p" fontWeight="semibold">
                                {step.title}
                              </Text>
                              {step.optional && (
                                <Badge tone="info">{t("dashboard.optional")}</Badge>
                              )}
                            </InlineStack>
                            <Text variant="bodyMd" as="p" tone="subdued">
                              {step.desc}
                            </Text>
                          </BlockStack>
                          {!step.completed && (
                            <Button url="/app/settings">{t("dashboard.connectNow")}</Button>
                          )}
                        </InlineStack>
                      </Box>
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>

              <Divider />

              <InlineStack gap="300">
                <Button variant="primary" url="/app/settings">
                  {t("dashboard.customizeWidget")}
                </Button>
                <Button url="/app/sales-assistant">{t("dashboard.testChat")}</Button>
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
              {[
                {
                  title: t("dashboard.viewAnalyticsTitle"),
                  desc: t("dashboard.viewAnalyticsDesc"),
                  url: "/app/sales-assistant",
                  label: t("dashboard.openAnalytics"),
                },
                {
                  title: t("dashboard.widgetSettingsTitle"),
                  desc: t("dashboard.widgetSettingsDesc"),
                  url: "/app/settings",
                  label: t("dashboard.configure"),
                },
                {
                  title: t("dashboard.upgradePlanTitle"),
                  desc: t("dashboard.upgradePlanDesc"),
                  url: "/app/billing",
                  label: t("dashboard.viewPlansAction"),
                  tone: "success" as const,
                },
              ].map((action, i) => (
                <Box width="33.33%" key={i}>
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingMd" as="h3" fontWeight="semibold">
                        {action.title}
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {action.desc}
                      </Text>
                      <Box paddingBlockStart="200">
                        <Button fullWidth tone={action.tone} url={action.url}>
                          {action.label}
                        </Button>
                      </Box>
                    </BlockStack>
                  </Card>
                </Box>
              ))}
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}