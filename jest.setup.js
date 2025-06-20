// Jest setup for ES modules

// No-op import.meta mock (tests pass env directly to worker)

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
