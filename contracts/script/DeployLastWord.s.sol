// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {LastWord} from "../src/LastWord.sol";

interface Vm {
    function envAddress(string calldata) external view returns (address);
    function envAddress(string calldata name, string calldata delim) external view returns (address[] memory);
    function startBroadcast() external;
}

/// Deploys LastWord on Monad testnet against the mock NFT in .env (forge loads it), reusing ChogDuel's FeedMirrors
/// (FEED_MIRRORS, comma-separated: the `feeds` in src/features/betting/networks.ts) so the same settle cron fills both.
contract DeployLastWord {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (LastWord lw) {
        require(block.chainid == 10143, "testnet only");
        IERC721 nft = IERC721(vm.envAddress("NEXT_PUBLIC_CHOG_NFT_ADDRESS"));
        IERC20 chog = IERC20(vm.envAddress("NEXT_PUBLIC_CHOG_ADDRESS"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address[] memory feeds = vm.envAddress("FEED_MIRRORS", ",");
        vm.startBroadcast();
        // Fees per side: 1 MON or 10 $CHOG. Keep in sync with LW_FEE and LW_CHOG_FEE in src/features/lastword/lastword.ts.
        lw = new LastWord(nft, chog, treasury, 1 ether, 10 ether, feeds);
    }
}
