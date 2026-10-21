// Settles every accepted duel whose deadline has passed, then exits. Runs as a Railway cron (*/5 * * * *): node scripts/settle.mts
// Env: DUEL_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY (a wallet holding only gas MON; settling is permissionless, so it has no other power),
// NETWORK=mainnet|testnet (default testnet), optional RPC_URL. On testnet it first copies the two mainnet Chainlink rounds each duel
// settles on into its FeedMirror (optional MAINNET_RPC_URL).
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad, monadTestnet } from "viem/chains";
import { duelAbi, feedAbi, findRound, SETTLE_WINDOW } from "../src/features/betting/duel.ts";
import { NETWORKS } from "../src/features/betting/networks.ts";

const { DUEL_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY, NETWORK, RPC_URL, MAINNET_RPC_URL } = process.env;
if (!DUEL_CONTRACT_ADDRESS || !SETTLER_PRIVATE_KEY) throw new Error("Set DUEL_CONTRACT_ADDRESS and SETTLER_PRIVATE_KEY");
// Accept the key with or without 0x, quotes or stray whitespace (viem blindly slices off the first two chars).
const key = SETTLER_PRIVATE_KEY.trim().replace(/^["']|["']$/g, "").replace(/^0x/i, "");
if (!/^[0-9a-fA-F]{64}$/.test(key)) throw new Error(`SETTLER_PRIVATE_KEY must be 64 hex chars (got ${key.length} chars after trimming)`);
const duel = DUEL_CONTRACT_ADDRESS as Address;
const chain = NETWORK === "mainnet" ? monad : monadTestnet;
const transport = http(RPC_URL);
const client = createPublicClient({ chain, transport });
const wallet = createWalletClient({ chain, transport, account: privateKeyToAccount(`0x${key}` as Hex) });

// On testnet each duel's feed is a FeedMirror; map it back to the mainnet Chainlink feed it copies.
const mainnet = createPublicClient({ chain: monad, transport: http(MAINNET_RPC_URL) });
const mirrorAbi = parseAbi(["function times(uint80) view returns (uint256)", "function push(uint80 id, int256 answer, uint256 updatedAt)"]);
const sourceOf = new Map(
  chain.id === monadTestnet.id
    ? Object.entries(NETWORKS.testnet.feeds).map(([asset, mirror]) => [mirror!.toLowerCase(), NETWORKS.mainnet.feeds[asset]!])
    : [],
);

const { timestamp: now } = await client.getBlock(); // chain time, the clock settle checks
const count = await client.readContract({ address: duel, abi: duelAbi, functionName: "count" });
let settled = 0;
// ponytail: reads every duel each run; index DuelAccepted events once there are thousands.
for (let id = BigInt(0); id < count; id++) {
  const [, deadline, , status, , , feed] = await client.readContract({ address: duel, abi: duelAbi, functionName: "duels", args: [id] });
  if (status !== 1 || BigInt(deadline) > now || BigInt(deadline) + BigInt(SETTLE_WINDOW) <= now) continue;
  try {
    const source = sourceOf.get(feed.toLowerCase());
    const round = await findRound(source ? mainnet : client, source ?? feed, BigInt(deadline));
    if (round === undefined) {
      console.log(`duel ${id}: no price after the deadline yet`);
      continue;
    }
    // settle reads only this round and the one before it, so those are the only two the mirror needs.
    if (source) for (const r of [round - BigInt(1), round]) {
      if (await client.readContract({ address: feed, abi: mirrorAbi, functionName: "times", args: [r] })) continue;
      const [, answer, , updatedAt] = await mainnet.readContract({ address: source, abi: feedAbi, functionName: "getRoundData", args: [r] });
      await client.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: feed, abi: mirrorAbi, functionName: "push", args: [r, answer, updatedAt] }) });
      console.log(`duel ${id}: mirrored round ${r} (${answer})`);
    }
    // Simulating first turns a revert into a readable error instead of a failed transaction that still costs gas.
    const { request } = await client.simulateContract({ address: duel, abi: duelAbi, functionName: "settle", args: [id, round], account: wallet.account });
    const hash = await wallet.writeContract(request);
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`duel ${id}: settled at round ${round} (${receipt.status}) ${hash}`);
    settled++;
  } catch (e) {
    console.error(`duel ${id}: ${(e as { shortMessage?: string }).shortMessage ?? e}`);
    process.exitCode = 1;
  }
}
console.log(`${chain.name}: checked ${count} duels, settled ${settled}`);
