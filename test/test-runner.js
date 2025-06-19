import { fetch } from '../src/index.js';

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
async function runTests() {
  console.log('Running tests...');
  
  // Test /ping endpoint
  {
    const { req, ctx } = createRequest('GET', '/ping');
    req.cf = { colo: 'DFW', country: 'US' };
    const res = await fetch(req, mockEnv, ctx);
    
    if (res.status !== 200) {
      throw new Error(`Expected status 200, got ${res.status}`);
    }
    
    const data = await res.json();
    if (!data.timestamp) {
      throw new Error('Response missing timestamp');
    }
    if (!data.cf?.colo || data.cf.colo !== 'DFW') {
      throw new Error('Invalid colo in response');
    }
    if (!data.cf?.country || data.cf.country !== 'US') {
      throw new Error('Invalid country in response');
    }
  }
  
  console.log('All tests passed!');
}

// Run the tests
runTests().catch(console.error);
