import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getWebhookSecurityHeaders } from "../lib/security-headers.server";

/**
 * GDPR Webhook: Customer Data Redaction
 *
 * When a customer requests deletion of their data (right to be forgotten),
 * Shopify sends this webhook. We must delete ALL personal data for this customer.
 *
 * Required by Shopify App Store for GDPR compliance.
 * Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance
 *
 * Timeline: Must complete within 30 days of receiving the request.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log(`Customer ID: ${payload.customer?.id || 'N/A'}`);

  try {
    // Extract customer information from payload
    const customerId = payload.customer?.id?.toString();
    const customerEmail = payload.customer?.email;
    const customerPhone = payload.customer?.phone;

    if (!customerId && !customerEmail) {
      console.log('⚠️ No customer identifier provided in webhook payload');
      return new Response(JSON.stringify({
        error: "No customer identifier provided"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
      });
    }

    console.log(`🗑️ Deleting all data for customer: ${customerId || customerEmail}`);

    // Find all user profiles for this customer
    const userProfiles = await db.userProfile.findMany({
      where: {
        shop,
        ...(customerId ? { customerId } : {}),
      },
      select: {
        id: true,
        sessionId: true,
      },
    });

    const profileIds = userProfiles.map(p => p.id);
    console.log(`Found ${profileIds.length} profiles to delete`);

    if (profileIds.length > 0) {
      // Delete all related data in a transaction to ensure data integrity
      await db.$transaction(async (tx) => {
        // Step 1: Find all chat sessions for these profiles
        const chatSessions = await tx.chatSession.findMany({
          where: {
            userProfileId: { in: profileIds },
          },
          select: { id: true },
        });

        const sessionIds = chatSessions.map(s => s.id);
        console.log(`  - Deleting ${sessionIds.length} chat sessions`);

        // Step 2: Delete all chat messages for these sessions
        if (sessionIds.length > 0) {
          const deletedMessages = await tx.chatMessage.deleteMany({
            where: {
              sessionId: { in: sessionIds },
            },
          });
          console.log(`  - Deleted ${deletedMessages.count} chat messages`);
        }

        // Step 3: Delete all chat sessions
        if (sessionIds.length > 0) {
          const deletedSessions = await tx.chatSession.deleteMany({
            where: {
              id: { in: sessionIds },
            },
          });
          console.log(`  - Deleted ${deletedSessions.count} chat sessions`);
        }

        // Step 4: Delete all user profiles
        const deletedProfiles = await tx.userProfile.deleteMany({
          where: {
            id: { in: profileIds },
          },
        });
        console.log(`  - Deleted ${deletedProfiles.count} user profiles`);

        // Note: We keep aggregated analytics data as it doesn't contain
        // personal information, only counts and averages.
        // If your analytics contain personal data, delete those records too.
      });

      console.log(`✅ Successfully deleted all data for customer ${customerId || customerEmail}`);

      return new Response(JSON.stringify({
        success: true,
        message: "Customer data deleted successfully",
        customer_id: customerId,
        profiles_deleted: profileIds.length,
        deleted_at: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
      });
    } else {
      console.log(`ℹ️ No data found for customer ${customerId || customerEmail}`);

      return new Response(JSON.stringify({
        success: true,
        message: "No customer data found to delete",
        customer_id: customerId,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
      });
    }

  } catch (error) {
    console.error("❌ Error processing customer redaction request:", error);

    // Log the error but return success to Shopify
    // This prevents webhook retries while we investigate the issue
    // Make sure to manually verify deletion completed
    return new Response(JSON.stringify({
      error: "Error deleting customer data",
      message: error instanceof Error ? error.message : 'Unknown error',
      // Still return 200 to prevent retries - manual intervention needed
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });
  }
};
