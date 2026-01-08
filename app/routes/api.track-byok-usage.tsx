import { json, type ActionFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { prisma as db } from "../db.server";

/**
 * API endpoint to track BYOK usage (API calls, tokens, costs)
 * POST /api/track-byok-usage
 *
 * Body: {
 *   shop: string,
 *   promptTokens: number,
 *   completionTokens: number,
 *   totalTokens: number,
 *   model: string
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { shop, promptTokens, completionTokens, totalTokens, model } = body;

    // Validation
    if (!shop || typeof shop !== "string") {
      return json({
        error: "Shop parameter is required and must be a string"
      }, { status: 400 });
    }

    if (typeof promptTokens !== "number" || typeof completionTokens !== "number") {
      return json({
        error: "Token counts must be numbers"
      }, { status: 400 });
    }

    // Calculate estimated cost based on model
    // Prices per 1M tokens for gpt-4o-mini (as of 2024)
    const PRICING: Record<string, { prompt: number; completion: number }> = {
      "gpt-4o-mini": { prompt: 0.15, completion: 0.60 },  // $0.15/$0.60 per 1M tokens
      "gpt-4o": { prompt: 2.50, completion: 10.00 },      // $2.50/$10.00 per 1M tokens
      "gpt-4": { prompt: 30.00, completion: 60.00 },      // $30/$60 per 1M tokens
      "gpt-3.5-turbo": { prompt: 0.50, completion: 1.50 }, // $0.50/$1.50 per 1M tokens
    };

    const pricing = PRICING[model] || PRICING["gpt-4o-mini"]; // Default to gpt-4o-mini pricing
    const estimatedCost = (
      (promptTokens / 1_000_000) * pricing.prompt +
      (completionTokens / 1_000_000) * pricing.completion
    );

    // Get today's date at midnight (for aggregation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    logger.info({
      shop,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      model
    }, "Tracking BYOK usage");

    // Update or create usage record for today
    const usage = await db.byokUsage.upsert({
      where: {
        shop_date: {
          shop,
          date: today
        }
      },
      update: {
        totalApiCalls: {
          increment: 1
        },
        totalTokensUsed: {
          increment: totalTokens
        },
        promptTokens: {
          increment: promptTokens
        },
        completionTokens: {
          increment: completionTokens
        },
        estimatedCost: {
          increment: estimatedCost
        }
      },
      create: {
        shop,
        date: today,
        totalApiCalls: 1,
        totalTokensUsed: totalTokens,
        promptTokens,
        completionTokens,
        estimatedCost,
        plan: "BYOK"
      }
    });

    logger.info({ shop, usageId: usage.id }, "✅ BYOK usage tracked successfully");

    return json({
      success: true,
      message: "Usage tracked successfully",
      usage: {
        totalApiCalls: usage.totalApiCalls,
        totalTokensUsed: usage.totalTokensUsed,
        estimatedCost: usage.estimatedCost
      }
    });
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, "Error tracking BYOK usage");

    return json({
      error: "Failed to track usage",
      details: error.message
    }, { status: 500 });
  }
};
