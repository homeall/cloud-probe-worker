// cloud-probe-worker/src/index.js

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
  // Fallback
  return {};
};

const env = getEnv();
const VERSION = env.VERSION || "v1.0.0";
const GIT_COMMIT = env.GIT_COMMIT || "abcdef0";
const BUILD_TIME = env.BUILD_TIME || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

/**
 * Add security headers to all responses
 * @param {Headers} headers - The headers object to modify
 * @returns {Headers} The modified headers object
 */
function addSecurityHeaders(headers) {
  // Force HTTPS for 2 years including subdomains and preload
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY");
  // Control referrer information
  headers.set("Referrer-Policy", "no-referrer");
  // Disable XSS filter (modern browsers have better XSS protection)
  headers.set("X-XSS-Protection", "0");
  // Prevent caching of sensitive data
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  // Additional security headers
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  return headers;
}

/**
 * Create a response with security headers
 * @param {string|object} body - Response body (string or object)
 * @param {object} options - Response options
 * @returns {Response} The response object
 */
function createSecureResponse(body, options = {}) {
  const { status = 200, headers = new Headers() } = options;
  
  // Add security headers
  addSecurityHeaders(headers);
  
  // Handle Uint8Array as binary data
  if (body instanceof Uint8Array) {
    return new Response(body, {
      status,
      headers
    });
  }
  
  // Set default content type if not specified
  if (!headers.has('content-type')) {
    headers.set('content-type', 'text/plain');
  }
  
  // Stringify if body is an object
  const responseBody = typeof body === 'object' 
    ? JSON.stringify(body, null, 2) 
    : body;
    
  return new Response(responseBody, {
    status,
    headers
  });
}

const EXPENSIVE = ["/speed", "/upload", "/echo"];
const FREE_LIMITED = ["/ping", "/info", "/healthz", "/headers", "/version"];
const RATE_LIMIT = 30; // requests per minute per IP

export async function fetch(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const token = request.headers.get("x-api-probe-token") || "";
  const validToken = env.API_PROBE_TOKEN;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const headers = new Headers();

  // Echo traceparent header if present
  const traceparent = request.headers.get("traceparent");
  if (traceparent) {
    headers.set("traceparent", traceparent);
  }

  // --- PROTECTION LOGIC ---
  if (EXPENSIVE.includes(path)) {
    if (!token || token !== validToken) {
      return createSecureResponse(
        { error: "Unauthorized: missing or invalid token" },
        { status: 401, headers: new Headers({ 'content-type': 'application/json' }) }
      );
    }
  }

  // --- RATE LIMITING ---
  if (FREE_LIMITED.includes(path)) {
    if (env.RATE_LIMIT_KV) {
      const now = Math.floor(Date.now() / 60000); // current minute
      const kvKey = `rl:${ip}:${path}:${now}`;
      let count = parseInt(await env.RATE_LIMIT_KV.get(kvKey)) || 0;
      if (count >= RATE_LIMIT) {
        return createSecureResponse(
          { error: "Too Many Requests" },
          { status: 429, headers: new Headers({ 'content-type': 'application/json' }) }
        );
      }
      ctx.waitUntil(env.RATE_LIMIT_KV.put(kvKey, (count + 1).toString(), { expirationTtl: 120 }));
    }
  }

  // --- ENDPOINTS ---
  // /ping
  if (path === "/ping" && request.method === "GET") {
    return createSecureResponse({
      timestamp: new Date().toISOString(),
      cf: request.cf
    }, { headers });
  }

  // /info
  if (path === "/info" && request.method === "GET") {
        const cf = request.cf || {};
        return createSecureResponse(
          {
            ip: request.headers.get("cf-connecting-ip") || null,
            asn: cf.asn || null,
            city: cf.city || null,
            region: cf.region || null,
            country: cf.country || null,
            latitude: cf.latitude || null,
            longitude: cf.longitude || null,
            timezone: cf.timezone || null,
            colo: cf.colo || null,
            user_agent: request.headers.get("user-agent") || null,
            traceparent: traceparent || null,
          },
          { headers: new Headers({ 'content-type': 'application/json' }) }
        );
    }

    // /headers
    if (path === "/headers" && request.method === "GET") {
      let allHeaders = {};
      for (let [key, value] of request.headers.entries()) {
        allHeaders[key] = value;
      }
      return createSecureResponse(
        { headers: allHeaders, traceparent: traceparent || null },
        { headers: new Headers({ 'content-type': 'application/json' }) }
      );
    }

    // /version
    if (path === "/version" && request.method === "GET") {
      return createSecureResponse(
        {
          version: VERSION,
          commit: GIT_COMMIT,
          build: BUILD_TIME,
        },
        { headers: new Headers({ 'content-type': 'application/json' }) }
      );
    }

    // /echo
    if (path === "/echo" && request.method === "POST") {
      const reqBody = await request.text();
      let allHeaders = {};
      for (let [key, value] of request.headers.entries()) {
        allHeaders[key] = value;
      }
      return createSecureResponse(
        {
          echoed: reqBody,
          headers: allHeaders,
          traceparent: traceparent || null,
        },
        { headers: new Headers({ 'content-type': 'application/json' }) }
      );
    }

    // /healthz
    if (path === "/healthz" && request.method === "GET") {
      return createSecureResponse(
        { status: "ok" },
        { headers: new Headers({ 'content-type': 'application/json' }) }
      );
    }

    // Default: ok
    return createSecureResponse("ok", { 
      headers: new Headers({ 'content-type': 'text/plain' }) 
    });
  }

