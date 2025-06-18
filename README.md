# Cloud Probe Worker

[![Deploy to Cloudflare Workers](https://github.com/your-org/cloud-probe-worker/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/cloud-probe-worker/actions/workflows/deploy.yml)

Global, serverless network probe endpoints—latency, jitter, speed test, and edge metadata, with OpenTelemetry support. Designed for Cloudflare Workers and portable to other edge/serverless clouds.

## Features

- **Latency Measurement**: Measure network latency to the edge
- **Jitter Analysis**: Calculate network jitter with multiple measurements
- **Speed Test**: Test download speeds with configurable file sizes
- **Edge Metadata**: Get detailed information about the edge location and client
- **Rate Limiting**: Built-in rate limiting for API protection
- **OpenTelemetry Support**: Distributed tracing with traceparent header support

## 🚀 Endpoints

### `GET /`
Basic information about the API and available endpoints.

| Endpoint | Method | Authentication | Description |
|----------|--------|----------------|-------------|
| `/ping` | GET | 🔄 Rate-limited (30/min/IP) | Get latency/jitter + edge information |
| `/speed` | GET | 🔑 API token | Download speed test (max 100MB). Query params: `size` (bytes), `pattern` (zero/rand) |
| `/upload` | POST | 🔑 API token | Upload speed test (max 100MB) |
| `/info` | GET | 🔄 Rate-limited (30/min/IP) | Detailed edge POP and geo information |
| `/headers` | GET | 🔄 Rate-limited (30/min/IP) | Returns all request headers |
| `/version` | GET | 🔄 Rate-limited (30/min/IP) | Worker version and build information |
| `/echo` | POST | 🔑 API token | Echo back the request body and headers |
| `/healthz` | GET | 🔄 Rate-limited (30/min/IP) | Health check endpoint |
| *Any other path* | ANY | - | Returns `200 OK` with "ok" |

## 🛡️ Security Headers

All responses include the following security headers:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `X-XSS-Protection: 0`
- `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 🔐 Authentication & Rate Limiting

- 🔑 **API Token Required** for sensitive endpoints (`/speed`, `/upload`, `/echo`)
  - Set `x-api-probe-token` header with a valid token
  
- 🔄 **Rate Limited** (30 requests/minute per IP)
  - Applies to public endpoints: `/ping`, `/info`, `/healthz`, `/headers`, `/version`
  - Returns `429 Too Many Requests` when limit exceeded
  - Uses Cloudflare Workers KV for distributed rate limiting

## 🔍 OpenTelemetry Support

All endpoints support distributed tracing through the `traceparent` header:
- Echoes back any received `traceparent` header in both response header and JSON
- Follows the [W3C Trace Context](https://www.w3.org/TR/trace-context/) specification
- Enables end-to-end request tracing across services

## 📊 Response Format

All successful responses include:
- Standard HTTP status codes
- Consistent JSON format for structured data
- Security headers (see above)
- Request tracing information when available

Error responses follow the format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## 🚀 Deployment

1. **Create KV Namespace:**
   In Cloudflare dashboard, create a namespace (e.g., `RATE_LIMIT_KV`).
   Add its ID to `wrangler.toml`.

2. **Set API Token Secret:**
   Generate a secure token, then:
   ```sh
   wrangler secret put API_PROBE_TOKEN
