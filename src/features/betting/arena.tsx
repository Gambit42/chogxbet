"use client";
/* eslint-disable @next/next/no-img-element -- Chog art comes from IPFS. */
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { erc20Abi, formatUnits, zeroAddress, type Address } from "viem";
import { useConfig, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { short } from "./app-shell";
import { countdown, duelAbi, fmt, payout, phase, TARGET_DECIMALS, type Phase } from "./duel";
import { ipfs, useOwnedChogs } from "@/features/profile/chogs";
import { needWallet, useWallet, walletLabel, type AppWallet } from "./wallet";

const btn = "inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]";

export type Duel = { id: bigint; creator: Address; deadline: number; above: boolean; status: number; opponent: Address; token: Address; feed: Address; stake: bigint; target: bigint };
type Row = readonly [Address, bigint, boolean, number, Address, Address, Address, bigint, bigint];
export const toDuel = ([creator, deadline, above, status, opponent, token, feed, stake, target]: Row, id: bigint): Duel =>
  ({ id, creator, deadline: Number(deadline), above, status, opponent, token, feed, stake, target });

const everySecond = (fn: () => void) => {
  const t = setInterval(fn, 1000);
  return () => clearInterval(t);
};
/** Unix seconds, ticking once a second; 0 during prerender, which must not read the clock. */
export const useNow = () => useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000), () => 0);

/** Every duel in the escrow, newest first; undefined while loading. */
export function useDuels() {
  const { chain, duel } = useWallet().net;
  const count = useReadContract({ address: duel, abi: duelAbi, functionName: "count", chainId: chain.id, query: { enabled: !!duel } });
  const n = Number(count.data ?? 0);
  // ponytail: reads every duel on each load; switch to DuelCreated logs or an indexer once there are hundreds.
  const all = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({ address: duel!, abi: duelAbi, functionName: "duels", args: [BigInt(i)], chainId: chain.id }) as const),
    query: { enabled: n > 0, select: (rows) => rows.map((r, i) => toDuel(r, BigInt(i))).reverse() },
  });
  if (!duel || (count.isSuccess && n === 0)) return [];
  return all.data;
}

export function Arena() {
  const w = useWallet();
  const duels = useDuels();
  const now = useNow();
  const [only, setOnly] = useState<string>();
  const assets = Object.keys(w.net.feeds);
  const open = duels?.filter((d) => phase(d, now) === "Open");
  const calls = open?.filter((d) => !only || assetOf(w, d) === only);
  const chip = (on: boolean) => `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium ${on ? "border-[#1A1130] bg-[#1A1130] text-white" : "border-[#DCD5EC] bg-white text-[#4A4063] hover:border-[#C9BFE3]"}`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Open calls</h1>
          <p className="mt-1.5 text-[15px] text-[#6B6185]">Pick a call you disagree with. Match the stake to take the other side.</p>
        </div>
        {/* The empty state has its own button, so this only shows once there are calls. */}
        {!!open?.length && <CallCta label="＋ Make a call" dark />}
      </div>
      {!!open?.length && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {[undefined, ...assets].map((a) => (
            <button key={a ?? "all"} type="button" onClick={() => setOnly(a)} className={chip(only === a)}>{a ?? "All"}</button>
          ))}
        </div>
      )}
      {!calls && <div className="mt-8 h-[180px] animate-pulse rounded-xl bg-[#F1EEFB] motion-reduce:animate-none" />}
      {calls?.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#DCD5EC] bg-white px-6 py-16 text-center">
          <p className="m-0 text-[17px] font-semibold">{only ? `No open ${only} calls` : "No open calls right now"}</p>
          <p className="mx-auto mt-1.5 max-w-[44ch] text-[15px] text-[#6B6185]">
            Got a hot take on {assets.join(", ").replace(/, ([^,]*)$/, " or $1")}? Put a price on it and let someone call your bluff.
          </p>
          <CallCta label="Drop a hot take" className="mt-5" />
        </div>
      )}
      {!!calls?.length && (
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {calls.map((d) => <DuelCard key={String(d.id)} d={d} />)}
        </div>
      )}
    </>
  );
}

export const assetOf = (w: AppWallet, d: Duel) => Object.entries(w.net.feeds).find(([, f]) => f?.toLowerCase() === d.feed.toLowerCase())?.[0] ?? "?";
export const unitOf = (d: Duel) => (d.token === zeroAddress ? "MON" : "$CHOG");
export const same = (a?: string, b?: string) => !!a && a.toLowerCase() === b?.toLowerCase();
export const utcTime = (s: number) => new Date(s * 1000).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) + " UTC";

// Badge per phase: an open call shows its side, anything else shows where it ended up.
export const BADGE: Record<Exclude<Phase, "Open">, [label: string, bg: string, fg: string]> = {
  Live: ["Live", "#F1EEFB", "#6E56E8"],
  Settling: ["Settling", "#FDF5E6", "#9A6412"],
  Refundable: ["Unsettled", "#FDF5E6", "#9A6412"],
  Settled: ["Settled", "#1A1130", "#FFFFFF"],
  Expired: ["Expired", "#F4F1FA", "#8E85A3"],
  Cancelled: ["Cancelled", "#F4F1FA", "#8E85A3"],
  Refunded: ["Refunded", "#F4F1FA", "#8E85A3"],
};

/** One duel as a card: who made it, their side, the claim, stake / win / time left. Links to its page; the action button sits above the link. */
export function DuelCard({ d, linked = true }: { d: Duel; linked?: boolean }) {
  const w = useWallet();
  const now = useNow();
  const p = phase(d, now);
  const chog = useOwnedChogs(d.creator, w.net.chain.id).chogs[0]?.meta;
  const stake = Number(formatUnits(d.stake, 18));
  const unit = unitOf(d);
  const [label, bg, fg] = p === "Open" ? [`Says ${d.above ? "above" : "below"}`, d.above ? "#E3F6EC" : "#FBE9EC", d.above ? "#1A8A55" : "#C43A52"] : BADGE[p];
  const claim = `“${assetOf(w, d)} ${d.above ? "above" : "below"} $${fmt(Number(formatUnits(d.target, TARGET_DECIMALS)))} by ${utcTime(d.deadline)}”`;
  const stat = "flex flex-col gap-0.5 font-mono text-[14px] font-medium text-[#1A1130]";
  return (
    <div className="relative flex flex-col gap-3.5 rounded-xl border border-[#ECE8F3] bg-white p-4 transition-shadow has-[a:hover]:shadow-[0_6px_24px_rgba(26,17,48,.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {chog ? <img alt="" src={ipfs(chog.image)} className="size-8 shrink-0 rounded-lg" /> : <span className="size-8 shrink-0 rounded-lg bg-[#F1EEFB]" />}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-semibold">{chog?.name ?? short(d.creator)}</div>
            <div className="text-[12px] text-[#8E85A3]">{same(w.address, d.creator) ? "You" : short(d.creator)}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: bg, color: fg }}>{label}</span>
      </div>
      <p className="m-0 flex-1 text-[17px] leading-snug font-semibold tracking-[-.01em] text-pretty">
        {linked ? <Link href={`/app/duels/${d.id}`} className="after:absolute after:inset-0 after:rounded-xl">{claim}</Link> : claim}
      </p>
      <div className="grid grid-cols-3 gap-2 text-[12px] text-[#8E85A3]">
        <div>Stake<div className={stat}>{fmt(stake)} {unit}</div></div>
        <div>Win<div className={`${stat} text-[#6E56E8]`}>{fmt(payout(stake))} {unit}</div></div>
        <div>{p === "Open" || p === "Live" ? "Ends" : "Ended"}<div className={stat}>{p === "Open" || p === "Live" ? countdown(d.deadline - now) : utcTime(d.deadline).replace(/,.*/, "")}</div></div>
      </div>
      {linked && <DuelAction d={d} />}
    </div>
  );
}

const outline = "relative z-10 w-full cursor-pointer rounded-[10px] border border-[#DCD5EC] bg-white py-2.5 text-[14px] font-semibold text-[#1A1130] hover:bg-[#F7F5FB] disabled:cursor-default disabled:opacity-70";

type Write = ReturnType<typeof useWriteContract>["writeContractAsync"];
/** Sends transactions in order, showing progress on the button, then refreshes every read. */
export function useTx() {
  const { chain } = useWallet().net;
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string>();
  const run = async (steps: (readonly [label: string, send: (write: Write) => Promise<`0x${string}`>])[], done: string) => {
    try {
      for (const [label, send] of steps) {
        setBusy("Confirm in wallet…");
        const hash = await send(writeContractAsync);
        setBusy(label);
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
      }
      toast.success(done);
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed");
    } finally {
      setBusy(undefined);
    }
  };
  return { busy, run };
}

// What the viewer can do now: take someone's open call, cancel or reclaim their own, or refund a duel the oracle never settled.
// `take` relabels the accept button.
export function DuelAction({ d, className = outline, take }: { d: Duel; className?: string; take?: string }) {
  const w = useWallet();
  const now = useNow();
  const { busy, run } = useTx();
  const { chain, duel } = w.net;
  const p = phase(d, now);
  const mine = same(w.address, d.creator);
  const inIt = mine || same(w.address, d.opponent);
  const action = p === "Open" && !mine ? "accept" : (p === "Open" || p === "Expired") && mine ? "cancel" : p === "Refundable" && inIt ? "refund" : undefined;
  if (!action) return null;
  if (!w.ready) return <button type="button" onClick={() => needWallet(w)} className={className}>{walletLabel(w)}</button>;

  const go = () => {
    if (action === "cancel") return run([["Cancelling…", (write) => write({ address: duel!, abi: duelAbi, functionName: "cancel", args: [d.id], chainId: chain.id })]], "Stake returned.");
    if (action === "refund") return run([["Refunding…", (write) => write({ address: duel!, abi: duelAbi, functionName: "refund", args: [d.id], chainId: chain.id })]], "Refunded. Claim it on the duel page.");
    const approve = ["Approving…", (write: Write) => write({ address: d.token, abi: erc20Abi, functionName: "approve", args: [duel!, d.stake], chainId: chain.id })] as const;
    const accept = ["Accepting…", (write: Write) => write({ address: duel!, abi: duelAbi, functionName: "accept", args: [d.id], value: d.token === zeroAddress ? d.stake : undefined, chainId: chain.id })] as const;
    return run(d.token === zeroAddress ? [accept] : [approve, accept], "You're in. Settles at the deadline.");
  };
  const label = { accept: take ?? `Take the ${d.above ? "below" : "above"} side`, cancel: p === "Open" ? "Cancel call" : "Reclaim stake", refund: "Refund stakes" }[action];
  return <button type="button" disabled={!!busy} onClick={go} className={className}>{busy ?? label}</button>;
}

// Logged-out visitors are asked to connect before making a call; a skeleton holds the spot while the session restores.
function CallCta({ label, className = "", dark = false }: { label: string; className?: string; dark?: boolean }) {
  const w = useWallet();
  const base = dark ? btn.replace("bg-[#6E56E8]", "bg-[#1A1130]") : btn;
  if (w.loading) return <span className={`inline-flex h-[41px] w-36 animate-pulse rounded-[10px] bg-[#F1EEFB] motion-reduce:animate-none ${className}`} />;
  if (w.connected) return <Link href="/app/create" className={`${base} ${className}`}>{label}</Link>;
  return (
    <button type="button" onClick={() => w.login()} className={`cursor-pointer ${base} ${className}`}>
      Connect wallet
    </button>
  );
}
