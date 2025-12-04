import axios from 'axios';
import { getEmbeddingService, isEmbeddingServiceAvailable } from './embedding.service';
import { personalizationService, type UserPreferences } from './personalization.service';
// import db from '../db.server';

// Enhanced N8N Response with rich features
export interface N8NWebhookResponse {
  message: string;
  messageType?: string; // 'greeting', 'product_search', 'order_tracking', etc.
  recommendations?: EnhancedProductRecommendation[];
  quickReplies?: string[]; // Quick reply suggestions
  suggestedActions?: SuggestedAction[]; // Action buttons
  confidence?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  requiresHumanEscalation?: boolean;
  analytics?: {
    intentDetected?: string;
    subIntent?: string;
    responseTime?: number;
    productsShown?: number;
  };
  success?: boolean;
}

// Enhanced Product Recommendation with rich metadata
export interface EnhancedProductRecommendation {
  id: string;
  title: string;
  handle: string;
  price: string;
  priceFormatted?: string; // e.g., "USD 99.99"
  originalPrice?: string; // For showing discounts
  discountPercent?: number; // e.g., 20 for 20% off
  url?: string; // Full product URL
  image?: string;
  description?: string;
  isAvailable?: boolean; // Stock availability
  isLowStock?: boolean; // Low inventory warning
  inventory?: number; // Actual inventory count
  relevanceScore?: number; // 0-100
  urgencyMessage?: string; // e.g., "Only 3 left!"
  badge?: string; // e.g., "20% OFF", "Best Seller"
  cta?: string; // Call to action text, e.g., "View Product", "Add to Cart"
}

// Suggested action buttons
export interface SuggestedAction {
  label: string; // Button text
  action: 'view_product' | 'add_to_cart' | 'compare' | 'custom';
  data?: string; // Product ID or custom data
}

// Enhanced N8N Request with richer context
export interface N8NRequest {
  userMessage: string;
  sessionId?: string;
  products: any[];
  context?: {
    // Shop context
    shopDomain?: string;
    locale?: string; // 'en', 'fr', 'es', etc.
    currency?: string; // 'USD', 'EUR', 'CAD', etc.

    // Customer context
    customerId?: string;
    customerEmail?: string;

    // Page context
    pageUrl?: string;
    currentPage?: 'product' | 'cart' | 'checkout' | 'collection' | 'home' | 'other';
    currentProductId?: string;
    cartId?: string;

    // Conversation context
    previousMessages?: string[];
    userPreferences?: UserPreferences;
    sentiment?: string;
    intent?: string;

    // Legacy fields (for backward compatibility)
    timestamp?: string;
    userAgent?: string;
    referer?: string;
    recentProducts?: string[];
  };
}

export class N8NService {
  private webhookUrl: string;
  private apiKey?: string;

  constructor(webhookUrl?: string, apiKey?: string) {
    // ✅ SECURITY FIX: Removed hardcoded webhook URL fallback
    // Prioritize: 1) passed parameter, 2) environment variable, 3) throw error if missing
    const configuredWebhookUrl = webhookUrl || process.env.N8N_WEBHOOK_URL;

    if (!configuredWebhookUrl) {
      const errorMessage = '🚨 N8N_WEBHOOK_URL is not configured! Please set the N8N_WEBHOOK_URL environment variable.';
      console.error(errorMessage);
      console.error('💡 The app will use fallback local processing for all requests.');
      console.error('💡 To fix this: Set N8N_WEBHOOK_URL in your environment variables or .env file');

      // Use a placeholder that will trigger fallback processing
      this.webhookUrl = 'MISSING_N8N_WEBHOOK_URL';
    } else {
      this.webhookUrl = configuredWebhookUrl;
    }

    this.apiKey = apiKey || process.env.N8N_API_KEY;

    // Log the webhook URL being used for debugging (hide sensitive parts)
    if (this.webhookUrl !== 'MISSING_N8N_WEBHOOK_URL') {
      const maskedUrl = this.maskWebhookUrl(this.webhookUrl);
      console.log('🔧 N8N Service: Using webhook URL:', maskedUrl);
    }
    console.log('🔧 N8N Service: Using API key:', this.apiKey ? '[CONFIGURED]' : '[NOT SET]');

    // Log important note about webhook URL format
    if (this.webhookUrl.includes('/webhook/webhook/')) {
      console.warn('⚠️ N8N Service: Webhook URL contains duplicate /webhook/ - this might cause 404 errors');
    }
  }

  /**
   * Mask sensitive parts of webhook URL for logging
   */
  private maskWebhookUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // Mask the webhook ID (last part of path)
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart.length > 8) {
          pathParts[pathParts.length - 1] = lastPart.substring(0, 4) + '****' + lastPart.substring(lastPart.length - 4);
        }
      }

      urlObj.pathname = pathParts.join('/');
      return urlObj.toString();
    } catch {
      return '[INVALID URL FORMAT]';
    }
  }

  async processUserMessage(request: N8NRequest): Promise<N8NWebhookResponse> {
    try {
      // Check if webhook URL is configured
      if (this.webhookUrl === 'MISSING_N8N_WEBHOOK_URL') {
        console.warn('⚠️ N8N_WEBHOOK_URL not configured, using fallback processing');
        return this.fallbackProcessing(request);
      }

      const maskedUrl = this.maskWebhookUrl(this.webhookUrl);
      console.log('🚀 N8N Service: Attempting to call webhook:', maskedUrl);
      console.log('📤 N8N Service: Request payload:', JSON.stringify(request, null, 2));

      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(this.webhookUrl, request, {
        headers,
        timeout: 30000, // 30 second timeout
      });

      console.log('✅ N8N Response received:');
      console.log('📦 Response Status:', response.status);
      console.log('📦 Response Headers:', JSON.stringify(response.headers, null, 2));
      console.log('📦 Response Data Type:', typeof response.data);
      console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));

      // Vérifier le format de la réponse
      if (response.data?.message) {
        console.log('✅ AI Message found:', response.data.message);
        console.log('✅ Recommendations count:', response.data.recommendations?.length || 0);
        console.log('✅ Confidence:', response.data.confidence || 'N/A');
      } else {
        console.log('⚠️ Unexpected response format - missing "message" field!');
        console.log('⚠️ Response keys:', Object.keys(response.data || {}));
      }

      return response.data;
    } catch (error: any) {
      console.error('❌❌❌ N8N SERVICE WEBHOOK CALL FAILED ❌❌❌');
      console.error('🔗 Webhook URL that failed:', this.webhookUrl);
      console.error('📋 Error message:', error?.message);
      console.error('📋 Error code:', error?.code);
      console.error('📋 HTTP status:', error?.response?.status);
      console.error('📋 Response data:', error?.response?.data);
      console.error('📋 Request headers used:', error?.config?.headers);

      // Check for common issues
      if (error?.code === 'ECONNREFUSED') {
        console.error('💥 CONNECTION REFUSED - N8N server is not reachable');
      } else if (error?.code === 'ETIMEDOUT') {
        console.error('⏱️ TIMEOUT - N8N server did not respond within 30 seconds');
      } else if (error?.response?.status === 404) {
        console.error('🔍 404 NOT FOUND - Check your webhook URL path');
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        console.error('🔒 AUTHENTICATION FAILED - Check your N8N API key');
      } else if (error?.response?.status === 500) {
        console.error('💔 N8N INTERNAL ERROR - Check your N8N workflow');
      }

      console.log('🔄 N8N Service: Falling back to AI-enhanced local processing');
      // Fallback to AI-enhanced local processing if N8N is unavailable
      return this.fallbackProcessing(request);
    }
  }

  /**
   * Enhanced fallback processing with semantic search and personalization
   */
  private async enhancedFallbackProcessing(request: N8NRequest): Promise<N8NWebhookResponse> {
    const { userMessage, products, context } = request;
    const shop = context?.shopDomain || '';

    try {
      // Classify intent and sentiment
      const intent = await personalizationService.classifyIntent(userMessage);
      const sentiment = await personalizationService.analyzeSentiment(userMessage);

      console.log(`🎯 Intent: ${intent}, Sentiment: ${sentiment}`);

      let recommendations: ProductRecommendation[] = [];
      let message = '';
      let confidence = 0.7;

      // Use semantic search if available and it's a product search
      if (
        isEmbeddingServiceAvailable() &&
        ['PRODUCT_SEARCH', 'COMPARISON', 'OTHER'].includes(intent)
      ) {
        try {
          console.log('🔍 Using semantic search with embeddings...');
          const embeddingService = getEmbeddingService();

          // Perform semantic search
          const results = await embeddingService.semanticSearch(
            shop,
            userMessage,
            products,
            5
          );

          // Convert to recommendations
          recommendations = results.map(result => ({
            id: result.product.id,
            title: result.product.title,
            handle: result.product.handle,
            price: result.product.price || '0.00',
            image: result.product.image,
            description: result.product.description,
            relevanceScore: Math.round(result.similarity * 100),
          }));

          confidence = results[0]?.similarity || 0.7;

          // Apply personalization boost if we have user context
          if (context?.sessionId) {
            recommendations = await this.applyPersonalizationBoost(
              context.sessionId,
              shop,
              recommendations,
              context.userPreferences
            );
          }

          message = this.generateSemanticSearchMessage(userMessage, recommendations, intent);

          console.log(`✅ Found ${recommendations.length} semantic matches`);
        } catch (error: any) {
          console.error('❌ Semantic search failed, falling back to keyword search:', error.message);
          // Fall through to keyword-based search
        }
      }

      // If no recommendations yet, use keyword-based search
      if (recommendations.length === 0) {
        const result = await this.keywordBasedSearch(userMessage, products, intent, context?.userPreferences);
        recommendations = result.recommendations;
        message = result.message;
        confidence = result.confidence;
      }

      return {
        message,
        recommendations,
        confidence,
      };
    } catch (error: any) {
      console.error('❌ Enhanced fallback processing error:', error.message);
      // Ultimate fallback to simple processing
      return this.simpleFallbackProcessing(request);
    }
  }

  /**
   * Apply personalization scoring boost to recommendations
   */
  private async applyPersonalizationBoost(
    sessionId: string,
    shop: string,
    recommendations: ProductRecommendation[],
    preferences?: UserPreferences
  ): Promise<ProductRecommendation[]> {
    try {
      const context = await personalizationService.getPersonalizationContext(
        shop,
        sessionId
      );

      const boostedRecs = recommendations.map(rec => {
        let boost = 0;

        // Boost if user viewed this product before
        if (context.recentProducts.includes(rec.id)) {
          boost += 10;
        }

        // Boost if matches price preferences
        if (context.preferences.priceRange && rec.price) {
          const price = parseFloat(rec.price);
          if (
            price >= context.preferences.priceRange.min &&
            price <= context.preferences.priceRange.max
          ) {
            boost += 5;
          }
        }

        // Boost if matches favorite colors
        if (context.preferences.favoriteColors && rec.description) {
          const descLower = rec.description.toLowerCase();
          context.preferences.favoriteColors.forEach(color => {
            if (descLower.includes(color.toLowerCase())) {
              boost += 3;
            }
          });
        }

        return {
          ...rec,
          relevanceScore: Math.min(100, (rec.relevanceScore || 0) + boost),
        };
      });

      // Re-sort by boosted scores
      return boostedRecs.sort((a, b) =>
        (b.relevanceScore || 0) - (a.relevanceScore || 0)
      );
    } catch (error: any) {
      console.error('❌ Personalization boost error:', error.message);
      return recommendations;
    }
  }

  /**
   * Generate message based on semantic search results
   */
  private generateSemanticSearchMessage(
    query: string,
    recommendations: ProductRecommendation[],
    intent: string
  ): string {
    if (recommendations.length === 0) {
      return "I couldn't find exact matches, but let me help you in another way. Could you provide more details about what you're looking for?";
    }

    const topScore = recommendations[0]?.relevanceScore || 0;

    if (topScore > 85) {
      return `I found some excellent matches for "${query}"! These products closely match what you're looking for:`;
    } else if (topScore > 70) {
      return `Here are some good options that match your search for "${query}":`;
    } else {
      return `Based on your search for "${query}", here are some products you might be interested in:`;
    }
  }

  /**
   * Keyword-based search (fallback when embeddings not available)
   */
  private async keywordBasedSearch(
    userMessage: string,
    products: any[],
    intent: string,
    preferences?: UserPreferences
  ): Promise<{ message: string; recommendations: ProductRecommendation[]; confidence: number }> {
    const lowerMessage = userMessage.toLowerCase();
    const keywords = lowerMessage.split(/\s+/).filter(word => word.length > 3);

    // Score products based on keyword matches
    const scoredProducts = products.map(product => {
      let score = 0;
      const title = (product.title || '').toLowerCase();
      const description = (product.description || '').toLowerCase();

      keywords.forEach(keyword => {
        if (title.includes(keyword)) score += 3;
        if (description.includes(keyword)) score += 1;
      });

      // Apply price preferences if available
      if (preferences?.priceRange && product.price) {
        const price = parseFloat(product.price);
        if (price >= preferences.priceRange.min && price <= preferences.priceRange.max) {
          score += 2;
        }
      }

      return {
        ...product,
        score,
      };
    });

    const topProducts = scoredProducts
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const recommendations = topProducts.map(p => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      price: p.price || '0.00',
      image: p.image,
      description: p.description,
      relevanceScore: Math.min(100, Math.round((p.score / 10) * 100)),
    }));

    let message = '';

    if (recommendations.length > 0) {
      message = `Here are some products that match your search:`;
    } else {
      message = this.getIntentBasedMessage(intent, lowerMessage);
    }

    return {
      message,
      recommendations,
      confidence: recommendations.length > 0 ? 0.6 : 0.5,
    };
  }

  /**
   * Get intent-based response message
   */
  private getIntentBasedMessage(intent: string, message: string): string {
    const responses: Record<string, string> = {
      PRICE_INQUIRY: "I can help you find products within your budget. What price range are you looking for?",
      SHIPPING: "Let me check the shipping options for you. Most of our products offer free shipping on orders over $50.",
      RETURNS: "Our return policy allows returns within 30 days of purchase. Would you like me to help you with a specific product return?",
      SIZE_FIT: "I can help you find the right size. What type of product are you looking for, and what are your measurements?",
      SUPPORT: "I'm here to help with any issues you're experiencing. Can you tell me more about what you need assistance with?",
      GREETING: "Hello! I'm your AI shopping assistant. I can help you find products, answer questions about pricing and shipping, and provide personalized recommendations. What are you looking for today?",
      THANKS: "You're welcome! Is there anything else I can help you with?",
      COMPARISON: "I'd be happy to help you compare products. Which products would you like to compare?",
      AVAILABILITY: "I can check product availability for you. Which product are you interested in?",
    };

    return responses[intent] || "I'm here to help you find the perfect products! You can ask me about:\n• Product recommendations\n• Pricing and budget options\n• Shipping and delivery\n• Returns and exchanges\n• Product details like size, color, and materials\n\nWhat would you like to know?";
  }

  private fallbackProcessing(request: N8NRequest): Promise<N8NWebhookResponse> {
    // Use enhanced fallback with AI features if available
    return this.enhancedFallbackProcessing(request);
  }

  /**
   * Simple fallback processing without AI enhancements (ultimate fallback)
   */
  private simpleFallbackProcessing(request: N8NRequest): N8NWebhookResponse {
    const { userMessage, products } = request;
    const lowerMessage = userMessage.toLowerCase();

    let message = "";
    let recommendations: ProductRecommendation[] = [];

    // Simple keyword-based matching as fallback
    if (lowerMessage.includes("recommend") || lowerMessage.includes("suggest")) {
      recommendations = products.slice(0, 3).map((product: any) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        price: product.price,
        image: product.image,
        description: product.description,
        relevanceScore: Math.round(Math.random() * 100)
      }));
      message = "Here are some products I'd recommend based on your request:";
    } else if (lowerMessage.includes("price") || lowerMessage.includes("cost") || lowerMessage.includes("budget")) {
      message = "I can help you find products within your budget. What price range are you looking for?";
    } else if (lowerMessage.includes("shipping") || lowerMessage.includes("delivery")) {
      message = "Let me check the shipping options for you. Most of our products offer free shipping on orders over $50.";
    } else if (lowerMessage.includes("return") || lowerMessage.includes("refund")) {
      message = "Our return policy allows returns within 30 days of purchase. Would you like me to help you with a specific product return?";
    } else if (lowerMessage.includes("size") || lowerMessage.includes("sizing")) {
      message = "I can help you find the right size. What type of product are you looking for, and what are your measurements?";
    } else if (lowerMessage.includes("color") || lowerMessage.includes("colour")) {
      message = "I can help you find products in specific colors. What color are you looking for?";
    } else if (lowerMessage.includes("material") || lowerMessage.includes("fabric")) {
      message = "I can help you find products made from specific materials. What material preferences do you have?";
    } else {
      message = "I'm here to help you find the perfect products! You can ask me about:\n• Product recommendations\n• Pricing and budget options\n• Shipping and delivery\n• Returns and exchanges\n• Product details like size, color, and materials\n\nWhat would you like to know?";
    }

    return {
      message,
      recommendations,
      confidence: 0.5
    };
  }

  // Method to test N8N connection
  async testConnection(): Promise<boolean> {
    try {
      const testRequest: N8NRequest = {
        userMessage: "test connection",
        products: []
      };

      await this.processUserMessage(testRequest);
      return true;
    } catch (error) {
      console.error('N8N Connection Test Failed:', error);
      return false;
    }
  }
}

// Export a default instance that prioritizes environment variables
export const n8nService = new N8NService(); 