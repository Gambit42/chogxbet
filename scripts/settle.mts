// Settles every accepted duel whose deadline has passed, then exits. Runs as a Railway cron (*/5 * * * *): node scripts/settle.mts
// Env: DUEL_ADDRESS, SETTLER_PRIVATE_KEY (a wallet holding only gas MON; settling is permissionless, so it has no other power),
// NETWORK=mainnet|testnet (default testnet), optional RPC_URL.
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad, monadTestnet } from "viem/chains";
import { duelAbi, findRound, SETTLE_WINDOW } from "../src/features/betting/duel.ts";

const { DUEL_ADDRESS, SETTLER_PRIVATE_KEY, NETWORK, RPC_URL } = process.env;
if (!DUEL_ADDRESS || !SETTLER_PRIVATE_KEY) throw new Error("Set DUEL_ADDRESS and SETTLER_PRIVATE_KEY");
const duel = DUEL_ADDRESS as Address;
const chain = NETWORK === "mainnet" ? monad : monadTestnet;
const transport = http(RPC_URL);
const client = createPublicClient({ chain, transport });
const wallet = createWalletClient({ chain, transport, account: privateKeyToAccount(SETTLER_PRIVATE_KEY as Hex) });

const { timestamp: now } = await client.getBlock(); // chain time, the clock settle checks
const count = await client.readContract({ address: duel, abi: duelAbi, functionName: "count" });
let settled = 0;
// ponytail: reads every duel each run; index DuelAccepted events once there are thousands.
for (let id = BigInt(0); id < count; id++) {
  const [, deadline, , status, , , feed] = await client.readContract({ address: duel, abi: duelAbi, functionName: "duels", args: [id] });
  if (status !== 1 || BigInt(deadline) > now || BigInt(deadline) + BigInt(SETTLE_WINDOW) <= now) continue;
  try {
    const round = await findRound(client, feed, BigInt(deadline));
    if (round === undefined) {
      console.log(`duel ${id}: no price after the deadline yet`);
      continue;
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
