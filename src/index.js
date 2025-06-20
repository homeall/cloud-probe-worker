// Default values used when environment variables are not provided
const DEFAULT_VERSION = 'v1.0.0';
const DEFAULT_GIT_COMMIT = 'abcdef0';
// YYYY-MM-DD format
const DEFAULT_BUILD_TIME = new Date().toISOString().split('T')[0];

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

  // If body is binary data (ArrayBuffer or any TypedArray), return as-is
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/octet-stream');
    }
    return new Response(body, { ...options, headers });
  }

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
const handleRateLimiting = async (path, ip, env) => {
  if (!FREE_LIMITED.includes(path) && !EXPENSIVE.includes(path)) {
    return { error: false };
  }

  if (FREE_LIMITED.includes(path)) {
    return { error: false };
  }

  const key = `rate_limit:${ip}:${path}`;

  // Fetch current count (stored as string). Default to 0 if not set.
  const current = parseInt(await env.RATE_LIMIT_KV.get(key) || '0', 10);
  const next = current + 1;

  if (next > RATE_LIMIT) {
    return {
      error: true,
      response: createSecureResponse(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: new Headers({ 'Retry-After': RATE_LIMIT_WINDOW.toString() }) }
      )
    };
  }

  // Store the updated count with a TTL so it resets automatically.
  await env.RATE_LIMIT_KV.put(key, next.toString(), { expirationTtl: RATE_LIMIT_WINDOW });
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
const workerFetch = async (request, env) => {
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
  const rateLimitResult = await handleRateLimiting(path, ip, env);
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
          {
            version: env.VERSION || DEFAULT_VERSION,
            gitCommit: env.GIT_COMMIT || DEFAULT_GIT_COMMIT,
            buildTime: env.BUILD_TIME || DEFAULT_BUILD_TIME,
            cf: getCloudflareMetadata(request)
          },
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

    case "/healthz":
       if (request.method === "GET") {
         return createSecureResponse(
           { status: "ok" },
           { headers: new Headers({ 'content-type': 'application/json' }) }
         );
       }
       break;

     case "/version":
      if (request.method === "GET") {
        return createSecureResponse(
          {
            version: env.VERSION || DEFAULT_VERSION,
            commit: env.GIT_COMMIT || DEFAULT_GIT_COMMIT,
            build: env.BUILD_TIME || DEFAULT_BUILD_TIME,
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
        const params = new URLSearchParams(url.search);
        const metaOnly = params.has('meta');
        const sizeParam = parseInt(params.get('size') || '1000000', 10); // default 1 MB
        const pattern = params.get('pattern') || 'asterisk';
        const MAX_SIZE = 100 * 1024 * 1024; // 100 MB cap

        if (isNaN(sizeParam) || sizeParam <= 0 || sizeParam > MAX_SIZE) {
          return createSecureResponse(
            { error: `Invalid size. Must be 1-${MAX_SIZE} bytes.` },
            { status: 400, headers: new Headers({ 'content-type': 'application/json' }) }
          );
        }

        // If only metadata requested, return JSON description
        if (metaOnly) {
          const meta = {
            bytes: sizeParam,
            kibibytes: +(sizeParam / 1024).toFixed(2),
            mebibytes: +(sizeParam / 1048576).toFixed(2),
            pattern
          };
          return createSecureResponse(meta, { headers: new Headers({ 'content-type': 'application/json' }) });
        }

        let buffer;
        switch (pattern) {
          case 'zero':
            buffer = new Uint8Array(sizeParam); // auto-filled with zeros
            break;
          case 'rand':
            buffer = new Uint8Array(sizeParam);
            // Cloudflare crypto.getRandomValues max 65536 bytes per call
            var CHUNK = 65536;
            for (let offset = 0; offset < sizeParam; offset += CHUNK) {
              crypto.getRandomValues(buffer.subarray(offset, Math.min(offset + CHUNK, sizeParam)));
            }
            break;
          default: // 'asterisk'
            buffer = new Uint8Array(sizeParam).fill(42); // ASCII '*'
            break;
        }

        return createSecureResponse(buffer, {
          headers: new Headers({
            'content-type': 'application/octet-stream',
            'content-length': sizeParam.toString()
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

// Export the fetch handler in a way that's compatible with Wrangler
const worker = {
  fetch: workerFetch,
};

export default worker;
// Keep the named export for testing
export { workerFetch };

// Register event handler for production
if (typeof addEventListener !== 'undefined') {
  addEventListener('fetch', event => {
    event.respondWith(workerFetch(event.request, event.env, event.ctx))
  });
}
