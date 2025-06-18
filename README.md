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

## Endpoints

### `GET /`
Basic information about the API and available endpoints.
|-------------------------|--------|-----------|-------------------------------------|
| `/ping`                 | GET    | Rate-limited (30/min/IP) | Latency/jitter + edge info         |
| `/speed?size=&pattern=` | GET    | API token | Download speed test (max 100MB)     |
| `/upload`               | POST   | API token | Upload speed test (max 100MB)       |
| `/info`                 | GET    | Rate-limited (30/min/IP) | Edge POP/geo info                  |
| `/headers`              | GET    | Rate-limited (30/min/IP) | All request headers                 |
| `/version`              | GET    | Rate-limited (30/min/IP) | Worker version/build                |
| `/echo`                 | POST   | API token | Echo POST body + headers            |
| `/healthz`              | GET    | Rate-limited (30/min/IP) | Health check                        |
| *(any other)*           | any    |           | Returns "ok"                        |

### Traceparent

All endpoints echo any `traceparent` header in both response header and JSON.

---

## Security

- `/speed`, `/upload`, `/echo`:
  Require `x-api-probe-token` header with a valid token (set as a Cloudflare Worker secret).
- `/ping`, `/info`, `/healthz`, `/headers`, `/version`:
  Public, but rate-limited to 30 requests/minute per IP using Workers KV.
  If limit exceeded, returns `429 Too Many Requests`.

---

## Deploy

1. **Create KV Namespace:**
   In Cloudflare dashboard, create a namespace (e.g., `RATE_LIMIT_KV`).
   Add its ID to `wrangler.toml`.

2. **Set API Token Secret:**
   Generate a secure token, then:
   ```sh
   wrangler secret put API_PROBE_TOKEN
