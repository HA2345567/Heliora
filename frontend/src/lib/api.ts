import type {
  ApiMarket, ApiTrade, ApiPosition, ApiAgent, ApiOracleResolution,
  ApiProtocolStats, ApiPricePoint, MarketCategory, ResolutionSource, Side, TradeKind,
} from "./api-types";

export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE = apiBaseUrl;

function getWallet(): string | null {
  return localStorage.getItem("heliora.wallet");
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const wallet = getWallet();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(wallet ? { "x-wallet": wallet } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // Backend unreachable — Neon/Express not deployed yet. Surface a friendly error
    // so React Query can render an empty state instead of a stack trace.
    throw new Error("Heliora backend offline. Deploy backend/ or use /live for Kalshi data.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  // Markets
  listMarkets: (params: {
    category?: MarketCategory;
    live?: boolean;
    sort?: "volume" | "ending" | "trending" | "newest";
    search?: string;
    take?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
    return req<{ markets: ApiMarket[] }>(`/api/markets?${qs.toString()}`);
  },
  getMarket: (id: string) =>
    req<{
      market: ApiMarket & { pricePoints: ApiPricePoint[]; oracleResolution?: ApiOracleResolution | null };
      recentTrades: ApiTrade[];
    }>(`/api/markets/${id}`),
  getOrderbook: (id: string) =>
    req<{
      mid: number;
      buyYes: { price: number; size: number }[];
      sellYes: { price: number; size: number }[];
    }>(`/api/markets/${id}/orderbook`),
  createMarket: (body: {
    question: string;
    description?: string;
    category: MarketCategory;
    resolution: ResolutionSource;
    resolutionDetail?: string;
    endsAt: string;
    liquiditySeed?: number;
    isLive?: boolean;
  }) => req<{ market: ApiMarket }>("/api/markets", { method: "POST", body: JSON.stringify(body) }),

  // Trades
  placeTrade: (body: {
    marketId: string;
    side: Side;
    kind?: TradeKind;
    shares: number;
    txSig?: string;
  }) => req<{ trade: ApiTrade }>("/api/trades", { method: "POST", body: JSON.stringify(body) }),
  recentTrades: (marketId: string) =>
    req<{ trades: ApiTrade[] }>(`/api/trades/recent/${marketId}`),

  // Portfolio
  portfolio: () =>
    req<{
      summary: { openValue: number; unrealized: number; realized: number; positions: number };
      positions: ApiPosition[];
      trades: (ApiTrade & { market: { question: string; category: MarketCategory } })[];
    }>("/api/portfolio"),

  // Agents
  listAgents: () => req<{ agents: ApiAgent[] }>("/api/agents"),
  getAgent: (id: string) => req<{ agent: ApiAgent }>(`/api/agents/${id}`),
  subscribeAgent: (id: string, capital: number) =>
    req<{ subscription: unknown }>(`/api/agents/${id}/subscribe`, {
      method: "POST",
      body: JSON.stringify({ capital }),
    }),

  // Oracle
  recentResolutions: () =>
    req<{ resolutions: ApiOracleResolution[] }>("/api/oracle/recent"),
  resolveMarket: (marketId: string, context: string) =>
    req<{ resolution: ApiOracleResolution }>(`/api/oracle/resolve/${marketId}`, {
      method: "POST",
      body: JSON.stringify({ context }),
    }),

  // Stats
  protocolStats: () => req<ApiProtocolStats>("/api/stats/protocol"),
  leaderboard: () =>
    req<{ leaderboard: { wallet: string; handle?: string | null; pnl: number; positions: number }[] }>(
      "/api/stats/leaderboard",
    ),
};

// Display helpers (kept here to avoid duplication across pages)
export function formatUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
export function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "ended";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
