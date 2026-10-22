"use client";
/* eslint-disable @next/next/no-img-element -- NFT art comes from IPFS at arbitrary sizes. */
import { Copy, PawPrint } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ipfs, setDefaultChog, useDefaultChog, useOwnedChogs } from "./chogs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatUnits, type Address } from "viem";
import { short } from "@/features/betting/app-shell";
import { assetOf, EmptyState, same, unitOf, useChogRecord, type Encounter } from "@/features/betting/arena";
import { Wearing } from "@/features/lastword/wall";
import { payout, TARGET_DECIMALS } from "@/features/betting/duel";
import { useWallet } from "@/features/betting/wallet";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const skel = "animate-pulse bg-[#F1EEFB] motion-reduce:animate-none";

const ChogsSkeleton = () => (
  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading your Chogs">
    {[0, 1, 2].map((k) => <div key={k} className={`aspect-square rounded-xl ${skel}`} />)}
  </div>
);

// A wallet's profile: its Chogs, and per Chog its record and the line it wears. Without `address` it's the viewer's own,
// with balances and the profile-Chog pick; with one it's anyone's public profile (/u/0x…).
// `chog` opens that Chog's sheet straight away (/u/0x…?chog=7, linked from the Wall of Shame and duel seats).
export function ProfilePanel({ address: viewed, chog }: { address?: Address; chog?: string }) {
  const wallet = useWallet();
  const own = !viewed || same(viewed, wallet.address);
  const address = viewed ?? wallet.address;
  const ready = !!viewed || (wallet.ready && !!address);
  const { chain, getNft } = wallet.net;
  const getNftLink = wallet.isTestnet ? { href: getNft } : { href: getNft, target: "_blank", rel: "noopener noreferrer" };
  const { loading, chogs } = useOwnedChogs(ready ? address : undefined, chain.id);
  const [openId, setOpenId] = useState(chog);
  const open = chogs.find((c) => String(c.id) === openId) ?? null;
  // Another wallet's profile-Chog pick lives in their browser, so theirs shows their first Chog.
  const first = useDefaultChog(own && ready ? address : undefined, chain.id, chogs);

  // Privy is still restoring the session: hold the profile's shape instead of a "Loading…" button.
  if (!viewed && wallet.loading) {
    return (
      <div data-screen-label="Profile" aria-busy="true" aria-label="Loading profile">
        <div className="flex flex-wrap items-center gap-5">
          <div className={`size-20 rounded-2xl ${skel}`} />
          <div>
            <div className={`h-8 w-44 rounded-lg ${skel}`} />
            <div className="mt-2 flex gap-2">
              <div className={`h-[30px] w-28 rounded-lg ${skel}`} />
              <div className={`h-[30px] w-24 rounded-lg ${skel}`} />
            </div>
          </div>
        </div>
        <div className={`mt-10 h-7 w-32 rounded-lg ${skel}`} />
        <ChogsSkeleton />
      </div>
    );
  }

  if (!ready || !address) {
    return (
      <div data-screen-label="Profile" className="max-w-[440px]">
        <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Profile</h1>
        <p className="mt-2 text-[15px] text-[#6B6185]">
          {wallet.wrongChain ? "Your wallet is on another network." : "Connect your wallet to see your Chogs and balances."}
        </p>
        <Button
          variant="plain"
          onClick={wallet.wrongChain ? wallet.switchChain : wallet.login}
          className="mt-5 h-auto rounded-[10px] bg-[#6E56E8] px-4 py-3 text-[15px] font-semibold text-white"
        >
          {wallet.wrongChain ? `Switch to ${chain.name}` : "Connect wallet"}
        </Button>
      </div>
    );
  }

  const copy = () =>
    navigator.clipboard.writeText(`${location.origin}/u/${address}`).then(
      () => toast.success("Profile link copied", { description: short(address) }),
      () => toast.error("Couldn’t copy link"),
    );

  return (
    <div data-screen-label="Profile">
      <div className="flex flex-wrap items-center gap-5">
        {loading || first?.pending ? (
          <div className="size-20 animate-pulse rounded-2xl bg-[#F1EEFB] motion-reduce:animate-none" />
        ) : (
          <img src={first?.meta ? ipfs(first.meta.image) : "/chog-1044.png"} alt="" className="size-20 rounded-2xl bg-[#F1EEFB] object-cover" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="m-0 font-mono text-[26px] leading-tight font-medium tracking-[-.02em]">{short(address)}</h1>
            <Button variant="plain" onClick={copy} aria-label="Copy profile link" className="size-8 rounded-lg text-[#6B6185] hover:bg-[#F1EEFB]">
              <Copy className="size-4" />
            </Button>
          </div>
          {own ? (
            <div className="mt-2 flex flex-wrap gap-2 font-mono text-[13px]">
              <span className="rounded-lg bg-[#F1EEFB] px-3 py-1.5">{wallet.chogBalance == null ? "—" : fmt(wallet.chogBalance)} $CHOG</span>
              <span className="rounded-lg border border-[#ECE8F3] bg-white px-3 py-1.5">{wallet.monBalance == null ? "—" : fmt(wallet.monBalance)} MON</span>
            </div>
          ) : (
            <p className="m-0 mt-1 text-[14px] text-[#6B6185]">{loading ? "Finding their Chogs…" : `${chogs.length} Chog${chogs.length === 1 ? "" : "s"}`}</p>
          )}
        </div>
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-[20px] font-semibold tracking-[-.01em]">
          {own ? "Your Chogs" : "Chogs"}{!loading && <span className="ml-2 font-normal text-[#8E85A3]">{chogs.length}</span>}
        </h2>
        {own && chogs.length > 0 && (
          <Link {...getNftLink} className="rounded-lg border border-[#DCD5EC] bg-white px-3 py-2 text-[14px] font-medium hover:bg-[#FAF9FC]">
            Get another
          </Link>
        )}
      </div>

      {loading ? (
        <ChogsSkeleton />
      ) : chogs.length === 0 ? (
        <EmptyState icon={PawPrint} className="mt-4" title="No Chogs yet" text={own ? "You need a Chog to enter a duel." : "This wallet doesn't hold any Chogs."}>
          {own && (
            <Link {...getNftLink} className="inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]">
              {wallet.isTestnet ? "Get one from the faucet" : "Buy one on OpenSea"}
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <p className="m-0 mt-1 text-[14px] text-[#6B6185]">
            {own ? "Tap a Chog to see its record or make it your profile picture." : "Tap a Chog to see its record, and what it's wearing."}
          </p>
          <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {chogs.map((c) => (
              <li key={String(c.id)}>
                <button
                  type="button"
                  onClick={() => setOpenId(String(c.id))}
                  className={`group relative block w-full cursor-pointer overflow-hidden rounded-xl border bg-white text-left outline-none focus-visible:ring-3 focus-visible:ring-[#6E56E8]/40 ${own && c.id === first?.id ? "border-[#6E56E8] ring-2 ring-[#6E56E8]" : "border-[#ECE8F3]"}`}
                >
                  {/* Whatever it lost its last Last Word duel with, over its head. */}
                  <span className="absolute top-2 right-2 left-2 z-1"><Wearing id={c.id} className="text-[12px]" /></span>
                  {c.meta ? (
                    <img src={ipfs(c.meta.image)} alt={c.meta.name} loading="lazy" className="aspect-square w-full bg-[#F1EEFB] object-cover transition-[scale] duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  ) : (
                    <div className="aspect-square w-full animate-pulse bg-[#F1EEFB] motion-reduce:animate-none" />
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-[14px]">
                    <span className="truncate font-semibold">{c.meta?.name ?? `Chog #${c.id}`}</span>
                    <span className="shrink-0 text-[12px] text-[#8E85A3]">
                      {own && c.id === first?.id ? <span className="font-medium text-[#6E56E8]">Profile</span> : c.meta?.attributes?.find((a) => a.trait_type === "Tier")?.value}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setOpenId(undefined); }}>
        <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[460px]">
          {open && (
            <>
              <div className="relative">
                <img src={open.meta ? ipfs(open.meta.image) : "/chog-1044.png"} alt="" className="aspect-square w-full bg-[#F1EEFB] object-cover" />
                <span className="absolute top-4 right-4 left-4"><Wearing id={open.id} className="text-[15px]" /></span>
              </div>
              <div className="p-6">
                <SheetTitle className="text-[22px] font-semibold tracking-[-.02em]">{open.meta?.name ?? `Chog #${open.id}`}</SheetTitle>
                <SheetDescription className="mt-1">{wallet.isTestnet ? "Test Chog Genesis" : "Chog Genesis"} on {chain.name}</SheetDescription>
                {own && (
                  <Button
                    variant="plain"
                    disabled={open.id === first?.id}
                    onClick={() => { setDefaultChog(address, chain.id, open.id); toast.success("Profile Chog updated"); }}
                    className="mt-4 h-auto rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white disabled:bg-[#F1EEFB] disabled:text-[#6E56E8] disabled:opacity-100"
                  >
                    {open.id === first?.id ? "Your profile Chog" : "Use as profile Chog"}
                  </Button>
                )}
                <ChogRecord id={open.id} />
                <dl className="mt-6 grid grid-cols-2 gap-2">
                  {open.meta?.attributes?.map((a) => (
                    <div key={a.trait_type} className="rounded-lg bg-[#FAF9FC] px-3 py-2.5">
                      <dt className="text-[12px] text-[#8E85A3]">{a.trait_type}</dt>
                      <dd className="m-0 mt-0.5 text-[14px] font-medium">{a.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const TONE: Record<Encounter["result"], string> = { Win: "bg-[#E7F6EE] text-[#1E7A46]", Loss: "bg-[#FCEBEE] text-[#C43A52]", Tie: "bg-[#F4F1FA] text-[#6B6185]" };

// Every settled duel this Chog entered, one row each (newest first), with its wins, losses, ties and win rate on top.
function ChogRecord({ id }: { id: bigint }) {
  const w = useWallet();
  const games = useChogRecord(id);
  if (!games) return <div aria-busy="true" aria-label="Loading record" className={`mt-6 h-24 rounded-xl ${skel}`} />;
  const count = (r: Encounter["result"]) => games.filter((g) => g.result === r).length;
  const [wins, losses] = [count("Win"), count("Loss")];
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="m-0 text-[16px] font-semibold">Record</h3>
        <span className="font-mono text-[13px] text-[#6B6185]">
          {wins}W · {losses}L · {count("Tie")}T{wins + losses > 0 && ` · ${Math.round((wins / (wins + losses)) * 100)}% win rate`}
        </span>
      </div>
      {games.length === 0 ? (
        <p className="m-0 mt-2 text-[14px] text-[#6B6185]">No settled duels yet. Enter one with this Chog to start its record.</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {games.map(({ d, result, vs }) => {
            const stake = Number(formatUnits(d.stake, 18));
            const above = d.creatorChog === id ? d.above : !d.above; // this Chog's side
            return (
              <li key={String(d.id)}>
                <Link href={`/duels/${d.id}`} className="flex items-center gap-3 rounded-lg border border-[#ECE8F3] px-3 py-2.5 hover:bg-[#FAF9FC]">
                  <span className={`w-12 shrink-0 rounded-md py-1 text-center text-[12px] font-semibold ${TONE[result]}`}>{result}</span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[14px] font-medium">vs Chog #{String(vs)}</div>
                    <div className="mt-0.5 truncate text-[12px] text-[#8E85A3]">
                      {assetOf(w, d)} {above ? "above" : "below"} ${fmt(Number(formatUnits(d.target, TARGET_DECIMALS)))} · Duel #{String(d.id)}                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[13px]">
                    {result === "Win" ? `+${fmt(payout(stake) - stake)}` : result === "Loss" ? `−${fmt(stake)}` : "±0"} {unitOf(d)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
