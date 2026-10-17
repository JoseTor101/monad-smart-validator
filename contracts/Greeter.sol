// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Greeter
/// @notice A minimal placeholder contract to demonstrate the read/write
///         pattern. Replace this with your own contract logic.
/// @dev Stores a string on-chain. Reading is free; writing costs a little gas.
contract Greeter {
    // `greeting` is stored permanently on the blockchain.
    // `public` auto-generates a free getter function called greeting().
    string public greeting;

    // Events are logs the blockchain emits. Frontends listen to them
    // to react to on-chain changes without constantly polling.
    event GreetingChanged(string newGreeting, address changedBy);

    /// @param initialGreeting the greeting to store at deploy time.
    constructor(string memory initialGreeting) {
        greeting = initialGreeting;
    }

    /// @notice Update the stored greeting.
    /// @param newGreeting the value to store.
    function setGreeting(string calldata newGreeting) external {
        greeting = newGreeting;
        emit GreetingChanged(newGreeting, msg.sender);
    }
}
