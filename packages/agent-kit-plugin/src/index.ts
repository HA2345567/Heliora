// Heliora Solana Agent Kit Plugin
// Exposes prediction-market actions to autonomous AI agents.
// Drop-in compatible with `solana-agent-kit` >= 1.4.

import { z } from "zod";

const DEFAULT_API = process.env.HELIORA_API_URL || "https://api.heliora.fi";

export interface HelioraConfig {
  apiUrl?: string;
  walletAddress?: string;
  apiKey?: string;
}

export class HelioraClient {
  private apiUrl: string;
  private wallet?: string;
  private apiKey?: string;

  constructor(cfg: HelioraConfig = {}) {
    this.apiUrl = cfg.apiUrl ?? DEFAULT_API;
    this.wallet = cfg.walletAddress;
    this.apiKey = cfg.apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.wallet) h["X-Wallet"] = this.wallet;
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  async listMarkets(params: { category?: string; live?: boolean; sort?: string; search?: string; take?: number } = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && q.append(k, String(v)));
    const r = await fetch(`${this.apiUrl}/api/markets?${q}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`listMarkets failed: ${r.status}`);
    return r.json();
  }

  async getMarket(marketId: string) {
    const r = await fetch(`${this.apiUrl}/api/markets/${marketId}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`getMarket failed: ${r.status}`);
    return r.json();
  }

  async createMarket(body: z.infer<typeof CreateMarketSchema>) {
    const r = await fetch(`${this.apiUrl}/api/markets`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`createMarket failed: ${r.status}`);
    return r.json();
  }

  async placeTrade(body: z.infer<typeof PlaceTradeSchema>) {
    const r = await fetch(`${this.apiUrl}/api/trades`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`placeTrade failed: ${r.status}`);
    return r.json();
  }

  async getPortfolio() {
    const r = await fetch(`${this.apiUrl}/api/portfolio`, { headers: this.headers() });
    if (!r.ok) throw new Error(`getPortfolio failed: ${r.status}`);
    return r.json();
  }

  async getOrderbook(marketId: string) {
    const r = await fetch(`${this.apiUrl}/api/markets/${marketId}/orderbook`, { headers: this.headers() });
    if (!r.ok) throw new Error(`getOrderbook failed: ${r.status}`);
    return r.json();
  }

  async resolveMarket(marketId: string, context = "") {
    const r = await fetch(`${this.apiUrl}/api/oracle/resolve/${marketId}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ context }),
    });
    if (!r.ok) throw new Error(`resolveMarket failed: ${r.status}`);
    return r.json();
  }
}

// ─── Zod schemas (re-exported for agent tool registration) ───────────

export const CreateMarketSchema = z.object({
  question: z.string().min(8).max(200),
  description: z.string().optional(),
  category: z.enum(["Crypto", "DeFi", "NFTs", "Memes", "Politics", "AI", "Sports", "Social"]).default("Crypto"),
  resolution: z.enum(["Pyth", "Switchboard", "AIOracle"]).default("AIOracle"),
  resolutionDetail: z.string().optional(),
  endsAt: z.string().describe("ISO 8601 timestamp"),
  liquiditySeed: z.number().positive().default(500),
  isLive: z.boolean().default(false),
});

export const PlaceTradeSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(["YES", "NO"]),
  kind: z.enum(["market", "limit"]).default("market"),
  shares: z.number().positive(),
  txSig: z.string().optional(),
});

// ─── Agent Kit Plugin definition ─────────────────────────────────────

export interface AgentKitAction {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  handler: (input: unknown, ctx: { client: HelioraClient }) => Promise<unknown>;
}

export const helioraActions: AgentKitAction[] = [
  {
    name: "heliora_list_markets",
    description: "List active prediction markets on Heliora. Filter by category/live/search; sort by volume/ending/trending.",
    schema: z.object({
      category: z.string().optional(),
      live: z.boolean().optional(),
      sort: z.enum(["volume", "ending", "trending", "newest"]).default("volume"),
      search: z.string().optional(),
      take: z.number().int().min(1).max(100).default(20),
    }),
    handler: async (input, { client }) => client.listMarkets(input as Record<string, unknown>),
  },
  {
    name: "heliora_get_market",
    description: "Get full market detail including price history, recent trades, and oracle resolution status.",
    schema: z.object({ marketId: z.string() }),
    handler: async (input, { client }) => client.getMarket((input as { marketId: string }).marketId),
  },
  {
    name: "heliora_create_market",
    description: "Create a permissionless prediction market. Requires a question, end timestamp, and seeded liquidity.",
    schema: CreateMarketSchema,
    handler: async (input, { client }) => client.createMarket(input as z.infer<typeof CreateMarketSchema>),
  },
  {
    name: "heliora_place_trade",
    description: "Buy YES or NO shares on a market. Returns fill price + new position state.",
    schema: PlaceTradeSchema,
    handler: async (input, { client }) => client.placeTrade(input as z.infer<typeof PlaceTradeSchema>),
  },
  {
    name: "heliora_get_portfolio",
    description: "Return all open positions, unrealized PnL, realized PnL, and recent trades for the current wallet.",
    schema: z.object({}),
    handler: async (_input, { client }) => client.getPortfolio(),
  },
  {
    name: "heliora_get_orderbook",
    description: "Snapshot the current YES-side orderbook (15 bids + 15 asks) for a market.",
    schema: z.object({ marketId: z.string() }),
    handler: async (input, { client }) => client.getOrderbook((input as { marketId: string }).marketId),
  },
  {
    name: "heliora_resolve_market",
    description: "Trigger 5-agent AI oracle consensus resolution on a market. Returns YES/NO/INVALID + per-agent votes.",
    schema: z.object({ marketId: z.string(), context: z.string().optional() }),
    handler: async (input, { client }) => {
      const i = input as { marketId: string; context?: string };
      return client.resolveMarket(i.marketId, i.context ?? "");
    },
  },
];

/**
 * Register Heliora actions into a Solana Agent Kit instance.
 *
 * @example
 *   import { SolanaAgentKit } from "solana-agent-kit";
 *   import { registerHelioraPlugin } from "@solanaspredict/agent-kit-plugin";
 *   const kit = new SolanaAgentKit(privateKey, rpcUrl, openaiApiKey);
 *   registerHelioraPlugin(kit, { walletAddress: kit.wallet_address.toString() });
 */
export function registerHelioraPlugin(
  agentKit: { addAction?: (a: AgentKitAction) => void; actions?: AgentKitAction[] },
  config: HelioraConfig = {},
): { client: HelioraClient; actions: AgentKitAction[] } {
  const client = new HelioraClient(config);
  const wrapped = helioraActions.map((a) => ({
    ...a,
    handler: (input: unknown) => a.handler(input, { client }),
  }));
  if (typeof agentKit.addAction === "function") {
    wrapped.forEach((a) => agentKit.addAction!(a));
  } else if (Array.isArray(agentKit.actions)) {
    agentKit.actions.push(...wrapped);
  }
  return { client, actions: wrapped };
}

export default registerHelioraPlugin;
