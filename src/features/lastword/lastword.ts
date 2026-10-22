import { parseAbi, zeroAddress } from "viem";
// Relative with .ts so the settle bot can import this file under plain Node, which doesn't know the @/ alias.
import { cardQuery } from "../betting/duel.ts";

// The LastWord contract's calls the app and settle bot make. Targets are USD with 8 decimals, like ChogDuel.
export const lastWordAbi = parseAbi([
  // token: the fee token, address(0) = MON, else $CHOG (approved beforehand; no MON attached)
  "function create(address feed, bool above, uint256 target, uint64 deadline, uint256 rival, uint256 chog, string dare, address token) payable returns (uint256)",
  "event DuelCreated(uint256 indexed id, address indexed creator, address feed, bool above, uint256 target, uint64 deadline, uint256 rival, uint256 chog, string dare, address token)",
  "function accept(uint256 id, uint256 chog) payable",
  "function cancel(uint256 id)",
  "function settle(uint256 id, uint80 roundId)",
  "event DuelSettled(uint256 indexed id, address indexed winner, uint256 price, uint80 roundId)",
  "function count() view returns (uint256)",
  "function fee() view returns (uint256)",
  "function chogFee() view returns (uint256)",
  // status: 0 Open, 1 Accepted, 2 Cancelled, 3 Settled; rival: the Chog a challenge is for, 0 = any holder; opponentChog 0 = seat open
  "function duels(uint256) view returns (address creator, uint64 deadline, bool above, uint8 status, address opponent, address feed, uint256 target, uint256 rival, uint256 creatorChog, uint256 opponentChog, string dare, address token)",
  // What a Chog wears now: the dare from its latest Last Word loss, cleared by a later win or draw
  "function lastWord(uint256 chog) view returns (bool active, uint256 duel, string dare)",
  "function winnerChog(uint256) view returns (uint256)",
  "function settledBlock(uint256) view returns (uint256)",
]);

/** What each side pays to play, in the token the creator picked: MON goes to the treasury, $CHOG is burned. Mirrors DeployLastWord.s.sol. */
export const LW_FEE = 1;
export const LW_CHOG_FEE = 10;
/** A duel's entry fee as text, "10 $CHOG" or "1 MON". */
export const lwFee = (d: { token: string }) => (d.token === zeroAddress ? `${LW_FEE} MON` : `${LW_CHOG_FEE} $CHOG`);
/** Mirrors LastWord.MAX_DARE (bytes, not characters: an emoji takes 4). */
export const MAX_DARE = 60;
export const dareBytes = (s: string) => new TextEncoder().encode(s).length;
/** Cuts a dare to MAX_DARE bytes at a whole character, so typing or pasting past the limit just stops there. */
export function clipDare(s: string) {
  let out = "";
  for (const ch of s) {
    if (dareBytes(out + ch) > MAX_DARE) break;
    out += ch;
  }
  return out;
}
/** One-tap starters for the dare box; the creator can write anything. Each reads right whichever side loses. */
export const DARE_IDEAS = ["My source was a group chat.", "I had conviction. Unfortunately.", "Inverse me next time.", "I got out-called by a Chog.", "Charts are just vibes."];

/** The /og share card's query for a Last Word duel: the stakes card with the dare in place of the stake. The dare page and its link preview both build it here. */
export function lwCardQuery(d: { above: boolean; target: bigint; deadline: number; status: number; rival: bigint; creatorChog: bigint; dare: string }, asset: string) {
  const q = cardQuery({ ...d, stake: BigInt(0), token: zeroAddress }, asset);
  if (d.status === 0 && !d.rival) q.set("cta", "Take the dare →");
  q.set("dare", d.dare);
  q.set("chog", String(d.creatorChog));
  return q;
}
