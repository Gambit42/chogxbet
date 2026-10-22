"use client";
import Link from "next/link";
import { useState } from "react";
import { Swords } from "lucide-react";
import { formatUnits, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { lastWordAbi, lwFee } from "@/features/lastword/lastword";
import { ChogFace, useLastWordDuels, type LwDuel } from "@/features/lastword/wall";
import { assetOf, CardsSkeleton, DuelCard, EmptyState, same, unitOf, useDuels, useHeld, useNow, utcTime, type Duel } from "./arena";
import { ACCEPT_CUTOFF, duelAbi, fmt, payout, phase, SETTLE_WINDOW, TARGET_DECIMALS, type Phase } from "./duel";
import { useWallet } from "./wallet";

/** Open challenges to a Chog this wallet holds, in both modes, soonest cutoff first. Read from the chain on each load; there's no push. */
export function useChallenges() {
  const now = useNow();
  const held = useHeld();
  const open = (d: { status: number; deadline: number; rival: bigint }) => phase(d, now) === "Open" && held(d.rival);
  return [
    ...(useDuels()?.filter(open).map((d) => ({ ...d, href: `/duels/${d.id}`, mode: "Real stakes" })) ?? []),
    ...(useLastWordDuels()?.filter(open).map((d) => ({ ...d, href: `/last-word/${d.id}`, mode: "Last Word" })) ?? []),
  ].sort((a, b) => a.deadline - b.deadline);
}

// Still in play. An expired call nobody took counts as history, even while its stake waits to be reclaimed.
// An unsettled Last Word duel is over too: there's no refund, nobody wears the dare.
const ACTIVE = new Set<Phase>(["Open", "Live", "Settling", "Refundable"]);
const isActive = (d: Duel | LwDuel, now: number) => { const p = phase(d, now); return ACTIVE.has(p) && !(p === "Refundable" && "dare" in d); };
const PAGE = 5;

// How a finished duel ended for the viewer: [tile bg, tile fg].
const RESULT = {
  Won: ["#E7F6EC", "#157F3C"],
  Lost: ["#FDECEC", "#C93A3F"],
  Tie: ["#F4F1FA", "#4A4063"],
  Expired: ["#FDF5E6", "#9A6412"],
  Cancelled: ["#F4F1FA", "#8E85A3"],
  Refunded: ["#F4F1FA", "#8E85A3"],
  Unsettled: ["#FDF5E6", "#9A6412"],
} as const;
type Result = keyof typeof RESULT;

const keyOf = (d: Duel | LwDuel) => `${"dare" in d ? "lw" : ""}${d.id}`;
const myChog = (d: Duel | LwDuel, me?: Address) => (same(me, d.opponent) ? d.opponentChog : d.creatorChog);
/** History only holds status 0 (expired), 1 (an unsettled Last Word duel), 2, 3 and 4; a settled one is undefined until its winner loads, and winner 0 is a tie. */
const resultOf = (d: Duel | LwDuel, winner: bigint | undefined, me?: Address): Result | undefined =>
  d.status === 0 ? "Expired" : d.status === 1 ? "Unsettled" : d.status === 2 ? "Cancelled" : d.status === 4 ? "Refunded" : winner === undefined ? undefined : !winner ? "Tie" : winner === myChog(d, me) ? "Won" : "Lost";

/** Winning Chog per settled duel, by keyOf; missing while loading. */
function useWinners(settled: (Duel | LwDuel)[]) {
  const { chain, duel, lastWord } = useWallet().net;
  const real = settled.filter((d): d is Duel => !("dare" in d));
  const lw = settled.filter((d): d is LwDuel => "dare" in d);
  const a = useReadContracts({ allowFailure: false, contracts: real.map((d) => ({ address: duel!, abi: duelAbi, functionName: "winnerChog", args: [d.id], chainId: chain.id }) as const), query: { enabled: real.length > 0 } });
  const b = useReadContracts({ allowFailure: false, contracts: lw.map((d) => ({ address: lastWord!, abi: lastWordAbi, functionName: "winnerChog", args: [d.id], chainId: chain.id }) as const), query: { enabled: lw.length > 0 } });
  const winners = new Map<string, bigint>();
  a.data?.forEach((x, i) => winners.set(keyOf(real[i]), x));
  b.data?.forEach((x, i) => winners.set(keyOf(lw[i]), x));
  return winners;
}

/**
 * When a finished duel resolved, from what's already loaded (no extra reads): a settled duel at its deadline (the bot settles right after),
 * an expired call at its accept cutoff, a refund at the earliest it opens. A cancel's time isn't stored, so it's undefined.
 * ponytail: approximate; exact times need the settledBlock / DuelCancelled / DuelRefunded blocks, i.e. an indexer.
 */
const resolvedAt = (d: Duel | LwDuel) =>
  d.status === 0 ? d.deadline - ACCEPT_CUTOFF : d.status === 3 ? d.deadline : d.status === 4 || d.status === 1 ? d.deadline + SETTLE_WINDOW : undefined;

// Result | duel | mode | date | outcome on wide screens; on phones mode and date fold under the call.
const cols = "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[96px_minmax(0,1fr)_96px_64px_190px]";

// A finished duel as one table row: a result pill readable at a glance, both Chogs and the side you took, and what it paid or cost.
// `cta` labels what's left to do there; like the whole row it only links to the duel page, where the claim or reclaim happens.
function HistoryRow({ d, result, cta, at }: { d: Duel | LwDuel; result?: Result; cta?: string; at?: number }) {
  const w = useWallet();
  const lw = "dare" in d;
  const taker = same(w.address, d.opponent);
  const theirChog = taker ? d.creatorChog : d.opponentChog;
  const stake = lw ? 0 : Number(formatUnits(d.stake, 18));
  const unit = lw ? "" : unitOf(d);
  const back = `${fmt(stake)} ${unit} back`;
  const outcome = !result ? "" : lw
    ? { Won: "They wear it", Lost: "You wear it", Tie: "Draw", Expired: `${lwFee(d)} fee`, Cancelled: "Fee back", Refunded: "Fee back", Unsettled: "Nobody wears it" }[result]
    : { Won: `+${fmt(payout(stake) - stake)} ${unit}`, Lost: `−${fmt(stake)} ${unit}`, Tie: back, Expired: `${fmt(stake)} ${unit} locked`, Cancelled: back, Refunded: back, Unsettled: "Refund open" }[result];
  const [bg, fg] = result ? RESULT[result] : RESULT.Cancelled;
  const mode = lw ? "Last Word" : "Real stakes";
  // When it resolved, not its deadline: a cancelled call's deadline can still be in the future.
  const date = at ? utcTime(at).replace(/,.*/, "") : "Cancelled";
  return (
    <li>
      <Link href={`/${lw ? "last-word" : "duels"}/${d.id}`} className={`${cols} px-4 py-3 hover:bg-[#FAF9FD]`}>
        {result ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: bg, color: fg }}>
            <span className="size-1.5 rounded-full bg-current" />{result}
          </span>
        ) : <span className="h-6 w-16 animate-pulse rounded-full bg-[#F1EEFB] motion-reduce:animate-none" />}
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden shrink-0 items-center sm:flex">
            <ChogFace id={myChog(d, w.address)} className="size-8 rounded-lg ring-2 ring-white" />
            {!!theirChog && <ChogFace id={theirChog} className="-ml-2 size-8 rounded-lg ring-2 ring-white" />}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-semibold">
              {assetOf(w, d)} {(taker ? !d.above : d.above) ? "above" : "below"} ${fmt(Number(formatUnits(d.target, TARGET_DECIMALS)))}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-[#8E85A3]">
              <span className="sm:hidden">{mode} · {date} · </span>{lw ? `“${d.dare}”` : theirChog ? `vs Chog #${theirChog}` : "No taker"}
            </div>
          </div>
        </div>
        <span className="hidden text-[13px] text-[#6B6185] sm:block">{mode}</span>
        <span className="hidden text-[13px] text-[#6B6185] sm:block">{date}</span>
        <span className="flex items-center justify-end gap-2.5">
          <span className={`text-right font-mono text-[13px] ${result === "Won" || result === "Lost" || result === "Expired" ? "font-semibold" : ""}`} style={{ color: result === "Won" || result === "Lost" || result === "Expired" ? fg : "#8E85A3" }}>
            {outcome}
          </span>
          {cta && <span className="shrink-0 rounded-lg bg-[#6E56E8] px-2.5 py-1 text-[12px] font-semibold text-white">{cta}</span>}
        </span>
      </Link>
    </li>
  );
}

// Nothing to show: the two ways to get a duel.
function Empty({ title, text, className }: { title: string; text: string; className: string }) {
  return (
    <EmptyState icon={Swords} title={title} text={text} className={className}>
      <Link href="/create" className="inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]">Start a duel</Link>
      <Link href="/" className="inline-flex rounded-[10px] border border-[#DCD5EC] bg-white px-4 py-2.5 text-[14px] font-semibold hover:bg-[#F7F5FB]">Browse duels</Link>
    </EmptyState>
  );
}

// Challenges to the wallet's Chogs and its duels still in play up top as cards, then everything finished as a history list.
export function MyDuels() {
  const w = useWallet();
  const now = useNow();
  const [shown, setShown] = useState(PAGE);
  const isMine = (d: { creator: string; opponent: string }) => same(w.address, d.creator) || same(w.address, d.opponent);
  const duels = useDuels();
  const dares = useLastWordDuels();
  const challenges = useChallenges();
  // Undefined (skeleton) until the wallet is known too, so a restoring session doesn't flash "No duels yet".
  const mine = w.loading ? undefined : duels && dares && [...duels.filter(isMine), ...dares.filter(isMine)];
  const active = mine && [...challenges, ...mine.filter((d) => isActive(d, now)).sort((a, b) => a.deadline - b.deadline)];
  // Latest resolved first; a cancel sorts at the latest it could have happened (its cutoff, or now if that's still ahead).
  const sortKey = (d: Duel | LwDuel) => resolvedAt(d) ?? Math.min(d.deadline - ACCEPT_CUTOFF, now);
  const history = mine?.filter((d) => !isActive(d, now)).sort((a, b) => sortKey(b) - sortKey(a)) ?? [];
  const winners = useWinners(history.filter((d) => d.status === 3));
  const results = history.map((d) => resultOf(d, winners.get(keyOf(d)), w.address));
  const count = (r: Result) => results.filter((x) => x === r).length;
  // Escrow balance per token this wallet can claim. It's one total across duels, so every paid row in a token with a balance gets the Claim label.
  // ponytail: may label an already-claimed row while a newer one is owed; the duel page's "Claim all" sorts it out. Per-duel claims would need DuelSettled/claim logs.
  const tokens = [...new Set(history.flatMap((d) => ("dare" in d ? [] : [d.token])))];
  const owed = useReadContracts({
    allowFailure: false,
    contracts: tokens.map((t) => ({ address: w.net.duel!, abi: duelAbi, functionName: "owed", args: [t, w.address!], chainId: w.net.chain.id }) as const),
    query: { enabled: !!w.net.duel && !!w.address && tokens.length > 0 },
  });
  const claimable = (d: Duel | LwDuel) => !("dare" in d) && !!owed.data?.[tokens.indexOf(d.token)];
  const ctaOf = (d: Duel | LwDuel, r?: Result) => (r === "Expired" ? "Reclaim" : (r === "Won" || r === "Tie" || r === "Refunded") && claimable(d) ? "Claim" : undefined);
  const h2 = "m-0 text-[20px] font-semibold tracking-[-.02em]";
  return (
    <>
      <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">My duels</h1>
      {!active && <CardsSkeleton className="mt-6 gap-4" />}
      {active?.length === 0 && !history.length && (
        <Empty className="mt-8" title="No duels yet" text="Duels you start or join show up here with their stake, result and status." />
      )}
      {!!(active?.length || history.length) && (
        <section className="mt-6">
          <h2 className={h2}>Active <span className="ml-1 text-[15px] font-medium text-[#8E85A3]">{active!.length}</span></h2>
          {active!.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active!.map((d) => <DuelCard key={keyOf(d)} d={d} />)}
            </div>
          ) : (
            <Empty className="mt-4" title="No duels happening right now" text="Your open, live and settling duels show up here. Start one or join someone else's." />
          )}
        </section>
      )}
      {!!history.length && (
        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={h2}>History</h2>
            {count("Won") + count("Lost") + count("Tie") > 0 && (
              <div className="flex gap-1.5 text-[12px] font-semibold">
                {(["Won", "Lost", "Tie"] as const).map((r) => (
                  <span key={r} className="rounded-full px-2.5 py-1" style={{ background: RESULT[r][0], color: RESULT[r][1] }}>{count(r)} {r.toLowerCase()}</span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#ECE8F3] bg-white">
            <div className={`${cols} hidden border-b border-[#ECE8F3] bg-[#FAF9FD] px-4 py-2.5 text-[11px] font-semibold tracking-[.08em] text-[#8E85A3] uppercase sm:grid`}>
              <span>Result</span><span>Duel</span><span>Mode</span><span>Resolved</span><span className="text-right">Outcome</span>
            </div>
            <ul className="m-0 list-none divide-y divide-[#ECE8F3] p-0">
              {history.slice(0, shown).map((d, i) => <HistoryRow key={keyOf(d)} d={d} result={results[i]} cta={ctaOf(d, results[i])} at={resolvedAt(d)} />)}
            </ul>
            {history.length > shown && (
              <button type="button" onClick={() => setShown(shown + PAGE * 2)} className="block w-full cursor-pointer border-t border-[#ECE8F3] bg-[#FAF9FD] py-2.5 text-[13px] font-semibold text-[#6E56E8] hover:bg-[#F4F1FA]">
                View more <span className="text-[#8E85A3]">({history.length - shown})</span>
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
