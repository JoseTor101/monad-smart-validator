import { useCallback, useEffect, useState } from "react";
import { connectWallet, hasWallet } from "./web3";

export interface WalletState {
  account: string | null;
  connecting: boolean;
  error: string | null;
  installed: boolean;
  connect: () => Promise<void>;
}

/** Minimal wallet-connection state, shared across views. */
export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const installed = hasWallet();

  const connect = useCallback(async () => {
    if (!installed) {
      setError("No wallet detected. Install MetaMask to continue.");
      return;
    }
    try {
      setConnecting(true);
      setError(null);
      const addr = await connectWallet();
      setAccount(addr);
    } catch (err) {
      console.error(err);
      setError("Connection failed or was rejected.");
    } finally {
      setConnecting(false);
    }
  }, [installed]);

  // Reflect account changes made inside the wallet UI.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts[0] ?? null);
    };
    eth.on("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  return { account, connecting, error, installed, connect };
}
