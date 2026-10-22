"use client";
/* eslint-disable @next/next/no-img-element -- the share card is the /og image. */
import Link from "next/link";
import { SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { preload } from "react-dom";
import { toast } from "sonner";
import { erc20Abi, formatUnits, parseEther, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChogPicker, BADGE, EmptyState, same, useNow, useTx, utcTime } from "@/features/betting/arena";
import { ASSETS, Coin, type Asset } from "@/features/betting/coins";
import { ACCEPT_CUTOFF, countdown, fmt, phase, SETTLE_WINDOW, TARGET_DECIMALS } from "@/features/betting/duel";
import { Avatar, big, DuelSkeleton, eyebrow, Faceoff, OracleCard, panel, Row, skel, Steps, useDeadlinePrice, useLivePrice } from "@/features/betting/duel-page";
import { needWallet, useWallet, walletLabel } from "@/features/betting/wallet";
import { nftAbi, useProfileChog } from "@/features/profile/chogs";
import { lastWordAbi, LW_CHOG_FEE, LW_FEE, lwCardQuery, lwFee } from "./lastword";
import { short } from "@/features/betting/app-shell";
import { Bubble, lwAsset, toLwDuel, useSettleTx, type LwDuel } from "./wall";

const quiet = big.replace("bg-[#6E56E8]", "border border-[#DCD5EC] bg-white").replace("text-white", "text-[#1A1130]");

// One Last Word duel, laid out like a stakes duel (/duels/[id]): the call, both Chogs face to face, the oracle and rules on the left,
// and a side panel that holds the dare and what the viewer can do about it.
export function DarePage({ id }: { id: string }) {
  const w = useWallet();
  const { chain, lastWord } = w.net;
  const valid = /^\d+$/.test(id);
  const read = useReadContract({ address: lastWord, abi: lastWordAbi, functionName: "duels", args: [BigInt(valid ? id : 0)], chainId: chain.id, query: { enabled: !!lastWord && valid, refetchInterval: 15_000 } });
  if (!valid || read.isError || !lastWord) {
    return (
      <EmptyState icon={SearchX} title="Duel not found" text="This link doesn't point to a Last Word duel on this network.">
        <Link href="/wall" className="text-[14px] font-semibold text-[#6E56E8] hover:underline">Back to the Wall of Shame</Link>
      </EmptyState>
    );
  }
  if (!read.data) return <DuelSkeleton />;
  return <Loaded d={toLwDuel(read.data, BigInt(id))} />;
}

const NOTE = {
  Expired: ["Expired · nobody took it", "Nobody took this dare before the cutoff."],
  Refundable: ["Unsettled · nobody wears it", "This duel wasn't settled within 24h of its deadline, so nobody wears the dare."],
  Cancelled: ["Cancelled", "The creator took this dare down before anyone accepted."],
  Refunded: ["Unsettled · nobody wears it", "Nobody settled it in time, so nobody wears the dare."],
};

function Loaded({ d }: { d: LwDuel }) {
  const w = useWallet();
  const { chain, lastWord } = w.net;
  const now = useNow();
  const p = phase(d, now);
  const asset = lwAsset(w, d);
  const usd = (n: bigint) => `$${fmt(Number(formatUnits(n, TARGET_DECIMALS)))}`;
  const line = usd(d.target);
  const mine = same(w.address, d.creator);
  const seated = d.opponent !== zeroAddress;
  const { busy, run } = useTx();
  // The fee is in the duel's token: MON is sent with the call, $CHOG is approved to Last Word first unless it already may pull it.
  const fee = lwFee(d);
  const monFee = d.token === zeroAddress;
  const chogFee = parseEther(String(LW_CHOG_FEE));
  const allowance = useReadContract({
    address: w.net.chog, abi: erc20Abi, functionName: "allowance", args: [w.address!, lastWord!], chainId: chain.id,
    query: { enabled: !monFee && !!w.net.chog && !!lastWord && !!w.address },
  });

  const winner = useReadContract({ address: lastWord, abi: lastWordAbi, functionName: "winnerChog", args: [d.id], chainId: chain.id, query: { enabled: d.status === 3 } }).data;
  const loser = !winner ? undefined : winner === d.creatorChog ? d.opponentChog : d.creatorChog;
  // Same as a Real stakes duel: the settle transaction, whose logs record who now wears the dare.
  const settleTx = useSettleTx(d.id);
  const winnerAddr = winner === undefined ? undefined : winner === d.creatorChog ? d.creator : d.opponent;
  const loserAddr = loser === undefined ? undefined : loser === d.creatorChog ? d.creator : d.opponent;

  // Who can take the open seat: anyone with a Chog, or only the holder of the challenged one.
  const holder = useReadContract({ address: w.net.nft, abi: nftAbi, functionName: "ownerOf", args: [d.rival], chainId: chain.id, query: { enabled: !!d.rival && p === "Open" } }).data;
  const canTake = !mine && (!d.rival || same(w.address, holder));
  const [pick, setPick] = useState<string>();
  const viewer = useProfileChog(w.address, chain.id, pick);
  const choices = viewer.chogs.filter((c) => c.id !== d.creatorChog);
  const entry = d.rival || (viewer.chog && viewer.chog.id !== d.creatorChog ? viewer.chog.id : choices[0]?.id);

  const live = useLivePrice(d, p === "Live");
  const closing = useDeadlinePrice(d, p === "Settling");
  const price = p === "Live" ? live : closing;
  const outcome = price == null ? undefined : price === d.target ? "Draw" : price > d.target ? "Above" : "Below";

  const [badge, bg, fg] = p === "Open" ? [`Seat open · ${countdown(d.deadline - ACCEPT_CUTOFF - now)}`, "#F1EEFB", "#6E56E8"] : p === "Settled" && winner === BigInt(0) ? ["Draw", "#1A1130", "#FFFFFF"] : BADGE[p];
  const tag = p === "Live" ? `Live · ${countdown(d.deadline - now)}` : badge;

  // The shared link carries the theme the creator picked (?theme=dark), so the card here matches its link preview.
  const dark = useSearchParams().get("theme") === "dark";
  const cardSrc = `/og?${lwCardQuery(d, asset)}${dark ? "&theme=dark" : ""}`;
  if (mine && p === "Open") preload(cardSrc, { as: "image" });
  const shareUrl = () => `${location.origin}/last-word/${d.id}${dark ? "?theme=dark" : ""}`;
  const tweet = `${asset} ${d.above ? "above" : "below"} ${line} by ${utcTime(d.deadline)}. Loser's Chog wears “${d.dare}”. Take the dare?`;

  // The corner tag on a Chog's art, as on a stakes duel: the result once settled, who's ahead while it runs.
  const lead = price == null || price === d.target ? undefined : (price > d.target) === d.above ? d.creatorChog : d.opponentChog;
  const mark = (chog: bigint) =>
    p === "Settled" && winner !== undefined ? (!winner ? "DRAW" : chog === winner ? "WINNER" : "LOSER")
    : (p === "Live" || p === "Settling") && lead === chog ? "AHEAD" : undefined;
  const cancel = (label: string, done: string) => (
    <button type="button" disabled={!!busy} className={label.startsWith("Cancel") ? quiet : big}
      onClick={() => run([[label.startsWith("Cancel") ? "Cancelling…" : "Reclaiming…", (write) => write({ address: lastWord!, abi: lastWordAbi, functionName: "cancel", args: [d.id], chainId: chain.id })]], done)}>
      {busy ?? label}
    </button>
  );
  const dareBox = (label: string) => (
    <div className="mt-5 rounded-[12px] border border-[#DCD5EC] px-4 py-3.5">
      <p className="m-0 text-[15px] text-[#6B6185]">{label}</p>
      <Bubble text={d.dare} className="mt-2.5 text-[15px]" />
    </div>
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
              <span>Last Word #{String(d.id)}</span>
              <span>{fee} each</span>
              <span>Oracle: Chainlink</span>
              <span className="rounded-full px-3 py-1 text-[14px] font-semibold" style={{ background: bg, color: fg }}>{tag}</span>
            </div>
          </div>
        </div>

        <Faceoff seats={[
          { addr: d.creator, chog: d.creatorChog, side: `${d.above ? "Above" : "Below"} ${line}`, mark: mark(d.creatorChog) },
          seated
            ? { addr: d.opponent, chog: d.opponentChog, side: `${d.above ? "Below" : "Above"} ${line}`, mark: mark(d.opponentChog) }
            : {
              chog: p === "Open" ? d.rival || undefined : undefined, side: `${d.above ? "Below" : "Above"} ${line}`, mark: p === "Open" && d.rival ? "PENDING" : undefined,
              empty: p === "Open" ? (d.rival ? "Waiting to accept" : "Waiting for a challenger") : p === "Cancelled" ? "Dare cancelled" : "Nobody took it",
            },
        ]} />

        <OracleCard d={d} asset={asset} escrow={lastWord} unsettled="nobody wears the dare" />
        <h2 className="mt-10 mb-0 text-[18px] font-semibold">Rules</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-[#6B6185] text-pretty">
          Resolves Above if the first Chainlink {asset}/USD price after {utcTime(d.deadline)} is above {line}, Below if it&apos;s under; exactly {line} is a draw and nobody wears it.
          Each side pays {fee} to play, which {monFee ? "goes to the treasury" : "is burned"}; there&apos;s no pot. The loser&apos;s Chog wears the dare until it wins a Last Word duel back.
          If it isn&apos;t settled by {utcTime(d.deadline + SETTLE_WINDOW)}, nobody wears it either.
        </p>
      </div>

      <div className="min-[901px]:sticky min-[901px]:top-24">
        {p === "Open" ? (
          <div className={panel}>
            <div className="flex items-center gap-3">
              <Avatar addr={w.address} chog={mine ? d.creatorChog : entry} className="size-11" />
              <p className="m-0 text-[18px] font-semibold">{mine ? "Your dare is out" : canTake ? "Take the dare" : `Dare for Chog #${d.rival}`}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[true, false].map((above) => (
                <span key={String(above)} className={`rounded-[12px] p-3 text-center text-[16px] font-semibold ${above === d.above ? "bg-[#F4F2F8] text-[#B3ABC6]" : "bg-[#6E56E8] text-white"}`}>
                  {above ? "Above" : "Below"}
                </span>
              ))}
            </div>
            {dareBox("The loser's Chog wears")}
            <div className="mt-5 flex flex-col gap-2.5 text-[15px]">
              <Row k="Entry" v={fee} />
              <Row k="Pot" v="None, just the shame" />
            </div>
            {!mine && canTake && !d.rival && choices.length > 1 && (
              <div className="mt-5 flex flex-col gap-2 text-[14px] text-[#6B6185]">
                Enter with
                <ChogPicker chogs={choices} value={entry} onPick={(id) => setPick(String(id))} />
              </div>
            )}
            {mine ? (
              <>
                <Dialog>
                  <DialogTrigger className={`mt-5 ${big}`}>Share your dare</DialogTrigger>
                  <DialogContent className="gap-3 rounded-2xl bg-white p-5 sm:max-w-[560px]">
                    <DialogTitle className="m-0 text-[16px] leading-snug font-normal">
                      <span className="font-semibold">Your dare is live.</span> <span className="text-[#6B6185]">{d.rival ? `Send it to Chog #${d.rival}'s holder.` : "Send the link and see who takes it."}</span>
                    </DialogTitle>
                    {/* The same /og image the link unfurls to; the pulse sits under it until it loads. */}
                    <div className="relative aspect-[40/21] overflow-hidden rounded-md border border-[#ECE8F3]">
                      <span className={`absolute inset-0 ${skel}`} />
                      <img alt="Share card preview" width={1200} height={630} className="relative size-full" src={cardSrc} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl())}`, "_blank", "noopener")}
                        className="flex-1 cursor-pointer rounded-[10px] bg-[#6E56E8] p-3 text-[15px] font-semibold text-white hover:brightness-[.96]">Post on X</button>
                      <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl()).then(() => toast.success("Link copied"), () => toast.error("Couldn’t copy link"))}
                        className="cursor-pointer rounded-[10px] border border-[#DCD5EC] bg-white px-4 text-[15px] font-semibold hover:bg-[#F7F5FB]">Copy link</button>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="mt-3">{cancel(`Cancel and take back ${fee}`, `Cancelled. ${fee} back.`)}</div>
              </>
            ) : canTake && !w.ready ? (
              <button type="button" onClick={() => needWallet(w)} className={`mt-5 ${big}`}>{walletLabel(w)}</button>
            ) : canTake ? (
              <button type="button" disabled={!!busy || !entry} className={`mt-5 ${big}`}
                onClick={() => {
                  const steps: Parameters<typeof run>[0] = [["Accepting…", (write) => write({ address: lastWord!, abi: lastWordAbi, functionName: "accept", args: [d.id, entry!], value: monFee ? parseEther(String(LW_FEE)) : undefined, chainId: chain.id })]];
                  if (!monFee && (allowance.data ?? BigInt(0)) < chogFee) steps.unshift(["Approving…", (write) => write({ address: w.net.chog!, abi: erc20Abi, functionName: "approve", args: [lastWord!, chogFee], chainId: chain.id })]);
                  run(steps, "You're in. The loser wears it.");
                }}>
                {busy ?? (entry ? `Take ${d.above ? "Below" : "Above"} · ${fee}` : viewer.loading ? "Finding your Chogs…" : "You need a Chog")}
              </button>
            ) : null}
            <p className="mt-4 mb-0 text-[14px] text-[#6B6185]">
              {mine ? `If nobody takes it by ${utcTime(d.deadline - ACCEPT_CUTOFF)}, reclaim your ${fee}.`
                : canTake ? "Accepting means agreeing to the dare: if your Chog loses, it wears that line until it wins a Last Word duel back."
                : `Only the wallet holding Chog #${d.rival} can take this.`}
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
            {dareBox("The loser's Chog wears")}
            <Steps at={p === "Live" ? 1 : 2} steps={["Matched", "Live", "Settling", "Settled"]}
              note={p === "Live" ? `Both Chogs are in. Next: the ${asset} price is read at ${utcTime(d.deadline)}.` : "Deadline passed. Next: the settle bot confirms the result on-chain."} />
            <p className="mt-5 mb-0 text-[14px] text-[#6B6185]">Nobody wears it if not settled by {utcTime(d.deadline + SETTLE_WINDOW)}.</p>
          </div>
        ) : p === "Settled" ? (
          <div className={panel}>
            <p className={eyebrow}>FINAL</p>
            <div className="mt-4 flex items-center gap-3.5">
              {winner && <Avatar addr={winnerAddr} chog={winner} className="size-14" />}
              <div>
                {/* winnerChog is still loading until it's defined; 0 is a draw. */}
                <p className="m-0 font-mono text-[20px] font-semibold">{winner === undefined ? "Settled" : winner ? `Chog #${winner} wins` : "Draw"}</p>
                <p className="m-0 text-[15px] text-[#6B6185]">{winner === undefined ? "Loading the result…" : loser ? `Chog #${loser} wears the dare until it wins a Last Word duel back.` : "Exactly on the line. Nobody wears it."}</p>
              </div>
            </div>
            {dareBox(loser ? `Chog #${loser} now says` : "Nobody has to say")}
            {settleTx && (
              <a href={`${chain.blockExplorers?.default.url}/tx/${settleTx}`} target="_blank" rel="noopener noreferrer"
                className="mt-4 flex justify-between gap-4 text-[15px] text-[#6B6185] hover:text-[#6E56E8]">
                <span>Settlement tx</span><span className="font-mono">{short(settleTx)} ↗</span>
              </a>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <Link href="/wall" className={`${quiet} text-center`}>See the Wall of Shame</Link>
              <Link href={same(w.address, loserAddr) ? `/create?mode=lastword&chog=${loser}` : "/create?mode=lastword"} className={`${big} text-center`}>{same(w.address, loserAddr) ? "Win it back" : "Throw down another"}</Link>
            </div>
          </div>
        ) : (
          <div className={panel}>
            <p className={eyebrow}>STATUS</p>
            <p className="mt-3 mb-0 text-[22px] leading-tight font-semibold tracking-[-.02em]">{NOTE[p][0]}</p>
            <p className="mt-2 mb-0 text-[15px] leading-normal text-[#6B6185]">{p === "Expired" && mine ? `No challenger showed up. Reclaim your ${fee}.` : NOTE[p][1]}</p>
            <div className="mt-5 flex flex-col gap-2 empty:hidden">
              {p === "Expired" && mine && cancel(`Reclaim ${fee}`, `${fee} back.`)}
              {(p === "Cancelled" || p === "Refundable") && <Link href="/create?mode=lastword" className={`${big} text-center`}>Throw down another</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
