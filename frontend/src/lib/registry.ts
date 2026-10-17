import { BrowserProvider, Contract, JsonRpcProvider, Signer } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS, MONAD_TESTNET } from "../config";

// Monad charges the gas limit, not gas used, so every write sets one explicitly.
// Measured in test/ContentRegistry.ts: with a 512-byte link register ~535k, update ~512k, attest ~57k.
export const GAS = {
  register: 600_000n,
  update: 600_000n,
  attest: 100_000n,
};

export const KIND_ARTICLE = 0;
export const KIND_IMAGE = 1;

export type VersionInfo = {
  index: number;
  hash: string;
  uri: string;
  timestamp: number;
  attestCount: number;
  disputeCount: number;
};

export type ContentInfo = {
  id: number;
  author: string;
  kind: number;
  versions: VersionInfo[];
};

export type CheckResult =
  | { found: false }
  | { found: true; content: ContentInfo; matched: number; unchanged: boolean };

// Reads go straight to the RPC, so no wallet is needed to check content.
const readProvider = new JsonRpcProvider(MONAD_TESTNET.rpcUrl, MONAD_TESTNET.chainIdDecimal);

function readContract() {
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
}

export async function getSigner(): Promise<Signer> {
  if (!window.ethereum) throw new Error("No wallet found");
  return new BrowserProvider(window.ethereum).getSigner();
}

function writeContract(signer: Signer) {
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

export async function loadContent(id: number): Promise<ContentInfo> {
  const c = readContract();
  const [author, kind, count] = await c.getContent(id);
  const versions: VersionInfo[] = [];
  for (let i = 0; i < Number(count); i++) {
    const v = await c.getVersion(id, i);
    versions.push({
      index: i,
      hash: v.hash,
      uri: v.uri,
      timestamp: Number(v.timestamp),
      attestCount: Number(v.attestCount),
      disputeCount: Number(v.disputeCount),
    });
  }
  return { id, author, kind: Number(kind), versions };
}

export async function checkHash(hash: string): Promise<CheckResult> {
  const [found, id, version] = await readContract().lookup(hash);
  if (!found) return { found: false };
  const content = await loadContent(Number(id));
  const matched = Number(version);
  return {
    found: true,
    content,
    matched,
    unchanged: matched === content.versions.length - 1,
  };
}

export async function hasVoted(id: number, version: number, who: string): Promise<boolean> {
  return readContract().hasVoted(id, version, who);
}

// Turn a wallet/contract error into a short message for the UI.
export function describeError(err: unknown): string {
  const e = err as { shortMessage?: string; reason?: string; message?: string; code?: unknown };
  if (e?.code === "ACTION_REJECTED") return "Transaction rejected in the wallet.";
  return e?.reason || e?.shortMessage || e?.message || "Something went wrong.";
}

export async function registerContent(
  signer: Signer,
  hash: string,
  uri: string,
  kind: number
): Promise<{ id: number; ms: number }> {
  const start = performance.now();
  const tx = await writeContract(signer).register(hash, uri, kind, { gasLimit: GAS.register });
  const receipt = await tx.wait();
  const ms = performance.now() - start;
  const c = writeContract(signer);
  for (const log of receipt.logs) {
    try {
      const parsed = c.interface.parseLog(log);
      if (parsed?.name === "Registered") return { id: Number(parsed.args.id), ms };
    } catch {
      /* not one of our events */
    }
  }
  throw new Error("Registered, but the new id could not be read from the receipt.");
}

export async function updateContent(
  signer: Signer,
  id: number,
  hash: string,
  uri: string
): Promise<void> {
  const tx = await writeContract(signer).update(id, hash, uri, { gasLimit: GAS.update });
  await tx.wait();
}

export async function attestVersion(
  signer: Signer,
  id: number,
  version: number,
  supports: boolean
): Promise<void> {
  const tx = await writeContract(signer).attest(id, version, supports, { gasLimit: GAS.attest });
  await tx.wait();
}

// Speed demo: send many registrations with explicit sequential nonces, then wait for all.
export async function registerBurst(
  signer: Signer,
  count: number,
  onProgress: (done: number) => void
): Promise<number> {
  const c = writeContract(signer);
  const address = await signer.getAddress();
  let nonce = await new BrowserProvider(window.ethereum!).getTransactionCount(address, "pending");
  const stamp = Date.now();
  const start = performance.now();
  const txs = [];
  for (let i = 0; i < count; i++) {
    const bytes = new TextEncoder().encode(`demo ${stamp} #${i}`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = "0x" + Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
    txs.push(
      await c.register(hash, `https://example.com/demo/${stamp}/${i}`, KIND_ARTICLE, {
        gasLimit: GAS.register,
        nonce: nonce++,
      })
    );
  }
  let done = 0;
  await Promise.all(
    txs.map(async (tx) => {
      await tx.wait();
      onProgress(++done);
    })
  );
  return performance.now() - start;
}
