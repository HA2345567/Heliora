// Heliora ↔ Kalshi read-only proxy.
// Mirrors Kalshi's public market data (no auth required) and exposes a
// CORS-safe surface for the Lovable frontend. Demo env by default so the
// hackathon never touches real-money endpoints.
//
// Endpoints:
//   GET /kalshi-proxy/markets?status=open&limit=50&cursor=...&series_ticker=...
//   GET /kalshi-proxy/market/:ticker
//   GET /kalshi-proxy/market/:ticker/orderbook
//   GET /kalshi-proxy/events?status=open&limit=50

const KALSHI_BASE = Deno.env.get("KALSHI_BASE_URL") ??
  "https://demo-api.kalshi.co/trade-api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function passthrough(path: string, search: URLSearchParams) {
  const url = `${KALSHI_BASE}${path}${search.toString() ? `?${search}` : ""}`;
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Heliora/1.0" },
    });
    const text = await r.text();
    if (!r.ok) {
      return json({ error: "kalshi_upstream", status: r.status, body: text.slice(0, 400) }, 502);
    }
    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: "fetch_failed", message: (e as Error).message }, 502);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  // Strip the function prefix (Lovable invokes as /functions/v1/kalshi-proxy/...)
  const segs = url.pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("kalshi-proxy");
  const route = idx >= 0 ? segs.slice(idx + 1) : segs;

  // /markets
  if (route[0] === "markets" && route.length === 1) {
    const search = new URLSearchParams(url.search);
    if (!search.has("limit")) search.set("limit", "50");
    if (!search.has("status")) search.set("status", "open");
    return passthrough("/markets", search);
  }
  // /market/:ticker
  if (route[0] === "market" && route.length === 2) {
    return passthrough(`/markets/${encodeURIComponent(route[1])}`, new URLSearchParams());
  }
  // /market/:ticker/orderbook
  if (route[0] === "market" && route[2] === "orderbook") {
    return passthrough(`/markets/${encodeURIComponent(route[1])}/orderbook`, new URLSearchParams());
  }
  // /events
  if (route[0] === "events") {
    const search = new URLSearchParams(url.search);
    if (!search.has("limit")) search.set("limit", "50");
    return passthrough("/events", search);
  }
  // /series
  if (route[0] === "series") {
    return passthrough("/series", new URLSearchParams(url.search));
  }
  // health
  if (route[0] === "health" || route.length === 0) {
    return json({ ok: true, upstream: KALSHI_BASE });
  }
  return json({ error: "not_found", route }, 404);
});
