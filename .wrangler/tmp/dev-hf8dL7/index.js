var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-aFm71V/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
var VERSION = import.meta.env.VERSION || "v1.0.0";
var GIT_COMMIT = import.meta.env.GIT_COMMIT || "abcdef0";
var BUILD_TIME = import.meta.env.BUILD_TIME || "2024-06-19";
var MAX_SIZE = 100 * 1024 * 1024;
function addSecurityHeaders(headers) {
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-XSS-Protection", "0");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return headers;
}
__name(addSecurityHeaders, "addSecurityHeaders");
function createSecureResponse(body, options = {}) {
  const { status = 200, headers = new Headers() } = options;
  addSecurityHeaders(headers);
  if (body instanceof Uint8Array) {
    return new Response(body, {
      status,
      headers
    });
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain");
  }
  const responseBody = typeof body === "object" ? JSON.stringify(body, null, 2) : body;
  return new Response(responseBody, {
    status,
    headers
  });
}
__name(createSecureResponse, "createSecureResponse");
var EXPENSIVE = ["/speed", "/upload", "/echo"];
var FREE_LIMITED = ["/ping", "/info", "/healthz", "/headers", "/version"];
var RATE_LIMIT = 30;
function getCfInfo(cf) {
  return {
    colo: cf?.colo,
    country: cf?.country,
    asn: cf?.asn,
    region: cf?.region,
    city: cf?.city,
    latitude: cf?.latitude,
    longitude: cf?.longitude,
    timezone: cf?.timezone
  };
}
__name(getCfInfo, "getCfInfo");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const token = request.headers.get("x-api-probe-token") || "";
    const validToken = env.API_PROBE_TOKEN;
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const headers = new Headers();
    const traceparent = request.headers.get("traceparent");
    if (traceparent) {
      headers.set("traceparent", traceparent);
    }
    if (EXPENSIVE.includes(path)) {
      if (!token || token !== validToken) {
        return createSecureResponse(
          { error: "Unauthorized: missing or invalid token" },
          {
            status: 401,
            headers: new Headers({ "content-type": "application/json" })
          }
        );
      }
    }
    if (FREE_LIMITED.includes(path)) {
      if (env.RATE_LIMIT_KV) {
        const now = Math.floor(Date.now() / 6e4);
        const kvKey = `rl:${ip}:${path}:${now}`;
        const currentCount = await env.RATE_LIMIT_KV.atomic().increment(kvKey, 1).then((result) => result.value);
        if (currentCount === 1) {
          ctx.waitUntil(env.RATE_LIMIT_KV.put(kvKey, currentCount.toString(), { expirationTtl: 120 }));
        }
        if (currentCount > RATE_LIMIT) {
          return createSecureResponse(
            { error: "Too Many Requests" },
            {
              status: 429,
              headers: new Headers({ "content-type": "application/json" })
            }
          );
        }
      }
    }
    if (path === "/ping" && request.method === "GET") {
      const resp = {
        timestamp: Date.now(),
        cf: getCfInfo(request.cf || {}),
        traceparent: traceparent || null
      };
      return createSecureResponse(resp, { headers: new Headers({ "content-type": "application/json" }) });
    }
    if (path === "/speed" && request.method === "GET") {
      let size = parseInt(url.searchParams.get("size") || "1048576", 10);
      if (isNaN(size) || size < 0) size = 1048576;
      if (size > MAX_SIZE) {
        return createSecureResponse(
          { error: `Size too large (max ${MAX_SIZE} bytes)` },
          {
            status: 413,
            headers: new Headers({ "content-type": "application/json" })
          }
        );
      }
      let pattern = url.searchParams.get("pattern") || "zero";
      let buf;
      if (pattern === "rand") {
        buf = crypto.getRandomValues(new Uint8Array(size));
      } else {
        buf = new Uint8Array(size);
      }
      return createSecureResponse(buf, {
        headers: new Headers({
          "content-type": "application/octet-stream",
          "content-length": size.toString()
        })
      });
    }
    if (path === "/upload" && request.method === "POST") {
      let bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_SIZE) {
        return createSecureResponse(
          { error: `Upload too large (max ${MAX_SIZE} bytes)` },
          {
            status: 413,
            headers: new Headers({ "content-type": "application/json" })
          }
        );
      }
      const resp = {
        received: bytes.byteLength,
        timestamp: Date.now(),
        traceparent: traceparent || null
      };
      const responseHeaders = new Headers({
        "content-type": "application/json",
        "x-bytes-received": bytes.byteLength.toString()
      });
      return createSecureResponse(resp, { headers: responseHeaders });
    }
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
          traceparent: traceparent || null
        },
        { headers: new Headers({ "content-type": "application/json" }) }
      );
    }
    if (path === "/headers" && request.method === "GET") {
      let allHeaders = {};
      for (let [key, value] of request.headers.entries()) {
        allHeaders[key] = value;
      }
      return createSecureResponse(
        { headers: allHeaders, traceparent: traceparent || null },
        { headers: new Headers({ "content-type": "application/json" }) }
      );
    }
    if (path === "/version" && request.method === "GET") {
      return createSecureResponse(
        {
          version: VERSION,
          commit: GIT_COMMIT,
          build: BUILD_TIME
        },
        { headers: new Headers({ "content-type": "application/json" }) }
      );
    }
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
          traceparent: traceparent || null
        },
        { headers: new Headers({ "content-type": "application/json" }) }
      );
    }
    if (path === "/healthz" && request.method === "GET") {
      return createSecureResponse(
        { status: "ok" },
        { headers: new Headers({ "content-type": "application/json" }) }
      );
    }
    return createSecureResponse("ok", {
      headers: new Headers({ "content-type": "text/plain" })
    });
  }
};

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-aFm71V/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-aFm71V/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
