"use client";
/* eslint-disable @next/next/no-img-element -- Chog art comes from IPFS. */
import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Coins, MessageSquare, Swords, type LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { erc20Abi, formatUnits, zeroAddress, type Address } from "viem";
import { useConfig, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { short } from "./app-shell";
import { ACCEPT_CUTOFF, countdown, duelAbi, fmt, payout, phase, pot, TARGET_DECIMALS, type Phase } from "./duel";
import { ipfs, nftAbi, useChogMeta, useOwnedChogs, type Owned } from "@/features/profile/chogs";
import { needWallet, useWallet, walletLabel, type AppWallet } from "./wallet";
import { lwFee } from "@/features/lastword/lastword";
import { useLastWordDuels, type LwDuel } from "@/features/lastword/wall";

const btn = "inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]";

export type Duel = { id: bigint; creator: Address; deadline: number; above: boolean; status: number; opponent: Address; token: Address; feed: Address; stake: bigint; target: bigint; rival: bigint; creatorChog: bigint; opponentChog: bigint };
type Row = readonly [Address, bigint, boolean, number, Address, Address, Address, bigint, bigint, bigint, bigint, bigint];
export const toDuel = ([creator, deadline, above, status, opponent, token, feed, stake, target, rival, creatorChog, opponentChog]: Row, id: bigint): Duel =>
  ({ id, creator, deadline: Number(deadline), above, status, opponent, token, feed, stake, target, rival, creatorChog, opponentChog });

/** Whether the viewer may take an open call: anyone for an open seat, only the rival Chog's current holder for a challenge. */
export function useCanTake(d: { rival: bigint; status: number }) {
  const w = useWallet();
  const holder = useReadContract({ address: w.net.nft, abi: nftAbi, functionName: "ownerOf", args: [d.rival], chainId: w.net.chain.id, query: { enabled: !!d.rival && d.status === 0 } });
  return !d.rival || same(w.address, holder.data);
}

const everySecond = (fn: () => void) => {
  const t = setInterval(fn, 1000);
  return () => clearInterval(t);
};
/** Unix seconds, ticking once a second; 0 during prerender, which must not read the clock. */
export const useNow = () => useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000), () => 0);

/** Every duel in the escrow, newest first; undefined while loading. */
export function useDuels() {
  const { chain, duel } = useWallet().net;
  const count = useReadContract({ address: duel, abi: duelAbi, functionName: "count", chainId: chain.id, query: { enabled: !!duel, refetchInterval: 15_000 } });
  const n = Number(count.data ?? 0);
  // Re-read every 15s so other players' creates, accepts and cancels show up without a reload (hidden tabs don't poll).
  // ponytail: reads every duel on each load and refresh; switch to DuelCreated logs or an indexer once there are hundreds.
  const all = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({ address: duel!, abi: duelAbi, functionName: "duels", args: [BigInt(i)], chainId: chain.id }) as const),
    query: { enabled: n > 0, refetchInterval: 15_000, select: (rows) => rows.map((r, i) => toDuel(r, BigInt(i))).reverse() },
  });
  if (!duel || (count.isSuccess && n === 0)) return [];
  return all.data;
}

export type Encounter = { d: Duel; result: "Win" | "Loss" | "Tie"; vs: bigint };
/** A Chog's settled duels, newest first, each a win, loss or tie for it; undefined while loading. */
export function useChogRecord(id: bigint) {
  const { chain, duel } = useWallet().net;
  const played = useDuels()?.filter((d) => d.status === 3 && (d.creatorChog === id || d.opponentChog === id));
  const winners = useReadContracts({
    allowFailure: false,
    contracts: (played ?? []).map((d) => ({ address: duel!, abi: duelAbi, functionName: "winnerChog", args: [d.id], chainId: chain.id }) as const),
    query: { enabled: !!played?.length },
  });
  if (!played || (played.length && !winners.data)) return;
  return played.map((d, i): Encounter => {
    const w = winners.data?.[i];
    return { d, result: w === id ? "Win" : w === BigInt(0) ? "Tie" : "Loss", vs: d.creatorChog === id ? d.opponentChog : d.creatorChog };
  });
}

/** Row of owned Chogs to pick one from; `value` is ringed. */
export function ChogPicker({ chogs, value, onPick }: { chogs: Owned[]; value?: bigint; onPick: (id: bigint) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chogs.map((c) => (
        <button
          key={String(c.id)}
          type="button"
          aria-label={c.meta?.name ?? `Chog #${c.id}`}
          aria-pressed={c.id === value}
          onClick={() => onPick(c.id)}
          className={`size-12 cursor-pointer overflow-hidden rounded-[10px] border-2 bg-[#F1EEFB] outline-none focus-visible:ring-3 focus-visible:ring-[#6E56E8]/40 ${c.id === value ? "border-[#6E56E8]" : "border-transparent hover:border-[#DCD5EC]"}`}
        >
          {c.meta && <img alt="" src={ipfs(c.meta.image)} className="size-full object-cover" />}
        </button>
      ))}
    </div>
  );
}

const PER_PAGE = 10;

export function Arena() {
  const w = useWallet();
  const real = useDuels();
  const dares = useLastWordDuels();
  const duels = real && dares && [...real, ...dares];
  const now = useNow();
  const [only, setOnly] = useState("All");
  const held = useHeld();
  const assets = Object.keys(w.net.feeds);
  // Only calls with a seat to take; locked and finished duels live on My duels and their pages.
  // Challenges to your Chogs lead (this is where the header badge sends you); other people's challenges stay hidden.
  const rank = (d: Duel | LwDuel) => (phase(d, now) !== "Open" ? -1 : d.rival ? (held(d.rival) ? 0 : -1) : 0.5);
  const open = duels?.filter((d) => rank(d) >= 0).sort((a, b) => rank(a) - rank(b));
  const mode = (d: Duel | LwDuel) => ("dare" in d ? "Last Word" : "Real stakes");
  const calls = open?.filter((d) => only === "All" || mode(d) === only);
  const [page, setPage] = useState(0);
  const pages = Math.ceil((calls?.length ?? 0) / PER_PAGE);
  const at = Math.min(page, Math.max(0, pages - 1)); // the list can shrink under us as calls get taken or settled
  const shown = calls?.slice(at * PER_PAGE, (at + 1) * PER_PAGE);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Open calls</h1>
          <p className="mt-1.5 text-[15px] text-[#6B6185]">Pick a call you disagree with. Match the stake to take the other side.</p>
        </div>
        {/* The empty state has its own button, so this only shows once there are calls. */}
        {!!open?.length && (
          <div className="flex flex-wrap items-center gap-3">
            <Tabs on={only} set={(t) => { setOnly(t); setPage(0); }} tabs={["All", "Real stakes", "Last Word"].map((t) => [t, t === "All" ? open.length : open.filter((d) => mode(d) === t).length])} />
            {w.connected && <CallCta label="＋ Create" />}
          </div>
        )}
      </div>
      {!calls && <CardsSkeleton className="mt-5 gap-3.5" />}
      {calls?.length === 0 && (
        <EmptyState
          icon={Swords}
          className="mt-8"
          title={only !== "All" ? `No ${only} duels happening right now` : "No duels happening right now"}
          text={`Got a hot take on ${assets.join(", ").replace(/, ([^,]*)$/, " or $1")}? Put a price on it and let someone call your bluff.`}
        >
          <CallCta label="Start a duel" href={only === "Last Word" ? "/create?mode=lastword" : undefined} />
        </EmptyState>
      )}
      {!!calls?.length && (
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {shown!.map((d) => <DuelCard key={`${"dare" in d ? "lw" : ""}${d.id}`} d={d} />)}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-[13px] text-[#6B6185]">
          <button type="button" disabled={at === 0} onClick={() => setPage(at - 1)} className={`cursor-pointer ${pill} border border-[#ECE8F3] bg-white disabled:cursor-default disabled:opacity-40`}>← Prev</button>
          <span>Page {at + 1} of {pages}</span>
          <button type="button" disabled={at === pages - 1} onClick={() => setPage(at + 1)} className={`cursor-pointer ${pill} border border-[#ECE8F3] bg-white disabled:cursor-default disabled:opacity-40`}>Next →</button>
        </div>
      )}
    </>
  );
}

/** The dashed box every page shows when it has nothing to list: an icon, a title, a line of text, then its actions. */
export function EmptyState({ icon: Icon, title, text, className = "", children }: { icon: LucideIcon; title: string; text?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-dashed border-[#DCD5EC] bg-white px-6 py-16 text-center ${className}`}>
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[#F1EEFB] text-[#6E56E8]"><Icon className="size-5" /></span>
      <p className="m-0 text-[17px] font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1.5 mb-0 max-w-[44ch] text-[15px] text-[#6B6185]">{text}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Segmented filter with a count per tab, shared by the arena and My duels. */
export function Tabs({ tabs, on, set }: { tabs: [label: string, count: number][]; on: string; set: (t: string) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-0.5 rounded-[10px] bg-[#F1EEFB] p-1">
      {tabs.map(([t, n]) => (
        <button key={t} type="button" role="tab" aria-selected={on === t} onClick={() => set(t)}
          className={`cursor-pointer rounded-lg px-2.5 py-1 text-[13px] font-medium ${on === t ? "bg-white text-[#1A1130] shadow-[0_1px_2px_rgba(26,17,48,.08)]" : "text-[#6B6185] hover:text-[#1A1130]"}`}>
          {t} <span className="ml-0.5 text-[11px] text-[#8E85A3]">{n}</span>
        </button>
      ))}
    </div>
  );
}

export const assetOf = (w: AppWallet, d: { feed: string }) => Object.entries(w.net.feeds).find(([, f]) => f?.toLowerCase() === d.feed.toLowerCase())?.[0] ?? "?";
export const unitOf = (d: Duel) => (d.token === zeroAddress ? "MON" : "$CHOG");
export const same = (a?: string, b?: string) => !!a && a.toLowerCase() === b?.toLowerCase();

/** Whether a challenge's `rival` is a Chog the connected wallet holds (0, no challenge, never is). */
export function useHeld() {
  const { address, net } = useWallet();
  const { chogs } = useOwnedChogs(address, net.chain.id);
  return (rival: bigint) => !!rival && chogs.some((c) => c.id === rival);
}
export const utcTime = (s: number) => new Date(s * 1000).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) + " UTC";

// Badge per phase: an open call shows its side, anything else shows where it ended up.
export const BADGE: Record<Exclude<Phase, "Open">, [label: string, bg: string, fg: string]> = {
  Live: ["Live", "#6E56E8", "#FFFFFF"],
  Settling: ["Settling", "#FDF5E6", "#9A6412"],
  Refundable: ["Unsettled", "#FDF5E6", "#9A6412"],
  Settled: ["Settled", "#1A1130", "#FFFFFF"],
  Expired: ["Expired", "#F4F1FA", "#8E85A3"],
  Cancelled: ["Cancelled", "#F4F1FA", "#8E85A3"],
  Refunded: ["Refunded", "#F4F1FA", "#8E85A3"],
};

// The line in a card's footer: where the duel stands, in words.
const NOTE: Record<Phase, string> = {
  Open: "Waiting for a challenger",
  Expired: "No taker before the cutoff",
  Live: "Both sides locked",
  Settling: "Waiting for Chainlink price",
  Refundable: "Not settled in 24h, refund open",
  Settled: "Settled by Chainlink",
  Cancelled: "Cancelled, stake returned",
  Refunded: "Not settled in 24h, stakes returned",
};

/** One duel as a card, either mode: who made it, both sides, the claim, stake / win / time (or the dare for Last Word), and a footer with its state and action. Links to its page; buttons sit above the link. */
export function DuelCard({ d, linked = true }: { d: Duel | LwDuel; linked?: boolean }) {
  const w = useWallet();
  const now = useNow();
  const p = phase(d, now);
  const canTake = useCanTake(d);
  const chog = useChogMeta(d.creatorChog, w.net.chain.id).meta.data;
  const lw = "dare" in d;
  const stake = lw ? 0 : Number(formatUnits(d.stake, 18));
  const unit = lw ? "" : unitOf(d);
  const [label, bg, fg] = p === "Open" ? ["Open", "#F1EEFB", "#6E56E8"] : BADGE[p];
  const usd = `$${fmt(Number(formatUnits(d.target, TARGET_DECIMALS)))}`;
  const claim = `“${assetOf(w, d)} ${d.above ? "above" : "below"} ${usd} by ${utcTime(d.deadline)}”`;
  // Sides from the viewer's seat when they're in the duel, else the maker's first.
  const taker = same(w.address, d.opponent);
  const inIt = taker || same(w.address, d.creator);
  const side = (above: boolean) => (above ? "Above" : "Below");
  const mySide = taker ? !d.above : d.above;
  const [midLabel, mid] = p === "Open" || p === "Live" ? ["To win", payout(stake)] : p === "Settling" ? ["Pot", pot(stake)] : p === "Settled" ? ["Payout", payout(stake)] : ["Returned", stake];
  const stat = "flex flex-col gap-0.5 font-mono text-[14px] font-medium text-[#1A1130]";
  const chip = "rounded-md px-2 py-0.5 text-[12px] font-medium";
  const mine = same(w.address, d.creator);
  const ends = p === "Open" || p === "Live";
  return (
    <div className="relative flex flex-col gap-3.5 overflow-hidden rounded-xl border border-[#ECE8F3] bg-white p-4 transition-shadow has-[a:hover]:shadow-[0_6px_24px_rgba(26,17,48,.08)]">
      <div className="-mb-1 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[.12em] text-[#6E56E8] uppercase">
        {lw ? <MessageSquare className="size-3" /> : <Coins className="size-3" />}{lw ? "Last Word" : "Real stakes"}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {chog ? <img alt="" src={ipfs(chog.image)} className="size-8 shrink-0 rounded-lg" /> : <span className={`size-8 rounded-lg ${skel}`} />}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-semibold">{chog?.name ?? short(d.creator)}</div>
            <div className="text-[12px] text-[#8E85A3]">{mine ? "You" : short(d.creator)}</div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: bg, color: fg }}>
          <span className="size-1.5 rounded-full bg-current" />{label}
        </span>
      </div>
      <p className="m-0 flex-1 text-[17px] leading-snug font-semibold tracking-[-.01em] text-pretty">
        {linked ? <Link href={`/${lw ? "last-word" : "duels"}/${d.id}`} className="after:absolute after:inset-0 after:rounded-xl">{claim}</Link> : claim}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className={`${chip} bg-[#F1EEFB] text-[#6E56E8]`}>{inIt ? "You" : "Maker"} · {side(mySide)} {usd}</span>
        <span className={`${chip} bg-[#F4F1FA] text-[#4A4063]`}>{inIt ? "Them" : "Taker"} · {d.opponent === zeroAddress ? "open slot" : side(!mySide)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-[#ECE8F3] pt-3 text-[12px] text-[#8E85A3]">
        {lw ? (
          // Dares run up to 60 bytes; one line here, the full text on hover and on the dare page.
          <div className="col-span-2 min-w-0">Loser says<div title={d.dare} className="truncate text-[14px] font-semibold text-[#1A1130]">“{d.dare}”</div></div>
        ) : (
          <>
            <div>Stake<div className={stat}>{fmt(stake)} {unit}</div></div>
            <div>{midLabel}<div className={`${stat} text-[#6E56E8]`}>{fmt(mid)} {unit}</div></div>
          </>
        )}
        <div>{lw && p === "Open" ? "Seat closes" : ends ? "Ends in" : "Ended"}<div className={stat}>{lw && p === "Open" ? countdown(d.deadline - ACCEPT_CUTOFF - now) : ends ? countdown(d.deadline - now) : utcTime(d.deadline).replace(/,.*/, "")}</div></div>
      </div>
      {linked && (
        <div className="-mx-4 -mb-4 flex items-center justify-between gap-3 border-t border-[#ECE8F3] bg-[#FAF9FD] px-4 py-3">
          <span className="min-w-0 text-[13px] text-[#6B6185]">{p === "Open" && d.rival ? `Challenge to Chog #${d.rival}` : NOTE[p]}</span>
          {/* Labels only: clicks fall through to the card's link, and taking, cancelling or refunding happens on the duel page. */}
          {p === "Open" && !mine && canTake ? <span className={`${pill} bg-[#6E56E8] text-white`}>{lw ? `Accept · ${lwFee(d)}` : "Take the bet"}</span> : p === "Open" && mine && lw ? <span className={`${pill} border border-[#DCD5EC] bg-white text-[#1A1130]`}>Share call</span> : p === "Refundable" && inIt && !lw ? <span className={`${pill} bg-[#6E56E8] text-white`}>Refund stakes</span> : p === "Expired" && mine ? <span className={`${pill} bg-[#6E56E8] text-white`}>Reclaim</span> : view}
        </div>
      )}
    </div>
  );
}

const skel = "block shrink-0 animate-pulse rounded bg-[#F1EEFB] motion-reduce:animate-none";
/** A row of DuelCard-shaped placeholders while duels load. */
export function CardsSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`grid sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {[0, 1, 2].map((k) => (
        <div key={k} className="flex flex-col gap-3.5 overflow-hidden rounded-xl border border-[#ECE8F3] bg-white p-4">
          <span className={`h-3 w-20 ${skel}`} />
          <div className="flex items-center gap-2.5">
            <span className={`size-8 rounded-lg ${skel}`} />
            <div className="flex flex-1 flex-col gap-1.5"><span className={`h-3.5 w-20 ${skel}`} /><span className={`h-3 w-14 ${skel}`} /></div>
            <span className={`h-6 w-14 rounded-full ${skel}`} />
          </div>
          <span className={`h-5 w-4/5 ${skel}`} />
          <div className="flex gap-1.5"><span className={`h-5 w-24 rounded-md ${skel}`} /><span className={`h-5 w-20 rounded-md ${skel}`} /></div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#ECE8F3] pt-3">
            {[0, 1, 2].map((i) => <div key={i} className="flex flex-col gap-1.5"><span className={`h-3 w-10 ${skel}`} /><span className={`h-4 w-14 ${skel}`} /></div>)}
          </div>
          <div className="-mx-4 -mb-4 flex items-center justify-between border-t border-[#ECE8F3] bg-[#FAF9FD] px-4 py-3">
            <span className={`h-3.5 w-32 ${skel}`} /><span className={`h-8 w-20 rounded-lg ${skel}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

const pill = "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap";
const view = <span className={`${pill} border border-[#DCD5EC] bg-white text-[#1A1130]`}>View duel</span>;
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
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed";
      // Lost a race: someone took or cancelled the call first, and the contract's "not open" comes back in the error text.
      toast.error(/not open/.test(`${msg} ${(e as Error).message}`) ? "Too late: someone took or cancelled this call first." : msg);
      queryClient.invalidateQueries(); // show the duel as it is now
    } finally {
      setBusy(undefined);
    }
  };
  return { busy, run };
}

// What the viewer can do now: take someone's open call, cancel or reclaim their own, or refund a duel the oracle never settled.
// `take` relabels the accept button; `chog` is the Chog the taker enters with; `fallback` shows when there is nothing to do.
export function DuelAction({ d, className = outline, take, chog, fallback = null }: { d: Duel; className?: string; take?: string; chog?: bigint; fallback?: ReactNode }) {
  const w = useWallet();
  const now = useNow();
  const { busy, run } = useTx();
  const { chain, duel } = w.net;
  const p = phase(d, now);
  const canTake = useCanTake(d);
  const mine = same(w.address, d.creator);
  const inIt = mine || same(w.address, d.opponent);
  const action = p === "Open" && !mine ? (canTake ? "accept" : undefined) : (p === "Open" || p === "Expired") && mine ? "cancel" : p === "Refundable" && inIt ? "refund" : undefined;
  if (!action) return fallback;
  if (!w.ready) return <button type="button" onClick={() => needWallet(w)} className={className}>{walletLabel(w)}</button>;
  if (action === "accept" && !chog) return <button type="button" disabled className={className}>You need a Chog</button>;

  const go = () => {
    if (action === "cancel") return run([["Cancelling…", (write) => write({ address: duel!, abi: duelAbi, functionName: "cancel", args: [d.id], chainId: chain.id })]], "Stake returned.");
    if (action === "refund") return run([["Refunding…", (write) => write({ address: duel!, abi: duelAbi, functionName: "refund", args: [d.id], chainId: chain.id })]], "Refunded. Claim it on the duel page.");
    const approve = ["Approving…", (write: Write) => write({ address: d.token, abi: erc20Abi, functionName: "approve", args: [duel!, d.stake], chainId: chain.id })] as const;
    const accept = ["Accepting…", (write: Write) => write({ address: duel!, abi: duelAbi, functionName: "accept", args: [d.id, chog!], value: d.token === zeroAddress ? d.stake : undefined, chainId: chain.id })] as const;
    return run(d.token === zeroAddress ? [accept] : [approve, accept], "You're in. Settles at the deadline.");
  };
  const label = { accept: take ?? `Take the ${d.above ? "below" : "above"} side`, cancel: p === "Open" ? "Cancel call" : "Reclaim stake", refund: "Refund stakes" }[action];
  return <button type="button" disabled={!!busy} onClick={go} className={className}>{busy ?? label}</button>;
}

// Logged-out visitors are asked to connect before making a call; a skeleton holds the spot while the session restores.
function CallCta({ label, className = "", href = "/create" }: { label: string; className?: string; href?: string }) {
  const w = useWallet();
  if (w.loading) return <span className={`inline-flex h-[41px] w-36 animate-pulse rounded-[10px] bg-[#F1EEFB] motion-reduce:animate-none ${className}`} />;
  if (w.connected) return <Link href={href} className={`${btn} ${className}`}>{label}</Link>;
  return (
    <button type="button" onClick={() => w.login()} className={`cursor-pointer ${btn} ${className}`}>
      Connect wallet
    </button>
  );
}
