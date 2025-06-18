// cloud-probe-worker/src/index.js

const VERSION = "v1.0.0";
const GIT_COMMIT = "abcdef0";
const BUILD_TIME = "2024-06-15";
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

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
        headers.set("content-type", "application/json");
        return new Response(
          JSON.stringify({ error: "Unauthorized: missing or invalid token" }),
          { status: 401, headers }
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
          headers.set("content-type", "application/json");
          return new Response(
            JSON.stringify({ error: "Too Many Requests" }),
            { status: 429, headers }
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
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(resp, null, 2), { status: 200, headers });
    }

    // /speed
    if (path === "/speed" && request.method === "GET") {
      let size = parseInt(url.searchParams.get("size") || "1048576", 10); // Default 1MB
      if (isNaN(size) || size < 0) size = 1048576;
      if (size > MAX_SIZE) {
        headers.set("content-type", "application/json");
        return new Response(JSON.stringify({ error: `Size too large (max ${MAX_SIZE} bytes)` }), { status: 413, headers });
      }
      let pattern = url.searchParams.get("pattern") || "zero";
      let buf;
      if (pattern === "rand") {
        buf = crypto.getRandomValues(new Uint8Array(size));
      } else {
        buf = new Uint8Array(size); // zeroes by default
      }
      headers.set("content-type", "application/octet-stream");
      headers.set("content-length", size.toString());
      return new Response(buf, { status: 200, headers });
    }

    // /upload
    if (path === "/upload" && request.method === "POST") {
      let bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_SIZE) {
        headers.set("content-type", "application/json");
        return new Response(JSON.stringify({ error: `Upload too large (max ${MAX_SIZE} bytes)` }), { status: 413, headers });
      }
      const resp = {
        received: bytes.byteLength,
        timestamp: Date.now(),
        traceparent: traceparent || null,
      };
      headers.set("content-type", "application/json");
      headers.set("x-bytes-received", bytes.byteLength.toString());
      return new Response(JSON.stringify(resp, null, 2), { status: 200, headers });
    }

    // /info
    if (path === "/info" && request.method === "GET") {
        const cf = request.cf || {};
        const resp = {
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
        };
        headers.set("content-type", "application/json");
        return new Response(JSON.stringify(resp, null, 2), { status: 200, headers });
    }

    // /headers
    if (path === "/headers" && request.method === "GET") {
      let allHeaders = {};
      for (let [key, value] of request.headers.entries()) {
        allHeaders[key] = value;
      }
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify({ headers: allHeaders, traceparent: traceparent || null }, null, 2), { status: 200, headers });
    }

    // /version
    if (path === "/version" && request.method === "GET") {
      const resp = {
        version: VERSION,
        commit: GIT_COMMIT,
        build: BUILD_TIME,
      };
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(resp, null, 2), { status: 200, headers });
    }

    // /echo
    if (path === "/echo" && request.method === "POST") {
      const reqBody = await request.text();
      let allHeaders = {};
      for (let [key, value] of request.headers.entries()) {
        allHeaders[key] = value;
      }
      const resp = {
        echoed: reqBody,
        headers: allHeaders,
        traceparent: traceparent || null,
      };
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(resp, null, 2), { status: 200, headers });
    }

    // /healthz
    if (path === "/healthz" && request.method === "GET") {
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers });
    }

    // Default: ok
    headers.set("content-type", "text/plain");
    return new Response("ok", { status: 200, headers });
  }
};
