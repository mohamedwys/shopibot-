import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { prisma as db } from "../db.server";

/**
 * API endpoint to get BYOK usage statistics for a shop
 * GET /api/byok-usage?shop=example.myshopify.com
 *
 * Returns: {
 *   today: { totalApiCalls, totalTokensUsed, estimatedCost },
 *   thisMonth: { totalApiCalls, totalTokensUsed, estimatedCost }
 * }
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop query parameter is required" }, { status: 400 });
  }

  try {
    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await db.byokUsage.findUnique({
      where: {
        shop_date: {
          shop,
          date: today
        }
      }
    });

    // Get this month's usage (aggregate all days in current month)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthUsages = await db.byokUsage.findMany({
      where: {
        shop,
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    // Aggregate monthly totals
    const monthTotals = monthUsages.reduce(
      (acc, usage) => ({
        totalApiCalls: acc.totalApiCalls + usage.totalApiCalls,
        totalTokensUsed: acc.totalTokensUsed + usage.totalTokensUsed,
        estimatedCost: acc.estimatedCost + usage.estimatedCost
      }),
      { totalApiCalls: 0, totalTokensUsed: 0, estimatedCost: 0 }
    );

    logger.info({ shop, todayCount: todayUsage?.totalApiCalls || 0, monthCount: monthTotals.totalApiCalls }, "Retrieved BYOK usage");

    return json({
      today: {
        totalApiCalls: todayUsage?.totalApiCalls || 0,
        totalTokensUsed: todayUsage?.totalTokensUsed || 0,
        estimatedCost: todayUsage?.estimatedCost || 0,
        promptTokens: todayUsage?.promptTokens || 0,
        completionTokens: todayUsage?.completionTokens || 0
      },
      thisMonth: {
        totalApiCalls: monthTotals.totalApiCalls,
        totalTokensUsed: monthTotals.totalTokensUsed,
        estimatedCost: monthTotals.estimatedCost
      }
    });
  } catch (error: any) {
    logger.error({
      error: error.message,
      shop
    }, "Error retrieving BYOK usage");

    return json({
      error: "Failed to retrieve usage data",
      details: error.message
    }, { status: 500 });
  }
};
