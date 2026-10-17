# Project Constitution: Monad Smart Validator (Content Provenance)

> These rules guide every decision made by humans and AI assistants on this project.
> If a request, spec, plan or design doc conflicts with this document, this document wins until the team changes it.
> Version 2. Changes from the design-doc cross-reference are applied.

## 1. Mission
Let creators register articles and images onchain, track every edit, and let anyone check:
- **Who** registered it first, and **when**?
- Has it **changed**, and what is the full **version history**?
- How many people **attested** or **disputed** it?

## 2. Non-negotiable principles

1. **We prove integrity, not truth.**
   - The chain records hashes, timestamps, authors, versions and attestations.
   - The UI and the pitch never say "TRUE", "VERIFIED" or "ORIGINAL" as a fact.
   - Use instead: "Registered first here by X at T", "Unchanged" or "Modified", and "N attest / M dispute".
2. **Hash only, never content.**
   - Only SHA-256 hashes and short metadata (a URI, the kind) go onchain.
   - No raw text, files or personal data.
3. **Simplicity over features.**
   - One contract (`ContentRegistry`) with at most 4 state-changing or core functions (`register`, `update`, `attest`, `lookup`); plain read-only getters do not count.
   - Every extra feature must justify its time cost.
4. **Security basics are mandatory.**
   - Use `require()` for every precondition, including that the content exists before any action on it.
   - Follow checks-effects-interactions.
   - No `tx.origin`.
   - **No unbounded loops over storage.**
   - No onchain randomness.
   - Emit an event on every state change.
   - **Never trust caller-supplied weights, scores or amounts.** Derive them onchain.
   - **No unprotected one-time setters.** Wire dependencies in the constructor, or restrict setters to the deployer.
   - **Empty or tied outcomes never resolve to a positive result.**
5. **Claims must match code.**
   - The pitch, UI and docs may only describe mechanisms that exist in the deployed contract.
   - Anything else is labeled "roadmap".
6. **Monad-aware.**
   - Deploy to testnet (chain ID 10143) only.
   - Set realistic gas limits, because Monad charges the limit, not the gas used.
7. **The demo must show speed.** At least one moment must make Monad's speed visible, for example registering or attesting many items live.

## 3. MVP scope

**In: `ContentRegistry`**
- `register(bytes32 hash, string uri, Kind kind)`
  - The author is set once and is immutable.
  - A duplicate hash reverts.
  - Creates version 0.
- `update(uint256 id, bytes32 newHash, string newUri)`
  - Author only.
  - Appends a new version (append-only history).
  - A reused hash reverts.
- `attest(uint256 id, uint256 version, bool supports)`
  - One vote per wallet per version of a content.
  - Increments that version's raw `attestCount` / `disputeCount`; a new version starts at 0/0.
  - No weights.
  - A nonexistent id or version reverts.
- `lookup(bytes32 hash)`: returns whether a fingerprint is registered and, if so, its content id and version (the 4th core function, used by the check feature).
- Getters: `latestHash`, `versionCount`, `getVersion` (including that version's counts), `getContent` (author, kind, version count) and `hasVoted`.
- **Frontend:**
  - Register: paste text or upload an image, hash it in the browser (SHA-256 via `crypto.subtle`), submit with a plain URL.
  - Detail view: version timeline, attest/dispute counts.
  - **Check (verify) button** (UI label "Check against registry", so the UI never implies truth): re-hash the content and compare it with the onchain hash.

**Out (roadmap, pitch-only):**
- `ReputationRegistry` and `ValidationMarket`.
- Weighted voting, staking and slashing.
- Commit-reveal.
- Dispute courts.
- Perceptual hashing (pHash) and C2PA.
- IPFS.
- Co-authors, derivatives and royalties.
- Gasless onboarding.
- Mainnet.

**Reason for cutting the reputation layer:** without a real stake, consensus voting only measures who controls the most wallets. Raw counts are honest about what they are.

## 4. Decisions (resolved)

- **Information type:** articles and images (`enum Kind { Article, Image }`).
- **Who can attest:** anyone with a wallet.
- **Primary user:** the creator (registers and updates). The secondary user is the reader (verifies and attests).
- **Hash function:** SHA-256, computed client-side. The contract stores `bytes32` and never recomputes it.
- **Off-chain storage:** a plain URL for the MVP.

## 5. Known weaknesses we accept (and state openly in the pitch)

| Weakness | Why we accept it now | Roadmap fix |
|---|---|---|
| Sybil attestations (one person, many wallets) | No stake in the MVP; counts are labeled raw | Stake-weighted votes, quadratic weight, proof-of-personhood |
| Front-running `register` (copying a pending tx's hash to claim "first") | Fixing it needs commit-reveal or signatures | Commit-reveal registration |
| Off-chain plagiarism (content copied before it was registered here) | The chain can't see off-chain history | pHash / text similarity feeding disputes |
| Image byte-hash breaks on resize or re-encode | MVP answers "is this the exact file?" | Perceptual hashing |
| A reverted edit can't reuse an old hash | Side effect of the duplicate-hash guard | Allow the same id to reuse its own hashes |

**Pitch line:** *"We make provenance tamper-evident and edit history immutable. Community trust signals are transparent, and our roadmap makes false validation economically irrational."*

## 6. Stack (matches the existing repo, so don't migrate)
- **Contract:** Solidity ^0.8.24, **Hardhat** (`hardhat.config.ts` is already set to chainId 10143 and `testnet-rpc.monad.xyz`).
- **Deploy:** `scripts/deploy.ts`, replacing `Greeter.sol`.
- **Frontend:** the existing React + TS + Vite + **ethers** + MetaMask setup. Reuse the wallet-connect and network-switch code in `App.tsx`, and update the ABI and address in `config.ts`.
- **Hosting:** Vercel.

## 7. AI pair-programming rules
1. **AI may write the contract and its tests.**
   - A human **reviews the contract before it is deployed**.
   - AI **must deliver documentation** (`docs/PROJECT.md`) explaining the whole project and the contract function by function and line by line, so the team can study it afterwards.
   - The design doc's Solidity remains a **reference only**.
2. **AI may generate frontend boilerplate**, UI, styling and deploy scripts.
3. **Spec Kit:**
   - Spec phases (constitution → specify → clarify → plan → tasks → analyze) are capped at **45 minutes total**.
   - `/speckit.implement` may run all tasks, including contract tasks.
4. **Tests before deploy.** Each contract function needs at least one passing test and one test that expects a revert:
   - a duplicate hash;
   - a non-author update;
   - a double attest on the same version;
   - a nonexistent id or version.
5. **No new dependencies or features without team approval.**
6. **If AI output is unclear, ask "why" before accepting it.** If it's still unclear, don't merge it.
7. **AI-generated Solidity is reviewed specifically for:**
   - reentrancy;
   - missing `require`s;
   - unbounded loops;
   - caller-controlled values;
   - unprotected setters;
   - wrong visibility.

## 8. Definition of done (demo-ready)
- [ ] `ContentRegistry` deployed and verified on the Monad testnet explorer.
- [ ] All tests from rule 7.4 pass.
- [ ] Register an article and an image; each transaction confirms in about 1 second.
- [ ] Update content; the timeline shows v0 → v1 with timestamps.
- [ ] Check (verify) works: unchanged content shows a match, modified content shows "no match".
- [ ] Attest and dispute work, the counts update live, and a double vote on the same version reverts, and a new version can be voted on again.
- [ ] The pitch states the known weaknesses from section 5 and the roadmap.
- [ ] A 2-minute demo script is rehearsed once.
- [ ] `docs/PROJECT.md` explains the whole project and the contract (rule 7.1).

## 9. Time budget

| Block | Time |
|---|---|
| Spec Kit phases | 0:45 |
| Write contract + tests + docs | 1:30 |
| Deploy + verify | 0:20 |
| Frontend: register, timeline, verify, attest | 1:45 |
| Integration + bug fixing | 0:50 |
| Demo + pitch prep | 0:30 |

**Rule:** if a block runs more than 30 minutes over, cut scope in this order: image support → `update` → speed demo. **Never cut tests or the Check (verify) button.**