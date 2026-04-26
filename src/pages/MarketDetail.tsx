import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { MARKETS, formatUsd, timeUntil } from "@/lib/mock-data";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Clock,
  Layers,
  Radio,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MarketDetail() {
  const { id } = useParams();
  const market = useMemo(() => MARKETS.find((m) => m.id === id) ?? MARKETS[0], [id]);
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState(50);

  const price = side === "YES" ? market.yesPrice : market.noPrice;
  const shares = amount / price;
  const potential = shares * 1;

  const orderbook = generateOrderbook(market.yesPrice);
  const chart = generateChart(market.yesPrice, market.trend);

  return (
    <PageShell>
      <div className="container py-8">
        <Link
          to="/markets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All markets
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* LEFT */}
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {market.category}
              </span>
              {market.isLive && (
                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                  <Radio className="h-3 w-3 animate-pulse-soft" /> LIVE
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">
                Resolves via {market.resolution}
              </span>
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight tracking-tight md:text-4xl">
              {market.question}
            </h1>
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Ends in {timeUntil(market.endsAt)}
              </span>
              <span>by {market.creator}</span>
              <span>{market.createdAgo}</span>
            </div>

            {/* Stats strip */}
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
              {[
                ["Volume", formatUsd(market.volume)],
                ["Liquidity", formatUsd(market.liquidity)],
                ["Traders", market.participants.toLocaleString()],
                ["Yield (Kamino)", "5.4% APY"],
              ].map(([l, v]) => (
                <div key={l} className="bg-background p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
                  <div className="mt-1.5 font-display text-lg">{v}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-ring">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-4xl">{Math.round(market.yesPrice * 100)}¢</span>
                    <span className="font-mono text-sm text-muted-foreground">YES</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono text-xs",
                        market.trend >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      <TrendingUp className="h-3 w-3" />
                      {(market.trend * 100).toFixed(2)}% (24h)
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {(["1H", "1D", "1W", "1M", "All"] as const).map((r, i) => (
                    <button
                      key={r}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium",
                        i === 1 ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-hover",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 h-64 w-full">
                <Chart points={chart} />
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6">
              <div className="flex items-center gap-1 border-b border-border">
                {["Order book", "Activity", "Holders", "Resolution rules"].map((t, i) => (
                  <button
                    key={t}
                    className={cn(
                      "border-b-2 px-4 py-2.5 text-sm font-medium",
                      i === 0
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Orderbook side="YES" rows={orderbook.yes} />
                <Orderbook side="NO" rows={orderbook.no} />
              </div>

              <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-ring">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Layers className="h-3 w-3" /> Resolution rules
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                  This market resolves <strong>YES</strong> if the price feed
                  from <span className="font-mono">{market.resolution}</span> reports
                  the criteria as satisfied at the resolution timestamp. Otherwise
                  resolves <strong>NO</strong>. Disputes may be opened within 48h
                  by staking PREDICT.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="badge-pill"><CheckCircle2 className="h-3 w-3 text-success" />Trustless</span>
                  <span className="badge-pill">Auto-resolution within 1 slot</span>
                  <span className="badge-pill">DAO override available</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — bet panel */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-ring-strong">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg">Place position</div>
                <div className="flex items-center gap-1">
                  <button className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"><Bookmark className="h-3.5 w-3.5" /></button>
                  <button className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"><Share2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-background p-1">
                {(["YES", "NO"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={cn(
                      "rounded-md py-2 text-sm font-semibold transition",
                      side === s
                        ? s === "YES"
                          ? "bg-success/15 text-success shadow-button-inset"
                          : "bg-destructive/15 text-destructive shadow-button-inset"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s} · {(s === "YES" ? market.yesPrice : market.noPrice).toFixed(2)}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-full bg-transparent text-2xl font-display text-foreground focus:outline-none"
                  />
                  <span className="rounded border border-border px-2 py-1 font-mono text-xs">USDC</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[10, 50, 100, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className="rounded-md border border-border bg-background py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-2.5 rounded-lg border border-border bg-background p-4 text-sm">
                <Row k="Avg. price" v={`${price.toFixed(3)} USDC`} />
                <Row k="Shares" v={shares.toFixed(2)} />
                <Row k="Potential payout" v={`$${potential.toFixed(2)}`} highlight />
                <Row k="Protocol fee (1%)" v={`$${(amount * 0.01).toFixed(2)}`} />
              </div>

              <button
                className={cn(
                  "mt-5 w-full rounded-lg py-3 text-sm font-semibold shadow-button-inset transition",
                  side === "YES" ? "bg-success text-background hover:opacity-90" : "bg-destructive text-background hover:opacity-90",
                )}
              >
                Buy {side} · ${amount.toFixed(0)}
              </button>
              <button className="mt-2 w-full rounded-lg border border-border bg-background py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" /> Auto-route via Pulse agent
              </button>

              <div className="mt-4 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
                Idle collateral auto-routes to <span className="font-mono text-foreground/80">Kamino</span> earning ~5.4% APY until resolution.
              </div>
            </div>

            {/* Related */}
            <div className="mt-5 rounded-2xl border border-border bg-surface p-5 shadow-ring">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Related markets</div>
              <div className="mt-3 space-y-3">
                {MARKETS.filter((m) => m.id !== market.id).slice(0, 3).map((m) => (
                  <Link key={m.id} to={`/markets/${m.id}`} className="block rounded-lg border border-border bg-background p-3 hover:bg-surface-hover">
                    <div className="line-clamp-2 text-sm">{m.question}</div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{formatUsd(m.volume)}</span>
                      <span className="font-mono font-semibold">{Math.round(m.yesPrice * 100)}¢</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={cn("font-mono text-sm", highlight ? "text-foreground font-semibold" : "text-foreground/90")}>{v}</span>
    </div>
  );
}

function Orderbook({ side, rows }: { side: "YES" | "NO"; rows: { price: number; size: number; total: number }[] }) {
  const max = Math.max(...rows.map((r) => r.total));
  const accent = side === "YES" ? "bg-success/10" : "bg-destructive/10";
  return (
    <div className="rounded-xl border border-border bg-surface shadow-ring">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", side === "YES" ? "bg-success" : "bg-destructive")} />
          <span className="text-sm font-semibold">{side} Order book</span>
        </div>
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="p-2">
        <div className="grid grid-cols-3 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Price</span><span className="text-right">Size</span><span className="text-right">Total</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="relative grid grid-cols-3 items-center px-2 py-1.5 font-mono text-xs">
            <div
              className={cn("absolute inset-y-0 right-0", accent)}
              style={{ width: `${(r.total / max) * 100}%` }}
            />
            <span className="relative">{r.price.toFixed(3)}</span>
            <span className="relative text-right text-foreground/90">{r.size.toFixed(0)}</span>
            <span className="relative text-right text-muted-foreground">{r.total.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateOrderbook(yesPrice: number) {
  const yes = Array.from({ length: 7 }, (_, i) => ({
    price: Math.max(0.01, yesPrice - (i + 1) * 0.01),
    size: 200 + Math.random() * 800,
    total: 0,
  }));
  const no = Array.from({ length: 7 }, (_, i) => ({
    price: Math.max(0.01, 1 - yesPrice - (i + 1) * 0.01),
    size: 200 + Math.random() * 800,
    total: 0,
  }));
  let acc = 0;
  yes.forEach((r) => { acc += r.size; r.total = acc; });
  acc = 0;
  no.forEach((r) => { acc += r.size; r.total = acc; });
  return { yes, no };
}

function generateChart(end: number, trend: number) {
  const N = 80;
  let v = Math.max(0.05, Math.min(0.95, end - trend * 0.3));
  const pts: number[] = [];
  for (let i = 0; i < N; i++) {
    v += (Math.random() - 0.5) * 0.04 + (end - v) * 0.04;
    v = Math.max(0.04, Math.min(0.96, v));
    pts.push(v);
  }
  pts[N - 1] = end;
  return pts;
}

function Chart({ points }: { points: number[] }) {
  const W = 800;
  const H = 240;
  const max = 1;
  const min = 0;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p - min) / (max - min)) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${W} ${H} L0 ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      <defs>
        <linearGradient id="gFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((y) => (
        <line key={y} x1="0" x2={W} y1={H * y} y2={H * y} stroke="hsl(var(--border))" strokeDasharray="2 4" />
      ))}
      <path d={area} fill="url(#gFill)" />
      <path d={path} stroke="hsl(var(--foreground))" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
