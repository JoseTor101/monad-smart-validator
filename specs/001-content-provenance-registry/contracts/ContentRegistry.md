# Contract Interface: ContentRegistry

Public interface of the onchain contract; the frontend ABI in `frontend/src/config.ts` mirrors it.
The Solidity itself is written by hand (constitution, AI rule 1).

## Types
`enum Kind { Article, Image }`

## State-changing
| Function | Reverts when |
|---|---|
| `register(bytes32 hash, string uri, Kind kind) returns (uint256 id)` | hash is zero or already known; uri empty or > 512 bytes |
| `update(uint256 id, bytes32 newHash, string newUri) returns (uint256 version)` | id does not exist; caller ≠ author; hash zero or already known; uri empty or > 512 bytes |
| `attest(uint256 id, uint256 version, bool support)` | id does not exist; version out of range; caller already voted on that version |

## Views
| Function | Returns |
|---|---|
| `lookup(bytes32 hash)` | `(bool found, uint256 id, uint256 version)` |
| `getContent(uint256 id)` | `(address author, Kind kind, uint256 versionCount)`; reverts if id missing |
| `getVersion(uint256 id, uint256 version)` | `(bytes32 hash, string uri, uint64 timestamp, uint32 attestCount, uint32 disputeCount)` |
| `versionCount(uint256 id)` | number of versions |
| `latestHash(uint256 id)` | hash of the latest version |
| `hasVoted(uint256 id, uint256 version, address who)` | bool |

## Events
`Registered(uint256 indexed id, address indexed author, bytes32 hash, Kind kind, string uri)`
`Updated(uint256 indexed id, uint256 version, bytes32 hash, string uri)`
`Attested(uint256 indexed id, uint256 version, address indexed voter, bool support)`

## UI contract (what readers see)
- Check result: "Registered first here by {author} at {time} · Unchanged" / "Modified (newer version exists)" / "No registered record". For an older match: that version's counts plus "a newer version exists with its own counts".
- Counts: "{N} attest / {M} dispute — unweighted community signals".
- Forbidden wording: "true", "verified", "original" as a fact.
