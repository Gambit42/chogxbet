// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// The part of Chainlink's AggregatorV3Interface that settlement reads.
interface IPriceFeed {
    function getRoundData(uint80 roundId) external view returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80);
}

/// Escrow for 1v1 price calls. A Chog holder locks a stake (MON or $CHOG) on "feed will be above/below target at deadline",
/// one other Chog holder matches it, and the first Chainlink round at or after the deadline decides the winner.
/// Payouts and refunds are credited to `owed` and withdrawn with `claim`, so one wallet refusing a transfer can't block the other.
/// ponytail: unreviewed, testnet only until an independent review.
contract ChogDuel is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// The earliest deadline a call may have, so there's time for someone to accept.
    uint256 public constant MIN_LEAD = 2 minutes;
    /// The seat closes this long before the deadline, so nobody accepts once the outcome is near-certain.
    uint256 public constant ACCEPT_CUTOFF = 30 seconds;
    /// An accepted duel not settled within this long after its deadline refunds both stakes instead.
    uint256 public constant SETTLE_WINDOW = 24 hours;
    /// 5% of the pot: $CHOG is burned, MON goes to the treasury ($CHOG buyback fund).
    uint256 public constant FEE_BPS = 500;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    enum Status { Open, Accepted, Cancelled, Settled, Refunded }

    struct Duel {
        address creator;
        uint64 deadline;
        bool above;
        Status status;
        address opponent;
        address token; // address(0) = MON
        address feed; // Chainlink USD price feed, 8 decimals
        uint256 stake;
        uint256 target; // USD, 8 decimals
    }

    IERC20 public immutable chog;
    IERC721 public immutable nft;
    address public immutable treasury;
    mapping(address => bool) public isFeed;
    /// Payouts and refunds waiting to be claimed: token => wallet => amount.
    mapping(address => mapping(address => uint256)) public owed;
    Duel[] public duels;

    event DuelCreated(uint256 indexed id, address indexed creator, address token, uint256 stake, address feed, bool above, uint256 target, uint64 deadline);
    event DuelAccepted(uint256 indexed id, address indexed opponent);
    event DuelCancelled(uint256 indexed id);
    /// `winner` is address(0) on a tie, which refunds both stakes with no fee.
    event DuelSettled(uint256 indexed id, address indexed winner, uint256 price, uint80 roundId);
    event DuelRefunded(uint256 indexed id);
    event Claimed(address indexed wallet, address token, uint256 amount);

    /// `feeds` is the fixed allowlist of Chainlink feeds; any other feed contract could report whatever price its owner liked.
    constructor(IERC20 chog_, IERC721 nft_, address treasury_, address[] memory feeds) {
        require(treasury_ != address(0), "no treasury");
        chog = chog_;
        nft = nft_;
        treasury = treasury_;
        for (uint256 i; i < feeds.length; i++) isFeed[feeds[i]] = true;
    }

    function create(address token, uint256 stake, address feed, bool above, uint256 target, uint64 deadline) external payable nonReentrant returns (uint256 id) {
        require(nft.balanceOf(msg.sender) > 0, "need a Chog");
        require(stake > 0 && target > 0, "zero stake or target");
        require(deadline >= block.timestamp + MIN_LEAD, "deadline too soon");
        require(token == address(0) || token == address(chog), "unsupported token");
        require(isFeed[feed], "unsupported feed");
        id = duels.length;
        duels.push(Duel(msg.sender, deadline, above, Status.Open, address(0), token, feed, stake, target));
        emit DuelCreated(id, msg.sender, token, stake, feed, above, target, deadline);
        _pull(token, stake);
    }

    /// Takes the other side: the first Chog holder to match the stake gets the one seat.
    function accept(uint256 id) external payable nonReentrant {
        Duel storage d = duels[id];
        require(d.status == Status.Open, "not open");
        require(msg.sender != d.creator, "own duel");
        require(block.timestamp + ACCEPT_CUTOFF <= d.deadline, "too late to accept");
        require(nft.balanceOf(msg.sender) > 0, "need a Chog");
        d.status = Status.Accepted;
        d.opponent = msg.sender;
        emit DuelAccepted(id, msg.sender);
        _pull(d.token, d.stake);
    }

    /// The creator takes back a call nobody has accepted.
    function cancel(uint256 id) external nonReentrant {
        Duel storage d = duels[id];
        require(d.creator == msg.sender, "not yours");
        require(d.status == Status.Open, "not open");
        d.status = Status.Cancelled;
        emit DuelCancelled(id);
        _send(d.token, msg.sender, d.stake);
    }

    /// Anyone can settle once the deadline passes, by naming the feed's first round at or after it.
    /// Exactly one round qualifies (its predecessor is before the deadline), so the caller can't shop for a friendlier price.
    function settle(uint256 id, uint80 roundId) external nonReentrant {
        Duel storage d = duels[id];
        require(d.status == Status.Accepted, "not accepted");
        require(block.timestamp >= d.deadline, "too early");
        require(block.timestamp < d.deadline + SETTLE_WINDOW, "settle window over");
        (, int256 price,, uint256 at,) = IPriceFeed(d.feed).getRoundData(roundId);
        (,,, uint256 prevAt,) = IPriceFeed(d.feed).getRoundData(roundId - 1);
        // prevAt > 0 rules out the first round of a new Chainlink phase, whose predecessor doesn't exist.
        require(at >= d.deadline && prevAt > 0 && prevAt < d.deadline, "not the deadline round");
        require(price > 0, "bad price");
        d.status = Status.Settled;

        uint256 p = uint256(price);
        address winner = p == d.target ? address(0) : (p > d.target) == d.above ? d.creator : d.opponent;
        emit DuelSettled(id, winner, p, roundId);
        if (winner == address(0)) {
            owed[d.token][d.creator] += d.stake;
            owed[d.token][d.opponent] += d.stake;
            return;
        }
        uint256 pot = d.stake * 2;
        uint256 fee = pot * FEE_BPS / 10_000;
        owed[d.token][winner] += pot - fee;
        if (d.token == address(0)) owed[address(0)][treasury] += fee;
        else chog.safeTransfer(DEAD, fee);
    }

    /// Refunds both stakes when a duel went unsettled for SETTLE_WINDOW (e.g. the feed stalled). Settle and refund never overlap.
    function refund(uint256 id) external nonReentrant {
        Duel storage d = duels[id];
        require(d.status == Status.Accepted, "not accepted");
        require(block.timestamp >= d.deadline + SETTLE_WINDOW, "still settling");
        d.status = Status.Refunded;
        owed[d.token][d.creator] += d.stake;
        owed[d.token][d.opponent] += d.stake;
        emit DuelRefunded(id);
    }

    /// Withdraws everything owed to the caller in one token (address(0) = MON).
    function claim(address token) external nonReentrant {
        uint256 amount = owed[token][msg.sender];
        require(amount > 0, "nothing owed");
        owed[token][msg.sender] = 0;
        emit Claimed(msg.sender, token, amount);
        _send(token, msg.sender, amount);
    }

    function count() external view returns (uint256) {
        return duels.length;
    }

    /// Takes a stake from the caller: MON with the call, $CHOG by allowance.
    function _pull(address token, uint256 amount) private {
        if (token == address(0)) {
            require(msg.value == amount, "wrong MON amount");
        } else {
            require(msg.value == 0, "wrong MON amount");
            chog.safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    function _send(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "MON transfer failed");
        } else {
            chog.safeTransfer(to, amount);
        }
    }
}
