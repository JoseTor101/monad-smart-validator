# Runbook: review, deploy, verify, demo (T025, T031, T032–T034)

Order matters: **T025 → T032 → T033 → T031 → T034**. Check each box before moving on.
Terminal commands run from the repo root unless noted. If `npx` is not found, run
`export PATH=~/.nvm/versions/node/v20.18.0/bin:$PATH` first.

---

## Step 0. Prerequisites (10 min)

- [ ] MetaMask installed, with a **throwaway** wallet (never your real one).
- [ ] Get testnet MON from https://faucet.monad.xyz for that wallet. You need a little for the deploy and for the walkthrough.
- [ ] A **second** and **third** MetaMask account, each with a little MON (for the vote and non-author checks). Faucet each one.
- [ ] `cp .env.example .env`, then set `PRIVATE_KEY=` to the throwaway wallet's key (MetaMask → Account details → Show private key). `.env` is git-ignored; never commit it.
- [ ] `npm install` at the root and `cd frontend && npm install`.
- [ ] `npx hardhat test` shows 17 passing.

---

## T025. Human review of the contract (30–40 min)

Open `contracts/ContentRegistry.sol` next to `docs/PROJECT.md` part 2. For each item, find the line(s) and tick it. If you can't explain a line, ask before deploying.

- [ ] **Core functions ≤ 4:** only `register`, `update`, `attest`, `lookup` are core. The rest are plain getters.
- [ ] **No `tx.origin`:** search the file for `tx.origin`. Expect 0 hits.
- [ ] **No randomness or time tricks:** the only use of block data is `block.timestamp` for the record time.
- [ ] **Reentrancy:** search for `call`, `transfer`, `send`, `delegatecall`. Expect 0 hits (no ether, no external calls).
- [ ] **Missing `require`s:** for each write function, list its checks.
  - `register`: hash not zero, hash unused, link 1–512 bytes.
  - `update`: content exists, caller is author, hash zero/unused, link valid.
  - `attest`: content exists, version exists, not voted yet.
- [ ] **Unbounded loops:** search for `for` and `while`. Expect 0 hits.
- [ ] **Caller-controlled values:** the caller supplies only hash, link, kind and vote direction. Id, author, time and counts come from the contract.
- [ ] **Unprotected setters:** there are no setters, owner or admin functions.
- [ ] **Visibility:** state variables `private`; functions `external`, `view` or `private`; nothing `public` that should be hidden.
- [ ] **Events:** every state change emits an event (`Registered`, `Updated`, `Attested`).
- [ ] **Explain-out-loud test:** explain to a teammate what `_hashRef` does and why a hash can never appear twice (see part 2.2 and 2.8 of `docs/PROJECT.md`).
- [ ] Tick **T025** in `specs/001-content-provenance-registry/tasks.md` (change `[ ]` to `[X]`).

Optional extra: `npx hardhat compile` shows no warnings.

---

## T032. Deploy and verify the contract (15–20 min)

1. [ ] Confirm the wallet has MON on Monad testnet (chain ID 10143).
2. [ ] Deploy:
   ```bash
   npm run deploy
   ```
   Expected: `ContentRegistry deployed to: 0x...`. **Copy the address.**
3. [ ] Open `https://testnet.monadexplorer.com/address/<your address>` and confirm the contract and its creation transaction exist.
4. [ ] Verify the source on the explorer. Use the explorer's "Verify contract" page with:
   - compiler 0.8.24, optimizer enabled, 200 runs, EVM target `paris`;
   - the file `contracts/ContentRegistry.sol`;
   - no constructor arguments.
   
   If the explorer's form is unclear, check https://docs.monad.xyz for the current verification instructions, or use the explorer's "flattened source" option (`npx hardhat flatten contracts/ContentRegistry.sol`).
5. [ ] Tick **T032**.

If the deploy fails: check `.env` has the key, the wallet has MON, and `hardhat.config.ts` still points to `https://testnet-rpc.monad.xyz`.

---

## T033. Wire the address and run the walkthrough (30 min)

1. [ ] Paste the address into `CONTRACT_ADDRESS` in `frontend/src/config.ts`.
2. [ ] Start the UI: `cd frontend && npm run dev`, open the printed URL (usually http://localhost:5173).
3. [ ] **Connect Wallet** with account A. The wallet switches to Monad testnet; no "wrong network" or "address not set" banner shows.
4. [ ] Walk through `specs/001-content-provenance-registry/quickstart.md` section 3:
   1. Register an article (with a link). Expect confirmation in about 1–2 s and a record page.
   2. Register the same text again, then with extra spaces or a different line ending. Expect "Hash already registered".
   3. Register an image. Check the same file on the Check tab. Expect **Unchanged**.
   4. Check a copy of the article with one character changed. Expect **No registered record**.
   5. As account A, publish a new version of the article. The timeline shows version 1 and 2 with times.
   6. Switch to account B: the "publish a new version" box does not appear. (The contract also rejects it.)
   7. Check the **old** text. Expect "Modified (a newer version exists)", that version's counts, and the "newer version exists" note.
   8. With accounts A, B and C: attest and dispute on version 1. Counts update; the buttons disable after voting.
   9. Open version 2: counts are 0 attest / 0 dispute and the same wallets can vote again.
   10. Look at every screen: none says "true", "verified" or "original".
5. [ ] Speed demo: either the **Speed demo** tab (10 items) or
   ```bash
   REGISTRY_ADDRESS=0x... npx hardhat run scripts/demo-burst.ts --network monadTestnet
   ```
   Expect 10 registrations confirmed in under 30 s. Note the time shown.
6. [ ] Optional: measure SC-003 by timing "Check against registry" (should be under 10 s).
7. [ ] Tick **T033**. If a step fails, note it and fix before continuing.

---

## T031. Manual browser checks (15 min)

Run after T033, with the deployed contract.

- [ ] **Empty text:** Register tab, article empty (or spaces only), a link filled in → "Content is empty".
- [ ] **Empty link:** content filled in, link empty → "A link to where the content can be found is required."
- [ ] **No file:** image mode, no file chosen → "Choose an image file."
- [ ] **Zero-byte file:** an empty file → "Content is empty".
- [ ] **Large file:** a file over 10 MB → "File is larger than 10 MB".
- [ ] **Check without a wallet:** open the app in a browser profile with no MetaMask. The Check tab still works.
- [ ] **Wrong network:** switch MetaMask to another network; the banner appears.
- [ ] **Rejected transaction:** reject a transaction in MetaMask → "Transaction rejected in the wallet."
- [ ] Tick **T031**.

---

## T034. Demo and pitch prep (30 min)

1. [ ] Write a 2-minute demo script with this flow (about 15–20 seconds each):
   1. Problem: "Who published this first, and was it changed?"
   2. **Register** an article live (point out about 1 s confirmation).
   3. **Check** the exact text → "Registered first here by X at T · Unchanged".
   4. **Check** a one-word edit → "No registered record".
   5. **Publish a new version**, then check the old text → "Modified (a newer version exists)".
   6. **Attest / dispute** from two wallets; show raw counts labeled as unweighted community signals.
   7. **Speed demo:** register 10 items; say the time.
2. [ ] Prepare a pitch slide or notes with:
   - "We prove integrity, not truth" (what it proves and does not).
   - The known weaknesses table and roadmap fix for each (from `README.md`).
   - The pitch line: "We make provenance tamper-evident and edit history immutable. Community trust signals are transparent, and our roadmap makes false validation economically irrational."
3. [ ] Prepare before presenting: wallets A, B, C connected, funded, on the right network; a sample article and an image ready; the contract address and explorer link; a pre-registered record as a fallback if the network is slow.
4. [ ] **Rehearse once** with a timer. Cut anything that runs over 2 minutes (the cut order is: image support → update → speed demo; never the Check button).
5. [ ] Tick **T034**.

---

## Finish

- [ ] Final check: `npx hardhat test` passes and `cd frontend && npm run build` succeeds.
- [ ] Definition of done in `constitution.md` section 8 is fully ticked.
- [ ] Commit (never commit `.env`), then deploy the frontend to Vercel if you want a public link (set the project root to `frontend/`, build command `npm run build`, output `dist`).
