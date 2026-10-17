# Research: Content Provenance Registry

No NEEDS CLARIFICATION items remained; these are the design decisions taken.

## Fingerprint lookup for verification
- **Decision**: `mapping(bytes32 => Ref)` from fingerprint to (content id, version index), written on `register` and `update`. `lookup(hash)` returns it.
- **Rationale**: Verify needs "which record has this hash" without looping. This same map enforces FR-003 and FR-008 (any known hash reverts).
- **Alternatives**: Scan events off-chain (slow, needs indexer); scan versions onchain (unbounded loop, forbidden).

## Status wording
- **Decision**: matched version is the latest → "Unchanged"; matched earlier version → "Modified" (a newer version exists); no match → "No registered record".
- **Rationale**: Matches spec FR-005 and avoids saying "false".

## Text normalization
- **Decision**: In the browser, convert `\r\n`/`\r` to `\n`, trim leading/trailing whitespace of the whole text, UTF-8 encode, SHA-256. Images: SHA-256 of raw bytes.
- **Rationale**: FR-001a. Done in one shared function used by both register and check.
- **Alternatives**: Exact bytes only (rejected by clarification).

## Per-version attestations
- **Decision**: `attest(id, version, supports)`; voted flag keyed by (id, version, voter); counts stored on the version.
- **Rationale**: Clarified: votes belong to a version; new version starts 0/0. Constitution amended to v1.1.0.

## Bounded inputs
- **Decision**: URI must be non-empty and at most 512 bytes; hash must be non-zero; image ≤ 10 MB (client check).
- **Rationale**: Required link (FR-001b); bounded storage and predictable gas on Monad.

## Gas limits
- **Decision**: Set explicit `gasLimit` on each write from the frontend (measured in tests with some margin).
- **Rationale**: Monad charges the gas limit, not usage; estimates left to default can overpay.

## Speed demo
- **Decision**: `scripts/demo-burst.ts` sends N `register` transactions with explicit sequential nonces and prints confirm times; same idea available as a frontend button.
- **Rationale**: Principle VII without touching the contract.

## Testing
- **Decision**: Hardhat + chai tests on the in-process network; no new dependencies.
