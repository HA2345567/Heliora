import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import type { ApiOracleResolution } from "@/lib/api-types";
import { Brain, CheckCircle2, Clock, Cpu, Network, Scale, ShieldCheck, Vote } from "lucide-react";
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
