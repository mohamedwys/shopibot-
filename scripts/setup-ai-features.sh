#!/bin/bash

# Setup AI Features - Database Migration and Configuration
# This script sets up the advanced AI features including embeddings and personalization

echo "🚀 Setting up Advanced AI Features for ShopiBot..."
echo ""

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  WARNING: OPENAI_API_KEY not set in environment"
    echo "   Embeddings and advanced personalization will not work without it."
    echo "   Add to your .env file:"
    echo "   OPENAI_API_KEY=sk-your-api-key-here"
    echo ""
fi

# Step 1: Generate Prisma client
echo "📦 Step 1/3: Generating Prisma client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi
echo "✅ Prisma client generated"
echo ""

# Step 2: Run database migration
echo "🗄️  Step 2/3: Running database migration..."
npx prisma migrate dev --name add_ai_features
if [ $? -ne 0 ]; then
    echo "❌ Migration failed"
    echo "   You may need to run: npx prisma migrate reset"
    exit 1
fi
echo "✅ Database migrated successfully"
echo ""

# Step 3: Instructions for next steps
echo "📝 Step 3/3: Next steps for setup"
echo ""
echo "✅ Database schema updated with:"
echo "   • ProductEmbedding - for semantic search"
echo "   • UserProfile - for personalization"
echo "   • ChatSession & ChatMessage - for conversation tracking"
echo "   • ChatAnalytics - for performance insights"
echo ""
echo "🔧 To enable embeddings and advanced AI:"
echo "   1. Add OPENAI_API_KEY to your .env file"
echo "   2. Run: npm run generate-embeddings"
echo "   3. Restart your app: shopify app dev"
echo ""
echo "📊 To view analytics (coming soon):"
echo "   Navigate to /app/analytics in your admin panel"
echo ""
echo "✅ Setup complete! Your AI features are ready to use."
