import {
  AbiCoder,
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  hexlify,
  keccak256,
  randomBytes,
  toUtf8Bytes,
  type Eip1193Provider,
} from "ethers";
import {
  Kind,
  MARKET_ABI,
  MARKET_ADDRESS,
  MONAD_TESTNET,
  Phase,
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  REPUTATION_ABI,
  REPUTATION_ADDRESS,
  TOPICS,
  isDeployed,
} from "./config";

export { Phase };

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

// --- Reading registered content --------------------------------------------

export interface ChainContent {
  id: number;
  author: string;
  kind: "Article" | "Image";
  createdAt: number; // unix seconds
  parentId: number;
  versions: number;
  hash: string; // latest content hash
  uri: string; // latest version uri (user-supplied label/location)
}

/**
 * Read every registered item from ContentRegistry, newest first. Returns an
 * empty array when the registry isn't deployed or holds nothing yet. Reads are
 * best-effort per id so one bad record doesn't sink the whole list.
 */
export async function fetchAllContent(): Promise<ChainContent[]> {
  if (!isDeployed(REGISTRY_ADDRESS)) return [];
  const registry = registryRead();

  // ids run 1 .. nextId-1 (nextId starts at 1, so nextId-1 == item count).
  const next: bigint = await registry.nextId();
  const count = Number(next) - 1;
  if (!Number.isFinite(count) || count <= 0) return [];

  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const results = await Promise.all(
    ids.map(async (id): Promise<ChainContent | null> => {
      try {
        const [author, kind, createdAt, parentId, numVersions] =
          await registry.getContent(id);
        const vcount = Number(numVersions);
        const latest =
          vcount > 0 ? await registry.getVersion(id, vcount - 1) : null;
        const hash: string = latest
          ? latest.contentHash ?? latest[0]
          : await registry.latestHash(id);
        const uri: string = latest ? latest.uri ?? latest[1] : "";
        return {
          id,
          author,
          kind: Number(kind) === Kind.Image ? "Image" : "Article",
          createdAt: Number(createdAt),
          parentId: Number(parentId),
          versions: vcount,
          hash,
          uri,
        };
      } catch (err) {
        console.warn(`Skipping content #${id}:`, err);
        return null;
      }
    })
  );

  return results
    .filter((c): c is ChainContent => c !== null)
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
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

// --- Reading a profile ------------------------------------------------------

export interface TopicReputation {
  slug: string;
  label: string;
  score: number;
}

export interface ChainProfile {
  registered: number; // content registered by this address
  content: ChainContent[]; // their registrations, newest first
  reputation: TopicReputation[]; // per-topic score (only topics with a score)
  totalReputation: number; // sum of positive topic scores
}

/**
 * Read everything we can truthfully derive for an address from on-chain views:
 * how many pieces it registered (ContentRegistry) and its per-topic reputation
 * (ReputationRegistry). Validation/dispute counts are NOT included because the
 * contracts expose them only as events, which a browser can't cheaply index.
 */
export async function fetchProfile(account: string): Promise<ChainProfile> {
  const empty: ChainProfile = {
    registered: 0,
    content: [],
    reputation: [],
    totalReputation: 0,
  };
  if (!isDeployed(REGISTRY_ADDRESS) || !account) return empty;

  const owner = account.toLowerCase();
  const all = await fetchAllContent();
  const mine = all.filter((c) => c.author.toLowerCase() === owner);

  let reputation: TopicReputation[] = [];
  if (isDeployed(REPUTATION_ADDRESS)) {
    const rep = reputationRead();
    const scores = await Promise.all(
      TOPICS.map(async (t) => {
        try {
          const raw: bigint = await rep.reputationOf(topicHash(t.id), account);
          return { slug: t.id, label: t.label, score: Number(raw) };
        } catch {
          return { slug: t.id, label: t.label, score: 0 };
        }
      })
    );
    reputation = scores.filter((s) => s.score !== 0);
  }

  const totalReputation = reputation.reduce(
    (sum, r) => sum + Math.max(0, r.score),
    0
  );

  return { registered: mine.length, content: mine, reputation, totalReputation };
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

// --- Validation market (commit–reveal) -------------------------------------
// (Phase is added to the top-of-file config import.)

export interface RoundState {
  roundId: number;
  contentId: number;
  topic: string; // bytes32
  commitDeadline: number; // unix seconds
  revealDeadline: number;
  minStake: bigint;
  escalationLevel: number;
  parentRound: number;
  yesWeight: bigint;
  noWeight: bigint;
  outcome: boolean;
  phase: Phase;
}

export interface MyVote {
  stake: bigint;
  revealed: boolean;
  choice: boolean;
  claimed: boolean;
  committed: boolean; // stake > 0 means a commitment exists
}

export const marketDeployed = () => isDeployed(MARKET_ADDRESS);

/** Read a round's full state, or null if it doesn't exist / market undeployed. */
export async function getRound(roundId: number): Promise<RoundState | null> {
  if (!marketDeployed() || roundId <= 0) return null;
  try {
    const m = marketRead();
    const r = await m.getRound(roundId);
    const phase = Number(r.phase ?? r[10]) as Phase;
    if (phase === Phase.None) return null;
    return {
      roundId,
      contentId: Number(r.contentId ?? r[0]),
      topic: r.topic ?? r[1],
      commitDeadline: Number(r.commitDeadline ?? r[2]),
      revealDeadline: Number(r.revealDeadline ?? r[3]),
      minStake: BigInt(r.minStake ?? r[4]),
      escalationLevel: Number(r.escalationLevel ?? r[5]),
      parentRound: Number(r.parentRound ?? r[6]),
      yesWeight: BigInt(r.yesWeight ?? r[7]),
      noWeight: BigInt(r.noWeight ?? r[8]),
      outcome: Boolean(r.outcome ?? r[9]),
      phase,
    };
  } catch (err) {
    console.warn(`getRound(${roundId}) failed:`, err);
    return null;
  }
}

/**
 * Find the active (or most recent) round for a content+topic. The contract
 * tracks activeRoundFor by keccak(contentId, topic); if that's 0 we scan
 * recent rounds for a match so resolved rounds still surface in the UI.
 */
export async function findRoundFor(
  contentId: number,
  topicSlug: string
): Promise<RoundState | null> {
  if (!marketDeployed()) return null;
  const m = marketRead();
  const topic = topicHash(topicSlug);

  // Fast path: an active (non-resolved) round is indexed on-chain.
  try {
    const key = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ["uint256", "bytes32"],
        [contentId, topic]
      )
    );
    const active: bigint = await m.activeRoundFor(key);
    if (Number(active) > 0) return getRound(Number(active));
  } catch {
    /* activeRoundFor may revert if not present; fall through to scan */
  }

  // Slow path: scan rounds newest-first for one matching this content+topic.
  try {
    const next: bigint = await m.nextRound();
    const total = Number(next) - 1;
    for (let id = total; id >= 1; id--) {
      const r = await getRound(id);
      if (r && r.contentId === contentId && r.topic === topic) return r;
    }
  } catch (err) {
    console.warn("findRoundFor scan failed:", err);
  }
  return null;
}

/** This wallet's vote in a round. */
export async function getMyVote(
  roundId: number,
  account: string
): Promise<MyVote | null> {
  if (!marketDeployed() || roundId <= 0 || !account) return null;
  try {
    const m = marketRead();
    const v = await m.voteOf(roundId, account);
    const stake = BigInt(v.stake ?? v[0]);
    return {
      stake,
      revealed: Boolean(v.revealed ?? v[1]),
      choice: Boolean(v.choice ?? v[2]),
      claimed: Boolean(v.claimed ?? v[3]),
      committed: stake > 0n,
    };
  } catch (err) {
    console.warn(`getMyVote(${roundId}) failed:`, err);
    return null;
  }
}

// --- Commitment + salt persistence -----------------------------------------

/** commitment = keccak256(abi.encode(choice, salt, voter)) — mirrors the contract. */
export function hashCommitment(
  choice: boolean,
  salt: string,
  voter: string
): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["bool", "bytes32", "address"],
      [choice, salt, voter]
    )
  );
}

export function randomSalt(): string {
  return hexlify(randomBytes(32));
}

// The salt + choice must survive until the reveal phase (possibly a later
// session), or the vote is forfeited. Persist locally, keyed by round+voter.
interface StoredCommit {
  choice: boolean;
  salt: string;
}
function commitKey(roundId: number, voter: string): string {
  return `sv-commit:${roundId}:${voter.toLowerCase()}`;
}
export function saveCommit(
  roundId: number,
  voter: string,
  data: StoredCommit
): void {
  try {
    localStorage.setItem(commitKey(roundId, voter), JSON.stringify(data));
  } catch {
    /* storage may be unavailable */
  }
}
export function loadCommit(
  roundId: number,
  voter: string
): StoredCommit | null {
  try {
    const raw = localStorage.getItem(commitKey(roundId, voter));
    return raw ? (JSON.parse(raw) as StoredCommit) : null;
  } catch {
    return null;
  }
}

// --- Market write actions ---------------------------------------------------

/** Open a round for a piece. Author cannot open their own (contract enforces). */
export async function openRound(
  contentId: number,
  topicSlug: string,
  commitWindowSecs: number,
  revealWindowSecs: number,
  minStakeWei: bigint
): Promise<number> {
  const market = await marketWrite();
  const tx = await market.openRound(
    contentId,
    topicHash(topicSlug),
    commitWindowSecs,
    revealWindowSecs,
    minStakeWei
  );
  const receipt = await tx.wait();
  // Pull the new round id from the RoundOpened event when available.
  try {
    const next: bigint = await marketRead().nextRound();
    return Number(next) - 1;
  } catch {
    return receipt?.status === 1 ? 0 : -1;
  }
}

/** Commit a hashed vote with stake; persists the salt locally for reveal. */
export async function commitVote(
  roundId: number,
  choice: boolean,
  stakeWei: bigint,
  voter: string
): Promise<void> {
  const salt = randomSalt();
  const commitment = hashCommitment(choice, salt, voter);
  const market = await marketWrite();
  const tx = await market.commitVote(roundId, commitment, { value: stakeWei });
  await tx.wait();
  // Only persist after the commit confirms, so we don't store a phantom salt.
  saveCommit(roundId, voter, { choice, salt });
}

/** Reveal a previously committed vote using the stored salt. */
export async function revealVote(
  roundId: number,
  voter: string
): Promise<void> {
  const stored = loadCommit(roundId, voter);
  if (!stored) {
    throw new Error(
      "No saved vote found in this browser. The reveal needs the secret salt created at commit time."
    );
  }
  const market = await marketWrite();
  const tx = await market.revealVote(roundId, stored.choice, stored.salt);
  await tx.wait();
}

/** Resolve a round after the reveal window (anyone may call). */
export async function resolveRound(roundId: number): Promise<void> {
  const market = await marketWrite();
  const tx = await market.resolve(roundId);
  await tx.wait();
}

/** Withdraw refund + reward after resolution. */
export async function withdrawRound(roundId: number): Promise<void> {
  const market = await marketWrite();
  const tx = await market.withdraw(roundId);
  await tx.wait();
}

// --- Content upload (Cloudflare R2 via Pages Function) ---------------------

export interface UploadResult {
  key: string; // R2 object key
  url: string; // same-origin path served by the content Function (e.g. /content/<hash>.txt)
  publicUrl?: string; // absolute r2.dev/custom-domain URL if PUBLIC_BASE_URL is set
  hash: string; // 0x-prefixed SHA-256 the server computed over the bytes
  size: number;
  contentType: string;
}

// Where the upload endpoint lives. Same-origin by default (the Pages Function
// at /api/upload); overridable for local dev or a standalone Worker.
const UPLOAD_ENDPOINT =
  (import.meta.env?.VITE_UPLOAD_ENDPOINT as string | undefined) ?? "/api/upload";

/**
 * Upload a file to R2 through the Pages Function and get back its public URL +
 * server-computed hash. No wallet/gas involved — this is pure storage. The
 * caller then records the hash + url on-chain via register().
 */
export async function uploadContent(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const msg =
      (payload as { error?: string })?.error ??
      `Upload failed (${res.status})`;
    throw new Error(msg);
  }
  return payload as UploadResult;
}

/** Upload UTF-8 article text as a .txt file so it can be re-read and re-hashed. */
export async function uploadArticleText(
  title: string,
  text: string
): Promise<UploadResult> {
  const safe = (title || "article").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40);
  const file = new File([text], `${safe || "article"}.txt`, {
    type: "text/plain",
  });
  return uploadContent(file);
}

// --- Reading stored content back -------------------------------------------

/**
 * Turn a stored uri into something fetchable. Full http(s) urls pass through;
 * ipfs:// is routed through a public gateway; a bare R2 key gets the public
 * base (or same-origin) prepended. Returns null if we can't form a URL.
 */
export function resolveContentUrl(uri: string): string | null {
  const u = (uri ?? "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^ipfs:\/\//i.test(u)) return `https://ipfs.io/ipfs/${u.slice(7)}`;
  // Same-origin content path served by functions/content/[[path]].ts.
  if (u.startsWith("/content/")) return u;
  if (u.startsWith("content/")) return `/${u}`;
  // Unknown shape (e.g. a plain title typed as uri) — not fetchable.
  return null;
}

export interface FetchedContent {
  url: string;
  contentType: string;
  isText: boolean;
  isImage: boolean;
  text?: string; // present for text content
  hashMatches: boolean | null; // re-hash vs provided on-chain hash; null if unknown
}

/**
 * Fetch stored content and, when an expected hash is given, re-hash the bytes
 * to confirm they match what's sealed on-chain. This is the "anyone can verify"
 * property made concrete.
 */
export async function fetchContent(
  uri: string,
  expectedHash?: string
): Promise<FetchedContent> {
  const url = resolveContentUrl(uri);
  if (!url) throw new Error("This item has no fetchable content URL.");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't fetch content (${res.status}).`);

  const contentType = res.headers.get("content-type") ?? "";
  const bytes = await res.arrayBuffer();

  let hashMatches: boolean | null = null;
  if (expectedHash) {
    const got = await sha256Hex(bytes);
    hashMatches = got.toLowerCase() === expectedHash.toLowerCase();
  }

  const isImage = contentType.startsWith("image/");
  const isText =
    contentType.startsWith("text/") || contentType.includes("json");
  const text = isText ? new TextDecoder().decode(bytes) : undefined;

  return { url, contentType, isText, isImage, text, hashMatches };
}
