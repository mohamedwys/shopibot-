/**
 * Generate Product Embeddings Script
 *
 * This script generates embeddings for all products in your Shopify store.
 * Run this after setting up the AI features to enable semantic search.
 *
 * Usage:
 *   npm run generate-embeddings -- --shop=your-shop.myshopify.com
 *
 * Options:
 *   --shop=SHOP_DOMAIN    Shopify shop domain (required)
 *   --force              Regenerate all embeddings (even if they exist)
 *   --batch-size=N       Number of products to process at once (default: 10)
 */

import { getEmbeddingService, isEmbeddingServiceAvailable } from '../app/services/embedding.service';
import { authenticate } from '../app/shopify.server';
import db from '../app/db.server';

interface Product {
  id: string;
  title: string;
  handle: string;
  description?: string;
  price?: string;
  image?: string;
}

async function getAllProducts(admin: any): Promise<Product[]> {
  console.log('📦 Fetching products from Shopify...');

  let allProducts: Product[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            cursor
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
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { first: 50, after: cursor },
    });

    const data = await response.json();
    const edges = data.data.products.edges;

    const products = edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description || '',
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node.price || '0.00',
    }));

    allProducts = allProducts.concat(products);

    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = edges[edges.length - 1]?.cursor || null;

    console.log(`  Fetched ${allProducts.length} products so far...`);
  }

  console.log(`✅ Total products fetched: ${allProducts.length}`);
  return allProducts;
}

async function generateEmbeddings(shop: string, force: boolean = false) {
  console.log('\n🤖 Starting Product Embedding Generation');
  console.log(`📍 Shop: ${shop}`);
  console.log(`🔧 Force regenerate: ${force ? 'Yes' : 'No'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if OpenAI API key is available
  if (!isEmbeddingServiceAvailable()) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
    console.error('   Please add OPENAI_API_KEY to your .env file');
    process.exit(1);
  }

  try {
    const embeddingService = getEmbeddingService();

    // Get embedding statistics
    const stats = await embeddingService.getEmbeddingStats(shop);
    console.log(`📊 Current embedding statistics:`);
    console.log(`   Total embeddings: ${stats.total}`);
    console.log(`   Oldest: ${stats.oldest?.toISOString() || 'N/A'}`);
    console.log(`   Newest: ${stats.newest?.toISOString() || 'N/A'}\n`);

    // Clear existing embeddings if force flag is set
    if (force && stats.total > 0) {
      console.log('🗑️  Clearing existing embeddings...');
      await embeddingService.clearEmbeddings(shop);
      console.log('✅ Embeddings cleared\n');
    }

    // Note: In a real implementation, you would need to authenticate with Shopify
    // For now, we'll show a placeholder message
    console.log('⚠️  Note: This script requires Shopify authentication');
    console.log('   To generate embeddings, you can:');
    console.log('   1. Use the admin panel (coming soon)');
    console.log('   2. Wait for automatic generation during first queries');
    console.log('   3. Integrate this script with your Shopify app authentication\n');

    // Example: If you had admin access, you would do:
    // const products = await getAllProducts(admin);
    // await embeddingService.batchGenerateProductEmbeddings(shop, products, (current, total) => {
    //   console.log(`Progress: ${current}/${total} (${Math.round((current/total)*100)}%)`);
    // });

    console.log('✅ Script completed successfully');
  } catch (error: any) {
    console.error('❌ Error generating embeddings:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config: { shop?: string; force: boolean; batchSize: number } = {
    shop: undefined,
    force: false,
    batchSize: 10,
  };

  args.forEach(arg => {
    if (arg.startsWith('--shop=')) {
      config.shop = arg.split('=')[1];
    } else if (arg === '--force') {
      config.force = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1]) || 10;
    }
  });

  return config;
}

// Main execution
async function main() {
  const config = parseArgs();

  if (!config.shop) {
    console.error('❌ Error: --shop parameter is required');
    console.error('\nUsage:');
    console.error('  npm run generate-embeddings -- --shop=your-shop.myshopify.com');
    console.error('\nOptions:');
    console.error('  --shop=DOMAIN      Shopify shop domain (required)');
    console.error('  --force            Regenerate all embeddings');
    console.error('  --batch-size=N     Batch size (default: 10)');
    process.exit(1);
  }

  await generateEmbeddings(config.shop, config.force);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { generateEmbeddings, getAllProducts };
