import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { n8nService, N8NService } from "../services/n8n.service";
import db from "../db.server";
import { getSecureCorsHeaders, createCorsPreflightResponse, isOriginAllowed, logCorsViolation } from "../lib/cors.server";
import { rateLimit, RateLimitPresets } from "../lib/rate-limit.server";
import { chatRequestSchema, validateData, validationErrorResponse } from "../lib/validation.server";
import { getAPISecurityHeaders, mergeSecurityHeaders } from "../lib/security-headers.server";
import { logger, logError, createLogger } from "../lib/logger.server";

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
  if (origin && !isOriginAllowed(origin)) {
    logCorsViolation(origin, '/api/widget-settings');
    return json(
      { error: "Unauthorized origin" },
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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

    // Try to get admin access for shop data (only on local development)
    let admin = null;

    if (process.env.VERCEL !== '1') {
      try {
        // Local development with Prisma storage
        const session = await sessionStorage.findSessionsByShop(shopDomain);
        if (session.length > 0) {
          routeLogger.debug({ shop: shopDomain }, 'Found existing session');
          const { admin: sessionAdmin } = await authenticate.admin(request);
          admin = sessionAdmin;
        } else {
          routeLogger.debug({ shop: shopDomain }, 'No session found, using unauthenticated approach');
          const { admin: unauthenticatedAdmin } = await unauthenticated.admin(shopDomain);
          admin = unauthenticatedAdmin;
        }
      } catch (error) {
        routeLogger.debug({ shop: shopDomain }, 'Authentication failed');
        admin = null;
      }
    } else {
      routeLogger.debug('Running on Vercel - skipping admin authentication');
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

    // Get products for context (skip on Vercel due to MemorySessionStorage limitations)
    let products = [];

    if (process.env.VERCEL !== '1' && admin) {
      try {
        const response = await admin.graphql(`
          #graphql
          query getProducts($first: Int!) {
            products(first: $first) {
              edges {
                node {
                  id
                  title
                  handle
                  description
                  featuredImage {
                    url
                  }
                  variants(first: 1) {
                    edges {
                      node {
                        price
                      }
                    }
                  }
                }
              }
            }
          }
        `, {
          variables: { first: 50 }
        });

        const responseData = (response as any).data;
        products = responseData?.products?.edges?.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          description: edge.node.description,
          image: edge.node.featuredImage?.url,
          price: edge.node.variants.edges[0]?.node.price || "0.00"
        })) || [];

        routeLogger.info({ count: products.length }, 'Fetched products from Shopify');
      } catch (error) {
        routeLogger.debug('Could not fetch products from Shopify');
        products = [];
      }
    } else {
      routeLogger.debug('Running on Vercel - skipping Shopify product fetch');
    }

    // Enhanced context for better AI responses
    const enhancedContext = {
      ...context,
      customerId: context.customerId || undefined,
      customerEmail: (context.customerEmail as string) || undefined,
      previousMessages: context.previousMessages || undefined,
      sentiment: context.sentiment || undefined,
      intent: context.intent || undefined,
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
    

    
    // Use custom webhook URL only if it's a valid URL (not just "https://")
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
    routeLogger.debug({
      hasWebhookUrl: !!webhookUrl,
      isCustom: isValidCustomUrl
    }, 'Processing with N8N service');

    // Create N8N service instance with custom webhook URL if provided
    const customN8NService = new N8NService(webhookUrl);

    // Process message through N8N service
    const n8nResponse = await customN8NService.processUserMessage({
      userMessage: finalMessage,
      products,
      context: enhancedContext
    });

    routeLogger.info({
      hasRecommendations: !!n8nResponse.recommendations?.length,
      confidence: n8nResponse.confidence
    }, 'N8N response received');

    return json({
      response: n8nResponse.message,
      recommendations: n8nResponse.recommendations || [],
      confidence: n8nResponse.confidence || 0.7,
      timestamp: new Date().toISOString()
    }, {
      headers: mergeSecurityHeaders(
        getSecureCorsHeaders(request),
        getAPISecurityHeaders()
      )
    });

  } catch (error) {
    logError(error, "Chat API Error");
    return json({
      error: "Internal server error",
      message: "Sorry, I'm having trouble processing your request right now. Please try again later."
    }, {
      status: 500,
      headers: mergeSecurityHeaders(
        getSecureCorsHeaders(request),
        getAPISecurityHeaders()
      )
    });
  }
}; 