// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceFeed} from "./ChogDuel.sol";

/// Last Word: 1v1 price calls played for bragging rights instead of a pot. Each side pays a fixed fee in the token the creator picked,
/// MON (sent to the treasury) or $CHOG (burned), and enters with a Chog it holds. The creator writes the dare, and accepting agrees to it. The first Chainlink round
/// at or after the deadline decides the winner, and the losing Chog wears the dare (`lastWord`) until its next Last Word duel
/// settles: a win or a draw clears it, another loss replaces it. Kept apart from ChogDuel so the real-stakes escrow never changes for it.
/// ponytail: unreviewed, testnet only until an independent review.
contract LastWord is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// The earliest deadline a call may have, so there's time for someone to accept.
    uint256 public constant MIN_LEAD = 2 minutes;
    /// The seat closes this long before the deadline, so nobody accepts once the outcome is near-certain.
    uint256 public constant ACCEPT_CUTOFF = 30 seconds;
    /// An accepted duel not settled within this long after its deadline can't be settled any more: nobody wears anything.
    uint256 public constant SETTLE_WINDOW = 24 hours;
    /// Longest dare in bytes, so it fits a speech bubble.
    uint256 public constant MAX_DARE = 60;
    /// Where $CHOG fees go: burned, like ChogDuel's $CHOG fee.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    enum Status { Open, Accepted, Cancelled, Settled }

    struct Duel {
        address creator;
        uint64 deadline;
        bool above;
        Status status;
        address opponent;
        address feed; // Chainlink USD price feed, 8 decimals
        uint256 target; // USD, 8 decimals
        uint256 rival; // Chog token id only its holder may accept; 0 = any Chog holder (ids start at 1)
        uint256 creatorChog; // the Chog each side entered with, fixed for this duel even if it changes hands
        uint256 opponentChog;
        string dare; // what the losing Chog wears
        address token; // the fee token, address(0) = MON, else $CHOG; last so the getter's earlier fields keep their places
    }

    /// The dare a Chog wears: from `duel`, its latest settled Last Word duel; `active` is false once a win or draw cleared it.
    struct Worn {
        bool active;
        uint256 duel;
    }

    IERC721 public immutable nft;
    IERC20 public immutable chog;
    address public immutable treasury;
    /// MON each side pays to play a MON duel.
    uint256 public immutable fee;
    /// $CHOG each side pays to play a $CHOG duel.
    uint256 public immutable chogFee;
    mapping(address => bool) public isFeed;
    Duel[] public duels;
    /// Block each duel settled in, so the app can link the settle transaction without scanning logs.
    mapping(uint256 => uint256) public settledBlock;
    /// The Chog that won each decisively settled duel; 0 on a draw or before settlement (ids start at 1).
    mapping(uint256 => uint256) public winnerChog;
    mapping(uint256 => Worn) private worn;

    event DuelCreated(uint256 indexed id, address indexed creator, address feed, bool above, uint256 target, uint64 deadline, uint256 rival, uint256 chog, string dare, address token);
    event DuelAccepted(uint256 indexed id, address indexed opponent, uint256 chog);
    event DuelCancelled(uint256 indexed id);
    /// `winner` is address(0) on a draw.
    event DuelSettled(uint256 indexed id, address indexed winner, uint256 price, uint80 roundId);
    /// A settlement put a dare on a Chog (`active`, the loser) or took one off (the winner, or both on a draw).
    /// `dare` is the text the loser now wears, so the settle transaction's logs show the actual line; empty when cleared.
    event LastWordChanged(uint256 indexed chog, uint256 indexed duel, bool active, string dare);

    /// `feeds` is the fixed allowlist of Chainlink feeds; any other feed contract could report whatever price its owner liked.
    constructor(IERC721 nft_, IERC20 chog_, address treasury_, uint256 fee_, uint256 chogFee_, address[] memory feeds) {
        require(treasury_ != address(0), "no treasury");
        nft = nft_;
        chog = chog_;
        treasury = treasury_;
        fee = fee_;
        chogFee = chogFee_;
        for (uint256 i; i < feeds.length; i++) isFeed[feeds[i]] = true;
    }

    /// `rival` turns the call into a challenge: only whoever holds that Chog when accepting can take the seat. 0 leaves it open.
    /// The creator's fee waits here until someone accepts, so cancelling returns it. `token` is the fee token: address(0) for MON, or $CHOG.
    function create(address feed, bool above, uint256 target, uint64 deadline, uint256 rival, uint256 chog_, string calldata dare, address token) external payable nonReentrant returns (uint256 id) {
        _take(token);
        require(nft.ownerOf(chog_) == msg.sender, "not your Chog");
        require(bytes(dare).length > 0 && bytes(dare).length <= MAX_DARE, "dare must be 1-60 bytes");
        require(target > 0, "zero target");
        require(deadline >= block.timestamp + MIN_LEAD, "deadline too soon");
        require(isFeed[feed], "unsupported feed");
        require(rival == 0 || nft.ownerOf(rival) != msg.sender, "own Chog"); // ownerOf also reverts for an unminted id
        id = duels.length;
        duels.push(Duel(msg.sender, deadline, above, Status.Open, address(0), feed, target, rival, chog_, 0, dare, token));
        emit DuelCreated(id, msg.sender, feed, above, target, deadline, rival, chog_, dare, token);
    }

    /// Takes the other side and agrees to the dare, paying the same fee in the same token. Both fees leave now that the duel is on.
    function accept(uint256 id, uint256 chog_) external payable nonReentrant {
        Duel storage d = duels[id];
        _take(d.token);
        require(d.status == Status.Open, "not open");
        require(msg.sender != d.creator, "own duel");
        require(block.timestamp + ACCEPT_CUTOFF <= d.deadline, "too late to accept");
        require(nft.ownerOf(chog_) == msg.sender, "not your Chog");
        require(d.rival == 0 || chog_ == d.rival, "not the challenged Chog");
        require(chog_ != d.creatorChog, "same Chog"); // the creator's Chog may have changed hands since
        d.status = Status.Accepted;
        d.opponent = msg.sender;
        d.opponentChog = chog_;
        emit DuelAccepted(id, msg.sender, chog_);
        if (d.token == address(0)) _send(treasury, fee * 2);
        else chog.safeTransfer(DEAD, chogFee * 2);
    }

    /// The creator takes back a call nobody has accepted, and the fee with it.
    function cancel(uint256 id) external nonReentrant {
        Duel storage d = duels[id];
        require(d.creator == msg.sender, "not yours");
        require(d.status == Status.Open, "not open");
        d.status = Status.Cancelled;
        emit DuelCancelled(id);
        if (d.token == address(0)) _send(msg.sender, fee);
        else chog.safeTransfer(msg.sender, chogFee);
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
        settledBlock[id] = block.number;

        uint256 p = uint256(price);
        if (p == d.target) {
            emit DuelSettled(id, address(0), p, roundId);
            _wear(d.creatorChog, id, false);
            _wear(d.opponentChog, id, false);
            return;
        }
        bool creatorWon = (p > d.target) == d.above;
        (uint256 won, uint256 lost) = creatorWon ? (d.creatorChog, d.opponentChog) : (d.opponentChog, d.creatorChog);
        winnerChog[id] = won;
        emit DuelSettled(id, creatorWon ? d.creator : d.opponent, p, roundId);
        _wear(won, id, false);
        _wear(lost, id, true);
    }

    function count() external view returns (uint256) {
        return duels.length;
    }

    /// What a Chog wears now: the dare from the Last Word duel it most recently lost, unless a later win or draw cleared it.
    function lastWord(uint256 chogId) external view returns (bool active, uint256 duel, string memory dare) {
        Worn memory w = worn[chogId];
        return (w.active, w.duel, w.active ? duels[w.duel].dare : "");
    }

    function _wear(uint256 chogId, uint256 id, bool active) private {
        worn[chogId] = Worn(active, id);
        emit LastWordChanged(chogId, id, active, active ? duels[id].dare : "");
    }

    /// Collects one side's fee: exactly `fee` in MON, or `chogFee` $CHOG (approved beforehand) with no MON attached.
    function _take(address token) private {
        if (token == address(0)) {
            require(msg.value == fee, "wrong fee");
        } else {
            require(token == address(chog) && msg.value == 0, "wrong fee");
            chog.safeTransferFrom(msg.sender, address(this), chogFee);
        }
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "MON transfer failed");
    }
}
