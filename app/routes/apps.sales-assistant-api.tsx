import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { n8nService } from "../services/n8n.service";
import { personalizationService } from "../services/personalization.service";
import { prisma as db } from "../db.server";
import { getSecureCorsHeaders, createCorsPreflightResponse, isOriginAllowed, logCorsViolation } from "../lib/cors.server";
import { rateLimit, RateLimitPresets } from "../lib/rate-limit.server";
import { chatRequestSchema, validateData, validationErrorResponse } from "../lib/validation.server";
import { getAPISecurityHeaders, mergeSecurityHeaders } from "../lib/security-headers.server";
import { logError } from "../lib/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Handle preflight CORS request
  if (request.method === 'OPTIONS') {
    return createCorsPreflightResponse(request);
  }

  // Verify origin is allowed (defense in depth)
  const origin = request.headers.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    logCorsViolation(origin, '/apps/sales-assistant-api');
    return json(
      { error: "Unauthorized origin" },
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // ✅ SECURITY FIX: Apply rate limiting
  // Moderate limit: 100 requests per minute for chat messages
  const rateLimitResponse = rateLimit(request, RateLimitPresets.MODERATE, {
    useShop: true,
    namespace: '/apps/sales-assistant-api',
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get shop domain from headers for theme extension
    let shopDomain = request.headers.get('X-Shopify-Shop-Domain');

    // Fallback: extract shop domain from origin header
    if (!shopDomain) {
      const origin = request.headers.get('origin');
      if (origin && origin.includes('.myshopify.com')) {
        const match = origin.match(/https:\/\/([^.]+)\.myshopify\.com/);
        if (match) {
          shopDomain = match[1] + '.myshopify.com';
        }
      }
    }

    if (!shopDomain) {
      return json(
        { error: "Shop domain required" },
        {
          status: 400,
          headers: getSecureCorsHeaders(request)
        }
      );
    }

    // For theme extensions, we'll try to get an existing session or use unauthenticated approach
    let admin;
    try {
      // Try to get existing session for this shop
      const session = await sessionStorage.findSessionsByShop(shopDomain);
      if (session.length > 0) {
        const { admin: sessionAdmin } = await authenticate.admin(request);
        admin = sessionAdmin;
      } else {
        // Use unauthenticated approach for theme extensions
        const { admin: unauthenticatedAdmin } = await unauthenticated.admin(shopDomain);
        admin = unauthenticatedAdmin;
      }
    } catch (error) {
      const { admin: unauthenticatedAdmin } = await unauthenticated.admin(shopDomain);
      admin = unauthenticatedAdmin;
    }

    // Parse the request body
    const body = await request.json();

    // ✅ SECURITY FIX: Validate request body with Zod schema
    const validation = validateData(chatRequestSchema, body);

    if (!validation.success) {
      const errorResponse = validationErrorResponse(validation.errors);
      return json(errorResponse, {
        status: errorResponse.status,
        headers: getSecureCorsHeaders(request),
      });
    }

    const validatedData = validation.data;
    const finalMessage = validatedData.userMessage || validatedData.message;

    if (!finalMessage) {
      return json(
        { error: "Message is required" },
        {
          status: 400,
          headers: getSecureCorsHeaders(request),
        }
      );
    }

    // Generate or extract session ID
    const context = validatedData.context || {};
    const sessionId = context.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const customerId = context.customerId;

    // Get products for context
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
    const products = responseData?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node.price || "0.00"
    })) || [];

    // Get or create user profile and session
    const userProfile = await personalizationService.getOrCreateUserProfile(
      shopDomain,
      sessionId,
      customerId || undefined
    );

    const chatSession = await personalizationService.getOrCreateChatSession(
      shopDomain,
      userProfile.id
    );

    // Classify intent and sentiment
    const startTime = Date.now();
    const [intent, sentiment] = await Promise.all([
      personalizationService.classifyIntent(finalMessage),
      personalizationService.analyzeSentiment(finalMessage),
    ]);

    // Save user message to database
    await personalizationService.saveChatMessage(
      chatSession.id,
      'user',
      finalMessage,
      { intent, sentiment }
    );

    // Track interaction
    await personalizationService.trackInteraction(userProfile.id, {
      type: 'message',
      message: finalMessage,
      timestamp: Date.now(),
    });

    // Get personalization context
    const personalizationContext = await personalizationService.getPersonalizationContext(
      shopDomain,
      sessionId,
      customerId || undefined
    );

    // Enhanced context for better AI responses
    const enhancedContext = {
      // Shop context
      shopDomain: shopDomain,
      locale: (context.locale as string) || 'en', // Get from request body or default to 'en'
      currency: (context.currency as string) || 'USD', // Get from request body or default to 'USD'

      // Customer context
      sessionId: sessionId,
      customerId: customerId || undefined,
      customerEmail: (context.customerEmail as string) || undefined,

      // Page context
      pageUrl: (context.pageUrl as string) || request.headers.get('referer') || '',
      currentPage: ((context.currentPage as string) || 'other') as 'product' | 'cart' | 'checkout' | 'collection' | 'home' | 'other',
      currentProductId: (context.currentProductId as string) || undefined,
      cartId: (context.cartId as string) || undefined,

      // Conversation context
      userPreferences: personalizationContext.preferences,
      recentProducts: personalizationContext.recentProducts,
      sentiment: sentiment,
      intent: intent,

      // Legacy/metadata fields
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      referer: request.headers.get('referer') || undefined,
    };

    // Get custom webhook URL from settings if available
    const widgetSettings = await db.widgetSettings.findUnique({
      where: { shop: shopDomain },
    });

    // Process message through N8N service (or fallback with AI enhancements)
    // Add language instruction to context for AI
    const languageInstruction = enhancedContext.locale && enhancedContext.locale !== 'en'
      ? `IMPORTANT: Respond in the user's language (${enhancedContext.locale}). Detect the language from their message and use the same language in your response.`
      : '';

    const n8nResponse = await n8nService.processUserMessage({
      userMessage: finalMessage,
      products,
      context: {
        ...enhancedContext,
        languageInstruction // Add explicit instruction for N8N workflow
      }
    });

    // Validate N8N response
    if (!n8nResponse || !n8nResponse.message) {
      throw new Error('Invalid response from N8N service');
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Save assistant response to database
    await personalizationService.saveChatMessage(
      chatSession.id,
      'assistant',
      n8nResponse.message,
      {
        intent,
        sentiment,
        confidence: n8nResponse.confidence,
        productsShown: (n8nResponse.recommendations || []).map(r => r.id),
      }
    );

    // Learn from this interaction
    if (n8nResponse.recommendations && n8nResponse.recommendations.length > 0) {
      await personalizationService.learnPreferences(
        userProfile.id,
        finalMessage,
        n8nResponse.recommendations.map(r => r.id)
      );
    }

    // Update analytics
    await personalizationService.updateAnalytics(shopDomain, {
      intent,
      sentiment,
      responseTime,
      confidence: n8nResponse.confidence,
    });

    return json(
      {
        // Main response (backward compatible)
        response: n8nResponse.message,
        message: n8nResponse.message, // Also include as 'message' for consistency

        // Rich response fields
        messageType: n8nResponse.messageType || 'general',
        recommendations: n8nResponse.recommendations || [],
        quickReplies: n8nResponse.quickReplies || [],
        suggestedActions: n8nResponse.suggestedActions || [],

        // Metadata
        confidence: n8nResponse.confidence || 0.7,
        sentiment: n8nResponse.sentiment || sentiment,
        requiresHumanEscalation: n8nResponse.requiresHumanEscalation || false,

        // Session info
        timestamp: new Date().toISOString(),
        sessionId: sessionId,

        // Analytics
        analytics: {
          intentDetected: n8nResponse.analytics?.intentDetected || intent,
          subIntent: n8nResponse.analytics?.subIntent,
          sentiment: n8nResponse.sentiment || sentiment,
          confidence: n8nResponse.confidence || 0.7,
          productsShown: n8nResponse.recommendations?.length || 0,
          responseTime: n8nResponse.analytics?.responseTime || responseTime,
        },

        // Legacy metadata (for backward compatibility)
        metadata: {
          intent,
          sentiment,
          responseTime,
        },

        success: true,
      },
      {
        headers: mergeSecurityHeaders(
          getSecureCorsHeaders(request),
          getAPISecurityHeaders()
        )
      }
    );

  } catch (error) {
    // Log error with structured logging (no PII)
    logError(error, 'Sales Assistant API Error');

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

// Handle GET requests for health check
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({
    status: "healthy",
    service: "AI Sales Assistant API",
    timestamp: new Date().toISOString()
  }, {
    headers: mergeSecurityHeaders(
      getSecureCorsHeaders(request),
      getAPISecurityHeaders()
    )
  });
}; 