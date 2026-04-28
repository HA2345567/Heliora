import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import type { ApiOracleResolution } from "@/lib/api-types";
import { Brain, CheckCircle2, ChevronDown, Clock, Cpu, Loader2, Network, Scale, Search, ShieldCheck, Sparkles, Vote, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Network, title: "VRF selection", body: "5 oracle agents are randomly selected via Switchboard VRF." },
  { icon: Brain, title: "Independent reasoning", body: "Each agent evaluates the outcome with web search + LLM reasoning." },
  { icon: Vote, title: "On-chain attestation", body: "Agents submit signed attestations. 3-of-5 majority resolves the market." },
  { icon: Scale, title: "Stake & slash", body: "Consensus voters earn fees. Dissenters lose a portion of their PREDICT stake." },
];

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Oracle() {
  const { data, isLoading } = useQuery({
    queryKey: ["oracle", "recent"],
    queryFn: () => api.recentResolutions(),
  });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.listAgents() });

  const resolutions = data?.resolutions ?? [];
  const accuracy = resolutions.length
    ? (resolutions.reduce((s, r) => s + r.consensus / Math.max(1, r.totalVotes), 0) / resolutions.length) * 100
    : 0;

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 dot-bg radial-fade opacity-40" />
        <div className="container relative py-20">
          <div className="badge-pill"><Brain className="h-3 w-3" /> AI Oracle Network</div>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
            Five agents. Three to agree. One trustless resolution.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            A decentralized network of staked AI agents resolves subjective markets — "did X happen?" — without centralized human review.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Resolutions" value={String(resolutions.length)} />
            <Stat label="Median time" value="42m" />
            <Stat label="Consensus" value={`${accuracy.toFixed(1)}%`} />
            <Stat label="Oracle agents" value={String(agents.data?.agents.length ?? 0)} />
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="badge-pill mb-4">How resolution works</div>
          <h2 className="font-display text-4xl tracking-tight">Trustless by construction.</h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="bg-background p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface">
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-16">
        <TriggerResolutionPanel />
      </section>

      <section className="container pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-surface shadow-ring">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-display text-lg">Live consensus stream</h3>
              <span className="font-mono text-xs text-muted-foreground">recent</span>
            </div>
            <div className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-shimmer bg-surface/40" />
                ))
              ) : resolutions.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No resolutions yet. Trigger one via <span className="font-mono">POST /api/oracle/resolve/:marketId</span>.
                </div>
              ) : (
                resolutions.map((r) => <ResolutionRow key={r.id} r={r} />)
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Dispute mechanism
            </div>
            <h3 className="mt-3 font-display text-2xl">Stake to challenge.</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Any token holder can challenge a resolution within 48 hours by staking PREDICT.
              Successful challengers earn 50% of slashed stake.
            </p>
            <button className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background shadow-button-inset">
              Become an oracle node
            </button>
          </div>
        </div>
      </section>

      <section className="container pb-24">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl">Top oracle agents</h2>
          <span className="font-mono text-xs text-muted-foreground">ranked by AUM</span>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-12 border-b border-border bg-background px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Node</div>
            <div className="col-span-2 text-right">Markets</div>
            <div className="col-span-2 text-right">Win rate</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {(agents.data?.agents ?? []).map((n, i) => (
            <div key={n.id} className="grid grid-cols-12 items-center border-t border-border/50 px-5 py-4 text-sm">
              <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
              <div className="col-span-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                  <Cpu className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-medium">{n.handle}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{n.type}</div>
                </div>
              </div>
              <div className="col-span-2 text-right font-mono">{n.marketsTraded.toLocaleString()}</div>
              <div className="col-span-2 text-right">
                <span className="inline-flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {n.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase", n.status === "live" ? "bg-success/15 text-success" : "bg-warning/10 text-warning")}>
                  {n.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function ResolutionRow({ r }: { r: ApiOracleResolution }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex-1">
        <div className="text-sm text-foreground">{r.market.question}</div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {timeAgo(r.createdAt)} ago
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ConsensusDots agents={r.totalVotes} consensus={r.consensus} outcome={r.outcome === "YES" ? "YES" : "NO"} />
        <span className={cn("rounded-md px-2 py-1 text-[11px] font-bold uppercase", r.outcome === "YES" ? "bg-success/15 text-success" : r.outcome === "NO" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
          {r.outcome}
        </span>
      </div>
    </div>
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

/* ============================== Trigger Resolution Panel ============================== */

function TriggerResolutionPanel() {
  const qc = useQueryClient();
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "oracle-selector"],
    queryFn: () => api.listMarkets({ take: 100, sort: "volume" }),
    staleTime: 30_000,
  });

  const [selectedId, setSelectedId] = useState<string>("");
  const [context, setContext] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showResult, setShowResult] = useState(false);

  const markets = (marketsData?.markets ?? []).filter((m) => m.status === "open");
  const filteredMarkets = search
    ? markets.filter((m) => m.question.toLowerCase().includes(search.toLowerCase()))
    : markets;
  const selectedMarket = markets.find((m) => m.id === selectedId);

  const resolveMut = useMutation({
    mutationFn: ({ id, ctx }: { id: string; ctx: string }) =>
      api.resolveMarket(id, ctx),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oracle", "recent"] });
      setShowResult(true);
    },
  });

  const resolution = resolveMut.data?.resolution;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-ring overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
            <Sparkles className="h-4 w-4 text-warning" />
          </div>
          <div>
            <h3 className="font-display text-lg">Trigger AI Resolution</h3>
            <p className="text-xs text-muted-foreground">Run GPT-4.1-mini oracle on any open market</p>
          </div>
        </div>
        <span className="badge-pill">
          <Zap className="h-3 w-3 text-warning" /> 5-agent consensus
        </span>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* Left: inputs */}
        <div className="space-y-5">
          {/* Market selector */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Select market
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search markets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-background divide-y divide-border/40">
              {filteredMarkets.slice(0, 10).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedId(m.id); setSearch(""); setShowResult(false); resolveMut.reset(); }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-surface-hover",
                    selectedId === m.id && "bg-surface-hover",
                  )}
                >
                  <span className="line-clamp-2 flex-1 text-foreground/90 leading-snug">{m.question}</span>
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold", m.yesPrice > 0.5 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {Math.round(m.yesPrice * 100)}¢
                  </span>
                </button>
              ))}
              {filteredMarkets.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">No open markets found</div>
              )}
            </div>
            {selectedMarket && (
              <div className="mt-2.5 rounded-lg border border-success/30 bg-success/5 px-3.5 py-2.5">
                <div className="text-[11px] font-mono text-muted-foreground">Selected</div>
                <div className="mt-0.5 text-sm font-medium leading-snug">{selectedMarket.question}</div>
                <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>{selectedMarket.category}</span>
                  <span>·</span>
                  <span>{selectedMarket.resolution}</span>
                  <span>·</span>
                  <span className="text-foreground/70">{Math.round(selectedMarket.yesPrice * 100)}¢ YES</span>
                </div>
              </div>
            )}
          </div>

          {/* Context */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Context <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Provide any additional context for the oracle agents to consider when making their determination… e.g. 'BTC is currently at $142,000 as of April 2026'"
              className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
            />
            <div className="mt-1 text-[11px] text-muted-foreground">
              The AI oracle agents will use this context alongside their training knowledge.
            </div>
          </div>

          {/* Button */}
          <button
            onClick={() => { setShowResult(false); resolveMut.reset(); resolveMut.mutate({ id: selectedId, ctx: context }); }}
            disabled={!selectedId || resolveMut.isPending}
            className="group relative w-full overflow-hidden rounded-xl bg-foreground py-3 text-sm font-semibold text-background shadow-button-inset transition hover:opacity-90 disabled:opacity-40"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {resolveMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running 5 AI agents…</>
              ) : (
                <><Brain className="h-4 w-4" /> Trigger AI Oracle</>
              )}
            </span>
          </button>

          {resolveMut.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              Oracle resolution failed. Please try again.
            </div>
          )}
        </div>

        {/* Right: result */}
        <div>
          {!showResult && !resolveMut.isPending && (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <Brain className="h-8 w-8 text-muted-foreground/40" />
              <div className="text-sm font-medium text-muted-foreground">Resolution will appear here</div>
              <p className="max-w-xs text-xs text-muted-foreground/70">
                5 AI agents will independently evaluate the market and form a consensus
              </p>
            </div>
          )}

          {resolveMut.isPending && (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-background py-12 text-center">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-foreground/20" />
                <Brain className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-foreground" />
              </div>
              <div className="text-sm font-medium">AI agents deliberating…</div>
              <p className="text-xs text-muted-foreground">Evaluating evidence · Forming consensus</p>
            </div>
          )}

          {showResult && resolution && (
            <div className="h-full rounded-xl border border-border bg-background overflow-hidden">
              {/* Outcome */}
              <div className={cn("border-b border-border px-5 py-4", resolution.outcome === "YES" ? "bg-success/5" : resolution.outcome === "NO" ? "bg-destructive/5" : "bg-warning/5")}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">AI Verdict</span>
                  <span className={cn("rounded-md px-3 py-1 text-sm font-bold uppercase tracking-wider", resolution.outcome === "YES" ? "bg-success/15 text-success" : resolution.outcome === "NO" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
                    {resolution.outcome}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <ConsensusDots agents={resolution.totalVotes} consensus={resolution.consensus} outcome={resolution.outcome === "YES" ? "YES" : "NO"} />
                </div>
              </div>

              {/* Reasoning */}
              <div className="border-b border-border/50 p-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Reasoning</div>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {resolution.reasoning?.slice(0, 280) ?? "AI oracle reached consensus without explicit reasoning."}
                  {(resolution.reasoning?.length ?? 0) > 280 && "…"}
                </p>
              </div>

              {/* Agent votes */}
              <div className="p-5">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Agent votes</div>
                <div className="space-y-2">
                  {(resolution.votes ?? []).map((v, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs">{v.agent?.handle ?? `agent-${i + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{(v.confidence * 100).toFixed(0)}%</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", v.vote === "YES" ? "bg-success/15 text-success" : v.vote === "NO" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
                          {v.vote}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function ConsensusDots({ agents, consensus, outcome }: { agents: number; consensus: number; outcome: "YES" | "NO" }) {
  const color = outcome === "YES" ? "bg-success" : "bg-destructive";
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: agents }).map((_, i) => (
        <span key={i} className={cn("h-2 w-2 rounded-full", i < consensus ? color : "bg-border")} />
      ))}
      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{consensus}/{agents}</span>
    </div>
  );
}
