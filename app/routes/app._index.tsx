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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // In a real app, you'd fetch analytics data from your database
  const stats = {
    totalConversations: 127,
    activeToday: 23,
    avgResponseTime: "2.3s",
    customerSatisfaction: 4.8,
    topQuestions: [
      "What's your return policy?",
      "Do you offer free shipping?",
      "What sizes do you have available?",
      "When will my order arrive?",
      "Can I track my package?"
    ]
  };

  return json({ stats });
};

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <Page 
      title="AI Sales Assistant Dashboard"
      subtitle="Monitor your AI assistant's performance and customer interactions"
      primaryAction={{
        content: "Configure Settings",
        url: "/app/settings"
      }}
    >
      <Layout>
        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Total Conversations
                </Text>
                <Text variant="heading2xl" as="p">
                  {stats.totalConversations}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  All time
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Active Today
                </Text>
                <Text variant="heading2xl" as="p">
                  {stats.activeToday}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Conversations started
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Avg Response Time
                </Text>
                <Text variant="heading2xl" as="p">
                  {stats.avgResponseTime}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  AI processing speed
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Satisfaction
                </Text>
                <InlineStack gap="200" align="center">
                  <Text variant="heading2xl" as="p">
                    {stats.customerSatisfaction}
                  </Text>
                  <Badge tone="success">Excellent</Badge>
                </InlineStack>
                <Text variant="bodySm" as="p" tone="subdued">
                  Out of 5 stars
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="400" align="start">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Widget Status
                </Text>
                
                <BlockStack gap="300">
                  <InlineStack gap="200" align="space-between">
                    <Text variant="bodyMd" as="p">
                      AI Assistant
                    </Text>
                    <Badge tone="success">Active</Badge>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="space-between">
                    <Text variant="bodyMd" as="p">
                      Theme Integration
                    </Text>
                    <Badge tone="success">Enabled</Badge>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="space-between">
                    <Text variant="bodyMd" as="p">
                      N8N Connection
                    </Text>
                    <Badge tone="warning">Fallback Mode</Badge>
                  </InlineStack>
                </BlockStack>

                <Divider />

                <Button variant="primary" url="/app/settings">
                  Configure Widget
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Top Customer Questions
                </Text>
                
                <BlockStack gap="300">
                  {stats.topQuestions.map((question, index) => (
                    <Box key={index}>
                      <InlineStack gap="200" align="space-between">
                        <Text variant="bodyMd" as="p">
                          {question}
                        </Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          {Math.floor(Math.random() * 20) + 5} times
                        </Text>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>

                <Divider />

                <Button url="/app/sales-assistant">
                  View Chat Interface
                </Button>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Quick Setup Guide
              </Text>
              
              <BlockStack gap="300">
                <Box>
                  <InlineStack gap="200" align="start">
                    <Badge tone="success">✓</Badge>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p">
                        App installed and configured
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Your AI Sales Assistant app is ready to use
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>

                <Box>
                  <InlineStack gap="200" align="start">
                    <Badge tone="success">✓</Badge>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p">
                        Widget added to theme
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        The chat widget appears on your storefront
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>

                <Box>
                  <InlineStack gap="200" align="start">
                    <Badge tone="attention">⚠</Badge>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p">
                        Connect N8N workflow (Optional)
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        For advanced AI processing and integrations
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              </BlockStack>

              <Divider />

              <InlineStack gap="200">
                <Button variant="primary" url="/app/settings">
                  Customize Widget
                </Button>
                <Button url="https://sanluna-ihearai.myshopify.com" external>
                  View Store
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
