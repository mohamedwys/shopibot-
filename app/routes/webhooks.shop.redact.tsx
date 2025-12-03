import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
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

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log(`🗑️ Deleting ALL shop data for: ${shop}`);

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

      const sessionIds = chatSessions.map(s => s.id);
      console.log(`Found ${sessionIds.length} chat sessions to delete`);

      if (sessionIds.length > 0) {
        const deletedMessages = await tx.chatMessage.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
        deletionStats.chatMessages = deletedMessages.count;
        console.log(`  - Deleted ${deletedMessages.count} chat messages`);
      }

      // Step 2: Delete all chat sessions
      const deletedSessions = await tx.chatSession.deleteMany({
        where: { shop },
      });
      deletionStats.chatSessions = deletedSessions.count;
      console.log(`  - Deleted ${deletedSessions.count} chat sessions`);

      // Step 3: Delete all user profiles
      const deletedProfiles = await tx.userProfile.deleteMany({
        where: { shop },
      });
      deletionStats.userProfiles = deletedProfiles.count;
      console.log(`  - Deleted ${deletedProfiles.count} user profiles`);

      // Step 4: Delete all product embeddings
      const deletedEmbeddings = await tx.productEmbedding.deleteMany({
        where: { shop },
      });
      deletionStats.productEmbeddings = deletedEmbeddings.count;
      console.log(`  - Deleted ${deletedEmbeddings.count} product embeddings`);

      // Step 5: Delete widget settings
      const deletedSettings = await tx.widgetSettings.deleteMany({
        where: { shop },
      });
      deletionStats.widgetSettings = deletedSettings.count;
      console.log(`  - Deleted ${deletedSettings.count} widget settings`);

      // Step 6: Delete all analytics data
      const deletedAnalytics = await tx.chatAnalytics.deleteMany({
        where: { shop },
      });
      deletionStats.chatAnalytics = deletedAnalytics.count;
      console.log(`  - Deleted ${deletedAnalytics.count} analytics records`);

      // Step 7: Delete all sessions
      // Note: This might already be done by webhooks.app.uninstalled, but we do it again to be sure
      const deletedSessionRecords = await tx.session.deleteMany({
        where: { shop },
      });
      deletionStats.sessions = deletedSessionRecords.count;
      console.log(`  - Deleted ${deletedSessionRecords.count} session records`);

      return deletionStats;
    });

    console.log(`✅ Successfully deleted all data for shop ${shop}`);
    console.log(`Deletion summary:`, result);

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
    console.error("❌ Error processing shop redaction request:", error);

    // Log detailed error for investigation
    console.error("Error details:", {
      shop,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

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
