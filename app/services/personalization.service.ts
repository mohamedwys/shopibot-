import { OpenAI } from 'openai';
import { prisma as db } from "../db.server";
import { logError, createLogger } from '../lib/logger.server';

export interface UserPreferences {
  favoriteColors?: string[];
  priceRange?: { min: number; max: number };
  favoriteCategories?: string[];
  styles?: string[];
  interests?: string[];
}

export interface InteractionData {
  type: 'view' | 'click' | 'add_to_cart' | 'purchase' | 'message';
  productId?: string;
  message?: string;
  timestamp: number;
}

export interface PersonalizationContext {
  userProfile: any;
  recentProducts: string[];
  preferences: UserPreferences;
  sentiment: 'positive' | 'neutral' | 'negative';
  intent?: string;
}

export class PersonalizationService {
  private openai: OpenAI | null = null;
  private logger = createLogger({ service: 'PersonalizationService' });

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.info('Initialized with OpenAI');
    } else {
      this.logger.warn('OPENAI_API_KEY not set - advanced features disabled');
    }
  }

  /**
   * Get or create user profile
   */
  async getOrCreateUserProfile(
    shop: string,
    sessionId: string,
    customerId?: string
  ): Promise<any> {
    try {
      // Try to find existing profile
      let profile = await db.userProfile.findUnique({
        where: {
          shop_sessionId: { shop, sessionId },
        },
        include: {
          chatSessions: {
            orderBy: { lastMessageAt: 'desc' },
            take: 1,
          },
        },
      });

      // Create if doesn't exist
      if (!profile) {
        profile = await db.userProfile.create({
          data: {
            shop,
            sessionId,
            customerId,
            preferences: JSON.stringify({}),
            browsingHistory: JSON.stringify([]),
            purchaseHistory: JSON.stringify([]),
            interactions: JSON.stringify([]),
          },
          include: {
            chatSessions: true,
          },
        });

        this.logger.debug({ sessionId }, 'Created user profile');
      }

      return profile;
    } catch (error) {
      logError(error, 'Error getting/creating user profile');
      throw error;
    }
  }

  /**
   * Get or create chat session
   */
  async getOrCreateChatSession(shop: string, userProfileId: string): Promise<any> {
    try {
      // Get most recent session
      const recentSession = await db.chatSession.findFirst({
        where: {
          shop,
          userProfileId,
        },
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      // If recent session exists and is less than 1 hour old, reuse it
      if (recentSession) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (recentSession.lastMessageAt > hourAgo) {
          this.logger.debug({ sessionId: recentSession.id }, 'Reusing existing session');
          return recentSession;
        }
      }

      // Create new session
      const newSession = await db.chatSession.create({
        data: {
          shop,
          userProfileId,
          context: JSON.stringify({}),
        },
        include: {
          messages: true,
        },
      });

      this.logger.debug({ sessionId: newSession.id }, 'Created chat session');
      return newSession;
    } catch (error) {
      logError(error, 'Error getting/creating chat session');
      throw error;
    }
  }

  /**
   * Track user interaction
   */
  async trackInteraction(
    userProfileId: string,
    interaction: InteractionData
  ): Promise<void> {
    try {
      const profile = await db.userProfile.findUnique({
        where: { id: userProfileId },
      });

      if (!profile) {
        this.logger.warn({ userProfileId }, 'User profile not found');
        return;
      }

      const interactions = JSON.parse(profile.interactions);
      interactions.push(interaction);

      // Keep only last 100 interactions
      const recentInteractions = interactions.slice(-100);

      await db.userProfile.update({
        where: { id: userProfileId },
        data: {
          interactions: JSON.stringify(recentInteractions),
          updatedAt: new Date(),
        },
      });

      this.logger.debug({ userProfileId, type: interaction.type }, 'Tracked interaction');
    } catch (error) {
      logError(error, 'Error tracking interaction');
    }
  }

  /**
   * Update browsing history
   */
  async updateBrowsingHistory(
    userProfileId: string,
    productId: string
  ): Promise<void> {
    try {
      const profile = await db.userProfile.findUnique({
        where: { id: userProfileId },
      });

      if (!profile) return;

      const history = JSON.parse(profile.browsingHistory);

      // Add to beginning, remove duplicates
      const updatedHistory = [
        productId,
        ...history.filter((id: string) => id !== productId),
      ].slice(0, 50); // Keep last 50

      await db.userProfile.update({
        where: { id: userProfileId },
        data: {
          browsingHistory: JSON.stringify(updatedHistory),
        },
      });

      this.logger.debug({ userProfileId }, 'Updated browsing history');
    } catch (error) {
      logError(error, 'Error updating browsing history');
    }
  }

  /**
   * Learn preferences from user messages and interactions
   */
  async learnPreferences(
    userProfileId: string,
    message: string,
    _productsShown: string[] // Reserved for future use - will help correlate preferences with shown products
  ): Promise<void> {
    try {
      if (!this.openai) {
        this.logger.debug('Skipping preference learning - no OpenAI key');
        return;
      }

      const profile = await db.userProfile.findUnique({
        where: { id: userProfileId },
      });

      if (!profile) return;

      const currentPrefs = JSON.parse(profile.preferences) as UserPreferences;

      // Use OpenAI to extract preferences from message
      const extractionPrompt = `
Analyze this customer message and extract shopping preferences:

Message: "${message}"

Extract any mentions of:
1. Colors (e.g., "red", "blue", "dark colors")
2. Price preferences (e.g., "under $50", "budget-friendly", "luxury")
3. Categories (e.g., "dresses", "shoes", "electronics")
4. Styles (e.g., "casual", "formal", "modern", "vintage")
5. Interests (e.g., "eco-friendly", "handmade", "tech")

Return as JSON with these optional fields:
{
  "colors": ["color1", "color2"],
  "priceRange": { "min": 0, "max": 100 },
  "categories": ["category1"],
  "styles": ["style1"],
  "interests": ["interest1"]
}

If no preferences are mentioned, return empty object {}.
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cheap for extraction
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const messageContent = response.choices[0]?.message?.content || '{}';
      const extracted = JSON.parse(messageContent);

      // Merge with existing preferences
      const updatedPrefs: UserPreferences = {
        favoriteColors: [
          ...(currentPrefs.favoriteColors || []),
          ...(extracted.colors || []),
        ].filter((v, i, a) => a.indexOf(v) === i), // Unique values

        priceRange: extracted.priceRange || currentPrefs.priceRange,

        favoriteCategories: [
          ...(currentPrefs.favoriteCategories || []),
          ...(extracted.categories || []),
        ].filter((v, i, a) => a.indexOf(v) === i),

        styles: [
          ...(currentPrefs.styles || []),
          ...(extracted.styles || []),
        ].filter((v, i, a) => a.indexOf(v) === i),

        interests: [
          ...(currentPrefs.interests || []),
          ...(extracted.interests || []),
        ].filter((v, i, a) => a.indexOf(v) === i),
      };

      await db.userProfile.update({
        where: { id: userProfileId },
        data: {
          preferences: JSON.stringify(updatedPrefs),
        },
      });

      this.logger.debug({ userProfileId, preferences: updatedPrefs }, 'Updated preferences');
    } catch (error) {
      logError(error, 'Error learning preferences');
    }
  }

  /**
   * Classify user intent from message
   */
  async classifyIntent(message: string): Promise<string> {
    try {
      // Simple regex-based classification (fast fallback)
      const patterns = {
        PRODUCT_SEARCH: /(?:looking for|need|want|show me|find|search|recommend)/i,
        PRICE_INQUIRY: /(?:how much|cost|price|expensive|cheap|budget|afford)/i,
        COMPARISON: /(?:compare|difference|better|vs|versus|which one)/i,
        AVAILABILITY: /(?:in stock|available|when|sold out|inventory)/i,
        SHIPPING: /(?:shipping|delivery|ship|arrive|tracking|when will)/i,
        RETURNS: /(?:return|refund|exchange|money back|warranty)/i,
        SIZE_FIT: /(?:size|fit|measurements|dimensions|how big|how small)/i,
        SUPPORT: /(?:help|problem|issue|broken|not working|support)/i,
        GREETING: /^(?:hi|hello|hey|good morning|good afternoon|good evening)/i,
        THANKS: /(?:thank|thanks|appreciate|grateful)/i,
      };

      for (const [intent, pattern] of Object.entries(patterns)) {
        if (pattern.test(message)) {
          this.logger.debug({ intent }, 'Intent classified');
          return intent;
        }
      }

      // If OpenAI available, use advanced classification
      if (this.openai) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Classify the customer's intent into one of these categories:
- PRODUCT_SEARCH: Looking for products
- PRICE_INQUIRY: Asking about pricing
- COMPARISON: Comparing products
- AVAILABILITY: Checking stock/availability
- SHIPPING: Asking about delivery
- RETURNS: Return/refund questions
- SIZE_FIT: Size or fit questions
- SUPPORT: Technical support
- GREETING: Greeting/starting conversation
- THANKS: Expressing gratitude
- OTHER: None of the above

Respond with just the category name.`,
            },
            {
              role: 'user',
              content: message,
            },
          ],
          temperature: 0,
        });

        const intent = response.choices[0]?.message?.content?.trim() || 'OTHER';
        this.logger.debug({ intent }, 'Intent classified by AI');
        return intent;
      }

      return 'OTHER';
    } catch (error) {
      logError(error, 'Error classifying intent');
      return 'OTHER';
    }
  }

  /**
   * Analyze sentiment of message
   */
  async analyzeSentiment(message: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
      // Simple keyword-based sentiment (fast fallback)
      const positiveWords = /(?:great|amazing|awesome|love|perfect|excellent|wonderful|happy)/i;
      const negativeWords = /(?:bad|terrible|awful|hate|disappointed|frustrated|angry|upset)/i;

      if (positiveWords.test(message)) return 'positive';
      if (negativeWords.test(message)) return 'negative';

      // Use OpenAI for better accuracy
      if (this.openai) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Analyze the sentiment of the customer message. Respond with only: positive, neutral, or negative',
            },
            {
              role: 'user',
              content: message,
            },
          ],
          temperature: 0,
        });

        const sentiment = (response.choices[0]?.message?.content?.trim()?.toLowerCase() || 'neutral') as
          | 'positive'
          | 'neutral'
          | 'negative';

        this.logger.debug({ sentiment }, 'Sentiment analyzed');
        return sentiment || 'neutral';
      }

      return 'neutral';
    } catch (error) {
      logError(error, 'Error analyzing sentiment');
      return 'neutral';
    }
  }

  /**
   * Save chat message with metadata
   */
  async saveChatMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata: {
      intent?: string;
      sentiment?: string;
      confidence?: number;
      productsShown?: string[];
    } = {}
  ): Promise<void> {
    try {
      await db.chatMessage.create({
        data: {
          sessionId,
          role,
          content,
          intent: metadata.intent,
          sentiment: metadata.sentiment,
          confidence: metadata.confidence,
          productsShown: JSON.stringify(metadata.productsShown || []),
        },
      });

      // Update session last message time
      await db.chatSession.update({
        where: { id: sessionId },
        data: { lastMessageAt: new Date() },
      });

      this.logger.debug({ role, sessionId }, 'Saved chat message');
    } catch (error) {
      logError(error, 'Error saving chat message');
    }
  }

  /**
   * Get personalization context for a user
   */
  async getPersonalizationContext(
    shop: string,
    sessionId: string,
    customerId?: string
  ): Promise<PersonalizationContext> {
    try {
      const profile = await this.getOrCreateUserProfile(shop, sessionId, customerId);

      const preferences = JSON.parse(profile.preferences) as UserPreferences;
      const browsingHistory = JSON.parse(profile.browsingHistory) as string[];

      return {
        userProfile: profile,
        recentProducts: browsingHistory.slice(0, 10),
        preferences,
        sentiment: 'neutral', // Will be updated per message
        intent: undefined,
      };
    } catch (error) {
      logError(error, 'Error getting personalization context');
      return {
        userProfile: null,
        recentProducts: [],
        preferences: {},
        sentiment: 'neutral',
      };
    }
  }

  /**
   * Update analytics
   */
  async updateAnalytics(
    shop: string,
    data: {
      intent?: string;
      sentiment?: string;
      productClicked?: string;
      productTitle?: string; // ✅ FIX: Add product title for analytics display
      responseTime?: number;
      confidence?: number;
      workflowType?: 'default' | 'custom';
      isNewSession?: boolean; // Track if this is a new session
    }
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Enhanced logging for debugging
      this.logger.debug({
        shop,
        date: today.toISOString().split('T')[0],
        isNewSession: data.isNewSession,
        intent: data.intent,
        sentiment: data.sentiment,
        workflowType: data.workflowType,
      }, 'Updating analytics');

      // Get or create analytics entry for today
      // FIX: Build update object conditionally to avoid undefined fields
      const updateData: any = {
        totalMessages: { increment: 1 },
      };

      // Only increment sessions if this is a new session
      if (data.isNewSession) {
        updateData.totalSessions = { increment: 1 };
      }

      const analytics = await db.chatAnalytics.upsert({
        where: {
          shop_date: { shop, date: today },
        },
        update: updateData,
        create: {
          shop,
          date: today,
          totalSessions: data.isNewSession ? 1 : 0, // Start with 1 if new session
          totalMessages: 1,
          avgResponseTime: 0,
          avgConfidence: 0,
          topIntents: '{}',
          topProducts: '{}',
          sentimentBreakdown: '{}',
          workflowUsage: '{}',
        } as any,
      });

      // FIX: Calculate proper averages instead of summing
      if (data.responseTime !== undefined) {
        const currentTotal = analytics.avgResponseTime * (analytics.totalMessages - 1);
        const newAvg = (currentTotal + data.responseTime) / analytics.totalMessages;

        await db.chatAnalytics.update({
          where: { id: analytics.id },
          data: { avgResponseTime: newAvg },
        });
      }

      if (data.confidence !== undefined) {
        const currentTotal = analytics.avgConfidence * (analytics.totalMessages - 1);
        const newAvg = (currentTotal + data.confidence) / analytics.totalMessages;

        await db.chatAnalytics.update({
          where: { id: analytics.id },
          data: { avgConfidence: newAvg },
        });
      }

      // Update top intents
      if (data.intent) {
        const intents = JSON.parse(analytics.topIntents);
        intents[data.intent] = (intents[data.intent] || 0) + 1;

        await db.chatAnalytics.update({
          where: { id: analytics.id },
          data: { topIntents: JSON.stringify(intents) },
        });
      }

      // Update sentiment breakdown
      if (data.sentiment) {
        const sentiments = JSON.parse(analytics.sentimentBreakdown);
        sentiments[data.sentiment] = (sentiments[data.sentiment] || 0) + 1;

        await db.chatAnalytics.update({
          where: { id: analytics.id },
          data: { sentimentBreakdown: JSON.stringify(sentiments) },
        });
      }

      // Update top products
      // ✅ FIX: Store product title along with ID for better analytics display
      if (data.productClicked) {
        const products = JSON.parse(analytics.topProducts);

        // Use format: "productId|||productTitle" to store both ID and title
        // This allows displaying product names in analytics dashboard
        const productKey = data.productTitle
          ? `${data.productClicked}|||${data.productTitle}`
          : data.productClicked; // Fallback for backward compatibility

        products[productKey] = (products[productKey] || 0) + 1;

        await db.chatAnalytics.update({
          where: { id: analytics.id },
          data: { topProducts: JSON.stringify(products) },
        });
      }

      // Update workflow usage tracking (safe mode: handle missing field)
      if (data.workflowType) {
        try {
          const workflowUsage = JSON.parse((analytics as any).workflowUsage || '{}');
          workflowUsage[data.workflowType] = (workflowUsage[data.workflowType] || 0) + 1;

          await db.chatAnalytics.update({
            where: { id: analytics.id },
            data: { workflowUsage: JSON.stringify(workflowUsage) } as any,
          });
        } catch (error) {
          // Ignore if workflowUsage field doesn't exist (migration not run yet)
          this.logger.debug('Workflow tracking skipped (database migration pending)');
        }
      }

      this.logger.debug({
        shop,
        workflowType: data.workflowType,
        isNewSession: data.isNewSession,
        totalMessages: analytics.totalMessages,
        totalSessions: analytics.totalSessions,
      }, 'Analytics updated successfully');
    } catch (error) {
      logError(error, 'Error updating analytics', {
        shop,
        date: new Date().toISOString().split('T')[0],
      });
    }
  }

  /**
   * Get personalized product recommendations
   */
  async getPersonalizedRecommendations(
    userProfileId: string,
    allProducts: any[],
    limit: number = 5
  ): Promise<any[]> {
    try {
      const profile = await db.userProfile.findUnique({
        where: { id: userProfileId },
      });

      if (!profile) return allProducts.slice(0, limit);

      const preferences = JSON.parse(profile.preferences) as UserPreferences;
      const browsingHistory = JSON.parse(profile.browsingHistory) as string[];

      // Score products based on preferences
      const scoredProducts = allProducts.map(product => {
        let score = 0;

        // Boost recently viewed products
        const viewIndex = browsingHistory.indexOf(product.id);
        if (viewIndex >= 0) {
          score += (browsingHistory.length - viewIndex) * 2;
        }

        // Boost products matching price range
        if (preferences.priceRange && product.price) {
          const price = parseFloat(product.price);
          if (
            price >= preferences.priceRange.min &&
            price <= preferences.priceRange.max
          ) {
            score += 3;
          }
        }

        // Boost products matching favorite categories
        if (preferences.favoriteCategories && product.productType) {
          if (
            preferences.favoriteCategories.some(cat =>
              product.productType.toLowerCase().includes(cat.toLowerCase())
            )
          ) {
            score += 4;
          }
        }

        // Boost products matching colors/styles in description
        const description = (product.description || '').toLowerCase();
        if (preferences.favoriteColors) {
          preferences.favoriteColors.forEach(color => {
            if (description.includes(color.toLowerCase())) {
              score += 2;
            }
          });
        }

        return { ...product, personalizedScore: score };
      });

      // Sort by score and return top recommendations
      return scoredProducts
        .sort((a, b) => b.personalizedScore - a.personalizedScore)
        .slice(0, limit);
    } catch (error) {
      logError(error, 'Error getting personalized recommendations');
      return allProducts.slice(0, limit);
    }
  }
}

// Export singleton instance
export const personalizationService = new PersonalizationService();
