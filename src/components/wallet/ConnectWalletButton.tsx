import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/**
 * Mirrors the connected wallet pubkey to localStorage so the API client
 * can attach `x-wallet` to every request.
 */
export function ConnectWalletButton({ className }: { className?: string }) {
  const { publicKey, connected } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      localStorage.setItem("heliora.wallet", publicKey.toBase58());
    } else {
      localStorage.removeItem("heliora.wallet");
    }
  }, [connected, publicKey]);

  return (
    <div className={className}>
      <WalletMultiButton />
    </div>
  );
}
