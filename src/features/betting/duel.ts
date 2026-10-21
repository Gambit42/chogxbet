import { BaseError, ContractFunctionRevertedError, ExecutionRevertedError, decodeFunctionResult, encodeFunctionData, formatUnits, parseAbi, parseUnits, zeroAddress, type Address, type PublicClient } from "viem";

// Duel payout math: both sides stake the same amount, 5% of the pot is burned, the winner takes the rest.
export const BURN = 0.05;

export const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const pot = (stake: number) => stake * 2;
export const burned = (stake: number) => pot(stake) * BURN;
export const payout = (stake: number) => pot(stake) - burned(stake);
export const parseStake = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
/** Keeps a typed amount to digits and one point, grouped with commas: "$85000.5x" → "85,000.5". */
export const cleanAmount = (s: string, decimals: number) => {
  const [int, ...dec] = s.replace(/[^\d.]/g, "").split(".");
  const grouped = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec.length ? `${grouped || "0"}.${dec.join("").slice(0, decimals)}` : grouped;
};
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
  "function create(address token, uint256 stake, address feed, bool above, uint256 target, uint64 deadline, uint256 rival) payable returns (uint256)",
  "event DuelCreated(uint256 indexed id, address indexed creator, address token, uint256 stake, address feed, bool above, uint256 target, uint64 deadline, uint256 rival)",
  "function count() view returns (uint256)",
  // status: 0 Open, 1 Accepted, 2 Cancelled, 3 Settled, 4 Refunded; rival: the Chog id a challenge is for, 0 = open to any holder
  "function duels(uint256) view returns (address creator, uint64 deadline, bool above, uint8 status, address opponent, address token, address feed, uint256 stake, uint256 target, uint256 rival)",
  "function settle(uint256 id, uint80 roundId)",
  "function settledBlock(uint256) view returns (uint256)",
  "event DuelSettled(uint256 indexed id, address indexed winner, uint256 price, uint80 roundId)",
  "function accept(uint256 id) payable",
  "function cancel(uint256 id)",
  "function refund(uint256 id)",
  "function claim(address token)",
  "function owed(address token, address wallet) view returns (uint256)",
]);
/** Mirrors ChogDuel.ACCEPT_CUTOFF: a call can't be accepted this close to its deadline. */
export const ACCEPT_CUTOFF = 30;
export const SETTLE_WINDOW = 24 * 60 * 60;

/** Older deployments lack settledBlock; locate the first settled state without scanning event ranges. */
export async function findSettledBlock(client: Pick<PublicClient, "readContract" | "getBlockNumber" | "call">, address: Address, id: bigint, fromBlock = BigInt(0)) {
  try {
    const block = await client.readContract({ address, abi: duelAbi, functionName: "settledBlock", args: [id] });
    if (block === BigInt(0)) throw new Error("Duel has no settlement block");
    return block;
  } catch (error) {
    if (!(error instanceof BaseError) || !error.walk((cause) => cause instanceof ContractFunctionRevertedError)) throw error;
  }
  // shortcut: legacy lookup needs historical RPC state; use indexed events if providers prune it.
  const data = encodeFunctionData({ abi: duelAbi, functionName: "duels", args: [id] });
  const isSettled = async (blockNumber: bigint) => {
    try {
      const result = await client.call({ to: address, data, blockNumber });
      return !!result.data && result.data !== "0x" && decodeFunctionResult({ abi: duelAbi, functionName: "duels", data: result.data })[3] === 3;
    } catch (error) {
      // The public array getter reverts before this duel is created.
      if (error instanceof BaseError && error.walk((cause) => cause instanceof ExecutionRevertedError)) return false;
      throw error;
    }
  };
  let lo = fromBlock;
  let hi = await client.getBlockNumber();
  if (!(await isSettled(hi))) throw new Error("Duel is not settled");
  while (lo < hi) {
    const mid = (lo + hi) / BigInt(2);
    if (await isSettled(mid)) hi = mid;
    else lo = mid + BigInt(1);
  }
  return lo;
}

/** Where a duel stands at unix time `now`: the on-chain status split by the clock (an Open call past its cutoff is Expired, and so on). */
export type Phase = "Open" | "Expired" | "Live" | "Settling" | "Refundable" | "Cancelled" | "Settled" | "Refunded";
export function phase(d: { status: number; deadline: number }, now: number): Phase {
  if (d.status === 0) return now < d.deadline - ACCEPT_CUTOFF ? "Open" : "Expired";
  if (d.status === 1) return now < d.deadline ? "Live" : now < d.deadline + SETTLE_WINDOW ? "Settling" : "Refundable";
  return (["Cancelled", "Settled", "Refunded"] as const)[d.status - 2];
}
/** Seconds → "2d 4h", "3h 12m", "4m 05s". */
export const countdown = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const [d, h, m, sec] = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
};

export const feedAbi = parseAbi([
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

// Two quick deadlines and two long ones (23:59 UTC on that day); "Custom" in the form covers anything else.
// `phrase` finishes the claim: "BTC will be above $90,000 by Dec 31." `blitz` marks the fast one with a bolt in the form.
const inMinutes = (m: number) => () => Math.floor(Date.now() / 1000) + m * 60;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d) / 1000 - 60;
export const DEADLINES: Record<string, { phrase: string; at: () => number; blitz?: true }> = {
  "5 min": { phrase: "in 5 min", at: inMinutes(5), blitz: true },
  "1 hour": { phrase: "in 1 hour", at: inMinutes(60) },
  "Month end": { phrase: "by month end", at: (now = new Date()) => utc(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) },
  "Dec 31": { phrase: "by Dec 31", at: (now = new Date()) => utc(now.getUTCFullYear() + 1, 0, 1) },
};
/** Mirrors ChogDuel.MIN_LEAD: the contract rejects deadlines sooner than this. */
export const MIN_LEAD = 2 * 60;

/** The /og share card's query for a duel. The link preview (duel page metadata) and the creator's in-page preview both build it here, so they match. */
export function cardQuery(d: { above: boolean; target: bigint; deadline: number; stake: bigint; token: Address; status: number; rival: bigint }, asset: string, now?: bigint) {
  const usd = (n: bigint) => `$${fmt(Number(formatUnits(n, TARGET_DECIMALS)))}`;
  const s = Number(formatUnits(d.stake, 18));
  const when = new Date(d.deadline * 1000).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const q = new URLSearchParams({
    asset,
    call: `${d.above ? "above" : "below"} ${usd(d.target)}`,
    when: `by ${when} UTC`,
    stake: `${fmt(s)} ${d.token === zeroAddress ? "MON" : "$CHOG"}`,
    win: fmt(payout(s)),
    cta: d.status !== 0 ? "View duel →" : d.rival ? `#${d.rival}, accept →` : "Seat open →",
  });
  if (d.rival) q.set("rival", String(d.rival));
  if (now !== undefined) q.set("now", usd(now));
  return q;
}
/** Where the creator's share card pick ({ chog?, dark }) waits in their browser for the duel page. */
export const shareKey = (chainId: number, id: bigint) => `chogxbet:share:${chainId}:${id}`;

/** The /og winner card's query for a settled duel: the winner's Chog (`chog`), the loser's (`vs`), and what decided it. */
export function winQuery(d: { target: bigint; stake: bigint; token: Address }, asset: string, price: bigint, loser: Address, chog?: string, vs?: string) {
  const s = Number(formatUnits(d.stake, 18));
  const q = new URLSearchParams({
    won: fmt(payout(s)),
    unit: d.token === zeroAddress ? "MON" : "$CHOG",
    beat: vs ? `Chog #${vs}` : `${loser.slice(0, 6)}…${loser.slice(-4)}`,
    result: `${asset} closed ${price > d.target ? "above" : "below"} $${fmt(Number(formatUnits(d.target, TARGET_DECIMALS)))}`,
  });
  if (chog) q.set("chog", chog);
  if (vs) q.set("vs", vs);
  return q;
}
