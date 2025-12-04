# N8N Workflow Integration Guide
## Shopibot Pro - Elite AI Shopping Assistant

---

## 🎯 Overview

This document explains how the enhanced N8N workflow integrates with the Shopibot application to provide rich, intelligent responses.

## 📥 Request Format (From Shopibot to N8N)

The Shopibot app sends the following enriched payload to the N8N webhook:

```json
{
  "userMessage": "Show me red dresses under $100",
  "sessionId": "session_1234567890_abc123",
  "products": [
    {
      "id": "gid://shopify/Product/123",
      "title": "Red Summer Dress",
      "handle": "red-summer-dress",
      "description": "Beautiful red dress perfect for summer...",
      "price": "79.99",
      "compareAtPrice": "99.99",
      "image": "https://cdn.shopify.com/...",
      "inventory": 12,
      "tags": ["dress", "summer", "red"],
      "rating": 4.5,
      "reviewCount": 24
    }
  ],
  "context": {
    // Shop Context
    "shopDomain": "your-shop.myshopify.com",
    "locale": "en",
    "currency": "USD",

    // Customer Context
    "sessionId": "session_1234567890_abc123",
    "customerId": "gid://shopify/Customer/456",
    "customerEmail": "customer@example.com",

    // Page Context
    "pageUrl": "https://your-shop.com/collections/dresses",
    "currentPage": "collection",
    "currentProductId": null,
    "cartId": "cart_xyz789",

    // Conversation Context
    "userPreferences": {
      "priceRange": {"min": 0, "max": 150},
      "favoriteColors": ["red", "blue"],
      "favoriteCategories": ["dresses"]
    },
    "recentProducts": ["prod_123", "prod_456"],
    "sentiment": "neutral",
    "intent": "PRODUCT_SEARCH",

    // Metadata
    "timestamp": "2025-12-04T10:30:00.000Z",
    "userAgent": "Mozilla/5.0...",
    "referer": "https://your-shop.com/"
  }
}
```

## 📤 Response Format (From N8N to Shopibot)

Your N8N workflow returns this rich response format:

```json
{
  "message": "I found some beautiful red dresses for you! Here are my top recommendations:",
  "messageType": "product_search",

  "recommendations": [
    {
      "id": "red-summer-dress",
      "title": "Red Summer Dress",
      "handle": "red-summer-dress",
      "price": "79.99",
      "priceFormatted": "USD 79.99",
      "compareAtPrice": "99.99",
      "discountPercent": 20,
      "description": "Beautiful red dress perfect for summer events...",
      "image": "https://cdn.shopify.com/...",
      "url": "https://your-shop.myshopify.com/products/red-summer-dress",
      "isAvailable": true,
      "isLowStock": true,
      "inventory": 3,
      "relevanceScore": 92,
      "tags": ["dress", "summer", "red"],
      "rating": 4.5,
      "reviewCount": 24,
      "cta": "View Product",
      "urgencyMessage": "Only 3 left in stock!",
      "badge": "20% OFF"
    }
  ],

  "quickReplies": [
    "Show similar items",
    "What's on sale?",
    "Add to cart"
  ],

  "suggestedActions": [
    {
      "label": "View Details",
      "action": "view_product",
      "data": "red-summer-dress"
    },
    {
      "label": "Add to Cart",
      "action": "add_to_cart",
      "data": "red-summer-dress"
    },
    {
      "label": "Compare Products",
      "action": "compare",
      "data": null
    }
  ],

  "confidence": 0.92,
  "sentiment": "positive",
  "requiresHumanEscalation": false,

  "analytics": {
    "intentDetected": "product_search",
    "subIntent": "price_filter",
    "sentiment": "positive",
    "urgency": "low",
    "productsShown": 3,
    "confidence": 0.92,
    "responseTime": 450
  },

  "timestamp": "2025-12-04T10:30:01.450Z",
  "sessionId": "session_1234567890_abc123",
  "success": true,
  "error": null
}
```

## 🔄 N8N Workflow Architecture

Your current workflow "Shopibot Pro - Fixed" implements:

### 1. Enhanced Validation
- ✅ Extracts customer data (customerId, email, cartId, pageUrl)
- ✅ Security checks (bot detection, spam detection)
- ✅ IP address extraction
- ✅ Message quality validation

### 2. Advanced Intent Detection
- ✅ Primary intents: greeting, product_search, order_tracking, cart_management, pricing, sizing_help, stock_inquiry, support, reviews_request
- ✅ Sub-intents: product_comparison, price_filter, best_sellers, order_cancel, cart_add, etc.
- ✅ Sentiment analysis (positive, negative, neutral)
- ✅ Urgency detection (low, high)
- ✅ Entity extraction (order numbers, price mentions, keywords)
- ✅ Confidence scoring
- ✅ Human escalation flagging

### 3. Smart Product Intelligence
- ✅ Relevance scoring algorithm (0-100)
- ✅ Stock awareness (isAvailable, isLowStock)
- ✅ Discount calculations (discountPercent)
- ✅ Price formatting (priceFormatted with currency)
- ✅ URL generation
- ✅ Smart filtering and sorting by relevance

### 4. Elite AI Agent (GPT-4)
- ✅ Context-aware responses
- ✅ Conversation memory (per shop + session)
- ✅ Intent-based response templates
- ✅ Multi-language support

### 5. Intelligent Response Formatting
- ✅ AI message formatting
- ✅ Product recommendations with full metadata
- ✅ Quick replies generation (contextual)
- ✅ Suggested actions (view, add to cart, compare)
- ✅ Analytics tracking
- ✅ Error handling

## 🎨 Quick Replies Logic

The workflow generates contextual quick replies based on the detected intent:

| Intent | Quick Replies |
|--------|---------------|
| `greeting` | "Show me trending products", "Help me find something", "Check order status" |
| `product_search` | "Show similar items", "What's on sale?", "Add to cart" |
| `order_tracking` | "Track another order", "Modify my order", "Talk to support" |
| `cart_management` | "Continue shopping", "Apply discount code", "Proceed to checkout" |
| Other | "Browse products", "Talk to a person", "Help with something else" |

## 🛍️ Product Recommendation Scoring

The Smart Product Intelligence node scores products based on:

1. **Keyword Matching** (up to 40 points)
   - Title match: +15 points per keyword
   - Description match: +5 points per keyword
   - Tags match: +10 points per keyword

2. **Intent-Based Scoring** (up to 20 points)
   - `price_filter` sub-intent: Products under $50 get +20, under $100 get +10
   - `best_sellers` sub-intent: Products with >10 reviews get +15, rating ≥4.5 get +10

3. **Stock Availability** (up to 20 points)
   - In stock: +10
   - High inventory (>20): +5
   - Low stock (1-4): +15 (urgency boost)

4. **Discount Bonus** (+20 points)
   - Products with `compareAtPrice` > current price

**Final Score**: Capped at 100, sorted descending, top 5 selected

## 🔒 Security Features

- ✅ Bot detection via User-Agent analysis
- ✅ Spam detection (message length, URL presence)
- ✅ Empty message validation
- ✅ IP address logging
- ✅ Human escalation on high urgency + negative sentiment

## 📊 Analytics Tracking

Every response includes analytics:

```javascript
{
  intentDetected: "product_search",
  subIntent: "price_filter",
  sentiment: "positive",
  urgency: "low",
  productsShown: 3,
  confidence: 0.92,
  responseTime: 450 // milliseconds
}
```

## 🧪 Testing Your Workflow

### Test 1: Basic Product Search
**Send:**
```json
{
  "userMessage": "Show me red dresses",
  "products": [...], // Your products
  "context": {
    "shopDomain": "test-shop.myshopify.com",
    "locale": "en",
    "currency": "USD"
  }
}
```

**Expect:**
- `messageType`: "product_search"
- `subIntent`: "general_search"
- `recommendations`: Array of products
- `quickReplies`: ["Show similar items", "What's on sale?", "Add to cart"]

### Test 2: Price Filter
**Send:**
```json
{
  "userMessage": "I need a dress under $50",
  ...
}
```

**Expect:**
- `messageType`: "product_search"
- `subIntent`: "price_filter"
- Products with lower prices get higher `relevanceScore`

### Test 3: Human Escalation
**Send:**
```json
{
  "userMessage": "This is terrible! I need help NOW!",
  ...
}
```

**Expect:**
- `sentiment`: "negative"
- `urgency`: "high"
- `requiresHumanEscalation`: true

### Test 4: Order Tracking
**Send:**
```json
{
  "userMessage": "Where is my order #1234?",
  ...
}
```

**Expect:**
- `messageType`: "order_tracking"
- `subIntent`: "order_status"
- `entities.orderNumbers`: ["1234"]

## 🚀 Deployment Checklist

- [x] N8N workflow active and deployed
- [x] Webhook endpoint configured with `responseMode: "responseNode"`
- [x] OpenAI API key configured
- [x] Conversation memory enabled
- [x] Error handling paths tested
- [x] Shopibot backend updated with rich response interfaces
- [x] API route sends enriched context
- [ ] Widget UI updated to display all rich data (Phase 2)

## 🔗 Integration with Shopibot App

The Shopibot app backend is fully compatible with this workflow:

1. **Request Mapping**: The app automatically sends all required context fields
2. **Response Parsing**: The app handles both simple and rich response formats
3. **Backward Compatibility**: Old responses with just `{message, recommendations}` still work
4. **Type Safety**: All fields are typed with TypeScript interfaces

## 📝 Next Steps

### Widget UI Enhancements (Phase 2)

Now that backend + N8N workflow are complete, implement these widget features:

1. **Quick Replies Component**
   - Render buttons below chat input
   - Auto-update on each AI response
   - Click to send message

2. **Suggested Actions Bar**
   - "View Details" button → Opens product URL
   - "Add to Cart" button → Shopify AJAX API
   - "Compare Products" → Side-by-side view

3. **Enhanced Product Cards**
   - Display badges ("20% OFF", "Low Stock")
   - Show urgency messages ("Only 3 left!")
   - Strikethrough original price if discounted
   - Relevance score stars

4. **Shopify Cart Integration**
   - Use Shopify AJAX API to add products
   - Show success/error notifications
   - Update cart count

5. **Sentiment-Based UI**
   - Subtle color changes based on sentiment
   - Warmer tones for negative sentiment
   - Brighter for positive sentiment

---

## 🎉 Success Criteria

Your integration is successful when:

- ✅ All message types trigger correct intent detection
- ✅ Products are scored and sorted by relevance
- ✅ Quick replies update contextually
- ✅ Suggested actions work (view product, add to cart)
- ✅ Badges and urgency messages display correctly
- ✅ Human escalation triggers when needed
- ✅ Analytics track all interactions

---

**Workflow Version**: Shopibot Pro - Fixed
**Last Updated**: December 4, 2025
**Compatibility**: Shopibot App v2.0+ (Phase 1 Complete)
