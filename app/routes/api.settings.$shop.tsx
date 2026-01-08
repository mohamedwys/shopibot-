/**
 * API Endpoint: Get Settings for a Shop
 *
 * GET /api/settings/:shop
 *
 * Returns widget settings for a specific shop, including decrypted OpenAI API key
 * Requires X-API-Key header for authentication
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma as db } from "../db.server";
import { decryptApiKey } from "../lib/encryption.server";
import { logger } from "../lib/logger.server";

/**
 * Verify API key from request headers
 */
function verifyApiKey(request: Request): boolean {
  const apiKey = request.headers.get("X-API-Key");
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
    logger.error("INTERNAL_API_KEY environment variable is not set");
    return false;
  }

  return apiKey === internalApiKey;
}

/**
 * GET /api/settings/:shop
 *
 * Returns settings for a specific shop
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // Verify API key authentication
  if (!verifyApiKey(request)) {
    logger.warn({
      url: request.url,
      shop: params.shop
    }, "Unauthorized API request - invalid or missing X-API-Key");

    return json(
      { error: "Unauthorized. Valid X-API-Key header required." },
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "X-API-Key"
        }
      }
    );
  }

  const shop = params.shop;

  if (!shop) {
    return json(
      { error: "Shop parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch settings from database
    const settings = await db.widgetSettings.findUnique({
      where: { shop: shop },
      select: {
        shop: true,
        chatTitle: true,
        welcomeMessage: true,
        plan: true,
        openaiApiKey: true,
      }
    });

    if (!settings) {
      logger.info({ shop }, "Settings not found for shop");
      return json(
        { error: "Shop not found" },
        { status: 404 }
      );
    }

    // Decrypt OpenAI API key if it exists
    let decryptedApiKey: string | null = null;
    if ((settings as any).openaiApiKey) {
      try {
        decryptedApiKey = decryptApiKey((settings as any).openaiApiKey);
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          shop
        }, "Failed to decrypt OpenAI API key");
        // Return null if decryption fails
        decryptedApiKey = null;
      }
    }

    // Return settings with decrypted API key
    const response = {
      shop: settings.shop,
      chatTitle: settings.chatTitle,
      welcomeMessage: settings.welcomeMessage,
      plan: (settings as any).plan || "BASIC",
      openaiApiKey: decryptedApiKey,
    };

    logger.info({
      shop,
      plan: response.plan,
      hasApiKey: !!decryptedApiKey
    }, "Settings retrieved successfully");

    return json(response, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60" // Cache for 1 minute
      }
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shop
    }, "Error retrieving settings");

    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
