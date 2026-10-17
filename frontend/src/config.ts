// ---------------------------------------------------------------------------
// PASTE THE DEPLOYED ContentRegistry ADDRESS HERE
// You get this after running `npm run deploy` from the project root.
// The zero address below is a placeholder — the UI shows a warning until set.
// ---------------------------------------------------------------------------
const LOCAL = import.meta.env.VITE_LOCAL === "1";

export const CONTRACT_ADDRESS = LOCAL
  ? "0x5FbDB2315678afecb367f032d93F642f64180aa3" // first deploy on `npx hardhat node`
  : "0x0000000000000000000000000000000000000000";

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

// Local Hardhat node (`npm run node`), used when VITE_LOCAL=1.
const LOCAL_NET = {
  chainIdDecimal: 31337,
  chainIdHex: "0x7a69",
  chainName: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  blockExplorerUrl: "",
};

export const MONAD_TESTNET = LOCAL ? LOCAL_NET : TESTNET;

// The ABI the frontend needs. Mirrors specs/001-content-provenance-registry/contracts/ContentRegistry.md.
// kind: 0 = Article, 1 = Image.
export const CONTRACT_ABI = [
  "function register(bytes32 hash, string uri, uint8 kind) returns (uint256 id)",
  "function update(uint256 id, bytes32 newHash, string newUri) returns (uint256 version)",
  "function attest(uint256 id, uint256 version, bool support)",
  "function lookup(bytes32 hash) view returns (bool found, uint256 id, uint256 version)",
  "function getContent(uint256 id) view returns (address author, uint8 kind, uint256 versionCount)",
  "function getVersion(uint256 id, uint256 version) view returns (bytes32 hash, string uri, uint64 timestamp, uint32 attestCount, uint32 disputeCount)",
  "function versionCount(uint256 id) view returns (uint256)",
  "function latestHash(uint256 id) view returns (bytes32)",
  "function hasVoted(uint256 id, uint256 version, address who) view returns (bool)",
  "event Registered(uint256 indexed id, address indexed author, bytes32 hash, uint8 kind, string uri)",
  "event Updated(uint256 indexed id, uint256 version, bytes32 hash, string uri)",
  "event Attested(uint256 indexed id, uint256 version, address indexed voter, bool support)",
] as const;
