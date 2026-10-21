import assert from "node:assert/strict";
import { test } from "node:test";
import { ContractFunctionRevertedError, ExecutionRevertedError, encodeFunctionResult, zeroAddress } from "viem";
import { duelAbi, findSettledBlock } from "../src/features/betting/duel.ts";

const address = zeroAddress;
const result = (status) => encodeFunctionResult({ abi: duelAbi, functionName: "duels", result: [address, 0n, false, status, address, address, address, 0n, 0n, 0n] });
const legacy = (settledAt) => ({
  readContract: async () => { throw new ContractFunctionRevertedError({ abi: duelAbi, functionName: "settledBlock" }); },
  getBlockNumber: async () => 1000n,
  call: async ({ blockNumber }) => ({ data: blockNumber < 10n ? "0x" : result(blockNumber >= settledAt ? 3 : 1) }),
});

test("uses recorded settlement block when supported", async () => {
  assert.equal(await findSettledBlock({ readContract: async () => 42n }, address, 0n), 42n);
});
test("finds the first settled block, including pre-deployment history", async () => {
  for (const block of [10n, 11n, 500n, 1000n]) {
    assert.equal(await findSettledBlock(legacy(block), address, 0n), block);
  }
});
test("does not turn transport errors into a historical search", async () => {
  await assert.rejects(findSettledBlock({ readContract: async () => { throw new Error("offline"); } }, address, 0n), /offline/);
});
test("rejects unsettled duels and unavailable historical state", async () => {
  await assert.rejects(findSettledBlock(legacy(1001n), address, 0n), /not settled/);
  await assert.rejects(findSettledBlock({ ...legacy(500n), call: async () => { throw new Error("history unavailable"); } }, address, 0n), /history unavailable/);
});

test("handles the array getter reverting before duel creation", async () => {
  const client = legacy(500n);
  const call = client.call;
  client.call = async (args) => {
    assert.ok(args.blockNumber >= 100n);
    if (args.blockNumber < 400n) throw new ExecutionRevertedError({});
    return call(args);
  };
  assert.equal(await findSettledBlock(client, address, 0n, 100n), 500n);
});
