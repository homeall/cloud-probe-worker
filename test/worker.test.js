import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import worker from '../src/index.js';

// Mock the KV namespace
const mockKV = {
  get: jest.fn(),
  put: jest.fn().mockResolvedValue(undefined),
};

const env = {
  RATE_LIMIT_KV: mockKV,
  API_PROBE_TOKEN: 'test-token',
};

const createRequest = (method, path, headers = {}, body = null) => {
  const { req, res } = createMocks({
    method,
    url: `https://example.com${path}`,
    headers: {
      'cf-connecting-ip': '127.0.0.1',
      ...headers,
    },
  }, {
    eventEmitter: require('events').EventEmitter,
  });

  if (body) {
    req.body = body;
  }

  return { req, res };
};

describe('Cloud Probe Worker', () => {
  beforeAll(() => {
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /ping', () => {
    it('should return 200 with timestamp and cf info', async () => {
      const { req, res } = createRequest('GET', '/ping');
      req.cf = { colo: 'DFW', country: 'US' };

      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('timestamp');
      expect(data.cf).toHaveProperty('colo', 'DFW');
    });
  });

  describe('GET /info', () => {
    it('should return client and edge information', async () => {
      const { req, res } = createRequest('GET', '/info');
      req.cf = {
        city: 'Test City',
        country: 'US',
        colo: 'DFW'
      };

      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.ip).toBe('127.0.0.1');
      expect(data.city).toBe('Test City');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under the rate limit', async () => {
      mockKV.get.mockResolvedValueOnce('10'); // Current count

      const { req, res } = createRequest('GET', '/ping');
      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(200);
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should block requests over the rate limit', async () => {
      mockKV.get.mockResolvedValueOnce('30'); // Over limit

      const { req, res } = createRequest('GET', '/ping');
      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(429);
    });
  });

  describe('Authentication', () => {
    it('should require token for protected endpoints', async () => {
      const { req, res } = createRequest('GET', '/speed');

      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(401);
    });

    it('should allow access with valid token', async () => {
      global.fetch.mockResolvedValueOnce(new Response('test'));

      const { req, res } = createRequest('GET', '/speed', {
        'x-api-probe-token': 'test-token'
      });

      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Speed Test', () => {
    it('should return speed test data', async () => {
      global.fetch.mockResolvedValueOnce(new Response('test'));

      const { req, res } = createRequest('GET', '/speed?size=100', {
        'x-api-probe-token': 'test-token'
      });

      await worker.fetch(req, env);

      expect(res._getStatusCode()).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
