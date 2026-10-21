// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ChogDuel} from "../src/ChogDuel.sol";
import {FeedMirror} from "../src/testnet/FeedMirror.sol";

interface Vm {
    function envAddress(string calldata) external view returns (address);
    function envOr(string calldata name, string calldata delim, address[] calldata defaultValue) external view returns (address[] memory);
    function startBroadcast() external;
}

/// Deploys ChogDuel on Monad testnet against the mock token/NFT in .env (forge loads it). Mirrors don't depend on the duel
/// contract, so a redeploy reuses the ones listed in FEED_MIRRORS; with it unset, deploys one FeedMirror per asset that the
/// settle cron (SETTLER_ADDRESS) fills with mainnet Chainlink rounds; copy those into `feeds` in src/features/betting/networks.ts.
contract DeployDuel {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (ChogDuel duel, address[] memory feeds) {
        require(block.chainid == 10143, "testnet only");
        IERC20 chog = IERC20(vm.envAddress("NEXT_PUBLIC_CHOG_ADDRESS"));
        IERC721 nft = IERC721(vm.envAddress("NEXT_PUBLIC_CHOG_NFT_ADDRESS"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address settler = vm.envAddress("SETTLER_ADDRESS");
        feeds = vm.envOr("FEED_MIRRORS", ",", new address[](0));
        vm.startBroadcast();
        if (feeds.length == 0) {
            feeds = new address[](4); // MON, BTC, SOL, ETH
            for (uint256 i; i < 4; i++) feeds[i] = address(new FeedMirror(settler));
        }
        duel = new ChogDuel(chog, nft, treasury, feeds);
    }
}
