# N8N BYOK Workflow - Missing Node Configurations

## 1. Prepare Data Node (SET)

This node extracts data from webhook and shop settings.

**Configuration:**
```json
{
  "assignments": {
    "assignments": [
      {
        "id": "1",
        "name": "shop",
        "value": "={{ $('Webhook').item.json.body.context?.shopDomain || $('Webhook').item.json.body.shop }}",
        "type": "string"
      },
      {
        "id": "2",
        "name": "message",
        "value": "={{ $('Webhook').item.json.body.userMessage }}",
        "type": "string"
      },
      {
        "id": "3",
        "name": "sessionId",
        "value": "={{ $('Webhook').item.json.body.context?.sessionId || 'default-session' }}",
        "type": "string"
      },
      {
        "id": "4",
        "name": "products",
        "value": "={{ $('Webhook').item.json.body.products || [] }}",
        "type": "array"
      },
      {
        "id": "5",
        "name": "context",
        "value": "={{ $('Webhook').item.json.body.context || {} }}",
        "type": "object"
      },
      {
        "id": "6",
        "name": "openaiApiKey",
        "value": "={{ $('Get Shop Settings').item.json.openaiApiKey }}",
        "type": "string"
      },
      {
        "id": "7",
        "name": "chatTitle",
        "value": "={{ $('Get Shop Settings').item.json.chatTitle || 'AI Assistant' }}",
        "type": "string"
      },
      {
        "id": "8",
        "name": "welcomeMessage",
        "value": "={{ $('Get Shop Settings').item.json.welcomeMessage }}",
        "type": "string"
      },
      {
        "id": "9",
        "name": "locale",
        "value": "={{ $('Webhook').item.json.body.context?.locale || 'en' }}",
        "type": "string"
      },
      {
        "id": "10",
        "name": "noProductsFound",
        "value": "={{ $('Webhook').item.json.body.context?.noProductsFound || false }}",
        "type": "boolean"
      }
    ]
  }
}
```

## 2. Format Success Response Node (SET)

This node formats the OpenAI response into the expected format.

**Configuration:**
```json
{
  "assignments": {
    "assignments": [
      {
        "id": "1",
        "name": "message",
        "value": "={{ $('OpenAI Chat').item.json.choices[0].message.content }}",
        "type": "string"
      },
      {
        "id": "2",
        "name": "messageType",
        "value": "={{ $('Prepare Data').item.json.noProductsFound ? 'no_products_found' : ($('Prepare Data').item.json.products.length > 0 ? 'product_recommendation' : 'general') }}",
        "type": "string"
      },
      {
        "id": "3",
        "name": "recommendations",
        "value": "={{ $('Prepare Data').item.json.products.slice(0, 6).map(p => ({\n  id: p.id,\n  title: p.title,\n  handle: p.handle,\n  price: p.price,\n  image: p.image,\n  description: p.description,\n  relevanceScore: 70\n})) }}",
        "type": "array"
      },
      {
        "id": "4",
        "name": "quickReplies",
        "value": "={{ $('Prepare Data').item.json.locale === 'fr' ? ['Voir les meilleures ventes', 'Nouveautés', 'Tous les produits'] : ['Show bestsellers', 'New arrivals', 'All products'] }}",
        "type": "array"
      },
      {
        "id": "5",
        "name": "confidence",
        "value": 0.85,
        "type": "number"
      },
      {
        "id": "6",
        "name": "sentiment",
        "value": "neutral",
        "type": "string"
      },
      {
        "id": "7",
        "name": "requiresHumanEscalation",
        "value": false,
        "type": "boolean"
      },
      {
        "id": "8",
        "name": "success",
        "value": true,
        "type": "boolean"
      },
      {
        "id": "9",
        "name": "analytics",
        "value": "={{ {\n  intentDetected: $('Prepare Data').item.json.context.intent || 'GENERAL_CHAT',\n  productsShown: $('Prepare Data').item.json.products.length,\n  responseTime: 0\n} }}",
        "type": "object"
      },
      {
        "id": "10",
        "name": "timestamp",
        "value": "={{ $now.toISO() }}",
        "type": "string"
      }
    ]
  }
}
```

## 3. Format Error Response Node (SET)

This node formats error responses when API key is missing or OpenAI fails.

**Configuration:**
```json
{
  "assignments": {
    "assignments": [
      {
        "id": "1",
        "name": "message",
        "value": "={{ $('Prepare Data').item.json.locale === 'fr' ? 'Je m\\'excuse, mais je rencontre des difficultés techniques. Veuillez réessayer dans un instant.' : 'I apologize, but I\\'m experiencing technical difficulties. Please try again in a moment.' }}",
        "type": "string"
      },
      {
        "id": "2",
        "name": "messageType",
        "value": "error",
        "type": "string"
      },
      {
        "id": "3",
        "name": "recommendations",
        "value": [],
        "type": "array"
      },
      {
        "id": "4",
        "name": "quickReplies",
        "value": "={{ $('Prepare Data').item.json.locale === 'fr' ? ['Contacter le support', 'Réessayer'] : ['Contact support', 'Try again'] }}",
        "type": "array"
      },
      {
        "id": "5",
        "name": "confidence",
        "value": 0.3,
        "type": "number"
      },
      {
        "id": "6",
        "name": "sentiment",
        "value": "neutral",
        "type": "string"
      },
      {
        "id": "7",
        "name": "requiresHumanEscalation",
        "value": true,
        "type": "boolean"
      },
      {
        "id": "8",
        "name": "success",
        "value": false,
        "type": "boolean"
      },
      {
        "id": "9",
        "name": "timestamp",
        "value": "={{ $now.toISO() }}",
        "type": "string"
      }
    ]
  }
}
```

## How to Apply These Configurations:

1. **In N8N UI:**
   - Click on "Prepare Data" node
   - Go to "Assignments" section
   - Click "+ Add Assignment" for each field above
   - Copy the name and value for each assignment

2. **Or Import JSON:**
   - Edit each node
   - Switch to JSON view
   - Replace the `parameters` section with the config above

## Testing the Workflow:

Send a test request to your webhook:
```bash
curl -X POST https://your-n8n-instance.app.n8n.cloud/webhook/byok-chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "userMessage": "vous avez des chaussures",
      "products": [],
      "shop": "test.myshopify.com",
      "context": {
        "shopDomain": "test.myshopify.com",
        "locale": "fr",
        "sessionId": "test-session-123",
        "intent": "PRODUCT_SEARCH",
        "noProductsFound": false
      }
    }
  }'
```

Expected response format:
```json
{
  "message": "AI response here...",
  "messageType": "product_recommendation",
  "recommendations": [...],
  "quickReplies": ["..."],
  "confidence": 0.85,
  "sentiment": "neutral",
  "requiresHumanEscalation": false,
  "success": true,
  "analytics": {...},
  "timestamp": "2026-01-08T..."
}
```
