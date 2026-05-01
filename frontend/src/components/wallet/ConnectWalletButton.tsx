import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { apiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ConnectWalletButton({ className }: { className?: string }) {
  const { connected, publicKey } = useWallet();

  // Sync official wallet to Heliora localStorage so api.ts uses it
  useEffect(() => {
    if (connected && publicKey) {
      localStorage.setItem("heliora.wallet", publicKey.toBase58());
    } else {
      localStorage.removeItem("heliora.wallet");
    }
  }, [connected, publicKey]);

  const handleFaucet = async () => {
    if (!publicKey) return;
    try {
      toast.loading("Requesting Mock USDC...", { id: "faucet" });
      const res = await fetch(`${apiBaseUrl}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), amount: 1000 }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("1,000 Mock USDC airdropped successfully!", { id: "faucet" });
    } catch (err: any) {
      toast.error(`Faucet failed: ${err.message}`, { id: "faucet" });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {connected && (
        <button
          onClick={handleFaucet}
          className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md border border-success/30 bg-success/5 px-4 py-2 text-sm font-medium text-success transition-all hover:bg-success/10 hover:shadow-[0_0_15px_-3px_rgba(20,241,149,0.2)]"
        >
          <Coins className="h-4 w-4" />
          <span className="hidden sm:inline">Faucet</span>
        </button>
      )}
      <WalletMultiButton 
        style={{
          backgroundColor: '#18181b', // Dark Zinc-900
          border: '1px solid #27272a', // Zinc-800
          height: '40px',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#e4e4e7', // Zinc-200
          fontFamily: 'inherit',
          padding: '0 16px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        }}
      />
    </div>
  );
}
