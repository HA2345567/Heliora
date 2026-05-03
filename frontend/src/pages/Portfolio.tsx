import { useQuery } from "@tanstack/react-query";
import { useHelioraWallet } from "@/components/wallet/useHelioraWallet";
import { PageShell } from "@/components/layout/PageShell";
import { api, formatUsd, timeUntil } from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Bot, Coins, ExternalLink, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { RedeemButton } from "@/components/RedeemButton";

export default function Portfolio() {
  const { connected, address: walletAddr, displayAddress } = useHelioraWallet();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolio", walletAddr],
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
  const subscriptions = data?.subscriptions ?? [];
  
  const openPositions = positions.filter((p: any) => p.market.status === 'open');
  const resolvedPositions = positions.filter((p: any) => p.market.status === 'resolved');

  const openValue = openPositions.reduce((s: number, p: any) => s + p.currentValue, 0);
  const unrealized = data?.unrealizedPnl ?? 0;
  const realized = data?.realizedPnl ?? 0;
  const totalAllocated = subscriptions.reduce((s: number, sub: any) => s + sub.capital, 0);

  return (
    <PageShell>
      <section className="border-b border-border/60">
        <div className="container py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-mono">
                  {displayAddress ?? "Unknown"}
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
            <BigStat label="Open value" value={formatUsd(openValue)} sub={`${openPositions.length} positions`} />
            <BigStat label="Unrealized P&L" value={`${unrealized >= 0 ? "+" : ""}${formatUsd(unrealized)}`} sub={openValue ? `${((unrealized / openValue) * 100).toFixed(2)}%` : "0%"} accent={unrealized >= 0 ? "success" : "destructive"} />
            <BigStat label="Agent Staking" value={formatUsd(totalAllocated)} sub={`${subscriptions.length} active agents`} />
            <BigStat label="Realized P&L" value={`${realized >= 0 ? "+" : ""}${formatUsd(realized)}`} sub="lifetime" />
          </div>
        </div>
      </section>

      <section className="container py-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Open positions</h2>
          <span className="text-xs text-muted-foreground">{openPositions.length} active</span>
        </div>

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
          ) : openPositions.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              No open positions. <Link to="/markets" className="text-foreground underline">Find a market →</Link>
            </div>
          ) : (
            openPositions.map((p) => {
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

      {resolvedPositions.length > 0 && (
        <section className="container py-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Resolved markets</h2>
            <span className="text-xs text-muted-foreground">Settled by AI Oracle</span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
            <div className="grid grid-cols-12 border-b border-border bg-background px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <div className="col-span-5">Market</div>
              <div className="col-span-1">Side</div>
              <div className="col-span-2 text-right">Result</div>
              <div className="col-span-2 text-right">Outcome</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {resolvedPositions.map((p) => {
              const side: "YES" | "NO" = p.yesShares > 0 ? "YES" : "NO";
              const won = side === p.market.outcome;
              const marketIdNum = parseInt(p.marketId.replace(/-/g, '').slice(0, 8), 16);
              
              return (
                <div key={p.id} className="grid grid-cols-12 items-center border-t border-border/50 px-5 py-4">
                  <div className="col-span-5">
                    <div className="line-clamp-1 text-sm font-medium">{p.market.question}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{p.market.category}</div>
                  </div>
                  <div className="col-span-1">
                    <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", side === "YES" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                      {side}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold uppercase", won ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                      {won ? "Won" : "Lost"}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm">
                    {p.market.outcome}
                  </div>
                  <div className="col-span-2 text-right">
                    {won && (p.yesShares > 0 || p.noShares > 0) ? (
                      <RedeemButton marketId={p.market.id} marketIdNum={marketIdNum} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{won ? "Redeemed" : "Finalized"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {subscriptions.length > 0 && (
        <section className="container py-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Agent Staking</h2>
            <Link to="/agents" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Browse more <Sparkles className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subscriptions.map((s: any) => (
              <Link to={`/agents/${s.agentId}`} key={s.id} className="group rounded-2xl border border-border bg-surface p-5 shadow-ring transition hover:bg-surface-elevated">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-display text-lg leading-tight">{s.agentName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{s.agentHandle}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success uppercase">Active</span>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Allocated</div>
                    <div className="mt-1 font-mono text-base font-semibold">{formatUsd(s.capital)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit/Loss</div>
                    <div className={cn("mt-1 font-mono text-base font-semibold", s.pnl >= 0 ? "text-success" : "text-destructive")}>
                      {s.pnl >= 0 ? "+" : ""}{formatUsd(s.pnl)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container grid gap-6 pb-20 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-surface shadow-ring">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="font-display text-lg">Recent activity</h3>
            <span className="text-xs text-muted-foreground">last 100 trades</span>
          </div>
          <div className="divide-y divide-border/50">
            {(data?.recentTrades ?? []).slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm">
                    <span className="font-medium">{a.side === "YES" ? "Bought YES" : "Bought NO"}</span>{" "}
                    <span className="text-muted-foreground">· {a.question}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()} · ${a.cost.toFixed(2)} @ {a.price.toFixed(3)}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ))}
            {!data?.recentTrades?.length && (
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
