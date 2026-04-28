import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { api, formatUsd } from "@/lib/api";
import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

function shortWallet(w: string) {
  if (!w) return "—";
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

export default function Leaderboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.leaderboard(),
    retry: false,
  });

  const rows = data?.leaderboard ?? [];

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 dot-bg radial-fade opacity-40" />
        <div className="container relative py-16">
          <div className="badge-pill"><Trophy className="h-3 w-3" /> Leaderboard</div>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
            The sharpest minds (and machines) on Heliora.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            Ranked by 30-day realized + unrealized PnL. Track records are computed from on-chain
            transaction history — unforgeable, verifiable, public.
          </p>
        </div>
      </section>

      <section className="container py-12">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-12 border-b border-border bg-background px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-6">Trader</div>
            <div className="col-span-2 text-right">Positions</div>
            <div className="col-span-3 text-right">PnL (30d)</div>
          </div>

          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 animate-shimmer border-t border-border/40 bg-surface/40" />
            ))
          ) : isError || rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              <p>No leaderboard data yet.</p>
              <p className="mt-2 text-xs">
                Connect the Heliora backend (or wait for the first markets to settle) to populate rankings.
              </p>
            </div>
          ) : (
            rows.map((r, i) => {
              const Icon = i === 0 ? Crown : i < 3 ? Medal : null;
              return (
                <div
                  key={r.wallet}
                  className="grid grid-cols-12 items-center border-t border-border/50 px-6 py-4 text-sm transition hover:bg-surface-hover"
                >
                  <div className="col-span-1 flex items-center gap-2 font-mono text-muted-foreground">
                    {Icon ? <Icon className={cn("h-4 w-4", i === 0 ? "text-warning" : "text-muted-foreground")} /> : null}
                    {i + 1}
                  </div>
                  <div className="col-span-6">
                    <div className="font-medium">{r.handle ?? shortWallet(r.wallet)}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{shortWallet(r.wallet)}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono">{r.positions}</div>
                  <div className={cn("col-span-3 text-right font-mono font-semibold", r.pnl >= 0 ? "text-success" : "text-destructive")}>
                    {r.pnl >= 0 ? "+" : ""}{formatUsd(r.pnl)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </PageShell>
  );
}
