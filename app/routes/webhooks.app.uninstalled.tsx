import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getWebhookSecurityHeaders } from "../lib/security-headers.server";

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
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log(`🗑️ Starting immediate cleanup for uninstalled shop: ${shop}`);

  try {
    // Perform comprehensive cleanup in a transaction
    const result = await db.$transaction(async (tx: any) => {
      const deletionStats = {
        sessions: 0,
        widgetSettings: 0,
        productEmbeddings: 0,
        chatMessages: 0,
        chatSessions: 0,
        userProfiles: 0,
        chatAnalytics: 0,
      };

      // Find all chat sessions first (needed for foreign key cleanup)
      const chatSessions = await tx.chatSession.findMany({
        where: { shop },
        select: { id: true },
      });

      const sessionIds = chatSessions.map((s: any) => s.id);

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

      // Delete sessions
      const deletedSessionRecords = await tx.session.deleteMany({
        where: { shop },
      });
      deletionStats.sessions = deletedSessionRecords.count;

      return deletionStats;
    });

    console.log(`✅ Cleanup completed for shop ${shop}`);
    console.log(`Deletion summary:`, result);

    return new Response(JSON.stringify({
      success: true,
      shop,
      deletion_summary: result,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });

  } catch (error) {
    console.error(`❌ Error during uninstall cleanup for ${shop}:`, error);

    // Return success to prevent webhook retries
    // The shop/redact webhook (48 hours later) will catch any missed data
    return new Response(JSON.stringify({
      error: "Cleanup error",
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getWebhookSecurityHeaders() }
    });
  }
};
