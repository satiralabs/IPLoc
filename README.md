# IPLoc — IP Location Tool

Author: Benji

IPLoc is a small Next.js app that looks up the approximate location of an IP address and displays it in a single responsive card.

**No API key is required.** (The original version depended on a paid IPStack key — without one in `.env.local`, every lookup returned a 500 and the UI silently showed "Unknown". That dependency is gone.)

## What it shows

- City, region and country (with flag)
- IP address (IPv4 or IPv6) with a copy button
- Time zone, plus the current local time in that zone
- ISP / organisation and ASN
- Postal code
- Latitude / longitude with a "View map" link (OpenStreetMap)
- Device type (derived from your browser's user agent)

It also includes a rating control so visitors can say how accurate the guess was.

## What you can do

- **Your own IP** — detected automatically when the page loads. Behind a platform proxy (Vercel, Cloudflare, etc.) the visitor's real IP is taken from the forwarding headers; otherwise the provider resolves the caller's public IP.
- **Look up any public IP** — type an IPv4 or IPv6 address in the box and press "Look up"; press "My IP" to go back to your own.
- Invalid addresses get a clear error, and private/reserved addresses (192.168.x.x, 127.0.0.1, ::1, …) get an explanation instead of a meaningless "Unknown" — private IPs have no public location.

## How it works

The browser calls the server-side route `GET /api/ip` (optionally `?ip=8.8.8.8`). The server queries free geolocation providers in order and normalises their responses into one format:

1. [ipwho.is](https://ipwho.is) — primary (HTTPS, no key)
2. ip-api.com — fallback
3. ipapi.co — last resort

If one provider is down or rate-limited, the next is tried automatically. Responses for a specific IP are cached for an hour; your-own-IP lookups are never cached.

## Requirements

- Node.js (LTS recommended)

## Setup

```bash
npm install
```

No `.env` file, no keys, nothing else to configure.

## Run (development)

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Run (production build)

```bash
npm run build
npm start
```

## Try the API directly

```bash
curl http://localhost:3000/api/ip
curl "http://localhost:3000/api/ip?ip=8.8.8.8"
curl "http://localhost:3000/api/ip?ip=2606:4700:4700::1111"
```

## Notes

- IP geolocation is approximate by nature — it generally identifies the city area an ISP registered, not a street address, and VPNs/proxies show the exit server's location instead.
- The app deliberately does not use `next/font/google`: the original template fetched fonts from Google at build time, which made `npm run build` fail on networks where that host is unreachable. It uses a system font stack instead, so it builds anywhere.
