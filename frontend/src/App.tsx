import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS, MONAD_TESTNET } from "./config";

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>("—");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [newGreeting, setNewGreeting] = useState<string>("");

  const hasWallet = typeof window !== "undefined" && !!window.ethereum;
  const contractIsSet =
    CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // Build a read-only contract instance (no wallet popup needed to read).
  const getReadContract = useCallback(() => {
    if (!window.ethereum) throw new Error("No wallet found");
    const provider = new BrowserProvider(window.ethereum);
    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }, []);

  // Build a contract instance connected to the signer (needed to write).
  const getWriteContract = useCallback(async () => {
    if (!window.ethereum) throw new Error("No wallet found");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }, []);

  // Read the current greeting from the chain.
  const refreshGreeting = useCallback(async () => {
    if (!contractIsSet) return;
    try {
      const contract = getReadContract();
      const value: string = await contract.greeting();
      setGreeting(value);
    } catch (err) {
      console.error(err);
      setStatus("Could not read from the contract. Is the address correct?");
    }
  }, [contractIsSet, getReadContract]);

  // Ask MetaMask to switch to Monad testnet, adding it if unknown.
  const ensureMonadNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_TESTNET.chainIdHex }],
      });
    } catch (err: unknown) {
      // 4902 = chain not added to wallet yet, so add it.
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: MONAD_TESTNET.chainIdHex,
              chainName: MONAD_TESTNET.chainName,
              rpcUrls: [MONAD_TESTNET.rpcUrl],
              nativeCurrency: MONAD_TESTNET.currency,
              blockExplorerUrls: [MONAD_TESTNET.blockExplorerUrl],
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }, []);

  // Connect the wallet and make sure we're on Monad testnet.
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not found. Install it to continue.");
      return;
    }
    try {
      setBusy(true);
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      await ensureMonadNetwork();
      setAccount(accounts[0]);
      setStatus("Wallet connected.");
      await refreshGreeting();
    } catch (err) {
      console.error(err);
      setStatus("Connection failed or was rejected.");
    } finally {
      setBusy(false);
    }
  }, [ensureMonadNetwork, refreshGreeting]);

  // Generic helper: send a transaction and wait for it to be mined.
  const sendTx = useCallback(
    async (
      label: string,
      action: (c: Contract) => Promise<{ wait: () => Promise<unknown>; hash: string }>
    ) => {
      if (!account) {
        setStatus("Connect your wallet first.");
        return;
      }
      try {
        setBusy(true);
        setStatus(`${label}: sending transaction...`);
        const contract = await getWriteContract();
        const tx = await action(contract);
        setStatus(`${label}: waiting for confirmation... (${tx.hash.slice(0, 10)}…)`);
        await tx.wait();
        setStatus(`${label}: confirmed!`);
        await refreshGreeting();
      } catch (err) {
        console.error(err);
        setStatus(`${label} failed or was rejected.`);
      } finally {
        setBusy(false);
      }
    },
    [account, getWriteContract, refreshGreeting]
  );

  const handleSetGreeting = () => {
    if (newGreeting.trim() === "") {
      setStatus("Enter a value first.");
      return;
    }
    sendTx("Set greeting", (c) => c.setGreeting(newGreeting));
  };

  // Load the greeting once on mount (read-only, no wallet prompt).
  useEffect(() => {
    if (hasWallet && contractIsSet) refreshGreeting();
  }, [hasWallet, contractIsSet, refreshGreeting]);

  // React to the user switching accounts in MetaMask.
  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts[0] ?? null);
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return (
    <main className="container">
      <h1>🟣 Monad dApp Starter</h1>
      <p className="subtitle">
        A starter UI reading &amp; writing on-chain state on the Monad testnet.
      </p>

      {!hasWallet && (
        <div className="banner error">
          No wallet detected. Install{" "}
          <a href="https://metamask.io" target="_blank" rel="noreferrer">
            MetaMask
          </a>{" "}
          to use this app.
        </div>
      )}

      {!contractIsSet && (
        <div className="banner warn">
          Contract address not set yet. Deploy the contract, then paste the
          address into <code>frontend/src/config.ts</code>.
        </div>
      )}

      <div className="card">
        <div className="value-display">{greeting}</div>
        <div className="value-label">current on-chain value</div>
      </div>

      {!account ? (
        <button className="primary" onClick={connect} disabled={busy || !hasWallet}>
          {busy ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <>
          <div className="account">
            Connected: <code>{account.slice(0, 6)}…{account.slice(-4)}</code>
          </div>

          <div className="set-row">
            <input
              type="text"
              placeholder="new value..."
              value={newGreeting}
              onChange={(e) => setNewGreeting(e.target.value)}
              disabled={busy}
            />
            <button className="primary" onClick={handleSetGreeting} disabled={busy}>
              Set
            </button>
          </div>

          <button className="ghost" onClick={refreshGreeting} disabled={busy}>
            ↻ Refresh
          </button>
        </>
      )}

      {status && <div className="status">{status}</div>}

      <footer>
        <a href={MONAD_TESTNET.blockExplorerUrl} target="_blank" rel="noreferrer">
          Block explorer
        </a>{" "}
        ·{" "}
        <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
          Get testnet MON
        </a>
      </footer>
    </main>
  );
}
