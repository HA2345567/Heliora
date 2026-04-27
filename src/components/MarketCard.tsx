import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUsd, timeUntil } from "@/lib/api";
import type { ApiMarket } from "@/lib/api-types";

export function MarketCard({
  market,
  compact = false,
}: {
  market: ApiMarket;
  compact?: boolean;
}) {
  const yesPct = Math.round(market.yesPrice * 100);
  const trend = market.yesPrice - 0.5;
  const trendUp = trend >= 0;

  return (
    <Link
      to={`/markets/${market.id}`}
      className="group relative flex flex-col rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-elevated shadow-ring"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {market.category}
          </span>
          {market.isLive && (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              <Radio className="h-3 w-3 animate-pulse-soft" /> LIVE
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          ends in {timeUntil(market.endsAt)}
        </div>
      </div>

      <h3
        className={cn(
          "mt-4 font-display leading-snug text-foreground",
          compact ? "text-base" : "text-lg",
        )}
      >
        {market.question}
      </h3>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-foreground">{yesPct}%</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">YES</span>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1 font-mono text-xs",
              trendUp ? "text-success" : "text-destructive",
            )}
          >
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {(trend * 100).toFixed(1)}%
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${yesPct}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span className="font-mono">{formatUsd(market.volume)} vol</span>
        <span className="font-mono">{market.participants.toLocaleString()} traders</span>
        <span className="font-mono">{market.resolution}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 opacity-0 transition group-hover:opacity-100">
        <button className="rounded-md border border-border bg-background py-1.5 text-xs font-semibold text-foreground hover:bg-success/10 hover:border-success/40 hover:text-success">
          Buy YES · {market.yesPrice.toFixed(2)}
        </button>
        <button className="rounded-md border border-border bg-background py-1.5 text-xs font-semibold text-foreground hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive">
          Buy NO · {market.noPrice.toFixed(2)}
        </button>
      </div>
    </Link>
  );
}
