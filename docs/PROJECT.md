# Content Provenance Registry: Project and Contract Guide

This guide explains the whole project and the smart contract, so the team can study it, review it, and explain it out loud. It follows the constitution (AI rule 1). Read part 1 for the big picture, part 2 for the contract, then parts 3–6 for the frontend, tests, how to run it, and a glossary.

---

## Part 1. The project

### 1.1 What it does
Creators register an article (text) or an image onchain. The chain records:
- a **fingerprint** of the content (a SHA-256 hash),
- the **author** (the wallet that registered it, permanent),
- the **time**,
- every **version** the author later publishes,
- how many wallets **attested** or **disputed** each version.

Anyone can paste content (or pick a file) and **check** whether it matches a registered record: who registered it first, when, and whether it is the latest version ("Unchanged") or an older one ("Modified: a newer version exists").

### 1.2 What it proves, and what it does not
It proves **integrity**: this exact content existed at this time and was registered by this wallet; its history has not been rewritten. It does **not** prove that content is accurate. That is why the interface never says "true", "verified" or "original". Votes are raw counts ("N attest / M dispute") labeled as unweighted community signals. This is constitution Principle I.

### 1.3 Why only a hash goes onchain
A SHA-256 hash is a short fixed-size fingerprint of any content. If one character changes, the hash changes completely. The chain stores the hash and a link, never the content (Principle II). The hash is computed in your browser, so the content never leaves your device. The contract does not recompute hashes; it trusts the caller to send the right one, which is fine because the point is a public, timestamped claim "wallet X registered fingerprint H first".

### 1.4 Architecture

```
Browser (React + ethers)                    Monad testnet (chain 10143)
┌────────────────────────────┐              ┌─────────────────────────────┐
│ hash.ts   SHA-256 in browser│   reads     │ ContentRegistry (Solidity)  │
│ registry.ts  contract calls ├────────────►│  - contents (versions,votes)│
│ Check / Register / Record   │  via RPC    │  - fingerprint → (id,ver)   │
│ Speed demo                  │  writes     │  - events                    │
│ MetaMask signs transactions ├────────────►│                              │
└────────────────────────────┘  via wallet  └─────────────────────────────┘
```

No server and no database. Reads go straight to the public RPC (so checking needs no wallet). Writes are transactions signed in MetaMask.

### 1.5 The three user stories
1. **Register & check (P1):** register content; identical content cannot be registered twice; anyone can check content against the registry.
2. **Version history (P2):** only the author can add a new version; versions are append-only and ordered; readers see the timeline.
3. **Attestations (P3):** any wallet can attest or dispute, once per version. A new version starts at 0/0 votes.

The full requirements are in `specs/001-content-provenance-registry/spec.md`.

### 1.6 Rules and trade-offs (constitution)
- One contract, at most 4 core functions: `register`, `update`, `attest`, `lookup`. Plain read-only getters do not count.
- Security basics: `require` for every precondition, no loops over storage, no `tx.origin`, events on every state change, no admin or setters.
- Monad charges the **gas limit**, not gas used, so the frontend sets an explicit limit per transaction.
- Known weaknesses we accept and state openly: Sybil attestations (one person, many wallets), front-running of `register`, off-chain plagiarism before registration, image hashes break on resize, an edit cannot go back to an older hash.

---

## Part 2. The contract, line by line

File: `contracts/ContentRegistry.sol`. Solidity ^0.8.24.

### 2.1 Header and types

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
```
The license tag, then the compiler version range. Solidity 0.8+ automatically reverts on integer overflow.

```solidity
contract ContentRegistry {
    enum Kind { Article, Image }
```
An `enum` is a named list stored as a small number: `Article = 0`, `Image = 1`. That is why the frontend passes `0` or `1`.

```solidity
    struct Version {
        bytes32 hash;
        string uri;
        uint64 timestamp;
        uint32 attestCount;
        uint32 disputeCount;
    }
```
One entry in a content's history. `bytes32` is exactly 32 bytes, the size of a SHA-256 hash. `uri` is the link. `timestamp` is when the version was added (seconds since 1970). The two counters hold the raw votes for this version only. `uint32` and `uint64` are smaller number types that pack together to save storage cost.

```solidity
    struct Content {
        address author;
        Kind kind;
        Version[] versions;
    }
```
A registered piece of content: its permanent author, its kind, and a growing list of versions. `address` is a wallet address. `Version[]` is a dynamic array; the first element (index 0) is the original registration.

```solidity
    struct Ref {
        uint256 id;
        uint256 version;
    }
```
A pointer: "this fingerprint belongs to content `id`, version `version`". If `id == 0`, the fingerprint is not registered (real ids start at 1).

### 2.2 State

```solidity
    uint256 public constant MAX_URI_BYTES = 512;
    uint256 private _lastId;
    mapping(uint256 => Content) private _contents;
    mapping(bytes32 => Ref) private _hashRef;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private _voted;
```
- `MAX_URI_BYTES`: the link size cap. A constant costs no storage.
- `_lastId`: the most recently issued content id. The next one is `_lastId + 1`.
- `_contents`: id → content.
- `_hashRef`: fingerprint → where it lives. This is how `lookup` works without looping, and how duplicates are detected. **Every** fingerprint of **every** version of **every** content is in here, so one hash can never appear twice anywhere.
- `_voted`: id → version → wallet → has that wallet voted on that version? It enforces "one vote per wallet per version".
- `private` means other contracts and external callers cannot read the variable directly (the data is still public onchain; readers use the view functions).

### 2.3 Events

```solidity
    event Registered(uint256 indexed id, address indexed author, bytes32 hash, Kind kind, string uri);
    event Updated(uint256 indexed id, uint256 version, bytes32 hash, string uri);
    event Attested(uint256 indexed id, uint256 version, address indexed voter, bool support);
```
Events are logs written to the chain on every state change (constitution rule). Apps and explorers can search them cheaply. `indexed` fields can be filtered by. The name `support` (not `supports`, which is a reserved word in Solidity) is `true` for attest, `false` for dispute.

### 2.4 `register`

```solidity
function register(bytes32 hash, string calldata uri, Kind kind) external returns (uint256 id) {
    _requireFreshHash(hash);
    _requireValidUri(uri);

    id = ++_lastId;
    Content storage c = _contents[id];
    c.author = msg.sender;
    c.kind = kind;
    c.versions.push(Version(hash, uri, uint64(block.timestamp), 0, 0));
    _hashRef[hash] = Ref(id, 0);

    emit Registered(id, msg.sender, hash, kind, uri);
}
```
- `external`: callable from outside the contract. `calldata`: the string is read directly from the transaction input (cheaper than copying).
- **Checks first:** the two helper calls revert unless the hash is non-zero and unused, and the link is 1–512 bytes.
- **Effects:** `++_lastId` increments and returns the new id. `Content storage c` is a reference to the storage slot for that id (editing `c` edits the chain state). `msg.sender` is the wallet calling: it becomes the permanent author. Nothing in the contract can ever change `author` afterward. `push` appends version 0 with zero votes. `block.timestamp` is the block time. The fingerprint is recorded in `_hashRef`.
- **Interaction:** none. There are no ether transfers or external calls, so reentrancy cannot occur here. The order checks → effects → event is still followed.
- The caller never provides the id, author, time or any count: the contract derives them. This is the "never trust caller-supplied values" rule.

### 2.5 `update`

```solidity
function update(uint256 id, bytes32 newHash, string calldata newUri) external returns (uint256 version) {
    Content storage c = _existing(id);
    require(msg.sender == c.author, "Not the author");
    _requireFreshHash(newHash);
    _requireValidUri(newUri);

    version = c.versions.length;
    c.versions.push(Version(newHash, newUri, uint64(block.timestamp), 0, 0));
    _hashRef[newHash] = Ref(id, version);

    emit Updated(id, version, newHash, newUri);
}
```
- `_existing(id)` reverts if the content does not exist, and returns a storage reference.
- Only the author may update. Everyone else reverts with "Not the author".
- The new fingerprint must be unused anywhere (so an edit cannot be reverted to an older hash, a known and accepted limitation).
- The new version's index is the old length. It is **appended**: no function exists to change or delete a version, which is what makes the history append-only.
- The new version starts with 0 attest / 0 dispute.

### 2.6 `attest`

```solidity
function attest(uint256 id, uint256 version, bool support) external {
    Content storage c = _existing(id);
    require(version < c.versions.length, "Version does not exist");
    require(!_voted[id][version][msg.sender], "Already voted on this version");

    _voted[id][version][msg.sender] = true;
    Version storage v = c.versions[version];
    if (support) { v.attestCount += 1; } else { v.disputeCount += 1; }

    emit Attested(id, version, msg.sender, support);
}
```
- Requires that the content and version exist and the wallet has not voted on **that version** yet.
- Marks the wallet as having voted **before** changing the count (effects, then the event).
- Increments the raw count. There are no weights: a vote is always 1 (Principle IV, no caller-supplied weights).
- A second vote on the same version reverts, whether the same or the opposite choice. A new version is a new ballot.
- The author may attest to their own content. Anyone with a wallet can vote, including many wallets by one person (Sybil, an accepted weakness).

### 2.7 `lookup` and the view functions

```solidity
function lookup(bytes32 hash) external view returns (bool found, uint256 id, uint256 version) {
    Ref memory r = _hashRef[hash];
    return (r.id != 0, r.id, r.version);
}
```
The core of "check": given a fingerprint, return whether it is registered and, if so, its content id and version index. `view` means it only reads (free to call). The frontend decides "Unchanged" (the matched version is the latest) or "Modified" (an earlier version).

Other views:
- `getContent(id)`: author, kind and number of versions. Reverts if the content does not exist.
- `getVersion(id, version)`: hash, link, time and both counts. Reverts for a missing content or version.
- `versionCount(id)`, `latestHash(id)`: convenience getters.
- `hasVoted(id, version, who)`: lets the UI disable the vote buttons after a wallet has voted. It does not revert for missing content; it just returns `false`.

### 2.8 Helpers

```solidity
function _existing(uint256 id) private view returns (Content storage c) {
    c = _contents[id];
    require(c.author != address(0), "Content does not exist");
}
```
A registered content always has a non-zero author, so a zero author means "never registered" (id 0 or beyond the last id).

```solidity
function _requireFreshHash(bytes32 hash) private view {
    require(hash != bytes32(0), "Hash is empty");
    require(_hashRef[hash].id == 0, "Hash already registered");
}
```
A zero hash is rejected. An already-recorded hash is rejected for both `register` and `update`.

```solidity
function _requireValidUri(string calldata uri) private pure {
    uint256 len = bytes(uri).length;
    require(len > 0, "Link is required");
    require(len <= MAX_URI_BYTES, "Link is too long");
}
```
The link is required and capped at 512 bytes, which bounds storage cost and keeps gas predictable on Monad.

### 2.9 What is deliberately missing
No owner, admin, pause, upgrade, setter, delete, withdraw, or payable function. The contract holds no money. No loops over storage. No `tx.origin`, no randomness. That minimizes the attack surface (Principle IV).

### 2.10 Gas
Measured by the test suite: `register` ≈ 185k gas with a short link and ≈ 535k with a 512-byte link; `update` ≈ 145k / 512k; `attest` ≈ 57k. Because Monad charges the gas **limit**, the frontend sets 600k for register/update and 100k for attest (`frontend/src/lib/registry.ts`).

### 2.11 Security notes for the reviewer (constitution AI rule 7)
- Reentrancy: no external calls or transfers, so not possible.
- Missing `require`s: existence, authorship, freshness, link and vote checks are all present; each has a revert test.
- Unbounded loops: none.
- Caller-controlled values: only the fingerprint, link, kind and vote direction come from the caller. Id, author, time and counts are derived.
- Unprotected setters: none exist.
- Visibility: state variables are `private`; functions are `external`/`view`/`private` as appropriate.
- Known limits: front-running a pending `register` to claim "first"; unlimited wallets can vote; a very large `_lastId` is not a concern at this scale.

---

## Part 3. The frontend (`frontend/src`)

| File | Role |
|---|---|
| `config.ts` | Contract address, ABI (list of functions the UI calls) and Monad testnet details. The address is the zero address until you deploy; the UI shows a banner. |
| `lib/hash.ts` | `hashText` normalizes line endings and trims the text, then SHA-256 via `crypto.subtle`; `hashFile` hashes raw bytes (max 10 MB). Both throw "Content is empty" for empty input. |
| `lib/registry.ts` | Talks to the contract: reads via the RPC (no wallet), writes via the signer with explicit gas limits; `checkHash`, `loadContent`, `registerContent`, `updateContent`, `attestVersion`, `registerBurst`. |
| `lib/format.ts` | Short addresses, dates, kind labels. |
| `components/CheckForm.tsx` | "Check against registry": paste text or pick an image, show author, time, Unchanged/Modified, and that version's counts. |
| `components/RegisterForm.tsx` | Register an article or image with a required link. |
| `components/ContentDetail.tsx` | Version timeline, per-version counts, attest/dispute buttons, author-only "publish new version". |
| `components/DemoBurst.tsx` | Registers 10 test items back to back to show Monad's speed. |
| `App.tsx` | Wallet connect, network switch/warning, tab layout. |

**Text normalization:** `\r\n` and `\r` become `\n`, then leading and trailing whitespace is trimmed, so copying text between editors does not change the fingerprint. Any other difference changes it. Images are hashed byte for byte.

**Wording rule:** the button is "Check against registry". Results say "Registered first here by X at T", "Unchanged" or "Modified", and "N attest / M dispute (unweighted community signals)".

---

## Part 4. Tests (`test/ContentRegistry.ts`)

17 tests cover each function with a success case and a revert case:
- `register`: stored data, increasing ids, `lookup`, duplicate hash (same and different wallet), zero hash, empty/oversized link (512 bytes allowed), reads of nonexistent content/versions.
- `update`: appends, keeps old versions and author, order of times, non-author, nonexistent id, hash reuse (including the author's own earlier hash), zero hash and bad links.
- `attest`: counts from several wallets, author can vote, new version starts at 0/0 and the same wallet can vote again, double vote reverts (same or opposite choice), nonexistent id or version.
- A gas report test prints the measurements above.

Run them with `npx hardhat test`.

---

## Part 5. Running and deploying

```bash
npm install && (cd frontend && npm install)
npx hardhat compile
npx hardhat test                 # before any deploy
cp .env.example .env             # add PRIVATE_KEY (throwaway test wallet)
npm run deploy                   # prints the contract address
# paste the address into frontend/src/config.ts
cd frontend && npm run dev
REGISTRY_ADDRESS=0x... npx hardhat run scripts/demo-burst.ts --network monadTestnet
```
Verify the contract on the Monad testnet explorer, then walk through `specs/001-content-provenance-registry/quickstart.md`. Before deploying, a human reviews the contract (task T025).

---

## Part 6. Glossary

- **Hash / fingerprint:** a fixed-size value computed from content; any change gives a different value.
- **SHA-256:** the hash function used here, 32 bytes (`bytes32`).
- **Wallet / address:** an account identified by a public address; it signs transactions (MetaMask).
- **Transaction:** a signed call that changes chain state and costs gas.
- **Gas / gas limit:** the cost of work. Monad charges the limit you set, not what was used.
- **View function:** a read-only function; free to call.
- **Event:** a log written to the chain on a state change.
- **`msg.sender`:** the wallet calling a function.
- **`require`:** a check that cancels (reverts) the whole call with a message if false.
- **Storage:** data kept permanently on the chain.
- **Append-only:** new entries can be added but old ones can never be changed or removed.
- **Sybil attack:** one person using many wallets to look like many people.
- **Front-running:** copying someone's pending transaction to get in first.
- **Attest / dispute:** a vote for or against a version; raw counts, unweighted.
- **Reverted:** a transaction that was cancelled by a failed `require`.
