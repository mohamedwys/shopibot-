import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { prisma as db } from "../db.server";
import { getSecureCorsHeaders, createCorsPreflightResponse, isOriginAllowed, logCorsViolation } from "../lib/cors.server";
import { rateLimit, RateLimitPresets } from "../lib/rate-limit.server";
import { chatRequestSchema, validateData, validationErrorResponse } from "../lib/validation.server";
import { getAPISecurityHeaders, mergeSecurityHeaders } from "../lib/security-headers.server";
import { logError, createLogger } from "../lib/logger.server";
import { personalizationService } from "../services/personalization.service";
import { getPlanLimits } from "../lib/billing.server";

// Default settings (same as in settings page)
const DEFAULT_SETTINGS = {
  enabled: true,
  position: "bottom-right",
  buttonText: "Ask AI Assistant",
  chatTitle: "AI Sales Assistant",
  welcomeMessage: "Hello! I'm your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?",
  inputPlaceholder: "Ask me anything about our products...",
  primaryColor: "#e620e6",
};

// ✅ COMPREHENSIVE Intent detection system for Quick Action Buttons
type Intent =
  // Product Discovery Intents
  | { type: "BESTSELLERS" }
  | { type: "NEW_ARRIVALS" }
  | { type: "ON_SALE" }
  | { type: "RECOMMENDATIONS" }
  // Customer Support Intents (NO PRODUCTS)
  | { type: "SHIPPING_INFO" }
  | { type: "RETURNS" }
  | { type: "TRACK_ORDER" }
  | { type: "HELP_FAQ" }
  // Fallback Intents
  | { type: "PRODUCT_SEARCH"; query: string }
  | { type: "GENERAL_CHAT" };

function detectIntent(message: string): Intent {
  const lower = message.toLowerCase().trim();

  // ========================================
  // CUSTOMER SUPPORT INTENTS (NO PRODUCTS)
  // ========================================

  // Shipping Info: "Tell me about shipping and delivery"
  if (/(shipping|delivery|livraison|expédition|délai.*livraison|frais.*port)/i.test(lower)) {
    return { type: "SHIPPING_INFO" };
  }

  // Returns: "What is your return policy?"
  if (/(return|refund|exchange|retour|remboursement|échange|politique.*retour)/i.test(lower)) {
    return { type: "RETURNS" };
  }

  // Track Order: "How can I track my order?"
  if (/(track|tracking|where.*is.*my.*order|order.*status|suivre.*commande|suivi.*colis)/i.test(lower)) {
    return { type: "TRACK_ORDER" };
  }

  // Help/FAQ: "I need help with something" or "How can I talk to someone"
  if (/(help|faq|question|support|assistance|aide|besoin.*aide|customer.*service|service.*client|talk.*to.*someone|speak.*to.*someone|contact.*you|reach.*you|parler.*avec|parler.*quelqu'un|contacter|joindre|comment.*vous.*contacter)/i.test(lower)) {
    return { type: "HELP_FAQ" };
  }

  // ========================================
  // PRODUCT DISCOVERY INTENTS
  // ========================================

  // Best Sellers: "What are your best-selling products?"
  if (/(best[-\s]?selling|best[-\s]?seller|top[-\s]?seller|most[-\s]?popular|meilleur.*vente|plus.*vendus)/i.test(lower)) {
    return { type: "BESTSELLERS" };
  }

  // New Arrivals: "Show me new arrivals"
  if (/(new[-\s]?arrival|latest|recent|just[-\s]?added|nouveauté|nouveau.*produit|dernier.*ajout)/i.test(lower)) {
    return { type: "NEW_ARRIVALS" };
  }

  // On Sale: "What products are on sale?"
  if (/(on[-\s]?sale|discount|promo|deal|solde|réduction|promotion|rabais)/i.test(lower)) {
    return { type: "ON_SALE" };
  }

  // Recommendations: "Show me recommendations for me"
  if (/(recommendation|recommend.*for.*me|suggest.*for.*me|for[-\s]?you|personnalisé|recommandation)/i.test(lower)) {
    return { type: "RECOMMENDATIONS" };
  }

  // ========================================
  // FALLBACK: Generic Product Search
  // ========================================

  // T-shirts
  if (/(t[-\s]?shirt)/i.test(lower)) {
    return { type: "PRODUCT_SEARCH", query: "t-shirt" };
  }

  // Shoes
  if (/(shoe|chaussure|sneaker|boot|basket)/i.test(lower)) {
    return { type: "PRODUCT_SEARCH", query: "shoe" };
  }

  // General product queries
  if (/(show|see|display|browse|view|product|item|all.*product|categor|montre|affiche|voir|parcour|vêtement|produit|collection)/i.test(lower)) {
    return { type: "PRODUCT_SEARCH", query: "product" };
  }

  return { type: "GENERAL_CHAT" };
}

// ✅ ADDED: Sentiment analysis helper
function analyzeSentiment(message: string): string {
  const lower = message.toLowerCase();

  // Positive indicators
  if (/(love|great|amazing|excellent|perfect|awesome|thank|thanks|happy|good)/.test(lower)) {
    return "positive";
  }

  // Negative indicators
  if (/(hate|bad|terrible|awful|disappointed|angry|problem|issue|wrong)/.test(lower)) {
    return "negative";
  }

  return "neutral";
}

// ✅ ADDED: Language detection helper
function detectLanguage(message: string): string {
  const lower = message.toLowerCase();

  // French detection - expanded with more common words including very short messages
  if (/(bonjour|salut|merci|montre|produit|cherche|voudrais|pourrais|nouveauté|meilleures?|vente|jaimerais|j'aimerais|parler|quelqu'un|quelqun|comment|faire|avec|pour|suis|être|avoir|puis|peux|peut|dois|doit|besoin|aide|aidez|s'il vous plaît|svp|oui|non|vous|avez|des|chaussures|chaussure|je|veux|voir|bien|super|parfait|d'accord|ok|quoi|quel|quelle|tous|toutes|aussi)/i.test(message)) {
    return 'fr';
  }

  // Spanish detection
  if (/(hola|gracias|producto|busco|quiero|puedo|nuevo|hablar|cómo|hacer|ayuda|necesito)/i.test(message)) {
    return 'es';
  }

  // German detection
  if (/(hallo|danke|produkt|suche|möchte|kann|sprechen|wie|machen|hilfe|brauche)/i.test(message)) {
    return 'de';
  }

  // Portuguese detection
  if (/(olá|obrigado|produto|procuro|gostaria|posso|falar|como|fazer|ajuda|preciso)/i.test(message)) {
    return 'pt';
  }

  // Italian detection
  if (/(ciao|grazie|prodotto|cerco|vorrei|posso|parlare|come|fare|aiuto|bisogno)/i.test(message)) {
    return 'it';
  }

  // Default to English
  return 'en';
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ✅ SECURITY FIX: Apply rate limiting
  // Generous limit for widget settings retrieval: 300 requests per minute
  const rateLimitResponse = rateLimit(request, RateLimitPresets.GENEROUS, {
    useShop: true,
    namespace: '/api/widget-settings/loader',
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Extract shop domain from request headers
    const url = new URL(request.url);
    const shopDomain = url.searchParams.get("shop");

    if (!shopDomain) {
      // Return default settings if no shop specified
      return json(
        { settings: DEFAULT_SETTINGS },
        {
          headers: mergeSecurityHeaders(
            getSecureCorsHeaders(request),
            getAPISecurityHeaders()
          )
        }
      );
    }
    
    // Fetch settings from database
    let settings = await db.widgetSettings.findUnique({
      where: { shop: shopDomain }
    });
    
    if (!settings) {
      // Create default settings if none exist
      settings = await db.widgetSettings.create({
        data: {
          shop: shopDomain,
          ...DEFAULT_SETTINGS
        }
      });
    }

    return json(
      { settings },
      {
        headers: mergeSecurityHeaders(
          getSecureCorsHeaders(request),
          getAPISecurityHeaders()
        )
      }
    );
  } catch (error) {
    logError(error, "Error fetching widget settings");

    // Return default settings on error
    return json(
      { settings: DEFAULT_SETTINGS },
      {
        headers: mergeSecurityHeaders(
          getSecureCorsHeaders(request),
          getAPISecurityHeaders()
        )
      }
    );
  }
};

// Handle POST requests for chat messages to N8N webhook
export const action = async ({ request }: ActionFunctionArgs) => {
  const routeLogger = createLogger({ route: '/api/widget-settings' });

  // ✅ SECURITY FIX: Use secure CORS headers (whitelist Shopify domains only)
  // Handle preflight CORS request
  if (request.method === 'OPTIONS') {
    return createCorsPreflightResponse(request);
  }

  // Verify origin is allowed (defense in depth)
  const origin = request.headers.get('origin');

  // TEMPORARY: Allow app proxy requests (they may not have origin or have shopify origin)
  if (origin && !isOriginAllowed(origin)) {
    routeLogger.warn({ origin }, 'Origin not in whitelist - allowing anyway for app proxy compatibility');
  }

  // ✅ SECURITY FIX: Apply rate limiting
  // Moderate limit for chat messages: 100 requests per minute
  const rateLimitResponse = rateLimit(request, RateLimitPresets.MODERATE, {
    useShop: true,
    namespace: '/api/widget-settings/action',
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const startTime = Date.now();

  try {
    // Extract shop domain from request headers
    const url = new URL(request.url);
    const shopDomain = url.searchParams.get("shop") || request.headers.get('X-Shopify-Shop-Domain');

    routeLogger.info({ shop: shopDomain }, 'Processing chat request');

    if (!shopDomain) {
      routeLogger.warn('No shop domain found in request');
      return json(
        { error: "Shop domain required" },
        {
          status: 400,
          headers: mergeSecurityHeaders(
            getSecureCorsHeaders(request),
            getAPISecurityHeaders()
          )
        }
      );
    }
    
    // Parse the request body
    const body = await request.json();

    // ✅ SECURITY FIX: Validate request body with Zod schema
    const validation = validateData(chatRequestSchema, body);

    if (!validation.success) {
      routeLogger.warn({
        errors: validation.errors.errors.map((e: any) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code
        }))
      }, 'Validation failed');
      const errorResponse = validationErrorResponse(validation.errors);
      return json(errorResponse, {
        status: errorResponse.status,
        headers: mergeSecurityHeaders(
          getSecureCorsHeaders(request),
          getAPISecurityHeaders()
        ),
      });
    }

    const validatedData = validation.data;
    const finalMessage = validatedData.userMessage || validatedData.message;
    const context = validatedData.context || {};

    if (!finalMessage) {
      routeLogger.warn('No message found in request');
      return json(
        { error: "Message is required" },
        {
          status: 400,
          headers: mergeSecurityHeaders(
            getSecureCorsHeaders(request),
            getAPISecurityHeaders()
          ),
        }
      );
    }

    routeLogger.debug({ messageLength: finalMessage.length }, 'Processing chat message');
    console.log("========================================");
    console.log("🔍 DEBUG: User message:", finalMessage);
    console.log("🔍 DEBUG: Shop:", shopDomain);

    // ========================================
    // CONVERSATION LIMIT ENFORCEMENT
    // ========================================
    // Check conversation limits BEFORE processing to prevent overages
    try {
      // Get shop settings to determine plan
      const shopSettings = await db.widgetSettings.findUnique({
        where: { shop: shopDomain },
        select: { plan: true }
      });

      const currentPlan = shopSettings?.plan || 'BASIC';
      const planLimits = getPlanLimits(
        currentPlan === 'BYOK' ? 'BYOK Plan' :
        currentPlan === 'BASIC' ? 'Starter Plan' :
        currentPlan === 'UNLIMITED' ? 'Professional Plan' :
        'Starter Plan'
      );

      // Check if plan has conversation limits (not Infinity)
      if (planLimits.maxConversations !== Infinity) {
        // Calculate start of current billing month (1st of the month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        // Count conversations this month for this shop
        const conversationCount = await db.conversation.count({
          where: {
            shop: shopDomain,
            timestamp: {
              gte: startOfMonth
            }
          }
        });

        routeLogger.info({
          shop: shopDomain,
          plan: currentPlan,
          conversationCount,
          limit: planLimits.maxConversations,
          percentUsed: Math.round((conversationCount / planLimits.maxConversations) * 100)
        }, '📊 Conversation usage check');

        // Check if limit exceeded
        if (conversationCount >= planLimits.maxConversations) {
          routeLogger.warn({
            shop: shopDomain,
            plan: currentPlan,
            conversationCount,
            limit: planLimits.maxConversations
          }, '🚫 Conversation limit exceeded');

          return json({
            error: "conversation_limit_exceeded",
            message: `You've reached your monthly limit of ${planLimits.maxConversations.toLocaleString()} conversations. Upgrade to Professional Plan for unlimited conversations!`,
            messageType: "limit_exceeded",
            conversationsUsed: conversationCount,
            conversationLimit: planLimits.maxConversations,
            currentPlan: currentPlan,
            upgradeUrl: "/app/billing",
            upgradeAvailable: true,
            recommendations: [],
            quickReplies: ["Upgrade to Professional", "View billing"],
            success: false
          }, {
            status: 429, // 429 Too Many Requests
            headers: mergeSecurityHeaders(
              getSecureCorsHeaders(request),
              getAPISecurityHeaders()
            )
          });
        }

        // Warn if approaching limit (90% or more)
        if (conversationCount >= planLimits.maxConversations * 0.9) {
          routeLogger.warn({
            shop: shopDomain,
            plan: currentPlan,
            conversationCount,
            limit: planLimits.maxConversations,
            percentUsed: Math.round((conversationCount / planLimits.maxConversations) * 100)
          }, '⚠️ Conversation limit warning (90%+)');
        }
      } else {
        routeLogger.debug({
          shop: shopDomain,
          plan: currentPlan
        }, '✅ Unlimited conversations plan - no limit check');
      }
    } catch (limitCheckError) {
      // Log error but don't block the conversation - graceful degradation
      routeLogger.error({
        error: limitCheckError instanceof Error ? limitCheckError.message : String(limitCheckError),
        shop: shopDomain
      }, '❌ Failed to check conversation limit (non-blocking)');
      // Continue processing the message
    }

    // ✅ IMPROVED: Detect intent, sentiment, and language
    const intent = detectIntent(finalMessage);
    const sentiment = analyzeSentiment(finalMessage);
    const detectedLanguage = detectLanguage(finalMessage);

    routeLogger.debug({
      intent: intent.type,
      sentiment,
      language: detectedLanguage
    }, 'Intent, sentiment, and language detected');
    console.log("🔍 DEBUG: Detected intent:", JSON.stringify(intent));
    console.log("🔍 DEBUG: Detected sentiment:", sentiment);
    console.log("🔍 DEBUG: Detected language:", detectedLanguage);

    // ========================================
    // HANDLE SUPPORT INTENTS (NO PRODUCTS)
    // ========================================

    // Support intents return text-only responses and don't need to fetch products
    const isSupportIntent = ["SHIPPING_INFO", "RETURNS", "TRACK_ORDER", "HELP_FAQ"].includes(intent.type);

    // ✅ IMPROVED: Fetch more products (50 instead of 20) - ONLY for product intents
    let products: any[] = [];
    let productsFetchFailed = false;
    let sessionError = false;

    // Declare variables outside try block for error logging
    const variables: { first: number; query?: string; sortKey?: string; reverse?: boolean } = { first: 50 };

    // ✅ CRITICAL FIX: Only fetch products for actual product-related intents
    // Do NOT fetch for GENERAL_CHAT or support intents
    const productIntents = ["BESTSELLERS", "NEW_ARRIVALS", "ON_SALE", "RECOMMENDATIONS", "PRODUCT_SEARCH"];
    const isProductIntent = productIntents.includes(intent.type);

    if (isProductIntent) {
      try {
        console.log('🔍 STEP 1: Getting admin context for shop:', shopDomain);
        // Use unauthenticated admin (uses offline token, works in production)
        const { admin: shopAdmin } = await unauthenticated.admin(shopDomain);
        console.log('✅ STEP 2: Admin context obtained successfully');

        console.log('🛍️ DEBUG: Product intent detected, fetching from Shopify...');
        console.log('🔍 DEBUG: Intent type:', intent.type);

        // ✅ CRITICAL FIX: Build GraphQL query based on SPECIFIC intent
        let graphqlQuery = `
          #graphql
          query getProducts($first: Int!, $query: String) {
            products(first: $first, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  description
                  totalInventory
                  tags
                  featuredImage { url }
                  variants(first: 1) {
                    edges {
                      node {
                        price
                        compareAtPrice
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        // Build query based on intent type
        if (intent.type === "BESTSELLERS") {
          // Best Sellers: Use GraphQL sortKey
          graphqlQuery = `
            #graphql
            query getBestsellers($first: Int!) {
              products(first: $first, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    id
                    title
                    handle
                    description
                    totalInventory
                    tags
                    featuredImage { url }
                    variants(first: 1) {
                      edges {
                        node {
                          price
                          compareAtPrice
                        }
                      }
                    }
                  }
                }
              }
            }
          `;
          delete variables.query; // Remove query parameter for sortKey queries
        } else if (intent.type === "NEW_ARRIVALS") {
          // New Arrivals: Sort by creation date, newest first
          graphqlQuery = `
            #graphql
            query getNewArrivals($first: Int!) {
              products(first: $first, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    id
                    title
                    handle
                    description
                    totalInventory
                    tags
                    featuredImage { url }
                    variants(first: 1) {
                      edges {
                        node {
                          price
                          compareAtPrice
                        }
                      }
                    }
                  }
                }
              }
            }
          `;
          delete variables.query;
        } else if (intent.type === "ON_SALE") {
          // On Sale: Products with sale/discount tags
          variables.query = "tag:sale OR tag:discount OR tag:promo";
        } else if (intent.type === "RECOMMENDATIONS") {
          // Recommendations: Use RELEVANCE or show featured products
          graphqlQuery = `
            #graphql
            query getRecommendations($first: Int!) {
              products(first: $first, sortKey: RELEVANCE) {
                edges {
                  node {
                    id
                    title
                    handle
                    description
                    totalInventory
                    tags
                    featuredImage { url }
                    variants(first: 1) {
                      edges {
                        node {
                          price
                          compareAtPrice
                        }
                      }
                    }
                  }
                }
              }
            }
          `;
          delete variables.query;
        } else if (intent.type === "PRODUCT_SEARCH") {
          // Generic product search
          if (intent.query === "t-shirt") {
            variables.query = "product_type:t-shirt";
          } else if (intent.query === "shoe") {
            variables.query = "product_type:shoe";
          } else {
            variables.query = "status:active";
          }
        } else {
          // Default: active products
          variables.query = "status:active";
        }

        console.log('🔍 STEP 3: Building GraphQL query with:', {
          intentType: intent.type,
          graphqlQuery: variables.query || 'sortKey-based query',
          message: finalMessage
        });

        routeLogger.info({
          intentType: intent.type,
          graphqlQuery: variables.query || 'sortKey-based query',
          message: finalMessage
        }, '🔍 Query being sent to GraphQL');

        console.log('🔍 STEP 4: Sending GraphQL query...');
        const response = await shopAdmin.graphql(graphqlQuery, { variables });

        console.log('✅ STEP 5: GraphQL response received, parsing...');
        const responseData = (await response.json()) as any;
        console.log('🔍 STEP 6: Response data:', JSON.stringify(responseData).substring(0, 500));

        // ✅ CHECK FOR GRAPHQL ERRORS
        if (responseData.errors) {
          console.error('❌ STEP 7: GraphQL returned errors:', responseData.errors);
          routeLogger.error({
            graphqlErrors: responseData.errors,
            query: variables.query
          }, '❌ GraphQL query returned errors');
          productsFetchFailed = true;
          products = [];
        } else {
          console.log('✅ STEP 8: No GraphQL errors, mapping products...');
          console.log('🔍 Edges count:', responseData?.data?.products?.edges?.length || 0);
          console.log('📦 DEBUG: Raw GraphQL response:', JSON.stringify(responseData, null, 2).substring(0, 1000));
          products = responseData?.data?.products?.edges?.map((edge: any) => ({
            id: edge.node.id,
            title: edge.node.title,
            handle: edge.node.handle,
            description: edge.node.description || '',
            image: edge.node.featuredImage?.url,
            price: edge.node.variants.edges[0]?.node.price || '0.00',
            compareAtPrice: edge.node.variants.edges[0]?.node.compareAtPrice || null,
            inventory: edge.node.totalInventory || 0,
            tags: edge.node.tags || [],
            rating: null, // Add if you have review apps
            reviewCount: 0 // Add if you have review apps
          })) || [];

          console.log('✅ STEP 9: Products mapped successfully. Count:', products.length);
          console.log('🎯 DEBUG: First 3 products:', JSON.stringify(products.slice(0, 3), null, 2));
          routeLogger.info({ count: products.length, shop: shopDomain, intent: intent.type }, '✅ Fetched products');
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.error('❌ EXCEPTION in product fetch:', {
          error: errorMessage,
          stack: (error as Error).stack
        });

        // ✅ CRITICAL FIX: Detect session errors
        if (errorMessage.includes('Could not find a session') ||
            errorMessage.includes('session') ||
            errorMessage.includes('offline access token')) {
          sessionError = true;
          routeLogger.error({
            error: errorMessage,
            shop: shopDomain
          }, '❌ SESSION ERROR: Shop needs to reinstall app or session expired');
        } else {
          routeLogger.error({
            error: errorMessage,
            stack: (error as Error).stack,
            query: variables.query
          }, '❌ Failed to fetch products - exception thrown');
        }

        productsFetchFailed = true;
        products = [];
      }
    } else {
      console.log('ℹ️ Non-product intent, skipping product fetch');
      console.log('🔍 Intent type:', intent.type);
      routeLogger.info({ intent: intent.type }, 'Skipping product fetch for non-product intent');
    }

    // Enhanced context for better AI responses
    // NOTE: decryptedOpenAIKey will be added later after we fetch settings
    const enhancedContext = {
      ...context,
      customerId: context.customerId || undefined,
      customerEmail: (context.customerEmail as string) || undefined,
      previousMessages: context.previousMessages || undefined,
      sentiment: sentiment,
      intent: intent.type,
      shopDomain: shopDomain,
      locale: detectedLanguage, // ✅ ADDED: Pass detected language to AI
      languageInstruction: `IMPORTANT: Respond in ${detectedLanguage === 'fr' ? 'French' : detectedLanguage === 'es' ? 'Spanish' : detectedLanguage === 'de' ? 'German' : detectedLanguage === 'pt' ? 'Portuguese' : detectedLanguage === 'it' ? 'Italian' : 'English'}. User's language: ${detectedLanguage}`, // ✅ ADDED: Explicit language instruction
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      referer: request.headers.get('referer') || undefined,
    };

    // ✅ CRITICAL FIX: Fetch conversation history to prevent repeated greetings
    // This must happen BEFORE calling N8N so AI knows it's not the first message
    let conversationHistory: Array<{ role: string; content: string }> = [];
    let chatSessionId: string | null = null;
    let isFirstMessage = true;

    try {
      // Get session ID from context
      const sessionId = context.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Try to find existing user profile and chat session
      const userProfile = await db.userProfile.findUnique({
        where: {
          shop_sessionId: {
            shop: shopDomain,
            sessionId: sessionId
          }
        }
      });

      if (userProfile) {
        // Find active chat session (from last 24 hours)
        const chatSession = await db.chatSession.findFirst({
          where: {
            shop: shopDomain,
            userProfileId: userProfile.id,
            lastMessageAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          orderBy: {
            lastMessageAt: 'desc'
          },
          include: {
            messages: {
              orderBy: {
                timestamp: 'asc'
              },
              take: 10 // Last 10 messages
            }
          }
        });

        if (chatSession && chatSession.messages.length > 0) {
          isFirstMessage = false;
          chatSessionId = chatSession.id;

          // Convert messages to conversation history format
          conversationHistory = chatSession.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));

          routeLogger.debug({
            sessionId,
            messageCount: conversationHistory.length,
            isFirstMessage
          }, '✅ Loaded conversation history');
        }
      }

      // Add conversation history to enhanced context
      if (conversationHistory.length > 0) {
        (enhancedContext as any).previousMessages = conversationHistory.map(m => m.content);
        (enhancedContext as any).conversationHistory = conversationHistory;
        (enhancedContext as any).isFirstMessage = false;
      } else {
        (enhancedContext as any).isFirstMessage = true;
      }

    } catch (error) {
      routeLogger.warn({ error: (error as Error).message }, 'Failed to load conversation history (non-blocking)');
      // Continue without history - better to respond than fail
    }

    // ========================================
    // GET WEBHOOK URL (for all intents)
    // ========================================

    // Get webhook URL from widget settings
    let settings = null;
    let decryptedOpenAIKey: string | null = null;
    try {
      settings = await db.widgetSettings.findUnique({
        where: { shop: shopDomain },
      });

      // ✅ CRITICAL: Decrypt OpenAI API key if it exists (for BYOK plan)
      if ((settings as any)?.openaiApiKey && (settings as any)?.plan === 'BYOK') {
        try {
          const { decryptApiKey } = await import("../lib/encryption.server");
          decryptedOpenAIKey = decryptApiKey((settings as any).openaiApiKey);
          routeLogger.info({ shop: shopDomain }, '🔑 Decrypted OpenAI API key for BYOK plan');
        } catch (error) {
          routeLogger.error({
            error: error instanceof Error ? error.message : String(error),
            shop: shopDomain
          }, '❌ Failed to decrypt OpenAI API key for BYOK plan');
        }
      }

      routeLogger.debug({
        shop: shopDomain,
        workflowType: (settings as any)?.workflowType || 'DEFAULT',
        plan: (settings as any)?.plan || 'BASIC',
        hasCustomWebhook: !!(settings as any)?.webhookUrl,
        hasOpenAIKey: !!decryptedOpenAIKey
      }, 'Retrieved widget settings');
    } catch (error) {
      routeLogger.debug('Could not fetch settings from database');
      settings = null;
    }

    // ✅ IMPROVED: Determine workflow type and webhook URL based on PLAN
    const workflowType = (settings as any)?.workflowType || 'DEFAULT';
    const plan = (settings as any)?.plan || 'BASIC';
    let webhookUrl: string | undefined;
    let workflowDescription: string;

    // First check if custom workflow is selected (overrides plan-based routing)
    if (workflowType === 'CUSTOM') {
      // CUSTOM WORKFLOW: Use merchant's custom N8N webhook
      const customWebhookUrl = (settings as any)?.webhookUrl;
      const isValidCustomUrl = customWebhookUrl &&
                              typeof customWebhookUrl === 'string' &&
                              customWebhookUrl.trim() !== '' &&
                              customWebhookUrl !== 'https://' &&
                              customWebhookUrl !== 'null' &&
                              customWebhookUrl !== 'undefined' &&
                              customWebhookUrl.startsWith('https://') &&
                              customWebhookUrl.length > 8;

      if (isValidCustomUrl) {
        webhookUrl = customWebhookUrl;
        workflowDescription = 'CUSTOM N8N Workflow (merchant webhook)';
      } else {
        // Invalid custom URL - fallback to plan-based routing
        if (plan === 'BYOK') {
          webhookUrl = process.env.N8N_WEBHOOK_BYOK || process.env.N8N_WEBHOOK_URL;
          workflowDescription = 'BYOK Workflow (fallback from invalid custom URL)';
        } else {
          webhookUrl = process.env.N8N_WEBHOOK_URL;
          workflowDescription = 'DEFAULT Workflow (invalid custom URL, using fallback)';
        }
        routeLogger.warn({
          shop: shopDomain,
          customUrl: customWebhookUrl,
          plan
        }, '⚠️ Custom workflow selected but URL invalid - falling back to plan-based routing');
      }
    } else {
      // DEFAULT WORKFLOW: Use plan-based webhook routing
      if (plan === 'BYOK') {
        // BYOK Plan: Use BYOK-specific webhook (with customer's own OpenAI API key)
        webhookUrl = process.env.N8N_WEBHOOK_BYOK || process.env.N8N_WEBHOOK_URL;
        workflowDescription = 'BYOK Plan Workflow (customer API key)';
        routeLogger.info({
          shop: shopDomain,
          plan,
          hasByokWebhook: !!process.env.N8N_WEBHOOK_BYOK
        }, '🔑 Using BYOK plan webhook');
      } else if (plan === 'BASIC') {
        // BASIC Plan ($25/month): Use default webhook
        webhookUrl = process.env.N8N_WEBHOOK_URL;
        workflowDescription = 'BASIC Plan Workflow ($25/month)';
      } else if (plan === 'UNLIMITED') {
        // UNLIMITED Plan ($79/month): Use default webhook (or could be a separate one)
        webhookUrl = process.env.N8N_WEBHOOK_URL;
        workflowDescription = 'UNLIMITED Plan Workflow ($79/month)';
      } else {
        // Fallback for unknown plans
        webhookUrl = process.env.N8N_WEBHOOK_URL;
        workflowDescription = 'DEFAULT Workflow (unknown plan)';
        routeLogger.warn({
          shop: shopDomain,
          plan
        }, '⚠️ Unknown plan, using default webhook');
      }
    }

    // ✅ LOG WHICH WORKFLOW IS BEING USED
    console.log('========================================');
    console.log(`🔄 WORKFLOW: ${workflowDescription}`);
    console.log(`📍 Shop: ${shopDomain}`);
    console.log(`💎 Plan: ${plan}`);
    console.log(`🎯 Intent: ${intent.type}`);
    console.log(`🌐 Language: ${enhancedContext.locale || 'auto-detect'}`);
    console.log(`🔗 Webhook: ${webhookUrl ? webhookUrl.substring(0, 30) + '...' : 'NOT SET'}`);
    console.log('========================================');

    routeLogger.info({
      workflow: workflowDescription,
      workflowType,
      plan,
      shop: shopDomain,
      intent: intent.type,
      hasWebhook: !!webhookUrl
    }, '🔄 Using workflow');

    // ✅ CRITICAL: Add OpenAI API key and plan to enhanced context
    // This must be done AFTER fetching settings and BEFORE calling N8N
    if (decryptedOpenAIKey) {
      (enhancedContext as any).openaiApiKey = decryptedOpenAIKey;
      routeLogger.debug({ shop: shopDomain }, '🔑 Added OpenAI API key to context for N8N');
    }
    (enhancedContext as any).plan = plan;

    // ========================================
    // SUPPORT INTENT HANDLERS (NO PRODUCTS)
    // ========================================

    let n8nResponse;
    let recommendations = [];


    // ✅ AI-POWERED: Send support intents to N8N for shop-specific AI responses
    if (isSupportIntent) {
      routeLogger.info({ intent: intent.type }, '✅ Sending support query to N8N - NO PRODUCTS');

      try {
        const { N8NService } = await import("../services/n8n.service.server");
        const customN8NService = new N8NService(webhookUrl);

        // Send to N8N with intent context so AI knows it's a support query
        n8nResponse = await customN8NService.processUserMessage({
          userMessage: finalMessage,
          products: [], // NO PRODUCTS for support queries
          context: {
            ...enhancedContext,
            intentType: "customer_support",
            supportCategory: intent.type // SHIPPING_INFO, RETURNS, TRACK_ORDER, or HELP_FAQ
          }
        });

        // Ensure no products are returned for support queries
        recommendations = [];

        routeLogger.info({
          intent: intent.type,
          hasProducts: false,
          aiResponseLength: n8nResponse?.message?.length || 0
        }, '✅ Support intent handled by AI - NO PRODUCTS');

      } catch (error) {
        routeLogger.error({ error: String(error), intent: intent.type }, '❌ N8N support handler error - using fallback');

        // Fallback: Simple helpful message
        n8nResponse = {
          message: "I'm here to help! Please ask me your question and I'll do my best to assist you. 😊",
          recommendations: [],
          quickReplies: ["Shipping info", "Return policy", "Track order", "Browse products"],
          confidence: 0.5,
          messageType: "support"
        };
      }
    }
    // ========================================
    // PRODUCT INTENT HANDLERS
    // ========================================
    else {
      // ✅ Handle shop session/authentication failure for ALL product intents
      if (productsFetchFailed && isProductIntent) {
        // Shop session not available - provide helpful message
        const lang = enhancedContext.locale?.toLowerCase().split('-')[0] || 'en';

        // Different messages for session errors vs other errors
        let errorMessage: string;
        let quickReplies: string[];

        if (sessionError) {
          // ✅ SESSION ERROR: Specific message about app reinstallation
          const sessionErrorMessages: Record<string, string> = {
            fr: "⚠️ La connexion avec votre boutique a expiré. L'administrateur doit réinstaller l'application pour que je puisse accéder aux produits. En attendant, je peux répondre à vos questions générales sur la boutique.",
            en: "⚠️ The connection to the shop has expired. The shop administrator needs to reinstall the app so I can access the product catalog. In the meantime, I can help answer general questions about the store.",
            es: "⚠️ La conexión con la tienda ha caducado. El administrador de la tienda necesita reinstalar la aplicación para que pueda acceder al catálogo de productos. Mientras tanto, puedo ayudar a responder preguntas generales sobre la tienda.",
            de: "⚠️ Die Verbindung zum Shop ist abgelaufen. Der Shop-Administrator muss die App neu installieren, damit ich auf den Produktkatalog zugreifen kann. In der Zwischenzeit kann ich allgemeine Fragen zum Shop beantworten.",
            pt: "⚠️ A conexão com a loja expirou. O administrador da loja precisa reinstalar o aplicativo para que eu possa acessar o catálogo de produtos. Enquanto isso, posso ajudar a responder perguntas gerais sobre a loja.",
            it: "⚠️ La connessione al negozio è scaduta. L'amministratore del negozio deve reinstallare l'app in modo che io possa accedere al catalogo prodotti. Nel frattempo, posso aiutare a rispondere a domande generali sul negozio."
          };
          errorMessage = sessionErrorMessages[lang] || sessionErrorMessages['en'];
          quickReplies = lang === 'fr'
            ? ["Aide générale", "Informations boutique"]
            : ["General help", "Store information"];

          routeLogger.error({ shop: shopDomain }, '❌ SESSION ERROR: Shop needs to reinstall app');
        } else {
          // ✅ GENERAL ERROR: Other product fetch errors
          const generalErrorMessages: Record<string, string> = {
            fr: "Je ne peux pas accéder aux produits actuellement. Un problème temporaire est survenu. Veuillez réessayer dans quelques instants.",
            en: "I'm unable to access the product catalog right now due to a temporary issue. Please try again in a few moments.",
            es: "No puedo acceder al catálogo de productos en este momento debido a un problema temporal. Inténtelo de nuevo en unos momentos.",
            de: "Ich kann derzeit aufgrund eines vorübergehenden Problems nicht auf den Produktkatalog zugreifen. Bitte versuchen Sie es in ein paar Augenblicken erneut.",
            pt: "Não consigo acessar o catálogo de produtos no momento devido a um problema temporário. Tente novamente em alguns instantes.",
            it: "Non riesco ad accedere al catalogo prodotti in questo momento a causa di un problema temporaneo. Riprova tra qualche istante."
          };
          errorMessage = generalErrorMessages[lang] || generalErrorMessages['en'];
          quickReplies = lang === 'fr'
            ? ["Réessayer", "Aide"]
            : ["Try again", "Help"];

          routeLogger.error({ shop: shopDomain }, '❌ Product fetch failed');
        }

        n8nResponse = {
          message: errorMessage,
          recommendations: [],
          confidence: 0.3,
          messageType: "error",
          quickReplies: quickReplies
        };
      }
      // ✅ IMPROVED: Handle ALL product intents with appropriate messages
      else if (isProductIntent && products.length > 0) {
        // Direct product recommendation with intent-specific messages
        let responseText = "";
        let quickReplies: string[] = [];

        if (intent.type === "BESTSELLERS") {
          responseText = "🏆 Our Best Sellers - These are our customers' favorites!";
          quickReplies = ["Show new arrivals", "What's on sale?", "Recommendations for me"];
        } else if (intent.type === "NEW_ARRIVALS") {
          responseText = "✨ New Arrivals - Check out our latest products!";
          quickReplies = ["Show bestsellers", "What's on sale?", "Browse all products"];
        } else if (intent.type === "ON_SALE") {
          responseText = "🔥 On Sale - Great deals you don't want to miss!";
          quickReplies = ["Show bestsellers", "New arrivals", "Browse all products"];
        } else if (intent.type === "RECOMMENDATIONS") {
          responseText = "💎 Recommended For You - Handpicked just for you!";
          quickReplies = ["Show bestsellers", "What's on sale?", "New arrivals"];
        } else if (intent.type === "PRODUCT_SEARCH") {
          const messages: Record<string, string> = {
            "t-shirt": "👕 Here are our available t-shirts:",
            "shoe": "👟 Here are our shoes:",
            "product": "📦 Here are some products you might like:"
          };
          responseText = messages[(intent as any).query] || messages["product"];
          quickReplies = ["Show bestsellers", "What's on sale?", "New arrivals"];
        } else {
          responseText = "📦 Here are some products you might like:";
          quickReplies = ["Show bestsellers", "What's on sale?", "New arrivals"];
        }

        // Limit to 8 products for display
        recommendations = products.slice(0, 8);

        console.log('🎯 DEBUG: Products available for recommendations:', products.length);
        console.log('🎯 DEBUG: Recommendations to show:', recommendations.length);

        // Try N8N first, but have fallback ready
        console.log('🤖 DEBUG: Calling N8N service for AI response...');
        try {
          const { N8NService } = await import("../services/n8n.service.server");
          const customN8NService = new N8NService(webhookUrl);
          n8nResponse = await customN8NService.processUserMessage({
            userMessage: finalMessage,
            products,
            context: enhancedContext
          });

          console.log('🤖 DEBUG: Received N8N response:', n8nResponse.message.substring(0, 200));
          console.log('🤖 DEBUG: N8N recommendations count:', n8nResponse.recommendations?.length || 0);

          // ✅ TRUST THE AI: Use N8N's response and recommendations as-is
          // The AI knows best what to recommend based on the user's query
          if (n8nResponse.recommendations && n8nResponse.recommendations.length > 0) {
            recommendations = n8nResponse.recommendations;
            console.log('✅ DEBUG: Using N8N recommendations:', recommendations.length);
            routeLogger.info({ count: recommendations.length }, 'Using N8N recommendations');
          } else if (products.length > 0) {
            // Only use fallback products if N8N didn't provide any but products are available
            recommendations = recommendations;
            console.log('✅ DEBUG: Using fallback recommendations:', recommendations.length);
            routeLogger.info({ count: recommendations.length }, 'Using fallback recommendations');
          }
        } catch (error) {
          console.log('❌ DEBUG: N8N service failed:', (error as Error).message);
          routeLogger.warn({ error: (error as Error).message }, 'N8N failed, using fallback');
          // Use fallback response
          n8nResponse = {
            message: responseText,
            recommendations: recommendations,
            quickReplies: quickReplies,
            confidence: 0.8,
            messageType: "product_recommendation"
          };
        }
      }
      // ✅ NEW: Handle product intent when NO products found
      else if (isProductIntent && products.length === 0) {
        console.log('📭 DEBUG: Product intent but no products found - asking N8N for help');

        // Get language for localized message
        const lang = enhancedContext.locale?.toLowerCase().split('-')[0] || 'en';

        // Try N8N to generate a helpful response even without products
        try {
          const { N8NService } = await import("../services/n8n.service.server");
          const customN8NService = new N8NService(webhookUrl);
          n8nResponse = await customN8NService.processUserMessage({
            userMessage: finalMessage,
            products: [], // Empty array - let AI know no products found
            context: {
              ...enhancedContext,
              noProductsFound: true,
              intentType: "product_search_no_results"
            }
          });

          recommendations = [];
          console.log('✅ DEBUG: N8N handled no-products scenario');
          routeLogger.info({ intent: intent.type }, 'N8N handled product search with no results');
        } catch (error) {
          console.log('❌ DEBUG: N8N failed for no-products scenario, using fallback');

          // Fallback messages by language
          const noProductMessages: Record<string, string> = {
            fr: "Je suis désolé, nous n'avons pas de produits correspondant à votre recherche pour le moment. Puis-je vous aider à trouver autre chose ?",
            en: "I'm sorry, we don't have any products matching your search at the moment. Can I help you find something else?",
            es: "Lo siento, no tenemos productos que coincidan con tu búsqueda en este momento. ¿Puedo ayudarte a encontrar algo más?",
            de: "Es tut mir leid, wir haben derzeit keine Produkte, die Ihrer Suche entsprechen. Kann ich Ihnen helfen, etwas anderes zu finden?",
            pt: "Desculpe, não temos produtos que correspondam à sua pesquisa no momento. Posso ajudá-lo a encontrar outra coisa?",
            it: "Mi dispiace, al momento non abbiamo prodotti corrispondenti alla tua ricerca. Posso aiutarti a trovare qualcos'altro?"
          };

          const quickRepliesLang: Record<string, string[]> = {
            fr: ["Voir les meilleures ventes", "Nouveautés", "Tous les produits"],
            en: ["View bestsellers", "New arrivals", "All products"],
            es: ["Ver más vendidos", "Novedades", "Todos los productos"],
            de: ["Bestseller ansehen", "Neuankömmlinge", "Alle Produkte"],
            pt: ["Ver mais vendidos", "Novidades", "Todos os produtos"],
            it: ["Visualizza i più venduti", "Nuovi arrivi", "Tutti i prodotti"]
          };

          n8nResponse = {
            message: noProductMessages[lang] || noProductMessages['en'],
            recommendations: [],
            quickReplies: quickRepliesLang[lang] || quickRepliesLang['en'],
            confidence: 0.6,
            messageType: "no_products_found"
          };
          recommendations = [];
        }
      } else {
        // General chat - use N8N
        console.log('💬 DEBUG: General chat intent - calling N8N...');
        try {
          const { N8NService } = await import("../services/n8n.service.server");
          const customN8NService = new N8NService(webhookUrl);
          n8nResponse = await customN8NService.processUserMessage({
            userMessage: finalMessage,
            products: [], // ✅ Don't send products for general chat - let AI decide if it needs them
            context: enhancedContext
          });

          console.log('💬 DEBUG: N8N response for general chat:', n8nResponse.message ? n8nResponse.message.substring(0, 200) : '[no message]');
          console.log('💬 DEBUG: N8N recommendations count:', n8nResponse.recommendations?.length || 0);

          // ✅ TRUST THE AI: Use N8N's response as-is
          // The AI knows best how to respond to general chat queries
          recommendations = n8nResponse.recommendations || [];
          routeLogger.info({
            hasRecommendations: recommendations.length > 0,
            count: recommendations.length
          }, 'Using N8N response for general chat');
        } catch (error) {
          routeLogger.error({ error: (error as Error).message }, 'N8N service failed');

          // Fallback: Simple helpful message without forcing products
          n8nResponse = {
            message: "I'm here to help! You can ask me about products, pricing, shipping, or any questions about our store.",
            recommendations: [],
            confidence: 0.5,
            messageType: "general"
          };
          recommendations = [];
        }
      }
    }

    const responseTime = Date.now() - startTime;

    console.log('📨 DEBUG: Final response being returned:');
    console.log('  - Message:', n8nResponse.message ? n8nResponse.message.substring(0, 100) : '[no message]');
    console.log('  - Recommendations count:', recommendations.length);
    console.log('  - Confidence:', n8nResponse.confidence);
    console.log('  - Response time:', responseTime, 'ms');
    console.log("========================================");

    routeLogger.info({
      hasRecommendations: recommendations.length > 0,
      recommendationCount: recommendations.length,
      confidence: n8nResponse.confidence,
      responseTime
    }, 'Sending response');

    // ========================================
    // DATABASE PERSISTENCE FOR ANALYTICS
    // ========================================
    // Save chat data to database for dashboard analytics
    // IMPORTANT: This is non-blocking - errors won't break the chatbot
    try {
      const sessionId = context.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Step 1: Get or create UserProfile
      let userProfile = await db.userProfile.findUnique({
        where: {
          shop_sessionId: {
            shop: shopDomain,
            sessionId: sessionId
          }
        }
      });

      if (!userProfile) {
        userProfile = await db.userProfile.create({
          data: {
            shop: shopDomain,
            sessionId: sessionId,
            customerId: context.customerId as string | null || null,
            preferences: JSON.stringify({}),
            browsingHistory: JSON.stringify([]),
            purchaseHistory: JSON.stringify([]),
            interactions: JSON.stringify([])
          }
        });
        routeLogger.debug({ sessionId }, 'Created new UserProfile');
      }

      // Step 2: Get or create ChatSession
      let chatSession = await db.chatSession.findFirst({
        where: {
          shop: shopDomain,
          userProfileId: userProfile.id,
          // Find sessions from the last 24 hours (consider them active)
          lastMessageAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        orderBy: {
          lastMessageAt: 'desc'
        }
      });

      // FIX: Track if this is a new session for analytics
      let isNewSession = false;

      if (!chatSession) {
        chatSession = await db.chatSession.create({
          data: {
            shop: shopDomain,
            userProfileId: userProfile.id,
            context: JSON.stringify({
              intent: intent.type,
              sentiment: sentiment,
              language: detectedLanguage
            }),
            lastMessageAt: new Date()
          }
        });
        isNewSession = true; // FIX: Track new session creation
        routeLogger.debug({ sessionId }, 'Created new ChatSession');
      } else {
        // Update existing session
        chatSession = await db.chatSession.update({
          where: { id: chatSession.id },
          data: {
            lastMessageAt: new Date(),
            context: JSON.stringify({
              intent: intent.type,
              sentiment: sentiment,
              language: detectedLanguage
            })
          }
        });
      }

      // Step 3: Save user message
      await db.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: 'user',
          content: finalMessage,
          intent: intent.type,
          sentiment: sentiment,
          confidence: null,
          productsShown: JSON.stringify([]),
          metadata: JSON.stringify({
            language: detectedLanguage,
            timestamp: new Date().toISOString()
          })
        }
      });

      // Step 4: Save assistant message
      await db.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: 'assistant',
          content: n8nResponse.message,
          intent: intent.type,
          sentiment: 'neutral', // Assistant messages are neutral
          confidence: n8nResponse.confidence || 0.7,
          productsShown: JSON.stringify(recommendations.map((p: any) => p.id)),
          productClicked: null, // Will be updated when user clicks
          metadata: JSON.stringify({
            messageType: n8nResponse.messageType || 'general',
            responseTime: responseTime,
            hasRecommendations: recommendations.length > 0,
            recommendationCount: recommendations.length,
            timestamp: new Date().toISOString()
          })
        }
      });

      routeLogger.info({
        sessionId,
        chatSessionId: chatSession.id,
        userProfileId: userProfile.id
      }, '✅ Saved chat data to database');

      // FIX: Update ChatAnalytics aggregated data for dashboard
      await personalizationService.updateAnalytics(shopDomain, {
        intent: intent.type,
        sentiment: sentiment,
        responseTime: responseTime,
        confidence: n8nResponse.confidence || 0.7,
        workflowType: 'default', // Widget always uses default workflow
        isNewSession: isNewSession,
      });

      routeLogger.debug({
        isNewSession,
        intent: intent.type,
        sentiment: sentiment,
      }, '✅ Updated ChatAnalytics for dashboard');

    } catch (dbError) {
      // Log error but don't break the chatbot
      routeLogger.error({
        error: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined
      }, '❌ Failed to save chat data to database (non-blocking)');
      // Continue - chatbot still works even if analytics fails
    }

    // ✅ IMPROVED: Enhanced response with all fields
    return json({
      // Main response (backward compatible)
      response: n8nResponse.message,
      message: n8nResponse.message,

      // Rich response fields
      messageType: n8nResponse.messageType || (intent.type === "PRODUCT_SEARCH" ? "product_recommendation" : "general"),
      recommendations: recommendations,
      quickReplies: n8nResponse.quickReplies || [],
      suggestedActions: n8nResponse.suggestedActions || [],

      // Metadata
      confidence: n8nResponse.confidence || 0.7,
      sentiment: sentiment,
      requiresHumanEscalation: n8nResponse.requiresHumanEscalation || false,

      // Session info
      timestamp: new Date().toISOString(),
      sessionId: context.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

      // Analytics
      analytics: {
        intentDetected: intent.type,
        subIntent: intent.type === "PRODUCT_SEARCH" ? (intent as any).query : undefined,
        sentiment: sentiment,
        confidence: n8nResponse.confidence || 0.7,
        productsShown: recommendations.length,
        responseTime: responseTime,
        isSupportIntent: isSupportIntent,
        isProductIntent: !isSupportIntent,
      },

      // Legacy metadata (for backward compatibility)
      metadata: {
        intent: intent.type,
        sentiment: sentiment,
        responseTime: responseTime,
      },

      success: true,
    }, {
      headers: mergeSecurityHeaders(
        getSecureCorsHeaders(request),
        getAPISecurityHeaders()
      )
    });

  } catch (error) {
    logError(error, "Chat API Error");
    
    const responseTime = Date.now() - startTime;
    
    return json({
      error: "Internal server error",
      message: "Sorry, I'm having trouble processing your request right now. Please try again later.",
      recommendations: [],
      confidence: 0,
      success: false,
      analytics: {
        responseTime: responseTime,
        error: true
      }
    }, {
      status: 500,
      headers: mergeSecurityHeaders(
        getSecureCorsHeaders(request),
        getAPISecurityHeaders()
      )
    });
  }
};