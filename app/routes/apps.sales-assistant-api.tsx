import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated, sessionStorage } from "../shopify.server";
import { n8nService } from "../services/n8n.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🎯 API Route Called: /apps/sales-assistant-api');
  console.log('📥 Headers:', Object.fromEntries(request.headers.entries()));
  
  // Handle preflight CORS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
      }
    });
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
          console.log('🌐 Extracted shop domain from origin:', shopDomain);
        }
      }
    }
    
    console.log('🏪 Shop Domain:', shopDomain);
    console.log('🌐 Origin:', request.headers.get('origin'));
    
    if (!shopDomain) {
      console.log('❌ No shop domain found in headers or origin');
      return json(
        { error: "Shop domain required" }, 
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
          }
        }
      );
    }

    // For theme extensions, we'll try to get an existing session or use unauthenticated approach
    console.log('🔐 Attempting to get session for shop:', shopDomain);
    
    let admin;
    try {
      // Try to get existing session for this shop
      const session = await sessionStorage.findSessionsByShop(shopDomain);
      if (session.length > 0) {
        console.log('✅ Found existing session for shop');
        const { admin: sessionAdmin } = await authenticate.admin(request);
        admin = sessionAdmin;
      } else {
        console.log('❌ No session found, using unauthenticated approach');
        // Use unauthenticated approach for theme extensions
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
    const finalMessage = userMessage || message; // Handle both field names
    
    if (!finalMessage) {
      console.log('❌ No message found in request');
      return json({ error: "Message is required" }, { status: 400 });
    }
    
    console.log('💬 Final Message:', finalMessage);

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

    // Process message through N8N service
    console.log('🚀 Calling N8N service with request...');
    const n8nResponse = await n8nService.processUserMessage({
      userMessage: finalMessage,
      products,
      context: enhancedContext
    });
    
    return json({ 
      response: n8nResponse.message,
      recommendations: n8nResponse.recommendations || [],
      confidence: n8nResponse.confidence || 0.7,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
      }
    });

  } catch (error) {
    console.error("Sales Assistant API Error:", error);
    return json({ 
      error: "Internal server error",
      message: "Sorry, I'm having trouble processing your request right now. Please try again later."
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
      }
    });
  }
};

// Handle OPTIONS requests for CORS preflight
export const options = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
    }
  });
};

// Handle GET requests for health check
export const loader = async () => {
  return json({ 
    status: "healthy",
    service: "AI Sales Assistant API",
    timestamp: new Date().toISOString()
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Shopify-Customer-Access-Token',
    }
  });
}; 