import axios from 'axios';

export interface N8NWebhookResponse {
  message: string;
  recommendations?: ProductRecommendation[];
  confidence?: number;
}

export interface ProductRecommendation {
  id: string;
  title: string;
  handle: string;
  price: string;
  image?: string;
  description?: string;
  relevanceScore?: number;
}

export interface N8NRequest {
  userMessage: string;
  products: any[];
  context?: {
    previousMessages?: string[];
    userPreferences?: any;
  };
}

export class N8NService {
  private webhookUrl: string;
  private apiKey?: string;

  constructor(webhookUrl?: string, apiKey?: string) {
    // Prioritize: 1) passed parameter, 2) environment variable, 3) fallback placeholder
    this.webhookUrl = webhookUrl || process.env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/sales-assistant';
    this.apiKey = apiKey || process.env.N8N_API_KEY;
    
    // Log the webhook URL being used for debugging
    console.log('🔧 N8N Service: Using webhook URL:', this.webhookUrl);
    console.log('🔧 N8N Service: Using API key:', this.apiKey ? '[CONFIGURED]' : '[NOT SET]');
    
    // Log important note about webhook URL format
    if (this.webhookUrl.includes('/webhook/webhook/')) {
      console.warn('⚠️ N8N Service: Webhook URL contains duplicate /webhook/ - this might cause 404 errors');
    }
  }

  async processUserMessage(request: N8NRequest): Promise<N8NWebhookResponse> {
    try {
      console.log('🚀 N8N Service: Attempting to call webhook:', this.webhookUrl);
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

      console.log('✅ N8N Service: Success! Response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ N8N Service Error - Full details:');
      console.error('Error message:', error?.message);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      console.error('Error config:', {
        url: error?.config?.url,
        method: error?.config?.method,
        headers: error?.config?.headers
      });
      
      console.log('🔄 N8N Service: Falling back to local processing');
      // Fallback to local processing if N8N is unavailable
      return this.fallbackProcessing(request);
    }
  }

  private fallbackProcessing(request: N8NRequest): N8NWebhookResponse {
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
        relevanceScore: Math.random() * 100
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
      confidence: 0.7
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