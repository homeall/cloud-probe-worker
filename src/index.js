// Handle environment variables for both Node.js and Cloudflare Workers
const getEnv = () => {
  // For Cloudflare Workers
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env;
  }
  // For Node.js environment (testing)
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
};

const env = getEnv();
const VERSION = env.VERSION || "v1.0.0";
const GIT_COMMIT = env.GIT_COMMIT || "abcdef0";
const BUILD_TIME = env.BUILD_TIME || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

/**
 * Adds a comprehensive set of security headers to the provided Headers object.
 * The headers enforce HTTPS, prevent MIME sniffing and clickjacking, restrict referrer information,
 * disable legacy XSS protection, prevent caching, and limit certain browser permissions.
 * 
 * @param {Headers} headers - The Headers object to which security headers will be added.
 * @returns {Headers} The Headers object with security headers applied.
 */
const addSecurityHeaders = (headers) => {
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-XSS-Protection', '0');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  return headers;
};

/**
 * Constructs an HTTP response with strict security headers and appropriate content type.
 * If the body is an object, it is JSON-stringified; otherwise, it is used as-is.
 * Security headers are added to enforce HTTPS, prevent MIME sniffing, clickjacking, and caching.
 * The default content type is set to "text/plain" unless specified in options.
 * 
 * @param {string|object} body - The response body, either as a string or an object to be JSON-stringified.
 * @param {object} [options] - Optional response settings, including status and headers.
 * @returns {Response} The constructed HTTP response with security headers.
 */
const createSecureResponse = (body, options = {}) => {
  const headers = new Headers(options.headers || {});
  addSecurityHeaders(headers);

  if (typeof body === 'object') {
    headers.set('content-type', options.headers?.['content-type'] || 'application/json');
    return new Response(JSON.stringify(body), { ...options, headers });
  }

  return new Response(body, { ...options, headers });
};

/**
 * Extracts Cloudflare-specific metadata from the provided request.
 * @param {Request} request - The incoming request object.
 * @return {object} An object containing Cloudflare metadata and request info.
 */
const getCloudflareMetadata = (request) => {
  const { cf = {} } = request;
  return {
    ip: request.headers.get('cf-connecting-ip') || 'unknown',
    asn: cf.asn || 'unknown',
    region: cf.region || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
    traceparent: request.headers.get('traceparent') || 'unknown',
    ...cf
  };
};

// Constants
const EXPENSIVE = ['/speed', '/upload', '/echo'];
const FREE_LIMITED = ['/ping', '/info', '/healthz', '/headers', '/version'];
const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 60; // seconds

/**
 * Handle rate limiting
 */
const handleRateLimiting = async (path, ip, env, ctx) => {
  if (!FREE_LIMITED.includes(path) && !EXPENSIVE.includes(path)) {
    return { error: false };
  }

  if (FREE_LIMITED.includes(path)) {
    return { error: false };
  }

  const key = `rate_limit:${ip}:${path}`;
  const count = await env.RATE_LIMIT_KV.get(key, 'number') || 0;

  if (count >= RATE_LIMIT) {
    return {
      error: true,
      response: createSecureResponse(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: new Headers({ 'Retry-After': RATE_LIMIT_WINDOW.toString() }) }
      )
    };
  }

  await env.RATE_LIMIT_KV.atomic(key).increment(1).expire(RATE_LIMIT_WINDOW);
  return { error: false };
};

/**
 * Handle authentication
 */
const handleAuthentication = (path, token, validToken) => {
  if (!EXPENSIVE.includes(path)) {
    return { error: false };
  }

  if (token === validToken) {
    return { error: false };
  }

  return {
    error: true,
    response: createSecureResponse(
      { error: 'Unauthorized' },
      { status: 401, headers: new Headers({ 'WWW-Authenticate': 'Bearer' }) }
    )
  };
};

/**
 * Main worker fetch handler
 */
const workerFetch = async (request, env, ctx) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const token = request.headers.get("x-api-probe-token") || "";
  const validToken = env.API_PROBE_TOKEN;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const headers = new Headers();

  // Handle authentication
  const authResult = handleAuthentication(path, token, validToken);
  if (authResult.error) return authResult.response;

  // Handle rate limiting
  const rateLimitResult = await handleRateLimiting(path, ip, env, ctx);
  if (rateLimitResult.error) return rateLimitResult.response;

  // Echo traceparent header if present
  const traceparent = request.headers.get("traceparent");
  if (traceparent) {
    headers.set("traceparent", traceparent);
  }

  // Handle endpoints
  switch (path) {
    case "/ping":
      if (request.method === "GET") {
        return createSecureResponse({
          timestamp: new Date().toISOString(),
          cf: request.cf
        }, { headers });
      }
      break;

    case "/info":
      if (request.method === "GET") {
        return createSecureResponse(
          getCloudflareMetadata(request),
          { headers: new Headers({ 'content-type': 'application/json' }) }
        );
      }
      break;

    case "/headers":
      if (request.method === "GET") {
        const allHeaders = Object.fromEntries(request.headers.entries());
        return createSecureResponse(
          { headers: allHeaders, traceparent: traceparent || null },
          { headers: new Headers({ 'content-type': 'application/json' }) }
        );
      }
      break;

    case "/version":
      if (request.method === "GET") {
        return createSecureResponse(
          {
            version: VERSION,
            commit: GIT_COMMIT,
            build: BUILD_TIME,
          },
          { headers: new Headers({ 'content-type': 'application/json' }) }
        );
      }
      break;

    case "/echo":
      if (request.method === "POST") {
        const reqBody = await request.text();
        const allHeaders = Object.fromEntries(request.headers.entries());
        return createSecureResponse(
          {
            body: reqBody,
            headers: allHeaders,
            traceparent: traceparent || null,
          },
          { headers: new Headers({ 'content-type': 'application/json' }) }
        );
      }
      break;

    case "/speed":
      if (request.method === "GET") {
        const size = parseInt(request.url.split('?')[1]?.split('=')[1]) || 1000;
        const data = new Uint8Array(size).fill(42);
        return createSecureResponse(data, {
          status: 200,
          headers: new Headers({
            'content-type': 'application/octet-stream',
            'content-length': size.toString()
          })
        });
      }
      break;

    case "/upload":
      if (request.method === "POST") {
        const body = await request.arrayBuffer();
        return createSecureResponse(
          {
            size: body.byteLength,
            headers: Object.fromEntries(request.headers.entries()),
            traceparent: traceparent || null
          },
          { headers: new Headers({ 'content-type': 'application/json' }) }
        );
      }
      break;
  }

  // Default: 404
  return createSecureResponse(
    { error: "Not Found" },
    { status: 404, headers: new Headers({ 'content-type': 'application/json' }) }
  );
};

// Register event handler
addEventListener('fetch', event => {
  event.respondWith(workerFetch(event.request, event.env, event.ctx))
});

// Exports
export default workerFetch;
export { workerFetch };
