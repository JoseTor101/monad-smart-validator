# Content Provenance Registry (Monad testnet)

Register articles and images onchain, track every edit, and let anyone check who registered content first and whether it changed. A reader can also attest or dispute each version.

**What this proves, and what it does not:** it proves integrity (a fingerprint, an author, timestamps, versions, raw vote counts). It does not prove that content is accurate. Attest/dispute counts are unweighted community signals.

Only a SHA-256 fingerprint and a link go onchain. The content never leaves your device.

## Project structure

```
contracts/ContentRegistry.sol   # the registry (written by hand)
test/ContentRegistry.ts         # Hardhat tests
scripts/deploy.ts               # deploy to Monad testnet
scripts/demo-burst.ts           # speed demo: N back-to-back registrations
frontend/                       # React + Vite + ethers UI (Check / Register / Record / Speed demo)
specs/001-content-provenance-registry/   # spec, plan, tasks
constitution.md                 # project rules
```

## Known weaknesses (stated openly)

| Weakness | Roadmap fix |
|---|---|
| Sybil attestations (one person, many wallets) | Stake-weighted votes, proof-of-personhood |
| Front-running `register` to claim "first" | Commit-reveal registration |
| Off-chain plagiarism before registration | Perceptual / text similarity |
| Image hash breaks on resize or re-encode | Perceptual hashing |
| Reverted edit cannot reuse an old hash | Let an id reuse its own hashes |

Out of scope for now: reputation, staking, weighted voting, content storage, plagiarism detection, mainnet.

## Prerequisites
- [Node.js](https://nodejs.org) 18+ installed
- [MetaMask](https://metamask.io) browser extension
- A little testnet **MON** from the [Monad faucet](https://faucet.monad.xyz)

---

## Step 1 — Install & compile the contract

From the project root:

```bash
npm install
npm run compile
npx hardhat test
```

## Step 2 — Add your private key

1. Copy `.env.example` to `.env`.
2. In MetaMask: **Account details → Show private key**, copy it into `.env`:

```
PRIVATE_KEY=your_test_wallet_private_key
```

> Use a throwaway wallet for hackathons. `.env` is git-ignored so it won't be committed.

## Step 3 — Get testnet MON

Go to the [Monad faucet](https://faucet.monad.xyz) and request tokens for your wallet address. You need a small amount to pay for deployment gas.

## Step 4 — Deploy to Monad testnet

```bash
npm run deploy
```

You'll see the deployed address printed. Copy it.

## Step 5 — Wire up the frontend

Open `frontend/src/config.ts` and paste the address into `CONTRACT_ADDRESS`, (the ABI already matches `ContentRegistry`).

## Step 6 — Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Click **Connect Wallet** — MetaMask will prompt you and automatically switch to (or add) the Monad testnet.

---

## Monad testnet reference

| Field | Value |
|-------|-------|
| Network name | Monad Testnet |
| Chain ID | 10143 |
| RPC URL | https://testnet-rpc.monad.xyz |
| Currency | MON |
| Faucet | https://faucet.monad.xyz |

Facts sourced from the [Monad documentation](https://docs.monad.xyz/ai/current-facts). Content was rephrased for compliance with licensing restrictions.

---

## Speed demo

```bash
REGISTRY_ADDRESS=0x... npx hardhat run scripts/demo-burst.ts --network monadTestnet
```

or use the **Speed demo** tab in the UI.
