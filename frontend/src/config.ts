// ---------------------------------------------------------------------------
// PASTE YOUR DEPLOYED CONTRACT ADDRESS HERE
// You get this after running `npm run deploy` from the project root.
// The zero address below is a placeholder — the UI shows a warning until set.
// ---------------------------------------------------------------------------
export const CONTRACT_ADDRESS = "0xb613173F091ABbBe60135727C8E9d3e3Ecd4652A";

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

// The minimal ABI (Application Binary Interface) the frontend needs.
// It describes the functions/events the frontend calls on the contract.
// Replace these with your own contract's functions after you deploy it.
export const CONTRACT_ABI = [
  "function greeting() view returns (string)",
  "function setGreeting(string newGreeting)",
  "event GreetingChanged(string newGreeting, address changedBy)",
] as const;
