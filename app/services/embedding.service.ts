import { OpenAI } from 'openai';
import db from '../db.server';
import { logger, logError, createLogger } from '../lib/logger.server';

export interface Product {
  id: string;
  title: string;
  handle: string;
  description?: string;
  price?: string;
  image?: string;
}

export interface EmbeddingResult {
  productId: string;
  similarity: number;
  product: Product;
}

export class EmbeddingService {
  private openai: OpenAI;
  private model: string = 'text-embedding-3-small'; // Fast and cost-effective
  private logger = createLogger({ service: 'EmbeddingService' });

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set - embedding features unavailable');
      throw new Error('OpenAI API key required for embedding service');
    }

    this.openai = new OpenAI({ apiKey });
    this.logger.info({ model: this.model }, 'Initialized');
  }

  /**
   * Generate embedding vector for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Clean and prepare text
      const cleanText = this.prepareText(text);

      if (!cleanText) {
        throw new Error('Empty text after cleaning');
      }

      this.logger.debug({ textPreview: cleanText.substring(0, 50) }, 'Generating embedding');

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: cleanText,
      });

      const embedding = response.data[0].embedding;
      this.logger.debug({ dimensions: embedding.length }, 'Generated embedding');

      return embedding;
    } catch (error) {
      logError(error, 'Error generating embedding');
      throw error;
    }
  }

  /**
   * Generate embedding for a product (title + description)
   */
  async generateProductEmbedding(product: Product): Promise<number[]> {
    const text = this.createProductText(product);
    return this.generateEmbedding(text);
  }

  /**
   * Store product embedding in database
   */
  async storeProductEmbedding(
    shop: string,
    product: Product,
    embedding: number[]
  ): Promise<void> {
    try {
      await db.productEmbedding.upsert({
        where: {
          shop_productId: {
            shop,
            productId: product.id,
          },
        },
        update: {
          title: product.title,
          description: product.description || '',
          embedding: JSON.stringify(embedding),
          embeddingModel: this.model,
          updatedAt: new Date(),
        },
        create: {
          shop,
          productId: product.id,
          productHandle: product.handle,
          title: product.title,
          description: product.description || '',
          embedding: JSON.stringify(embedding),
          embeddingModel: this.model,
        },
      });

      this.logger.debug({ productId: product.id, title: product.title }, 'Stored embedding');
    } catch (error) {
      logError(error, 'Error storing embedding', { productId: product.id });
      throw error;
    }
  }

  /**
   * Get stored embedding for a product
   */
  async getProductEmbedding(shop: string, productId: string): Promise<number[] | null> {
    try {
      const stored = await db.productEmbedding.findUnique({
        where: {
          shop_productId: { shop, productId },
        },
      });

      if (!stored) {
        return null;
      }

      return JSON.parse(stored.embedding);
    } catch (error) {
      logError(error, 'Error retrieving embedding', { productId });
      return null;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Semantic search: Find products similar to a query
   */
  async semanticSearch(
    shop: string,
    query: string,
    products: Product[],
    topK: number = 5
  ): Promise<EmbeddingResult[]> {
    try {
      this.logger.debug({ query }, 'Semantic search');

      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Get or generate embeddings for all products
      const productResults: EmbeddingResult[] = [];

      for (const product of products) {
        try {
          // Try to get cached embedding
          let productEmbedding = await this.getProductEmbedding(shop, product.id);

          // Generate if not cached
          if (!productEmbedding) {
            this.logger.debug({ productTitle: product.title }, 'Generating missing embedding');
            productEmbedding = await this.generateProductEmbedding(product);
            await this.storeProductEmbedding(shop, product, productEmbedding);
          }

          // Calculate similarity
          const similarity = this.cosineSimilarity(queryEmbedding, productEmbedding);

          productResults.push({
            productId: product.id,
            similarity,
            product,
          });
        } catch (error) {
          this.logger.warn({ productId: product.id }, 'Skipping product');
          continue;
        }
      }

      // Sort by similarity (highest first) and return top K
      const topResults = productResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      this.logger.info({ count: topResults.length, topSimilarity: topResults[0]?.similarity }, 'Found semantic search results');

      return topResults;
    } catch (error) {
      logError(error, 'Semantic search error');
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple products
   */
  async batchGenerateProductEmbeddings(
    shop: string,
    products: Product[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    this.logger.info({ count: products.length }, 'Batch generating embeddings');

    for (let i = 0; i < products.length; i++) {
      try {
        const product = products[i];

        // Check if embedding already exists
        const existing = await this.getProductEmbedding(shop, product.id);
        if (existing) {
          this.logger.debug({ productTitle: product.title }, 'Skipping - already has embedding');
          if (onProgress) onProgress(i + 1, products.length);
          continue;
        }

        // Generate and store
        const embedding = await this.generateProductEmbedding(product);
        await this.storeProductEmbedding(shop, product, embedding);

        if (onProgress) onProgress(i + 1, products.length);

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logError(error, 'Error processing product', { productId: products[i].id });
        continue;
      }
    }

    this.logger.info('Batch embedding generation complete');
  }

  /**
   * Find similar products based on a product
   */
  async findSimilarProducts(
    shop: string,
    sourceProduct: Product,
    allProducts: Product[],
    topK: number = 3
  ): Promise<EmbeddingResult[]> {
    try {
      // Get or generate embedding for source product
      let sourceEmbedding = await this.getProductEmbedding(shop, sourceProduct.id);

      if (!sourceEmbedding) {
        sourceEmbedding = await this.generateProductEmbedding(sourceProduct);
        await this.storeProductEmbedding(shop, sourceProduct, sourceEmbedding);
      }

      // Compare with other products
      const similarities: EmbeddingResult[] = [];

      for (const product of allProducts) {
        // Skip the source product itself
        if (product.id === sourceProduct.id) continue;

        let productEmbedding = await this.getProductEmbedding(shop, product.id);

        if (!productEmbedding) {
          productEmbedding = await this.generateProductEmbedding(product);
          await this.storeProductEmbedding(shop, product, productEmbedding);
        }

        const similarity = this.cosineSimilarity(sourceEmbedding, productEmbedding);

        similarities.push({
          productId: product.id,
          similarity,
          product,
        });
      }

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      logError(error, 'Error finding similar products');
      throw error;
    }
  }

  /**
   * Helper: Prepare text for embedding
   */
  private prepareText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .substring(0, 8000); // Limit length (API max is 8191 tokens)
  }

  /**
   * Helper: Create searchable text from product
   */
  private createProductText(product: Product): string {
    const parts = [
      product.title,
      product.description || '',
    ];

    return parts.join(' | ').trim();
  }

  /**
   * Clear all embeddings for a shop (useful for reset)
   */
  async clearEmbeddings(shop: string): Promise<void> {
    try {
      const result = await db.productEmbedding.deleteMany({
        where: { shop },
      });

      this.logger.info({ count: result.count, shop }, 'Cleared embeddings');
    } catch (error) {
      logError(error, 'Error clearing embeddings');
      throw error;
    }
  }

  /**
   * Get embedding statistics for a shop
   */
  async getEmbeddingStats(shop: string): Promise<{
    total: number;
    oldest: Date | null;
    newest: Date | null;
  }> {
    try {
      const stats = await db.productEmbedding.aggregate({
        where: { shop },
        _count: { id: true },
        _min: { createdAt: true },
        _max: { updatedAt: true },
      });

      return {
        total: stats._count.id || 0,
        oldest: stats._min.createdAt,
        newest: stats._max.updatedAt,
      };
    } catch (error) {
      logError(error, 'Error getting embedding stats');
      return { total: 0, oldest: null, newest: null };
    }
  }
}

// Export singleton instance (will throw if no API key)
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    try {
      embeddingServiceInstance = new EmbeddingService();
    } catch (error) {
      logger.error('Failed to initialize EmbeddingService');
      throw error;
    }
  }
  return embeddingServiceInstance;
}

// Check if embedding service is available
export function isEmbeddingServiceAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
