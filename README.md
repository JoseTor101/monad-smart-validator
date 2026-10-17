# SmartValidator — content provenance on Monad

SmartValidator is a content-provenance platform on the **Monad** blockchain.
Creators register articles and images; the app seals a tamper-evident
fingerprint (hash), author, and timestamp on-chain, tracks every edit as an
append-only version history, and lets the community **stake to validate**
whether a piece is original — with a dispute/escalation path.

- **Contracts:** Solidity 0.8.24, Hardhat, deployed to Monad testnet.
- **Frontend:** React + TypeScript + Vite, `ethers` for chain access, `motion`
  for animation, deployed to Cloudflare Pages.
- **Storage:** content files + metadata live in Cloudflare R2 (off-chain);
  only the hash + a pointer are recorded on-chain.

---

## How it works

1. **Register** — the browser hashes your article text or image (SHA-256),
   uploads the file and a small metadata JSON (title, field) to R2, then records
   `register(hash, uri, kind)` on-chain. One wallet transaction; the content
   itself stays off-chain.
2. **Discover / Timeline** — browse registered pieces, read the actual content,
   and re-hash it in the browser to verify it matches the on-chain fingerprint.
3. **Validate** — open a commit–reveal round on a piece, stake MON on
   original / not-original, reveal, then resolve. Majority by staked weight
   wins; the losing side is slashed into the winners' reward pool.
4. **Reputation** — resolving a round adjusts each voter's reputation, scoped to
   the content's field. Reputation never transfers between fields.
5. **Dispute** — any resolved round can be challenged within a window, opening
   an escalated round at double the minimum stake.

---

## Smart contracts

Three contracts in `contracts/`, wired together at deploy time.

### `ContentRegistry.sol`
On-chain provenance and tamper-evident edit history. Stores only hashes +
metadata; the bytes live off-chain, addressed by `uri`.

- `register(hash, uri, kind)` — register original content. Reverts on a
  duplicate hash (same bytes can't be registered twice).
- `registerDerivative(hash, uri, kind, parentId)` — declare a fork/remix of an
  existing piece, building a provenance graph instead of hiding copies.
- `update(id, newHash, newUri)` — append a new version (author-only,
  append-only; old versions are never mutated).
- Views: `getContent`, `getVersion`, `versionCount`, `authorOf`, `latestHash`,
  `isRegistered`, `nextId`.
- Guarantees: author set once and never changed; append-only history; duplicate
  guard; derivative tracking.

### `ReputationRegistry.sol`
Per-field reputation for validators.

- `reputationOf(topic, who)` / `weightOf(topic, who)` — read a score (weight
  clamps negatives to 0). Scores are **per topic** (e.g. keccak256("journalism")),
  so trust earned in one field doesn't apply to another.
- `adjust(topic, who, delta)` — **market-only**; the only caller allowed to move
  reputation is the wired `ValidationMarket`.
- `setMarket(market)` — set once at deploy, immutable after (no admin backdoor
  to rewrite scores later).

### `ValidationMarket.sol`
Peer validation via staked, commit–reveal voting with slashing and disputes.

- `openRound(contentId, topic, commitWindow, revealWindow, minStake)` — start a
  round (the content's author cannot open one on their own piece).
- `commitVote(roundId, commitment)` *(payable)* — stake MON and submit a hashed
  vote (`keccak256(abi.encode(choice, salt, voter))`), hidden until reveal.
- `revealVote(roundId, choice, salt)` — reveal the vote during the reveal window;
  unrevealed stakes are forfeited.
- `resolve(roundId)` — after the reveal window, tally by staked weight, slash the
  losing side into the winners' pool, and adjust reputation. Anyone may call.
- `withdraw(roundId)` — pull-based payout: winners reclaim stake + a
  proportional share of the slashed pool.
- `dispute(roundId, commitment, commitWindow, revealWindow)` *(payable)* —
  challenge a resolved round within the dispute window, escalating to a fresh
  round at double the minimum stake.
- Threat model: Sybil resistance (weight = staked MON, not wallet count),
  commit–reveal to block herding/bribery, slashing to punish lying, escalation
  so decisions are reversible, reentrancy guard + checks-effects-interactions on
  every ETH-moving function.

---

## Deployed addresses (Monad testnet)

Set in `frontend/src/config.ts`:

| Contract | Address |
|----------|---------|
| ContentRegistry | `0xDcCB43d8Afad06615FBd1A5c2AB6525e113Bd2A5` |
| ReputationRegistry | `0xd270d7BA694b33e58483bD60057675FC39E9964D` |
| ValidationMarket | `0x0777e7d871462b394fe94eAbDa5BA8ab40179A9D` |

---

## Current project state

**Working**
- All three contracts deployed and wired on Monad testnet.
- Frontend live on Cloudflare Pages (auto-deploys on push to `main`).
- Register: in-browser hashing, R2 upload of content + metadata, on-chain
  registration, duplicate-guard messaging.
- Timeline & Profile read live on-chain data (registrations, per-field
  reputation) with retry + bounded concurrency against the public RPC.
- Content detail view: renders the stored article/image and re-hashes it to
  verify integrity against the chain.
- Validation: full commit → reveal → resolve → withdraw flow against
  `ValidationMarket`, with a dispute path; Timeline seals and Profile reputation
  reflect real round outcomes and refresh after actions.
- Wallet connect persists across reloads; explicit disconnect.

**Known limitations / follow-ups**
- Reputation only moves after a round is **resolved**, and accrues to the
  **voters** in that round (the author can't self-validate).
- Validation/dispute counters aren't shown because the contracts expose them
  only as events (would need indexing).
- Content registered against a *local* R2 bucket during development won't load
  in production (its objects aren't in the real bucket).
- The public Monad testnet RPC can rate-limit under load; a dedicated RPC would
  make reads more reliable.
- Per-IP upload rate limiting on the R2 Function is a pending hardening step.

---

## Running it

### Prerequisites
- [Node.js](https://nodejs.org) 18+
- [MetaMask](https://metamask.io)
- Testnet **MON** from the [Monad faucet](https://faucet.monad.xyz)

### Contracts

From the project root:

```bash
npm install
npm run compile
# Copy .env.example to .env and add a throwaway wallet's PRIVATE_KEY
npm run deploy          # deploys all three contracts + wires them
```

Paste the printed addresses into `frontend/src/config.ts`.

### Frontend

```bash
cd frontend
npm install
npm run dev             # UI only (http://localhost:5173) — no R2 uploads here
```

R2 uploads run through a Cloudflare Pages Function, which `vite dev` does not
serve. To exercise the full flow (uploads + content reads) locally:

```bash
cd frontend
npx wrangler login
npm run preview:pages   # builds + serves on http://localhost:8788 with R2 bound
```

See [`.github/DEPLOYMENT.md`](.github/DEPLOYMENT.md) for Cloudflare Pages + R2
setup (bucket, binding, public access).

---

## Project structure

```
monad-hackaton/
├─ contracts/
│  ├─ ContentRegistry.sol       # provenance + version history
│  ├─ ReputationRegistry.sol    # per-field validator reputation
│  └─ ValidationMarket.sol      # commit–reveal staked validation + disputes
├─ scripts/deploy.ts            # deploys + wires all three to Monad testnet
├─ hardhat.config.ts            # Hardhat config (Monad testnet)
├─ .github/DEPLOYMENT.md        # Cloudflare Pages + R2 setup
└─ frontend/
   ├─ functions/
   │  ├─ api/upload.ts          # R2 upload (Pages Function)
   │  └─ content/[[path]].ts    # serve R2 objects same-origin
   └─ src/
      ├─ App.tsx                # shell, routing, validate modal
      ├─ web3.ts                # chain reads/writes, hashing, uploads
      ├─ config.ts              # contract addresses + ABIs + network
      ├─ components.tsx         # fingerprint, seal, reputation meter, avatar
      └─ views/                 # Discovery, Timeline, Register, Profile, ContentView
```

---

## Monad testnet reference

| Field | Value |
|-------|-------|
| Network name | Monad Testnet |
| Chain ID | 10143 |
| RPC URL | https://testnet-rpc.monad.xyz |
| Currency | MON |
| Faucet | https://faucet.monad.xyz |

Facts sourced from the [Monad documentation](https://docs.monad.xyz). Content
was rephrased for compliance with licensing restrictions.
