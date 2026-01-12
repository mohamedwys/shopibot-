import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma as db } from "../db.server";
import { getWebhookSecurityHeaders } from "../lib/security-headers.server";
import { logger } from "../lib/logger.server";
import { randomBytes } from "crypto";

/**
 * App Uninstalled Webhook
 *
 * Triggered when a merchant uninstalls the app.
 * We perform immediate cleanup of app data here.
 *
 * Note: The shop/redact webhook will be called 48 hours later for final cleanup.
 * We do comprehensive cleanup here to ensure data is removed promptly.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const correlationId = randomBytes(16).toString("hex");
  const webhookLogger = logger.child({ correlationId, webhook: "app/uninstalled" });

  webhookLogger.info({
    headers: {
      topic: request.headers.get("X-Shopify-Topic"),
      domain: request.headers.get("X-Shopify-Shop-Domain"),
    }
  }, "Webhook received: app uninstalled");

  const { shop, session, topic } = await authenticate.webhook(request);

  webhookLogger.info({ shop, topic }, "Webhook authenticated successfully");


  try {
    // Perform comprehensive cleanup in a transaction
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

      // Find all chat sessions first (needed for foreign key cleanup)
      const chatSessions = await tx.chatSession.findMany({
        where: { shop },
        select: { id: true },
      });

      const sessionIds = chatSessions.map((s) => s.id);

      // Delete chat messages first (child records)
      if (sessionIds.length > 0) {
        const deletedMessages = await tx.chatMessage.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
        deletionStats.chatMessages = deletedMessages.count;
      }

      // Delete chat sessions
      const deletedSessions = await tx.chatSession.deleteMany({
        where: { shop },
      });
      deletionStats.chatSessions = deletedSessions.count;

      // Delete user profiles
      const deletedProfiles = await tx.userProfile.deleteMany({
        where: { shop },
      });
      deletionStats.userProfiles = deletedProfiles.count;

      // Delete product embeddings
      const deletedEmbeddings = await tx.productEmbedding.deleteMany({
        where: { shop },
      });
      deletionStats.productEmbeddings = deletedEmbeddings.count;

      // Delete widget settings
      const deletedSettings = await tx.widgetSettings.deleteMany({
        where: { shop },
      });
      deletionStats.widgetSettings = deletedSettings.count;

      // Delete analytics data
      const deletedAnalytics = await tx.chatAnalytics.deleteMany({
        where: { shop },
      });
      deletionStats.chatAnalytics = deletedAnalytics.count;

      // Delete conversation records (for usage tracking)
      const deletedConversations = await tx.conversation.deleteMany({
        where: { shop },
      });
      deletionStats.conversations = deletedConversations.count;

      // Delete BYOK usage records
      const deletedByokUsage = await tx.byokUsage.deleteMany({
        where: { shop },
      });
      deletionStats.byokUsage = deletedByokUsage.count;

      // Delete sessions
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
    }, "App data cleaned up successfully on uninstall");

    return new Response(JSON.stringify({
      success: true,
      shop,
      deletion_summary: result,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });

  } catch (error) {
    webhookLogger.error({
      shop,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, "Error during app uninstall cleanup - Shopify will retry");

    // ✅ GDPR COMPLIANCE FIX: Return 500 to allow webhook retries for transient errors
    // Shopify will retry failed webhooks automatically
    // The shop/redact webhook (48 hours later) provides additional backup
    return new Response(JSON.stringify({
      error: "Cleanup error",
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });
  }
};
