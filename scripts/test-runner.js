import { describe, it, expect } from '@jest/globals';
import worker from '../src/index.js';

// Mock Cloudflare environment
const mockEnv = {
  RATE_LIMIT_KV: {
    get: () => Promise.resolve('0'),
    put: () => Promise.resolve(),
    atomic: () => ({ increment: () => Promise.resolve(1) })
  },
  API_PROBE_TOKEN: 'test-token',
  waitUntil: () => {}
};

// Mock request factory
const createRequest = (method, path, headers = {}, body = null) => {
  const init = {
    method,
    headers: {
      'cf-connecting-ip': '127.0.0.1',
      ...headers
    }
  };
  if (body) {
    init.body = body;
  }
  const req = new Request(`https://example.com${path}`, init);
  const ctx = { waitUntil: jest.fn() };
  return { req, ctx };
};

// Test suite
describe('Cloud Probe Worker', () => {
  describe('GET /ping', () => {
    it('should return 200 with timestamp and cf info', async () => {
      const { req, ctx } = createRequest('GET', '/ping');
      req.cf = { colo: 'DFW', country: 'US' };
      const res = await worker.fetch(req, mockEnv, ctx);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('timestamp');
      expect(data.cf).toHaveProperty('colo', 'DFW');
      expect(data.cf).toHaveProperty('country', 'US');
    });
  });
});
