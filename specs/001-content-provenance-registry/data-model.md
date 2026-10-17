# Data Model: Content Provenance Registry

## Content (per id, ids start at 1)
| Field | Notes |
|---|---|
| author | address, set at register, never changes (FR-004) |
| kind | enum `Article` / `Image` |
| versionCount | number of versions, ≥ 1 |

## Version (per id, index 0..versionCount-1)
| Field | Notes |
|---|---|
| hash | bytes32 SHA-256, non-zero, globally unique across all versions of all content |
| uri | string, 1..512 bytes, required |
| timestamp | block time when appended |
| attestCount / disputeCount | raw counts, start 0/0 |

Immutable apart from counts growing. Version 0 is created by `register`; `update` appends.

## Index and votes
- `hashRef[hash] → (id, version)`; exists iff `id != 0`.
- `voted[id][version][wallet] → bool`.

## Rules (map to spec)
- register: hash not known (FR-003), uri valid (FR-001b); creates id and version 0; sender becomes author.
- update: id exists; sender == author (FR-006); hash not known (FR-008); uri valid; appends.
- attest: id exists, version < versionCount; wallet not yet voted on that version (FR-010, FR-011); increments one count.
- Registration time = version 0 timestamp.

## State transitions
Content: Registered → (update)* . No deletion. A version only gains votes.

## Events
- `Registered(id, author, hash, kind, uri)`
- `Updated(id, version, hash, uri)`
- `Attested(id, version, voter, supports)`
