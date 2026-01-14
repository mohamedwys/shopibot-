import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getSecureCorsHeaders } from "../lib/cors.server";
import { rateLimit } from "../lib/rate-limit.server";
import { RATE_LIMITS } from "../config/limits";
import { personalizationService } from "../services/personalization.service";
import { logError, createLogger } from "../lib/logger.server";

const logger = createLogger({ service: 'TrackProductClick' });

/**
 * API endpoint to track product clicks from the widget
 *
 * This endpoint receives product click events from the frontend widget
 * and updates the analytics database with the click information.
 *
 * Expected POST body:
 * {
 *   shop: string;
 *   productId: string;
 *   productHandle?: string;
 *   productTitle?: string;
 *   sessionId?: string;
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Apply rate limiting to prevent abuse
  const rateLimitResponse = rateLimit(
    request,
    {
      windowMs: RATE_LIMITS.WIDGET_RATE_WINDOW_SECONDS * 1000,
      maxRequests: RATE_LIMITS.WIDGET_REQUESTS_PER_MINUTE * 2, // Allow more for click tracking
      message: "Too many product click requests. Please try again later.",
    },
    {
      useShop: true,
      namespace: "product-click",
    }
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse request body
    const body = await request.json();
    const { shop, productId, productHandle, productTitle, sessionId } = body;

    // Validate required fields
    if (!shop || !productId) {
      logger.warn({ shop, productId }, "Missing required fields");
      return json(
        { error: "Missing required fields: shop and productId" },
        { status: 400 }
      );
    }

    // Log the product click for debugging
    logger.info({
      shop,
      productId,
      productTitle,
      productHandle,
      sessionId: sessionId ? `${sessionId.substring(0, 10)}...` : undefined,
    }, "Product click tracked");

    // Update analytics with the product click (including title for display)
    await personalizationService.updateAnalytics(shop, {
      productClicked: productId,
      productTitle: productTitle, // ✅ FIX: Pass product title for better analytics
    });

    // Return success response with CORS headers
    const corsHeaders = getSecureCorsHeaders(request);
    return json(
      { success: true, message: "Product click tracked successfully" },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    logError(error, "Error tracking product click", {
      url: request.url,
    });

    const corsHeaders = getSecureCorsHeaders(request);
    return json(
      { error: "Failed to track product click", details: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};

// Handle OPTIONS request for CORS preflight
export const loader = async ({ request }: { request: Request }) => {
  if (request.method === "OPTIONS") {
    const corsHeaders = getSecureCorsHeaders(request);
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // GET requests not allowed
  return json({ error: "Method not allowed. Use POST to track clicks." }, { status: 405 });
};
