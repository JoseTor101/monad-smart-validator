import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  type Eip1193Provider,
} from "ethers";
import {
  MARKET_ABI,
  MARKET_ADDRESS,
  MONAD_TESTNET,
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  REPUTATION_ABI,
  REPUTATION_ADDRESS,
} from "./config";

export const hasWallet = () =>
  typeof window !== "undefined" && !!window.ethereum;

/** Read-only provider: public RPC, no wallet needed. */
export function readProvider(): JsonRpcProvider {
  return new JsonRpcProvider(MONAD_TESTNET.rpcUrl, MONAD_TESTNET.chainIdDecimal);
}

/** Wallet-backed provider (requires an injected EIP-1193 wallet). */
export function walletProvider(): BrowserProvider {
  if (!window.ethereum) throw new Error("No wallet found");
  return new BrowserProvider(window.ethereum as Eip1193Provider);
}

/** Request accounts and ensure the wallet is on Monad testnet. */
export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet found");
  const provider = walletProvider();
  const accounts: string[] = await provider.send("eth_requestAccounts", []);
  await ensureMonadNetwork();
  return accounts[0];
}

export async function ensureMonadNetwork(): Promise<void> {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_TESTNET.chainIdHex }],
    });
  } catch (err: unknown) {
    // 4902 = chain unknown to the wallet; add it then it becomes active.
    if ((err as { code?: number })?.code === 4902) {
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
}

// --- Contract instances ----------------------------------------------------

export function registryRead() {
  return new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, readProvider());
}
export function reputationRead() {
  return new Contract(REPUTATION_ADDRESS, REPUTATION_ABI, readProvider());
}
export function marketRead() {
  return new Contract(MARKET_ADDRESS, MARKET_ABI, readProvider());
}

export async function registryWrite() {
  const signer = await walletProvider().getSigner();
  return new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
}
export async function marketWrite() {
  const signer = await walletProvider().getSigner();
  return new Contract(MARKET_ADDRESS, MARKET_ABI, signer);
}

// --- Hashing ----------------------------------------------------------------

/** SHA-256 of arbitrary bytes, returned as a 0x-prefixed bytes32 hex string. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return (
    "0x" +
    [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** SHA-256 of a UTF-8 string (articles). */
export async function sha256Text(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text).buffer);
}

/** Topic id (slug) -> bytes32 used on-chain for scoped reputation. */
export function topicHash(slug: string): string {
  return keccak256(toUtf8Bytes(slug));
}

// --- Formatting -------------------------------------------------------------

export function shortAddr(addr?: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHash(hash?: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function timeAgo(tsSeconds: number | bigint): string {
  const ts = Number(tsSeconds) * 1000;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
