# Feature Specification: Content Provenance Registry

**Feature Branch**: `001-content-provenance-registry`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Content provenance registry on Monad testnet. P1 – Register & verify; P2 – Version history; P3 – Attestations. Out of scope: reputation, staking, weighted voting, content storage, plagiarism detection, mainnet."

## Clarifications

### Session 2026-10-17

- Q: Should trivial text formatting differences count as a mismatch? → A: Normalize line endings and trim leading/trailing whitespace of the text; everything else is exact.
- Q: Do votes carry over to new versions? → A: No; votes belong to a specific version, each new version starts at 0 attest / 0 dispute, and wallets may vote again on it.
- Q: Which counts does a reader see when verifying content that matches an earlier version? → A: The counts of the matched version, plus a note that a newer version exists with its own counts.
- Q: Is the reference link required? → A: Yes; registration and updates are rejected without a link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register & Verify Content (Priority: P1)

A creator registers an article (text) or an image (file). The system records a fingerprint of the content, the creator as its permanent author, and the time of registration. Registering identical content twice is rejected. Any reader can submit content and see whether it matches a registered record: who registered it, when, and whether it is unchanged or modified.

**Why this priority**: Proof of "who registered this first, and when" is the core value. Without it nothing else has meaning, and it is a viable MVP on its own.

**Independent Test**: Register one article and one image with a creator wallet, then submit the same content and a slightly altered copy as a reader. The original shows author, time and "Unchanged"; the altered copy shows no match.

**Acceptance Scenarios**:

1. **Given** content that has never been registered, **When** a creator registers it, **Then** a record exists showing the creator as permanent author and the registration time.
2. **Given** content already registered, **When** anyone tries to register identical content, **Then** the registration is rejected and the existing record is unchanged.
3. **Given** a registered record, **When** a reader submits identical content, **Then** they see the author, the registration time and the status "Unchanged".
4. **Given** a registered record, **When** a reader submits content that differs in any way, **Then** they see that no registered record matches that exact content.
5. **Given** content registered and later superseded by a newer version, **When** a reader submits the older content, **Then** they see it matches an earlier version and is marked "Modified" relative to the latest.

---

### User Story 2 - Version History (Priority: P2)

Only the author can submit an updated version of their content. Every version is kept in order with its time; no version can be edited or deleted. Readers see the full timeline from the original to the latest.

**Why this priority**: Makes edits transparent and history tamper-evident, building on registered content from P1.

**Independent Test**: Register content, submit two updates as the author, then view the timeline: three versions in order with times. Attempt an update from another wallet and see it rejected.

**Acceptance Scenarios**:

1. **Given** content registered by an author, **When** the author submits an updated version, **Then** it is appended to the timeline with its time and earlier versions are unchanged.
2. **Given** content registered by an author, **When** any other wallet submits an update, **Then** it is rejected.
3. **Given** content with several versions, **When** a reader opens it, **Then** they see every version in order from original to latest with times.
4. **Given** an existing version, **When** anyone attempts to edit or delete it, **Then** no such action is available or it is rejected.
5. **Given** an update identical to any version already registered, **When** the author submits it, **Then** it is rejected.

---

### User Story 3 - Attestations (Priority: P3)

Any wallet can attest (supports) or dispute a specific version of a registered piece of content, once per version. Readers see raw attest and dispute counts for each version, clearly labeled as unweighted community signals, never as "true" or "verified".

**Why this priority**: Adds a transparent community signal on top of provenance, but provenance is useful without it.

**Independent Test**: With three wallets, attest with two and dispute with one; the version's counts read 2 attest / 1 dispute with an "unweighted community signal" label. A repeat vote from any of them on that version is rejected. After the author publishes a new version, its counts read 0 / 0 and the same wallets can vote on it.

**Acceptance Scenarios**:

1. **Given** a version of registered content, **When** a wallet attests or disputes, **Then** that version's matching count increases by one.
2. **Given** a wallet that already voted on a version, **When** it votes again on that version (either way), **Then** the vote is rejected and counts are unchanged.
3. **Given** a version with votes, **When** the author publishes a new version, **Then** the new version shows 0 attest / 0 dispute, the earlier version keeps its counts, and wallets may vote on the new version.
4. **Given** content with votes, **When** a reader views it, **Then** raw counts are shown per version labeled as unweighted community signals.
5. **Given** content submitted by a reader that matches an earlier (non-latest) version, **When** the result is shown, **Then** it shows that version's attest/dispute counts and a note that a newer version exists with its own counts.
6. **Given** content that does not exist, **When** a wallet tries to attest or dispute, **Then** it is rejected.

---

### Edge Cases

- Empty content (text that is empty after trimming, or a zero-byte file) or a missing file is submitted for registration or verification: rejected with a clear message.
- Registration or update submitted without a reference link: rejected with a clear message.
- Two creators try to register identical content: the first wins; the second is rejected.
- A verification submission matches nothing: shown as "no registered record", never as "false".
- A wallet that is the author attests to their own content: allowed, as any wallet may attest.
- A reader checks content without a connected wallet: verification works read-only.
- Article text differing only in line endings or leading/trailing whitespace: treated as identical content.
- An image is resized or re-saved: treated as different content (exact-file matching only).
- An author reverts to an earlier version's content: rejected as a duplicate (known limitation).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Creators MUST be able to register an article (text) or an image (file).
- **FR-001a**: For articles, System MUST normalize line endings and trim leading and trailing whitespace before fingerprinting, both on registration and on verification; any other difference counts as different content. Images are matched byte for byte.
- **FR-001b**: Registration and every update MUST include a reference link to where the content can be found; submissions without one MUST be rejected.
- **FR-002**: System MUST record a fingerprint of the content, the registering wallet as permanent author, and the registration time.
- **FR-003**: System MUST reject registration of content identical to any already-registered content.
- **FR-004**: The author of a record MUST NOT be changeable after registration.
- **FR-005**: Readers MUST be able to submit content and see whether it matches a registered record, with author, registration time, and status "Unchanged" or "Modified".
- **FR-006**: Only the author MUST be able to submit an updated version of their content.
- **FR-007**: System MUST keep every version in order with its time and MUST NOT allow any version to be edited or deleted.
- **FR-008**: System MUST reject an update whose fingerprint matches any version already registered.
- **FR-009**: Readers MUST be able to view the full version timeline from original to latest.
- **FR-010**: Any wallet MUST be able to attest or dispute registered content, once per version per wallet.
- **FR-011**: System MUST reject attestations on content that does not exist.
- **FR-012**: System MUST show raw attest and dispute counts for each version, labeled as unweighted community signals. When a verification matches a non-latest version, the result MUST show that version's counts and note that a newer version exists with its own counts.
- **FR-013**: The interface and documentation MUST NOT describe content as "true", "verified" or "original" as a fact; they MUST use wording such as "Registered first here by X at T".
- **FR-014**: System MUST NOT store the content itself or personal data; only the fingerprint and short reference metadata.
- **FR-015**: Every change of state (registration, update, attestation) MUST be publicly observable.

### Key Entities

- **Content Record**: A registered piece of content. Has a permanent author, a kind (article or image), a registration time, and an ordered list of versions.
- **Version**: One entry in a record's history. Has a fingerprint, a required reference link, a time, and its own attest/dispute counts. Immutable once recorded, apart from counts growing as votes arrive.
- **Attestation**: One wallet's single vote (support or dispute) on one version.
- **Wallet / Participant**: An identity that acts as creator (registers, updates), or reader (verifies, attests).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A creator can register an article or image in under 1 minute from opening the app, and the registration is confirmed in about 1 second.
- **SC-002**: 100% of identical-content re-registrations are rejected.
- **SC-003**: A reader can check content against the registry and see the result in under 10 seconds, with 100% correct match / no-match outcomes on test content.
- **SC-004**: 100% of update attempts by non-authors are rejected, and 100% of existing versions remain unaltered after any attempt to change them.
- **SC-005**: 100% of repeat votes from the same wallet on the same version are rejected.
- **SC-006**: In review, no screen or document presents content as "true", "verified" or "original" as a fact.
- **SC-007**: A live demo can register or attest at least 10 items in under 30 seconds.

## Assumptions

- Records are kept on the Monad testnet as the public ledger; mainnet is out of scope.
- Fingerprints are computed on the user's device so content never leaves it; the fingerprint is exact, so any byte change counts as different content (articles are first normalized per FR-001a).
- Content is stored elsewhere by the creator; a plain link to it is required and recorded alongside the fingerprint.
- Users identify through a crypto wallet; no other accounts or logins.
- Anyone with a wallet may attest, including the author; Sybil attestation is an accepted limitation, hence raw counts.
- Front-running of registration and off-chain plagiarism are accepted known limitations, stated in the pitch.
- Out of scope: reputation, staking, weighted voting, content storage, plagiarism detection, mainnet.
