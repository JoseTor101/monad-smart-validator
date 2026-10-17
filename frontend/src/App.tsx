import { useCallback, useEffect, useState } from "react";
import { BrowserProvider } from "ethers";
import { CONTRACT_ADDRESS, MONAD_TESTNET } from "./config";
import RegisterForm from "./components/RegisterForm";
import CheckForm from "./components/CheckForm";
import ContentDetail from "./components/ContentDetail";
import DemoBurst from "./components/DemoBurst";

type Tab = "check" | "register" | "record" | "demo";

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [tab, setTab] = useState<Tab>("check");
  const [openId, setOpenId] = useState<number | null>(null);
  const [idInput, setIdInput] = useState("");

  const hasWallet = typeof window !== "undefined" && !!window.ethereum;
  const contractIsSet =
    CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const openRecord = (id: number) => {
    setOpenId(id);
    setTab("record");
  };

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

  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    setWrongNetwork(chainId !== MONAD_TESTNET.chainIdHex);
  }, []);

  // Connect the wallet and make sure we're on Monad testnet.
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not found. Install it to register, update or attest.");
      return;
    }
    try {
      setBusy(true);
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      await ensureMonadNetwork();
      await checkNetwork();
      setAccount(accounts[0]);
      setStatus("Wallet connected.");
    } catch (err) {
      console.error(err);
      setStatus("Connection failed or was rejected.");
    } finally {
      setBusy(false);
    }
  }, [ensureMonadNetwork, checkNetwork]);

  // React to the user switching accounts or networks in MetaMask.
  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts[0] ?? null);
    };
    const handleChainChanged = () => {
      checkNetwork();
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [checkNetwork]);

  const openById = () => {
    const n = Number(idInput);
    if (!Number.isInteger(n) || n < 1) return setStatus("Enter a record number (1 or higher).");
    setStatus("");
    openRecord(n);
  };

  return (
    <main className="container">
      <h1>Content Provenance Registry</h1>
      <p className="subtitle">
        Register content, track its versions, and check what is registered. This shows who registered
        content first and whether it changed. It does not say the content is accurate.
      </p>

      {!contractIsSet && (
        <div className="banner warn">
          Contract address not set yet. Deploy the contract, then paste the address into{" "}
          <code>frontend/src/config.ts</code>.
        </div>
      )}
      {wrongNetwork && (
        <div className="banner warn">
          Your wallet is not on {MONAD_TESTNET.chainName}. Reconnect to switch networks.
        </div>
      )}

      <div className="wallet">
        {!account ? (
          <button className="primary" onClick={connect} disabled={busy || !hasWallet}>
            {busy ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <div className="account">
            Connected: <code>{account.slice(0, 6)}…{account.slice(-4)}</code>
          </div>
        )}
        {!hasWallet && <span className="hint">No wallet detected. Checking content still works.</span>}
      </div>

      <nav className="tabs">
        <button className={tab === "check" ? "primary" : "ghost"} onClick={() => setTab("check")}>
          Check
        </button>
        <button className={tab === "register" ? "primary" : "ghost"} onClick={() => setTab("register")}>
          Register
        </button>
        <button className={tab === "record" ? "primary" : "ghost"} onClick={() => setTab("record")}>
          Record
        </button>
        <button className={tab === "demo" ? "primary" : "ghost"} onClick={() => setTab("demo")}>
          Speed demo
        </button>
      </nav>

      {contractIsSet && tab === "check" && <CheckForm onOpen={openRecord} />}
      {contractIsSet && tab === "register" && <RegisterForm account={account} onRegistered={openRecord} />}
      {contractIsSet && tab === "record" && (
        <>
          <div className="row">
            <input
              type="number"
              min={1}
              placeholder="Record number"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
            />
            <button className="ghost" onClick={openById}>
              Open
            </button>
          </div>
          {openId !== null && <ContentDetail key={openId} id={openId} account={account} />}
        </>
      )}
      {contractIsSet && tab === "demo" && <DemoBurst account={account} />}

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
