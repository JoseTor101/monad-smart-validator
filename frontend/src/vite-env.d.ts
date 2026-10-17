/// <reference types="vite/client" />

// MetaMask (and other wallets) inject `window.ethereum`.
// This tells TypeScript it exists.
interface Window {
  ethereum?: import("ethers").Eip1193Provider & {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}
