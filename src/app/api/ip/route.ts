import { NextResponse } from "next/server";
import { isIP } from "node:net";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// IPLoc API route
//
// Why the original didn't work: it required a paid IPStack key
// (IPSTACK_KEY). With no key in .env.local every request returned 500 and
// the UI silently showed "Unknown" everywhere.
//
// This version needs NO API key. It queries free geolocation providers
// server-side, in order, and normalises their different response shapes
// into one format:
//
//   1. ipwho.is      (https, no key)          — primary
//   2. ip-api.com    (http on free tier)      — fallback
//   3. ipapi.co      (https, no key, limited) — last resort
//
// Usage:
//   GET /api/ip            → location of the visitor (via proxy headers
//                            when present, otherwise the provider resolves
//                            the caller's public IP)
//   GET /api/ip?ip=8.8.8.8 → location of any public IP (v4 or v6)
// ---------------------------------------------------------------------------

type IpData = {
  ip: string;
  type: string | null;
  city: string | null;
  // canonical names
  region: string | null;
  region_code: string | null;
  country: string | null;
  country_code: string | null;
  continent: string | null;
  latitude: number | null;
  longitude: number | null;
  postal: string | null;
  timezone: { id: string | null; utc: string | null };
  connection: { isp: string | null; org: string | null; asn: string | null };
  flag_emoji: string | null;
  source: string;
  // Backwards-compatible aliases (the original ipstack-shaped UI used these)
  region_name: string | null;
  country_name: string | null;
  time_zone: { id: string | null };
  zip: string | null;
};

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd")
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a === 0
  );
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any -- provider payloads have differing shapes, normalised below
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "IPLoc/1.1" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fromIpwhois(ip: string | null): Promise<IpData> {
  const data = await fetchJson(`https://ipwho.is/${ip ? encodeURIComponent(ip) : ""}`);
  if (!data || data.success === false) {
    throw new Error(data?.message || "ipwho.is lookup failed");
  }
  const tzId = data.timezone?.id ?? null;
  return {
    ip: data.ip,
    type: data.type ?? null,
    city: data.city || null,
    region: data.region || null,
    region_code: data.region_code || null,
    country: data.country || null,
    country_code: data.country_code || null,
    continent: data.continent || null,
    latitude: typeof data.latitude === "number" ? data.latitude : null,
    longitude: typeof data.longitude === "number" ? data.longitude : null,
    postal: data.postal || null,
    timezone: { id: tzId, utc: data.timezone?.utc ?? null },
    connection: {
      isp: data.connection?.isp || data.connection?.org || null,
      org: data.connection?.org || null,
      asn: data.connection?.asn ? `AS${data.connection.asn}` : null,
    },
    flag_emoji: data.flag?.emoji || null,
    source: "ipwho.is",
    region_name: data.region || null,
    country_name: data.country || null,
    time_zone: { id: tzId },
    zip: data.postal || null,
  };
}

async function fromIpApi(ip: string | null): Promise<IpData> {
  const fields = "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query";
  const data = await fetchJson(`http://ip-api.com/json/${ip ? encodeURIComponent(ip) : ""}?fields=${fields}`);
  if (!data || data.status !== "success") {
    throw new Error(data?.message || "ip-api.com lookup failed");
  }
  return {
    ip: data.query,
    type: data.query?.includes(":") ? "IPv6" : "IPv4",
    city: data.city || null,
    region: data.regionName || null,
    region_code: data.region || null,
    country: data.country || null,
    country_code: data.countryCode || null,
    continent: null,
    latitude: typeof data.lat === "number" ? data.lat : null,
    longitude: typeof data.lon === "number" ? data.lon : null,
    postal: data.zip || null,
    timezone: { id: data.timezone || null, utc: null },
    connection: { isp: data.isp || null, org: data.org || null, asn: data.as || null },
    flag_emoji: null,
    source: "ip-api.com",
    region_name: data.regionName || null,
    country_name: data.country || null,
    time_zone: { id: data.timezone || null },
    zip: data.zip || null,
  };
}

async function fromIpapiCo(ip: string | null): Promise<IpData> {
  const data = await fetchJson(`https://ipapi.co/${ip ? encodeURIComponent(ip) + "/" : ""}json/`);
  if (!data || data.error) {
    throw new Error(data?.reason || data?.message || "ipapi.co lookup failed");
  }
  return {
    ip: data.ip,
    type: data.version || null,
    city: data.city || null,
    region: data.region || null,
    region_code: data.region_code || null,
    country: data.country_name || null,
    country_code: data.country_code || null,
    continent: null,
    latitude: typeof data.latitude === "number" ? data.latitude : null,
    longitude: typeof data.longitude === "number" ? data.longitude : null,
    postal: data.postal || null,
    timezone: { id: data.timezone || null, utc: data.utc_offset || null },
    connection: { isp: data.org || null, org: data.org || null, asn: data.asn || null },
    flag_emoji: null,
    source: "ipapi.co",
    region_name: data.region || null,
    country_name: data.country_name || null,
    time_zone: { id: data.timezone || null },
    zip: data.postal || null,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ipParam = (url.searchParams.get("ip") || "").trim();

  let lookupIp: string | null = null;

  if (ipParam) {
    if (!isIP(ipParam)) {
      return NextResponse.json(
        { error: `"${ipParam}" is not a valid IP address.` },
        { status: 400 }
      );
    }
    if (isPrivateIp(ipParam)) {
      return NextResponse.json(
        {
          error:
            "That is a private / reserved IP address. Private addresses (like 192.168.x.x or 127.0.0.1) only exist inside a local network, so they have no public location to look up. Try the public IP instead — leave the box empty and press “My IP”.",
          ip: ipParam,
          is_private: true,
        },
        { status: 422 }
      );
    }
    lookupIp = ipParam;
  } else {
    // No explicit IP: prefer the real visitor IP from proxy headers when it
    // is a public address (production / behind a platform proxy). On a plain
    // local run there is no such header, so lookupIp stays null and the
    // provider resolves the caller's public IP itself.
    const forwarded =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      "";
    const candidate = forwarded.split(",").map((s) => s.trim()).filter(Boolean)[0] || "";
    if (candidate && isIP(candidate) && !isPrivateIp(candidate)) {
      lookupIp = candidate;
    }
  }

  const providers = [fromIpwhois, fromIpApi, fromIpapiCo];
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const data = await provider(lookupIp);
      return NextResponse.json(data, {
        headers: lookupIp
          ? { "Cache-Control": "public, max-age=3600" }
          : { "Cache-Control": "no-store" },
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.json(
    {
      error:
        "All location providers failed. This is usually a temporary rate limit or network issue — try again in a few seconds.",
      details: errors,
    },
    { status: 502 }
  );
}
