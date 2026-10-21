"use client";
/* eslint-disable @next/next/no-img-element -- Chog art comes from IPFS. */
import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatUnits, zeroAddress, type Address } from "viem";
import { monad } from "viem/chains";
import { usePublicClient, useReadContract } from "wagmi";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ipfs, useProfileChog } from "@/features/profile/chogs";
import { short } from "./app-shell";
import { ASSETS, Coin, type Asset } from "./coins";
import { assetOf, BADGE, DuelAction, same, toDuel, unitOf, useCanTake, useNow, useTx, utcTime, type Duel } from "./arena";
import { ACCEPT_CUTOFF, burned, cardQuery, countdown, duelAbi, feedAbi, findRound, findSettledBlock, fmt, payout, phase, pot, SETTLE_WINDOW, shareKey, TARGET_DECIMALS, winQuery } from "./duel";
import { NETWORKS } from "./networks";
import { useWallet } from "./wallet";

const big = "w-full cursor-pointer rounded-[12px] bg-[#6E56E8] p-4 text-[16px] font-semibold text-white hover:brightness-[.96] disabled:cursor-default disabled:opacity-70";
const panel = "rounded-[20px] border border-[#ECE8F3] bg-white p-6 shadow-[0_16px_48px_rgba(110,86,232,.12)]";
const eyebrow = "m-0 font-mono text-[12px] font-medium tracking-[.14em] text-[#6B6185]";
const skel = "block animate-pulse rounded-[12px] bg-[#F1EEFB] motion-reduce:animate-none";

// One duel: the call, both seats, the rules, and a side panel that is the bet slip while the seat is open, the proposed
// outcome while it settles, and the result once it has.
export function DuelPage({ id, chog }: { id: string; chog?: string }) {
  const w = useWallet();
  const { chain, duel } = w.net;
  const valid = /^\d+$/.test(id);
  const read = useReadContract({ address: duel, abi: duelAbi, functionName: "duels", args: [BigInt(valid ? id : 0)], chainId: chain.id, query: { enabled: !!duel && valid } });
  const d = read.data && toDuel(read.data, BigInt(id));
  if (!valid || read.isError || !duel) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DCD5EC] bg-white px-6 py-16 text-center">
        <p className="m-0 text-[17px] font-semibold">Duel not found</p>
        <Link href="/app" className="mt-4 inline-block text-[14px] font-semibold text-[#6E56E8] hover:underline">Back to open calls</Link>
      </div>
    );
  }
  if (!d) return <DuelSkeleton />;
  return <Loaded d={d} chog={chog} />;
}

// Mirrors Loaded's two columns: the call, seats and rules on the left, the side panel on the right.
export function DuelSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-10 min-[901px]:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <div className="flex items-start gap-5">
          <span className={`size-16 shrink-0 rounded-full sm:size-[72px] ${skel}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-3"><span className={`h-9 w-4/5 ${skel}`} /><span className={`h-5 w-3/5 ${skel}`} /></div>
        </div>
        <div className={`mt-8 h-[160px] ${skel}`} />
        <span className={`mt-8 h-[280px] rounded-[20px] ${skel}`} />
        <span className={`mt-10 h-6 w-20 ${skel}`} />
        <span className={`mt-3 h-16 ${skel}`} />
      </div>
      <div className={`${panel} flex flex-col gap-5`}>
        <span className={`h-11 w-2/3 ${skel}`} />
        <span className={`h-12 ${skel}`} />
        <span className={`h-14 ${skel}`} />
        <span className={`h-14 ${skel}`} />
      </div>
    </div>
  );
}

const noop = () => () => {};

// The creator's Chog, shown on their seat: their pick on the create page (kept in their browser), else the shared link's ?chog=.
function Loaded({ d, chog: linkChog }: { d: Duel; chog?: string }) {
  const w = useWallet();
  const now = useNow();
  const p = phase(d, now);
  const unit = unitOf(d);
  const asset = assetOf(w, d);
  const stake = Number(formatUnits(d.stake, 18));
  const usd = (n: bigint) => `$${fmt(Number(formatUnits(n, TARGET_DECIMALS)))}`;
  const line = usd(d.target);
  const mine = same(w.address, d.creator);
  const seated = d.opponent !== zeroAddress;
  const canTake = useCanTake(d);
  const fee = unit === "MON" ? "Buyback" : "Burn";
  const who = (a: string) => (same(w.address, a) ? "You" : short(a));
  const tweet = `Hot take: ${asset} ${d.above ? "above" : "below"} ${line} by ${utcTime(d.deadline)}. Think I'm wrong? Take the other side for ${fmt(stake)} ${unit}.`;
  const savedJson = useSyncExternalStore(noop, () => { try { return localStorage.getItem(shareKey(w.net.chain.id, d.id)); } catch { return null; } }, () => null);
  let saved: { chog?: unknown; dark?: unknown } = {};
  try { saved = JSON.parse(savedJson ?? "{}") ?? {}; } catch {}
  const chog = typeof saved.chog === "string" && /^\d+$/.test(saved.chog) ? saved.chog : linkChog;
  // The shared link carries the card pick (?chog=&theme=) so its preview matches what the creator saw here.
  const cardChog = useProfileChog(d.creator, w.net.chain.id, chog);
  const shareQ = new URLSearchParams({ ...(cardChog.chog && { chog: String(cardChog.chog.id) }), ...(saved.dark === true && { theme: "dark" }) });
  const shareUrl = () => `${location.origin}/app/duels/${d.id}${shareQ.size ? `?${shareQ}` : ""}`;

  // Before the deadline the live price shows who's ahead; after it, the first round past the deadline decides it,
  // and once settled the DuelSettled event already records that price. The creator's card preview shows it too.
  const live = useLivePrice(d, p === "Live" || (p === "Open" && mine));
  const closing = useDeadlinePrice(d, p === "Settling");
  const settlement = useSettleLog(d, p === "Settled");
  const settled = settlement.data;
  const price = p === "Live" ? live : p === "Settled" ? settled?.price : closing;
  const lead = price == null ? undefined : price === d.target ? "draw" : (price > d.target) === d.above ? d.creator : d.opponent;
  const outcome = price == null ? undefined : price === d.target ? "Draw" : price > d.target ? "Above" : "Below";

  const [badge, bg, fg] = p === "Open" ? [`Seat open · ${countdown(d.deadline - ACCEPT_CUTOFF - now)}`, "#F1EEFB", "#6E56E8"] : BADGE[p];
  const tag = p === "Live" ? `Live · ${countdown(d.deadline - now)}` : p === "Settled" && outcome ? `Resolved · ${outcome}` : badge;

  const status = (a: Address) => {
    if (p === "Open") return <span className="rounded-[10px] bg-[#F4F2F8] px-5 py-2 text-[15px] font-semibold text-[#B3ABC6]">Taken</span>;
    if (p === "Live" || p === "Settling") return <Tone>Locked</Tone>;
    if (p === "Settled") return lead === undefined ? <Tone>Settled</Tone> : lead === "draw" ? <Tone>Back {fmt(stake)}</Tone> : same(lead, a) ? <Tone hi>Won {fmt(payout(stake))}</Tone> : <Tone>Lost {fmt(stake)}</Tone>;
    return <Tone>{{ Refundable: "Refund due", Refunded: "Refunded", Cancelled: "Returned", Expired: "Unmatched" }[p]}</Tone>;
  };

  // What a settled player sees once nothing is left to claim.
  const next = (
    <>
      {settled && same(w.address, lead) && <WinShare d={d} asset={asset} price={settled.price} chog={chog} dark={saved.dark === true} />}
      {/* Only the two players get a rematch nudge: the winner rides the streak, the loser takes revenge, a draw just makes another call. */}
      {(mine || same(w.address, d.opponent)) && (
        <Link href="/app/create" className={`${big.replace("bg-[#6E56E8]", "border border-[#DCD5EC] bg-white").replace("text-white", "text-[#1A1130]")} text-center`}>
          {same(w.address, lead) ? "Feeling lucky?" : lead === "draw" ? "Make another call" : "Take revenge"}
        </Link>
      )}
    </>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-10 min-[901px]:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <div className="flex items-start gap-5">
          {asset in ASSETS ? <Coin a={asset as Asset} className="size-16 sm:size-[72px]" /> : <span className="size-16 shrink-0 rounded-full bg-[#F1EEFB] sm:size-[72px]" />}
          <div className="min-w-0">
            <h1 className="m-0 text-[26px] leading-[1.1] font-semibold tracking-[-.03em] text-balance sm:text-[34px]">
              {asset} {d.above ? "above" : "below"} {line} by {utcTime(d.deadline)}?
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-[#6B6185]">
              <span>Duel #{String(d.id)}</span>
              <span>Pot {fmt(seated ? pot(stake) : stake)} {unit}</span>
              <span>Oracle: Chainlink</span>
              <span className="rounded-full px-3 py-1 text-[14px] font-semibold" style={{ background: bg, color: fg }}>{tag}</span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b border-[#ECE8F3] pb-3 font-mono text-[12px] font-medium tracking-[.14em] text-[#6B6185] sm:grid-cols-[minmax(0,1fr)_150px_110px_120px]">
            <span>PLAYER</span><span>SIDE</span><span className="max-sm:hidden">STAKE</span><span className="text-right">STATUS</span>
          </div>
          <Seat addr={d.creator} chog={chog} sub="Creator" side={`${d.above ? "Above" : "Below"} ${line}`} creator stake={`${fmt(stake)} ${unit}`} status={status(d.creator)} />
          {seated ? (
            <Seat addr={d.opponent} chog={d.rival ? String(d.rival) : undefined} sub="Challenger" side={`${d.above ? "Below" : "Above"} ${line}`} stake={`${fmt(stake)} ${unit}`} status={status(d.opponent)} />
          ) : (
            <Seat
              sub={p === "Open" ? (d.rival ? `Reserved for Chog #${d.rival}` : "Waiting for a challenger") : p === "Cancelled" ? "Call cancelled" : "Nobody took it"}
              side={`${d.above ? "Below" : "Above"} ${line}`}
              stake="–"
              status={p === "Open" && !mine ? <DuelAction d={d} take={`Take · ${fmt(stake)}`} className="cursor-pointer rounded-[10px] bg-[#6E56E8] px-5 py-2 text-[15px] font-semibold whitespace-nowrap text-white hover:brightness-[.96] disabled:opacity-70" /> : <Tone>{p === "Open" ? "Open" : "—"}</Tone>}
            />
          )}
        </div>

        <OracleCard d={d} asset={asset} />
        <h2 className="mt-10 mb-0 text-[18px] font-semibold">Rules</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-[#6B6185] text-pretty">
          Resolves Above if the first Chainlink {asset}/USD price after {utcTime(d.deadline)} is above {line}, Below if it&apos;s under; exactly {line} is a draw and both stakes go back.
          Each side stakes {fmt(stake)} {unit}. Winner takes the pot minus a 5% {unit === "MON" ? "fee that funds $CHOG buybacks" : "burn"}. If it isn&apos;t settled within 24h of the deadline, both stakes refund.
        </p>
      </div>

      <div className="min-[901px]:sticky min-[901px]:top-24">
        {p === "Open" ? (
          <div className={panel}>
            <div className="flex items-center gap-3">
              <Avatar addr={w.address} className="size-11" />
              <p className="m-0 text-[18px] font-semibold">{mine ? "Issue the challenge" : canTake ? "Take the other side" : `Challenge to Chog #${d.rival}`}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[true, false].map((above) => (
                <span key={String(above)} className={`rounded-[12px] p-3 text-center text-[16px] font-semibold ${above === d.above ? "bg-[#F4F2F8] text-[#B3ABC6]" : "bg-[#6E56E8] text-white"}`}>
                  {above ? "Above" : "Below"}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[12px] border border-[#DCD5EC] px-4 py-3.5">
              <span className="text-[16px] text-[#6B6185]">Amount</span>
              <span className="font-mono text-[20px] font-semibold">{fmt(stake)} {unit}</span>
            </div>
            <div className="mt-5 flex flex-col gap-2.5 text-[15px]">
              <Row k="Pot" v={fmt(pot(stake))} />
              <Row k={`${fee} 5%`} v={fmt(burned(stake))} />
              <div className="flex items-baseline justify-between"><span className="text-[#6B6185]">To win</span><span className="font-mono text-[18px] font-semibold text-[#6E56E8]">{fmt(payout(stake))} {unit}</span></div>
            </div>
            {mine && (
              <Dialog>
                <DialogTrigger className="mt-5 w-full cursor-pointer rounded-[12px] bg-[#6E56E8] p-4 text-[16px] font-semibold text-white hover:brightness-[.96]">Share your call</DialogTrigger>
                <DialogContent className="gap-3 rounded-2xl bg-white p-5 sm:max-w-[560px]">
                  <DialogTitle className="m-0 text-[16px] leading-snug font-normal">
                    <span className="font-semibold">Your hot take is live.</span> <span className="text-[#6B6185]">Send the link and dare someone to take the other side.</span>
                  </DialogTitle>
                  {/* The same /og image the link unfurls to; the pulse sits under it until it loads. */}
                  <div className="relative aspect-[40/21] overflow-hidden rounded-md border border-[#ECE8F3]">
                    <span className={`absolute inset-0 ${skel}`} />
                    {!cardChog.loading && (
                      <img alt="Share card preview" width={1200} height={630} className="relative size-full"
                        src={`/og?${cardQuery(d, asset, live)}${shareQ.size ? `&${shareQ}` : ""}`} />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl())}`, "_blank", "noopener")}
                      className="flex-1 cursor-pointer rounded-[10px] bg-[#6E56E8] p-3 text-[15px] font-semibold text-white hover:brightness-[.96]">Post on X</button>
                    <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl()).then(() => toast.success("Link copied"), () => toast.error("Couldn’t copy link"))}
                      className="cursor-pointer rounded-[10px] border border-[#DCD5EC] bg-white px-4 text-[15px] font-semibold hover:bg-[#F7F5FB]">Copy link</button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {/* For the creator this is "Cancel call", so it stays quiet under the share button. */}
            <div className="mt-3 empty:hidden"><DuelAction d={d} className={mine ? undefined : big} take={`Take ${d.above ? "Below" : "Above"}`} /></div>
            <p className="mt-4 mb-0 text-[14px] text-[#6B6185]">
              {mine ? `If nobody takes it by ${utcTime(d.deadline - ACCEPT_CUTOFF)}, reclaim your stake.` : canTake ? "Fixed stakes. No odds, no slippage." : `Only the wallet holding Chog #${d.rival} can take this.`}
            </p>
          </div>
        ) : p === "Live" || p === "Settling" ? (
          <div className={panel}>
            <div className="flex items-center justify-between gap-3">
              <p className={eyebrow}>RESOLUTION</p>
              <span className="flex items-center gap-1.5 rounded-full border border-black/5 px-3 py-1 text-[14px] font-semibold" style={{ background: bg, color: fg }}>
                <span aria-hidden className="size-1.5 rounded-full bg-current" />{badge}
              </span>
            </div>
            <p className="mt-3 mb-0 text-[26px] leading-tight font-semibold tracking-[-.02em]">
              {p === "Live" ? `Settles in ${countdown(d.deadline - now)}` : outcome ? `Outcome proposed: ${outcome}` : "Waiting for the oracle"}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="min-w-0 rounded-[14px] bg-[#F4F2F8] px-4 py-3.5">
                <p className="m-0 text-[15px] text-[#6B6185]">Line</p>
                <p className="mt-1 mb-0 truncate font-mono text-[20px] font-medium">{line}</p>
              </div>
              <div className="min-w-0 rounded-[14px] bg-[#F1EEFB] px-4 py-3.5">
                <p className="m-0 text-[15px] text-[#6B6185]">{p === "Live" ? "Price now" : `Price at ${utcTime(d.deadline).slice(-9, -4)}`}</p>
                <p className="mt-1 mb-0 truncate font-mono text-[20px] font-medium text-[#6E56E8]">{price == null ? "—" : usd(price)}</p>
              </div>
            </div>
            <div className="mt-5 flex items-baseline justify-between text-[16px]"><span className="text-[#6B6185]">Winner gets</span><span className="font-mono text-[24px] font-semibold text-[#6E56E8]">{fmt(payout(stake))} {unit}</span></div>
            <Steps at={p === "Live" ? 1 : 2}
              note={p === "Live" ? `Both seats locked. Next: the ${asset} price is read at ${utcTime(d.deadline)}.` : "Deadline passed. Next: the settle bot confirms the result on-chain."} />
            <p className="mt-5 mb-0 text-[14px] text-[#6B6185]">Both stakes refund if not settled by {utcTime(d.deadline + SETTLE_WINDOW)}.</p>
          </div>
        ) : p === "Settled" && settlement.isError ? (
          <div className={panel}>
            <p className={eyebrow}>FINAL</p>
            <p role="alert" className="mt-3 text-[16px] text-[#6B6185]">This duel is settled, but its result could not be loaded.</p>
            <button type="button" className={big} disabled={settlement.isFetching} onClick={() => void settlement.refetch()}>{settlement.isFetching ? "Retrying..." : "Retry"}</button>
          </div>
        ) : p === "Settled" && price == null ? (
          <div className={panel}>
            <p className={eyebrow}>FINAL</p>
            <div className="mt-4 flex items-center gap-3.5">
              <span className={`size-14 rounded-full ${skel}`} />
              <div className="flex flex-col gap-2"><span className={`h-6 w-32 ${skel}`} /><span className={`h-4 w-44 ${skel}`} /></div>
            </div>
            <div className={`mt-5 h-24 ${skel}`} />
            <div className={`mt-5 h-14 ${skel}`} />
          </div>
        ) : p === "Settled" ? (
          <div className={panel}>
            <p className={eyebrow}>FINAL</p>
            <div className="mt-4 flex items-center gap-3.5">
              {lead && lead !== "draw" && <Avatar addr={lead} chog={same(lead, d.creator) ? chog : undefined} className="size-14" />}
              <div>
                <p className="m-0 font-mono text-[20px] font-semibold">
                  {lead === undefined ? "Settled" : lead === "draw" ? "Draw" : `${who(lead)} ${same(w.address, lead) ? "win" : "wins"}`}
                </p>
                <p className="m-0 text-[15px] text-[#6B6185]">
                  {price == null ? "Fetching the closing price…" : `${asset} closed at ${usd(price)}${lead === "draw" ? ". Both stakes back." : ""}`}
                </p>
              </div>
            </div>
            {lead && lead !== "draw" && (
              <div className="mt-5 flex flex-col gap-2.5 text-[16px]">
                <div className="flex items-baseline justify-between"><span className="text-[#6B6185]">Paid out</span><span className="font-mono text-[20px] font-semibold text-[#6E56E8]">{fmt(payout(stake))} {unit}</span></div>
                <Row k={fee === "Burn" ? "Burned" : "To buybacks"} v={`${fmt(burned(stake))} ${unit}`} />
                {(mine || same(w.address, d.opponent)) && <Row k="Your result" v={same(w.address, lead) ? `+${fmt(payout(stake) - stake)} ${unit}` : `-${fmt(stake)} ${unit}`} />}
              </div>
            )}
            {settled && (
              <a href={`${w.net.chain.blockExplorers?.default.url}/tx/${settled.tx}`} target="_blank" rel="noopener noreferrer"
                className="mt-4 flex justify-between gap-4 text-[15px] text-[#6B6185] hover:text-[#6E56E8]">
                <span>Settlement tx</span><span className="font-mono">{short(settled.tx)} ↗</span>
              </a>
            )}
            <div className="mt-5 flex flex-col gap-2 empty:hidden">
              {same(w.address, lead) ? <ClaimButton d={d} due={payout(stake)} then={next} /> : lead === "draw" && (mine || same(w.address, d.opponent)) ? <ClaimButton d={d} due={stake} then={next} /> : next}
            </div>
          </div>
        ) : (
          <div className={panel}>
            <p className={eyebrow}>STATUS</p>
            <p className="mt-3 mb-0 text-[22px] leading-tight font-semibold tracking-[-.02em]">{NOTE[p][0]}</p>
            <p className="mt-2 mb-0 text-[15px] leading-normal text-[#6B6185]">{p === "Expired" && mine ? "No challenger showed up. Reclaim your stake." : NOTE[p][1]}</p>
            <div className="mt-5 flex flex-col gap-2 empty:hidden">
              <DuelAction d={d} className={big} />
              {p === "Refunded" && (mine || same(w.address, d.opponent)) && <ClaimButton d={d} due={stake} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const NOTE = {
  Expired: ["Expired · nobody took it", "No challenger showed up. The creator can reclaim the stake."],
  Refundable: ["Unsettled · refund available", "The duel wasn't settled within 24h of its deadline, so both stakes can be refunded."],
  Cancelled: ["Cancelled", "The creator took the call down before anyone accepted. Stake returned."],
  Refunded: ["Refunded", "Nobody settled it in time, so both stakes were refunded."],
};

const STEPS = ["Matched", "Live", "Settling", "Paid out"];
// Vertical timeline: done milestones are solid, the current one is a ring with its note underneath, later ones are grey.
const Steps = ({ at, note }: { at: number; note: string }) => (
  <ol className="mt-5 mb-0 list-none border-t border-[#ECE8F3] p-0 pt-5 text-[16px]">
    {STEPS.map((s, i) => (
      <li key={s} aria-current={i === at ? "step" : undefined} className="relative flex gap-3 pb-4 last:pb-0">
        {i < STEPS.length - 1 && <span aria-hidden className={`absolute top-5 -bottom-1 left-[7px] w-0.5 ${i < at ? "bg-[#6E56E8]" : "bg-[#ECE8F3]"}`} />}
        <span aria-hidden className={`relative mt-1 size-4 shrink-0 rounded-full ${i < at ? "bg-[#6E56E8]" : i === at ? "border-4 border-[#6E56E8] bg-white" : "border-2 border-[#DCD5EC] bg-white"}`} />
        <div className="min-w-0">
          <span className={i === at ? "font-semibold text-[#6E56E8]" : i < at ? "text-[#1A1130]" : "text-[#B3ABC6]"}>{s}</span>
          {i === at && <p className="mt-1 mb-0 text-[15px] text-[#6B6185]">{note}</p>}
        </div>
      </li>
    ))}
  </ol>
);
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-4"><span className="text-[#6B6185]">{k}</span><span className="text-right font-mono">{v}</span></div>;
const Tone = ({ hi, children }: { hi?: boolean; children: ReactNode }) => <span className={`font-mono text-[16px] font-medium ${hi ? "text-[#6E56E8]" : "text-[#B3ABC6]"}`}>{children}</span>;

// Where the outcome comes from: the duel's own feed and escrow, linked so anyone can check them on the explorer.
function OracleCard({ d, asset }: { d: Duel; asset: string }) {
  const w = useWallet();
  const { chain, duel } = w.net;
  const now = useNow();
  const latest = useReadContract({ address: d.feed, abi: feedAbi, functionName: "latestRoundData", chainId: chain.id, query: { refetchInterval: 15_000 } });
  const at = latest.data && Number(latest.data[3]);
  const ago = at === undefined ? "—" : now - at < 60 ? `${Math.max(0, now - at)}s ago` : `${countdown(now - at)} ago`;
  const link = (a: Address) => (
    <a href={`${chain.blockExplorers?.default.url}/address/${a}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[#6E56E8] hover:underline">{short(a)} ↗</a>
  );
  return (
    <div className="mt-8 rounded-[20px] border border-[#ECE8F3] bg-white p-6">
      <p className={eyebrow}>SECURED BY</p>
      <img src="/chainlink-logo.png" alt="Chainlink" width={925} height={235} className="mt-3 h-8 w-auto" />
      <p className="m-0 mt-2 text-[14px] text-[#6B6185]">{chain.testnet ? "Testnet mirror of the mainnet Chainlink feed" : "Decentralized oracle network"}</p>
      <div className="mt-5 flex flex-col gap-3 text-[15px]">
        <Row k="Feed" v={`${asset} / USD`} />
        <div className="flex justify-between gap-4"><span className="text-[#6B6185]">Feed address</span>{link(d.feed)}</div>
        <Row k="Last update" v={ago} />
        {duel && <div className="flex justify-between gap-4"><span className="text-[#6B6185]">Escrow contract</span>{link(duel)}</div>}
      </div>
      <p className="mt-5 mb-0 border-t border-[#ECE8F3] pt-4 text-[14px] leading-normal text-[#6B6185]">
        ChogXBet can&apos;t change the outcome. If it isn&apos;t settled by {utcTime(d.deadline + SETTLE_WINDOW)}, anyone can trigger a full refund.
      </p>
    </div>
  );
}

/** The wallet's Chog (`chog` if it still holds that one), or a dashed empty seat when there's no wallet. */
function Avatar({ addr, chog: prefer, className }: { addr?: Address; chog?: string; className: string }) {
  const w = useWallet();
  const chog = useProfileChog(addr, w.net.chain.id, prefer).chog?.meta;
  if (!addr) return <span className={`shrink-0 rounded-full border-2 border-dashed border-[#DCD5EC] ${className}`} />;
  return chog ? <img alt="" src={ipfs(chog.image)} className={`shrink-0 rounded-full object-cover ${className}`} /> : <span className={`shrink-0 rounded-full bg-[#F1EEFB] ${className}`} />;
}

// A row in the player table; no `addr` is the open seat.
function Seat({ addr, chog: prefer, sub, side, creator, stake, status }: { addr?: Address; chog?: string; sub: string; side: string; creator?: boolean; stake: string; status: ReactNode }) {
  const w = useWallet();
  const chog = useProfileChog(addr, w.net.chain.id, prefer).chog?.meta;
  const you = same(w.address, addr);
  const name = !addr ? "Open seat" : [short(addr), chog?.name].filter(Boolean).join(" · ");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b border-[#ECE8F3] py-4 sm:grid-cols-[minmax(0,1fr)_150px_110px_120px]">
      <div className="flex min-w-0 items-center gap-3.5">
        {/* The viewer's own seat: ringed avatar and YOU in place of Creator/Challenger, so the faceoff reads at a glance. */}
        <Avatar addr={addr} chog={prefer} className={`size-11 sm:size-12 ${you ? "ring-2 ring-[#6E56E8] ring-offset-2" : ""}`} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[17px] font-semibold">{name}</div>
          <div className={`mt-1 truncate text-[14px] ${you ? "font-semibold tracking-[.08em] text-[#6E56E8]" : "text-[#6B6185]"}`}>{you ? "YOU" : sub}</div>
        </div>
      </div>
      <span className={`text-[16px] font-semibold ${creator ? "text-[#24135F]" : "text-[#6E56E8]"}`}>{side}</span>
      <span className="font-mono text-[16px] max-sm:hidden">{stake}</span>
      <span className="flex justify-end">{status}</span>
    </div>
  );
}

/** The latest mainnet Chainlink price for the duel's asset, which testnet feeds mirror. */
function useLivePrice(d: Duel, enabled: boolean) {
  const w = useWallet();
  const latest = useReadContract({
    address: NETWORKS.mainnet.feeds[assetOf(w, d)], abi: feedAbi, functionName: "latestRoundData", chainId: NETWORKS.mainnet.chain.id,
    query: { enabled, refetchInterval: 15_000 },
  });
  return latest.data?.[1];
}

/**
 * The price the duel settles on: the mainnet Chainlink round right after the deadline. On testnet the duel's feed is a
 * FeedMirror that copies exactly that round, so reading mainnet gives the same answer before and after settlement.
 */
function useDeadlinePrice(d: Duel, enabled: boolean) {
  const w = useWallet();
  const mainnet = usePublicClient({ chainId: monad.id });
  const feed = NETWORKS.mainnet.feeds[assetOf(w, d)];
  const q = useQuery({
    queryKey: ["deadline-price", feed, d.deadline],
    enabled: enabled && !!feed && !!mainnet,
    refetchInterval: (q) => (q.state.data == null ? 30_000 : false),
    queryFn: async () => {
      const round = await findRound(mainnet!, feed!, BigInt(d.deadline));
      if (round === undefined) return null;
      const [, answer] = await mainnet!.readContract({ address: feed!, abi: feedAbi, functionName: "getRoundData", args: [round] });
      return answer;
    },
  });
  return q.data;
}

/** The DuelSettled event: the settle tx (which credits the winner and burns or sends the fee to buybacks) and the closing price. */
function useSettleLog(d: Duel, enabled: boolean) {
  const w = useWallet();
  const { chain, duel } = w.net;
  const client = usePublicClient({ chainId: chain.id });
  const q = useQuery({
    queryKey: ["settle-log", chain.id, duel, String(d.id)],
    enabled: enabled && !!client && !!duel,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const block = await findSettledBlock(client!, duel!, d.id, w.net.duelFromBlock);
      const [log] = await client!.getContractEvents({ address: duel!, abi: duelAbi, eventName: "DuelSettled", args: { id: d.id }, fromBlock: block, toBlock: block, strict: true });
      if (!log) throw new Error("Settlement event not found");
      return { tx: log.transactionHash, price: log.args.price };
    },
  });
  return q;
}

// The winner's brag card behind a Share button: the same /og image the duel link unfurls to once settled, with both players' Chogs.
// `chog` is the creator's Chog (as on their seat); a challenge's opponent is the called-out Chog.
function WinShare({ d, asset, price, chog, dark: startDark }: { d: Duel; asset: string; price: bigint; chog?: string; dark: boolean }) {
  const w = useWallet();
  const [dark, setDark] = useState(startDark);
  const seatChog = (a: Address) => (same(a, d.creator) ? chog : d.rival ? String(d.rival) : undefined);
  const loser = same(w.address, d.creator) ? d.opponent : d.creator;
  const me = useProfileChog(w.address, w.net.chain.id, w.address && seatChog(w.address));
  const them = useProfileChog(loser, w.net.chain.id, seatChog(loser));
  const q = winQuery(d, asset, price, loser, me.chog && String(me.chog.id), them.chog && String(them.chog.id));
  const linkQ = new URLSearchParams({ ...(me.chog && { chog: String(me.chog.id) }), ...(them.chog && { vs: String(them.chog.id) }), ...(dark && { theme: "dark" }) });
  const shareUrl = () => `${location.origin}/app/duels/${d.id}${linkQ.size ? `?${linkQ}` : ""}`;
  const tweet = `+${q.get("won")} ${q.get("unit")} on ChogXBet. ${q.get("result")}, beat ${q.get("beat")}.`;
  const seg = (on: boolean) => `h-auto cursor-pointer rounded-[7px] p-2 text-[14px] font-semibold ${on ? "bg-white text-[#1A1130]" : "text-[#8E85A3]"}`;
  return (
    <Dialog>
      <DialogTrigger className={big}>Share your win</DialogTrigger>
      <DialogContent className="gap-3 rounded-2xl bg-white p-5 sm:max-w-[560px]">
        <DialogTitle className="m-0 text-[16px] leading-snug font-normal"><span className="font-semibold">You called it.</span> <span className="text-[#6B6185]">Post the receipt.</span></DialogTitle>
        <div className="relative aspect-[40/21] overflow-hidden rounded-md border border-[#ECE8F3]">
          <span className={`absolute inset-0 ${skel}`} />
          {!me.loading && !them.loading && <img alt="Winner card preview" width={1200} height={630} className="relative size-full" src={`/og?${q}${dark ? "&theme=dark" : ""}`} />}
        </div>
        <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#ECE8F3] p-1">
          <button type="button" onClick={() => setDark(false)} className={seg(!dark)}>Light</button>
          <button type="button" onClick={() => setDark(true)} className={seg(dark)}>Dark</button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl())}`, "_blank", "noopener")}
            className="flex-1 cursor-pointer rounded-[10px] bg-[#6E56E8] p-3 text-[15px] font-semibold text-white hover:brightness-[.96]">Post on X</button>
          <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl()).then(() => toast.success("Link copied"), () => toast.error("Couldn’t copy link"))}
            className="cursor-pointer rounded-[10px] border border-[#DCD5EC] bg-white px-4 text-[15px] font-semibold hover:bg-[#F7F5FB]">Copy link</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Payouts and refunds wait in the escrow until claimed; one claim withdraws everything owed in that token, across all duels.
// Only rendered for a wallet this duel paid (`due`, in whole tokens); a larger balance is labelled "Claim all" so it isn't read as this duel's.
// `then` takes the button's place once nothing is owed, so a claim is the only call to action until it's done.
function ClaimButton({ d, due, then }: { d: Duel; due: number; then?: ReactNode }) {
  const w = useWallet();
  const { chain, duel } = w.net;
  const { busy, run } = useTx();
  const owed = useReadContract({ address: duel, abi: duelAbi, functionName: "owed", args: [d.token, w.address!], chainId: chain.id, query: { enabled: !!duel && !!w.address } });
  // Nothing until the read lands: most viewers have nothing owed, so a skeleton here mostly stalls the panel.
  if (!owed.data) return owed.isPending ? null : then;
  const total = Number(formatUnits(owed.data, 18));
  const amount = `${fmt(total)} ${unitOf(d)}`;
  return (
    <button type="button" disabled={!!busy} className={big}
      onClick={() => run([["Claiming…", (write) => write({ address: duel!, abi: duelAbi, functionName: "claim", args: [d.token], chainId: chain.id })]], `Claimed ${amount}.`)}>
      {busy ?? `Claim ${total > due + 1e-9 ? "all " : ""}${amount}`}
    </button>
  );
}
