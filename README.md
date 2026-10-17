# 🟣 Monad dApp Starter

A clean starting architecture for a Monad hackathon project: a **Solidity smart contract** deployed to the **Monad testnet** via **Hardhat**, plus a **React + TypeScript** frontend (Vite + ethers) that connects a wallet and talks to the contract.

This is the *scaffolding only* — a placeholder `Greeter` contract shows the read/write pattern. Replace it with your own contract logic.

---

## Project structure

```
monad-hackaton/
├─ contracts/Greeter.sol      # placeholder contract (replace with your own)
├─ scripts/deploy.ts          # deploys a contract to Monad testnet
├─ hardhat.config.ts          # Hardhat config pointed at Monad testnet
├─ .env.example               # where your private key goes (copy to .env)
└─ frontend/                  # React + TypeScript UI (Vite)
   └─ src/
      ├─ App.tsx              # wallet connect + contract calls
      └─ config.ts            # PASTE YOUR CONTRACT ADDRESS + ABI HERE
```

### Key blockchain concepts (30-second version)
- **Smart contract**: a program living on the blockchain. Once deployed, anyone can call it.
- **Reading** state is free. **Writing** state (a transaction) costs a tiny bit of gas.
- **Gas** is paid in the chain's native token. On Monad testnet that's **MON**, which you get free from a faucet.
- **MetaMask** is the wallet that holds your account and signs transactions.

---

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

Open `frontend/src/config.ts` and paste the address into `CONTRACT_ADDRESS`, and update `CONTRACT_ABI` to match your contract's functions.

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

## Making it your own
1. Replace `contracts/Greeter.sol` with your contract (keep or rename the file).
2. Update `scripts/deploy.ts` to deploy your contract (and pass any constructor args).
3. Update `frontend/src/config.ts` with the new address and ABI.
4. Update `frontend/src/App.tsx` to call your contract's functions.
