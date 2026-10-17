// ---------------------------------------------------------------------------
// DEPLOYED CONTRACT ADDRESSES
// After running `npm run deploy` from the project root, paste the three
// printed addresses here. The zero address is a placeholder — the UI shows a
// "not deployed" notice until a real address is set.
// ---------------------------------------------------------------------------
const ZERO = "0x0000000000000000000000000000000000000000";

// Deployed to Monad testnet (see `npm run deploy`).
export const REGISTRY_ADDRESS = "0xDcCB43d8Afad06615FBd1A5c2AB6525e113Bd2A5";
export const REPUTATION_ADDRESS = "0xd270d7BA694b33e58483bD60057675FC39E9964D";
export const MARKET_ADDRESS = "0x0777e7d871462b394fe94eAbDa5BA8ab40179A9D";

export const isDeployed = (addr: string) => addr !== ZERO;

// Monad Testnet network details.
// Source of truth: https://docs.monad.xyz (Testnet Quick Facts)
export const MONAD_TESTNET = {
  chainIdDecimal: 10143,
  chainIdHex: "0x279f", // 10143 in hex
  chainName: "Monad Testnet",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  currency: { name: "MON", symbol: "MON", decimals: 18 },
  blockExplorerUrl: "https://testnet.monadexplorer.com",
};

// Content kinds mirror ContentRegistry.Kind (enum order matters).
export enum Kind {
  Article = 0,
  Image = 1,
}

// --- ABIs (human-readable form; only the members the frontend touches) ------

export const REGISTRY_ABI = [
  "function nextId() view returns (uint256)",
  "function register(bytes32 contentHash, string uri, uint8 kind) returns (uint256)",
  "function registerDerivative(bytes32 contentHash, string uri, uint8 kind, uint256 parentId) returns (uint256)",
  "function update(uint256 id, bytes32 newHash, string newUri)",
  "function getContent(uint256 id) view returns (address author, uint8 kind, uint256 createdAt, uint256 parentId, uint256 numVersions)",
  "function authorOf(uint256 id) view returns (address)",
  "function versionCount(uint256 id) view returns (uint256)",
  "function getVersion(uint256 id, uint256 index) view returns (tuple(bytes32 contentHash, string uri, uint256 timestamp, address editor))",
  "function latestHash(uint256 id) view returns (bytes32)",
  "function isRegistered(bytes32 contentHash) view returns (bool)",
  "event ContentRegistered(uint256 indexed id, address indexed author, bytes32 indexed contentHash, uint8 kind, uint256 parentId)",
  "event ContentUpdated(uint256 indexed id, uint256 version, bytes32 indexed newHash, address editor)",
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
