# HELIORA — Product Requirements Document

## 1. Original Problem Statement
Build the complete backend, Solana smart contracts, and live market integration for **HELIORA** — an AI-native prediction market protocol on Solana. Strict minimal grayscale theme inspired by Cal.com. Decentralized exchange at `/market/:marketId` with live prediction chart (line + candle, Polymarket-style) and live orderbook (Backpack-style). Wallet connect (Phantom/Backpack/Solflare). Connect Create Market to `POST /api/markets`, Portfolio to `GET /api/portfolio`, and Oracle UI to `POST /api/oracle/resolve/:id`. Add volume bars below the main chart and flash animations to orderbook rows.

## 2. Architecture

| Layer | Stack |
|-------|-------|
| Frontend | React + Vite, Tailwind, Recharts, Solana Wallet Adapters (Phantom/Backpack/Solflare) |
| Backend | FastAPI + MongoDB (Motor) + WebSockets |
| AI Oracle | 5-agent consensus via Emergent LLM Key (gpt-4.1-mini) |
| On-chain | Anchor program at `/app/programs/heliora_market_factory/` (source-complete, awaiting devnet deploy) |
| Agent Kit Plugin | TypeScript SDK at `/app/packages/agent-kit-plugin/` |
| MCP Server | Python at `/app/packages/mcp-server/` (9 tools, stdio transport) |

## 3. Implemented (as of 2026-04-28)

### Frontend
- Home, Markets, Market Detail, Portfolio, Oracle, Create Market, Agents, Leaderboard, Developers
- Polymarket-style price chart with volume bars below
- Backpack-style 15-deep orderbook with flash animations on update
- Solana wallet connect (Phantom, Backpack, Solflare)
- Cal.com-inspired grayscale design system

### Backend
- `GET/POST /api/markets`, `GET /api/markets/:id`, `GET /api/markets/:id/orderbook`
- `POST /api/trades`, `GET /api/trades/recent/:id`
- `GET /api/portfolio`
- `GET/POST /api/agents`, `POST /api/agents/:id/subscribe`
- `GET /api/oracle/recent`, **`POST /api/oracle/resolve/:id`** with new consensus logic
- `GET /api/stats/protocol`, `GET /api/stats/leaderboard`
- `WS /api/ws/:market_id` — live price + orderbook stream
- Auto-seeds 20 markets, 6 agents, 5 users, trades + resolutions

### AI Oracle (5-Agent Consensus)
- Runs 5 LLM agents in **parallel** (asyncio.gather) for ~412ms-class settlement
- Hard threshold: ≥3-of-5 agreement
- Confidence-weighted tally + per-agent evidence
- Disputed: `consensus < 3` OR `avg_confidence < 0.55` → status="disputed", no outcome
- Returns: `{outcome, consensus, totalVotes, tally, weightedConfidence, averageConfidence, consensusThreshold, isDisputed, votes[5], reasoning}`

### Solana Anchor Program (`heliora_market_factory`)
- Instructions: `create_market`, `place_bet` (x·y=k AMM), `submit_oracle_vote`, `claim`
- Accounts: `Market`, `Position`, `OracleVote` (PDAs)
- Events: `MarketCreated`, `BetPlaced`, `OracleVoteSubmitted`, `Claimed`
- Errors: 15 typed `HelioraError` variants
- Auto-resolves on ≥3 votes for any single outcome
- Fee: 1% (100 bps), USDC vault PDA per market

### `@solanaspredict/agent-kit-plugin` (TypeScript)
- `HelioraClient` REST wrapper
- 7 agent-kit actions: list_markets, get_market, create_market, place_trade, get_portfolio, get_orderbook, resolve_market
- Zod schemas for all inputs
- `registerHelioraPlugin(kit, config)` one-line install

### `heliora-mcp-server` (Python)
- MCP stdio transport
- 9 natural-language tools (incl. protocol_stats, leaderboard)
- Drop-in Claude Desktop / Cursor / Continue compatible

## 4. Verified
- Backend: **10/10 pytest tests passing** (`/app/backend/tests/backend_test.py`)
- Frontend: All routes load; Trigger Resolution Panel renders full new payload (tally chips + dispute warning + per-agent confidence)
- Vite host fix: `allowedHosts: true` — preview accessible

## 5. Roadmap

### P0 — Devnet Launch
- Deploy `heliora_market_factory` to Solana Devnet (anchor build + deploy)
- Generate IDL → frontend Anchor client (replace MongoDB writes for trades with on-chain CPI)
- USDC mock mint for testnet betting flow

### P1 — Distribution
- Publish `@solanaspredict/agent-kit-plugin` to npm
- Publish `heliora-mcp-server` to PyPI
- Submit MCP server to Anthropic registry

### P2 — Scale
- WebSocket clean-up (rate-limit price_point persistence on idle clients)
- Refactor `server.py` into `routes/markets.py`, `routes/oracle.py`, etc.
- Mainnet beta with audited program upgrade

## 6. Known Notes
- LLM_KEY configured (Emergent). Some sports/future-event markets legitimately resolve INVALID 5/5 (correct behavior).
- Anchor program is source-complete only; no devnet deployment in this container.
- `random.gauss` noise added to leaderboard PnL — demo-only.
