# Heliora backend

Node.js + TypeScript + Express + Prisma server backing the Heliora prediction-market UI.

## Stack
- Node 20+, TypeScript, Express
- Prisma → Postgres (Neon, Supabase, or local)
- Zod request validation
- LMSR pricing engine (`src/lib/lmsr.ts`)
- Gemini AI client for the AI-Oracle (`src/lib/gemini.ts`)
- ed25519 Sign-In With Solana (`src/lib/auth.ts`)

## Setup

```bash
cd backend
cp .env.example .env          # then edit with rotated DATABASE_URL + GEMINI_API_KEY
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed                  # optional sample data
npm run dev                   # http://localhost:4000
```

## Environment

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (Neon recommended) |
| `GEMINI_API_KEY` | Google Generative Language API key |
| `GEMINI_MODEL` | default `gemini-1.5-flash` |
| `SOLANA_RPC_URL` | RPC for the indexer (devnet/mainnet) |
| `HELIORA_PROGRAM_ID` | Deployed Anchor program id |
| `CORS_ORIGIN` | Comma-separated allowed origins |

## API surface

| Method | Path | Notes |
|---|---|---|
| GET    | `/health` | Liveness |
| POST   | `/api/auth/nonce` | Returns SIWS message + nonce |
| POST   | `/api/auth/verify` | Verifies signature, upserts user |
| POST   | `/api/auth/handle` | Set display handle |
| GET    | `/api/markets` | Filter/sort/search markets |
| GET    | `/api/markets/:id` | Detail + price points + recent trades |
| GET    | `/api/markets/:id/orderbook` | Synthetic depth ladder |
| POST   | `/api/markets` | Create (requires `x-wallet`) |
| POST   | `/api/trades` | Place trade (requires `x-wallet`) |
| GET    | `/api/trades/recent/:marketId` | Recent fills |
| GET    | `/api/portfolio` | User positions + summary |
| GET    | `/api/agents` | Agent marketplace |
| GET    | `/api/agents/:id` | Agent detail |
| POST   | `/api/agents/:id/subscribe` | Subscribe with capital |
| GET    | `/api/oracle/recent` | Recent AI-Oracle resolutions |
| POST   | `/api/oracle/resolve/:marketId` | Trigger 5-agent Gemini consensus |
| GET    | `/api/stats/protocol` | Protocol-wide totals |
| GET    | `/api/stats/leaderboard` | Top wallets by P&L |

## Auth model
Read endpoints are public. Write endpoints expect `x-wallet: <pubkey>` (the
frontend attaches it automatically once a wallet is connected). For production,
gate writes behind a session derived from `/api/auth/verify` (SIWS).

## Deploy
- **Render / Railway / Fly.io**: standard Node service. Build = `npm run build`, start = `npm start`. Add env vars from `.env.example`.
- Run `npx prisma migrate deploy` on first boot.
