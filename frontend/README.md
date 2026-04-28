# Heliora — AI-native prediction market protocol on Solana

Heliora is a permissionless prediction-market protocol where humans **and** AI agents
create, trade, and resolve markets on any real-world event with sub-second settlement
and near-zero fees on Solana.

This repo is a monorepo:

```
.
├── src/                 # React + Vite frontend (this app)
├── backend/             # Node.js + Express + Prisma API server
├── programs/heliora/    # Anchor (Rust) Solana program
├── Anchor.toml          # Anchor workspace config
└── README.md            # ← you are here
```

---

## 1. Quick start (local dev)

### Prerequisites

| Tool        | Version    | Why                                 |
|-------------|------------|-------------------------------------|
| Node.js     | ≥ 20       | frontend + backend runtime          |
| bun *or* pnpm | latest   | package manager                     |
| Postgres    | 14+ (Neon, Supabase, local) | backend database |
| Rust + Anchor | 0.30.1   | only if you want to build the on-chain program |
| Solana CLI  | 1.18+      | optional — for deploying the program |

### Step 1 — Clone & install

```bash
git clone <repo>
cd heliora

# Frontend deps
bun install

# Backend deps
cd backend && bun install && cd ..
```

### Step 2 — Configure env

**Frontend** (`.env` in repo root):

```bash
cp .env.example .env
# edit VITE_API_URL / VITE_SOLANA_RPC_URL if needed
```

**Backend** (`backend/.env`):

```bash
cp backend/.env.example backend/.env
# fill in DATABASE_URL (Neon/Supabase/local Postgres)
# fill in GEMINI_API_KEY (rotate the one shared in chat!)
```

### Step 3 — Database

```bash
cd backend
bunx prisma migrate dev --name init
bunx prisma db seed     # optional, loads sample markets/agents
cd ..
```

### Step 4 — Run

In two terminals:

```bash
# terminal 1 — backend on :4000
cd backend && bun run dev

# terminal 2 — frontend on :5173
bun run dev
```

Open <http://localhost:5173>.

---

## 2. Wallet & on-chain integration

The frontend uses `@solana/wallet-adapter` with **Phantom** and **Solflare**.
When a wallet connects, its pubkey is mirrored to `localStorage` and attached to
every backend request as the `x-wallet` header (see `src/lib/api.ts`).

To wire the on-chain program:

```bash
# build + deploy the Anchor program
cd programs/heliora
anchor build
anchor deploy --provider.cluster devnet
# copy the printed program id into:
#   .env                → VITE_HELIORA_PROGRAM_ID
#   backend/.env        → HELIORA_PROGRAM_ID
#   Anchor.toml         → [programs.devnet] heliora = "..."
```

The frontend trade flow currently posts trades to the backend (LMSR pricing
in `backend/src/lib/lmsr.ts`); the on-chain CPI to the Anchor program is the
next integration step and is stubbed in `src/lib/api.ts` (`txSig` field on
`placeTrade`).

---

## 3. Production deployment

### Frontend (Lovable / Vercel / Netlify / Cloudflare Pages)

The frontend is a standard Vite React build:

```bash
bun run build      # outputs dist/
```

- **Lovable** — click **Publish** in the top-right. Set env vars in
  *Project Settings → Environment Variables* (`VITE_API_URL`,
  `VITE_SOLANA_RPC_URL`, `VITE_HELIORA_PROGRAM_ID`).
- **Vercel / Netlify** — point at this repo, framework: *Vite*, build
  command: `bun run build`, output dir: `dist`.

> SPA routing works out of the box on Lovable (built-in fallback) and Vercel.
> On Netlify add a `_redirects` file with `/* /index.html 200`.

### Backend (Fly.io / Railway / Render / your own VPS)

```bash
cd backend
bun run build       # tsc → dist/
bun run start       # node dist/index.js, listens on $PORT
```

Required env vars in production:

```
DATABASE_URL=postgresql://…   # Neon, Supabase, RDS, etc.
GEMINI_API_KEY=…              # rotate before deploy
GEMINI_MODEL=gemini-1.5-flash
CORS_ORIGIN=https://your-frontend-domain.com
NODE_ENV=production
PORT=4000
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIORA_PROGRAM_ID=…          # set after anchor deploy
```

Run migrations on deploy:

```bash
bunx prisma migrate deploy
```

### Solana program (devnet → mainnet)

```bash
cd programs/heliora
anchor build
anchor deploy --provider.cluster devnet     # test
anchor deploy --provider.cluster mainnet    # production (needs ≥ 5 SOL)
anchor idl init --filepath target/idl/heliora.json <PROGRAM_ID>
```

After deploy, update `HELIORA_PROGRAM_ID` everywhere.

---

## 4. Security checklist before going live

- [ ] Rotate the **Neon** database password (was leaked in chat history).
- [ ] Rotate the **Gemini** API key (was leaked in chat history).
- [ ] Move all secrets to your hosting provider's secret store — never commit `.env`.
- [ ] Run `cargo audit` on the Anchor program.
- [ ] Run `bun audit` on frontend + backend.
- [ ] Get the Anchor program audited (Ottersec / Neodyme / Sec3) before
      handling real funds.

---

## 5. Project scripts

| Command (run in repo root)   | What it does                          |
|------------------------------|---------------------------------------|
| `bun run dev`                | start Vite dev server                 |
| `bun run build`              | typecheck + build frontend            |
| `bun run lint`               | eslint                                |
| `bunx vitest run`            | run unit tests                        |
| `cd backend && bun run dev`  | start API server on :4000             |
| `cd backend && bun run db:studio` | open Prisma Studio                |

---

## 6. Architecture overview

```
        ┌────────────────────┐    fetch     ┌──────────────────────┐
        │  React + Vite       │ ───────────▶ │  Express + Prisma     │
        │  wallet-adapter     │ ◀─────────── │  LMSR pricing engine  │
        │  TanStack Query     │              │  Gemini AI oracle     │
        └─────────┬──────────┘              └──────────┬───────────┘
                  │                                     │
        wallet sig │                          Postgres  │
                  ▼                                     ▼
        ┌────────────────────┐              ┌──────────────────────┐
        │  Phantom / Solflare │              │  Neon / Supabase      │
        └─────────┬──────────┘              └──────────────────────┘
                  │ tx
                  ▼
        ┌────────────────────────────────────────────────────────┐
        │  Heliora Anchor program  (programs/heliora/src/lib.rs) │
        │  • market factory  • LMSR AMM  • SPL position tokens   │
        │  • on-chain agent registry  • oracle resolution        │
        └────────────────────────────────────────────────────────┘
```

---

## 7. License

MIT — see `LICENSE`.
