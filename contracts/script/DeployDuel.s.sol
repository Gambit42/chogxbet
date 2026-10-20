// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ChogDuel} from "../src/ChogDuel.sol";

interface Vm {
    function envAddress(string calldata) external view returns (address);
    function startBroadcast() external;
}

/// Deploys ChogDuel on Monad testnet against the mock token/NFT in .env (forge loads it) and Chainlink's testnet feeds.
contract DeployDuel {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (ChogDuel) {
        require(block.chainid == 10143, "testnet only");
        IERC20 chog = IERC20(vm.envAddress("NEXT_PUBLIC_CHOG_ADDRESS"));
        IERC721 nft = IERC721(vm.envAddress("NEXT_PUBLIC_CHOG_NFT_ADDRESS"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        // Chainlink's Monad testnet feeds; keep in sync with `feeds` in src/features/betting/networks.ts.
        address[] memory feeds = new address[](2);
        feeds[0] = 0x12C0F44368a02081ce58a936d1C1F606BB301715; // BTC / USD
        feeds[1] = 0x5c8c8482f064049248F86D9F4aFa4B1f2F5b6d31; // ETH / USD
        vm.startBroadcast();
        return new ChogDuel(chog, nft, treasury, feeds);
    }
}
