async function main() {
  console.log('Starting test runner...');
  console.log('Node.js version:', process.version);

  // Import the worker fetch function
  try {
    console.log('Importing worker fetch from src/index.js...');
    const { workerFetch } = await import('../src/index.js');
    if (!workerFetch) throw new Error('Could not find worker fetch function in module exports');
    console.log('Successfully imported worker fetch function');

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
    }

    // Test suite
    const runTests = async () => {
      console.log('Running tests...');
      try {
        // Test /ping endpoint
        {
          const { req, ctx } = createRequest('GET', '/ping');
          req.cf = { colo: 'DFW', country: 'US' };
          const res = await workerFetch(req, mockEnv, ctx);
          
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

        // Test /info endpoint
        {
          const { req, ctx } = createRequest('GET', '/info');
          const res = await workerFetch(req, mockEnv, ctx);
          
          if (res.status !== 200) {
            throw new Error(`Expected status 200, got ${res.status}`);
          }
          
          const data = await res.json();
          if (!data.version) {
            throw new Error('Response missing version');
          }
          if (!data.gitCommit) {
            throw new Error('Response missing gitCommit');
          }
          if (!data.buildTime) {
            throw new Error('Response missing buildTime');
          }
        }

        // Test /healthz endpoint
        {
          const { req, ctx } = createRequest('GET', '/healthz');
          const res = await workerFetch(req, mockEnv, ctx);
          
          if (res.status !== 200) {
            throw new Error(`Expected status 200, got ${res.status}`);
          }
          
          const data = await res.json();
          if (!data.status) {
            throw new Error('Response missing status');
          }
          if (data.status !== 'ok') {
            throw new Error('Health check failed');
          }
        }

        console.log('All tests passed!');
      } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
      }
    }

    // Run the tests
    console.log('Starting tests...');
    await runTests();
    console.log('Tests completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Failed to import worker:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
