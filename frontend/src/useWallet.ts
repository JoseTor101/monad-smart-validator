import { useCallback, useEffect, useState } from "react";
import { connectWallet, hasWallet } from "./web3";

export interface WalletState {
  account: string | null;
  connecting: boolean;
  error: string | null;
  installed: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// Remember an explicit disconnect so the eth_accounts restore on next load
// doesn't silently reconnect the user.
const DISCONNECT_KEY = "sv-wallet-disconnected";

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
      try {
        localStorage.removeItem(DISCONNECT_KEY);
      } catch {
        /* ignore storage errors */
      }
      const addr = await connectWallet();
      setAccount(addr);
    } catch (err) {
      console.error(err);
      setError("Connection failed or was rejected.");
    } finally {
      setConnecting(false);
    }
  }, [installed]);

  const disconnect = useCallback(async () => {
    setAccount(null);
    setError(null);
    try {
      localStorage.setItem(DISCONNECT_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    // A dapp can't force-disconnect a wallet, but newer wallets support
    // revoking the eth_accounts permission so a reload stays disconnected.
    try {
      await window.ethereum?.request?.({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      /* unsupported or rejected — local state is still cleared */
    }
  }, []);

  // Restore the session on load: if the site is still authorized, eth_accounts
  // returns the connected address WITHOUT prompting. This keeps the wallet
  // "connected" across page reloads.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.request) return;
    // Honour an explicit disconnect: don't silently reconnect on reload.
    try {
      if (localStorage.getItem(DISCONNECT_KEY) === "1") return;
    } catch {
      /* ignore storage errors */
    }
    let cancelled = false;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (!cancelled) setAccount((accounts as string[])?.[0] ?? null);
      })
      .catch(() => {
        /* no authorized accounts; stay disconnected */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return { account, connecting, error, installed, connect, disconnect };
}
