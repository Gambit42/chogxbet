// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Testnet-only stand-in for $CHOG. Anyone can mint, up to CAP per wallet per UTC day.
contract MockChog is ERC20 {
    uint256 public constant CAP = 10_000 ether;
    mapping(address => uint256) private _minted; // during _day
    mapping(address => uint256) private _day;

    constructor() ERC20("Test Chog", "tCHOG") {
        require(block.chainid == 10143 || block.chainid == 31337, "testnet only");
    }

    /// Minted to `a` so far today (UTC).
    function minted(address a) public view returns (uint256) {
        return _day[a] == block.timestamp / 1 days ? _minted[a] : 0;
    }

    function mint(address to, uint256 amount) external {
        uint256 total = minted(to) + amount;
        require(total <= CAP, "faucet limit reached");
        (_day[to], _minted[to]) = (block.timestamp / 1 days, total);
        _mint(to, amount);
    }
}
