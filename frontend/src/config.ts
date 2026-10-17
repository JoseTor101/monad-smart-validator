// ---------------------------------------------------------------------------
// DEPLOYED CONTRACT ADDRESSES
// After running `npm run deploy` from the project root, paste the three
// printed addresses here. The zero address is a placeholder — the UI shows a
// "not deployed" notice until a real address is set.
// ---------------------------------------------------------------------------
const ZERO = "0x0000000000000000000000000000000000000000";

// VITE_LOCAL=1 targets a local `npm run node` chain with the first deploy's addresses.
const LOCAL = import.meta.env.VITE_LOCAL === "1";

export const REGISTRY_ADDRESS = LOCAL ? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" : ZERO;
export const REPUTATION_ADDRESS = LOCAL ? "0x5FbDB2315678afecb367f032d93F642f64180aa3" : ZERO;
export const MARKET_ADDRESS = LOCAL ? "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" : ZERO;

export const isDeployed = (addr: string) => addr !== ZERO;

// Monad Testnet network details.
// Source of truth: https://docs.monad.xyz (Testnet Quick Facts)
const TESTNET = {
  chainIdDecimal: 10143,
  chainIdHex: "0x279f", // 10143 in hex
  chainName: "Monad Testnet",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  currency: { name: "MON", symbol: "MON", decimals: 18 },
  blockExplorerUrl: "https://testnet.monadexplorer.com",
};

const LOCAL_NET = {
  chainIdDecimal: 31337,
  chainIdHex: "0x7a69",
  chainName: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  blockExplorerUrl: "",
};

export const MONAD_TESTNET = LOCAL ? LOCAL_NET : TESTNET;

// Content kinds mirror ContentRegistry.Kind (enum order matters).
export enum Kind {
  Article = 0,
  Image = 1,
}

// --- ABIs (human-readable form; only the members the frontend touches) ------

export const REGISTRY_ABI = [
  "function register(bytes32 hash, string uri, uint8 kind) returns (uint256 id)",
  "function update(uint256 id, bytes32 newHash, string newUri) returns (uint256 version)",
  "function attest(uint256 id, uint256 version, bool support)",
  "function lookup(bytes32 hash) view returns (bool found, uint256 id, uint256 version)",
  "function getContent(uint256 id) view returns (address author, uint8 kind, uint256 versionCount)",
  "function getVersion(uint256 id, uint256 version) view returns (bytes32 hash, string uri, uint64 timestamp, uint32 attestCount, uint32 disputeCount)",
  "function authorOf(uint256 id) view returns (address)",
  "function versionCount(uint256 id) view returns (uint256)",
  "function latestHash(uint256 id) view returns (bytes32)",
  "function hasVoted(uint256 id, uint256 version, address who) view returns (bool)",
  "event Registered(uint256 indexed id, address indexed author, bytes32 hash, uint8 kind, string uri)",
  "event Updated(uint256 indexed id, uint256 version, bytes32 hash, string uri)",
  "event Attested(uint256 indexed id, uint256 version, address indexed voter, bool support)",
] as const;

export const REPUTATION_ABI = [
  "function reputationOf(bytes32 topic, address who) view returns (int256)",
  "function weightOf(bytes32 topic, address who) view returns (uint256)",
  "function market() view returns (address)",
  "event ReputationChanged(bytes32 indexed topic, address indexed who, int256 delta, int256 newScore)",
] as const;

export const MARKET_ABI = [
  "function nextRound() view returns (uint256)",
  "function openRound(uint256 contentId, bytes32 topic, uint256 commitWindow, uint256 revealWindow, uint256 minStake) returns (uint256)",
  "function commitVote(uint256 roundId, bytes32 commitment) payable",
  "function revealVote(uint256 roundId, bool choice, bytes32 salt)",
  "function resolve(uint256 roundId)",
  "function withdraw(uint256 roundId)",
  "function dispute(uint256 roundId, bytes32 commitment, uint256 commitWindow, uint256 revealWindow) payable returns (uint256)",
  "function getRound(uint256 roundId) view returns (uint256 contentId, bytes32 topic, uint256 commitDeadline, uint256 revealDeadline, uint256 minStake, uint8 escalationLevel, uint256 parentRound, uint256 yesWeight, uint256 noWeight, bool outcome, uint8 phase)",
  "function committerCount(uint256 roundId) view returns (uint256)",
  "function voteOf(uint256 roundId, address who) view returns (uint256 stake, bool revealed, bool choice, bool claimed)",
  "function hashVote(bool choice, bytes32 salt, address voter) pure returns (bytes32)",
  "event RoundOpened(uint256 indexed roundId, uint256 indexed contentId, bytes32 indexed topic, uint256 commitDeadline, uint256 revealDeadline, uint256 minStake, uint8 escalationLevel)",
  "event Committed(uint256 indexed roundId, address indexed voter, uint256 stake)",
  "event Revealed(uint256 indexed roundId, address indexed voter, bool choice, uint256 stake)",
  "event Resolved(uint256 indexed roundId, bool outcome, uint256 yesWeight, uint256 noWeight)",
  "event Disputed(uint256 indexed parentRound, uint256 indexed newRound, address indexed challenger)",
  "event Withdrawn(address indexed who, uint256 amount)",
] as const;

// Validation round phases mirror ValidationMarket.Phase.
export enum Phase {
  None = 0,
  Commit = 1,
  Reveal = 2,
  Resolved = 3,
}

// Discovery areas — each maps to a reputation topic (keccak256 computed lazily).
export const TOPICS = [
  { id: "journalism", label: "Journalism", blurb: "Reporting, investigations, long-form" },
  { id: "photography", label: "Photography", blurb: "Original captures and photo essays" },
  { id: "research", label: "Research", blurb: "Papers, data, scientific writing" },
  { id: "art", label: "Digital art", blurb: "Illustration, generative, mixed media" },
  { id: "opinion", label: "Opinion", blurb: "Essays, criticism, commentary" },
  { id: "docs", label: "Documentation", blurb: "Technical and reference writing" },
] as const;
