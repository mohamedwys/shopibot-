import { useState, useCallback, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Button,
  Select,
  Badge,
  InlineStack,
  Box,
  Divider,
  ProgressBar,
  Icon,
} from "@shopify/polaris";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  AnalyticsIcon,
  CustomersIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { analyticsService, AnalyticsService } from "../services/analytics.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get period from query params or default to last 7 days
  const url = new URL(request.url);
  const periodPreset = url.searchParams.get("period") || "week";

  const period = AnalyticsService.getPeriodFromPreset(periodPreset);

  try {
    // Fetch all analytics data
    const [overview, intents, sentiments, topProducts, trends, engagement, activeUsers] =
      await Promise.all([
        analyticsService.getOverview(session.shop, period),
        analyticsService.getIntentDistribution(session.shop, period),
        analyticsService.getSentimentBreakdown(session.shop, period),
        analyticsService.getTopProducts(session.shop, period, 10),
        analyticsService.getDailyTrends(session.shop, period),
        analyticsService.getUserEngagement(session.shop, period),
        analyticsService.getActiveUsers(session.shop, period),
      ]);

    return json({
      overview,
      intents,
      sentiments,
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
    console.error("Analytics loader error:", error);
    return json({
      overview: {
        totalSessions: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        avgConfidence: 0,
        periodComparison: { sessionsChange: 0, messagesChange: 0, confidenceChange: 0 },
      },
      intents: [],
      sentiments: [],
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
  const { session } = await authenticate.admin(request);

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
    { label: "Today", value: "today" },
    { label: "Last 7 days", value: "week" },
    { label: "Last 30 days", value: "month" },
    { label: "Last 90 days", value: "quarter" },
  ];

  // Helper to format numbers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  // Helper to get change badge
  const getChangeBadge = (change: number) => {
    if (change === 0) return null;

    const isPositive = change > 0;
    const tone = isPositive ? "success" : "critical";
    const icon = isPositive ? TrendingUpIcon : TrendingDownIcon;

    return (
      <Badge tone={tone} icon={icon}>
        {isPositive ? "+" : ""}
        {change.toFixed(1)}%
      </Badge>
    );
  };

  // Calculate intent colors
  const getIntentColor = (intent: string) => {
    const colors: Record<string, string> = {
      PRODUCT_SEARCH: "#5C6AC4",
      PRICE_INQUIRY: "#47C1BF",
      SHIPPING: "#006FBB",
      RETURNS: "#ED6347",
      SUPPORT: "#FFC96B",
      GREETING: "#9C6ADE",
      THANKS: "#50B83C",
      COMPARISON: "#637381",
      AVAILABILITY: "#006FBB",
      SIZE_FIT: "#47C1BF",
      OTHER: "#919EAB",
    };
    return colors[intent] || "#919EAB";
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
      title="Analytics Dashboard"
      subtitle="Track chatbot performance and customer interactions"
      primaryAction={{
        content: "Export CSV",
        onAction: handleExport,
        icon: CalendarIcon,
      }}
    >
      <BlockStack gap="500">
        {/* Period Selector */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">
              Time Period
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
                    Total Messages
                  </Text>
                  <Icon source={AnalyticsIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {formatNumber(data.overview.totalMessages)}
                </Text>
                {getChangeBadge(data.overview.periodComparison.messagesChange)}
                <Text variant="bodySm" as="p" tone="subdued">
                  vs. previous period
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Active Users
                  </Text>
                  <Icon source={CustomersIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {formatNumber(data.activeUsers)}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  unique users
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    AI Confidence
                  </Text>
                  <Icon source={AnalyticsIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {data.overview.avgConfidence.toFixed(1)}%
                </Text>
                {getChangeBadge(data.overview.periodComparison.confidenceChange)}
                <Text variant="bodySm" as="p" tone="subdued">
                  average accuracy
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Engagement Metrics */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Engagement Metrics
            </Text>

            <InlineGrid columns={4} gap="400">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Messages per Session
                </Text>
                <Text variant="headingLg" as="h3">
                  {data.engagement.avgMessagesPerSession.toFixed(1)}
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Avg Session Duration
                </Text>
                <Text variant="headingLg" as="h3">
                  {Math.round(data.engagement.avgSessionDuration / 60)}m
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Avg Response Time
                </Text>
                <Text variant="headingLg" as="h3">
                  {(data.overview.avgResponseTime / 1000).toFixed(1)}s
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total Sessions
                </Text>
                <Text variant="headingLg" as="h3">
                  {formatNumber(data.engagement.totalSessions)}
                </Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Intent Distribution */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Customer Intent Distribution
            </Text>

            {data.intents.length > 0 ? (
              <BlockStack gap="300">
                {data.intents.map((intent, index) => (
                  <Box key={index}>
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="p">
                          {intent.intent.replace(/_/g, " ")}
                        </Text>
                        <InlineStack gap="200">
                          <Text variant="bodyMd" as="p" tone="subdued">
                            {formatNumber(intent.count)}
                          </Text>
                          <Text variant="bodyMd" as="p">
                            {intent.percentage}%
                          </Text>
                        </InlineStack>
                      </InlineStack>
                      <ProgressBar
                        progress={intent.percentage}
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
                No intent data available for this period
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Sentiment Analysis */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Sentiment Analysis
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
                        {formatNumber(sentiment.count)} messages
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                No sentiment data available for this period
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Top Products */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Most Clicked Products
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
                      <Badge tone="info">{formatNumber(product.clicks)} clicks</Badge>
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
                No product click data available for this period
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Daily Trends */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Daily Message Trends
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
                        title={`${new Date(trend.date).toLocaleDateString()}: ${trend.messages} messages`}
                      />
                    );
                  })}
                </div>

                <Box paddingBlockStart="400">
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="p" tone="subdued">
                      {new Date(data.trends[0]?.date).toLocaleDateString()}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {new Date(
                        data.trends[data.trends.length - 1]?.date
                      ).toLocaleDateString()}
                    </Text>
                  </InlineStack>
                </Box>
              </Box>
            ) : (
              <Text variant="bodyMd" as="p" tone="subdued">
                No trend data available for this period
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Info Banner */}
        <Card>
          <BlockStack gap="200">
            <Text variant="headingMd" as="h2">
              💡 Insights & Recommendations
            </Text>
            <BlockStack gap="100">
              {data.overview.avgConfidence < 70 && (
                <Text variant="bodyMd" as="p">
                  • AI confidence is below 70%. Consider reviewing product descriptions and
                  generating embeddings.
                </Text>
              )}
              {data.sentiments.find((s) => s.sentiment === "Negative")?.percentage || 0 > 20 && (
                <Text variant="bodyMd" as="p">
                  • More than 20% negative sentiment detected. Review customer interactions and
                  improve responses.
                </Text>
              )}
              {data.engagement.avgMessagesPerSession < 2 && (
                <Text variant="bodyMd" as="p">
                  • Low engagement ({"<"}2 messages per session). Consider improving welcome
                  message and suggestions.
                </Text>
              )}
              {data.intents.length > 0 &&
                data.intents[0].intent === "OTHER" &&
                data.intents[0].percentage > 30 && (
                  <Text variant="bodyMd" as="p">
                    • Many queries classified as "OTHER". Review unhandled intents and add more
                    training data.
                  </Text>
                )}
              {data.overview.totalMessages === 0 && (
                <Text variant="bodyMd" as="p">
                  • No data yet! Install the widget on your storefront and start getting
                  insights.
                </Text>
              )}
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
