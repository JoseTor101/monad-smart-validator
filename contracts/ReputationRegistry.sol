// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReputationRegistry
/// @notice Topic-scoped reputation scores per address.
/// @dev Addresses threat-model guarantees:
///      - Scoped reputation: trust in "photography" ≠ trust in "medicine",
///        limiting the blast radius of a captured expert.
///      - Authorized writer: only the wired ValidationMarket may mutate scores,
///        set exactly once (no owner backdoor to flip reputation later).
///      - Transparent: every change emits an event for off-chain auditing.
contract ReputationRegistry {
    // topic (bytes32, e.g. keccak256("photography")) => address => score.
    // Scores may go negative for repeatedly-wrong / malicious validators.
    mapping(bytes32 => mapping(address => int256)) private _reputation;

    // The only contract allowed to adjust scores. Set once, immutable after.
    address public market;

    event MarketSet(address indexed market);
    event ReputationChanged(
        bytes32 indexed topic,
        address indexed who,
        int256 delta,
        int256 newScore
    );

    modifier onlyMarket() {
        require(msg.sender == market, "Not authorized");
        _;
    }

    /// @notice One-time wiring of the authorized market contract.
    /// @dev Can only be set once; there is deliberately no setter to change it
    ///      afterward, so no admin can later redirect reputation control.
    function setMarket(address market_) external {
        require(market == address(0), "Market already set");
        require(market_ != address(0), "Zero address");
        market = market_;
        emit MarketSet(market_);
    }

    /// @notice Adjust a validator's reputation within a topic. Market-only.
    function adjust(bytes32 topic, address who, int256 delta) external onlyMarket {
        int256 updated = _reputation[topic][who] + delta;
        _reputation[topic][who] = updated;
        emit ReputationChanged(topic, who, delta, updated);
    }

    /// @notice Read a validator's reputation within a topic.
    function reputationOf(bytes32 topic, address who) external view returns (int256) {
        return _reputation[topic][who];
    }

    /// @notice Non-negative reputation usable as vote weight. Negative clamps to 0.
    function weightOf(bytes32 topic, address who) external view returns (uint256) {
        int256 r = _reputation[topic][who];
        return r > 0 ? uint256(r) : 0;
    }
}
