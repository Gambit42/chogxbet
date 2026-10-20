import { parseAbi, parseUnits, type Address, type PublicClient } from "viem";

// Duel payout math: both sides stake the same amount, 5% of the pot is burned, the winner takes the rest.
export const BURN = 0.05;

export const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const pot = (stake: number) => stake * 2;
export const burned = (stake: number) => pot(stake) * BURN;
export const payout = (stake: number) => pot(stake) - burned(stake);
export const parseStake = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
/** Typed amount → base units for the contract; 0 when it isn't a plain decimal. */
export const toUnits = (s: string, decimals: number) => {
  try {
    return parseUnits(s.replace(/,/g, "").trim(), decimals);
  } catch {
    return BigInt(0);
  }
};

// The ChogDuel escrow's calls the app makes. Targets are USD with 8 decimals.
export const TARGET_DECIMALS = 8;
export const duelAbi = parseAbi([
  "function create(address token, uint256 stake, address feed, bool above, uint256 target, uint64 deadline) payable returns (uint256)",
  "event DuelCreated(uint256 indexed id, address indexed creator, address token, uint256 stake, address feed, bool above, uint256 target, uint64 deadline)",
  "function count() view returns (uint256)",
  // status: 0 Open, 1 Accepted, 2 Cancelled, 3 Settled, 4 Refunded
  "function duels(uint256) view returns (address creator, uint64 deadline, bool above, uint8 status, address opponent, address token, address feed, uint256 stake, uint256 target)",
  "function settle(uint256 id, uint80 roundId)",
]);
export const SETTLE_WINDOW = 24 * 60 * 60;

const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function getRoundData(uint80) view returns (uint80, int256, uint256, uint256, uint80)",
]);

/** The Chainlink feed's first round at or after `deadline` (what `settle` takes), or undefined if it hasn't posted one yet. */
export async function findRound(client: Pick<PublicClient, "readContract">, feed: Address, deadline: bigint) {
  const [latest, , , latestAt] = await client.readContract({ address: feed, abi: feedAbi, functionName: "latestRoundData" });
  if (latestAt < deadline) return;
  // Round IDs are phase << 64 | n, so binary search n within the current phase.
  // ponytail: a deadline before the current phase began isn't found; such a duel refunds after SETTLE_WINDOW.
  const phase = (latest >> BigInt(64)) << BigInt(64);
  let [lo, hi] = [BigInt(1), latest - phase];
  while (lo < hi) {
    const mid = (lo + hi) / BigInt(2);
    const [, , , at] = await client.readContract({ address: feed, abi: feedAbi, functionName: "getRoundData", args: [phase + mid] });
    if (at >= deadline) hi = mid;
    else lo = mid + BigInt(1);
  }
  return phase + lo;
}

// Each deadline is 23:59 UTC on that day.
const endOfDay = (days: number, now = new Date()) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days + 1) / 1000 - 60;
export const DEADLINES: Record<string, (now?: Date) => number> = {
  Tomorrow: (now) => endOfDay(1, now),
  Friday: (now = new Date()) => endOfDay((5 - now.getUTCDay() + 7) % 7 || 7, now),
  "Month end": (now = new Date()) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000 - 60,
  "Dec 31": (now = new Date()) => Date.UTC(now.getUTCFullYear() + 1, 0, 1) / 1000 - 60,
};
