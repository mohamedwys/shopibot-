/**
 * Debug endpoint to check plan configuration for a shop
 * Usage: GET /api/debug-plan?shop=<shop-domain>
 */

import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma as db } from "../db.server";
import { normalizePlanCode, getPlanLimits, getPlanConfig } from "../lib/plans.config";
import { getConversationUsage } from "../lib/conversation-usage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ✅ SECURITY FIX: Block access to debug API in production
  if (process.env.NODE_ENV === 'production') {
    return json({ error: "Not Found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  try {
    // Get raw database value
    const settings = await db.widgetSettings.findUnique({
      where: { shop },
      select: {
        shop: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!settings) {
      return json({ error: `No settings found for shop: ${shop}` }, { status: 404 });
    }

    // Normalize and get config
    const normalizedPlan = normalizePlanCode(settings.plan);
    const planConfig = getPlanConfig(normalizedPlan);
    const planLimits = getPlanLimits(normalizedPlan);

    // Get conversation usage
    const conversationUsage = await getConversationUsage(shop);

    // Get conversation count for current month
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    const conversationCount = await db.conversation.count({
      where: {
        shop,
        timestamp: {
          gte: monthStart,
          lt: monthEnd
        }
      }
    });

    return json({
      shop: settings.shop,
      debug: {
        rawDatabasePlan: settings.plan,
        normalizedPlan: normalizedPlan,
        planType: typeof settings.plan,
        isNull: settings.plan === null,
        isEmpty: settings.plan === "",
        updatedAt: settings.updatedAt,
      },
      planConfig: {
        code: planConfig.code,
        displayName: planConfig.displayName,
        billingName: planConfig.billingName,
        price: planConfig.price,
      },
      planLimits: {
        maxConversations: planLimits.maxConversations,
        isInfinity: planLimits.maxConversations === Infinity,
        hasCustomWebhook: planLimits.hasCustomWebhook,
      },
      conversationUsage: {
        used: conversationUsage.used,
        limit: conversationUsage.limit,
        isUnlimited: conversationUsage.isUnlimited,
        percentUsed: conversationUsage.percentUsed,
        currentPlan: conversationUsage.currentPlan,
      },
      directCount: {
        count: conversationCount,
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
      },
      diagnosis: {
        expectedBehavior: planConfig.code === 'STARTER'
          ? 'Should show "21 / 1,000" with usage bar'
          : 'Should show "✓ Unlimited" badge',
        actualIsUnlimited: conversationUsage.isUnlimited,
        bugDetected: planConfig.code === 'STARTER' && conversationUsage.isUnlimited === true,
      }
    }, {
      headers: {
        "Content-Type": "application/json",
      }
    });

  } catch (error) {
    console.error("Debug plan error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
};
