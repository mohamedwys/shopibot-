import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { n8nService, N8NService } from "../services/n8n.service";
import db from "../db.server";

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
  try {
    // Extract shop domain from request headers
    const url = new URL(request.url);
    const shopDomain = url.searchParams.get("shop");
    
    if (!shopDomain) {
      // Return default settings if no shop specified
      const response = json({ settings: DEFAULT_SETTINGS });
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type");
      return response;
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
    
    const response = json({ settings });
    
    // Add CORS headers to allow the storefront to access this endpoint
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    
    return response;
  } catch (error) {
    console.error("Error fetching widget settings:", error);
    
    // Return default settings on error
    const response = json({ settings: DEFAULT_SETTINGS });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    
    return response;
  }
};

// Handle POST requests for chat messages to N8N webhook
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🎯 Chat Message via Widget Settings Route');
  console.log('📥 Headers:', Object.fromEntries(request.headers.entries()));
  
  // Handle preflight CORS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
      }
    });
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
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
          }
        }
      );
    }

    // Try to get admin access for shop data
    let admin;
    try {
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
      console.log('⚠️ Authentication failed, trying unauthenticated admin:', error);
      const { admin: unauthenticatedAdmin } = await unauthenticated.admin(shopDomain);
      admin = unauthenticatedAdmin;
    }
    
    // Parse the request body
    const body = await request.json();
    console.log('📝 Request Body:', JSON.stringify(body, null, 2));
    
    const { userMessage, message, context } = body;
    const finalMessage = userMessage || message;
    
    if (!finalMessage) {
      console.log('❌ No message found in request');
      return json({ error: "Message is required" }, { status: 400 });
    }
    
    console.log('💬 Processing message:', finalMessage);

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

    // Enhanced context for better AI responses
    const enhancedContext = {
      ...context,
      shopDomain: shopDomain,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    };

    // Get webhook URL from widget settings
    const settings = await db.widgetSettings.findUnique({
      where: { shop: shopDomain },
    });
    

    
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
      }
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return json({ 
      error: "Internal server error",
      message: "Sorry, I'm having trouble processing your request right now. Please try again later."
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
      }
    });
  }
}; 