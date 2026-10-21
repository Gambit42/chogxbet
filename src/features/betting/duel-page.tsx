"use client";
/* eslint-disable @next/next/no-img-element -- Chog art comes from IPFS. */
import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatUnits, zeroAddress, type Address } from "viem";
import { monad } from "viem/chains";
import { usePublicClient, useReadContract } from "wagmi";
import { ipfs, useOwnedChogs } from "@/features/profile/chogs";
import { short } from "./app-shell";
import { ASSETS, Coin, type Asset } from "./create-call";
import { assetOf, BADGE, DuelAction, same, toDuel, unitOf, useNow, useTx, utcTime, type Duel } from "./arena";
import { ACCEPT_CUTOFF, burned, countdown, duelAbi, feedAbi, findRound, fmt, payout, phase, pot, SETTLE_WINDOW, TARGET_DECIMALS } from "./duel";
import { NETWORKS } from "./networks";
import { useWallet } from "./wallet";

const big = "w-full cursor-pointer rounded-[12px] bg-[#6E56E8] p-4 text-[16px] font-semibold text-white hover:brightness-[.96] disabled:cursor-default disabled:opacity-70";
const panel = "rounded-[20px] border border-[#ECE8F3] bg-white p-6 shadow-[0_16px_48px_rgba(110,86,232,.12)]";
const eyebrow = "m-0 font-mono text-[12px] font-medium tracking-[.14em] text-[#6B6185]";

// One duel: the call, both seats, the rules, and a side panel that is the bet slip while the seat is open, the proposed
// outcome while it settles, and the result once it has.
export function DuelPage({ id }: { id: string }) {
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
  if (!d) return <div className="h-[320px] animate-pulse rounded-2xl bg-[#F1EEFB] motion-reduce:animate-none" />;
  return <Loaded d={d} />;
}

function Loaded({ d }: { d: Duel }) {
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
  const fee = unit === "MON" ? "Buyback" : "Burn";
  const who = (a: string) => (same(w.address, a) ? "You" : short(a));
  const tweet = `Hot take: ${asset} ${d.above ? "above" : "below"} ${line} by ${utcTime(d.deadline)}. Think I'm wrong? Take the other side for ${fmt(stake)} ${unit}.`;

  // Before the deadline the live price shows who's ahead; after it, the first round past the deadline decides it.
  const live = useLivePrice(d, p === "Live");
  const closing = useDeadlinePrice(d, p === "Settling" || p === "Settled");
  const price = p === "Live" ? live : closing;
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
          <Seat addr={d.creator} sub="Creator" side={`${d.above ? "Above" : "Below"} ${line}`} creator stake={`${fmt(stake)} ${unit}`} status={status(d.creator)} />
          {seated ? (
            <Seat addr={d.opponent} sub="Challenger" side={`${d.above ? "Below" : "Above"} ${line}`} stake={`${fmt(stake)} ${unit}`} status={status(d.opponent)} />
          ) : (
            <Seat
              sub={p === "Open" ? "Waiting for a challenger" : p === "Cancelled" ? "Call cancelled" : "Nobody took it"}
              side={`${d.above ? "Below" : "Above"} ${line}`}
              stake="–"
              status={p === "Open" && !mine ? <DuelAction d={d} take={`Take · ${fmt(stake)}`} className="cursor-pointer rounded-[10px] bg-[#6E56E8] px-5 py-2 text-[15px] font-semibold whitespace-nowrap text-white hover:brightness-[.96] disabled:opacity-70" /> : <Tone>{p === "Open" ? "Open" : "—"}</Tone>}
            />
          )}
        </div>

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
              <p className="m-0 text-[18px] font-semibold">{mine ? "Issue the challenge" : "Take the other side"}</p>
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
              <div className="mt-5 flex flex-col gap-3 rounded-[14px] bg-[#F6F4FD] p-4">
                <p className="m-0 text-[15px] leading-snug">
                  <span className="font-semibold">Your hot take is live.</span> <span className="text-[#6B6185]">Send the link and dare someone to take the other side.</span>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(location.href)}`, "_blank", "noopener")}
                    className="flex-1 cursor-pointer rounded-[10px] bg-[#1A1130] p-3 text-[15px] font-semibold text-white hover:brightness-110">Post on X</button>
                  <button type="button" onClick={() => navigator.clipboard.writeText(location.href).then(() => toast.success("Link copied"), () => toast.error("Couldn’t copy link"))}
                    className="cursor-pointer rounded-[10px] border border-[#DCD5EC] bg-white px-4 text-[15px] font-semibold hover:bg-[#F7F5FB]">Copy link</button>
                </div>
              </div>
            )}
            {/* For the creator this is "Cancel call", so it stays quiet under the share buttons. */}
            <div className="mt-3 empty:hidden"><DuelAction d={d} className={mine ? undefined : big} take={`Take ${d.above ? "Below" : "Above"}`} /></div>
            <p className="mt-4 mb-0 text-[14px] text-[#6B6185]">
              {mine ? `If nobody takes it by ${utcTime(d.deadline - ACCEPT_CUTOFF)}, reclaim your stake.` : "Fixed stakes. No odds, no slippage."}
            </p>
          </div>
        ) : p === "Live" || p === "Settling" ? (
          <div className={panel}>
            <p className={eyebrow}>RESOLUTION</p>
            <p className="mt-3 mb-0 text-[24px] leading-tight font-semibold tracking-[-.02em]">
              {p === "Live" ? `Settles in ${countdown(d.deadline - now)}` : outcome ? `Outcome proposed: ${outcome}` : "Waiting for the oracle"}
            </p>
            <div className="mt-5 flex flex-col gap-2.5 rounded-[14px] bg-[#F6F4FD] px-5 py-4 text-[16px]">
              <Row k="Line" v={line} />
              <Row k={p === "Live" ? "Price now" : `Price at ${utcTime(d.deadline).slice(-9, -4)}`} v={price == null ? "—" : usd(price)} />
            </div>
            <div className="mt-5 flex items-baseline justify-between text-[16px]"><span className="text-[#6B6185]">Winner gets</span><span className="font-mono text-[20px] font-semibold text-[#6E56E8]">{fmt(payout(stake))} {unit}</span></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#ECE8F3]">
              <div className="h-full rounded-full bg-[#6E56E8]" style={{ width: p === "Live" ? "50%" : "75%" }} />
            </div>
            <p className="mt-3 mb-0 text-[15px] text-[#6B6185]">{p === "Live" ? "Both seats locked. Waiting for the deadline." : "Settle bot confirming on-chain"}</p>
            <p className="mt-4 mb-0 text-[14px] text-[#6B6185]">Both stakes refund if not settled by {utcTime(d.deadline + SETTLE_WINDOW)}.</p>
          </div>
        ) : p === "Settled" ? (
          <div className={panel}>
            <p className={eyebrow}>FINAL</p>
            <div className="mt-4 flex items-center gap-3.5">
              {lead && lead !== "draw" && <Avatar addr={lead} className="size-14" />}
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
            <div className="mt-5 flex flex-col gap-2">
              <ClaimButton d={d} />
              <Link href="/app/create" className={`${big.replace("bg-[#6E56E8]", "bg-[#1A1130]")} text-center`}>Run it back</Link>
            </div>
          </div>
        ) : (
          <div className={panel}>
            <p className={eyebrow}>STATUS</p>
            <p className="mt-3 mb-0 text-[22px] leading-tight font-semibold tracking-[-.02em]">{NOTE[p][0]}</p>
            <p className="mt-2 mb-0 text-[15px] leading-normal text-[#6B6185]">{p === "Expired" && mine ? "No challenger showed up. Reclaim your stake." : NOTE[p][1]}</p>
            <div className="mt-5 flex flex-col gap-2 empty:hidden">
              <DuelAction d={d} className={big} />
              {p === "Refunded" && <ClaimButton d={d} />}
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

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-4"><span className="text-[#6B6185]">{k}</span><span className="text-right font-mono">{v}</span></div>;
const Tone = ({ hi, children }: { hi?: boolean; children: ReactNode }) => <span className={`font-mono text-[16px] font-medium ${hi ? "text-[#6E56E8]" : "text-[#B3ABC6]"}`}>{children}</span>;

/** The wallet's first Chog, or a dashed empty seat when there's no wallet. */
function Avatar({ addr, className }: { addr?: Address; className: string }) {
  const w = useWallet();
  const chog = useOwnedChogs(addr, w.net.chain.id).chogs[0]?.meta;
  if (!addr) return <span className={`shrink-0 rounded-full border-2 border-dashed border-[#DCD5EC] ${className}`} />;
  return chog ? <img alt="" src={ipfs(chog.image)} className={`shrink-0 rounded-full object-cover ${className}`} /> : <span className={`shrink-0 rounded-full bg-[#F1EEFB] ${className}`} />;
}

// A row in the player table; no `addr` is the open seat.
function Seat({ addr, sub, side, creator, stake, status }: { addr?: Address; sub: string; side: string; creator?: boolean; stake: string; status: ReactNode }) {
  const w = useWallet();
  const chog = useOwnedChogs(addr, w.net.chain.id).chogs[0]?.meta;
  const name = !addr ? "Open seat" : [same(w.address, addr) ? "You" : short(addr), chog?.name].filter(Boolean).join(" · ");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b border-[#ECE8F3] py-4 sm:grid-cols-[minmax(0,1fr)_150px_110px_120px]">
      <div className="flex min-w-0 items-center gap-3.5">
        <Avatar addr={addr} className="size-11 sm:size-12" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[17px] font-semibold">{name}</div>
          <div className="mt-1 truncate text-[14px] text-[#6B6185]">{sub}</div>
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

// Payouts and refunds wait in the escrow until claimed; one claim withdraws everything owed in that token.
function ClaimButton({ d }: { d: Duel }) {
  const w = useWallet();
  const { chain, duel } = w.net;
  const { busy, run } = useTx();
  const owed = useReadContract({ address: duel, abi: duelAbi, functionName: "owed", args: [d.token, w.address!], chainId: chain.id, query: { enabled: !!duel && !!w.address } });
  if (!owed.data) return null;
  const amount = `${fmt(Number(formatUnits(owed.data, 18)))} ${unitOf(d)}`;
  return (
    <button type="button" disabled={!!busy} className={big}
      onClick={() => run([["Claiming…", (write) => write({ address: duel!, abi: duelAbi, functionName: "claim", args: [d.token], chainId: chain.id })]], `Claimed ${amount}.`)}>
      {busy ?? `Claim ${amount}`}
    </button>
  );
}
