// Simple test to verify core functionality
console.log('=== Starting Simple Test ===');

// Mock environment
const mockEnv = {
  RATE_LIMIT_KV: {
    get: () => Promise.resolve('0'),
    put: () => Promise.resolve(),
    atomic: () => ({ increment: () => Promise.resolve(1) })
  },
  API_PROBE_TOKEN: 'test-token',
  waitUntil: () => {}
};

// Import the module
try {
  console.log('Importing module...');
  const module = await import('../src/index.js');
  const fetch = module.fetch || module.default?.fetch || module.default;
  
  if (typeof fetch !== 'function') {
    throw new Error('Fetch function not found in module exports');
  }
  
  console.log('Module imported successfully!');
  
  // Test a simple request
  const request = new Request('http://example.com/ping', {
    method: 'GET',
    headers: {
      'cf-connecting-ip': '127.0.0.1'
    }
  });
  
  // Add Cloudflare properties to the request
  request.cf = {
    colo: 'DFW',
    country: 'US'
  };
  
  console.log('Sending test request...');
  const response = await fetch(request, mockEnv, { waitUntil: () => {} });
  
  console.log(`Response status: ${response.status}`);
  const body = await response.json();
  console.log('Response body:', JSON.stringify(body, null, 2));
  
  if (response.status === 200 && body.timestamp) {
    console.log('✅ Test passed!');
    process.exit(0);
  } else {
    console.error('❌ Test failed: Unexpected response');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Test failed with error:');
  console.error(error);
  process.exit(1);
}
