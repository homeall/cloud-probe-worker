// cloud-probe-worker/src/index.js

const VERSION = "v1.0.0";
const GIT_COMMIT = "abcdef0";
const BUILD_TIME = "2024-06-19";
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

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
  
  // Set default content type if not specified
  if (!headers.has('content-type')) {
    headers.set('content-type', 'text/plain');
  }
  
  // Add security headers
  addSecurityHeaders(headers);
  
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

function getCfInfo(cf) {
  return {
    colo: cf?.colo,
    country: cf?.country,
    asn: cf?.asn,
    region: cf?.region,
    city: cf?.city,
    latitude: cf?.latitude,
    longitude: cf?.longitude,
    timezone: cf?.timezone,
  };
}

export default {
  async fetch(request, env, ctx) {
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

    // Require token for expensive endpoints
    if (EXPENSIVE.includes(path)) {
      if (!token || token !== validToken) {
        return createSecureResponse(
          { error: "Unauthorized: missing or invalid token" },
          { 
            status: 401,
            headers: new Headers({ 'content-type': 'application/json' })
          }
        );
      }
      // proceed with expensive endpoint...
    }

    // Rate-limit free endpoints per IP (KV-based)
    if (FREE_LIMITED.includes(path)) {
      if (env.RATE_LIMIT_KV) {
        const now = Math.floor(Date.now() / 60000); // current minute
        const kvKey = `rl:${ip}:${path}:${now}`;
        let count = parseInt(await env.RATE_LIMIT_KV.get(kvKey)) || 0;
        if (count >= RATE_LIMIT) {
          return createSecureResponse(
            { error: "Too Many Requests" },
            { 
              status: 429,
              headers: new Headers({ 'content-type': 'application/json' })
            }
          );
        }
        ctx.waitUntil(env.RATE_LIMIT_KV.put(kvKey, (count + 1).toString(), { expirationTtl: 120 }));
      }
    }

    // --- ENDPOINT LOGIC ---

    // /ping
    if (path === "/ping" && request.method === "GET") {
      const resp = {
        timestamp: Date.now(),
        cf: getCfInfo(request.cf || {}),
        traceparent: traceparent || null,
      };
      return createSecureResponse(resp, { headers: new Headers({ 'content-type': 'application/json' }) });
    }

    // /speed
    if (path === "/speed" && request.method === "GET") {
      let size = parseInt(url.searchParams.get("size") || "1048576", 10); // Default 1MB
      if (isNaN(size) || size < 0) size = 1048576;
      if (size > MAX_SIZE) {
        return createSecureResponse(
          { error: `Size too large (max ${MAX_SIZE} bytes)` },
          { 
            status: 413,
            headers: new Headers({ 'content-type': 'application/json' })
          }
        );
      }
      let pattern = url.searchParams.get("pattern") || "zero";
      let buf;
      if (pattern === "rand") {
        buf = crypto.getRandomValues(new Uint8Array(size));
      } else {
        buf = new Uint8Array(size); // zeroes by default
      }
      const responseHeaders = new Headers();
      responseHeaders.set("content-type", "application/octet-stream");
      responseHeaders.set("content-length", size.toString());
      return createSecureResponse(buf, { headers: responseHeaders });
    }

    // /upload
    if (path === "/upload" && request.method === "POST") {
      let bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_SIZE) {
        return createSecureResponse(
          { error: `Upload too large (max ${MAX_SIZE} bytes)` },
          { 
            status: 413,
            headers: new Headers({ 'content-type': 'application/json' })
          }
        );
      }
      const resp = {
        received: bytes.byteLength,
        timestamp: Date.now(),
        traceparent: traceparent || null,
      };
      const responseHeaders = new Headers({
        'content-type': 'application/json',
        'x-bytes-received': bytes.byteLength.toString()
      });
      return createSecureResponse(resp, { headers: responseHeaders });
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
};
