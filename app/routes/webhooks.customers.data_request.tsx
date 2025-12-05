import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getWebhookSecurityHeaders } from "../lib/security-headers.server";

/**
 * GDPR Webhook: Customer Data Request
 *
 * When a customer requests their data, Shopify sends this webhook.
 * We must return all personal data we have stored for this customer.
 *
 * Required by Shopify App Store for GDPR compliance.
 * Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);


  try {
    // Extract customer information from payload
    const customerId = payload.customer?.id?.toString();
    const customerEmail = payload.customer?.email;
    const customerPhone = payload.customer?.phone;

    if (!customerId && !customerEmail) {
      return new Response(JSON.stringify({
        error: "No customer identifier provided"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...getWebhookSecurityHeaders()
        }
      });
    }


    // Collect all customer data from our database
    const customerData: any = {
      shop_domain: shop,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      data_requested_at: new Date().toISOString(),
      profiles: [],
      chat_sessions: [],
      chat_messages: [],
      analytics: [],
    };

    // Find all user profiles for this customer
    const userProfiles = await db.userProfile.findMany({
      where: {
        shop,
        ...(customerId ? { customerId } : {}),
      },
      include: {
        chatSessions: {
          include: {
            messages: true,
          },
        },
      },
    });


    // Collect data from each profile
    for (const profile of userProfiles) {
      customerData.profiles.push({
        profile_id: profile.id,
        session_id: profile.sessionId,
        preferences: JSON.parse(profile.preferences || '{}'),
        browsing_history: JSON.parse(profile.browsingHistory || '[]'),
        purchase_history: JSON.parse(profile.purchaseHistory || '[]'),
        interactions: JSON.parse(profile.interactions || '[]'),
        created_at: profile.createdAt.toISOString(),
        updated_at: profile.updatedAt.toISOString(),
      });

      // Collect chat sessions
      for (const session of profile.chatSessions) {
        customerData.chat_sessions.push({
          session_id: session.id,
          context: JSON.parse(session.context || '{}'),
          last_message_at: session.lastMessageAt.toISOString(),
          created_at: session.createdAt.toISOString(),
        });

        // Collect chat messages
        for (const message of session.messages) {
          customerData.chat_messages.push({
            message_id: message.id,
            session_id: session.id,
            role: message.role,
            content: message.content,
            intent: message.intent,
            sentiment: message.sentiment,
            confidence: message.confidence,
            products_shown: JSON.parse(message.productsShown || '[]'),
            product_clicked: message.productClicked,
            metadata: JSON.parse(message.metadata || '{}'),
            timestamp: message.timestamp.toISOString(),
          });
        }
      }
    }

    // Collect aggregated analytics data (if it contains customer-specific info)
    const analytics = await db.chatAnalytics.findMany({
      where: { shop },
      take: 30, // Last 30 days
      orderBy: { date: 'desc' },
    });

    customerData.analytics = analytics.map((a: any) => ({
      date: a.date.toISOString(),
      total_sessions: a.totalSessions,
      total_messages: a.totalMessages,
      avg_response_time: a.avgResponseTime,
      avg_confidence: a.avgConfidence,
    }));


    // Return the collected data
    // Note: Shopify will store this and provide it to the customer
    return new Response(JSON.stringify(customerData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getWebhookSecurityHeaders()
      }
    });

  } catch (error) {

    // Return error but don't fail the webhook
    return new Response(JSON.stringify({
      error: "Error collecting customer data",
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...getWebhookSecurityHeaders()
      }
    });
  }
};
