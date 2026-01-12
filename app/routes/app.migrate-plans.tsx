/**
 * Plan Migration Route
 *
 * This route allows admins to manually trigger a migration of all widget settings
 * from legacy plan codes (BASIC, UNLIMITED) to new codes (STARTER, PROFESSIONAL).
 *
 * Access: /app/migrate-plans
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Banner, BlockStack, List, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { migratePlanCodes } from "../lib/migrate-plans.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ✅ SECURITY FIX: Block access to migration tool in production
  if (process.env.NODE_ENV === 'production') {
    throw new Response("Not Found", { status: 404 });
  }

  await authenticate.admin(request);

  try {
    const result = await migratePlanCodes();
    return json({
      success: true,
      ...result
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      updated: 0,
      errors: 0
    });
  }
};

export default function MigratePlansPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page
      title="Plan Code Migration"
      backAction={{ content: "Settings", url: "/app/settings" }}
    >
      <Layout>
        <Layout.Section>
          {data.success ? (
            <Banner tone="success">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  ✅ Migration Complete!
                </Text>
                <Text variant="bodyMd" as="p">
                  Successfully migrated {data.updated} shop{data.updated !== 1 ? 's' : ''} to new plan codes.
                </Text>
                {data.errors > 0 && (
                  <Text variant="bodyMd" as="p" tone="critical">
                    {data.errors} error{data.errors !== 1 ? 's' : ''} occurred during migration.
                  </Text>
                )}
              </BlockStack>
            </Banner>
          ) : (
            <Banner tone="critical">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  ❌ Migration Failed
                </Text>
                <Text variant="bodyMd" as="p">
                  {data.error}
                </Text>
              </BlockStack>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Plan Code Migration Details
              </Text>

              <Text variant="bodyMd" as="p">
                This migration updates legacy plan codes to the new standardized format:
              </Text>

              <List type="bullet">
                <List.Item>
                  <Badge tone="info">BASIC</Badge> → <Badge tone="success">STARTER</Badge>
                </List.Item>
                <List.Item>
                  <Badge tone="info">UNLIMITED</Badge> → <Badge tone="success">PROFESSIONAL</Badge>
                </List.Item>
                <List.Item>
                  <Badge tone="success">BYOK</Badge> remains <Badge tone="success">BYOK</Badge>
                </List.Item>
              </List>

              <Text variant="bodyMd" as="p" tone="subdued">
                Note: Migration also happens automatically when shops load the settings page or use the chat widget.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Migration Results
              </Text>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  <strong>Shops Updated:</strong> {data.updated}
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>Errors:</strong> {data.errors}
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>Status:</strong> <Badge tone={data.success ? "success" : "critical"}>
                    {data.success ? "Success" : "Failed"}
                  </Badge>
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
