import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHelioraWallet } from "./useHelioraWallet";

// Wallet metadata
const WALLET_META: Record<string, { installUrl: string; color: string; bg: string }> = {
  Phantom: {
    installUrl: "https://phantom.app",
    color: "#ab9ff2",
    bg: "#4e44ce",
  },
  Solflare: {
    installUrl: "https://solflare.com",
    color: "#fc8c00",
    bg: "#c06900",
  },
  Backpack: {
    installUrl: "https://backpack.app",
    color: "#e33e3f",
    bg: "#9a1618",
  },
};

function makeDemoWallet(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function ConnectWalletButton({ className }: { className?: string }) {
  const { wallets, select, connect, disconnect: adapterDisconnect } = useWallet();
  const { connected, address, displayAddress, disconnect } = useHelioraWallet();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const handleWalletConnect = async (walletName: WalletName) => {
    setConnecting(walletName);
    try {
      select(walletName);
      // Give the adapter a moment to select the wallet
      await new Promise((r) => setTimeout(r, 100));
      await connect();
      setOpen(false);
    } catch (e) {
      console.error("Wallet connect error:", e);
    } finally {
      setConnecting(null);
    }
  };

  const handleBackpack = async () => {
    const bp = (window as unknown as Record<string, unknown>).backpack as {
      connect(): Promise<{ publicKey: { toString(): string } }>;
    } | undefined;
    if (!bp) {
      window.open("https://backpack.app", "_blank");
      return;
    }
    setConnecting("Backpack");
    try {
      const resp = await bp.connect();
      const addr = resp.publicKey.toString();
      localStorage.setItem("heliora.wallet", addr);
      window.dispatchEvent(new Event("heliora:wallet-changed"));
      setOpen(false);
    } catch (e) {
      console.error("Backpack connect error:", e);
    } finally {
      setConnecting(null);
    }
  };

  const handleDemo = () => {
    const demo = makeDemoWallet();
    localStorage.setItem("heliora.wallet", demo);
    window.dispatchEvent(new Event("heliora:wallet-changed"));
    setOpen(false);
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  // ── Connected state ──
  if (connected && displayAddress) {
    return (
      <div ref={menuRef} className={cn("relative", className)}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono font-medium text-foreground/90 transition hover:bg-surface-hover"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          {displayAddress}
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-background shadow-ring">
            <div className="border-b border-border/50 px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Connected wallet</div>
              <div className="mt-1 truncate font-mono text-xs text-foreground/80">{address}</div>
            </div>
            <div className="p-1">
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy address"}
              </button>
              <button
                onClick={() => { disconnect(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Not connected ──
  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-surface-hover"
      >
        <Wallet className="h-3.5 w-3.5" />
        Connect wallet
      </button>

      {open && (
        <WalletModal
          wallets={wallets}
          connecting={connecting}
          onWalletConnect={handleWalletConnect}
          onBackpack={handleBackpack}
          onDemo={handleDemo}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ── Wallet Modal ──────────────────────────────────────────────────────────

interface WalletModalProps {
  wallets: ReturnType<typeof useWallet>["wallets"];
  connecting: string | null;
  onWalletConnect(name: WalletName): void;
  onBackpack(): void;
  onDemo(): void;
  onClose(): void;
}

function WalletModal({ wallets, connecting, onWalletConnect, onBackpack, onDemo, onClose }: WalletModalProps) {
  const backpackDetected = typeof window !== "undefined" && "backpack" in window;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-ring-strong">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl">Connect wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No KYC. Wallet is your identity.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-2.5">
          {/* Official adapters (Phantom, Solflare) */}
          {wallets.map((w) => {
            const installed =
              w.readyState === WalletReadyState.Installed ||
              w.readyState === WalletReadyState.Loadable;
            const isConnecting = connecting === w.adapter.name;
            const meta = WALLET_META[w.adapter.name];

            return (
              <WalletRow
                key={w.adapter.name}
                name={w.adapter.name}
                icon={<img src={w.adapter.icon} alt={w.adapter.name} className="h-full w-full object-contain" />}
                installed={installed}
                isConnecting={isConnecting}
                disabled={!!connecting}
                installUrl={meta?.installUrl ?? "https://solana.com"}
                onClick={() => installed && onWalletConnect(w.adapter.name as WalletName)}
              />
            );
          })}

          {/* Backpack (manual detection) */}
          <WalletRow
            name="Backpack"
            icon={
              <svg viewBox="0 0 40 40" className="h-full w-full">
                <rect width="40" height="40" rx="8" fill="#e33e3f" />
                <path d="M20 8c-4.4 0-8 3.6-8 8v2H8v14h24V18h-4v-2c0-4.4-3.6-8-8-8zm0 4c2.2 0 4 1.8 4 4v2h-8v-2c0-2.2 1.8-4 4-4zm0 12a2 2 0 110 4 2 2 0 010-4z" fill="white" />
              </svg>
            }
            installed={backpackDetected}
            isConnecting={connecting === "Backpack"}
            disabled={!!connecting}
            installUrl="https://backpack.app"
            onClick={onBackpack}
          />
        </div>

        {/* Demo wallet */}
        <div className="mt-5 border-t border-border/40 pt-5">
          <button
            onClick={onDemo}
            disabled={!!connecting}
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3.5 transition hover:border-border-strong hover:bg-surface"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                <Zap className="h-4 w-4 text-warning" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold">Demo wallet</div>
                <div className="text-[11px] text-muted-foreground">No extension · simulation mode</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Demo wallets can trade in simulation mode without real funds.
          </p>
        </div>
      </div>
    </>
  );
}

function WalletRow({
  name, icon, installed, isConnecting, disabled, installUrl, onClick,
}: {
  name: string;
  icon: React.ReactNode;
  installed: boolean;
  isConnecting: boolean;
  disabled: boolean;
  installUrl: string;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !isConnecting}
      className={cn(
        "group flex w-full items-center justify-between rounded-xl border p-4 text-left transition",
        installed
          ? "border-border bg-surface hover:border-border-strong hover:bg-surface-elevated cursor-pointer"
          : "border-border/50 bg-surface/40 opacity-60 cursor-default",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-background">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            {installed && (
              <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">
                Detected
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isConnecting ? "Connecting…" : installed ? "Click to connect" : "Not installed"}
          </div>
        </div>
      </div>

      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : installed ? (
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-transform" />
      ) : (
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Install <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </button>
  );
}
