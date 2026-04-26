import { Link } from "react-router-dom";
import { Logo } from "./Logo";

const SECTIONS = [
  {
    title: "Protocol",
    links: [
      { label: "Markets", to: "/markets" },
      { label: "Create", to: "/markets/create" },
      { label: "Portfolio", to: "/portfolio" },
      { label: "PREDICT Token", to: "/token" },
    ],
  },
  {
    title: "Agents",
    links: [
      { label: "Agent Marketplace", to: "/agents" },
      { label: "AI Oracle Network", to: "/oracle" },
      { label: "Agent Kit Plugin", to: "/developers" },
      { label: "MCP Server", to: "/developers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", to: "/developers" },
      { label: "Whitepaper", to: "#" },
      { label: "GitHub", to: "#" },
      { label: "Audits", to: "#" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Discord", to: "#" },
      { label: "Twitter / X", to: "#" },
      { label: "Farcaster", to: "#" },
      { label: "Telegram", to: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-32">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="font-display text-xl">Heliora</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The AI-native prediction market protocol. Permissionless, sub-second,
              composable. Built on Solana.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="badge-pill">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                Mainnet beta
              </span>
              <span className="badge-pill">v1.0.0</span>
            </div>
          </div>

          {SECTIONS.map((s) => (
            <div key={s.title}>
              <div className="mb-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.title}
              </div>
              <ul className="space-y-3">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-foreground/80 transition hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-8 md:flex-row md:items-center">
          <div className="text-xs text-muted-foreground">
            © 2026 Heliora Labs. Permissionless protocol — use at your own risk.
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-mono">RPC: 99.99% · Latency: 312ms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
