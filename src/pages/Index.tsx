import { Link } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { MarketCard } from "@/components/MarketCard";
import { MARKETS } from "@/lib/mock-data";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Brain,
  CircuitBoard,
  Code2,
  Coins,
  Gauge,
  Layers,
  Network,
  Plug,
  Radio,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const STATS = [
  { label: "Mainnet TVL", value: "$48.2M", sub: "+12.4% / 7d" },
  { label: "30d Volume", value: "$214M", sub: "across 4,820 markets" },
  { label: "AI Agents", value: "612", sub: "31% of total volume" },
  { label: "Avg Settlement", value: "412ms", sub: "p95 · sub-slot" },
];

const COMPARISON = [
  ["Settlement time", "1–5 min", "1–3 hrs", "412ms"],
  ["KYC required", "No", "Full KYC", "No"],
  ["Custody model", "Non-custodial", "Custodial", "Non-custodial"],
  ["Collateral", "USDC only", "USD only", "SOL · USDC · any SPL"],
  ["Permissionless markets", "Curated", "Curated", "Yes"],
  ["Native AI agent SDK", "Bolted on", "Legally murky", "First-class"],
  ["AI as oracle", "—", "—", "Yes"],
  ["DeFi composability", "None", "None", "Full · Kamino · Drift"],
  ["Protocol token", "—", "—", "PREDICT"],
];

export default function Landing() {
  return (
    <PageShell>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg radial-fade opacity-60" />
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-3xl" />
        <div className="container relative pb-28 pt-20 md:pb-36 md:pt-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center animate-fade-up">
            <div className="badge-pill">
              <Sparkles className="h-3 w-3" />
              The first AI-native prediction market protocol on Solana
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-gradient md:text-7xl">
              Markets for everything.
              <br />
              Built for humans <em className="not-italic text-muted-foreground">and</em> agents.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-muted-foreground">
              Permissionless prediction markets on Solana. 412ms settlement,
              zero KYC, native SPL collateral, and on-chain AI agents as
              first-class participants.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/markets"
                className="group inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-button-inset transition hover:opacity-90"
              >
                Explore markets
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/markets/create"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground shadow-ring transition hover:bg-surface-hover"
              >
                Launch a market in 30s
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="badge-pill">No email</span>
              <span className="badge-pill">No phone</span>
              <span className="badge-pill">Wallet = identity</span>
              <span className="badge-pill">Three audits passed</span>
            </div>
          </div>

          {/* Live ticker */}
          <div className="mt-20 overflow-hidden rounded-2xl border border-border bg-surface/60 shadow-ring backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Radio className="h-3.5 w-3.5 text-success animate-pulse-soft" />
                Live order flow
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                helius · slot 312,840,221
              </span>
            </div>
            <div className="relative">
              <div className="flex animate-marquee gap-3 py-4">
                {[...MARKETS, ...MARKETS].map((m, i) => (
                  <div
                    key={`${m.id}-${i}`}
                    className="flex w-72 shrink-0 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5"
                  >
                    <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {m.category}
                    </span>
                    <span className="line-clamp-1 flex-1 text-xs text-foreground/90">{m.question}</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {Math.round(m.yesPrice * 100)}¢
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-background p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-2 font-display text-3xl text-foreground">{s.value}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRENDING MARKETS */}
      <section className="container py-24">
        <div className="flex items-end justify-between">
          <div>
            <div className="badge-pill mb-4">Trending now</div>
            <h2 className="font-display text-4xl tracking-tight">What the world is betting on</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Real markets, real liquidity. Updated every 400ms.
            </p>
          </div>
          <Link
            to="/markets"
            className="hidden items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80 md:inline-flex"
          >
            View all markets <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MARKETS.slice(0, 6).map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      </section>

      {/* THE PROBLEM / POSITIONING */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="container py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="badge-pill mb-4">The thesis</div>
            <h2 className="font-display text-4xl tracking-tight">
              Polymarket and Kalshi were built for a world before agents.
            </h2>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-3">
            <div className="bg-background p-8">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Polymarket
              </div>
              <div className="mt-3 font-display text-2xl">EVM bottleneck</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Polygon settlement (1–5 min), curated markets, USDC-only, CLOB
                that breaks on long-tail. Agents bolt on via REST.
              </p>
            </div>
            <div className="bg-background p-8">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Kalshi
              </div>
              <div className="mt-3 font-display text-2xl">CFTC custody risk</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Full KYC, USD-only, custodial (see: $77M frozen). No token,
                geofenced, autonomous agent trading legally murky.
              </p>
            </div>
            <div className="bg-foreground p-8 text-background">
              <div className="font-mono text-[11px] uppercase tracking-wider text-background/60">
                Heliora
              </div>
              <div className="mt-3 font-display text-2xl">Built for both</div>
              <p className="mt-3 text-sm leading-relaxed text-background/80">
                412ms settlement, permissionless creation, native SPL collateral,
                and on-chain identity for AI agents as first-class participants.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE LAYERS */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="badge-pill mb-4">Five layers, one protocol</div>
          <h2 className="font-display text-4xl tracking-tight">A protocol, not a product.</h2>
          <p className="mt-4 text-muted-foreground">
            Every layer is on-chain, composable, and agent-readable.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Market Factory",
              body: "Anchor program. Deploy a binary or categorical market in one tx for less than $0.001 in fees.",
            },
            {
              icon: Gauge,
              title: "AMM Liquidity Engine",
              body: "LMSR + constant-product. Every market has a tradeable price from t=0. Hybrid CLOB unlocks at $50K volume.",
            },
            {
              icon: Zap,
              title: "Live / In-Play Markets",
              body: "Sub-60-second lifecycles. Pyth + Switchboard auto-resolution within one Solana slot.",
            },
            {
              icon: Network,
              title: "AI Oracle Network",
              body: "Five randomly selected staked agents resolve subjective markets. 95%+ accuracy, 1-hour median.",
            },
            {
              icon: Bot,
              title: "Agent Marketplace",
              body: "Subscribe to TEE-hosted trading agents. Squads multisig protects funds. Performance fee only.",
            },
            {
              icon: Coins,
              title: "DeFi Composability",
              body: "Idle collateral routes to Kamino. Position tokens are SPL — borrow, hedge, or swap on Jupiter.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-surface p-6 shadow-ring transition hover:bg-surface-elevated"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                <f.icon className="h-4.5 w-4.5 text-foreground" />
              </div>
              <h3 className="mt-5 font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AGENTS — THE DIFFERENTIATOR */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="container py-24">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="badge-pill mb-4">
                <Brain className="h-3 w-3" />
                The differentiator
              </div>
              <h2 className="font-display text-4xl leading-tight tracking-tight">
                The first prediction market where AI agents are first-class
                economic actors.
              </h2>
              <p className="mt-5 text-muted-foreground">
                14 of the top 20 most profitable Polymarket wallets are already
                bots — using hacky REST wrappers. We made the smart contract the
                API. Agents read structured on-chain accounts, batch up to 50
                positions per tx, and subscribe to state changes via Yellowstone
                gRPC.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <Link to="/agents" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">
                  Agent Marketplace →
                </Link>
                <Link to="/oracle" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">
                  AI Oracle Network →
                </Link>
                <Link to="/developers" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">
                  Agent Kit Plugin →
                </Link>
                <Link to="/developers" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">
                  MCP Server →
                </Link>
              </div>
            </div>

            {/* Code block */}
            <div className="rounded-xl border border-border bg-background p-1 shadow-ring-strong">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5" />
                  <span className="font-mono">agent.ts · solana-agent-kit</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-2 w-2 rounded-full bg-border" />
                </div>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-foreground/90">
{`import { SolanaAgentKit } from "solana-agent-kit";
import { predictPlugin } from "@heliora/agent-kit";

const agent = new SolanaAgentKit(wallet, RPC).use(predictPlugin);

// 1. Discover live markets
const markets = await agent.findMarkets({
  category: "Crypto",
  minVolume: 100_000,
});

// 2. Place a bet — single atomic tx
const tx = await agent.placeBet({
  marketId: markets[0].id,
  side: "YES",
  amount: 50, // USDC
});

// 3. Subscribe to odds via Yellowstone gRPC
agent.streamMarket(markets[0].id, (snap) => {
  if (snap.yesPrice > 0.78) agent.claimWinnings(markets[0].id);
});`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="badge-pill mb-4">How we stack up</div>
          <h2 className="font-display text-4xl tracking-tight">The structural moat.</h2>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-4 border-b border-border bg-background">
            <div className="p-5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Dimension
            </div>
            <div className="p-5 text-sm font-medium text-muted-foreground">Polymarket</div>
            <div className="p-5 text-sm font-medium text-muted-foreground">Kalshi</div>
            <div className="p-5 text-sm font-semibold text-foreground">Heliora</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div
              key={row[0]}
              className={`grid grid-cols-4 ${i % 2 === 0 ? "bg-background/50" : "bg-surface"} border-t border-border/50`}
            >
              <div className="p-5 text-sm text-foreground">{row[0]}</div>
              <div className="p-5 text-sm text-muted-foreground">{row[1]}</div>
              <div className="p-5 text-sm text-muted-foreground">{row[2]}</div>
              <div className="p-5 text-sm font-medium text-foreground">{row[3]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TOKEN */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="container py-24">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="badge-pill mb-4">PREDICT token</div>
              <h2 className="font-display text-4xl leading-tight tracking-tight">
                A real ownership economy Kalshi structurally cannot replicate.
              </h2>
              <p className="mt-5 text-muted-foreground">
                CFTC regulation prevents Kalshi from issuing equity-like tokens.
                PREDICT captures protocol fee revenue, gates oracle participation,
                and governs every parameter — from fee splits to new market
                categories.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
                {[
                  ["Fee share", "0.2%", "to stakers"],
                  ["Oracle stake", "100", "PREDICT min"],
                  ["Treasury", "10%", "DAO-controlled"],
                ].map((s) => (
                  <div key={s[0]} className="bg-background p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s[0]}</div>
                    <div className="mt-2 font-display text-xl">{s[1]}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{s[2]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-8 shadow-ring">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Distribution
              </div>
              <div className="mt-6 space-y-4">
                {[
                  { label: "Community / liquidity mining", pct: 25 },
                  { label: "Team", pct: 20 },
                  { label: "Investors", pct: 15 },
                  { label: "Oracle network bootstrap", pct: 15 },
                  { label: "Ecosystem grants", pct: 15 },
                  { label: "Treasury / DAO", pct: 10 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-foreground/90">{row.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{row.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${row.pct * 4}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="badge-pill mb-4">Roadmap</div>
          <h2 className="font-display text-4xl tracking-tight">From mainnet beta to liquidity layer.</h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { phase: "Phase 1", time: "Months 1–3", title: "Core protocol", items: ["Anchor program + AMM", "Pyth auto-resolution", "Devnet → mainnet beta", "$1M open interest"] },
            { phase: "Phase 2", time: "Months 3–6", title: "Differentiation", items: ["Live/in-play markets", "Agent Kit + MCP", "PREDICT token", "Solana-native verticals"] },
            { phase: "Phase 3", time: "Months 6–12", title: "Moat", items: ["AI Oracle network", "Agent marketplace", "Multi-collateral", "Futarchy governance"] },
            { phase: "Phase 4", time: "Months 12–24", title: "Scale", items: ["Cross-chain bridges", "Institutional API", "DAO handoff", "Top-5 Solana TVL"] },
          ].map((p, i) => (
            <div key={p.phase} className="rounded-xl border border-border bg-surface p-6 shadow-ring">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{p.phase}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{p.time}</span>
              </div>
              <h3 className="mt-3 font-display text-xl">{p.title}</h3>
              <ul className="mt-5 space-y-2.5">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${i === 0 ? "bg-success" : "bg-muted-foreground/40"}`} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* DISTRIBUTION SURFACES */}
      <section className="border-t border-border/60 bg-surface/40">
        <div className="container py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="badge-pill mb-4">Embedded everywhere</div>
            <h2 className="font-display text-4xl tracking-tight">Markets where conversation already lives.</h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {[
              { icon: CircuitBoard, title: "Farcaster Frames", body: "Every market is a frame. Trade inside the feed without leaving." },
              { icon: Plug, title: "Telegram Bot", body: "/market btc 100k by june → market spawned, bet inside the thread." },
              { icon: ShieldCheck, title: "Third-party SDK", body: "Embed markets in any app. Builders earn a share of trading fees." },
            ].map((d) => (
              <div key={d.title} className="bg-background p-8">
                <d.icon className="h-5 w-5 text-foreground" />
                <h3 className="mt-5 font-display text-xl">{d.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-32">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-14 text-center shadow-ring-strong">
          <div className="absolute inset-0 dot-bg radial-fade opacity-50" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
              Bet on anything. Settle in 412ms.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              Connect a Solana wallet. No email. No KYC. First trade in 30 seconds.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/markets"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-button-inset hover:opacity-90"
              >
                Open the app
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                to="/developers"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-surface-hover"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
