---

description: "Task list for Content Provenance Registry"
---

# Tasks: Content Provenance Registry

**Input**: Design documents from `/specs/001-content-provenance-registry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ContentRegistry.md

**Tests**: Required by the constitution (AI rule 4): every contract function has a passing test and a revert test before deploy.

**Organization**: Grouped by user story. Constitution v1.2.0: AI may write the contract and tests; a human reviews the contract before deploy (T025) and AI delivers documentation (T035).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3

## Phase 1: Setup

- [X] T002 [P] Create empty `test/ContentRegistry.ts` with the Hardhat/chai/ethers test harness and a deploy fixture
- [X] T003 [P] Create `frontend/src/lib/` and `frontend/src/components/` directories

---

## Phase 2: Foundational (blocks all stories)

- [X] T004 Create `contracts/ContentRegistry.sol` skeleton: pragma ^0.8.24, `enum Kind { Article, Image }`, structs `Version` and `Content`, mappings (`contents`, `hashRef`, `voted`), `nextId`, events `Registered`/`Updated`/`Attested`, internal URI-validation helper (1..512 bytes), per `data-model.md`
- [X] T005 [P] Update `scripts/deploy.ts` to deploy `ContentRegistry` and print the address
- [X] T006 [P] Implement `frontend/src/lib/hash.ts`: `hashText` (CRLF/CR→LF, trim whole text, UTF-8, SHA-256 via `crypto.subtle`) and `hashFile` (raw bytes, 10 MB cap), returning `0x`-prefixed bytes32 hex; both MUST throw "Content is empty" for text that is empty after trimming and for a zero-byte file
- [X] T007 Update `frontend/src/config.ts`: human-readable ABI per `contracts/ContentRegistry.md` (address is updated after deploy in T033)
- [X] T008 Implement `frontend/src/lib/registry.ts`: read-only provider (RPC, no wallet needed), signer-based writes with explicit `gasLimit`, wrappers for `register`, `update`, `attest`, `lookup`, `getContent`, `getVersion`; reuse wallet-connect and network-switch code from `frontend/src/App.tsx`

**Checkpoint**: skeleton compiles (`npx hardhat compile`), hash helper and registry wrapper exist.

---

## Phase 3: User Story 1 - Register & Verify (P1) 🎯 MVP

**Goal**: Register an article or image; check any content against the registry.

**Independent Test**: Register an article and an image; re-registering is rejected; checking the originals shows author, time and "Unchanged"; an edited copy shows "No registered record".

### Tests (write first, see them fail)

- [X] T009 [US1] In `test/ContentRegistry.ts`: `register` happy path (author, kind, version 0, timestamp, uri, event) and `lookup` returns found/id/version 0
- [X] T010 [US1] In `test/ContentRegistry.ts`: reverts for duplicate hash (same and different sender), zero hash, empty uri, uri > 512 bytes; `getContent`/`getVersion` revert for nonexistent id

### Implementation

- [X] T011 [US1] Implement `register` and views `lookup`, `getContent`, `getVersion`, `versionCount`, `latestHash` in `contracts/ContentRegistry.sol` (checks-effects-interactions, require on every precondition, emit `Registered`)
- [X] T011a [US1] Delete `contracts/Greeter.sol` and remove its references (`frontend/src/config.ts` ABI, any Greeter imports) after `ContentRegistry` compiles (`npx hardhat compile`)
- [X] T012 [P] [US1] Build `frontend/src/components/RegisterForm.tsx`: article textarea or image upload, required URL field, hash in browser, submit, show tx confirmation time and resulting record; show the "Content is empty" error from `hash.ts` and reject empty URL with clear messages
- [X] T013 [P] [US1] Build `frontend/src/components/CheckForm.tsx`: paste text or choose file, no wallet needed, show the "Content is empty" error from `hash.ts` for empty input; show "Registered first here by {author} at {time}" with "Unchanged" / "Modified (newer version exists)" / "No registered record"
- [X] T014 [US1] Update `frontend/src/App.tsx` layout: tabs Register / Check, wallet connect, wrong-network warning; avoid "true/verified/original" wording anywhere

**Checkpoint**: US1 works end to end on a local network and is demoable alone.

---

## Phase 4: User Story 2 - Version History (P2)

**Goal**: Author-only updates; immutable ordered timeline.

**Independent Test**: Register, update twice as author, see 3 versions in order; update from another wallet is rejected; reused hash rejected.

### Tests

- [X] T015 [US2] In `test/ContentRegistry.ts`: `update` happy path (version index, timestamp, `latestHash`, `versionCount`, old versions unchanged, `lookup` on old hash returns old version, event)
- [X] T016 [US2] In `test/ContentRegistry.ts`: `update` reverts for non-author, nonexistent id, hash already used by any content or version (incl. own earlier version), zero hash, empty/oversized uri

### Implementation

- [X] T017 [US2] Implement `update` in `contracts/ContentRegistry.sol` (author only, append-only, writes `hashRef`, emit `Updated`)
- [X] T018 [US2] Build `frontend/src/components/ContentDetail.tsx` timeline: every version in order with time, hash (short), link; show update form only to the connected author (new content/file + required URL)
- [X] T019 [US2] Wire `CheckForm.tsx` result and `RegisterForm.tsx` success to open `ContentDetail.tsx`; for an older-version match show "a newer version exists"

**Checkpoint**: US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Attestations (P3)

**Goal**: Per-version attest/dispute, once per wallet per version, raw counts.

**Independent Test**: Three wallets vote on one version (2 attest, 1 dispute); repeat vote rejected; after an update the new version shows 0/0 and wallets can vote again.

### Tests

- [X] T020 [US3] In `test/ContentRegistry.ts`: `attest` happy path for support and dispute (counts, `hasVoted`, event), author may attest own content, voting on a new version after `update` works with counts 0/0 and old counts kept
- [X] T021 [US3] In `test/ContentRegistry.ts`: `attest` reverts for double vote on same version (same or opposite choice), nonexistent id, version out of range

### Implementation

- [X] T022 [US3] Implement `attest` and `hasVoted` in `contracts/ContentRegistry.sol` (per-version voted flag, count increments, emit `Attested`)
- [X] T023 [US3] Extend `frontend/src/components/ContentDetail.tsx`: per-version "{N} attest / {M} dispute — unweighted community signals", Attest and Dispute buttons disabled once voted, clear message on rejected double vote
- [X] T024 [US3] In `CheckForm.tsx` result for an older match, show that version's counts plus the "newer version exists with its own counts" note

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T025 Review `contracts/ContentRegistry.sol` against the constitution checklist: reentrancy, missing `require`s, unbounded loops, caller-controlled values, unprotected setters, visibility; confirm ≤ 4 core functions and no `tx.origin`
- [X] T026 Run `npx hardhat test` and record gas used per function; set the `gasLimit` values in `frontend/src/lib/registry.ts` from them with margin
- [X] T027 [P] Create `scripts/demo-burst.ts`: send 10 `register` transactions with sequential nonces on `monadTestnet`, print per-tx and total confirmation time
- [X] T028 [P] Add an optional "Demo burst" button in the frontend that registers N generated items and shows timings (speed demo, Principle VII)
- [X] T029 [P] Audit all UI strings and docs for "true", "verified", "original" as fact claims; add the "unweighted community signals" label and a short roadmap note for out-of-scope items
- [X] T030 [P] Update `README.md` with run/test/deploy steps and the known weaknesses table
- [ ] T031 Add image size cap (10 MB) and URL/ empty-content error messages tests in the browser per `quickstart.md`
- [ ] T032 Deploy: `npm run deploy` to Monad testnet, verify the contract on the explorer
- [ ] T033 Set the deployed address in `frontend/src/config.ts`, run the full `quickstart.md` walkthrough and demo burst, deploy frontend to Vercel
- [X] T035 Write `docs/PROJECT.md`: explain the whole project (purpose, architecture, user flows, frontend, scripts, how to run) and the contract (state, each function line by line, events, security reasoning, tests, known weaknesses, glossary)
- [ ] T034 Rehearse the 2-minute demo script once; prepare pitch slide with known weaknesses and roadmap

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories. T011a (delete `Greeter.sol`) waits for T011.
- US1 (Phase 3) is the MVP. US2 and US3 depend on the contract file from US1 (same file, so contract tasks run sequentially: T011 → T017 → T022) but their frontend parts only need the Phase 2 wrappers.
- Within a story: tests (fail first) → contract → frontend.
- Polish after the stories you keep. T032 requires T025, T026 and all tests passing.

## Parallel Opportunities

- T002, T003; T005, T006 (after T004 for T005).
- US1: T012 and T013 in parallel.
- Frontend work for US2/US3 can proceed in parallel with contract work once the ABI in T007 is stable.
- T027–T030 in parallel.

## Implementation Strategy

1. MVP: Phases 1–3, deploy, demo register + check.
2. Add US2, then US3, re-testing each.
3. If time runs over by more than 30 minutes, cut per the constitution: image support → `update` → speed demo. Never cut tests or the check button.
4.  (frontend, scripts, deploy).
