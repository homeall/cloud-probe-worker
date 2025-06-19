import { fetch } from '../src/index.js';

console.log('Test runner starting...');
console.log('Node.js version:', process.version);
console.log('Environment variables:', process.env);

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
  const ctx = { waitUntil: () => {} };
  console.log('Created request:', { method, path, headers });
  return { req, ctx };
};

// Test helper
const test = async (name, fn) => {
  console.log(`\nRunning test: ${name}`);
  try {
    await fn();
    console.log(`✅ Test passed: ${name}`);
  } catch (error) {
    console.error(`❌ Test failed: ${name}`);
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Run tests
(async () => {
  console.log('Starting test suite...');
  
  await test('GET /ping should return 200 with timestamp and cf info', async () => {
    const { req, ctx } = createRequest('GET', '/ping');
    req.cf = { colo: 'DFW', country: 'US' };
    console.log('Request object:', req);
    console.log('Environment:', mockEnv);
    
    try {
      console.log('Making request to /ping...');
      const res = await fetch(req, mockEnv, ctx);
      console.log('Got response:', res.status);
      
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Response data:', data);
      if (!data.timestamp) {
        throw new Error('Response missing timestamp');
      }
      if (!data.cf?.colo || data.cf.colo !== 'DFW') {
        throw new Error('Invalid colo in response');
      }
      if (!data.cf?.country || data.cf.country !== 'US') {
        throw new Error('Invalid country in response');
      }
    } catch (error) {
      console.error('Error in test execution:', error);
      throw error;
    }
  });

  console.log('\nAll tests passed!');
})();

// Run tests
(async () => {
  console.log('Starting test suite...');
  
  await test('GET /ping should return 200 with timestamp and cf info', async () => {
    const { req, ctx } = createRequest('GET', '/ping');
    req.cf = { colo: 'DFW', country: 'US' };
    const res = await worker.fetch(req, mockEnv, ctx);
    
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
  });

  console.log('All tests passed!');
})();

// Run tests
(async () => {
  await test('GET /ping should return 200 with timestamp and cf info', async () => {
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
  });

  console.log('All tests passed!');
})();

// Run tests
(async () => {
  await test('GET /ping should return 200 with timestamp and cf info', async () => {
    const { req, ctx } = createRequest('GET', '/ping');
    req.cf = { colo: 'DFW', country: 'US' };
    const res = await worker.fetch(req, mockEnv, ctx);

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
  });

  console.log('All tests passed!');
})();
