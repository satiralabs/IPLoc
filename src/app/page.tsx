"use client";

import { useCallback, useEffect, useState } from "react";

type IpData = {
  ip?: string;
  type?: string | null;
  city?: string | null;
  region?: string | null;
  region_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  continent?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  postal?: string | null;
  timezone?: { id?: string | null; utc?: string | null } | null;
  connection?: { isp?: string | null; org?: string | null; asn?: string | null } | null;
  flag_emoji?: string | null;
  source?: string;
  error?: string;
};

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  // Tablet check first — many tablet UAs also contain "mobile"-adjacent tokens.
  if (/ipad|tablet|kindle|silk|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return "Tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/.test(ua)) return "Mobile";
  return "Desktop";
}

function localTimeIn(tzId?: string | null): string | null {
  if (!tzId) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tzId,
    }).format(new Date());
  } catch {
    return null;
  }
}

export default function Home() {
  const [ipInfo, setIpInfo] = useState<IpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<string>("Unknown");
  const [rating, setRating] = useState<"" | "spot" | "close" | "miss">("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOwnIp, setIsOwnIp] = useState(true);

  const lookup = useCallback(async (ip?: string) => {
    setLoading(true);
    setError(null);
    setRating("");
    setCopied(false);
    try {
      const res = await fetch(ip ? `/api/ip?ip=${encodeURIComponent(ip)}` : "/api/ip");
      const data = await res.json();
      if (!res.ok) {
        setIpInfo(null);
        setError(data?.error || `Lookup failed (HTTP ${res.status})`);
      } else {
        setIpInfo(data);
        setIsOwnIp(!ip);
      }
    } catch {
      setIpInfo(null);
      setError("Could not reach the lookup service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent || ""));
    lookup();
  }, [lookup]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const ip = query.trim();
    if (ip) lookup(ip);
  };

  const handleRate = (r: "spot" | "close" | "miss") => setRating(r);

  const copyIp = async () => {
    if (!ipInfo?.ip) return;
    try {
      await navigator.clipboard.writeText(ipInfo.ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const locationLine = ipInfo?.city
    ? [ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(", ")
    : null;
  const tzLocalTime = localTimeIn(ipInfo?.timezone?.id);
  const hasCoords = typeof ipInfo?.latitude === "number" && typeof ipInfo?.longitude === "number";
  const mapUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${ipInfo!.latitude}&mlon=${ipInfo!.longitude}#map=11/${ipInfo!.latitude}/${ipInfo!.longitude}`
    : null;

  const Row = ({ label, children, side, wrap }: { label: string; children: React.ReactNode; side?: React.ReactNode; wrap?: boolean }) => (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white/60 dark:bg-white/5 p-3">
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className={`text-lg font-medium ${wrap ? "leading-snug" : "truncate"}`}>{children}</div>
      </div>
      {side}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black font-sans p-6">
      <div className="w-full max-w-md">
        <div className="card bg-gradient-to-br from-white to-zinc-100 dark:from-[#0b0b0b] dark:to-[#111] shadow-xl rounded-2xl p-6">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <span className="text-3xl">🧭</span>
            IPLoc — Where is that IP?
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            {isOwnIp ? "We guessed your location from your public IP address — how close did we get?" : "Result for the IP you looked up:"}
          </p>

          {/* Lookup form */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Look up any IP — e.g. 8.8.8.8"
              inputMode="search"
              className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="IP address to look up"
            />
            <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition">
              Look up
            </button>
            <button
              type="button"
              onClick={() => { setQuery(""); lookup(); }}
              className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 text-sm font-semibold transition"
            >
              My IP
            </button>
          </form>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-200">
              <div className="font-semibold mb-1">⚠️ Lookup didn’t work</div>
              <div>{error}</div>
              <button onClick={() => lookup(query.trim() || undefined)} className="mt-2 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold">
                Try again
              </button>
            </div>
          )}

          <div className="info grid grid-cols-1 gap-3">
            <Row
              wrap
              label="Location"
              side={<div className="text-3xl">{ipInfo?.flag_emoji || (!loading && ipInfo?.city ? "📍" : "🤔")}</div>}
            >
              {loading ? "Detecting…" : locationLine || "Unknown"}
            </Row>

            <Row
              label="IP Address"
              side={
                ipInfo?.ip ? (
                  <button onClick={copyIp} className="text-xs px-2 py-1 rounded bg-white/80 dark:bg-white/10 shrink-0" title="Copy IP">
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                ) : undefined
              }
            >
              {loading ? "…" : ipInfo?.ip || "Unknown"}
            </Row>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Device (yours)">{device}</Row>
              <Row label="IP type">{loading ? "…" : ipInfo?.type || "—"}</Row>
            </div>

            <Row label="Time Zone" side={tzLocalTime ? <div className="text-sm text-zinc-500 shrink-0">{tzLocalTime} there</div> : undefined}>
              {loading ? "…" : ipInfo?.timezone?.id || "Unknown"}
            </Row>

            <Row label="ISP / Organisation">
              {loading ? "…" : ipInfo?.connection?.isp || ipInfo?.connection?.org || "Unknown"}
            </Row>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Postal code">{loading ? "…" : ipInfo?.postal || "—"}</Row>
              <Row label="ASN">{loading ? "…" : ipInfo?.connection?.asn || "—"}</Row>
            </div>

            <Row
              label="Coordinates"
              side={
                mapUrl ? (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-blue-600 text-white shrink-0">
                    View map ↗
                  </a>
                ) : undefined
              }
            >
              {loading ? "…" : hasCoords ? `${ipInfo!.latitude!.toFixed(4)}, ${ipInfo!.longitude!.toFixed(4)}` : "—"}
            </Row>
          </div>

          {!loading && ipInfo && (
            <div className="mt-5">
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">How close did we get?</div>
              <div className="flex gap-3">
                <button onClick={() => handleRate("spot")} className={`flex-1 py-2 rounded-lg font-semibold transition ${rating === "spot" ? "bg-green-500 text-white" : "bg-white/80 dark:bg-white/10"}`}>
                  Spot on
                </button>
                <button onClick={() => handleRate("close")} className={`flex-1 py-2 rounded-lg font-semibold transition ${rating === "close" ? "bg-yellow-400 text-white" : "bg-white/80 dark:bg-white/10"}`}>
                  Close
                </button>
                <button onClick={() => handleRate("miss")} className={`flex-1 py-2 rounded-lg font-semibold transition ${rating === "miss" ? "bg-red-500 text-white" : "bg-white/80 dark:bg-white/10"}`}>
                  Missed
                </button>
              </div>
              {rating && (
                <div className="mt-4 p-3 rounded-md bg-white/70 dark:bg-white/5 text-center">
                  {rating === "spot" && <div className="text-xl">🎯 Spot on — thanks for playing!</div>}
                  {rating === "close" && <div className="text-xl">🙂 Close — we’ll try to do better next time!</div>}
                  {rating === "miss" && <div className="text-xl">😅 Missed — thanks for the feedback!</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-3 text-center">
          No API key needed — lookups run server-side via {ipInfo?.source || "ipwho.is"} with automatic fallbacks, so no key is exposed in the browser. IP geolocation is approximate: it usually gets the city area, not an exact address.
        </p>
      </div>
    </div>
  );
}
