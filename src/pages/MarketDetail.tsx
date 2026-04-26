import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { MARKETS, formatUsd, timeUntil, type Market } from "@/lib/mock-data";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Bookmark,
  CandlestickChart,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Flame,
  LineChart as LineChartIcon,
  Radio,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "YES" | "NO";
type OrderType = "Market" | "Limit" | "Stop";
type ChartMode = "Line" | "Candle";
type Range = "1H" | "1D" | "1W" | "1M" | "ALL";

export default function MarketDetail() {
  const { id } = useParams();
  const market = useMemo(() => MARKETS.find((m) => m.id === id) ?? MARKETS[0], [id]);

  // Live ticking price
  const [livePrice, setLivePrice] = useState(market.yesPrice);
  const [tickDir, setTickDir] = useState<"up" | "down" | "flat">("flat");
  useEffect(() => {
    setLivePrice(market.yesPrice);
    const t = setInterval(() => {
      setLivePrice((p) => {
        const drift = (Math.random() - 0.5) * 0.012;
        const next = Math.min(0.99, Math.max(0.01, p + drift));
        setTickDir(next > p ? "up" : next < p ? "down" : "flat");
        return next;
      });
    }, 1500);
    return () => clearInterval(t);
  }, [market.id, market.yesPrice]);

  // Trading state
  const [side, setSide] = useState<Side>("YES");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [amount, setAmount] = useState(100);
  const [limitPrice, setLimitPrice] = useState<number>(Math.round(market.yesPrice * 100));
  const [chartMode, setChartMode] = useState<ChartMode>("Line");
  const [range, setRange] = useState<Range>("1D");
  const [tab, setTab] = useState<"orderbook" | "activity" | "holders" | "rules">("orderbook");
  const [bookmarked, setBookmarked] = useState(false);

  const livePriceForSide = side === "YES" ? livePrice : 1 - livePrice;
  const fillPrice = orderType === "Market" ? livePriceForSide : limitPrice / 100;
  const shares = amount / Math.max(0.01, fillPrice);
  const potential = shares; // each winning share pays $1
  const profit = potential - amount;
  const fee = amount * 0.01;

  const candles = useMemo(() => generateCandles(market.yesPrice, market.trend, range), [market.id, market.trend, range, market.yesPrice]);
  const linePoints = useMemo(() => candles.map((c) => c.close), [candles]);
  const orderbook = useMemo(() => generateOrderbook(livePrice), [livePrice]);
  const subMarkets = useMemo(() => buildSubMarkets(market), [market]);
  const activity = useMemo(() => generateActivity(market), [market]);
  const holders = useMemo(() => generateHolders(market), [market]);

  const yesCents = Math.round(livePrice * 100);
  const noCents = 100 - yesCents;

  return (
    <PageShell>
      {/* Subtle ambient gradient at top */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(0 0% 100% / 0.06), transparent 70%)",
          }}
        />

        <div className="container py-6">
          {/* Breadcrumb */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/markets" className="inline-flex items-center gap-1.5 hover:text-foreground transition">
                <ArrowLeft className="h-3.5 w-3.5" /> Markets
              </Link>
              <span className="text-border">/</span>
              <span className="text-foreground/70">{market.category}</span>
              <span className="text-border">/</span>
              <span className="font-mono text-xs text-muted-foreground/80">{market.id}</span>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <ActionIcon onClick={() => setBookmarked((b) => !b)} active={bookmarked} icon={Bookmark} label="Watch" />
              <ActionIcon icon={Bell} label="Alert" />
              <ActionIcon icon={Share2} label="Share" />
              <ActionIcon icon={Copy} label="Copy link" />
            </div>
          </div>

          {/* Hero header */}
          <header className="mt-5 rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur shadow-ring">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {market.category}
              </span>
              {market.isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  LIVE
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> {market.resolution}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> {(market.participants * 7).toLocaleString()} watching
              </span>
            </div>

            <h1 className="mt-4 font-display text-2xl leading-[1.15] tracking-tight md:text-[34px]">
              {market.question}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Ends in <span className="font-mono text-foreground/90">{timeUntil(market.endsAt)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {market.participants.toLocaleString()} traders
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> {formatUsd(market.volume)} volume
              </span>
              <span className="inline-flex items-center gap-1.5">
                Created by <span className="font-mono text-foreground/80">{market.creator}</span> · {market.createdAgo}
              </span>
            </div>

            {/* Probability bar */}
            <div className="mt-6">
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl tabular-nums text-foreground">
                    {yesCents}
                    <span className="text-2xl text-muted-foreground">¢</span>
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">YES probability</span>
                  <PriceTickPill dir={tickDir} value={market.trend} />
                </div>
                <div className="hidden text-right text-xs text-muted-foreground md:block">
                  <div>NO settles at <span className="font-mono text-foreground/80">{noCents}¢</span></div>
                  <div className="mt-0.5">Spread <span className="font-mono text-foreground/80">0.01</span> · Fee <span className="font-mono text-foreground/80">1%</span></div>
                </div>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-background ring-1 ring-inset ring-border">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-gradient-to-r from-success/80 to-success transition-all duration-700"
                    style={{ width: `${yesCents}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-destructive to-destructive/80 transition-all duration-700"
                    style={{ width: `${noCents}%` }}
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium">
                <span className="text-success">YES · {yesCents}%</span>
                <span className="text-destructive">{noCents}% · NO</span>
              </div>
            </div>
          </header>

          {/* Main grid */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* LEFT */}
            <div className="min-w-0 space-y-6">
              {/* Stats strip */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
                {[
                  { l: "24h Volume", v: formatUsd(market.volume * 0.18), s: "+12.4%", up: true },
                  { l: "Liquidity", v: formatUsd(market.liquidity), s: "Deep", up: true },
                  { l: "Open Interest", v: formatUsd(market.volume * 0.42), s: "+3.1%", up: true },
                  { l: "Kamino APY", v: "5.42%", s: "Auto-routed", up: true },
                ].map((s) => (
                  <div key={s.l} className="bg-background p-4">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.l}</div>
                    <div className="mt-1.5 font-display text-xl tabular-nums">{s.v}</div>
                    <div className={cn("mt-0.5 text-[11px]", s.up ? "text-success" : "text-destructive")}>{s.s}</div>
                  </div>
                ))}
              </div>

              {/* Chart card */}
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-3xl tabular-nums">{(livePrice).toFixed(3)}</span>
                    <span className="font-mono text-xs text-muted-foreground">YES</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px]",
                        market.trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {market.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {(market.trend * 100).toFixed(2)}% 24h
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Chart mode */}
                    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                      <ChartTab icon={LineChartIcon} active={chartMode === "Line"} onClick={() => setChartMode("Line")} label="Line" />
                      <ChartTab icon={CandlestickChart} active={chartMode === "Candle"} onClick={() => setChartMode("Candle")} label="Candles" />
                    </div>
                    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                      {(["1H", "1D", "1W", "1M", "ALL"] as Range[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRange(r)}
                          className={cn(
                            "rounded px-2.5 py-1 text-[11px] font-medium transition",
                            range === r
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative h-[340px] w-full">
                  {chartMode === "Line" ? (
                    <LineChart points={linePoints} live={livePrice} />
                  ) : (
                    <CandleChart candles={candles} live={livePrice} />
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">Last update <span className="text-foreground/80">{new Date().toLocaleTimeString()}</span></span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                    Streaming via {market.resolution}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="rounded-2xl border border-border bg-surface shadow-ring">
                <div className="flex items-center gap-1 border-b border-border px-3">
                  {[
                    { k: "orderbook", l: "Order book" },
                    { k: "activity", l: "Activity" },
                    { k: "holders", l: "Top holders" },
                    { k: "rules", l: "Resolution" },
                  ].map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setTab(t.k as typeof tab)}
                      className={cn(
                        "relative px-3.5 py-3 text-sm font-medium transition",
                        tab === t.k
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.l}
                      {tab === t.k && (
                        <span className="absolute inset-x-3 -bottom-px h-px bg-foreground" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {tab === "orderbook" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                      <DepthBook side="YES" rows={orderbook.yes} mid={livePrice} />
                      <DepthBook side="NO" rows={orderbook.no} mid={1 - livePrice} />
                    </div>
                  )}
                  {tab === "activity" && <ActivityFeed rows={activity} />}
                  {tab === "holders" && <HoldersList rows={holders} />}
                  {tab === "rules" && <ResolutionRules market={market} />}
                </div>
              </div>
            </div>

            {/* RIGHT — Trading panel + side cards */}
            <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
              {/* Order ticket */}
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-ring-strong">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <div className="font-display text-lg">Place order</div>
                  <span className="badge-pill">
                    <Zap className="h-3 w-3 text-warning" /> Sub-second
                  </span>
                </div>

                <div className="space-y-4 p-5">
                  {/* YES / NO toggle */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-background p-1 ring-1 ring-inset ring-border">
                    {(["YES", "NO"] as const).map((s) => {
                      const p = s === "YES" ? livePrice : 1 - livePrice;
                      const isActive = side === s;
                      const isYes = s === "YES";
                      return (
                        <button
                          key={s}
                          onClick={() => setSide(s)}
                          className={cn(
                            "group relative flex flex-col items-center gap-0.5 rounded-lg py-2.5 text-sm font-semibold transition-all",
                            isActive
                              ? isYes
                                ? "bg-success/15 text-success shadow-button-inset"
                                : "bg-destructive/15 text-destructive shadow-button-inset"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span className="text-xs font-medium uppercase tracking-wider opacity-80">{s}</span>
                          <span className="font-display text-xl tabular-nums">{(p * 100).toFixed(0)}¢</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Order type pills */}
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
                    {(["Market", "Limit", "Stop"] as OrderType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-xs font-medium transition",
                          orderType === t
                            ? "bg-surface text-foreground shadow-button-inset"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</label>
                      <span className="text-[11px] text-muted-foreground">
                        Balance <span className="font-mono text-foreground/80">2,480.00</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 transition focus-within:border-border-strong">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-transparent font-display text-2xl tabular-nums text-foreground focus:outline-none"
                      />
                      <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px]">USDC</span>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {[10, 50, 100, 500, 1000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setAmount(v)}
                          className={cn(
                            "rounded-md border border-border bg-background py-1.5 text-[11px] font-medium transition",
                            amount === v ? "text-foreground bg-surface" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Limit price */}
                  {orderType !== "Market" && (
                    <div className="animate-fade-up">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {orderType} price (¢)
                      </label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full bg-transparent font-display text-2xl tabular-nums text-foreground focus:outline-none"
                        />
                        <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px]">¢</span>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="space-y-2 rounded-lg border border-border bg-background p-3.5">
                    <Row k="Avg. fill" v={`${fillPrice.toFixed(3)} USDC`} />
                    <Row k="Shares" v={shares.toFixed(2)} />
                    <Row k="Protocol fee" v={`-$${fee.toFixed(2)}`} muted />
                    <div className="my-2 border-t border-border/60" />
                    <Row k="Potential payout" v={`$${potential.toFixed(2)}`} highlight />
                    <Row
                      k="Profit if win"
                      v={`+$${profit.toFixed(2)} · ${((profit / Math.max(1, amount)) * 100).toFixed(0)}%`}
                      tone="success"
                    />
                  </div>

                  {/* CTA */}
                  <button
                    className={cn(
                      "group relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-semibold shadow-button-inset transition-all active:scale-[0.99]",
                      side === "YES"
                        ? "bg-success text-background hover:brightness-110"
                        : "bg-destructive text-background hover:brightness-110",
                    )}
                  >
                    <span className="relative z-10">
                      Buy {side} · ${amount.toFixed(0)} → {potential.toFixed(2)}
                    </span>
                    <span className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-700 group-hover:translate-x-0" />
                  </button>

                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-route via <span className="font-mono text-foreground/90">Pulse agent</span>
                  </button>

                  <div className="flex items-start gap-2 rounded-lg bg-background/60 p-3 text-[11px] text-muted-foreground">
                    <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>
                      Idle USDC auto-routes to <span className="font-mono text-foreground/80">Kamino</span> earning
                      <span className="font-mono text-success"> +5.42% APY</span> until resolution.
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-predictions */}
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-ring">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Predictions
                  </div>
                  <Link to="/markets" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    All <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2.5">
                  {subMarkets.map((s) => (
                    <button
                      key={s.id}
                      className="group block w-full rounded-lg border border-border bg-background p-3 text-left transition hover:border-border-strong hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm leading-snug">{s.label}</span>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{s.yes}¢</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full bg-gradient-to-r from-foreground/40 to-foreground/80 transition-all"
                          style={{ width: `${s.yes}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>YES {s.yes}%</span>
                        <span>{formatUsd(s.vol)} vol</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Related */}
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-ring">
                <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Related markets
                </div>
                <div className="space-y-2">
                  {MARKETS.filter((m) => m.id !== market.id)
                    .slice(0, 3)
                    .map((m) => (
                      <Link
                        key={m.id}
                        to={`/markets/${m.id}`}
                        className="group flex items-center justify-between gap-3 rounded-lg p-2 -mx-2 transition hover:bg-surface-hover"
                      >
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-sm">{m.question}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatUsd(m.volume)} · {m.category}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{Math.round(m.yesPrice * 100)}¢</span>
                      </Link>
                    ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/* ============================== Bits ============================== */

function ActionIcon({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground hover:bg-surface-hover",
        active && "text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && "fill-current")} />
    </button>
  );
}

function ChartTab({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PriceTickPill({ dir, value }: { dir: "up" | "down" | "flat"; value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
        positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        dir === "up" && "ring-1 ring-success/40",
        dir === "down" && "ring-1 ring-destructive/40",
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {(value * 100).toFixed(2)}%
    </span>
  );
}

function Row({
  k,
  v,
  highlight,
  muted,
  tone,
}: {
  k: string;
  v: string;
  highlight?: boolean;
  muted?: boolean;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-muted-foreground">{k}</span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          highlight ? "text-foreground font-semibold" : "text-foreground/90",
          muted && "text-muted-foreground",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {v}
      </span>
    </div>
  );
}

/* ============================== Orderbook ============================== */

function DepthBook({
  side,
  rows,
  mid,
}: {
  side: Side;
  rows: { price: number; size: number; total: number }[];
  mid: number;
}) {
  const max = Math.max(...rows.map((r) => r.total));
  const isYes = side === "YES";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", isYes ? "bg-success" : "bg-destructive")} />
          <span className="text-xs font-semibold">{side} book</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          MID <span className="text-foreground/80">{mid.toFixed(3)}</span>
        </span>
      </div>
      <div className="px-2 pb-2 pt-1.5">
        <div className="grid grid-cols-3 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="relative grid grid-cols-3 items-center px-2 py-[5px] font-mono text-[11px] transition hover:bg-surface-hover/50"
          >
            <div
              className={cn("absolute inset-y-0 right-0 transition-all", isYes ? "bg-success/10" : "bg-destructive/10")}
              style={{ width: `${(r.total / max) * 100}%` }}
            />
            <span className={cn("relative", isYes ? "text-success" : "text-destructive")}>
              {r.price.toFixed(3)}
            </span>
            <span className="relative text-right text-foreground/90 tabular-nums">{r.size.toFixed(0)}</span>
            <span className="relative text-right text-muted-foreground tabular-nums">{r.total.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateOrderbook(yesPrice: number) {
  const yes = Array.from({ length: 12 }, (_, i) => ({
    price: Math.max(0.01, yesPrice - (i + 1) * 0.005),
    size: 200 + Math.random() * 1200,
    total: 0,
  }));
  const no = Array.from({ length: 12 }, (_, i) => ({
    price: Math.max(0.01, 1 - yesPrice - (i + 1) * 0.005),
    size: 200 + Math.random() * 1200,
    total: 0,
  }));
  let acc = 0;
  yes.forEach((r) => {
    acc += r.size;
    r.total = acc;
  });
  acc = 0;
  no.forEach((r) => {
    acc += r.size;
    r.total = acc;
  });
  return { yes, no };
}

/* ============================== Charts ============================== */

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  close: number;
}

function generateCandles(end: number, trend: number, range: Range): Candle[] {
  const N = range === "1H" ? 30 : range === "1D" ? 60 : range === "1W" ? 80 : range === "1M" ? 100 : 120;
  let v = Math.max(0.05, Math.min(0.95, end - trend * 0.35));
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const o = v;
    v += (Math.random() - 0.5) * 0.045 + (end - v) * 0.05;
    v = Math.max(0.04, Math.min(0.96, v));
    const c = v;
    const h = Math.min(0.99, Math.max(o, c) + Math.random() * 0.02);
    const l = Math.max(0.01, Math.min(o, c) - Math.random() * 0.02);
    out.push({ o, h, l, c, close: c });
  }
  out[out.length - 1] = { ...out[out.length - 1], c: end, close: end };
  return out;
}

function LineChart({ points, live }: { points: number[]; live: number }) {
  const pts = useMemo(() => [...points.slice(0, -1), live], [points, live]);
  const W = 800;
  const H = 340;
  const PAD = 16;
  const path = pts
    .map((p, i) => {
      const x = PAD + (i / (pts.length - 1)) * (W - PAD * 2);
      const y = PAD + (1 - p) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${W - PAD} ${H - PAD} L${PAD} ${H - PAD} Z`;
  const lastY = PAD + (1 - live) * (H - PAD * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((y) => (
        <line
          key={y}
          x1={PAD}
          x2={W - PAD}
          y1={PAD + y * (H - PAD * 2)}
          y2={PAD + y * (H - PAD * 2)}
          stroke="hsl(var(--border))"
          strokeDasharray="2 5"
          strokeWidth="1"
        />
      ))}
      {[0.25, 0.5, 0.75].map((y) => (
        <text
          key={`t-${y}`}
          x={W - PAD - 2}
          y={PAD + y * (H - PAD * 2) - 3}
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
          textAnchor="end"
          fontFamily="JetBrains Mono"
        >
          {Math.round((1 - y) * 100)}¢
        </text>
      ))}
      <path d={area} fill="url(#lineFill)" />
      <path d={path} stroke="hsl(var(--foreground))" strokeWidth="1.75" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* Live dot */}
      <circle cx={W - PAD} cy={lastY} r="4" fill="hsl(var(--foreground))" />
      <circle cx={W - PAD} cy={lastY} r="9" fill="hsl(var(--foreground))" opacity="0.18">
        <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      <line x1={PAD} x2={W - PAD} y1={lastY} y2={lastY} stroke="hsl(var(--foreground))" strokeOpacity="0.25" strokeDasharray="3 4" />
    </svg>
  );
}

function CandleChart({ candles, live }: { candles: Candle[]; live: number }) {
  const W = 800;
  const H = 340;
  const PAD = 16;
  const cw = (W - PAD * 2) / candles.length;
  const lastY = PAD + (1 - live) * (H - PAD * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      {[0.25, 0.5, 0.75].map((y) => (
        <line
          key={y}
          x1={PAD}
          x2={W - PAD}
          y1={PAD + y * (H - PAD * 2)}
          y2={PAD + y * (H - PAD * 2)}
          stroke="hsl(var(--border))"
          strokeDasharray="2 5"
          strokeWidth="1"
        />
      ))}
      {[0.25, 0.5, 0.75].map((y) => (
        <text
          key={`t-${y}`}
          x={W - PAD - 2}
          y={PAD + y * (H - PAD * 2) - 3}
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
          textAnchor="end"
          fontFamily="JetBrains Mono"
        >
          {Math.round((1 - y) * 100)}¢
        </text>
      ))}
      {candles.map((k, i) => {
        const x = PAD + i * cw + cw / 2;
        const yH = PAD + (1 - k.h) * (H - PAD * 2);
        const yL = PAD + (1 - k.l) * (H - PAD * 2);
        const yO = PAD + (1 - k.o) * (H - PAD * 2);
        const yC = PAD + (1 - k.c) * (H - PAD * 2);
        const up = k.c >= k.o;
        const color = up ? "hsl(var(--success))" : "hsl(var(--destructive))";
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(1.5, Math.abs(yO - yC));
        const bw = Math.max(2, cw * 0.65);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth="1" opacity="0.9" />
            <rect
              x={x - bw / 2}
              y={bodyTop}
              width={bw}
              height={bodyH}
              fill={color}
              opacity={up ? 0.9 : 0.85}
              rx="0.5"
            />
          </g>
        );
      })}
      {/* Live price line */}
      <line x1={PAD} x2={W - PAD} y1={lastY} y2={lastY} stroke="hsl(var(--foreground))" strokeOpacity="0.4" strokeDasharray="3 4" />
      <rect x={W - PAD - 38} y={lastY - 9} width="36" height="18" fill="hsl(var(--foreground))" rx="3" />
      <text x={W - PAD - 20} y={lastY + 3} fontSize="10" textAnchor="middle" fill="hsl(var(--background))" fontFamily="JetBrains Mono" fontWeight="600">
        {(live * 100).toFixed(0)}¢
      </text>
    </svg>
  );
}

/* ============================== Sub markets / Activity / Holders / Rules ============================== */

function buildSubMarkets(m: Market) {
  // Synthetic linked sub-markets, derived from the main question
  const base = Math.round(m.yesPrice * 100);
  return [
    { id: "s1", label: `Above ${(base + 8).toString()}¢ within 24h`, yes: Math.max(5, base - 18), vol: m.volume * 0.21 },
    { id: "s2", label: `Resolves YES before deadline`, yes: Math.min(95, base + 6), vol: m.volume * 0.34 },
    { id: "s3", label: `Daily candle closes green tomorrow`, yes: 47, vol: m.volume * 0.11 },
    { id: "s4", label: `Volume crosses ${formatUsd(m.volume * 1.5)} this week`, yes: 28, vol: m.volume * 0.08 },
  ];
}

function generateActivity(m: Market) {
  const names = ["pulse.sol", "arc.agent", "0x4f...92e", "anchor.dao", "drift.bot", "wire.alpha", "0x88...c1a", "lattice.ai"];
  const out = Array.from({ length: 14 }, (_, i) => {
    const side: Side = Math.random() > 0.5 ? "YES" : "NO";
    const isBuy = Math.random() > 0.35;
    const amount = Math.floor(20 + Math.random() * 4800);
    const price = side === "YES" ? m.yesPrice : 1 - m.yesPrice;
    const drift = (Math.random() - 0.5) * 0.04;
    return {
      id: i,
      who: names[i % names.length],
      isAgent: i % 3 === 0,
      side,
      isBuy,
      amount,
      price: Math.min(0.99, Math.max(0.01, price + drift)),
      time: `${Math.floor(Math.random() * 59) + 1}s ago`,
    };
  });
  return out;
}

function ActivityFeed({ rows }: { rows: ReturnType<typeof generateActivity> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1fr_80px_100px_100px_70px] gap-2 border-b border-border bg-background px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Trader</span>
        <span>Side</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Price</span>
        <span className="text-right">Time</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_80px_100px_100px_70px] items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-hover/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", r.isAgent ? "bg-sol-purple" : "bg-foreground/60")} />
              <span className="truncate font-mono text-foreground/90">{r.who}</span>
              {r.isAgent && (
                <span className="shrink-0 rounded border border-border px-1 py-0 font-mono text-[9px] uppercase text-muted-foreground">AI</span>
              )}
            </div>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold",
                r.side === "YES" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {r.isBuy ? "BUY" : "SELL"} {r.side}
            </span>
            <span className="text-right font-mono tabular-nums text-foreground/90">{r.amount.toLocaleString()}</span>
            <span className="text-right font-mono tabular-nums">{r.price.toFixed(3)}</span>
            <span className="text-right font-mono text-muted-foreground">{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateHolders(m: Market) {
  return Array.from({ length: 8 }, (_, i) => {
    const yes = Math.random() > 0.4;
    const shares = Math.floor(800 + Math.random() * 24000);
    return {
      id: i,
      addr: `${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 5)}`,
      isAgent: i < 3,
      side: yes ? "YES" : "NO",
      shares,
      avgPrice: yes ? m.yesPrice + (Math.random() - 0.5) * 0.1 : 1 - m.yesPrice + (Math.random() - 0.5) * 0.1,
      pnl: (Math.random() - 0.4) * 12,
    };
  }).sort((a, b) => b.shares - a.shares);
}

function HoldersList({ rows }: { rows: ReturnType<typeof generateHolders> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[40px_1fr_70px_120px_100px_80px] gap-2 border-b border-border bg-background px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <span>Address</span>
        <span>Side</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Avg.</span>
        <span className="text-right">P&L</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="grid grid-cols-[40px_1fr_70px_120px_100px_80px] items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-hover/50"
          >
            <span className="font-mono text-muted-foreground">{i + 1}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground/90">{r.addr}</span>
              {r.isAgent && (
                <span className="rounded border border-border px-1 py-0 font-mono text-[9px] uppercase text-muted-foreground">AI</span>
              )}
            </div>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold",
                r.side === "YES" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {r.side}
            </span>
            <span className="text-right font-mono tabular-nums">{r.shares.toLocaleString()}</span>
            <span className="text-right font-mono tabular-nums text-muted-foreground">{r.avgPrice.toFixed(3)}</span>
            <span
              className={cn(
                "text-right font-mono tabular-nums",
                r.pnl >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {r.pnl >= 0 ? "+" : ""}
              {r.pnl.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResolutionRules({ market }: { market: Market }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-foreground/90">
        This market resolves <strong className="text-foreground">YES</strong> if the price feed from{" "}
        <span className="font-mono text-foreground">{market.resolution}</span> reports the criteria as
        satisfied at the resolution timestamp. Otherwise resolves{" "}
        <strong className="text-foreground">NO</strong>. Disputes may be opened within 48 hours by
        staking PREDICT tokens.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Trustless", d: "On-chain oracle attests outcome cryptographically." },
          { icon: Zap, t: "Sub-second", d: "Auto-resolution settles within a single Solana slot." },
          { icon: Users, t: "DAO Override", d: "Stake PREDICT to dispute within 48h post-resolution." },
        ].map((c) => (
          <div key={c.t} className="rounded-lg border border-border bg-background p-4">
            <c.icon className="h-4 w-4 text-foreground" />
            <div className="mt-2 text-sm font-semibold">{c.t}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.d}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <div>
            <div className="text-sm">Audited by <span className="font-mono">Ottersec</span> & <span className="font-mono">Neodyme</span></div>
            <div className="text-[11px] text-muted-foreground">Last audit · April 2026</div>
          </div>
        </div>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View report <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
