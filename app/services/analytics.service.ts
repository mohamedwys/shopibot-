import { prisma as db } from "../db.server";
import { logError, createLogger } from '../lib/logger.server';

export interface AnalyticsOverview {
  totalSessions: number;
  totalMessages: number;
  avgResponseTime: number;
  avgConfidence: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  periodComparison: {
    sessionsChange: number;
    messagesChange: number;
    confidenceChange: number;
  };
}

export interface IntentDistribution {
  intent: string;
  count: number;
  percentage: number;
}

export interface SentimentData {
  sentiment: string;
  count: number;
  percentage: number;
}

export interface TopProduct {
  productId: string;
  clicks: number;
  title?: string;
}

export interface DailyTrend {
  date: string;
  messages: number;
  sessions: number;
  avgConfidence: number;
}

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
  days: number;
}

export class AnalyticsService {
  private logger = createLogger({ service: 'AnalyticsService' });
  /**
   * Get analytics overview for a shop
   */
  async getOverview(shop: string, period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    try {
      // Get current period data
      const currentData = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      // Enhanced logging for debugging
      this.logger.debug({
        shop,
        periodStart: period.startDate.toISOString(),
        periodEnd: period.endDate.toISOString(),
        recordsFound: currentData.length,
      }, 'Fetching analytics overview');

      // Calculate previous period for comparison
      const periodLength = period.endDate.getTime() - period.startDate.getTime();
      const previousStartDate = new Date(period.startDate.getTime() - periodLength);
      const previousEndDate = new Date(period.endDate.getTime() - periodLength);

      const previousData = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
        },
      });

      // Aggregate current period
      const totalSessions = currentData.reduce((sum: any, d: any) => sum + d.totalSessions, 0);
      const totalMessages = currentData.reduce((sum: any, d: any) => sum + d.totalMessages, 0);
      const avgResponseTime = currentData.length > 0
        ? currentData.reduce((sum: any, d: any) => sum + d.avgResponseTime, 0) / currentData.length
        : 0;
      const avgConfidence = currentData.length > 0
        ? currentData.reduce((sum: any, d: any) => sum + d.avgConfidence, 0) / currentData.length
        : 0;

      // FIX: Aggregate sentiment breakdown for overview
      const sentimentCounts: Record<string, number> = {
        positive: 0,
        neutral: 0,
        negative: 0,
      };

      currentData.forEach((record: any) => {
        try {
          const sentiments = JSON.parse(record.sentimentBreakdown || '{}');
          Object.entries(sentiments).forEach(([sentiment, count]) => {
            const normalizedSentiment = sentiment.toLowerCase();
            if (normalizedSentiment in sentimentCounts) {
              sentimentCounts[normalizedSentiment] += count as number;
            }
          });
        } catch (error) {
          // Skip malformed sentiment data
          this.logger.debug('Skipping malformed sentiment data');
        }
      });

      // Aggregate previous period
      const prevTotalSessions = previousData.reduce((sum: any, d: any) => sum + d.totalSessions, 0);
      const prevTotalMessages = previousData.reduce((sum: any, d: any) => sum + d.totalMessages, 0);
      const prevAvgConfidence = previousData.length > 0
        ? previousData.reduce((sum: any, d: any) => sum + d.avgConfidence, 0) / previousData.length
        : 0;

      // Calculate percentage changes
      const sessionsChange = prevTotalSessions > 0
        ? ((totalSessions - prevTotalSessions) / prevTotalSessions) * 100
        : 0;
      const messagesChange = prevTotalMessages > 0
        ? ((totalMessages - prevTotalMessages) / prevTotalMessages) * 100
        : 0;
      const confidenceChange = prevAvgConfidence > 0
        ? ((avgConfidence - prevAvgConfidence) / prevAvgConfidence) * 100
        : 0;

      return {
        totalSessions,
        totalMessages,
        avgResponseTime: Math.round(avgResponseTime),
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        sentimentBreakdown: {
          positive: sentimentCounts.positive,
          neutral: sentimentCounts.neutral,
          negative: sentimentCounts.negative,
        },
        periodComparison: {
          sessionsChange: Math.round(sessionsChange * 10) / 10,
          messagesChange: Math.round(messagesChange * 10) / 10,
          confidenceChange: Math.round(confidenceChange * 10) / 10,
        },
      };
    } catch (error: any) {
      logError(error, 'Error getting analytics overview');
      return {
        totalSessions: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        avgConfidence: 0,
        sentimentBreakdown: {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
        periodComparison: {
          sessionsChange: 0,
          messagesChange: 0,
          confidenceChange: 0,
        },
      };
    }
  }

  /**
   * Get intent distribution
   */
  async getIntentDistribution(shop: string, period: AnalyticsPeriod): Promise<IntentDistribution[]> {
    try {
      const data = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      // Aggregate all intents
      const intentCounts: Record<string, number> = {};
      let totalIntents = 0;

      data.forEach((record: any) => {
        try {
          // FIX: Add fallback for empty/null values
          const intents = JSON.parse(record.topIntents || '{}');
          Object.entries(intents).forEach(([intent, count]) => {
            intentCounts[intent] = (intentCounts[intent] || 0) + (count as number);
            totalIntents += count as number;
          });
        } catch (error) {
          // Skip malformed intent data
          this.logger.debug('Skipping malformed intent data');
        }
      });

      // Convert to array and calculate percentages
      const distribution = Object.entries(intentCounts)
        .map(([intent, count]) => ({
          intent,
          count,
          percentage: totalIntents > 0 ? Math.round((count / totalIntents) * 100 * 10) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return distribution;
    } catch (error: any) {
      logError(error, 'Error getting intent distribution');
      return [];
    }
  }

  /**
   * Get sentiment breakdown
   */
  async getSentimentBreakdown(shop: string, period: AnalyticsPeriod): Promise<SentimentData[]> {
    try {
      const data = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      // Aggregate sentiments
      const sentimentCounts: Record<string, number> = {};
      let totalSentiments = 0;

      data.forEach((record: any) => {
        try {
          // FIX: Add fallback for empty/null values
          const sentiments = JSON.parse(record.sentimentBreakdown || '{}');
          Object.entries(sentiments).forEach(([sentiment, count]) => {
            sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + (count as number);
            totalSentiments += count as number;
          });
        } catch (error) {
          // Skip malformed sentiment data
          this.logger.debug('Skipping malformed sentiment data');
        }
      });

      // Convert to array with percentages
      const breakdown = Object.entries(sentimentCounts)
        .map(([sentiment, count]) => ({
          sentiment: sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
          count,
          percentage: totalSentiments > 0 ? Math.round((count / totalSentiments) * 100 * 10) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return breakdown;
    } catch (error: any) {
      logError(error, 'Error getting sentiment breakdown');
      return [];
    }
  }

  /**
   * Get workflow usage breakdown (default vs custom)
   */
  async getWorkflowUsage(shop: string, period: AnalyticsPeriod): Promise<{ workflow: string; count: number; percentage: number }[]> {
    try {
      const data = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      // Aggregate workflow usage
      const workflowCounts: Record<string, number> = {};
      let totalWorkflows = 0;

      data.forEach((record: any) => {
        const workflows = JSON.parse(record.workflowUsage || '{}');
        Object.entries(workflows).forEach(([workflow, count]) => {
          workflowCounts[workflow] = (workflowCounts[workflow] || 0) + (count as number);
          totalWorkflows += count as number;
        });
      });

      // Convert to array with percentages
      const breakdown = Object.entries(workflowCounts)
        .map(([workflow, count]) => ({
          workflow: workflow.charAt(0).toUpperCase() + workflow.slice(1),
          count,
          percentage: totalWorkflows > 0 ? Math.round((count / totalWorkflows) * 100 * 10) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return breakdown;
    } catch (error: any) {
      logError(error, 'Error getting workflow usage');
      return [];
    }
  }

  /**
   * Get top clicked products
   */
  async getTopProducts(shop: string, period: AnalyticsPeriod, limit: number = 10): Promise<TopProduct[]> {
    try {
      const data = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      // Aggregate product clicks
      const productClicks: Record<string, number> = {};

      data.forEach((record: any) => {
        try {
          // FIX: Add fallback for empty/null values
          const products = JSON.parse(record.topProducts || '{}');
          Object.entries(products).forEach(([productKey, clicks]) => {
            productClicks[productKey] = (productClicks[productKey] || 0) + (clicks as number);
          });
        } catch (error) {
          // Skip malformed product data
          this.logger.debug('Skipping malformed product data');
        }
      });

      // Convert to array and sort
      // ✅ FIX: Extract product title from stored key (format: "productId|||productTitle")
      const topProducts = Object.entries(productClicks)
        .map(([productKey, clicks]) => {
          // Split by separator to extract ID and title
          const parts = productKey.split('|||');
          const productId = parts[0];
          const title = parts[1] || undefined; // Extract title if present

          return {
            productId,
            clicks,
            title, // Include title for display in dashboard
          };
        })
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, limit);

      return topProducts;
    } catch (error: any) {
      logError(error, 'Error getting top products');
      return [];
    }
  }

  /**
   * Get daily trends
   */
  async getDailyTrends(shop: string, period: AnalyticsPeriod): Promise<DailyTrend[]> {
    try {
      const data = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      return data.map((record: any) => ({
        date: record.date.toISOString().split('T')[0],
        messages: record.totalMessages,
        sessions: record.totalSessions,
        avgConfidence: Math.round(record.avgConfidence * 100) / 100,
      }));
    } catch (error: any) {
      logError(error, 'Error getting daily trends');
      return [];
    }
  }

  /**
   * Get user engagement metrics
   * FIX: Use aggregated ChatAnalytics data for better performance and accuracy
   */
  async getUserEngagement(shop: string, period: AnalyticsPeriod) {
    try {
      // FIX: Use aggregated analytics data instead of raw queries
      const analyticsData = await db.chatAnalytics.findMany({
        where: {
          shop,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      // Enhanced logging
      this.logger.debug({
        shop,
        periodStart: period.startDate.toISOString(),
        periodEnd: period.endDate.toISOString(),
        analyticsRecords: analyticsData.length,
      }, 'Calculating user engagement');

      // Aggregate totals from ChatAnalytics records
      const totalSessions = analyticsData.reduce((sum, record) => sum + record.totalSessions, 0);
      const totalMessages = analyticsData.reduce((sum, record) => sum + record.totalMessages, 0);
      const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

      // FIX: Also query sessions with messages in the period for session duration
      // This covers sessions created before the period but active during it
      const sessionsWithMessages = await db.chatSession.findMany({
        where: {
          shop,
          messages: {
            some: {
              timestamp: {
                gte: period.startDate,
                lte: period.endDate,
              },
            },
          },
        },
        include: {
          messages: {
            where: {
              timestamp: {
                gte: period.startDate,
                lte: period.endDate,
              },
            },
            orderBy: {
              timestamp: 'asc',
            },
          },
        },
      });

      // Calculate session duration (time between first and last message in period)
      const sessionDurations = sessionsWithMessages
        .filter(s => s.messages.length >= 2)
        .map(s => {
          const firstMsg = s.messages[0].timestamp;
          const lastMsg = s.messages[s.messages.length - 1].timestamp;
          return (lastMsg.getTime() - firstMsg.getTime()) / 1000; // in seconds
        });

      const avgSessionDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length
        : 0;

      this.logger.debug({
        totalSessions,
        totalMessages,
        avgMessagesPerSession,
        avgSessionDuration,
        sessionsWithDuration: sessionDurations.length,
      }, 'User engagement calculated');

      return {
        totalSessions,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        avgSessionDuration: Math.round(avgSessionDuration), // seconds
      };
    } catch (error: any) {
      logError(error, 'Error getting user engagement');
      return {
        totalSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        avgSessionDuration: 0,
      };
    }
  }

  /**
   * Get active users count
   * FIX: Count users who had chat activity during the period
   */
  async getActiveUsers(shop: string, period: AnalyticsPeriod) {
    try {
      // FIX: Count distinct users who had messages during the period
      // This is more accurate than relying on updatedAt
      const activeUserProfiles = await db.userProfile.findMany({
        where: {
          shop,
          chatSessions: {
            some: {
              messages: {
                some: {
                  timestamp: {
                    gte: period.startDate,
                    lte: period.endDate,
                  },
                },
              },
            },
          },
        },
        select: {
          id: true, // Only select ID for efficiency
        },
      });

      const uniqueUsers = activeUserProfiles.length;

      this.logger.debug({
        shop,
        periodStart: period.startDate.toISOString(),
        periodEnd: period.endDate.toISOString(),
        activeUsers: uniqueUsers,
      }, 'Active users calculated');

      return uniqueUsers;
    } catch (error: any) {
      logError(error, 'Error getting active users');
      return 0;
    }
  }

  /**
   * Export analytics data as CSV
   */
  async exportToCSV(shop: string, period: AnalyticsPeriod): Promise<string> {
    try {
      const trends = await this.getDailyTrends(shop, period);

      // CSV Header
      let csv = 'Date,Messages,Sessions,Avg Confidence\n';

      // CSV Data
      trends.forEach(trend => {
        csv += `${trend.date},${trend.messages},${trend.sessions},${trend.avgConfidence}\n`;
      });

      return csv;
    } catch (error: any) {
      logError(error, 'Error exporting CSV');
      return '';
    }
  }

  /**
   * Helper: Get period from preset
   */
  static getPeriodFromPreset(preset: string): AnalyticsPeriod {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    let startDate = new Date();
    let days = 0;

    switch (preset) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        days = 1;
        break;
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        days = 7;
        break;
      case 'month':
        startDate.setDate(endDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        days = 30;
        break;
      case 'quarter':
        startDate.setDate(endDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        days = 90;
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        days = 7;
    }

    return { startDate, endDate, days };
  }
}

export const analyticsService = new AnalyticsService();
