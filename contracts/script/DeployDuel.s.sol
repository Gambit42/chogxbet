// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ChogDuel} from "../src/ChogDuel.sol";
import {FeedMirror} from "../src/testnet/FeedMirror.sol";

interface Vm {
    function envAddress(string calldata) external view returns (address);
    function startBroadcast() external;
}

/// Deploys ChogDuel on Monad testnet against the mock token/NFT in .env (forge loads it), with one FeedMirror per asset
/// that the settle cron (SETTLER_ADDRESS) fills with mainnet Chainlink rounds. Copy the printed mirror addresses into
/// `feeds` in src/features/betting/networks.ts.
contract DeployDuel {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (ChogDuel duel, FeedMirror mon, FeedMirror btc, FeedMirror sol, FeedMirror eth) {
        require(block.chainid == 10143, "testnet only");
        IERC20 chog = IERC20(vm.envAddress("NEXT_PUBLIC_CHOG_ADDRESS"));
        IERC721 nft = IERC721(vm.envAddress("NEXT_PUBLIC_CHOG_NFT_ADDRESS"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address settler = vm.envAddress("SETTLER_ADDRESS");
        vm.startBroadcast();
        (mon, btc, sol, eth) = (new FeedMirror(settler), new FeedMirror(settler), new FeedMirror(settler), new FeedMirror(settler));
        address[] memory feeds = new address[](4);
        (feeds[0], feeds[1], feeds[2], feeds[3]) = (address(mon), address(btc), address(sol), address(eth));
        duel = new ChogDuel(chog, nft, treasury, feeds);
    }
}
