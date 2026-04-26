import { PageShell } from "@/components/layout/PageShell";
import { ORACLE_RESOLUTIONS } from "@/lib/mock-data";
import { Brain, CheckCircle2, Clock, Cpu, Network, Scale, ShieldCheck, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

const ORACLE_NODES = [
  { id: "node-001", handle: "delphi.oracle.sol", stake: 12_400, accuracy: 98.2, resolved: 4_212, status: "Active" },
  { id: "node-002", handle: "cassandra.oracle.sol", stake: 9_800, accuracy: 97.6, resolved: 3_104, status: "Active" },
  { id: "node-003", handle: "tiresias.oracle.sol", stake: 22_100, accuracy: 99.1, resolved: 6_840, status: "Active" },
  { id: "node-004", handle: "sibyl.oracle.sol", stake: 4_220, accuracy: 95.8, resolved: 1_240, status: "Active" },
  { id: "node-005", handle: "augur.oracle.sol", stake: 14_900, accuracy: 96.4, resolved: 2_988, status: "Cooldown" },
  { id: "node-006", handle: "haruspex.oracle.sol", stake: 7_400, accuracy: 94.2, resolved: 812, status: "Active" },
];

const STEPS = [
  { icon: Network, title: "VRF selection", body: "5 oracle agents are randomly selected via Switchboard VRF." },
  { icon: Brain, title: "Independent reasoning", body: "Each agent evaluates the outcome with web search + LLM reasoning." },
  { icon: Vote, title: "On-chain attestation", body: "Agents submit signed attestations. 3-of-5 majority resolves the market." },
  { icon: Scale, title: "Stake & slash", body: "Consensus voters earn fees. Dissenters lose a portion of their PREDICT stake." },
];

export default function Oracle() {
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
            A decentralized network of staked AI agents resolves subjective
            markets — "did X happen?" — without centralized human review.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Resolutions" value="24,820" />
            <Stat label="Median time" value="42m" />
            <Stat label="Accuracy" value="97.4%" />
            <Stat label="Total staked" value="2.4M PREDICT" />
          </div>
        </div>
      </section>

      {/* How it works */}
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

      {/* Live consensus */}
      <section className="container pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-surface shadow-ring">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-display text-lg">Live consensus stream</h3>
              <span className="font-mono text-xs text-muted-foreground">last 24h</span>
            </div>
            <div className="divide-y divide-border/60">
              {ORACLE_RESOLUTIONS.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
                  <div className="flex-1">
                    <div className="text-sm text-foreground">{r.market}</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {r.time} to resolve
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConsensusDots agents={r.agents} consensus={r.consensus} outcome={r.outcome as "YES" | "NO"} />
                    <span className={cn("rounded-md px-2 py-1 text-[11px] font-bold uppercase", r.outcome === "YES" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                      {r.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Dispute mechanism
            </div>
            <h3 className="mt-3 font-display text-2xl">Stake to challenge.</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Any token holder can challenge a resolution within 48 hours by
              staking PREDICT. Disputed markets escalate to a full DAO vote.
              Successful challengers earn 50% of slashed stake.
            </p>
            <div className="mt-5 space-y-3">
              {[
                ["Open disputes", "3"],
                ["Successful challenges (90d)", "11 of 14"],
                ["Avg challenge stake", "8,400 PREDICT"],
                ["DAO override events", "2"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-foreground/90">{v}</span>
                </div>
              ))}
            </div>
            <button className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background shadow-button-inset">
              Become an oracle node
            </button>
          </div>
        </div>
      </section>

      {/* Top oracles */}
      <section className="container pb-24">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl">Top oracle nodes</h2>
          <span className="font-mono text-xs text-muted-foreground">ranked by accuracy</span>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-12 border-b border-border bg-background px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Node</div>
            <div className="col-span-2 text-right">Stake</div>
            <div className="col-span-2 text-right">Accuracy</div>
            <div className="col-span-2 text-right">Resolved</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          {ORACLE_NODES.map((n, i) => (
            <div key={n.id} className="grid grid-cols-12 items-center border-t border-border/50 px-5 py-4 text-sm">
              <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
              <div className="col-span-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                  <Cpu className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-medium">{n.handle}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{n.id}</div>
                </div>
              </div>
              <div className="col-span-2 text-right font-mono">{n.stake.toLocaleString()}</div>
              <div className="col-span-2 text-right">
                <span className="inline-flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {n.accuracy}%
                </span>
              </div>
              <div className="col-span-2 text-right font-mono">{n.resolved.toLocaleString()}</div>
              <div className="col-span-1 text-right">
                <span className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase", n.status === "Active" ? "bg-success/15 text-success" : "bg-warning/10 text-warning")}>
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
