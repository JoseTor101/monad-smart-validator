# Project Constitution: Veracity Registry on Monad

> These rules guide every decision made by humans and AI assistants on this project.
> If a request conflicts with this document, this document wins until the team changes it.

## 1. Mission
Let anyone register information onchain and let anyone check it. A check answers four questions:
- Has the content changed since it was registered?
- When was it registered?
- Who registered it?
- Who confirmed or disputed it?

## 2. Non-negotiable principles

1. **We prove integrity, not truth.** The chain records hashes, timestamps, signers and attestations.
   - The UI never says "TRUE" or "VERIFIED".
   - It says "Registered by X at T", "Unchanged" or "Modified", and "N attestations / M disputes".
2. **Hash only, never content.** No raw text, files or personal data go onchain. Only `keccak256` hashes and short metadata.
3. **Simplicity over features.** One contract with at most 3–4 public functions for the MVP. Every extra feature must justify its time cost.
4. **Security basics are mandatory.**
   - Use `require()` for every precondition.
   - Follow checks-effects-interactions: update state before any transfer.
   - No `tx.origin`.
   - No unbounded loops over storage.
   - No onchain randomness.
   - Emit an event on every state change.
5. **Monad-aware.**
   - Deploy to testnet (chain ID 10143) only.
   - Use Foundry v1.8+.
   - Set realistic gas limits, because Monad charges the limit, not the gas used.
6. **The demo must show speed.** At least one moment in the demo must make Monad's speed visible, for example registering many items live.

## 3. MVP scope

**In:**
- `register(bytes32 hash, string sourceUri)`: one record per hash; registering a duplicate reverts.
- `attest(bytes32 hash, bool supports)`: one attestation per wallet per hash.
- `getRecord(bytes32 hash)`: returns the registrant, timestamp, attestation count and dispute count.
- A web page where you drop text or a file, the browser hashes it locally, and the page shows the onchain record.

**Out (post-hackathon):**
- Staking and slashing.
- Reputation systems.
- Sybil resistance.
- Content storage (IPFS).
- Mainnet.
- Token.
- Editing records.

## 4. Open decisions (team must fill in before coding)

- [ ] **Information type:** news / photos / certificates / other: ______
- [ ] **Who can attest:** anyone / whitelisted / issuers only: ______
- [ ] **Primary user:** publisher / checker: ______
- [ ] **Known weakness we accept for the MVP** (e.g. Sybil attestations): ______

## 5. Stack
- **Contract:** Solidity ^0.8.x, Foundry (forge test, forge create/script), Monad testnet.
- **Frontend:** Next.js or Vite + wagmi + viem, deployed on Vercel.
- **Hashing:** done client-side with viem's `keccak256`, so the same hash is used in the browser and the contract.

## 6. AI pair-programming rules
1. **The contract is human-written.**
   - AI may explain, review and suggest, but a human types it and must be able to explain every line out loud.
2. **AI may generate frontend boilerplate**, wallet connection, styling and deploy scripts.
3. **Tests before deploy.** Each contract function needs at least one passing test and one test that expects a revert.
4. **No new dependencies or features without team approval.**
5. **When AI output is unclear, ask "why" before accepting it.** If it's still unclear, don't merge it.
6. **AI-generated Solidity is reviewed specifically for:**
   - reentrancy;
   - missing `require`s;
   - unbounded loops;
   - wrong visibility (`public` vs `external` vs `internal`).

## 7. Definition of done (demo-ready)
- [ ] Contract deployed and verified on the Monad testnet explorer.
- [ ] A user can register content and see the transaction confirm in about 1 second.
- [ ] A user can check content: unchanged content shows the record, and modified content shows "no match".
- [ ] Attest and dispute work, and the counts update live.
- [ ] A 2-minute demo script is rehearsed once.

## 8. Time budget (6h)

| Block | Time |
|---|---|
| Fill open decisions + contract interface | 0:30 |
| Write contract + tests | 1:30 |
| Deploy + verify | 0:30 |
| Frontend + wallet + hashing | 2:00 |
| Integration + bug fixing | 1:00 |
| Demo prep | 0:30 |

**Rule:** if a block runs more than 30 minutes over, cut scope. Don't cut tests.