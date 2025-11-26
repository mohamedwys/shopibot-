# N8N Sales Assistant Setup Guide

This guide explains how to set up the N8N backend for the AI Sales Assistant in your Shopify app.

## Overview

The AI Sales Assistant supports two workflow modes:

1. **Default Developer Workflow** - Pre-configured AI assistant (no setup required)
2. **Custom N8N Workflow** - Your own N8N setup for advanced customization

This guide covers setting up the **Custom N8N Workflow** option. The custom workflow allows you to:

- Use advanced AI models (OpenAI GPT-4, Claude, etc.)
- Integrate with external databases and CRMs
- Implement custom business logic
- Track and analyze customer interactions
- Create personalized shopping experiences

## Configuration Options

You can configure your N8N webhook URL in two ways:

**Option A: Admin Panel (Recommended)**
- Configure per-store through the app's admin panel
- Go to App Settings → AI Workflow Configuration
- Select "Use My Custom N8N Workflow"
- Enter your webhook URL and save

**Option B: Environment Variable**
- Set `N8N_WEBHOOK_URL` in your `.env` file
- Applies as default for all stores
- Individual stores can override through admin panel

## N8N Workflow Setup

### 1. Install N8N

You can run N8N in several ways:

**Option A: Using Docker**
```bash
docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

**Option B: Using npm**
```bash
npm install n8n -g
n8n start
```

**Option C: Using N8N Cloud**
Sign up at https://n8n.cloud for a hosted solution.

### 2. Create the Sales Assistant Workflow

1. Open N8N in your browser (default: http://localhost:5678)
2. Create a new workflow
3. Add a Webhook trigger node:
   - Set HTTP Method to POST
   - Configure the webhook path (e.g., `/webhook/sales-assistant`)
   - Authentication: None (or configure as needed)

### 3. Workflow Structure

Your N8N workflow should include these nodes:

#### A. Webhook Trigger
- Receives POST requests from the Shopify app
- Expected payload:
  ```json
  {
    "userMessage": "I need a red dress for a wedding",
    "products": [...], // Array of store products
    "context": {
      "previousMessages": [...],
      "userPreferences": {...}
    }
  }
  ```

#### B. Message Processing Node
- Use a Function node or HTTP Request node to process the user message
- Options:
  - **OpenAI Integration**: Use HTTP Request node to call OpenAI API
  - **Local AI**: Use Function node with local AI processing
  - **Custom Logic**: Implement your own recommendation logic

#### C. Product Matching Node
- Filter and rank products based on user query
- Consider factors like:
  - Keywords in product titles/descriptions
  - Price range preferences
  - Category matching
  - Availability

#### D. Response Formatting Node
- Format the response for the Shopify app
- Expected response format:
  ```json
  {
    "message": "Here are some red dresses perfect for weddings:",
    "recommendations": [
      {
        "id": "gid://shopify/Product/123",
        "title": "Elegant Red Evening Dress",
        "handle": "red-evening-dress",
        "price": "129.99",
        "image": "https://...",
        "description": "Perfect for special occasions...",
        "relevanceScore": 95
      }
    ],
    "confidence": 0.9
  }
  ```

### 4. Sample N8N Workflow with OpenAI

Here's a basic workflow structure:

1. **Webhook Trigger**
   - Path: `/webhook/sales-assistant`
   - Method: POST

2. **Function Node - Extract Data**
   ```javascript
   const userMessage = $json.userMessage;
   const products = $json.products;
   
   return {
     json: {
       userMessage,
       products: products.slice(0, 20), // Limit for API call
       productContext: products.map(p => `${p.title}: ${p.description}`).join('\n')
     }
   };
   ```

3. **HTTP Request Node - OpenAI API**
   - URL: `https://api.openai.com/v1/chat/completions`
   - Method: POST
   - Headers: 
     - `Authorization: Bearer YOUR_OPENAI_API_KEY`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "model": "gpt-4",
       "messages": [
         {
           "role": "system",
           "content": "You are a helpful sales assistant. Based on the user's message and available products, recommend the most suitable products and provide a helpful response."
         },
         {
           "role": "user",
           "content": "User message: {{$json.userMessage}}\n\nAvailable products:\n{{$json.productContext}}\n\nProvide product recommendations with explanations."
         }
       ],
       "max_tokens": 500
     }
     ```

4. **Function Node - Process AI Response**
   ```javascript
   const aiResponse = $json.choices[0].message.content;
   const products = $('Extract Data').item.json.products;
   
   // Simple product matching logic
   const userMessage = $('Extract Data').item.json.userMessage.toLowerCase();
   const recommendations = products.filter(product => {
     const title = product.title.toLowerCase();
     const description = (product.description || '').toLowerCase();
     
     // Basic keyword matching
     const keywords = userMessage.split(' ').filter(word => word.length > 3);
     return keywords.some(keyword => 
       title.includes(keyword) || description.includes(keyword)
     );
   }).slice(0, 3);
   
   return {
     json: {
       message: aiResponse,
       recommendations: recommendations,
       confidence: 0.8
     }
   };
   ```

### 5. Environment Variables

Add these variables to your `.env` file in the Shopify app root directory:

```env
# N8N Integration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/sales-assistant
N8N_API_KEY=your_n8n_api_key_if_needed

# If using OpenAI in your N8N workflow
OPENAI_API_KEY=your_openai_api_key_if_using_openai
```

**How to get these values:**

**N8N_WEBHOOK_URL:**
1. In your N8N workflow, click on the Webhook trigger node
2. Copy the "Production URL" or "Test URL"
3. Example: `https://your-n8n-instance.com/webhook/abc123def456`

**N8N_API_KEY (Optional):**
- Only needed if your N8N instance requires authentication
- Set this in your N8N instance settings under API Keys

**OPENAI_API_KEY (If using OpenAI):**
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

### 6. Testing the Integration

1. **Start your N8N workflow**
   - Activate the workflow in N8N interface
   - Ensure the webhook trigger is active

2. **Update your `.env` file**
   - Set `N8N_WEBHOOK_URL` to your actual webhook URL
   - Save the file

3. **Restart your Shopify app**
   ```bash
   # Stop the current development server (Ctrl+C or 'q')
   npm run dev
   ```

4. **Test the integration**
   - Navigate to the AI Sales Assistant page in your app
   - Send a test message like "I need a red dress for a wedding"
   - Check N8N logs to see if the webhook was triggered

5. **Verify the response**
   - The app should receive AI-powered responses from N8N
   - If N8N fails, it will automatically fall back to local processing
## Troubleshooting

### Common Issues

**1. "N8N Service Error" in console logs**
- Check if your N8N instance is running
- Verify the webhook URL is correct
- Test the webhook manually with a tool like Postman

**2. App falls back to local processing**
- This is normal behavior when N8N is unavailable
- Check your `.env` file has the correct `N8N_WEBHOOK_URL`
- Restart the Shopify development server after updating `.env`

**3. N8N webhook not receiving requests**
- Ensure the workflow is activated in N8N
- Check if the webhook trigger node is properly configured
- Verify network connectivity between Shopify app and N8N

**4. AI responses are generic**
- Check if your N8N workflow includes AI processing nodes
- Verify OpenAI API key is set (if using OpenAI)
- Review N8N execution logs for errors

### Testing N8N Connection

You can test the N8N connection manually:

```bash
curl -X POST https://your-n8n-instance.com/webhook/abc123def456 \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "test message",
    "products": [],
    "context": {}
  }'
```

Expected response:
```json
{
  "message": "AI response here",
  "recommendations": [],
  "confidence": 0.8
}
```

### 7. Advanced Features

You can enhance the workflow with:

- **Memory**: Store conversation history in a database
- **User Preferences**: Track user preferences over time
- **Inventory Integration**: Check real-time inventory levels
- **Price Monitoring**: Track price changes and promotions
- **Analytics**: Log interactions for business insights
- **Multi-language Support**: Detect and respond in different languages

### 8. Security Considerations

- Use HTTPS for all webhook URLs
- Implement authentication for N8N webhooks
- Validate input data in N8N workflows
- Store API keys securely
- Rate limit webhook calls

## Admin Panel Configuration

Once your N8N workflow is ready, configure it through the admin panel:

### Step-by-Step Configuration

1. **Access Admin Panel**
   - Go to your Shopify app at `/app/settings`
   - Look for the "AI Workflow Configuration" section

2. **Select Custom Workflow**
   - Choose "Use My Custom N8N Workflow" from the dropdown
   - The custom webhook URL field will become enabled

3. **Enter Webhook URL**
   - Paste your N8N webhook URL (must be HTTPS)
   - Example: `https://your-n8n.app.n8n.cloud/webhook/sales-assistant`
   - Click "Save Settings"

4. **Test the Integration**
   - Go to your storefront
   - Open the AI chat widget
   - Send a test message
   - Verify you receive a response from your N8N workflow

### Per-Store Configuration

**Multiple Stores**: Each store can have its own N8N configuration
- Store A: Default developer workflow
- Store B: Custom N8N workflow #1 (product recommendations)
- Store C: Custom N8N workflow #2 (customer support)

**Override Environment**: Admin panel settings override any environment variables
- Environment `N8N_WEBHOOK_URL` sets the global default
- Individual stores can specify their own webhook URLs
- Changes take effect immediately (no restart required)

### Troubleshooting

**Common Issues:**

1. **"Invalid URL" error**
   - Ensure the URL starts with `https://`
   - Check that the URL is accessible from the internet
   - Test the webhook directly with a tool like Postman

2. **No response from N8N**
   - Check N8N workflow execution logs
   - Verify the webhook trigger is properly configured
   - Ensure the response format matches the expected JSON structure

3. **Fallback responses**
   - If your N8N webhook fails, the app automatically falls back to local processing
   - Check the app's console logs for error details
   - Fix the N8N issue and the app will automatically start using it again

**Success Indicators:**
- ✅ Dropdown shows "Use My Custom N8N Workflow"
- ✅ Webhook URL field is enabled and filled
- ✅ Settings save without errors
- ✅ Widget responds with your N8N workflow's messages
- ✅ N8N execution logs show successful webhook calls

### 9. Troubleshooting

**Common Issues:**
- Webhook not receiving data: Check URL and HTTP method
- AI responses not formatted correctly: Verify response parsing
- Products not matching: Improve keyword matching logic
- Slow responses: Optimize product filtering and AI calls

**Debug Steps:**
1. Check N8N execution logs
2. Verify webhook URL is accessible
3. Test with sample data in N8N
4. Check network connectivity
5. Validate JSON response format

## Support

For N8N-specific issues, check:
- [N8N Documentation](https://docs.n8n.io/)
- [N8N Community Forum](https://community.n8n.io/)
- [N8N GitHub Repository](https://github.com/n8n-io/n8n)

For Shopify integration issues, refer to:
- [Shopify App Development Docs](https://shopify.dev/docs/apps)
- [Shopify GraphQL API Reference](https://shopify.dev/docs/api/admin-graphql) 