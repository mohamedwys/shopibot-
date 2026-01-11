import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Select,
  Badge,
  InlineStack,
  Box,
  Divider,
  ProgressBar,
  Icon,
} from "@shopify/polaris";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  ChartVerticalIcon,
  PersonIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { requireBilling } from "../lib/billing.server";
import { analyticsService, AnalyticsService } from "../services/analytics.service";
import { useTranslation } from "react-i18next";

export const handle = {
  i18n: "common",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  // Require active billing subscription to access analytics
  await requireBilling(billing);

  // Get period from query params or default to last 7 days
  const url = new URL(request.url);
  const periodPreset = url.searchParams.get("period") || "week";

  const period = AnalyticsService.getPeriodFromPreset(periodPreset);

  try {
    // Enhanced logging for debugging
    logger.info("Analytics loader started", "Loading analytics data", {
      shop: session.shop,
      periodPreset,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      days: period.days,
    });

    // Fetch all analytics data
    const [overview, intents, sentiments, workflowUsage, topProducts, trends, engagement, activeUsers] =
      await Promise.all([
        analyticsService.getOverview(session.shop, period),
        analyticsService.getIntentDistribution(session.shop, period),
        analyticsService.getSentimentBreakdown(session.shop, period),
        analyticsService.getWorkflowUsage(session.shop, period),
        analyticsService.getTopProducts(session.shop, period, 10),
        analyticsService.getDailyTrends(session.shop, period),
        analyticsService.getUserEngagement(session.shop, period),
        analyticsService.getActiveUsers(session.shop, period),
      ]);

    // Log the results for debugging
    logger.info("Analytics data fetched", {
      shop: session.shop,
      totalMessages: overview.totalMessages,
      totalSessions: overview.totalSessions,
      engagementSessions: engagement.totalSessions,
      engagementMessages: engagement.totalMessages,
      activeUsers,
      intentsCount: intents.length,
      sentimentsCount: sentiments.length,
      trendsCount: trends.length,
    });

    return json({
      overview,
      intents,
      sentiments,
      workflowUsage,
      topProducts,
      trends,
      engagement,
      activeUsers,
      periodPreset,
      period: {
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        days: period.days,
      },
    });
  } catch (error: any) {
    logger.error("Analytics loader error:", error);
    return json({
      overview: {
        totalSessions: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        avgConfidence: 0,
        sentimentBreakdown: {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
        periodComparison: { sessionsChange: 0, messagesChange: 0, confidenceChange: 0 },
      },
      intents: [],
      sentiments: [],
      workflowUsage: [],
      topProducts: [],
      trends: [],
      engagement: {
        totalSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        avgSessionDuration: 0,
      },
      activeUsers: 0,
      periodPreset: "week",
      period: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        days: 7,
      },
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  // Require active billing subscription for analytics actions
  await requireBilling(billing);

  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "export") {
    const periodPreset = formData.get("period") as string || "week";
    const period = AnalyticsService.getPeriodFromPreset(periodPreset);

    const csv = await analyticsService.exportToCSV(session.shop, period);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="shopibot-analytics-${periodPreset}.csv"`,
      },
    });
  }

  return json({ success: true });
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [selectedPeriod, setSelectedPeriod] = useState(data.periodPreset);

  const isLoading = navigation.state === "loading";

  const handlePeriodChange = useCallback(
    (value: string) => {
      setSelectedPeriod(value);
      submit({ period: value }, { method: "get" });
    },
    [submit]
  );

  const handleExport = useCallback(() => {
    submit({ action: "export", period: selectedPeriod }, { method: "post" });
  }, [submit, selectedPeriod]);

  const periodOptions = [
    { label: t("analytics.today"), value: "today" },
    { label: t("analytics.last7Days"), value: "week" },
    { label: t("analytics.last30Days"), value: "month" },
    { label: t("analytics.last90Days"), value: "quarter" },
  ];

  // Helper to format numbers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  // Helper to get change badge
  const getChangeBadge = (change: number | null | undefined) => {
  if (change === 0 || change === null || change === undefined) return null;

  const isPositive = change > 0;
  const tone = isPositive ? "success" : "critical";
  const icon = isPositive ? ArrowUpIcon : ArrowDownIcon;

  return (
    <Badge tone={tone} icon={icon}>
      {`${isPositive ? "+" : ""}${change.toFixed(1)}%`}
    </Badge>
  );
};

  // Calculate sentiment colors
  const getSentimentColor = (sentiment: string) => {
    const colors: Record<string, string> = {
      Positive: "#50B83C",
      Neutral: "#637381",
      Negative: "#ED6347",
    };
    return colors[sentiment] || "#637381";
  };

  return (
    <Page
      title={t("analytics.title")}
      subtitle={t("analytics.subtitle")}
      primaryAction={{
        content: t("analytics.exportCsv"),
        onAction: handleExport,
        icon: CalendarIcon,
      }}
    >
      <BlockStack gap="500">
        {/* Period Selector */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">
              {t("analytics.timePeriod")}
            </Text>
            <Box minWidth="200px">
              <Select
                label=""
                labelHidden
                options={periodOptions}
                value={selectedPeriod}
                onChange={handlePeriodChange}
                disabled={isLoading}
              />
            </Box>
          </InlineStack>
        </Card>

        {/* Overview Stats */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("analytics.totalMessages")}
                  </Text>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {formatNumber(data.overview.totalMessages)}
                </Text>
                {getChangeBadge(data.overview.periodComparison.messagesChange)}
                <Text variant="bodySm" as="p" tone="subdued">
                  {t("analytics.vsPrevious")}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("analytics.activeUsers")}
                  </Text>
                  <Icon source={PersonIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {formatNumber(data.activeUsers ?? 0)}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  {t("analytics.uniqueUsers")}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("analytics.aiConfidence")}
                  </Text>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {(data.overview?.avgConfidence ?? 0).toFixed(1)}%
                </Text>
                {getChangeBadge(data.overview.periodComparison.confidenceChange)}
                <Text variant="bodySm" as="p" tone="subdued">
                  {t("analytics.avgAccuracy")}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Engagement Metrics */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t("analytics.engagement")}
            </Text>

            <InlineGrid columns={4} gap="400">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("analytics.messagesPerSession")}
                </Text>
                <Text variant="headingLg" as="h3">
                  {(data.engagement?.avgMessagesPerSession ?? 0).toFixed(1)}
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("analytics.avgSessionDuration")}
                </Text>
                <Text variant="headingLg" as="h3">
                  {Math.round((data.engagement?.avgSessionDuration ?? 0) / 60)}m
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("analytics.avgResponseTime")}
                </Text>
                <Text variant="headingLg" as="h3">
                  {((data.overview?.avgResponseTime ?? 0) / 1000).toFixed(1)}s
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("analytics.totalSessions")}
                </Text>
                <Text variant="headingLg" as="h3">
                  {formatNumber(data.engagement?.totalSessions ?? 0)}
                </Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Intent Distribution */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t("analytics.intentDistribution")}
            </Text>

           {(data.intents && data.intents.length > 0) ? (
            <BlockStack gap="300">
              {data.intents.map((intent, index) => (
                <Box key={index}>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        {intent.intent?.replace(/_/g, " ") ?? "Unknown"}
                      </Text>
                      <InlineStack gap="200">
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {formatNumber(intent.count ?? 0)}
                        </Text>
                        <Text variant="bodyMd" as="p">
                          {(intent.percentage ?? 0).toFixed(1)}%
                        </Text>
                      </InlineStack>
                    </InlineStack>
                    <ProgressBar
                      progress={intent.percentage ?? 0}
                      size="small"
                      tone="primary"
                    />
                  </BlockStack>
                    {index < data.intents.length - 1 && (
                      <Box paddingBlockStart="300">
                        <Divider />
                      </Box>
                    )}
                  </Box>
                ))}
              </BlockStack>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("analytics.noIntentData")}
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Sentiment Analysis */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t("analytics.sentimentAnalysis")}
            </Text>

            {data.sentiments.length > 0 ? (
              <InlineGrid columns={3} gap="400">
                {data.sentiments.map((sentiment, index) => (
                  <Card key={index}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text variant="headingMd" as="h3">
                          {sentiment.sentiment}
                        </Text>
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: getSentimentColor(sentiment.sentiment),
                          }}
                        />
                      </InlineStack>
                      <Text variant="heading2xl" as="h4">
                        {sentiment.percentage}%
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {formatNumber(sentiment.count)} {t("analytics.messages")}
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("analytics.noSentimentData")}
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Workflow Usage */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Workflow Usage
            </Text>

            {data.workflowUsage && data.workflowUsage.length > 0 ? (
              <InlineGrid columns={2} gap="400">
                {data.workflowUsage.map((workflow: any, index: number) => (
                  <Card key={index}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text variant="headingMd" as="h3">
                          {workflow.workflow} Workflow
                        </Text>
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: workflow.workflow === 'Default' ? "#5C6AC4" : "#47C1BF",
                          }}
                        />
                      </InlineStack>
                      <Text variant="heading2xl" as="h4">
                        {workflow.percentage}%
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {formatNumber(workflow.count)} messages
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                No workflow data available for this period
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Top Products */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t("analytics.topProducts")}
            </Text>

            {data.topProducts.length > 0 ? (
              <BlockStack gap="300">
                {data.topProducts.map((product, index) => (
                  <Box key={index}>
                    <InlineStack align="space-between">
                      <InlineStack gap="200">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          #{index + 1}
                        </Text>
                        <Text variant="bodyMd" as="p">
                          {product.productId.split("/").pop()}
                        </Text>
                      </InlineStack>
                      <Badge tone="info">{`${formatNumber(product.clicks)} ${t("analytics.clicks")}`}</Badge>
                    </InlineStack>
                    {index < data.topProducts.length - 1 && (
                      <Box paddingBlockStart="300">
                        <Divider />
                      </Box>
                    )}
                  </Box>
                ))}
              </BlockStack>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("analytics.noProductData")}
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Daily Trends */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {t("analytics.dailyTrends")}
            </Text>

            {data.trends.length > 0 ? (
              <Box>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "8px",
                    height: "200px",
                    padding: "16px 0",
                  }}
                >
                  {data.trends.map((trend, index) => {
                    const maxMessages = Math.max(...data.trends.map((t) => t.messages));
                    const height = maxMessages > 0 ? (trend.messages / maxMessages) * 100 : 0;

                    return (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          height: `${height}%`,
                          backgroundColor: "#5C6AC4",
                          borderRadius: "4px 4px 0 0",
                          minHeight: trend.messages > 0 ? "4px" : "0",
                          position: "relative",
                          cursor: "pointer",
                        }}
                        title={`${new Date(trend.date).toLocaleDateString()}: ${trend.messages} ${t("analytics.messages")}`}
                      />
                    );
                  })}
                </div>

                <Box paddingBlockStart="400">
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="p" tone="subdued">
                      {new Date(data.trends[0]?.date || "").toLocaleDateString()}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {new Date(
                        data.trends[data.trends.length - 1]?.date || ""
                      ).toLocaleDateString()}
                    </Text>
                  </InlineStack>
                </Box>
              </Box>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("analytics.noTrendData")}
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Info Banner */}
        <Card>
          <BlockStack gap="200">
            <Text variant="headingMd" as="h2">
              {t("analytics.insights")}
            </Text>
            <BlockStack gap="100">
              {data.overview.avgConfidence < 70 && (
                <Text variant="bodyMd" as="p">
                  • {t("analytics.insightLowConfidence")}
                </Text>
              )}
              {((data.sentiments?.find((s) => s.sentiment === "Negative")?.percentage ?? 0) > 20) && (
                <Text variant="bodyMd" as="p">
                  • {t("analytics.insightNegativeSentiment")}
                </Text>
              )}
              {(data.engagement?.avgMessagesPerSession ?? 0) < 2 && (
                <Text variant="bodyMd" as="p">
                  • {t("analytics.insightLowEngagement")}
                </Text>
              )}
              {data.intents && data.intents.length > 0 &&
                data.intents[0]?.intent === "OTHER" &&
                (data.intents[0]?.percentage ?? 0) > 30 && (
                  <Text variant="bodyMd" as="p">
                    • {t("analytics.insightOtherIntent")}
                  </Text>
                )}
              {(data.overview?.totalMessages ?? 0) === 0 && (
                <Text variant="bodyMd" as="p">
                  • {t("analytics.insightNoData")}
                </Text>
              )}
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
