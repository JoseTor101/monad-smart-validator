# Quickstart: Validation Guide

## Prerequisites
- Node.js, MetaMask with Monad testnet (chain 10143) and testnet MON, `.env` with `PRIVATE_KEY`.
- `npm install` at root and in `frontend/`.

## 1. Contract tests (before any deploy)
```bash
npx hardhat test
```
Expect passing happy-path and revert tests for: duplicate hash, empty uri, non-author update, double attest on the same version, nonexistent id/version, new version voting again.

## 2. Deploy
```bash
npm run deploy
```
Copy the printed address into `frontend/src/config.ts` and verify it on the Monad testnet explorer.

## 3. Walkthrough (frontend: `cd frontend && npm run dev`)
1. Register an article → confirms in about 1 s; record shows author and time.
2. Register the same text again (also with different line endings/trailing spaces) → rejected.
3. Register an image; check the same file → "Unchanged".
4. Check a one-character-edited copy → "No registered record".
5. Update the article as author → timeline shows v0 → v1; another wallet's update is rejected.
6. Check the v0 text → matched version's counts plus "newer version exists".
7. Attest/dispute from two wallets → counts update; repeat vote rejected; vote on v1 allowed after update.
8. Confirm no screen says "true", "verified" or "original".

## 4. Speed demo
```bash
npx hardhat run scripts/demo-burst.ts --network monadTestnet
```
Expect 10 registrations confirmed in under 30 s with timings printed.

Details: [data-model.md](data-model.md), [contracts/ContentRegistry.md](contracts/ContentRegistry.md).
