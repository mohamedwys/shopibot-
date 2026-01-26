import axios from 'axios';
import { getEmbeddingService, isEmbeddingServiceAvailable } from './embedding.service';
import { personalizationService, type UserPreferences } from './personalization.service';
import { logger, logError, createLogger } from '../lib/logger.server';
import { TIMEOUTS } from '../config/limits';
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

// Type alias for backward compatibility
export type ProductRecommendation = EnhancedProductRecommendation;

// Suggested action buttons
export interface SuggestedAction {
  label: string; // Button text
  action: 'view_product' | 'add_to_cart' | 'compare' | 'custom';
  data?: string; // Product ID or custom data
}

// Shop policies interface for dynamic merchant-specific data
export interface ShopPolicies {
  shopName?: string;
  returns?: string | null;       // Refund/return policy from Shopify
  shipping?: string | null;      // Shipping policy from Shopify
  privacy?: string | null;       // Privacy policy from Shopify
  termsOfService?: string | null; // Terms of service
  contactEmail?: string | null;  // Support email
  contactPhone?: string | null;  // Support phone
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
    conversationHistory?: Array<{ role: string; content: string }>;
    messageCount?: number;
    isFirstMessage?: boolean;
    userPreferences?: UserPreferences;
    sentiment?: string;
    intent?: string;

    // Language instruction for AI
    languageInstruction?: string;

    // ✅ NEW: Shop policies for dynamic merchant-specific responses
    shopPolicies?: ShopPolicies;

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
  private logger = createLogger({ service: 'N8NService' });

  constructor(webhookUrl?: string, apiKey?: string) {
    // ✅ SECURITY FIX: Removed hardcoded webhook URL fallback
    // Prioritize: 1) passed parameter, 2) environment variable, 3) throw error if missing
    const configuredWebhookUrl = webhookUrl || process.env.N8N_WEBHOOK_URL;

    if (!configuredWebhookUrl) {
      this.logger.warn('N8N_WEBHOOK_URL not configured - will use fallback processing');
      // Use a placeholder that will trigger fallback processing
      this.webhookUrl = 'MISSING_N8N_WEBHOOK_URL';
    } else {
      this.webhookUrl = configuredWebhookUrl;
    }

    this.apiKey = apiKey || process.env.N8N_API_KEY;

    // Log the webhook URL being used for debugging (hide sensitive parts)
    if (this.webhookUrl !== 'MISSING_N8N_WEBHOOK_URL') {
      const maskedUrl = this.maskWebhookUrl(this.webhookUrl);
      this.logger.debug({ maskedUrl, hasApiKey: !!this.apiKey }, 'N8N Service initialized');
    }

    // Log important note about webhook URL format
    if (this.webhookUrl.includes('/webhook/webhook/')) {
      this.logger.warn('Webhook URL contains duplicate /webhook/ - might cause 404 errors');
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
        this.logger.debug('Using fallback processing');
        return this.fallbackProcessing(request);
      }

      const maskedUrl = this.maskWebhookUrl(this.webhookUrl);
      this.logger.debug({ maskedUrl }, 'Calling N8N webhook');

      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(this.webhookUrl, request, {
        headers,
        timeout: TIMEOUTS.N8N_WEBHOOK_MS,
      });

      this.logger.debug({
        status: response.status,
        hasMessage: !!response.data?.message,
        recommendationsCount: response.data?.recommendations?.length || 0,
        confidence: response.data?.confidence
      }, 'N8N response received');

      if (!response.data?.message) {
        this.logger.warn({ responseKeys: Object.keys(response.data || {}) }, 'Unexpected response format - missing message field');
        // Throw error to trigger fallback processing
        throw new Error('N8N response missing required message field');
      }

      return response.data;
    } catch (error: any) {
      const errorDetails = {
        code: error?.code,
        status: error?.response?.status,
        message: error?.message
      };

      // Check for common issues
      if (error?.code === 'ECONNREFUSED') {
        this.logger.error(errorDetails, 'N8N connection refused');
      } else if (error?.code === 'ETIMEDOUT') {
        this.logger.error(errorDetails, 'N8N request timeout');
      } else if (error?.response?.status === 404) {
        this.logger.error(errorDetails, 'N8N webhook not found');
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        this.logger.error(errorDetails, 'N8N authentication failed');
      } else if (error?.response?.status === 500) {
        this.logger.error(errorDetails, 'N8N internal error');
      } else {
        logError(error, 'N8N webhook call failed', errorDetails);
      }

      this.logger.debug('Falling back to local processing');
      // Fallback to AI-enhanced local processing if N8N is unavailable
      return this.fallbackProcessing(request);
    }
  }

  /**
   * Enhanced fallback processing with semantic search and personalization
   * ✅ Now uses dynamic shop policies for merchant-specific responses
   */
  private async enhancedFallbackProcessing(request: N8NRequest): Promise<N8NWebhookResponse> {
    const { userMessage, products, context, sessionId } = request;
    const shop = context?.shopDomain || '';
    const shopPolicies = context?.shopPolicies;

    try {
      // Detect language
      const lang = this.detectLanguage(userMessage, context);
      const msgs = this.getFallbackMessages(lang, shopPolicies);

      // Classify intent and sentiment
      const intent = await personalizationService.classifyIntent(userMessage);
      const sentiment = await personalizationService.analyzeSentiment(userMessage);

      this.logger.debug({ intent, sentiment, language: lang }, 'Analyzed message');

      let recommendations: ProductRecommendation[] = [];
      let message = '';
      let confidence = 0.7;
      let quickReplies: string[] = [];

      const hasProducts = products && products.length > 0;

      // Use semantic search if available and it's a product search
      if (
        isEmbeddingServiceAvailable() &&
        ['PRODUCT_SEARCH', 'COMPARISON', 'OTHER'].includes(intent)
      ) {
        try {
          this.logger.debug('Using semantic search with embeddings');
          const embeddingService = getEmbeddingService();

          // Perform semantic search
          const results = await embeddingService.semanticSearch(
            shop,
            userMessage,
            products,
            6
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
          if (sessionId) {
            recommendations = await this.applyPersonalizationBoost(
              sessionId,
              shop,
              recommendations,
              context?.userPreferences
            );
          }

          message = this.generateSemanticSearchMessage(userMessage, recommendations, intent);

          this.logger.info({ count: recommendations.length }, 'Found semantic matches');
        } catch (error: any) {
          this.logger.debug({ error: error.message }, 'Semantic search failed, using keyword search');
          // Fall through to keyword-based search
        }
      }

      // If no recommendations yet, use keyword-based search
      if (recommendations.length === 0 && hasProducts) {
        // ✅ Pass shop policies for merchant-specific responses
        const result = await this.keywordBasedSearch(userMessage, products, intent, context?.userPreferences, shopPolicies);
        recommendations = result.recommendations;
        message = result.message;
        confidence = result.confidence;
      }

      // If still no recommendations but products are available, show some products
      if (recommendations.length === 0 && hasProducts) {
        recommendations = products.slice(0, 6).map((product: any) => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          price: product.price || '0.00',
          image: product.image,
          description: product.description,
          relevanceScore: 50
        }));
        message = msgs.featuredProducts;
        confidence = 0.5;
      }

      // Add quick replies based on language and whether we have products
      quickReplies = this.getQuickReplies(lang, hasProducts);

      return {
        message: message || msgs.welcomeBrowse,
        recommendations,
        quickReplies,
        confidence,
        sentiment,
      };
    } catch (error) {
      logError(error, 'Enhanced fallback processing error');
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
    } catch (error) {
      this.logger.debug('Personalization boost failed');
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
   * ✅ Now accepts shop policies for merchant-specific responses
   */
  private async keywordBasedSearch(
    userMessage: string,
    products: any[],
    intent: string,
    preferences?: UserPreferences,
    shopPolicies?: ShopPolicies
  ): Promise<{ message: string; recommendations: ProductRecommendation[]; confidence: number }> {
    const lowerMessage = userMessage.toLowerCase();
    const keywords = lowerMessage.split(/\s+/).filter(word => word.length > 2);

    // Score products based on keyword matches
    const scoredProducts = products.map(product => {
      let score = 0;
      const title = (product.title || '').toLowerCase();
      const description = (product.description || '').toLowerCase();

      keywords.forEach(keyword => {
        // Skip common words
        if (['the', 'and', 'or', 'for', 'with', 'can', 'you', 'show', 'me', 'voir', 'montre', 'des', 'les', 'une', 'un'].includes(keyword)) {
          return;
        }

        if (title.includes(keyword)) score += 5;
        if (description.includes(keyword)) score += 2;
      });

      // Apply price preferences if available
      if (preferences?.priceRange && product.price) {
        const price = parseFloat(product.price);
        if (price >= preferences.priceRange.min && price <= preferences.priceRange.max) {
          score += 3;
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
      .slice(0, 6);

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
      // Detect language for appropriate message
      const lang = this.detectLanguage(userMessage);
      const msgs = this.getFallbackMessages(lang, shopPolicies);
      message = msgs.showingProducts;
    } else {
      // ✅ Pass shop policies for merchant-specific responses
      const lang = this.detectLanguage(userMessage);
      message = this.getIntentBasedMessage(intent, lowerMessage, shopPolicies, lang);
    }

    return {
      message,
      recommendations,
      confidence: recommendations.length > 0 ? 0.65 : 0.5,
    };
  }

  /**
   * Get intent-based response message with dynamic shop policies
   * @param intent - The detected user intent
   * @param message - The user's message
   * @param policies - Optional shop policies for merchant-specific responses
   * @param lang - Language code for localized responses
   */
  private getIntentBasedMessage(
    intent: string,
    message: string,
    policies?: ShopPolicies,
    lang: string = 'en'
  ): string {
    // ✅ DYNAMIC: Use real shop policies if available, otherwise use helpful generic messages
    const hasShippingPolicy = policies?.shipping && policies.shipping.length > 50;
    const hasReturnPolicy = policies?.returns && policies.returns.length > 50;

    // Generate shipping response based on actual policy
    const getShippingResponse = (): string => {
      if (hasShippingPolicy) {
        // Truncate long policies to first ~500 chars for readability
        const policyPreview = policies!.shipping!.length > 500
          ? policies!.shipping!.substring(0, 500) + '...'
          : policies!.shipping!;

        const langPrefixes: Record<string, string> = {
          en: "Here's our shipping policy:",
          fr: "Voici notre politique de livraison :",
          es: "Aquí está nuestra política de envío:",
          de: "Hier ist unsere Versandrichtlinie:",
          pt: "Aqui está nossa política de envio:",
          it: "Ecco la nostra politica di spedizione:"
        };
        return `${langPrefixes[lang] || langPrefixes.en}\n\n${policyPreview}`;
      }

      // Generic helpful message when no policy is configured
      const genericShipping: Record<string, string> = {
        en: "For shipping information, please check our shipping page or contact customer support. Shipping times and costs vary by location.",
        fr: "Pour les informations de livraison, veuillez consulter notre page d'expédition ou contacter le service client. Les délais et coûts varient selon la destination.",
        es: "Para información de envío, consulte nuestra página de envíos o contacte atención al cliente. Los tiempos y costos varían según la ubicación.",
        de: "Für Versandinformationen besuchen Sie bitte unsere Versandseite oder kontaktieren Sie den Kundenservice. Lieferzeiten und Kosten variieren je nach Standort.",
        pt: "Para informações de envio, consulte nossa página de envio ou entre em contato com o suporte ao cliente. Prazos e custos variam por localização.",
        it: "Per informazioni sulla spedizione, consulta la nostra pagina spedizioni o contatta l'assistenza clienti. Tempi e costi variano in base alla località."
      };
      return genericShipping[lang] || genericShipping.en;
    };

    // Generate return response based on actual policy
    const getReturnResponse = (): string => {
      if (hasReturnPolicy) {
        // Truncate long policies to first ~500 chars for readability
        const policyPreview = policies!.returns!.length > 500
          ? policies!.returns!.substring(0, 500) + '...'
          : policies!.returns!;

        const langPrefixes: Record<string, string> = {
          en: "Here's our return policy:",
          fr: "Voici notre politique de retour :",
          es: "Aquí está nuestra política de devoluciones:",
          de: "Hier ist unsere Rückgaberichtlinie:",
          pt: "Aqui está nossa política de devolução:",
          it: "Ecco la nostra politica di reso:"
        };
        return `${langPrefixes[lang] || langPrefixes.en}\n\n${policyPreview}`;
      }

      // Generic helpful message when no policy is configured
      const genericReturn: Record<string, string> = {
        en: "For return and refund information, please check our returns page or contact customer support. We're happy to help with any return requests.",
        fr: "Pour les informations de retour et remboursement, veuillez consulter notre page retours ou contacter le service client. Nous sommes heureux de vous aider.",
        es: "Para información sobre devoluciones y reembolsos, consulte nuestra página de devoluciones o contacte atención al cliente. Estaremos encantados de ayudarle.",
        de: "Für Rückgabe- und Erstattungsinformationen besuchen Sie bitte unsere Rückgabeseite oder kontaktieren Sie den Kundenservice. Wir helfen Ihnen gerne.",
        pt: "Para informações sobre devoluções e reembolsos, consulte nossa página de devoluções ou entre em contato com o suporte ao cliente. Teremos prazer em ajudar.",
        it: "Per informazioni su resi e rimborsi, consulta la nostra pagina resi o contatta l'assistenza clienti. Saremo lieti di aiutarti."
      };
      return genericReturn[lang] || genericReturn.en;
    };

    const responses: Record<string, string> = {
      PRICE_INQUIRY: "I can help you find products within your budget. What price range are you looking for?",
      SHIPPING: getShippingResponse(),
      RETURNS: getReturnResponse(),
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
   * Detect language from user message and context
   */
  private detectLanguage(message: string, context?: N8NRequest['context']): string {
    // Check context locale first
    if (context?.locale) {
      return context.locale.toLowerCase().split('-')[0];
    }

    const lower = message.toLowerCase();

    // French detection
    if (/(bonjour|salut|merci|montre|produit|cherche|voudrais|pourrais)/i.test(message)) {
      return 'fr';
    }

    // Spanish detection
    if (/(hola|gracias|producto|busco|quiero|puedo)/i.test(message)) {
      return 'es';
    }

    // German detection
    if (/(hallo|danke|produkt|suche|möchte|kann)/i.test(message)) {
      return 'de';
    }

    // Portuguese detection
    if (/(olá|obrigado|produto|procuro|gostaria|posso)/i.test(message)) {
      return 'pt';
    }

    // Italian detection
    if (/(ciao|grazie|prodotto|cerco|vorrei|posso)/i.test(message)) {
      return 'it';
    }

    // Default to English
    return 'en';
  }

  /**
   * Get fallback messages in multiple languages with dynamic shop policies
   * @param lang - Language code
   * @param policies - Optional shop policies for merchant-specific messages
   */
  private getFallbackMessages(lang: string, policies?: ShopPolicies) {
    // ✅ DYNAMIC: Generate shipping and return info from real policies
    const generateShippingInfo = (langCode: string): string => {
      if (policies?.shipping && policies.shipping.length > 50) {
        // Has real policy - show preview
        const preview = policies.shipping.length > 300
          ? policies.shipping.substring(0, 300) + '...'
          : policies.shipping;

        const prefixes: Record<string, string> = {
          en: "Shipping Policy:",
          fr: "Politique de livraison :",
          es: "Política de envío:",
          de: "Versandrichtlinie:",
          pt: "Política de envio:",
          it: "Politica di spedizione:",
          zh: "配送政策：",
          ja: "配送ポリシー："
        };
        return `${prefixes[langCode] || prefixes.en} ${preview}`;
      }

      // No policy configured - return helpful generic message
      const genericMessages: Record<string, string> = {
        en: "For shipping information, please contact us or check our store policies.",
        fr: "Pour les informations de livraison, veuillez nous contacter ou consulter nos politiques.",
        es: "Para información de envío, contáctenos o consulte nuestras políticas.",
        de: "Für Versandinformationen kontaktieren Sie uns bitte oder prüfen Sie unsere Richtlinien.",
        pt: "Para informações de envio, entre em contato ou consulte nossas políticas.",
        it: "Per informazioni sulla spedizione, contattaci o consulta le nostre politiche.",
        zh: "如需配送信息，请联系我们或查看我们的政策。",
        ja: "配送情報については、お問い合わせいただくか、ストアポリシーをご確認ください。"
      };
      return genericMessages[langCode] || genericMessages.en;
    };

    const generateReturnInfo = (langCode: string): string => {
      if (policies?.returns && policies.returns.length > 50) {
        // Has real policy - show preview
        const preview = policies.returns.length > 300
          ? policies.returns.substring(0, 300) + '...'
          : policies.returns;

        const prefixes: Record<string, string> = {
          en: "Return Policy:",
          fr: "Politique de retour :",
          es: "Política de devoluciones:",
          de: "Rückgaberichtlinie:",
          pt: "Política de devolução:",
          it: "Politica di reso:",
          zh: "退货政策：",
          ja: "返品ポリシー："
        };
        return `${prefixes[langCode] || prefixes.en} ${preview}`;
      }

      // No policy configured - return helpful generic message
      const genericMessages: Record<string, string> = {
        en: "For return and refund information, please contact us or check our store policies.",
        fr: "Pour les informations de retour et remboursement, veuillez nous contacter ou consulter nos politiques.",
        es: "Para información sobre devoluciones, contáctenos o consulte nuestras políticas.",
        de: "Für Rückgabeinformationen kontaktieren Sie uns bitte oder prüfen Sie unsere Richtlinien.",
        pt: "Para informações de devolução, entre em contato ou consulte nossas políticas.",
        it: "Per informazioni sui resi, contattaci o consulta le nostre politiche.",
        zh: "如需退货信息，请联系我们或查看我们的政策。",
        ja: "返品情報については、お問い合わせいただくか、ストアポリシーをご確認ください。"
      };
      return genericMessages[langCode] || genericMessages.en;
    };

    const messages: Record<string, any> = {
      en: {
        simplifiedMode: "I'm currently working in simplified mode. You can still browse products, search items, and get information.",
        welcomeBrowse: "Welcome! I can help you explore our products. What are you looking for?",
        showingProducts: "Here are some products you might like:",
        browseAll: "Browse all products",
        searchProducts: "Search for products",
        categories: "View categories",
        newArrivals: "New arrivals",
        bestSellers: "Best sellers",
        priceInfo: "I can help you find products within your budget. What price range are you looking for?",
        shippingInfo: generateShippingInfo('en'),
        returnInfo: generateReturnInfo('en'),
        featuredProducts: "Check out our featured products:",
        noProducts: "I don't have product information available at the moment. Please contact us for assistance.",
        helpOptions: "I can help you with:\n• Browse products\n• Search by keyword\n• View categories\n• Check prices and availability\n\nWhat would you like to explore?"
      },
      fr: {
        simplifiedMode: "Je fonctionne actuellement en mode simplifié. Vous pouvez toujours parcourir nos produits, rechercher des articles et obtenir des informations.",
        welcomeBrowse: "Bienvenue ! Je peux vous aider à explorer nos produits. Que recherchez-vous ?",
        showingProducts: "Voici quelques produits qui pourraient vous intéresser :",
        browseAll: "Parcourir tous les produits",
        searchProducts: "Rechercher des produits",
        categories: "Voir les catégories",
        newArrivals: "Nouveautés",
        bestSellers: "Meilleures ventes",
        priceInfo: "Je peux vous aider à trouver des produits dans votre budget. Quelle gamme de prix recherchez-vous ?",
        shippingInfo: generateShippingInfo('fr'),
        returnInfo: generateReturnInfo('fr'),
        featuredProducts: "Découvrez nos produits en vedette :",
        noProducts: "Je n'ai pas d'informations sur les produits disponibles pour le moment. Veuillez nous contacter pour obtenir de l'aide.",
        helpOptions: "Je peux vous aider avec :\n• Parcourir les produits\n• Rechercher par mot-clé\n• Voir les catégories\n• Vérifier les prix et la disponibilité\n\nQue souhaitez-vous explorer ?"
      },
      es: {
        simplifiedMode: "Actualmente estoy funcionando en modo simplificado. Aún puede explorar productos, buscar artículos y obtener información.",
        welcomeBrowse: "¡Bienvenido! Puedo ayudarte a explorar nuestros productos. ¿Qué estás buscando?",
        showingProducts: "Aquí hay algunos productos que podrían interesarte:",
        browseAll: "Ver todos los productos",
        searchProducts: "Buscar productos",
        categories: "Ver categorías",
        newArrivals: "Novedades",
        bestSellers: "Más vendidos",
        priceInfo: "Puedo ayudarte a encontrar productos dentro de tu presupuesto. ¿Qué rango de precio buscas?",
        shippingInfo: generateShippingInfo('es'),
        returnInfo: generateReturnInfo('es'),
        featuredProducts: "Echa un vistazo a nuestros productos destacados:",
        noProducts: "No tengo información de productos disponible en este momento. Por favor contáctenos para obtener ayuda.",
        helpOptions: "Puedo ayudarte con:\n• Explorar productos\n• Buscar por palabra clave\n• Ver categorías\n• Consultar precios y disponibilidad\n\n¿Qué te gustaría explorar?"
      },
      de: {
        simplifiedMode: "Ich arbeite derzeit im vereinfachten Modus. Sie können weiterhin Produkte durchsuchen, Artikel suchen und Informationen erhalten.",
        welcomeBrowse: "Willkommen! Ich kann Ihnen helfen, unsere Produkte zu erkunden. Was suchen Sie?",
        showingProducts: "Hier sind einige Produkte, die Ihnen gefallen könnten:",
        browseAll: "Alle Produkte durchsuchen",
        searchProducts: "Produkte suchen",
        categories: "Kategorien anzeigen",
        newArrivals: "Neuankömmlinge",
        bestSellers: "Bestseller",
        priceInfo: "Ich kann Ihnen helfen, Produkte in Ihrem Budget zu finden. Welche Preisspanne suchen Sie?",
        shippingInfo: generateShippingInfo('de'),
        returnInfo: generateReturnInfo('de'),
        featuredProducts: "Schauen Sie sich unsere ausgewählten Produkte an:",
        noProducts: "Ich habe derzeit keine Produktinformationen verfügbar. Bitte kontaktieren Sie uns für Hilfe.",
        helpOptions: "Ich kann Ihnen helfen mit:\n• Produkte durchsuchen\n• Nach Stichwort suchen\n• Kategorien anzeigen\n• Preise und Verfügbarkeit prüfen\n\nWas möchten Sie erkunden?"
      },
      pt: {
        simplifiedMode: "Estou atualmente funcionando em modo simplificado. Você ainda pode navegar pelos produtos, pesquisar itens e obter informações.",
        welcomeBrowse: "Bem-vindo! Posso ajudá-lo a explorar nossos produtos. O que você está procurando?",
        showingProducts: "Aqui estão alguns produtos que você pode gostar:",
        browseAll: "Ver todos os produtos",
        searchProducts: "Pesquisar produtos",
        categories: "Ver categorias",
        newArrivals: "Novidades",
        bestSellers: "Mais vendidos",
        priceInfo: "Posso ajudá-lo a encontrar produtos dentro do seu orçamento. Que faixa de preço você está procurando?",
        shippingInfo: generateShippingInfo('pt'),
        returnInfo: generateReturnInfo('pt'),
        featuredProducts: "Confira nossos produtos em destaque:",
        noProducts: "Não tenho informações de produtos disponíveis no momento. Entre em contato conosco para obter ajuda.",
        helpOptions: "Posso ajudá-lo com:\n• Navegar produtos\n• Pesquisar por palavra-chave\n• Ver categorias\n• Verificar preços e disponibilidade\n\nO que você gostaria de explorar?"
      },
      it: {
        simplifiedMode: "Sto attualmente funzionando in modalità semplificata. Puoi ancora sfogliare i prodotti, cercare articoli e ottenere informazioni.",
        welcomeBrowse: "Benvenuto! Posso aiutarti a esplorare i nostri prodotti. Cosa stai cercando?",
        showingProducts: "Ecco alcuni prodotti che potrebbero piacerti:",
        browseAll: "Sfoglia tutti i prodotti",
        searchProducts: "Cerca prodotti",
        categories: "Visualizza categorie",
        newArrivals: "Novità",
        bestSellers: "Bestseller",
        priceInfo: "Posso aiutarti a trovare prodotti nel tuo budget. Quale fascia di prezzo stai cercando?",
        shippingInfo: generateShippingInfo('it'),
        returnInfo: generateReturnInfo('it'),
        featuredProducts: "Dai un'occhiata ai nostri prodotti in evidenza:",
        noProducts: "Non ho informazioni sui prodotti disponibili al momento. Contattaci per assistenza.",
        helpOptions: "Posso aiutarti con:\n• Sfogliare prodotti\n• Cercare per parola chiave\n• Visualizzare categorie\n• Controllare prezzi e disponibilità\n\nCosa vorresti esplorare?"
      },
      zh: {
        simplifiedMode: "我目前正在简化模式下工作。您仍然可以浏览产品、搜索商品和获取信息。",
        welcomeBrowse: "欢迎！我可以帮助您探索我们的产品。您在寻找什么？",
        showingProducts: "这里有一些您可能喜欢的产品：",
        browseAll: "浏览所有产品",
        searchProducts: "搜索产品",
        categories: "查看分类",
        newArrivals: "新品上市",
        bestSellers: "畅销产品",
        priceInfo: "我可以帮助您找到符合您预算的产品。您在寻找什么价格范围？",
        shippingInfo: generateShippingInfo('zh'),
        returnInfo: generateReturnInfo('zh'),
        featuredProducts: "查看我们的精选产品：",
        noProducts: "目前没有产品信息可用。请联系我们获取帮助。",
        helpOptions: "我可以帮助您：\n• 浏览产品\n• 按关键词搜索\n• 查看分类\n• 检查价格和库存\n\n您想探索什么？"
      },
      ja: {
        simplifiedMode: "現在簡易モードで動作しています。製品の閲覧、商品の検索、情報の取得は引き続き可能です。",
        welcomeBrowse: "ようこそ！製品の探索をお手伝いします。何をお探しですか？",
        showingProducts: "こちらはあなたが気に入るかもしれない製品です：",
        browseAll: "すべての製品を閲覧",
        searchProducts: "製品を検索",
        categories: "カテゴリを表示",
        newArrivals: "新着商品",
        bestSellers: "ベストセラー",
        priceInfo: "ご予算内で製品を見つけるお手伝いをします。どの価格帯をお探しですか？",
        shippingInfo: generateShippingInfo('ja'),
        returnInfo: generateReturnInfo('ja'),
        featuredProducts: "おすすめ製品をチェック：",
        noProducts: "現在、製品情報が利用できません。サポートについてはお問い合わせください。",
        helpOptions: "お手伝いできること：\n• 製品の閲覧\n• キーワード検索\n• カテゴリ表示\n• 価格と在庫確認\n\n何を探索しますか？"
      }
    };

    return messages[lang] || messages['en'];
  }

  /**
   * Get quick reply buttons based on language
   */
  private getQuickReplies(lang: string, hasProducts: boolean): string[] {
    const replies: Record<string, string[]> = {
      en: hasProducts
        ? ["Show all products", "New arrivals", "Best sellers", "View categories"]
        : ["Contact support", "View store", "Help"],
      fr: hasProducts
        ? ["Voir tous les produits", "Nouveautés", "Meilleures ventes", "Voir les catégories"]
        : ["Contacter le support", "Voir la boutique", "Aide"],
      es: hasProducts
        ? ["Ver todos los productos", "Novedades", "Más vendidos", "Ver categorías"]
        : ["Contactar soporte", "Ver tienda", "Ayuda"],
      de: hasProducts
        ? ["Alle Produkte anzeigen", "Neuankömmlinge", "Bestseller", "Kategorien anzeigen"]
        : ["Support kontaktieren", "Shop ansehen", "Hilfe"],
      pt: hasProducts
        ? ["Ver todos os produtos", "Novidades", "Mais vendidos", "Ver categorias"]
        : ["Contatar suporte", "Ver loja", "Ajuda"],
      it: hasProducts
        ? ["Vedi tutti i prodotti", "Novità", "Bestseller", "Visualizza categorie"]
        : ["Contatta supporto", "Vedi negozio", "Aiuto"],
      zh: hasProducts
        ? ["显示所有产品", "新品上市", "畅销产品", "查看分类"]
        : ["联系支持", "查看商店", "帮助"],
      ja: hasProducts
        ? ["すべての製品を表示", "新着商品", "ベストセラー", "カテゴリを表示"]
        : ["サポートに連絡", "ストアを表示", "ヘルプ"]
    };

    return replies[lang] || replies['en'];
  }

  /**
   * Enhanced simple fallback processing - ALWAYS shows products when available
   * This ensures the chatbot provides value even when ALL AI services are down
   * ✅ Now uses dynamic shop policies for merchant-specific responses
   */
  private simpleFallbackProcessing(request: N8NRequest): N8NWebhookResponse {
    const { userMessage, products, context } = request;
    const lowerMessage = userMessage.toLowerCase();
    const shopPolicies = context?.shopPolicies;

    // Detect language from message and context
    const lang = this.detectLanguage(userMessage, context);
    const msgs = this.getFallbackMessages(lang, shopPolicies);

    let message = "";
    let recommendations: ProductRecommendation[] = [];
    let quickReplies: string[] = [];
    let suggestedActions: SuggestedAction[] = [];

    // CRITICAL FIX: Always try to show products if available
    const hasProducts = products && products.length > 0;

    // Try to match products based on keywords
    if (hasProducts) {
      // Check for specific product type keywords
      const keywords = lowerMessage.split(/\s+/).filter(word => word.length > 2);

      // Score products based on keyword matches
      const scoredProducts = products.map((product: any) => {
        let score = 0;
        const title = (product.title || '').toLowerCase();
        const description = (product.description || '').toLowerCase();

        keywords.forEach(keyword => {
          // Remove common words
          if (['the', 'and', 'or', 'for', 'with', 'can', 'you', 'show', 'me', 'voir', 'montre', 'des', 'les', 'une', 'un'].includes(keyword)) {
            return;
          }

          if (title.includes(keyword)) score += 5;
          if (description.includes(keyword)) score += 2;
        });

        return { ...product, score };
      });

      // Get products with matches, or just return first products if no matches
      const matchedProducts = scoredProducts.filter((p: any) => p.score > 0);

      if (matchedProducts.length > 0) {
        // Found keyword matches
        matchedProducts.sort((a: any, b: any) => b.score - a.score);
        recommendations = matchedProducts.slice(0, 6).map((p: any) => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          price: p.price || '0.00',
          image: p.image,
          description: p.description,
          relevanceScore: Math.min(100, p.score * 10)
        }));
        message = msgs.showingProducts;
      } else {
        // No keyword matches, show featured/first products
        recommendations = products.slice(0, 6).map((product: any) => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          price: product.price || '0.00',
          image: product.image,
          description: product.description,
          relevanceScore: 50
        }));

        // Check for specific intents even without product matches
        if (lowerMessage.match(/(bonjour|hello|hi|hola|salut|ciao)/i)) {
          message = msgs.welcomeBrowse;
        } else {
          message = msgs.featuredProducts;
        }
      }

      // Add quick replies for browsing
      quickReplies = this.getQuickReplies(lang, true);

    } else {
      // No products available - provide helpful message
      message = msgs.noProducts;
      quickReplies = this.getQuickReplies(lang, false);
    }

    // Handle specific queries even without products
    if (!hasProducts || recommendations.length === 0) {
      if (lowerMessage.match(/(price|cost|budget|prix|coût|precio|costo|prezzo|preço)/i)) {
        message = msgs.priceInfo;
      } else if (lowerMessage.match(/(shipping|delivery|livraison|envío|entrega|spedizione|versand)/i)) {
        message = msgs.shippingInfo;
      } else if (lowerMessage.match(/(return|refund|retour|remboursement|devolución|reembolso|reso|rimborso|rückgabe)/i)) {
        message = msgs.returnInfo;
      } else if (lowerMessage.match(/(help|aide|ayuda|ajuda|aiuto|hilfe)/i) && !hasProducts) {
        message = msgs.helpOptions;
      }
    }

    this.logger.info({
      hasProducts,
      recommendationCount: recommendations.length,
      language: lang,
      quickRepliesCount: quickReplies.length
    }, 'Simple fallback processing completed');

    return {
      message: message || msgs.welcomeBrowse,
      recommendations,
      quickReplies,
      suggestedActions,
      confidence: hasProducts && recommendations.length > 0 ? 0.6 : 0.4,
      messageType: 'fallback_mode'
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
      logError(error, 'N8N connection test failed');
      return false;
    }
  }
}

// Export a default instance that prioritizes environment variables
export const n8nService = new N8NService(); 