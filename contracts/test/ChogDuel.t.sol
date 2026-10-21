// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ChogDuel} from "../src/ChogDuel.sol";
import {MockChog} from "../src/testnet/MockChog.sol";
import {MockChogNFT} from "../src/testnet/MockChogNFT.sol";
import {FeedMirror} from "../src/testnet/FeedMirror.sol";

// Cheatcodes, declared here so the test needs no forge-std.
interface Vm {
    function deal(address, uint256) external;
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes calldata) external;
    function warp(uint256) external;
}

/// Stand-in for a Chainlink feed whose rounds the test writes.
contract MockFeed {
    mapping(uint80 => int256) price;
    mapping(uint80 => uint256) at;
    uint80 latest;

    function set(uint80 id, int256 p, uint256 t) external {
        (price[id], at[id]) = (p, t);
        if (id > latest) latest = id;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (latest, price[latest], at[latest], at[latest], latest);
    }

    function getRoundData(uint80 id) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (id, price[id], at[id], at[id], id);
    }
}

contract ChogDuelTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    MockChog chog = new MockChog();
    MockChogNFT nft = new MockChogNFT();
    MockFeed feed = new MockFeed();
    address treasury = address(0x7EA);
    ChogDuel duel;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint64 deadline;

    function setUp() public {
        address[] memory feeds = new address[](1);
        feeds[0] = address(feed);
        duel = new ChogDuel(chog, nft, treasury, feeds);
        deadline = uint64(block.timestamp + 1 days);
        for (uint256 i; i < 2; i++) {
            address a = i == 0 ? alice : bob;
            nft.mint(a);
            vm.deal(a, 10 ether);
            chog.mint(a, 100 ether);
        }
    }

    /// Alice calls "above $5" with a 1 MON stake; bob takes the other side.
    function monDuel() internal returns (uint256 id) {
        vm.prank(alice);
        id = duel.create{value: 1 ether}(address(0), 1 ether, address(feed), true, 5e8, deadline);
        vm.prank(bob);
        duel.accept{value: 1 ether}(id);
    }

    /// Round 1 is before the deadline, round 2 is the first after it, round 3 is later.
    function priceAtDeadline(int256 p) internal {
        feed.set(1, 1e8, deadline - 30);
        feed.set(2, p, deadline + 30);
        feed.set(3, 9e8, deadline + 90);
        vm.warp(deadline + 100);
    }

    function test_monCreateAndCancel() public {
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(address(0), 1 ether, address(feed), true, 5e8, deadline);
        require(address(duel).balance == 1 ether && alice.balance == 9 ether, "stake not escrowed");

        vm.expectRevert("not yours");
        duel.cancel(id);

        vm.prank(alice);
        duel.cancel(id);
        require(alice.balance == 10 ether, "stake not refunded");

        vm.prank(alice);
        vm.expectRevert("not open");
        duel.cancel(id);
    }

    function test_chogCreateAndCancel() public {
        vm.startPrank(alice);
        chog.approve(address(duel), 10 ether);
        uint256 id = duel.create(address(chog), 10 ether, address(feed), false, 5e8, deadline);
        require(chog.balanceOf(address(duel)) == 10 ether, "stake not escrowed");
        duel.cancel(id);
        vm.stopPrank();
        require(chog.balanceOf(alice) == 100 ether, "stake not refunded");
    }

    function test_rejects() public {
        vm.deal(address(this), 1 ether);
        vm.expectRevert("need a Chog");
        duel.create{value: 1 ether}(address(0), 1 ether, address(feed), true, 5e8, deadline);

        vm.startPrank(alice);
        vm.expectRevert("wrong MON amount");
        duel.create{value: 0.5 ether}(address(0), 1 ether, address(feed), true, 5e8, deadline);
        vm.expectRevert("deadline too soon");
        duel.create{value: 1 ether}(address(0), 1 ether, address(feed), true, 5e8, uint64(block.timestamp + 1 minutes));
        vm.expectRevert("unsupported token");
        duel.create(address(nft), 1 ether, address(feed), true, 5e8, deadline);
        vm.expectRevert("unsupported feed");
        duel.create{value: 1 ether}(address(0), 1 ether, address(0xBAD), true, 5e8, deadline);
        vm.stopPrank();
    }

    function test_accept() public {
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(address(0), 1 ether, address(feed), true, 5e8, deadline);

        vm.prank(alice);
        vm.expectRevert("own duel");
        duel.accept{value: 1 ether}(id);
        vm.deal(address(this), 1 ether);
        vm.expectRevert("need a Chog");
        duel.accept{value: 1 ether}(id);
        vm.prank(bob);
        vm.expectRevert("wrong MON amount");
        duel.accept{value: 0.5 ether}(id);

        vm.prank(bob);
        duel.accept{value: 1 ether}(id);
        require(address(duel).balance == 2 ether, "stakes not escrowed");

        // One seat: a third Chog holder can't take it, and the creator can no longer cancel.
        address carol = address(0xCA201);
        nft.mint(carol);
        vm.deal(carol, 1 ether);
        vm.prank(carol);
        vm.expectRevert("not open");
        duel.accept{value: 1 ether}(id);
        vm.prank(alice);
        vm.expectRevert("not open");
        duel.cancel(id);
    }

    function test_acceptCutoff() public {
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(address(0), 1 ether, address(feed), true, 5e8, deadline);
        vm.warp(deadline - 20 seconds);
        vm.prank(bob);
        vm.expectRevert("too late to accept");
        duel.accept{value: 1 ether}(id);
    }

    function test_settleMonCreatorWins() public {
        uint256 id = monDuel();
        vm.expectRevert("too early");
        duel.settle(id, 2);

        priceAtDeadline(6e8); // $6 > $5: alice's "above" is right
        vm.expectRevert("not the deadline round");
        duel.settle(id, 1); // before the deadline
        vm.expectRevert("not the deadline round");
        duel.settle(id, 3); // a later round, $9
        duel.settle(id, 2);

        // Pot 2 MON: 5% (0.1) to the treasury, 1.9 to alice.
        require(duel.owed(address(0), alice) == 1.9 ether, "wrong payout");
        require(duel.owed(address(0), treasury) == 0.1 ether, "wrong fee");
        require(duel.owed(address(0), bob) == 0, "loser paid");
        vm.expectRevert("not accepted");
        duel.settle(id, 2);

        vm.prank(alice);
        duel.claim(address(0));
        require(alice.balance == 10.9 ether, "claim not paid");
        vm.prank(alice);
        vm.expectRevert("nothing owed");
        duel.claim(address(0));
    }

    function test_settleChogOpponentWinsAndBurns() public {
        vm.startPrank(alice);
        chog.approve(address(duel), 10 ether);
        uint256 id = duel.create(address(chog), 10 ether, address(feed), true, 5e8, deadline);
        vm.stopPrank();
        vm.startPrank(bob);
        chog.approve(address(duel), 10 ether);
        duel.accept(id);
        vm.stopPrank();

        priceAtDeadline(4e8); // $4 < $5: bob wins
        duel.settle(id, 2);
        require(duel.owed(address(chog), bob) == 19 ether, "wrong payout");
        require(chog.balanceOf(duel.DEAD()) == 1 ether, "fee not burned");
        vm.prank(bob);
        duel.claim(address(chog));
        require(chog.balanceOf(bob) == 109 ether, "claim not paid");
        require(chog.balanceOf(address(duel)) == 0, "escrow not empty");
    }

    function test_tieRefundsBoth() public {
        uint256 id = monDuel();
        priceAtDeadline(5e8); // exactly the target
        duel.settle(id, 2);
        require(duel.owed(address(0), alice) == 1 ether && duel.owed(address(0), bob) == 1 ether, "tie not refunded");
        require(duel.owed(address(0), treasury) == 0, "fee on a tie");
    }

    function test_refundWhenUnsettled() public {
        uint256 id = monDuel();
        vm.warp(deadline + 1 hours);
        vm.expectRevert("still settling");
        duel.refund(id);

        priceAtDeadline(6e8);
        vm.warp(deadline + 24 hours);
        vm.expectRevert("settle window over");
        duel.settle(id, 2);
        duel.refund(id);
        require(duel.owed(address(0), alice) == 1 ether && duel.owed(address(0), bob) == 1 ether, "not refunded");
        vm.expectRevert("not accepted");
        duel.refund(id);
    }

    function test_feedMirror() public {
        FeedMirror m = new FeedMirror(address(this));
        m.push(5, 8e12, 100);
        (uint80 id, int256 p,, uint256 at,) = m.getRoundData(5);
        require(id == 5 && p == 8e12 && at == 100, "round not stored");
        vm.expectRevert("round already set");
        m.push(5, 1, 200);
        vm.prank(alice);
        vm.expectRevert("not updater");
        m.push(6, 1, 200);
    }

    function test_faucetCaps() public {
        chog.mint(alice, 9_900 ether); // alice already has 100
        vm.expectRevert("faucet limit reached");
        chog.mint(alice, 1);
        vm.warp(block.timestamp + 1 days);
        require(chog.minted(alice) == 0, "minted didn't reset");
        chog.mint(alice, 10_000 ether); // new day, fresh allowance
        require(chog.minted(alice) == 10_000 ether, "minted not tracked");
        for (uint256 i; i < 4; i++) nft.mint(alice); // alice already has 1
        vm.expectRevert("faucet limit reached");
        nft.mint(alice);
    }
}
