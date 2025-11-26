import db from '../db.server';

export interface AnalyticsOverview {
  totalSessions: number;
  totalMessages: number;
  avgResponseTime: number;
  avgConfidence: number;
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
      const totalSessions = currentData.reduce((sum, d) => sum + d.totalSessions, 0);
      const totalMessages = currentData.reduce((sum, d) => sum + d.totalMessages, 0);
      const avgResponseTime = currentData.length > 0
        ? currentData.reduce((sum, d) => sum + d.avgResponseTime, 0) / currentData.length
        : 0;
      const avgConfidence = currentData.length > 0
        ? currentData.reduce((sum, d) => sum + d.avgConfidence, 0) / currentData.length
        : 0;

      // Aggregate previous period
      const prevTotalSessions = previousData.reduce((sum, d) => sum + d.totalSessions, 0);
      const prevTotalMessages = previousData.reduce((sum, d) => sum + d.totalMessages, 0);
      const prevAvgConfidence = previousData.length > 0
        ? previousData.reduce((sum, d) => sum + d.avgConfidence, 0) / previousData.length
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
        periodComparison: {
          sessionsChange: Math.round(sessionsChange * 10) / 10,
          messagesChange: Math.round(messagesChange * 10) / 10,
          confidenceChange: Math.round(confidenceChange * 10) / 10,
        },
      };
    } catch (error: any) {
      console.error('❌ Error getting analytics overview:', error.message);
      return {
        totalSessions: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        avgConfidence: 0,
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

      data.forEach(record => {
        const intents = JSON.parse(record.topIntents);
        Object.entries(intents).forEach(([intent, count]) => {
          intentCounts[intent] = (intentCounts[intent] || 0) + (count as number);
          totalIntents += count as number;
        });
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
      console.error('❌ Error getting intent distribution:', error.message);
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

      data.forEach(record => {
        const sentiments = JSON.parse(record.sentimentBreakdown);
        Object.entries(sentiments).forEach(([sentiment, count]) => {
          sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + (count as number);
          totalSentiments += count as number;
        });
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
      console.error('❌ Error getting sentiment breakdown:', error.message);
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

      data.forEach(record => {
        const products = JSON.parse(record.topProducts);
        Object.entries(products).forEach(([productId, clicks]) => {
          productClicks[productId] = (productClicks[productId] || 0) + (clicks as number);
        });
      });

      // Convert to array and sort
      const topProducts = Object.entries(productClicks)
        .map(([productId, clicks]) => ({
          productId,
          clicks,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, limit);

      return topProducts;
    } catch (error: any) {
      console.error('❌ Error getting top products:', error.message);
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

      return data.map(record => ({
        date: record.date.toISOString().split('T')[0],
        messages: record.totalMessages,
        sessions: record.totalSessions,
        avgConfidence: Math.round(record.avgConfidence * 100) / 100,
      }));
    } catch (error: any) {
      console.error('❌ Error getting daily trends:', error.message);
      return [];
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(shop: string, period: AnalyticsPeriod) {
    try {
      const sessions = await db.chatSession.findMany({
        where: {
          shop,
          createdAt: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
        include: {
          messages: true,
        },
      });

      const totalSessions = sessions.length;
      const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
      const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

      // Calculate session duration (time between first and last message)
      const sessionDurations = sessions
        .filter(s => s.messages.length >= 2)
        .map(s => {
          const firstMsg = s.messages[0].timestamp;
          const lastMsg = s.messages[s.messages.length - 1].timestamp;
          return (lastMsg.getTime() - firstMsg.getTime()) / 1000; // in seconds
        });

      const avgSessionDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length
        : 0;

      return {
        totalSessions,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        avgSessionDuration: Math.round(avgSessionDuration), // seconds
      };
    } catch (error: any) {
      console.error('❌ Error getting user engagement:', error.message);
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
   */
  async getActiveUsers(shop: string, period: AnalyticsPeriod) {
    try {
      const uniqueUsers = await db.userProfile.count({
        where: {
          shop,
          updatedAt: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      return uniqueUsers;
    } catch (error: any) {
      console.error('❌ Error getting active users:', error.message);
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
      console.error('❌ Error exporting CSV:', error.message);
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
