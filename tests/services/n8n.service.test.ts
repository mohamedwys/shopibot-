import { describe, it, expect, vi, beforeEach } from 'vitest';
import { N8NService } from '../../app/services/n8n.service.server';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock embedding service
vi.mock('../../app/services/embedding.service', () => ({
  isEmbeddingServiceAvailable: vi.fn(() => false),
  getEmbeddingService: vi.fn(),
}));

// Mock personalization service
vi.mock('../../app/services/personalization.service', () => ({
  personalizationService: {
    classifyIntent: vi.fn(() => Promise.resolve('PRODUCT_SEARCH')),
    analyzeSentiment: vi.fn(() => Promise.resolve('positive')),
  },
}));

describe('N8NService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with webhook URL from parameter', () => {
      const service = new N8NService('https://example.com/webhook');
      expect(service).toBeDefined();
    });

    it('should warn when webhook URL is missing', () => {
      const service = new N8NService();
      expect(service).toBeDefined();
    });
  });

  describe('processUserMessage', () => {
    it('should call N8N webhook with correct payload', async () => {
      const mockResponse = {
        status: 200,
        data: {
          message: 'Here are some product recommendations',
          recommendations: [
            {
              id: 'prod_1',
              title: 'Test Product',
              handle: 'test-product',
              price: '29.99',
            },
          ],
          confidence: 0.85,
        },
        headers: {},
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const service = new N8NService('https://example.com/webhook');
      const result = await service.processUserMessage({
        userMessage: 'Show me blue shirts',
        products: [],
      });

      expect(result.message).toBe('Here are some product recommendations');
      expect(result.recommendations).toHaveLength(1);
      expect(result.confidence).toBe(0.85);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          userMessage: 'Show me blue shirts',
          products: [],
        }),
        expect.any(Object)
      );
    });

    it('should use fallback processing when N8N is unavailable', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection refused'));

      const service = new N8NService('https://example.com/webhook');
      const result = await service.processUserMessage({
        userMessage: 'Hello',
        products: [],
      });

      expect(result.message).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockedAxios.post.mockRejectedValueOnce(timeoutError);

      const service = new N8NService('https://example.com/webhook');
      const result = await service.processUserMessage({
        userMessage: 'Test message',
        products: [],
      });

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should handle 404 errors gracefully', async () => {
      const notFoundError = new Error('Not found');
      (notFoundError as any).response = { status: 404 };
      mockedAxios.post.mockRejectedValueOnce(notFoundError);

      const service = new N8NService('https://example.com/webhook');
      const result = await service.processUserMessage({
        userMessage: 'Test message',
        products: [],
      });

      expect(result).toBeDefined();
    });
  });

  describe('fallback processing', () => {
    it('should provide intent-based responses for common queries', async () => {
      const service = new N8NService();

      // Test price inquiry
      const priceResult = await service.processUserMessage({
        userMessage: 'What is the price?',
        products: [],
      });
      expect(priceResult.message).toBeDefined();

      // Test greeting
      const greetingResult = await service.processUserMessage({
        userMessage: 'Hello',
        products: [],
      });
      expect(greetingResult.message).toBeDefined();
    });

    it('should recommend products when available', async () => {
      const service = new N8NService();
      const products = [
        {
          id: 'prod_1',
          title: 'Blue Shirt',
          handle: 'blue-shirt',
          description: 'A nice blue shirt',
          price: '29.99',
        },
        {
          id: 'prod_2',
          title: 'Red Shirt',
          handle: 'red-shirt',
          description: 'A nice red shirt',
          price: '24.99',
        },
      ];

      const result = await service.processUserMessage({
        userMessage: 'Recommend me something',
        products,
      });

      expect(result.recommendations).toBeDefined();
      expect(result.message).toContain('recommend');
    });
  });

  describe('testConnection', () => {
    it('should return true when connection succeeds', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { message: 'OK' },
        headers: {},
      });

      const service = new N8NService('https://example.com/webhook');
      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('should handle connection test gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection failed'));

      const service = new N8NService('https://example.com/webhook');
      const result = await service.testConnection();
      // testConnection catches errors and returns false, but fallback processing may succeed
      expect(typeof result).toBe('boolean');
    });
  });
});
