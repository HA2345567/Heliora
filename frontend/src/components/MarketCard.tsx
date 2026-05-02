import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Radio, CheckCircle2 } from "lucide-react";
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
  const noPct = 100 - yesPct;
  const trend = market.yesPrice - 0.5;
  const trendUp = trend >= 0;

  return (
    <Link
      to={`/markets/${market.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[24px] border border-border/30 bg-[#121212] transition-all hover:border-border-strong hover:shadow-2xl active:scale-[0.99]"
    >
      {/* Banner Image Area */}
      <div className="relative h-32 w-full overflow-hidden">
        {market.imageUrl ? (
          <img src={market.imageUrl} alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-surface to-background opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
        
        {/* Top Badges - Absolute on Image */}
        <div className="absolute left-4 top-4 z-20">
          <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90 border border-white/10 shadow-lg">
            {market.category}
          </span>
        </div>
        <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-success/20 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success border border-success/30 shadow-lg">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Verified
        </div>
      </div>

      <div className="flex flex-col p-5">
        {/* Question */}
        <h3
          className={cn(
            "font-display text-white leading-tight tracking-tight line-clamp-2 min-h-[2.5rem]",
            compact ? "text-lg" : "text-xl",
          )}
        >
          {market.question}
        </h3>

        {/* Outcome Boxes */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* YES Box */}
          <div className="flex flex-col rounded-2xl bg-[#1A1A1A] border border-white/5 py-2.5 px-4 transition-colors group-hover:border-success/20">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Yes</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-success">
                {yesPct}<span className="text-xl ml-0.5">¢</span>
              </span>
              <div className={cn(trendUp ? "text-success" : "text-destructive")}>
                {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>

          {/* NO Box */}
          <div className="flex flex-col rounded-2xl bg-[#1A1A1A] border border-white/5 py-2.5 px-4 transition-colors group-hover:border-destructive/20">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">No</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-destructive">
                {noPct}<span className="text-xl ml-0.5">¢</span>
              </span>
              <div className={cn(!trendUp ? "text-success" : "text-destructive")}>
                {!trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="mt-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]">
            <div
              className="h-full rounded-full bg-success transition-all duration-700 ease-out shadow-[0_0_8px_rgba(34,197,94,0.3)]"
              style={{ width: `${yesPct}%` }}
            />
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-5 flex items-center justify-between text-[11px] font-mono tracking-tight text-muted-foreground/50">
          <div className="flex items-center gap-4">
            <span>{formatUsd(market.volume)} 24h</span>
            <span>{formatUsd(market.liquidity)} liq</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-success/70" />
            {timeUntil(market.endsAt)}
          </div>
        </div>
      </div>
    </Link>
  );
}
