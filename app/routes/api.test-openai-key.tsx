import { json, type ActionFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { prisma as db } from "../db.server";
import { encryptApiKey, isValidOpenAIKey } from "../lib/encryption.server";

/**
 * API endpoint to test OpenAI API key validity
 * POST /api/test-openai-key
 *
 * Body: { shop: string, apiKey: string }
 * Returns: { valid: boolean, message: string, details?: any }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { shop, apiKey } = body;

    // Validation
    if (!shop || typeof shop !== "string") {
      return json({
        valid: false,
        message: "Shop parameter is required and must be a string"
      }, { status: 400 });
    }

    if (!apiKey || typeof apiKey !== "string") {
      return json({
        valid: false,
        message: "API key is required and must be a string"
      }, { status: 400 });
    }

    // Basic format validation
    if (!isValidOpenAIKey(apiKey)) {
      return json({
        valid: false,
        message: "Invalid API key format. Key should start with 'sk-' or 'sk-proj-' and be at least 20 characters long."
      }, { status: 400 });
    }

    // Test the API key by making a simple request to OpenAI
    logger.info({ shop }, "Testing OpenAI API key");

    const testResponse = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const now = new Date();

    if (testResponse.ok) {
      // API key is valid
      logger.info({ shop, status: testResponse.status }, "✅ OpenAI API key is valid");

      // Update the database with test results
      try {
        await db.widgetSettings.update({
          where: { shop },
          data: {
            apiKeyLastTested: now,
            apiKeyStatus: "valid"
          }
        });
      } catch (dbError) {
        logger.error({ error: dbError, shop }, "Failed to update API key test status in database");
        // Don't fail the request if DB update fails
      }

      return json({
        valid: true,
        message: "API key is valid and working correctly",
        details: {
          testedAt: now.toISOString(),
          status: "valid"
        }
      });
    } else {
      // API key is invalid
      const errorData = await testResponse.json().catch(() => ({}));

      logger.warn({
        shop,
        status: testResponse.status,
        error: errorData
      }, "❌ OpenAI API key validation failed");

      // Update the database with test results
      try {
        await db.widgetSettings.update({
          where: { shop },
          data: {
            apiKeyLastTested: now,
            apiKeyStatus: "invalid"
          }
        });
      } catch (dbError) {
        logger.error({ error: dbError, shop }, "Failed to update API key test status in database");
      }

      // Determine error message based on status code
      let message = "API key validation failed";
      if (testResponse.status === 401) {
        message = "Invalid API key. Please check that you've entered the correct key from OpenAI.";
      } else if (testResponse.status === 403) {
        message = "API key is valid but doesn't have permission to access models. Please check your OpenAI account.";
      } else if (testResponse.status === 429) {
        message = "Rate limit exceeded. Your API key is valid but has too many requests. Please try again later.";
      } else if (testResponse.status >= 500) {
        message = "OpenAI service is currently unavailable. Please try again later.";
      }

      return json({
        valid: false,
        message,
        details: {
          testedAt: now.toISOString(),
          status: "invalid",
          statusCode: testResponse.status,
          error: errorData
        }
      }, { status: 400 });
    }
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, "Error testing OpenAI API key");

    return json({
      valid: false,
      message: "An error occurred while testing the API key. Please try again.",
      details: {
        error: error.message
      }
    }, { status: 500 });
  }
};
