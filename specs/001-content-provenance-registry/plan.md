# Implementation Plan: Content Provenance Registry

**Branch**: `001-content-provenance-registry` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-content-provenance-registry/spec.md`

## Summary

A single Solidity contract, `ContentRegistry`, on Monad testnet stores a SHA-256 fingerprint, a
permanent author and an append-only version list per content, plus per-version raw attest/dispute
counts. A React frontend hashes content in the browser (text is normalized first), submits it,
and lets any reader verify content against the registry and see a version timeline. The contract
is AI-written, human-reviewed before deploy, and tested; the frontend builds on the existing starter.

## Technical Context

**Language/Version**: Solidity ^0.8.24 (contract); TypeScript 5.5 (tests, scripts, frontend)

**Primary Dependencies**: Hardhat + hardhat-toolbox (chai, ethers v6); frontend React 18, Vite 5, ethers 6, MetaMask. No new dependencies.

**Storage**: Onchain contract storage only (hashes, URIs, counts). No backend or database.

**Testing**: Hardhat tests (`test/ContentRegistry.ts`), one happy-path and one revert test per function. Frontend verified by the quickstart walkthrough.

**Target Platform**: Monad testnet (chain ID 10143); static frontend on Vercel.

**Project Type**: Web application (smart contract + SPA, no server).

**Performance Goals**: Transactions confirm in about 1 s; verify result under 10 s; demo burst of 10 items under 30 s.

**Constraints**: Monad charges the gas limit, so explicit gas limits are set per call. No unbounded storage loops onchain. URI length capped (512 bytes). Image upload capped at 10 MB in the browser.

**Scale/Scope**: Hackathon MVP; 3 user stories, 1 contract, 3 screens (register, verify, detail).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Integrity, not truth | Pass | The UI label "Check against registry" is the constitution's Check (verify) button. Result statuses are "Registered first here by X at T", "Unchanged", "Modified", "N attest / M dispute". No "TRUE/VERIFIED/ORIGINAL" copy. The button is "Check against registry". |
| II. Hash only | Pass | Contract stores `bytes32`, a URI and the kind. Content never leaves the browser. |
| III. Simplicity | Pass | One contract; 3 state-changing functions (`register`, `update`, `attest`) plus 1 core lookup (`lookup`) = 4. Other getters are plain views. |
| IV. Security basics | Pass | `require` everywhere incl. existence checks; no loops over storage; no `tx.origin`; events on every change; counts derived onchain; no setters or owner; no tallies that resolve positively. |
| V. Claims match code | Pass | UI/docs describe only implemented behavior; roadmap items labeled. |
| VI. Monad-aware | Pass | Hardhat network `monadTestnet` only; explicit gas limits. |
| VII. Demo shows speed | Pass | Demo burst script/button registers N items live (frontend/scripts only, no contract change). |
| AI rules | Pass | AI may write the contract; human review (T025) before deploy; `docs/PROJECT.md` documents it. Tests precede deploy. |

Post-design re-check: pass (see data-model.md and contracts/). No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-content-provenance-registry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ContentRegistry.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
contracts/
└── ContentRegistry.sol          # replaces Greeter.sol 

test/
└── ContentRegistry.ts           # happy + revert tests

scripts/
├── deploy.ts                    # updated to deploy ContentRegistry
└── demo-burst.ts                # registers N items for the speed demo

frontend/src/
├── App.tsx                      # wallet connect + network switch (kept), tab layout
├── config.ts                    # address + ABI updated
├── lib/
│   ├── hash.ts                  # normalize text, SHA-256 via crypto.subtle
│   └── registry.ts              # read/write wrappers around the contract
└── components/
    ├── RegisterForm.tsx
    ├── CheckForm.tsx            # verify: submit content, show status
    └── ContentDetail.tsx        # timeline + per-version counts + attest/dispute
```

**Structure Decision**: Keep the existing starter layout (root Hardhat project plus `frontend/`); add `test/` and a few frontend files. No backend.

## Complexity Tracking

No violations to justify.
