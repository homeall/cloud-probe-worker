// Jest setup for ES modules

// Mock import.meta.env for tests
globalThis.import = new Proxy(globalThis.import, {
  apply(target, thisArg, args) {
    if (args[0] === 'meta') {
      return Promise.resolve({
        env: {
          VERSION: 'test-version',
          GIT_COMMIT: 'test-commit',
          BUILD_TIME: '2024-06-19'
        }
      });
    }
    return target.apply(thisArg, args);
  }
});

// Mock Cloudflare Workers types
const mockEnv = {
  fetch: jest.fn(),
  waitUntil: jest.fn()
};

// Set up the mock environment
globalThis.env = mockEnv;
// @ts-ignore
globalThis.Context = mockEnv;
// @ts-ignore
globalThis.Request = Request;
// @ts-ignore
globalThis.Response = Response;
// @ts-ignore
globalThis.Headers = Headers;
// @ts-ignore
globalThis.Date = Date;
// @ts-ignore
globalThis.JSON = JSON;
// @ts-ignore
globalThis.URL = URL;
// @ts-ignore
globalThis.URLSearchParams = URLSearchParams;
// @ts-ignore
globalThis.TextEncoder = TextEncoder;
// @ts-ignore
globalThis.TextDecoder = TextDecoder;
