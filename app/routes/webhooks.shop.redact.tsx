import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma as db } from "../db.server";
import { getWebhookSecurityHeaders } from "../lib/security-headers.server";

/**
 * GDPR Webhook: Shop Data Redaction
 *
 * Shopify sends this webhook 48 hours after a store uninstalls your app.
 * We must delete ALL data associated with this shop.
 *
 * Required by Shopify App Store for GDPR compliance.
 * Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance
 *
 * Timeline: Triggered 48 hours after app uninstallation.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);


  try {
    // Delete all shop data in a transaction to ensure data integrity
    const result = await db.$transaction(async (tx) => {
      const deletionStats = {
        sessions: 0,
        widgetSettings: 0,
        productEmbeddings: 0,
        chatMessages: 0,
        chatSessions: 0,
        userProfiles: 0,
        chatAnalytics: 0,
      };

      // Step 1: Delete all chat messages for this shop
      // (We need to do this first before deleting sessions due to foreign key constraints)
      const chatSessions = await tx.chatSession.findMany({
        where: { shop },
        select: { id: true },
      });

      const sessionIds = chatSessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        const deletedMessages = await tx.chatMessage.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
        deletionStats.chatMessages = deletedMessages.count;
      }

      // Step 2: Delete all chat sessions
      const deletedSessions = await tx.chatSession.deleteMany({
        where: { shop },
      });
      deletionStats.chatSessions = deletedSessions.count;

      // Step 3: Delete all user profiles
      const deletedProfiles = await tx.userProfile.deleteMany({
        where: { shop },
      });
      deletionStats.userProfiles = deletedProfiles.count;

      // Step 4: Delete all product embeddings
      const deletedEmbeddings = await tx.productEmbedding.deleteMany({
        where: { shop },
      });
      deletionStats.productEmbeddings = deletedEmbeddings.count;

      // Step 5: Delete widget settings
      const deletedSettings = await tx.widgetSettings.deleteMany({
        where: { shop },
      });
      deletionStats.widgetSettings = deletedSettings.count;

      // Step 6: Delete all analytics data
      const deletedAnalytics = await tx.chatAnalytics.deleteMany({
        where: { shop },
      });
      deletionStats.chatAnalytics = deletedAnalytics.count;

      // Step 7: Delete all sessions
      // Note: This might already be done by webhooks.app.uninstalled, but we do it again to be sure
      const deletedSessionRecords = await tx.session.deleteMany({
        where: { shop },
      });
      deletionStats.sessions = deletedSessionRecords.count;

      return deletionStats;
    });


    return new Response(JSON.stringify({
      success: true,
      message: "Shop data deleted successfully",
      shop_domain: shop,
      deletion_summary: result,
      deleted_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });

  } catch (error) {
    // Return success to Shopify to prevent retries
    // Manual investigation will be needed if this fails
    return new Response(JSON.stringify({
      error: "Error deleting shop data",
      message: error instanceof Error ? error.message : 'Unknown error',
      shop_domain: shop,
      // Return 200 to prevent retries - manual cleanup may be needed
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });
  }
};
