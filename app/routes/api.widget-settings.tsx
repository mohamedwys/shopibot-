import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { N8NService } from "../services/n8n.service";
import { prisma as db } from "../db.server";
import { getSecureCorsHeaders, createCorsPreflightResponse, isOriginAllowed, logCorsViolation } from "../lib/cors.server";
import { rateLimit, RateLimitPresets } from "../lib/rate-limit.server";
import { chatRequestSchema, validateData, validationErrorResponse } from "../lib/validation.server";
import { getAPISecurityHeaders, mergeSecurityHeaders } from "../lib/security-headers.server";
import { logError, createLogger } from "../lib/logger.server";

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

// ✅ ADDED: Intent detection system (same as chatbot)
type Intent = 
  | { type: "PRODUCT_SEARCH"; query: string }
  | { type: "GENERAL_CHAT" };

function detectIntent(message: string): Intent {
  const lower = message.toLowerCase().trim();

  // French keywords
  if (
    /(?:montre|affiche|voir|recommande|parcour|browse|t-shirt|tshirt|chaussure|vêtement|produit|collection|best[-\s]?seller|meilleur|nouveau|tous les produits|catégorie)/.test(lower)
  ) {
    if (/(t[-\s]?shirt)/.test(lower)) return { type: "PRODUCT_SEARCH", query: "t-shirt" };
    if (/chaussure|shoe|basket/.test(lower)) return { type: "PRODUCT_SEARCH", query: "shoe" };
    if (/best[-\s]?seller|bestsell|meilleur/.test(lower)) return { type: "PRODUCT_SEARCH", query: "bestseller" };
    if (/nouveau|new/.test(lower)) return { type: "PRODUCT_SEARCH", query: "new" };
    return { type: "PRODUCT_SEARCH", query: "product" };
  }

  // English keywords
  if (
    /(show|see|display|recommend|suggest|browse|view|best[-\s]?seller|on sale|product|item|all products|categor)/.test(lower)
  ) {
    if (/t[-\s]?shirt/.test(lower)) return { type: "PRODUCT_SEARCH", query: "t-shirt" };
    if (/shoe|sneaker|boot/.test(lower)) return { type: "PRODUCT_SEARCH", query: "shoe" };
    if (/best[-\s]?seller/.test(lower)) return { type: "PRODUCT_SEARCH", query: "bestseller" };
    if (/new|latest/.test(lower)) return { type: "PRODUCT_SEARCH", query: "new" };
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

    // ✅ IMPROVED: Detect intent and sentiment
    const intent = detectIntent(finalMessage);
    const sentiment = analyzeSentiment(finalMessage);
    
    routeLogger.debug({ intent: intent.type, sentiment }, 'Intent and sentiment detected');

    // ✅ IMPROVED: Fetch more products (50 instead of 20)
    let products: any[] = [];
    let productsFetchFailed = false;
    let sessionError = false;

    // Declare variables outside try block for error logging
    const variables: { first: number; query?: string } = { first: 50 };

    try {
      console.log('🔍 STEP 1: Getting admin context for shop:', shopDomain);
      // Use unauthenticated admin (uses offline token, works in production)
      const { admin: shopAdmin } = await unauthenticated.admin(shopDomain);
      console.log('✅ STEP 2: Admin context obtained successfully');

      // ✅ IMPROVED: Build GraphQL query based on intent
      if (intent.type === "PRODUCT_SEARCH") {
        if (intent.query === "bestseller") {
          variables.query = "tag:bestseller";
        } else if (intent.query === "t-shirt") {
          variables.query = "product_type:t-shirt";
        } else if (intent.query === "shoe") {
          variables.query = "product_type:shoe";
        } else if (intent.query === "new") {
          // ✅ FIX: Fetch all active products (will show newest or use tag:new if available)
          variables.query = "status:active";
        } else {
          variables.query = "status:active";
        }
      } else {
        variables.query = "status:active";
      }

      console.log('🔍 STEP 3: Building GraphQL query with:', {
        intentType: intent.type,
        intentQuery: intent.query,
        graphqlQuery: variables.query,
        message: finalMessage
      });

      routeLogger.info({
        intentType: intent.type,
        intentQuery: intent.query,
        graphqlQuery: variables.query,
        message: finalMessage
      }, '🔍 Query being sent to GraphQL');

      console.log('🔍 STEP 4: Sending GraphQL query...');
      const response = await shopAdmin.graphql(`
        #graphql
        query getProducts($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                description
                featuredImage { url }
                variants(first: 1) {
                  edges { node { price } }
                }
              }
            }
          }
        }
      `, { variables });

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
        products = responseData?.data?.products?.edges?.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          description: edge.node.description || '',
          image: edge.node.featuredImage?.url,
          price: edge.node.variants.edges[0]?.node.price || '0.00'
        })) || [];

        console.log('✅ STEP 9: Products mapped successfully. Count:', products.length);
        routeLogger.info({ count: products.length, shop: shopDomain, query: variables.query }, '✅ Fetched products');
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

    // Enhanced context for better AI responses
    const enhancedContext = {
      ...context,
      customerId: context.customerId || undefined,
      customerEmail: (context.customerEmail as string) || undefined,
      previousMessages: context.previousMessages || undefined,
      sentiment: sentiment,
      intent: intent.type,
      shopDomain: shopDomain,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      referer: request.headers.get('referer') || undefined,
    };

    // Get webhook URL from widget settings
    let settings = null;
    try {
      settings = await db.widgetSettings.findUnique({
        where: { shop: shopDomain },
      });
      routeLogger.debug({
        shop: shopDomain,
        hasCustomWebhook: !!(settings as any)?.webhookUrl
      }, 'Retrieved widget settings');
    } catch (error) {
      routeLogger.debug('Could not fetch settings from database');
      settings = null;
    }
    
    // Use custom webhook URL only if it's a valid URL
    const customWebhookUrl = (settings as any)?.webhookUrl;
    const isValidCustomUrl = customWebhookUrl &&
                            typeof customWebhookUrl === 'string' &&
                            customWebhookUrl.trim() !== '' &&
                            customWebhookUrl !== 'https://' &&
                            customWebhookUrl !== 'null' &&
                            customWebhookUrl !== 'undefined' &&
                            customWebhookUrl.startsWith('https://') &&
                            customWebhookUrl.length > 8;

    const webhookUrl = isValidCustomUrl ? customWebhookUrl : process.env.N8N_WEBHOOK_URL;
    
    let n8nResponse;
    let recommendations = [];

    // ✅ CRITICAL FIX: Handle shop session/authentication failure
    if (productsFetchFailed && intent.type === "PRODUCT_SEARCH") {
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
    // ✅ IMPROVED: Handle product search intent directly OR use N8N
    else if (intent.type === "PRODUCT_SEARCH" && products.length > 0) {
      // Direct product recommendation (fallback if N8N fails)
      const messages: Record<string, string> = {
        "t-shirt": "👕 Here are our available t-shirts:",
        "shoe": "👟 Here are our shoes:",
        "bestseller": "⭐ Discover our bestsellers:",
        "new": "✨ Check out our new arrivals:",
        "product": "📦 Here are some products you might like:"
      };

      const responseText = messages[intent.query] || messages["product"];

      // Limit to 8 products for display
      recommendations = products.slice(0, 8);

      // Try N8N first, but have fallback ready
      try {
        const customN8NService = new N8NService(webhookUrl);
        n8nResponse = await customN8NService.processUserMessage({
          userMessage: finalMessage,
          products,
          context: enhancedContext
        });

        // ✅ CRITICAL FIX: Detect when AI incorrectly says it has no products
        // Check if the response message indicates "no products" but we actually have products
        const noProductPatterns = [
          /n'ai pas.*détails.*produits/i,  // "n'ai pas de détails sur les produits"
          /pas.*informations.*produits/i,  // "pas d'informations sur les produits"
          /no.*details.*products/i,         // "no details on products"
          /don't have.*details/i,           // "don't have details"
          /can't.*access.*products/i,       // "can't access products"
          /unable.*access.*catalog/i,       // "unable to access catalog"
          /malheureusement/i,               // "unfortunately" (often precedes error messages)
        ];

        const messageIndicatesNoProducts = noProductPatterns.some(pattern =>
          pattern.test(n8nResponse.message)
        );

        // If AI says "no products" but we have products, override the response
        if (messageIndicatesNoProducts && products.length > 0) {
          routeLogger.warn(
            { aiMessage: n8nResponse.message.substring(0, 100) },
            '⚠️ AI incorrectly said no products available - overriding with actual products'
          );
          n8nResponse = {
            message: responseText,
            recommendations: recommendations,
            confidence: 0.8,
            messageType: "product_recommendation"
          };
        }
        // Use N8N recommendations if available, otherwise use our fallback
        else if (n8nResponse.recommendations && n8nResponse.recommendations.length > 0) {
          recommendations = n8nResponse.recommendations;
          routeLogger.info({ count: recommendations.length }, 'Using N8N recommendations');
        } else {
          routeLogger.info({ count: recommendations.length }, 'Using fallback recommendations');
        }
      } catch (error) {
        routeLogger.warn({ error: (error as Error).message }, 'N8N failed, using fallback');
        // Use fallback response
        n8nResponse = {
          message: responseText,
          recommendations: recommendations,
          confidence: 0.8,
          messageType: "product_recommendation"
        };
      }
    } else {
      // General chat - use N8N
      try {
        const customN8NService = new N8NService(webhookUrl);
        n8nResponse = await customN8NService.processUserMessage({
          userMessage: finalMessage,
          products,
          context: enhancedContext
        });
        recommendations = n8nResponse.recommendations || [];

        // ✅ CRITICAL FIX: Detect when AI incorrectly says it has no products (same as PRODUCT_SEARCH)
        const noProductPatterns = [
          /n'ai pas.*détails.*produits/i,  // "n'ai pas de détails sur les produits"
          /pas.*informations.*produits/i,  // "pas d'informations sur les produits"
          /no.*details.*products/i,         // "no details on products"
          /don't have.*details/i,           // "don't have details"
          /can't.*access.*products/i,       // "can't access products"
          /unable.*access.*catalog/i,       // "unable to access catalog"
          /malheureusement/i,               // "unfortunately" (often precedes error messages)
        ];

        const messageIndicatesNoProducts = noProductPatterns.some(pattern =>
          pattern.test(n8nResponse.message)
        );

        // If AI says "no products" but we have products, override the response
        if (messageIndicatesNoProducts && products.length > 0) {
          routeLogger.warn(
            { aiMessage: n8nResponse.message.substring(0, 100) },
            '⚠️ AI incorrectly said no products available in general chat - overriding'
          );
          n8nResponse = {
            message: "Here are some products you might be interested in:",
            recommendations: products.slice(0, 6),
            confidence: 0.7,
            messageType: "product_recommendation"
          };
          recommendations = products.slice(0, 6);
        }
        // ✅ If N8N doesn't return products but we have products available, show them
        else if ((!recommendations || recommendations.length === 0) && products.length > 0) {
          recommendations = products.slice(0, 6);
          routeLogger.info({ count: recommendations.length }, 'Added products to N8N response');
        }
      } catch (error) {
        routeLogger.error({ error: (error as Error).message }, 'N8N service failed');

        // ✅ CRITICAL FIX: Fallback response with products if available
        if (products.length > 0) {
          n8nResponse = {
            message: "Here are some products you might be interested in:",
            recommendations: products.slice(0, 6),
            confidence: 0.7,
            messageType: "product_recommendation"
          };
          recommendations = products.slice(0, 6);
        } else {
          n8nResponse = {
            message: "I'm here to help! You can ask me about products, pricing, shipping, or any questions about our store.",
            recommendations: [],
            confidence: 0.5,
            messageType: "general"
          };
        }
      }
    }

    const responseTime = Date.now() - startTime;

    routeLogger.info({
      hasRecommendations: recommendations.length > 0,
      recommendationCount: recommendations.length,
      confidence: n8nResponse.confidence,
      responseTime
    }, 'Sending response');

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
        subIntent: intent.type === "PRODUCT_SEARCH" ? intent.query : undefined,
        sentiment: sentiment,
        confidence: n8nResponse.confidence || 0.7,
        productsShown: recommendations.length,
        responseTime: responseTime,
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