import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PageShell } from "@/components/layout/PageShell";
import { api, formatUsd, timeUntil } from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Coins, ExternalLink, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Portfolio() {
  const { connected, publicKey } = useWallet();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolio", publicKey?.toBase58()],
    queryFn: () => api.portfolio(),
    enabled: connected,
  });

  if (!connected) {
    return (
      <PageShell>
        <section className="container flex flex-col items-center py-32 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground" />
          <h1 className="mt-6 font-display text-3xl">Connect a Solana wallet</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Your wallet is your identity on Heliora. Connect Phantom or Solflare from the top right to see your positions and P&L.
          </p>
        </section>
      </PageShell>
    );
  }

  const positions = data?.positions ?? [];
  const summary = data?.summary;

  return (
    <PageShell>
      <section className="border-b border-border/60">
        <div className="container py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-mono">
                  {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
                </span>
                <span className="badge-pill">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                  Connected
                </span>
              </div>
              <h1 className="mt-3 font-display text-4xl tracking-tight">Portfolio</h1>
            </div>
            <Link to="/markets" className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-sm font-semibold text-background shadow-button-inset">
              Browse markets
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <BigStat label="Open value" value={summary ? `$${summary.openValue.toFixed(2)}` : "—"} sub={`${summary?.positions ?? 0} open`} />
            <BigStat label="Unrealized P&L" value={summary ? `${summary.unrealized >= 0 ? "+" : ""}$${summary.unrealized.toFixed(2)}` : "—"} sub={summary && summary.openValue ? `${((summary.unrealized / summary.openValue) * 100).toFixed(2)}%` : ""} accent={summary && summary.unrealized >= 0 ? "success" : "destructive"} />
            <BigStat label="Realized P&L" value={summary ? `${summary.realized >= 0 ? "+" : ""}$${summary.realized.toFixed(2)}` : "—"} sub="lifetime" />
            <BigStat label="Idle yield" value="$0.00" sub="via Kamino · pending" />
          </div>
        </div>
      </section>

      <section className="container py-10">
        <h2 className="font-display text-2xl">Open positions</h2>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-12 border-b border-border bg-background px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5">Market</div>
            <div className="col-span-1">Side</div>
            <div className="col-span-2 text-right">Avg price</div>
            <div className="col-span-2 text-right">Value</div>
            <div className="col-span-2 text-right">P&L</div>
          </div>
          {isLoading ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : isError ? (
            <div className="px-5 py-12 text-center text-sm text-destructive">Failed to load portfolio</div>
          ) : positions.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              No positions yet. <Link to="/markets" className="text-foreground underline">Browse markets →</Link>
            </div>
          ) : (
            positions.map((p) => {
              const side: "YES" | "NO" = p.yesShares > p.noShares ? "YES" : "NO";
              const shares = side === "YES" ? p.yesShares : p.noShares;
              const avg = side === "YES" ? p.avgYesCost : p.avgNoCost;
              const price = side === "YES" ? p.market.yesPrice : p.market.noPrice;
              const value = shares * price;
              const cost = shares * avg;
              const pnl = value - cost;
              const up = pnl >= 0;
              return (
                <Link to={`/markets/${p.market.id}`} key={p.id} className="grid grid-cols-12 items-center border-t border-border/50 px-5 py-4 transition hover:bg-surface-hover">
                  <div className="col-span-5">
                    <div className="line-clamp-1 text-sm font-medium">{p.market.question}</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span>{p.market.category}</span>
                      <span>·</span>
                      <span>ends {timeUntil(p.market.endsAt)}</span>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", side === "YES" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                      {side}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm">{avg.toFixed(3)}</div>
                  <div className="col-span-2 text-right font-mono text-sm">${value.toFixed(2)}</div>
                  <div className={cn("col-span-2 text-right font-mono text-sm font-semibold", up ? "text-success" : "text-destructive")}>
                    <span className="inline-flex items-center gap-1">
                      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {up ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="container grid gap-6 pb-20 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-surface shadow-ring">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="font-display text-lg">Recent activity</h3>
            <span className="text-xs text-muted-foreground">last 100 trades</span>
          </div>
          <div className="divide-y divide-border/50">
            {(data?.trades ?? []).slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm">
                    <span className="font-medium">{a.side === "YES" ? "Bought YES" : "Bought NO"}</span>{" "}
                    <span className="text-muted-foreground">· {a.market.question}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()} · ${a.cost.toFixed(2)} @ {a.price.toFixed(2)}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ))}
            {!data?.trades?.length && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No activity yet</div>
            )}
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
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function BigStat({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: "success" | "destructive" }) {
  return (
    <div className="bg-background p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-display text-3xl", accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground")}>
        {value}
      </div>
      {sub && <div className="mt-1 font-mono text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
