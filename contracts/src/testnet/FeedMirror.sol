// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Testnet copy of a Monad mainnet Chainlink feed, holding only the rounds testnet duels settle on (Chainlink has no MON or
/// SOL feed on testnet). The settle cron copies each duel's deadline round and the one before it, with mainnet's round ID,
/// answer and timestamp, so anyone can check them against mainnet.
/// ponytail: trusts the updater to copy honestly; fine for testnet, mainnet reads Chainlink directly.
contract FeedMirror {
    address public immutable updater;
    mapping(uint80 => int256) public answers;
    mapping(uint80 => uint256) public times;

    constructor(address updater_) {
        updater = updater_;
    }

    function push(uint80 id, int256 answer, uint256 updatedAt) external {
        require(msg.sender == updater, "not updater");
        require(times[id] == 0, "round already set");
        (answers[id], times[id]) = (answer, updatedAt);
    }

    function getRoundData(uint80 id) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (id, answers[id], times[id], times[id], id);
    }
}
