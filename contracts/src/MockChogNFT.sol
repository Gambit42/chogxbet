// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// Testnet-only stand-in for Chog Genesis (mainnet 0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763). Anyone can mint, up to CAP per wallet.
/// Reuses the live collection's IPFS metadata (1.json..1969.json) so test tokens show real art and traits.
contract MockChogNFT is ERC721 {
    string private constant BASE_URI = "ipfs://bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu/";
    uint256 private constant SUPPLY = 1969;

    uint256 public constant CAP = 5;

    uint256 public nextId = 1;
    mapping(address => uint256) public minted;

    constructor() ERC721("Test Chog Genesis", "tCHOGNFT") {
        require(block.chainid == 10143 || block.chainid == 31337, "testnet only");
    }

    function mint(address to) external returns (uint256 id) {
        require(++minted[to] <= CAP, "faucet limit reached");
        id = nextId++;
        _safeMint(to, id);
    }

    /// Mints past 1969 wrap around to reuse metadata.
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat(BASE_URI, Strings.toString((id - 1) % SUPPLY + 1), ".json");
    }
}
