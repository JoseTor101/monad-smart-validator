// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReputation {
    function adjust(bytes32 topic, address who, int256 delta) external;
}

interface IContentRegistry {
    function authorOf(uint256 id) external view returns (address);
}

/// @title ValidationMarket
/// @notice Peer validation of content originality/truth with staked MON,
///         commit–reveal voting, slashing, pull-based payouts, and a
///         dispute/escalation path.
/// @dev Maps directly onto the threat model (see wip/ design doc §8):
///      - Sybil: vote weight = staked MON, not wallet count. 100 wallets cost
///        the same as one big stake.
///      - Cheap lying: minority (wrong-side) voters are slashed; their stake
///        funds the majority's reward pool.
///      - Herding / bribery: commit–reveal hides votes until the reveal phase,
///        so nobody can copy the leader or verify a bought vote in time.
///      - First-round error: any resolved round can be disputed, escalating to
///        a fresh round with a higher minimum stake — decisions are reversible.
///      - Contract safety: checks-effects-interactions + a reentrancy guard on
///        every ETH-moving function; pull-based withdrawals; no owner override
///        of outcomes.
contract ValidationMarket {
    // --- Reentrancy guard (minimal, no external dep) -----------------------
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // --- Wiring ------------------------------------------------------------
    IReputation public immutable reputation;
    IContentRegistry public immutable registry;

    // --- Phases ------------------------------------------------------------
    enum Phase {
        None,
        Commit,
        Reveal,
        Resolved
    }

    struct Vote {
        bytes32 commitment; // keccak256(abi.encode(choice, salt, voter))
        uint256 stake; // MON locked for this vote
        bool revealed;
        bool choice; // revealed choice: true = original/true
        bool claimed; // reward/refund already withdrawn
    }

    struct Round {
        uint256 contentId;
        bytes32 topic; // reputation scope for this round
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint256 minStake; // Sybil/dispute dial; rises on escalation
        uint8 escalationLevel; // 0 = first round; increments on dispute
        uint256 parentRound; // 0 unless this round is a dispute of another

        uint256 yesWeight; // sum of revealed "yes" stakes
        uint256 noWeight; // sum of revealed "no" stakes
        uint256 losingPool; // slashed stake of the losing side, split to winners
        bool outcome; // final decision once resolved
        Phase phase;

        address[] committers; // for iteration bookkeeping (off-chain mostly)
        mapping(address => Vote) votes;
    }

    uint256 public nextRound = 1;
    mapping(uint256 => Round) private _rounds;

    // Pull-based balances: funds owed to voters after resolve. Never pushed.
    mapping(address => uint256) public withdrawable;

    // A content+topic can only have one *active* (non-resolved) round at a time
    // to avoid split-brain validation. Keyed by keccak(contentId, topic).
    mapping(bytes32 => uint256) public activeRoundFor;

    // Dispute window: how long after reveal a resolved round can be challenged.
    uint256 public constant DISPUTE_WINDOW = 1 days;
    mapping(uint256 => uint256) public resolvedAt; // roundId => timestamp
    mapping(uint256 => bool) public disputed; // roundId => already disputed?

    event RoundOpened(
        uint256 indexed roundId,
        uint256 indexed contentId,
        bytes32 indexed topic,
        uint256 commitDeadline,
        uint256 revealDeadline,
        uint256 minStake,
        uint8 escalationLevel
    );
    event Committed(uint256 indexed roundId, address indexed voter, uint256 stake);
    event Revealed(uint256 indexed roundId, address indexed voter, bool choice, uint256 stake);
    event Resolved(uint256 indexed roundId, bool outcome, uint256 yesWeight, uint256 noWeight);
    event Disputed(uint256 indexed parentRound, uint256 indexed newRound, address indexed challenger);
    event Withdrawn(address indexed who, uint256 amount);

    constructor(address reputation_, address registry_) {
        require(reputation_ != address(0) && registry_ != address(0), "Zero address");
        reputation = IReputation(reputation_);
        registry = IContentRegistry(registry_);
    }

    // --- Opening rounds ----------------------------------------------------

    /// @notice Open a validation round for a piece of content under a topic.
    /// @param commitWindow seconds voters have to commit a hashed vote.
    /// @param revealWindow seconds (after commit) to reveal the plaintext vote.
    /// @param minStake minimum MON each voter must stake (Sybil dial).
    function openRound(
        uint256 contentId,
        bytes32 topic,
        uint256 commitWindow,
        uint256 revealWindow,
        uint256 minStake
    ) external returns (uint256 id) {
        require(commitWindow > 0 && revealWindow > 0, "Bad windows");
        require(minStake > 0, "Zero minStake");
        // Author can't self-validate their own content.
        require(registry.authorOf(contentId) != msg.sender, "Author cannot open");

        bytes32 key = keccak256(abi.encode(contentId, topic));
        require(activeRoundFor[key] == 0, "Round already active");

        id = _open(contentId, topic, commitWindow, revealWindow, minStake, 0, 0);
        activeRoundFor[key] = id;
    }

    function _open(
        uint256 contentId,
        bytes32 topic,
        uint256 commitWindow,
        uint256 revealWindow,
        uint256 minStake,
        uint8 escalationLevel,
        uint256 parentRound
    ) internal returns (uint256 id) {
        id = nextRound++;
        Round storage r = _rounds[id];
        r.contentId = contentId;
        r.topic = topic;
        r.commitDeadline = block.timestamp + commitWindow;
        r.revealDeadline = r.commitDeadline + revealWindow;
        r.minStake = minStake;
        r.escalationLevel = escalationLevel;
        r.parentRound = parentRound;
        r.phase = Phase.Commit;

        emit RoundOpened(
            id,
            contentId,
            topic,
            r.commitDeadline,
            r.revealDeadline,
            minStake,
            escalationLevel
        );
    }

    // --- Commit–reveal voting ---------------------------------------------

    /// @notice Commit a hashed vote while staking MON.
    /// @param commitment keccak256(abi.encode(choice, salt, msg.sender)).
    ///        The salt is a secret random value the voter keeps until reveal.
    function commitVote(uint256 roundId, bytes32 commitment)
        external
        payable
        nonReentrant
    {
        Round storage r = _rounds[roundId];
        require(r.phase == Phase.Commit, "Not in commit phase");
        require(block.timestamp < r.commitDeadline, "Commit closed");
        require(msg.value >= r.minStake, "Stake below minimum");
        require(commitment != bytes32(0), "Empty commitment");
        require(r.votes[msg.sender].commitment == bytes32(0), "Already committed");

        r.votes[msg.sender] = Vote({
            commitment: commitment,
            stake: msg.value,
            revealed: false,
            choice: false,
            claimed: false
        });
        r.committers.push(msg.sender);

        emit Committed(roundId, msg.sender, msg.value);
    }

    /// @notice Reveal the plaintext vote. Must match the earlier commitment.
    /// @param salt the secret used when committing.
    function revealVote(uint256 roundId, bool choice, bytes32 salt)
        external
    {
        Round storage r = _rounds[roundId];
        // Allow entering reveal phase lazily once commit deadline passes.
        if (r.phase == Phase.Commit && block.timestamp >= r.commitDeadline) {
            r.phase = Phase.Reveal;
        }
        require(r.phase == Phase.Reveal, "Not in reveal phase");
        require(block.timestamp < r.revealDeadline, "Reveal closed");

        Vote storage v = r.votes[msg.sender];
        require(v.commitment != bytes32(0), "No commitment");
        require(!v.revealed, "Already revealed");
        require(
            v.commitment == keccak256(abi.encode(choice, salt, msg.sender)),
            "Commitment mismatch"
        );

        v.revealed = true;
        v.choice = choice;
        if (choice) {
            r.yesWeight += v.stake;
        } else {
            r.noWeight += v.stake;
        }

        emit Revealed(roundId, msg.sender, choice, v.stake);
    }

    // --- Resolution --------------------------------------------------------

    /// @notice Resolve a round after the reveal deadline. Anyone may call.
    /// @dev Majority by staked weight wins. The losing side's stake becomes the
    ///      reward pool for winners (slashing). Unrevealed committers forfeit
    ///      their stake into the pool too (discourages commit-and-vanish).
    ///      Reputation is adjusted per voter within the round's topic.
    function resolve(uint256 roundId) external nonReentrant {
        Round storage r = _rounds[roundId];
        require(r.phase != Phase.None, "No such round");
        require(r.phase != Phase.Resolved, "Already resolved");
        // Move out of commit if needed, then require reveal window to be over.
        require(block.timestamp >= r.revealDeadline, "Reveal not over");

        r.phase = Phase.Resolved;
        resolvedAt[roundId] = block.timestamp;

        // Free the active-round slot so a dispute (or a future round) can open.
        bytes32 key = keccak256(abi.encode(r.contentId, r.topic));
        if (activeRoundFor[key] == roundId) {
            activeRoundFor[key] = 0;
        }

        bool outcome = r.yesWeight >= r.noWeight; // ties resolve to "yes"
        r.outcome = outcome;

        uint256 winningWeight = outcome ? r.yesWeight : r.noWeight;
        uint256 losingWeight = outcome ? r.noWeight : r.yesWeight;

        // Collect slashed stake: the losing side + any unrevealed committers.
        uint256 pool = losingWeight;
        uint256 n = r.committers.length;
        for (uint256 i = 0; i < n; i++) {
            Vote storage v = r.votes[r.committers[i]];
            if (!v.revealed) {
                pool += v.stake; // forfeited; marked claimed below to block refund
                v.claimed = true;
            }
        }
        r.losingPool = pool;

        // Reputation: winners +1 weighted unit, losers -1, scoped to topic.
        // (Proportional-to-stake payout is handled at withdraw time.)
        for (uint256 i = 0; i < n; i++) {
            address who = r.committers[i];
            Vote storage v = r.votes[who];
            if (!v.revealed) {
                // Unrevealed = penalized for griefing the round.
                reputation.adjust(r.topic, who, -int256(v.stake));
                continue;
            }
            bool won = (v.choice == outcome);
            reputation.adjust(
                r.topic,
                who,
                won ? int256(v.stake) : -int256(v.stake)
            );
        }

        // If there were zero winning-weight voters (e.g. nobody revealed),
        // nothing to distribute; stakes of non-revealers are already pooled and
        // effectively burned (left in contract). Edge case acceptable for MVP.
        emit Resolved(roundId, outcome, r.yesWeight, r.noWeight);

        // Silence unused-variable warning while keeping the value meaningful.
        winningWeight;
    }

    /// @notice Withdraw a voter's refund + proportional reward after resolution.
    /// @dev Pull pattern: the voter claims; the contract never pushes ETH in a
    ///      loop (avoids gas-griefing and failed-send DoS during resolve).
    function withdraw(uint256 roundId) external nonReentrant {
        Round storage r = _rounds[roundId];
        require(r.phase == Phase.Resolved, "Not resolved");

        Vote storage v = r.votes[msg.sender];
        require(v.commitment != bytes32(0), "No vote");
        require(!v.claimed, "Already claimed");
        require(v.revealed, "Did not reveal");

        v.claimed = true;

        uint256 payout;
        bool won = (v.choice == r.outcome);
        if (won) {
            uint256 winningWeight = r.outcome ? r.yesWeight : r.noWeight;
            // Return own stake + proportional share of the slashed losing pool.
            uint256 reward = winningWeight == 0
                ? 0
                : (r.losingPool * v.stake) / winningWeight;
            payout = v.stake + reward;
        } else {
            // Losers are slashed: stake already counted into losingPool.
            payout = 0;
        }

        require(payout > 0, "Nothing to withdraw");
        (bool ok, ) = payable(msg.sender).call{value: payout}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, payout);
    }

    // --- Disputes / escalation --------------------------------------------

    /// @notice Challenge a resolved round, opening a fresh escalated round with
    ///         a higher minimum stake. Makes outcomes reversible rather than
    ///         falsely final (Kleros/UMA-style escalation).
    /// @dev The challenger must stake at least the escalated minimum, which
    ///      seeds their commit in the new round in a single call.
    function dispute(
        uint256 roundId,
        bytes32 commitment,
        uint256 commitWindow,
        uint256 revealWindow
    ) external payable nonReentrant returns (uint256 newRoundId) {
        Round storage r = _rounds[roundId];
        require(r.phase == Phase.Resolved, "Not resolved");
        require(!disputed[roundId], "Already disputed");
        require(block.timestamp <= resolvedAt[roundId] + DISPUTE_WINDOW, "Dispute window closed");
        require(commitWindow > 0 && revealWindow > 0, "Bad windows");

        // Escalate: double the minimum stake each level so repeated frivolous
        // disputes get exponentially more expensive.
        uint256 newMin = r.minStake * 2;
        require(msg.value >= newMin, "Stake below escalated minimum");

        disputed[roundId] = true;

        newRoundId = _open(
            r.contentId,
            r.topic,
            commitWindow,
            revealWindow,
            newMin,
            r.escalationLevel + 1,
            roundId
        );

        // Register the challenger's own committed vote in the new round.
        Round storage nr = _rounds[newRoundId];
        nr.votes[msg.sender] = Vote({
            commitment: commitment,
            stake: msg.value,
            revealed: false,
            choice: false,
            claimed: false
        });
        nr.committers.push(msg.sender);

        bytes32 key = keccak256(abi.encode(r.contentId, r.topic));
        activeRoundFor[key] = newRoundId;

        emit Disputed(roundId, newRoundId, msg.sender);
        emit Committed(newRoundId, msg.sender, msg.value);
    }

    // --- Views -------------------------------------------------------------

    function getRound(uint256 roundId)
        external
        view
        returns (
            uint256 contentId,
            bytes32 topic,
            uint256 commitDeadline,
            uint256 revealDeadline,
            uint256 minStake,
            uint8 escalationLevel,
            uint256 parentRound,
            uint256 yesWeight,
            uint256 noWeight,
            bool outcome,
            Phase phase
        )
    {
        Round storage r = _rounds[roundId];
        return (
            r.contentId,
            r.topic,
            r.commitDeadline,
            r.revealDeadline,
            r.minStake,
            r.escalationLevel,
            r.parentRound,
            r.yesWeight,
            r.noWeight,
            r.outcome,
            r.phase
        );
    }

    function committerCount(uint256 roundId) external view returns (uint256) {
        return _rounds[roundId].committers.length;
    }

    function voteOf(uint256 roundId, address who)
        external
        view
        returns (uint256 stake, bool revealed, bool choice, bool claimed)
    {
        Vote storage v = _rounds[roundId].votes[who];
        return (v.stake, v.revealed, v.choice, v.claimed);
    }

    /// @notice Helper to compute a commitment off-chain checks can mirror.
    function hashVote(bool choice, bytes32 salt, address voter)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(choice, salt, voter));
    }
}
