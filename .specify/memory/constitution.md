<!--
Sync Impact Report
Version change: 1.1.2 → 1.2.0
MINOR amendment (AI rules 1 and 3, definition of done, time budget): AI MAY write the contract, tests
  and docs; a human reviews before deploy and studies it later; AI MUST deliver documentation.
Previous: 1.1.1 → 1.1.2
PATCH amendment: the "Verify button" is the "Check (verify) button"; the UI label is "Check against
  registry" so the UI never implies the content is true (Principle I).
Previous: 1.1.0 → 1.1.1
PATCH amendment: list `lookup` as the 4th core function and `getContent`/`hasVoted` as views.
Previous: 1.0.0 → 1.1.0
Amendment: attestations are per version (attest takes a version index; counts per version).
  Updated: Scope & Stack (attest, getters), AI rule 4 (revert tests), Definition of done.
Modified principles: none
Added sections: Core Principles (7), Scope & Stack, Known Weaknesses, AI Pair-Programming Rules,
  Definition of Done & Time Budget, Governance
Removed sections: none
Templates requiring updates: none modified here; templates read this file at runtime
Follow-up TODOs: none. Root constitution.md remains as the source draft; keep the two in sync or remove it.
-->
# Monad Smart Validator (Content Provenance) Constitution

If a request, spec, plan or design doc conflicts with this document, this document wins until
the team amends it.

## Core Principles

### I. We Prove Integrity, Not Truth
The chain records hashes, timestamps, authors, versions and attestations. The UI, docs and pitch
MUST NOT state "TRUE", "VERIFIED" or "ORIGINAL" as a fact. They MUST use wording such as
"Registered first here by X at T", "Unchanged" or "Modified", and "N attest / M dispute".

### II. Hash Only, Never Content
Only SHA-256 hashes and short metadata (a URI, the kind) go onchain. Raw text, files and
personal data MUST NOT be stored onchain.

### III. Simplicity Over Features
There is one contract, `ContentRegistry`, with at most 4 state-changing or core functions:
`register`, `update`, `attest` and `lookup`. Plain read-only getters do not count.
Every extra feature MUST justify its time cost.

### IV. Security Basics (NON-NEGOTIABLE)
- Every precondition MUST use `require()`, including that the content exists before any action.
- Code MUST follow checks-effects-interactions.
- `tx.origin` and onchain randomness MUST NOT be used.
- Loops over unbounded storage MUST NOT be used.
- Every state change MUST emit an event.
- Caller-supplied weights, scores or amounts MUST NOT be trusted; derive them onchain.
- One-time setters MUST be protected: wire dependencies in the constructor or restrict setters
  to the deployer.
- Empty or tied outcomes MUST NOT resolve to a positive result.

### V. Claims Must Match Code
The pitch, UI and docs MAY only describe mechanisms that exist in the deployed contract.
Anything else MUST be labeled "roadmap".

### VI. Monad-Aware
Deployment targets the Monad testnet (chain ID 10143) only. Gas limits MUST be set realistically,
because Monad charges the gas limit, not the gas used.

### VII. The Demo Must Show Speed
The demo MUST include at least one moment that makes Monad's speed visible, for example
registering or attesting many items live.

## Scope & Stack

**In scope: `ContentRegistry`**
- `register(bytes32 hash, string uri, Kind kind)`: author set once and immutable; duplicate
  hash reverts; creates version 0.
- `update(uint256 id, bytes32 newHash, string newUri)`: author only; appends a version
  (append-only history); a reused hash reverts.
- `attest(uint256 id, uint256 version, bool supports)`: one vote per wallet per version of a
  content; increments that version's raw `attestCount` / `disputeCount`; a new version starts
  at 0/0; no weights; a nonexistent id or version reverts.
- `lookup(bytes32 hash)`: returns whether a fingerprint is registered and, if so, its content id
  and version (used by the check feature).
- Getters: `latestHash`, `versionCount`, `getVersion` (including that version's counts),
  `getContent` (author, kind, version count) and `hasVoted`.
- Frontend: register (paste text or upload an image, hash in the browser with `crypto.subtle`
  SHA-256, submit with a plain URL); detail view with version timeline and counts; a Check (verify)
  button, labeled "Check against registry" in the UI, that re-hashes content and compares it with the onchain hash.

**Out of scope (roadmap, pitch-only):** `ReputationRegistry`, `ValidationMarket`, weighted
voting, staking and slashing, commit-reveal, dispute courts, perceptual hashing and C2PA, IPFS,
co-authors/derivatives/royalties, gasless onboarding, mainnet. Raw counts are used because,
without real stake, consensus voting only measures who controls the most wallets.

**Resolved decisions:** information types are articles and images (`enum Kind { Article,
Image }`); anyone with a wallet can attest; the primary user is the creator and the secondary
user is the reader; SHA-256 is computed client-side and the contract stores `bytes32` without
recomputing; off-chain storage is a plain URL.

**Stack (do not migrate):** Solidity ^0.8.24 with Hardhat (`hardhat.config.ts` set to chain ID
10143 and `testnet-rpc.monad.xyz`); deploy via `scripts/deploy.ts`, replacing `Greeter.sol`;
React + TypeScript + Vite + ethers + MetaMask, reusing wallet-connect and network-switch code
in `App.tsx` and updating the ABI and address in `config.ts`; hosting on Vercel.

**Known weaknesses accepted and stated openly in the pitch:**

| Weakness | Why accepted | Roadmap fix |
|---|---|---|
| Sybil attestations | No stake in the MVP; counts labeled raw | Stake-weighted votes, proof-of-personhood |
| Front-running `register` | Needs commit-reveal or signatures | Commit-reveal registration |
| Off-chain plagiarism before registration | Chain can't see off-chain history | pHash / text similarity feeding disputes |
| Image byte-hash breaks on resize/re-encode | MVP answers "is this the exact file?" | Perceptual hashing |
| Reverted edit can't reuse an old hash | Side effect of duplicate-hash guard | Let an id reuse its own hashes |

Pitch line: "We make provenance tamper-evident and edit history immutable. Community trust signals
are transparent, and our roadmap makes false validation economically irrational."

## Development Workflow

**AI pair-programming rules**
1. AI MAY write the contract and its tests. A human MUST review the contract before it is
   deployed. AI MUST deliver documentation (`docs/PROJECT.md`) that explains the whole project and
   the contract function by function and line by line, so the team can study and be able to
   explain it after the fact. The design doc's Solidity remains reference only.
2. AI MAY generate frontend boilerplate, UI, styling and deploy scripts.
3. Spec phases (constitution → specify → clarify → plan → tasks → analyze) are capped at 45
   minutes total. `/speckit.implement` MAY run all tasks, including contract tasks.
4. Tests come before deploy. Each contract function MUST have at least one passing test and one
   revert test (duplicate hash, non-author update, double attest on the same version, nonexistent
   id or version).
5. New dependencies or features MUST have team approval.
6. Unclear AI output MUST be questioned ("why") before acceptance; if still unclear, it MUST
   NOT be merged.
7. AI-generated Solidity MUST be reviewed for reentrancy, missing `require`s, unbounded loops,
   caller-controlled values, unprotected setters and wrong visibility.

**Definition of done (demo-ready)**
- `ContentRegistry` deployed and verified on the Monad testnet explorer.
- All tests from rule 4 pass.
- An article and an image register, each confirming in about 1 second.
- Update shows a v0 → v1 timeline with timestamps.
- The Check (verify) button shows a match for unchanged content and "no match" for modified content.
- Attest and dispute work per version, counts update live, a double vote on the same version
  reverts, and a new version can be voted on again.
- The pitch states the known weaknesses and the roadmap.
- A 2-minute demo script is rehearsed once.
- `docs/PROJECT.md` explains the whole project and the contract (see AI rule 1).

**Time budget:** Spec Kit phases 0:45; contract + tests + docs 1:30; deploy + verify 0:20; frontend
1:45; integration + bug fixing 0:50; demo + pitch prep 0:30. If a block runs more than 30
minutes over, scope is cut in this order: image support → `update` → speed demo. Tests and the
Check (verify) button MUST NEVER be cut.

## Governance

This constitution supersedes other practices. Amendments require team approval, a documented
rationale, and a version bump under semantic versioning: MAJOR for removed or redefined
principles, MINOR for added principles or materially expanded guidance, PATCH for
clarifications. Specs, plans and PRs MUST be checked for compliance with the principles above,
and any deviation MUST be justified in writing and approved by the team.

**Version**: 1.2.0 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
