"use client";
/* eslint-disable @next/next/no-img-element -- Chog art comes from IPFS. */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatUnits, type Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { ipfs, nftAbi, useChogMeta } from "@/features/profile/chogs";
import { Sparkles, Trophy } from "lucide-react";
import { EmptyState, Tabs, useNow } from "@/features/betting/arena";
import { countdown, fmt, TARGET_DECIMALS } from "@/features/betting/duel";
import { useWallet, type AppWallet } from "@/features/betting/wallet";
import { lastWordAbi } from "./lastword";

/** One LastWord duel, as its `duels` getter returns it. status: 0 Open, 1 Accepted, 2 Cancelled, 3 Settled. */
export type LwDuel = { id: bigint; creator: Address; deadline: number; above: boolean; status: number; opponent: Address; feed: Address; target: bigint; rival: bigint; creatorChog: bigint; opponentChog: bigint; dare: string; token: Address };
type Row = readonly [Address, bigint, boolean, number, Address, Address, bigint, bigint, bigint, bigint, string, Address];
export const toLwDuel = ([creator, deadline, above, status, opponent, feed, target, rival, creatorChog, opponentChog, dare, token]: Row, id: bigint): LwDuel =>
  ({ id, creator, deadline: Number(deadline), above, status, opponent, feed, target, rival, creatorChog, opponentChog, dare, token });

export const lwAsset = (w: AppWallet, d: LwDuel) => Object.entries(w.net.feeds).find(([, f]) => f?.toLowerCase() === d.feed.toLowerCase())?.[0] ?? "?";
/** "BTC below $90,000", from the side `above` took. */
export const lwCall = (w: AppWallet, d: LwDuel, above = d.above) => `${lwAsset(w, d)} ${above ? "above" : "below"} $${fmt(Number(formatUnits(d.target, TARGET_DECIMALS)))}`;

/** Every Last Word duel, newest first; undefined while loading, [] where Last Word isn't deployed. */
export function useLastWordDuels() {
  const { chain, lastWord } = useWallet().net;
  const count = useReadContract({ address: lastWord, abi: lastWordAbi, functionName: "count", chainId: chain.id, query: { enabled: !!lastWord, refetchInterval: 15_000 } });
  const n = Number(count.data ?? 0);
  // ponytail: reads every duel on each load and every 15s, like useDuels; switch to DuelCreated logs or an indexer once there are hundreds.
  const all = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({ address: lastWord!, abi: lastWordAbi, functionName: "duels", args: [BigInt(i)], chainId: chain.id }) as const),
    query: { enabled: n > 0, refetchInterval: 15_000, select: (rows) => rows.map((r, i) => toLwDuel(r, BigInt(i))).reverse() },
  });
  if (!lastWord || (count.isSuccess && n === 0)) return [];
  return all.data;
}

export type Receipt = { d: LwDuel; winner: bigint; loser: bigint; wearing: boolean };
/** Every Last Word duel settled with a winner, newest first, and whether its loser still wears that duel's dare. Undefined while loading. */
export function useReceipts() {
  const { chain, lastWord } = useWallet().net;
  const settled = useLastWordDuels()?.filter((d) => d.status === 3);
  const winners = useReadContracts({
    allowFailure: false,
    contracts: (settled ?? []).map((d) => ({ address: lastWord!, abi: lastWordAbi, functionName: "winnerChog", args: [d.id], chainId: chain.id }) as const),
    query: { enabled: !!settled?.length },
  });
  // A draw leaves winnerChog at 0 and puts the dare on nobody, so it isn't a receipt.
  const decided = settled && winners.data && settled.flatMap((d, i) => {
    const winner = winners.data[i];
    return winner ? [{ d, winner, loser: winner === d.creatorChog ? d.opponentChog : d.creatorChog }] : [];
  });
  const words = useReadContracts({
    allowFailure: false,
    contracts: (decided || []).map((r) => ({ address: lastWord!, abi: lastWordAbi, functionName: "lastWord", args: [r.loser], chainId: chain.id }) as const),
    query: { enabled: !!decided && decided.length > 0 },
  });
  if (!settled) return;
  if (!settled.length) return [];
  if (!decided || (decided.length && !words.data)) return;
  return decided.map((r, i): Receipt => ({ ...r, wearing: words.data![i][0] && words.data![i][1] === r.d.id }));
}

/** The dare a Chog wears now ({ text, duel }), null when it wears none, undefined while loading. */
export function useWearing(id?: bigint) {
  const { net } = useWallet();
  const read = useReadContract({ address: net.lastWord, abi: lastWordAbi, functionName: "lastWord", args: [id ?? BigInt(0)], chainId: net.chain.id, query: { enabled: !!net.lastWord && !!id } });
  if (!id || !net.lastWord) return null;
  if (!read.data) return read.isError ? null : undefined;
  const [active, duel, text] = read.data;
  return active ? { text, duel } : null;
}

/** The dare as a speech bubble, tail pointing down at the Chog that wears it. */
export function Bubble({ text, className = "" }: { text: string; className?: string }) {
  return (
    // White with a dark outline and shadow, so it reads over any Chog art; the tail is a rotated square sharing the outline.
    // Capped at 3 lines (60-byte dares only reach that in narrow spots like profile tiles); the full text is on hover.
    <span title={text} className={`relative block w-fit max-w-full rounded-[12px] border border-[#1A1130] bg-white px-3 py-2 text-[13px] leading-snug font-semibold wrap-anywhere text-[#1A1130] shadow-[0_3px_0_#1A1130] before:absolute before:-bottom-[6px] before:left-5 before:size-2.5 before:rotate-45 before:border-r before:border-b before:border-[#1A1130] before:bg-white ${className}`}>
      <span className="line-clamp-3">“{text}”</span>
    </span>
  );
}

/** The bubble for whatever `id` wears right now; nothing when it's clean. */
export function Wearing({ id, className = "" }: { id?: bigint; className?: string }) {
  const word = useWearing(id);
  return word ? <Bubble text={word.text} className={className} /> : null;
}

/** Links to the public profile of whoever holds Chog `id`, with that Chog open; plain until the holder is known. */
export function ChogLink({ id, className = "", children }: { id: bigint; className?: string; children: ReactNode }) {
  const { net } = useWallet();
  const owner = useReadContract({ address: net.nft, abi: nftAbi, functionName: "ownerOf", args: [id], chainId: net.chain.id, query: { enabled: !!net.nft } }).data;
  return owner ? <Link href={`/u/${owner}?chog=${id}`} className={className}>{children}</Link> : <span className={className}>{children}</span>;
}

/**
 * Link to the transaction that settled Last Word duel `id`: its DuelSettled and LastWordChanged events are the on-chain record of who
 * now wears the dare. Found after render from settledBlock plus that one block's logs (two small reads, cached), so the Wall isn't held up.
 */
export function TxLink({ id, className = "" }: { id: bigint; className?: string }) {
  const { chain } = useWallet().net;
  const tx = useSettleTx(id);
  if (tx === null) return null;
  const base = `relative z-10 shrink-0 font-mono text-[12px] whitespace-nowrap ${className}`;
  return tx
    ? <a href={`${chain.blockExplorers?.default.url}/tx/${tx}`} target="_blank" rel="noopener noreferrer" className={`${base} text-[#6E56E8] hover:underline`}>View tx ↗</a>
    : <span className={`${base} text-[#C9C2DA]`}>View tx ↗</span>;
}

/** Hash of the transaction that settled Last Word duel `id`; undefined while looking, null if none is found. */
export function useSettleTx(id: bigint) {
  const { chain, lastWord } = useWallet().net;
  const client = usePublicClient({ chainId: chain.id });
  return useQuery({
    queryKey: ["lw-settle-tx", chain.id, lastWord, String(id)],
    enabled: !!client && !!lastWord,
    staleTime: Infinity,
    // Not settled yet (or not found): look again, so the link appears once the bot settles it.
    refetchInterval: (q) => (q.state.data === null ? 30_000 : false),
    retry: false,
    queryFn: async () => {
      const block = await client!.readContract({ address: lastWord!, abi: lastWordAbi, functionName: "settledBlock", args: [id] });
      if (!block) return null;
      const [log] = await client!.getContractEvents({ address: lastWord!, abi: lastWordAbi, eventName: "DuelSettled", args: { id }, fromBlock: block, toBlock: block });
      return log?.transactionHash ?? null;
    },
  }).data;
}

/** A Chog's art by token id; a pulse while it loads, a dashed "?" for an empty seat (no id). */
export function ChogFace({ id, className = "size-14 rounded-xl" }: { id?: bigint; className?: string }) {
  const { chain } = useWallet().net;
  const meta = useChogMeta(id, chain.id).meta.data;
  if (!id) return <span className={`grid shrink-0 place-items-center border-2 border-dashed border-[#DCD5EC] font-mono text-[18px] text-[#B3ABC6] ${className}`}>?</span>;
  return meta ? <img alt={meta.name ?? `Chog #${id}`} src={ipfs(meta.image)} className={`shrink-0 object-cover ${className}`} /> : <span className={`shrink-0 animate-pulse bg-[#F1EEFB] motion-reduce:animate-none ${className}`} />;
}

const skel = "animate-pulse rounded-xl bg-[#F1EEFB] motion-reduce:animate-none";

// Every Chog wearing a dare right now, then every settled Last Word duel as a receipt: who lost to whom, on what call.
export function Wall() {
  const w = useWallet();
  const now = useNow();
  const [on, setOn] = useState("Wearing it now");
  const receipts = useReceipts();
  const wearing = receipts?.filter((r) => r.wearing);
  const ago = (d: LwDuel) => (now ? `${countdown(now - d.deadline)} ago` : "");
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Wall of Shame</h1>
          <p className="mt-1.5 max-w-[56ch] text-[15px] text-[#6B6185]">Lose a Last Word duel and your Chog wears your rival&apos;s line until it wins one back. The receipts stay up forever.</p>
        </div>
        {!!receipts?.length && <Tabs on={on} set={setOn} tabs={[["Wearing it now", wearing!.length], ["All receipts", receipts.length]]} />}
      </div>
      {!w.net.lastWord ? (
        <p className="mt-8 text-[15px] text-[#6B6185]">Last Word isn&apos;t live on this network yet.</p>
      ) : !receipts ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((k) => <div key={k} className={`h-[340px] ${skel}`} />)}</div>
      ) : receipts.length === 0 ? (
        <EmptyState icon={Sparkles} className="mt-8" title="The wall is clean. For now." text="Nobody has lost a Last Word duel yet. Write a dare and make someone wear it.">
          <Link href="/create?mode=lastword" className="inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]">Throw down a dare</Link>
        </EmptyState>
      ) : on === "Wearing it now" ? (
        wearing!.length === 0 ? (
          <EmptyState icon={Trophy} className="mt-8" title="Nobody's wearing one" text="Every loser has won one back. Check the receipts." />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {wearing!.map((r) => (
              // The bubble hugs the top; a longer dare (3 lines at most) pushes its Chog down; the "Called" footer stays pinned to the card's bottom.
              // The Chog link stretches over the card; the tx link sits above it, so the two anchors never nest.
              <div key={String(r.d.id)} className="relative flex flex-col rounded-xl border border-[#ECE8F3] bg-white p-4 transition-shadow has-[a:hover]:shadow-[0_6px_24px_rgba(26,17,48,.08)]">
                <Bubble text={r.d.dare} className="mb-3" />
                <ChogFace id={r.loser} className="aspect-square w-full rounded-xl" />
                <p className="mt-3 mb-0 text-[15px] font-semibold"><ChogLink id={r.loser} className="after:absolute after:inset-0 after:rounded-xl">Chog #{String(r.loser)}</ChogLink></p>
                <p className="mt-0.5 mb-2 text-[13px] text-[#6B6185]">Lost to Chog #{String(r.winner)} · {ago(r.d)}</p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#ECE8F3] pt-2 text-[13px] text-[#8E85A3]">
                  <span className="min-w-0 truncate">Called {lwCall(w, r.d, r.loser === r.d.creatorChog ? r.d.above : !r.d.above)}</span>
                  <TxLink id={r.d.id} />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <ul className="m-0 mt-6 flex list-none flex-col gap-2 p-0">
          {receipts.map((r) => (
            <li key={String(r.d.id)} className="flex items-center gap-3 rounded-xl border border-[#ECE8F3] bg-white px-4 py-3">
              <ChogLink id={r.winner}><ChogFace id={r.winner} className="size-10 rounded-lg" /></ChogLink>
              <span className="font-mono text-[12px] text-[#B3ABC6]">beat</span>
              <ChogLink id={r.loser}><ChogFace id={r.loser} className="size-10 rounded-lg" /></ChogLink>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[14px] font-medium">
                  <ChogLink id={r.winner} className="hover:text-[#6E56E8]">Chog #{String(r.winner)}</ChogLink> beat{" "}
                  <ChogLink id={r.loser} className="hover:text-[#6E56E8]">Chog #{String(r.loser)}</ChogLink>: <span className="text-[#6B6185]">“{r.d.dare}”</span>
                </div>
                <Link href={`/last-word/${r.d.id}`} className="mt-0.5 block truncate text-[12px] text-[#8E85A3] hover:text-[#6E56E8]">{lwCall(w, r.d)} · Duel #{String(r.d.id)} · {ago(r.d)}</Link>
              </div>
              <TxLink id={r.d.id} className="hidden sm:block" />
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium ${r.wearing ? "bg-[#1A1130] text-white" : "bg-[#F4F1FA] text-[#8E85A3]"}`}>{r.wearing ? "Still wearing" : "Cleared"}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
