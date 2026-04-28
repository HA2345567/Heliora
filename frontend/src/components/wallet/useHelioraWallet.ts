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

  // Listen for wallet changes dispatched by ConnectWalletButton
  useEffect(() => {
    const sync = () => setDemoAddr(localStorage.getItem("heliora.wallet"));
    window.addEventListener("heliora:wallet-changed", sync);
    return () => window.removeEventListener("heliora:wallet-changed", sync);
  }, []);

  // Sync real adapter wallet to localStorage
  useEffect(() => {
    if (adapterConnected && publicKey) {
      const addr = publicKey.toBase58();
      localStorage.setItem("heliora.wallet", addr);
      setDemoAddr(addr);
      window.dispatchEvent(new Event("heliora:wallet-changed"));
    }
  }, [adapterConnected, publicKey]);

  const address = adapterConnected && publicKey ? publicKey.toBase58() : demoAddr;
  const connected = !!address;
  const isDemo = !adapterConnected && !!demoAddr;
  const displayAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  const disconnect = useCallback(() => {
    if (adapterConnected) adapterDisconnect();
    localStorage.removeItem("heliora.wallet");
    setDemoAddr(null);
    window.dispatchEvent(new Event("heliora:wallet-changed"));
  }, [adapterConnected, adapterDisconnect]);

  return { connected, address, isDemo, displayAddress, disconnect };
}
