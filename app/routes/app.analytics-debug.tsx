import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { prisma as db } from "../db.server";
import { Page, Card, BlockStack, Text, Layout } from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ✅ SECURITY FIX: Block access to debug routes in production
  if (process.env.NODE_ENV === 'production') {
    throw new Response("Not Found", { status: 404 });
  }

  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get current date range (last 7 days)
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  startDate.setHours(0, 0, 0, 0);

  // Query all relevant tables
  const [
    chatAnalyticsCount,
    chatAnalyticsRecords,
    chatSessionCount,
    chatSessions,
    chatMessageCount,
    chatMessages,
    userProfileCount,
  ] = await Promise.all([
    // ChatAnalytics
    db.chatAnalytics.count({ where: { shop } }),
    db.chatAnalytics.findMany({
      where: { shop },
      orderBy: { date: 'desc' },
      take: 10,
    }),

    // ChatSession
    db.chatSession.count({ where: { shop } }),
    db.chatSession.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        messages: {
          take: 3,
          orderBy: { timestamp: 'desc' },
        },
      },
    }),

    // ChatMessage
    db.chatMessage.count({
      where: {
        session: { shop },
      },
    }),
    db.chatMessage.findMany({
      where: {
        session: { shop },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        session: {
          select: { id: true, shop: true },
        },
      },
    }),

    // UserProfile
    db.userProfile.count({ where: { shop } }),
  ]);

  // Query with date filter
  const chatAnalyticsInPeriod = await db.chatAnalytics.findMany({
    where: {
      shop,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const messagesInPeriod = await db.chatMessage.count({
    where: {
      session: { shop },
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const sessionsInPeriod = await db.chatSession.count({
    where: {
      shop,
      messages: {
        some: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    },
  });

  return json({
    shop,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totals: {
      chatAnalytics: chatAnalyticsCount,
      chatSessions: chatSessionCount,
      chatMessages: chatMessageCount,
      userProfiles: userProfileCount,
    },
    inPeriod: {
      chatAnalytics: chatAnalyticsInPeriod.length,
      totalSessions: chatAnalyticsInPeriod.reduce((sum, r) => sum + r.totalSessions, 0),
      totalMessages: chatAnalyticsInPeriod.reduce((sum, r) => sum + r.totalMessages, 0),
      messagesCount: messagesInPeriod,
      sessionsCount: sessionsInPeriod,
    },
    samples: {
      chatAnalytics: chatAnalyticsRecords.map(r => ({
        date: r.date.toISOString(),
        totalSessions: r.totalSessions,
        totalMessages: r.totalMessages,
        avgConfidence: r.avgConfidence,
        topIntents: r.topIntents,
        sentimentBreakdown: r.sentimentBreakdown,
      })),
      chatSessions: chatSessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastMessageAt: s.lastMessageAt.toISOString(),
        messagesCount: s.messages.length,
      })),
      chatMessages: chatMessages.map(m => ({
        id: m.id,
        role: m.role,
        timestamp: m.timestamp.toISOString(),
        intent: m.intent,
        sentiment: m.sentiment,
        contentPreview: m.content.substring(0, 50),
      })),
    },
  });
};

export default function AnalyticsDebugPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Analytics Debug" backAction={{ url: "/app/analytics" }}>
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Database Stats for: {data.shop}
            </Text>
            <Text variant="bodyMd" as="p">
              Date Range: {new Date(data.dateRange.start).toLocaleString()} to{" "}
              {new Date(data.dateRange.end).toLocaleString()}
            </Text>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  Total Counts (All Time)
                </Text>
                <Text variant="bodyMd" as="p">
                  ChatAnalytics Records: {data.totals.chatAnalytics}
                </Text>
                <Text variant="bodyMd" as="p">
                  Chat Sessions: {data.totals.chatSessions}
                </Text>
                <Text variant="bodyMd" as="p">
                  Chat Messages: {data.totals.chatMessages}
                </Text>
                <Text variant="bodyMd" as="p">
                  User Profiles: {data.totals.userProfiles}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  In Selected Period (Last 7 Days)
                </Text>
                <Text variant="bodyMd" as="p">
                  ChatAnalytics Records: {data.inPeriod.chatAnalytics}
                </Text>
                <Text variant="bodyMd" as="p">
                  Total Sessions (from analytics): {data.inPeriod.totalSessions}
                </Text>
                <Text variant="bodyMd" as="p">
                  Total Messages (from analytics): {data.inPeriod.totalMessages}
                </Text>
                <Text variant="bodyMd" as="p">
                  Actual Messages Count: {data.inPeriod.messagesCount}
                </Text>
                <Text variant="bodyMd" as="p">
                  Actual Sessions Count: {data.inPeriod.sessionsCount}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Sample ChatAnalytics Records
            </Text>
            <pre style={{ fontSize: "12px", overflow: "auto" }}>
              {JSON.stringify(data.samples.chatAnalytics, null, 2)}
            </pre>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Sample Chat Sessions
            </Text>
            <pre style={{ fontSize: "12px", overflow: "auto" }}>
              {JSON.stringify(data.samples.chatSessions, null, 2)}
            </pre>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Sample Chat Messages
            </Text>
            <pre style={{ fontSize: "12px", overflow: "auto" }}>
              {JSON.stringify(data.samples.chatMessages, null, 2)}
            </pre>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
