# 🤖 Advanced AI Features Documentation

## Overview

This document describes the advanced AI features implemented in ShopiBot, including **semantic search with embeddings** and **personalization** capabilities.

---

## 🚀 Features

### 1. **Semantic Search with Embeddings**

Transform your product search from simple keyword matching to intelligent, context-aware recommendations.

**How it works:**
- Product descriptions are converted into high-dimensional vectors (embeddings)
- User queries are also converted to embeddings
- Cosine similarity finds semantically similar products
- Results understand intent, not just keywords

**Examples:**
- Query: *"something cozy for winter"* → Finds sweaters, blankets, warm clothing
- Query: *"gift for a tech lover"* → Finds gadgets, electronics, accessories
- Query: *"elegant dress for wedding"* → Finds formal dresses, appropriate styles

**Benefits:**
- ✅ Better search results than keyword matching
- ✅ Understands synonyms and related concepts
- ✅ Finds products even with vague descriptions
- ✅ Improves over time with usage

---

### 2. **User Personalization**

Track user behavior and preferences to provide tailored recommendations.

**What we track:**
- 🎨 **Color preferences** - Learn favorite colors from conversations
- 💰 **Price range** - Remember budget constraints
- 📦 **Categories** - Track interested product types
- 👀 **Browsing history** - Remember viewed products
- 💬 **Chat interactions** - Learn from past conversations

**How it's used:**
- Boost recommendations for previously viewed products
- Filter by learned price preferences
- Prioritize favorite categories
- Personalize AI responses based on history

---

### 3. **Intent Classification**

Automatically detect what the customer wants to do.

**Supported intents:**
- `PRODUCT_SEARCH` - Looking for products
- `PRICE_INQUIRY` - Asking about pricing
- `COMPARISON` - Comparing products
- `AVAILABILITY` - Checking stock
- `SHIPPING` - Delivery questions
- `RETURNS` - Return policy questions
- `SIZE_FIT` - Size/fit inquiries
- `SUPPORT` - Technical support
- `GREETING` - Starting conversation
- `THANKS` - Expressing gratitude

**Benefits:**
- Provide context-appropriate responses
- Route complex queries appropriately
- Track which topics customers care about
- Improve response accuracy

---

### 4. **Sentiment Analysis**

Understand customer emotions to provide better service.

**Sentiment types:**
- 😊 **Positive** - Happy, satisfied customers
- 😐 **Neutral** - Informational queries
- 😟 **Negative** - Frustrated, unhappy customers

**Use cases:**
- Escalate negative sentiment to human support
- Track customer satisfaction metrics
- Adjust response tone based on sentiment
- Identify problem areas in products/service

---

### 5. **Analytics & Insights**

Track chatbot performance and customer behavior.

**Metrics tracked:**
- 📊 **Total messages** - Conversation volume
- ⏱️ **Response time** - Performance monitoring
- 🎯 **Top intents** - What customers ask about
- 🛍️ **Top products** - Most clicked/viewed
- 😊 **Sentiment breakdown** - Customer satisfaction
- 🎨 **Confidence scores** - AI accuracy

**View analytics:**
- Daily aggregated statistics
- Intent distribution charts (coming soon)
- Product popularity trends (coming soon)
- Sentiment analysis dashboard (coming soon)

---

## 📦 Setup Instructions

### Prerequisites

1. **OpenAI API Key** (required for embeddings)
   ```bash
   # Add to .env file
   OPENAI_API_KEY=sk-your-api-key-here
   ```

2. **Dependencies installed**
   ```bash
   npm install
   ```

### Step-by-Step Setup

#### 1. Update Database Schema

```bash
npm run setup-ai
```

This script will:
- Generate Prisma client
- Run database migrations
- Create new tables for AI features

#### 2. Generate Product Embeddings

```bash
npm run generate-embeddings -- --shop=your-shop.myshopify.com
```

**Options:**
- `--shop=DOMAIN` - Your Shopify shop domain (required)
- `--force` - Regenerate all embeddings
- `--batch-size=N` - Process N products at once (default: 10)

**Note:** Initial embedding generation can take a few minutes depending on product count.

#### 3. Restart Your App

```bash
shopify app dev
```

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Required for embeddings and advanced AI
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Specify embedding model (default: text-embedding-3-small)
EMBEDDING_MODEL=text-embedding-3-small

# Optional: N8N webhook for custom AI processing
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/sales-assistant
N8N_API_KEY=your-n8n-api-key
```

### Embedding Models

Choose between OpenAI embedding models:

| Model | Dimensions | Cost | Speed | Best For |
|-------|-----------|------|-------|----------|
| `text-embedding-3-small` | 1536 | Lowest | Fastest | Production (recommended) |
| `text-embedding-3-large` | 3072 | Higher | Slower | Maximum accuracy |
| `text-embedding-ada-002` | 1536 | Medium | Medium | Legacy support |

**Recommendation:** Use `text-embedding-3-small` for best cost/performance balance.

---

## 🎯 How It Works

### Architecture Flow

```
1. User sends message
   ↓
2. Create/get user profile & session
   ↓
3. Classify intent & sentiment
   ↓
4. Generate query embedding
   ↓
5. Search product embeddings (semantic search)
   ↓
6. Apply personalization boost
   ↓
7. Generate AI response
   ↓
8. Save to database & update analytics
   ↓
9. Learn preferences from interaction
   ↓
10. Return response to user
```

### Database Schema

**New Tables:**

#### ProductEmbedding
```sql
- id: Unique identifier
- shop: Shop domain
- productId: Shopify product ID
- title: Product title
- description: Product description
- embedding: Vector embedding (JSON array)
- embeddingModel: Model used to generate
```

#### UserProfile
```sql
- id: Unique identifier
- shop: Shop domain
- sessionId: Browser session ID
- customerId: Shopify customer ID (optional)
- preferences: JSON (colors, price, categories)
- browsingHistory: JSON (viewed products)
- purchaseHistory: JSON (bought products)
- interactions: JSON (chat interactions)
```

#### ChatSession
```sql
- id: Unique identifier
- shop: Shop domain
- userProfileId: Link to user profile
- context: JSON (conversation context)
- lastMessageAt: Last activity timestamp
```

#### ChatMessage
```sql
- id: Unique identifier
- sessionId: Link to chat session
- role: 'user' or 'assistant'
- content: Message text
- intent: Classified intent
- sentiment: positive/neutral/negative
- confidence: AI confidence score
- productsShown: JSON (product IDs)
```

#### ChatAnalytics
```sql
- id: Unique identifier
- shop: Shop domain
- date: Date (for daily aggregation)
- totalMessages: Count of messages
- avgResponseTime: Average response time
- avgConfidence: Average AI confidence
- topIntents: JSON (intent distribution)
- topProducts: JSON (popular products)
- sentimentBreakdown: JSON (sentiment stats)
```

---

## 💡 Usage Examples

### Example 1: Semantic Search

**User:** *"I need something warm for a mountain trip"*

**Without embeddings (keyword):**
- Searches for: "warm", "mountain", "trip"
- May miss: jackets, thermal wear, camping gear

**With embeddings:**
- Understands: outdoor clothing, cold weather gear
- Finds: winter jackets, thermal layers, hiking boots
- Even if descriptions don't mention exact keywords!

### Example 2: Personalization

**First interaction:**
- User: *"Show me blue dresses under $100"*
- System learns: prefers blue, budget $100

**Later interaction:**
- User: *"What dresses do you have?"*
- System: Prioritizes blue dresses, filters by $100 budget
- Remembers context without user repeating preferences!

### Example 3: Intent-Based Responses

**Shipping query:**
- User: *"When will my order arrive?"*
- Intent: `SHIPPING`
- Response: Shipping information with tracking details

**Negative sentiment:**
- User: *"This product is broken!"*
- Sentiment: `NEGATIVE`
- Action: Escalate to human support, offer return process

---

## 📊 API Integration

### Request Format

```typescript
POST /apps/sales-assistant-api

{
  "userMessage": "Show me winter jackets",
  "context": {
    "sessionId": "session_abc123",  // Preserve across requests
    "customerId": "123456",          // If logged in
    "shopDomain": "mystore.myshopify.com"
  }
}
```

### Response Format

```typescript
{
  "response": "Here are some great winter jackets...",
  "recommendations": [
    {
      "id": "gid://shopify/Product/123",
      "title": "Arctic Winter Jacket",
      "handle": "arctic-jacket",
      "price": "89.99",
      "image": "https://...",
      "description": "Warm insulated jacket...",
      "relevanceScore": 95  // 0-100 based on embedding similarity
    }
  ],
  "confidence": 0.87,  // AI confidence (0-1)
  "sessionId": "session_abc123",  // Return to client
  "metadata": {
    "intent": "PRODUCT_SEARCH",
    "sentiment": "positive",
    "responseTime": 1234  // milliseconds
  }
}
```

---

## 🔍 Monitoring & Debugging

### Check Embedding Status

```typescript
import { getEmbeddingService } from './app/services/embedding.service';

const service = getEmbeddingService();
const stats = await service.getEmbeddingStats('your-shop.myshopify.com');

console.log(stats);
// {
//   total: 150,
//   oldest: 2024-01-15T10:00:00Z,
//   newest: 2024-01-20T15:30:00Z
// }
```

### View User Profile

```sql
-- View user preferences
SELECT * FROM UserProfile WHERE sessionId = 'session_abc123';

-- View chat history
SELECT * FROM ChatMessage WHERE sessionId IN (
  SELECT id FROM ChatSession WHERE userProfileId = 'user_xyz'
);
```

### Check Analytics

```sql
-- Daily statistics
SELECT * FROM ChatAnalytics
WHERE shop = 'mystore.myshopify.com'
ORDER BY date DESC
LIMIT 30;

-- Top intents
SELECT
  date,
  topIntents
FROM ChatAnalytics
WHERE shop = 'mystore.myshopify.com';
```

---

## 🚀 Performance Optimization

### Caching Strategies

**Embeddings are cached:**
- Stored in database after first generation
- Only regenerated when product changes
- Reduces API calls to OpenAI

**User profiles persist:**
- Session-based for guests
- Customer-based for logged-in users
- Preferences retained across sessions

### Cost Optimization

**Embedding costs** (OpenAI):
- `text-embedding-3-small`: ~$0.02 per 1M tokens
- Average product: ~100 tokens
- 1000 products ≈ 100K tokens ≈ $0.002

**Example monthly cost:**
- 1000 products: $0.002 (one-time)
- 10,000 queries/month: $0.20
- **Total: ~$0.20/month**

---

## 🐛 Troubleshooting

### Issue: Embeddings not generating

**Check:**
1. Is `OPENAI_API_KEY` set in `.env`?
2. Run: `npm run generate-embeddings -- --shop=your-shop`
3. Check logs for API errors

### Issue: Search results not accurate

**Solutions:**
1. Regenerate embeddings: `--force` flag
2. Check product descriptions quality
3. Try larger embedding model

### Issue: Personalization not working

**Check:**
1. SessionId being preserved across requests?
2. Check UserProfile table for data
3. Verify preferences are being learned

### Issue: High API costs

**Optimize:**
1. Use `text-embedding-3-small` model
2. Cache embeddings (already done!)
3. Reduce search frequency
4. Batch process product updates

---

## 📚 Further Reading

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Semantic Search Explained](https://www.pinecone.io/learn/what-is-semantic-search/)
- [Personalization Best Practices](https://www.shopify.com/retail/personalization)

---

## 🆘 Support

Need help? Check:
- Main [README.md](README.md) for general setup
- [N8N_SETUP.md](N8N_SETUP.md) for N8N integration
- [SETUP.md](SETUP.md) for Shopify app setup

Or open an issue on GitHub!

---

**Version:** 2.0.0
**Last Updated:** November 2024
**Author:** ShopiBot Team
