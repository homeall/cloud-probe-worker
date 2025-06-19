console.log('Starting test runner...');
console.log('Node.js version:', process.version);

// Import the fetch function from the source
let fetch;
try {
  console.log('Importing fetch from src/index.js...');
  const module = await import('../src/index.js');
  fetch = module.fetch || module.default?.fetch || module.default;
  if (!fetch) throw new Error('Could not find fetch function in module exports');
  console.log('Successfully imported fetch function');
} catch (error) {
  console.error('Failed to import fetch function:', error);
  process.exit(1);
}

// Mock Cloudflare environment
console.log('Setting up mock environment...');
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
  const waitUntil = () => {};
  const ctx = { waitUntil };
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
console.log('Starting tests...');
runTests()
  .then(() => {
    console.log('All tests completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test suite failed:');
    console.error(error);
    process.exit(1);
  });
