import { PageShell } from "@/components/layout/PageShell";
import { MARKETS, formatUsd, timeUntil } from "@/lib/mock-data";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Coins, Download, ExternalLink, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const POSITIONS = MARKETS.slice(0, 5).map((m, i) => {
  const side: "YES" | "NO" = i % 2 === 0 ? "YES" : "NO";
  const price = side === "YES" ? m.yesPrice : m.noPrice;
  const cost = [120, 50, 320, 80, 200][i];
  const shares = cost / (price - 0.05);
  const value = shares * price;
  return { market: m, side, cost, shares, value, pnl: value - cost };
});

const ACTIVITY = [
  { t: "12m", action: "Bought YES", market: "Will SOL flip ETH 24h volume?", amount: 50, price: 0.41 },
  { t: "1h", action: "Claimed", market: "BTC > $130k by April 30", amount: 280, price: 1.0 },
  { t: "4h", action: "Bought NO", market: "Mad Lads floor > 60 SOL", amount: 80, price: 0.73 },
  { t: "1d", action: "Sold YES", market: "Pump.fun token reaches $50M", amount: 144, price: 0.71 },
  { t: "2d", action: "Provided liquidity", market: "Lakers reach 2026 Finals", amount: 500, price: 0.18 },
];

export default function Portfolio() {
  const totalValue = POSITIONS.reduce((s, p) => s + p.value, 0);
  const totalCost = POSITIONS.reduce((s, p) => s + p.cost, 0);
  const totalPnl = totalValue - totalCost;
  const winRate = 64;

  return (
    <PageShell>
      <section className="border-b border-border/60">
        <div className="container py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-mono">8xKp…f9R3</span>
                <span className="badge-pill">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                  Connected
                </span>
              </div>
              <h1 className="mt-3 font-display text-4xl tracking-tight">Portfolio</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-hover">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <Link to="/markets" className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-sm font-semibold text-background shadow-button-inset">
                Browse markets
              </Link>
            </div>
          </div>

          {/* Big stats */}
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <BigStat label="Portfolio value" value={`$${totalValue.toFixed(2)}`} sub={<span className={cn("font-mono text-xs", totalPnl >= 0 ? "text-success" : "text-destructive")}>{totalPnl >= 0 ? "+" : ""}{((totalPnl / totalCost) * 100).toFixed(2)}%</span>} />
            <BigStat label="Realized P&L (30d)" value={`+$${(842.42).toFixed(2)}`} sub="14 closed positions" />
            <BigStat label="Win rate" value={`${winRate}%`} sub="vs 49% protocol avg" />
            <BigStat label="Idle yield earned" value="$24.81" sub="via Kamino · 5.4% APY" />
          </div>
        </div>
      </section>

      {/* Positions */}
      <section className="container py-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Open positions</h2>
          <div className="flex items-center gap-2 text-xs">
            {["All", "Open", "Resolved", "Disputed"].map((t, i) => (
              <button key={t} className={cn("rounded-md px-3 py-1.5 font-medium", i === 0 ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{t}</button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-12 border-b border-border bg-background px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5">Market</div>
            <div className="col-span-1">Side</div>
            <div className="col-span-2 text-right">Avg price</div>
            <div className="col-span-2 text-right">Value</div>
            <div className="col-span-2 text-right">P&L</div>
          </div>
          {POSITIONS.map((p) => {
            const up = p.pnl >= 0;
            return (
              <Link to={`/markets/${p.market.id}`} key={p.market.id} className="grid grid-cols-12 items-center border-t border-border/50 px-5 py-4 transition hover:bg-surface-hover">
                <div className="col-span-5">
                  <div className="line-clamp-1 text-sm font-medium">{p.market.question}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span>{p.market.category}</span>
                    <span>·</span>
                    <span>ends {timeUntil(p.market.endsAt)}</span>
                  </div>
                </div>
                <div className="col-span-1">
                  <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", p.side === "YES" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                    {p.side}
                  </span>
                </div>
                <div className="col-span-2 text-right font-mono text-sm">{(p.cost / p.shares).toFixed(3)}</div>
                <div className="col-span-2 text-right font-mono text-sm">${p.value.toFixed(2)}</div>
                <div className={cn("col-span-2 text-right font-mono text-sm font-semibold", up ? "text-success" : "text-destructive")}>
                  <span className="inline-flex items-center gap-1">
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {up ? "+" : ""}${p.pnl.toFixed(2)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Activity + Composability */}
      <section className="container grid gap-6 pb-20 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-surface shadow-ring">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="font-display text-lg">Recent activity</h3>
            <button className="text-xs text-muted-foreground hover:text-foreground">View all <ExternalLink className="ml-1 inline h-3 w-3" /></button>
          </div>
          <div className="divide-y divide-border/50">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm">
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-muted-foreground">· {a.market}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{a.t} ago · ${a.amount} @ {a.price.toFixed(2)}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-ring">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <Coins className="h-3 w-3" /> DeFi composability
            </div>
            <div className="mt-3 font-display text-lg leading-snug">Use position tokens as collateral.</div>
            <div className="mt-4 space-y-3">
              {[
                { name: "Kamino", apy: "5.4% APY", on: true },
                { name: "MarginFi", apy: "Borrow 4.2%", on: true },
                { name: "Drift Perps", apy: "Hedge", on: false },
                { name: "Jupiter Swap", apy: "Trade", on: true },
              ].map((p) => (
                <div key={p.name} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{p.apy}</div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", p.on ? "bg-success/15 text-success" : "bg-surface text-muted-foreground")}>
                    {p.on ? "Active" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-ring">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Auto-payout routing
            </div>
            <p className="mt-2 text-sm text-muted-foreground">On resolution, winnings auto-route to your selected destination.</p>
            <div className="mt-3 space-y-2 text-sm">
              {["Wallet (USDC)", "Kamino vault", "Compound into next market"].map((o, i) => (
                <label key={o} className="flex items-center gap-2 rounded-md border border-border bg-background p-2.5">
                  <input type="radio" defaultChecked={i === 0} className="accent-foreground" />
                  {o}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function BigStat({ label, value, sub }: { label: string; value: string; sub: any }) {
  return (
    <div className="bg-background p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
      <div className="mt-1">{typeof sub === "string" ? <span className="font-mono text-xs text-muted-foreground">{sub}</span> : sub}</div>
    </div>
  );
}
