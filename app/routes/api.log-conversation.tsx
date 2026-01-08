/**
 * API Endpoint: Log Conversation
 *
 * POST /api/log-conversation
 *
 * Logs conversation data for analytics and tracking
 * Requires X-API-Key header for authentication
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma as db } from "../db.server";
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
 * POST /api/log-conversation
 *
 * Logs a conversation exchange
 *
 * Request body:
 * {
 *   shop: string,
 *   sessionId: string,
 *   message: string,
 *   response: string,
 *   plan?: string,
 *   timestamp?: string
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Only accept POST requests
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed. Use POST." },
      { status: 405 }
    );
  }

  // Verify API key authentication
  if (!verifyApiKey(request)) {
    logger.warn({
      url: request.url,
      method: request.method
    }, "Unauthorized API request - invalid or missing X-API-Key");

    return json(
      { error: "Unauthorized. Valid X-API-Key header required." },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": "X-API-Key"
        }
      }
    );
  }

  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    const { shop, sessionId, message, response, plan, timestamp } = body;

    if (!shop || typeof shop !== "string") {
      return json(
        { error: "Missing or invalid 'shop' field" },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== "string") {
      return json(
        { error: "Missing or invalid 'sessionId' field" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string") {
      return json(
        { error: "Missing or invalid 'message' field" },
        { status: 400 }
      );
    }

    if (!response || typeof response !== "string") {
      return json(
        { error: "Missing or invalid 'response' field" },
        { status: 400 }
      );
    }

    // Parse timestamp if provided, otherwise use current time
    let conversationTimestamp: Date;
    if (timestamp) {
      conversationTimestamp = new Date(timestamp);
      if (isNaN(conversationTimestamp.getTime())) {
        return json(
          { error: "Invalid 'timestamp' format. Use ISO 8601 format." },
          { status: 400 }
        );
      }
    } else {
      conversationTimestamp = new Date();
    }

    // Create conversation log entry
    const conversation = await db.conversation.create({
      data: {
        shop,
        sessionId,
        message,
        response,
        plan: plan || "BASIC",
        timestamp: conversationTimestamp,
      }
    });

    logger.info({
      shop,
      sessionId,
      conversationId: conversation.id,
      plan: conversation.plan
    }, "Conversation logged successfully");

    return json({
      success: true,
      message: "Conversation logged successfully",
      conversationId: conversation.id,
      timestamp: conversation.timestamp.toISOString()
    }, {
      status: 201,
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, "Error logging conversation");

    // Check if it's a JSON parse error
    if (error instanceof SyntaxError) {
      return json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
