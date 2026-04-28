import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { kalshi, centsToProb, categorize, trend, type KalshiMarket } from "@/lib/kalshi";
import { Activity, ArrowDown, ArrowRight, ArrowUp, Radio, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const CATS = ["All", "Crypto", "Politics", "Sports", "Economy", "Culture", "Weather", "Other"] as const;

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "ended";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Live() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [q, setQ] = useState("");

  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["kalshi", "markets"],
    queryFn: () => kalshi.listMarkets({ status: "open", limit: 100 }),
    refetchInterval: 15_000,           // poll every 15s — feels live, kind to upstream
    refetchIntervalInBackground: false,
  });

  const markets = data?.markets ?? [];
  const filtered = useMemo(() => {
    return markets.filter((m) => {
      if (cat !== "All" && categorize(m) !== cat) return false;
      if (q && !`${m.title} ${m.event_ticker}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [markets, cat, q]);

  const totalVol = markets.reduce((s, m) => s + (m.volume_24h ?? 0), 0) / 100; // cents → USD
  const totalLiq = markets.reduce((s, m) => s + (m.liquidity ?? 0), 0) / 100;

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg radial-fade opacity-40" />
        <div className="container relative py-16">
          <div className="badge-pill">
            <Radio className="h-3 w-3 animate-pulse-soft" /> Live · Kalshi liquidity bridge
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
            Real-time prediction markets, mirrored from Kalshi.
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            Heliora aggregates Kalshi's open markets alongside native Solana markets so
            traders see one unified feed. Prices refresh every 15 seconds via our edge proxy —
            arbitrage agents keep them aligned with on-chain liquidity.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Open markets" value={String(markets.length)} />
            <Stat label="24h volume" value={fmtUsd(totalVol)} />
            <Stat label="Liquidity" value={fmtUsd(totalLiq)} />
            <Stat label="Last sync" value={dataUpdatedAt ? `${Math.max(1, Math.floor((Date.now() - dataUpdatedAt) / 1000))}s ago` : "—"} />
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search live markets…"
              className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  cat === c
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-hover disabled:opacity-50"
          >
            <Activity className={cn("h-3.5 w-3.5", isFetching && "animate-pulse-soft")} />
            {isFetching ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="container py-10">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-44 animate-shimmer rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-dashed border-destructive/40 py-16 text-center">
            <p className="text-sm text-destructive">Couldn't reach Kalshi proxy</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            No markets match your filters.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => <KalshiCard key={m.ticker} m={m} />)}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl">{value}</div>
    </div>
  );
}

function KalshiCard({ m }: { m: KalshiMarket }) {
  const yesProb = centsToProb(m.yes_bid);
  const tr = trend(m);
  const TrIcon = tr === "up" ? ArrowUp : tr === "down" ? ArrowDown : ArrowRight;
  const trColor = tr === "up" ? "text-success" : tr === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-ring transition hover:bg-surface-elevated">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {categorize(m)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
          <Zap className="h-2.5 w-2.5" /> Kalshi
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 font-display text-base leading-snug">{m.title}</h3>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">YES</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-semibold text-success">{(yesProb * 100).toFixed(0)}¢</span>
            <TrIcon className={cn("h-3.5 w-3.5", trColor)} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">NO</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-destructive">{(100 - yesProb * 100).toFixed(0)}¢</div>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full bg-success transition-all" style={{ width: `${yesProb * 100}%` }} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
        <span>{fmtUsd((m.volume_24h ?? 0) / 100)} 24h</span>
        <span>{fmtUsd((m.liquidity ?? 0) / 100)} liq</span>
        <span>{timeUntil(m.close_time)}</span>
      </div>
    </div>
  );
}
