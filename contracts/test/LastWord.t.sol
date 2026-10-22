// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LastWord} from "../src/LastWord.sol";
import {MockChog} from "../src/testnet/MockChog.sol";
import {MockChogNFT} from "../src/testnet/MockChogNFT.sol";
import {MockFeed, Vm} from "./ChogDuel.t.sol";

contract LastWordTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    MockChogNFT nft = new MockChogNFT();
    MockChog chog = new MockChog();
    address constant MON = address(0);
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    MockFeed feed = new MockFeed();
    address treasury = address(0x7EA);
    LastWord lw;
    address alice = address(0xA11CE); // holds Chog #1
    address bob = address(0xB0B); // holds Chog #2
    address carol = address(0xCA201); // holds Chog #3
    uint64 deadline;
    uint80 round = 10;

    function setUp() public {
        address[] memory feeds = new address[](1);
        feeds[0] = address(feed);
        lw = new LastWord(nft, chog, treasury, 1 ether, 10 ether, feeds);
        deadline = uint64(block.timestamp + 1 days);
        address[3] memory who = [alice, bob, carol];
        for (uint256 i; i < 3; i++) {
            nft.mint(who[i]);
            vm.deal(who[i], 10 ether);
            chog.mint(who[i], 100 ether);
            vm.prank(who[i]);
            chog.approve(address(lw), type(uint256).max);
        }
    }

    /// Alice (#1) calls "above $5" with `dare`; bob (#2) takes the other side.
    function duel(string memory dare) internal returns (uint256 id) {
        vm.prank(alice);
        id = lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, dare, MON);
        vm.prank(bob);
        lw.accept{value: 1 ether}(id, 2);
    }

    /// Settles `id`, made with the current `deadline`, at price `p` with fresh rounds: one before the deadline, one after.
    /// (Reading the deadline back from the 12-field getter is too deep a stack without the optimizer, which foundry.toml keeps off.)
    function settleAt(uint256 id, int256 p) internal {
        uint64 at = deadline;
        feed.set(round, 1e8, at - 30);
        feed.set(round + 1, p, at + 30);
        vm.warp(at + 100);
        lw.settle(id, round + 1);
        round += 2;
    }

    function wears(uint256 chog) internal view returns (string memory dare) {
        (,, dare) = lw.lastWord(chog);
    }

    function eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function test_feesAndCancel() public {
        vm.prank(alice);
        uint256 id = lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "gm", MON);
        require(address(lw).balance == 1 ether, "creator fee not held");
        vm.prank(bob);
        vm.expectRevert("not yours");
        lw.cancel(id);
        vm.prank(alice);
        lw.cancel(id);
        require(alice.balance == 10 ether && address(lw).balance == 0, "fee not returned");

        id = duel("gm");
        require(treasury.balance == 2 ether && address(lw).balance == 0, "fees not sent to treasury");
        vm.prank(alice);
        vm.expectRevert("not open");
        lw.cancel(id);
    }

    /// A $CHOG duel: the creator's fee is held until accepted, cancelling returns it, accepting burns both, and the token is the duel's.
    function test_chogFees() public {
        vm.prank(alice);
        uint256 id = lw.create(address(feed), true, 5e8, deadline, 0, 1, "gm", address(chog));
        require(chog.balanceOf(address(lw)) == 10 ether && chog.balanceOf(alice) == 90 ether, "creator fee not held");
        vm.prank(alice);
        lw.cancel(id);
        require(chog.balanceOf(alice) == 100 ether && chog.balanceOf(address(lw)) == 0, "fee not returned");

        vm.prank(alice);
        id = lw.create(address(feed), true, 5e8, deadline, 0, 1, "gm", address(chog));
        vm.prank(bob);
        vm.expectRevert("wrong fee");
        lw.accept{value: 1 ether}(id, 2); // MON on a $CHOG duel
        vm.prank(bob);
        lw.accept(id, 2);
        require(chog.balanceOf(DEAD) == 20 ether && chog.balanceOf(address(lw)) == 0 && treasury.balance == 0, "fees not burned");

        vm.startPrank(alice);
        vm.expectRevert("wrong fee");
        lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "gm", address(chog)); // MON attached
        vm.expectRevert("wrong fee");
        lw.create(address(feed), true, 5e8, deadline, 0, 1, "gm", address(0xBAD)); // not $CHOG
        vm.stopPrank();
    }

    function test_rejects() public {
        vm.startPrank(alice);
        vm.expectRevert("wrong fee");
        lw.create{value: 0.5 ether}(address(feed), true, 5e8, deadline, 0, 1, "gm", MON);
        vm.expectRevert("not your Chog");
        lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 2, "gm", MON);
        vm.expectRevert("dare must be 1-60 bytes");
        lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "", MON);
        vm.expectRevert("dare must be 1-60 bytes");
        lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "0123456789012345678901234567890123456789012345678901234567890", MON);
        vm.expectRevert("deadline too soon");
        lw.create{value: 1 ether}(address(feed), true, 5e8, uint64(block.timestamp + 1 minutes), 0, 1, "gm", MON);
        vm.expectRevert("unsupported feed");
        lw.create{value: 1 ether}(address(0xBAD), true, 5e8, deadline, 0, 1, "gm", MON);
        vm.expectRevert("own Chog");
        lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 1, 1, "gm", MON);
        uint256 id = lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "012345678901234567890123456789012345678901234567890123456789", MON);
        vm.expectRevert("own duel");
        lw.accept{value: 1 ether}(id, 1);
        vm.stopPrank();

        vm.startPrank(bob);
        vm.expectRevert("wrong fee");
        lw.accept{value: 2 ether}(id, 2);
        vm.expectRevert("not your Chog");
        lw.accept{value: 1 ether}(id, 3);
        vm.warp(deadline - 20 seconds);
        vm.expectRevert("too late to accept");
        lw.accept{value: 1 ether}(id, 2);
        vm.stopPrank();
    }

    /// A challenge is only taken with the named Chog, and one Chog can't sit on both sides.
    function test_challengeAndSameChog() public {
        vm.prank(alice);
        uint256 id = lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 2, 1, "gm", MON);
        vm.prank(carol);
        vm.expectRevert("not the challenged Chog");
        lw.accept{value: 1 ether}(id, 3);
        vm.prank(bob);
        lw.accept{value: 1 ether}(id, 2);

        vm.startPrank(alice);
        id = lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "gm", MON);
        nft.transferFrom(alice, bob, 1);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert("same Chog");
        lw.accept{value: 1 ether}(id, 1);
    }

    /// The loser wears the creator's dare until its next settlement: a win or draw clears it, another loss replaces it.
    function test_lastWord() public {
        // Duel 0, bob (#2) loses: an active record for duel id 0 must still read as active.
        uint256 id = duel("I bought the top.");
        vm.expectRevert("too early");
        lw.settle(id, 1);
        // The settle transaction's own log carries the dare text, so an explorer shows what the loser wears.
        feed.set(round, 1e8, deadline - 30);
        feed.set(round + 1, 6e8, deadline + 30);
        vm.warp(deadline + 100);
        vm.expectEmit(true, true, false, true, address(lw));
        emit LastWord.LastWordChanged(2, id, true, "I bought the top.");
        lw.settle(id, round + 1);
        round += 2;
        (bool active, uint256 at, string memory dare) = lw.lastWord(2);
        require(id == 0 && active && at == 0 && eq(dare, "I bought the top."), "loser not wearing the dare");
        (active,,) = lw.lastWord(1);
        require(!active && lw.winnerChog(id) == 1 && lw.settledBlock(id) == block.number, "winner not recorded");

        // A cancelled call and an unsettled duel leave it on.
        deadline = uint64(block.timestamp + 1 days);
        vm.startPrank(alice);
        lw.cancel(lw.create{value: 1 ether}(address(feed), true, 5e8, deadline, 0, 1, "nope", MON));
        vm.stopPrank();
        id = duel("never settled");
        vm.warp(deadline + 24 hours);
        vm.expectRevert("settle window over");
        lw.settle(id, 1);
        require(eq(wears(2), "I bought the top."), "cancel or lapse changed the dare");

        // Alice (#1) loses: bob's win clears his, alice now wears hers.
        deadline = uint64(block.timestamp + 1 days);
        id = duel("Inverse me.");
        settleAt(id, 4e8);
        (active, at,) = lw.lastWord(2);
        require(!active && at == id && bytes(wears(2)).length == 0, "win didn't clear the dare");
        require(eq(wears(1), "Inverse me.") && lw.winnerChog(id) == 2, "creator loss not recorded");

        // Another loss replaces it.
        deadline = uint64(block.timestamp + 1 days);
        id = duel("Twice.");
        settleAt(id, 4e8);
        require(eq(wears(1), "Twice."), "loss didn't replace the dare");

        // A draw clears both.
        deadline = uint64(block.timestamp + 1 days);
        id = duel("Draw.");
        settleAt(id, 5e8);
        (bool a1,,) = lw.lastWord(1);
        (bool a2,,) = lw.lastWord(2);
        require(!a1 && !a2 && lw.winnerChog(id) == 0, "draw didn't clear");
    }

    /// Only the first round after the deadline settles it.
    function test_wrongRound() public {
        uint256 id = duel("gm");
        feed.set(1, 1e8, deadline - 30);
        feed.set(2, 6e8, deadline + 30);
        feed.set(3, 4e8, deadline + 90);
        vm.warp(deadline + 100);
        vm.expectRevert("not the deadline round");
        lw.settle(id, 3);
        lw.settle(id, 2);
        vm.expectRevert("not accepted");
        lw.settle(id, 2);
    }
}
