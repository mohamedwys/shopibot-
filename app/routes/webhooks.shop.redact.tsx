import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma as db } from "../db.server";
import { getWebhookSecurityHeaders } from "../lib/security-headers.server";
import { logger } from "../lib/logger.server";
import { randomBytes } from "crypto";

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
  const correlationId = randomBytes(16).toString("hex");
  const webhookLogger = logger.child({ correlationId, webhook: "shop/redact" });

  webhookLogger.info({
    headers: {
      topic: request.headers.get("X-Shopify-Topic"),
      domain: request.headers.get("X-Shopify-Shop-Domain"),
    }
  }, "GDPR webhook received: shop data redaction (48hr post-uninstall)");

  const { shop, topic } = await authenticate.webhook(request);

  webhookLogger.info({ shop, topic }, "Webhook authenticated successfully");


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
        conversations: 0,
        byokUsage: 0,
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

      // Step 7: Delete all conversation records (for usage tracking)
      const deletedConversations = await tx.conversation.deleteMany({
        where: { shop },
      });
      deletionStats.conversations = deletedConversations.count;

      // Step 8: Delete all BYOK usage records
      const deletedByokUsage = await tx.byokUsage.deleteMany({
        where: { shop },
      });
      deletionStats.byokUsage = deletedByokUsage.count;

      // Step 9: Delete all sessions
      // Note: This might already be done by webhooks.app.uninstalled, but we do it again to be sure
      const deletedSessionRecords = await tx.session.deleteMany({
        where: { shop },
      });
      deletionStats.sessions = deletedSessionRecords.count;

      return deletionStats;
    });

    webhookLogger.info({
      shop,
      deletionStats: result,
      totalRecordsDeleted: Object.values(result).reduce((sum, count) => sum + count, 0)
    }, "Shop data deleted successfully");

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
    webhookLogger.error({
      shop,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, "Error deleting shop data - Shopify will retry");

    // ✅ GDPR COMPLIANCE FIX: Return 500 to allow webhook retries for transient errors
    // Shopify will retry failed webhooks automatically
    // This ensures data deletion completes even if temporary issues occur
    return new Response(JSON.stringify({
      error: "Error deleting shop data",
      message: error instanceof Error ? error.message : 'Unknown error',
      shop_domain: shop,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });
  }
};
