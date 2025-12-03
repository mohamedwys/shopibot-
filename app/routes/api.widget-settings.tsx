import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { n8nService, N8NService } from "../services/n8n.service";
import db from "../db.server";
import { getSecureCorsHeaders, createCorsPreflightResponse, isOriginAllowed, logCorsViolation } from "../lib/cors.server";
import { rateLimit, RateLimitPresets } from "../lib/rate-limit.server";
import { chatRequestSchema, validateData, validationErrorResponse } from "../lib/validation.server";
import { getAPISecurityHeaders, mergeSecurityHeaders } from "../lib/security-headers.server";

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
    console.error("Error fetching widget settings:", error);

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
  console.log('🎯 Chat Message via Widget Settings Route');
  console.log('📥 Headers:', Object.fromEntries(request.headers.entries()));

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
    
    console.log('🏪 Shop Domain:', shopDomain);

    if (!shopDomain) {
      console.log('❌ No shop domain found');
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
          console.log('✅ Found existing session for shop');
          const { admin: sessionAdmin } = await authenticate.admin(request);
          admin = sessionAdmin;
        } else {
          console.log('❌ No session found, using unauthenticated approach');
          const { admin: unauthenticatedAdmin } = await unauthenticated.admin(shopDomain);
          admin = unauthenticatedAdmin;
        }
      } catch (error) {
        console.log('⚠️ Authentication failed:', error);
        admin = null;
      }
    } else {
      console.log('🔧 Running on Vercel - skipping admin authentication');
    }
    
    // Parse the request body
    const body = await request.json();
    console.log('📝 Request Body:', JSON.stringify(body, null, 2));

    // ✅ SECURITY FIX: Validate request body with Zod schema
    const validation = validateData(chatRequestSchema, body);

    if (!validation.success) {
      console.error('❌ Validation failed:', validation.errors);
      console.error('❌ Request body was:', JSON.stringify(body, null, 2));
      console.error('❌ Detailed errors:', validation.errors.errors.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code
      })));
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
      console.log('❌ No message found in request');
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
    
    console.log('💬 Processing message:', finalMessage);

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

        console.log(`✅ Fetched ${products.length} products from Shopify`);
      } catch (error) {
        console.log('⚠️ Could not fetch products from Shopify:', error);
        products = [];
      }
    } else {
      console.log('🔧 Running on Vercel - skipping Shopify product fetch');
    }

    // Enhanced context for better AI responses
    const enhancedContext = {
      ...context,
      shopDomain: shopDomain,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    };

    // Get webhook URL from widget settings
    let settings = null;
    try {
      settings = await db.widgetSettings.findUnique({
        where: { shop: shopDomain },
      });
      console.log('✅ Retrieved settings from database for shop:', shopDomain);
      console.log('🔧 Custom webhook URL from settings:', (settings as any)?.webhookUrl);
    } catch (error) {
      console.log('⚠️ Could not fetch settings from database:', error);
      settings = null;
    }
    

    
    // Use custom webhook URL only if it's a valid URL (not just "https://")
    const customWebhookUrl = (settings as any)?.webhookUrl;
    const isValidCustomUrl = customWebhookUrl && 
                            typeof customWebhookUrl === 'string' && 
                            customWebhookUrl.trim() !== '' && 
                            customWebhookUrl !== 'https://' &&
                            customWebhookUrl.startsWith('https://') &&
                            customWebhookUrl.length > 8;
    
    const webhookUrl = isValidCustomUrl ? customWebhookUrl : process.env.N8N_WEBHOOK_URL;
    console.log('🔧 Final webhook URL being used:', webhookUrl);
    console.log('🔧 Is using custom URL:', isValidCustomUrl);
    
    // Create N8N service instance with custom webhook URL if provided
    const customN8NService = new N8NService(webhookUrl);
    
    // Process message through N8N service
    console.log('🚀 Calling N8N service with request...');
    const n8nResponse = await customN8NService.processUserMessage({
      userMessage: finalMessage,
      products,
      context: enhancedContext
    });
    
    console.log('✅ N8N Response received:', n8nResponse);

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
    console.error("Chat API Error:", error);
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