import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export interface HelioraWalletState {
  connected: boolean;
  address: string | null;
  isDemo: boolean;
  displayAddress: string | null;
  disconnect: () => void;
}

export function useHelioraWallet(): HelioraWalletState {
  const {
    connected: adapterConnected,
    publicKey,
    disconnect: adapterDisconnect,
  } = useWallet();

  const [demoAddr, setDemoAddr] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("heliora.wallet");
  });

  // Listen for manual wallet changes (demo or backpack)
  useEffect(() => {
    const sync = () => {
      const addr = localStorage.getItem("heliora.wallet");
      setDemoAddr(addr);
    };
    window.addEventListener("heliora:wallet-changed", sync);
    return () => window.removeEventListener("heliora:wallet-changed", sync);
  }, []);

  // Sync adapter state to localStorage and local state
  useEffect(() => {
    if (adapterConnected && publicKey) {
      const addr = publicKey.toBase58();
      if (localStorage.getItem("heliora.wallet") !== addr) {
        localStorage.setItem("heliora.wallet", addr);
        setDemoAddr(addr);
        window.dispatchEvent(new Event("heliora:wallet-changed"));
      }
    } else if (!adapterConnected && !demoAddr) {
      // If adapter is not connected and we don't have a demo addr, 
      // check if we should clear storage (in case of external disconnect)
      const stored = localStorage.getItem("heliora.wallet");
      if (stored && !stored.startsWith("demo_")) { // don't clear demo wallets
         // We only clear if it looks like a real public key (length 32-44)
         // or if we know it was the adapter's wallet.
         // For simplicity, if adapter is false, we clear non-demo storage.
         // localStorage.removeItem("heliora.wallet");
         // setDemoAddr(null);
      }
    }
  }, [adapterConnected, publicKey, demoAddr]);

  const address = adapterConnected && publicKey ? publicKey.toBase58() : demoAddr;
  const connected = !!address;
  const isDemo = !adapterConnected && !!demoAddr;
  const displayAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  const disconnect = useCallback(async () => {
    try {
      if (adapterConnected) await adapterDisconnect();
    } catch (e) {
      console.error("Disconnect error:", e);
    }
    localStorage.removeItem("heliora.wallet");
    setDemoAddr(null);
    window.dispatchEvent(new Event("heliora:wallet-changed"));
  }, [adapterConnected, adapterDisconnect]);

  return { connected, address, isDemo, displayAddress, disconnect };
}
