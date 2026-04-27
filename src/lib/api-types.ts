// Shared API types matching backend Prisma models.

export type MarketCategory =
  | "Crypto" | "Politics" | "Sports" | "Memes"
  | "NFTs" | "DeFi" | "Social" | "AI";

export type ResolutionSource = "Pyth" | "Switchboard" | "AIOracle" | "DAOVote";
export type MarketStatus = "open" | "resolving" | "resolved" | "disputed";
export type Outcome = "YES" | "NO" | "INVALID";
export type Side = "YES" | "NO";
export type TradeKind = "market" | "limit" | "stop";

export interface ApiUser {
  id: string;
  wallet: string;
  handle?: string | null;
}

export interface ApiMarket {
  id: string;
  onchainId?: string | null;
  question: string;
  description?: string | null;
  category: MarketCategory;
  resolution: ResolutionSource;
  resolutionDetail?: string | null;
  endsAt: string;
  resolvedAt?: string | null;
  status: MarketStatus;
  outcome?: Outcome | null;
  yesPrice: number;
  noPrice: number;
  liquidity: number;
  volume: number;
  participants: number;
  isLive: boolean;
  creator: { wallet: string; handle?: string | null };
  createdAt: string;
}

export interface ApiPricePoint { yesPrice: number; noPrice: number; ts: string }

export interface ApiTrade {
  id: string;
  marketId: string;
  side: Side;
  kind: TradeKind;
  shares: number;
  price: number;
  cost: number;
  txSig?: string | null;
  createdAt: string;
  user?: { wallet: string; handle?: string | null };
}

export interface ApiPosition {
  id: string;
  marketId: string;
  yesShares: number;
  noShares: number;
  avgYesCost: number;
  avgNoCost: number;
  realizedPnl: number;
  market: ApiMarket;
}

export interface ApiAgent {
  id: string;
  name: string;
  handle: string;
  wallet: string;
  type: "Sentiment" | "Arbitrage" | "MarketMaker" | "NewsAlpha" | "Momentum";
  description: string;
  pnl30d: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  aum: number;
  performanceFee: number;
  uptime: number;
  marketsTraded: number;
  status: "live" | "paused";
  _count?: { subscriptions: number };
}

export interface ApiOracleResolution {
  id: string;
  marketId: string;
  outcome: Outcome;
  consensus: number;
  totalVotes: number;
  reasoning?: string | null;
  createdAt: string;
  market: ApiMarket;
  votes: {
    id: string;
    vote: Outcome;
    confidence: number;
    evidence?: string | null;
    agent: ApiAgent;
  }[];
}

export interface ApiProtocolStats {
  markets: number;
  openMarkets: number;
  agents: number;
  users: number;
  totalVolume: number;
  totalLiquidity: number;
}
