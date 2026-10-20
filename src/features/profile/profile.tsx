"use client";
/* eslint-disable @next/next/no-img-element -- NFT art comes from IPFS at arbitrary sizes. */
import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ipfs, useOwnedChogs, type Owned } from "./chogs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { short } from "@/features/betting/app-shell";
import { useWallet } from "@/features/betting/wallet";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

export function ProfilePanel() {
  const wallet = useWallet();
  const { address } = wallet;
  const ready = wallet.ready && !!address;
  const { chain, getNft } = wallet.net;
  const getNftLink = wallet.isTestnet ? { href: getNft } : { href: getNft, target: "_blank", rel: "noopener noreferrer" };
  const { loading, chogs } = useOwnedChogs(ready ? address : undefined, chain.id);
  const [open, setOpen] = useState<Owned | null>(null);

  if (!ready) {
    return (
      <div data-screen-label="Profile" className="max-w-[440px]">
        <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Profile</h1>
        <p className="mt-2 text-[15px] text-[#6B6185]">
          {wallet.wrongChain ? "Your wallet is on another network." : "Connect your wallet to see your Chogs and balances."}
        </p>
        <Button
          variant="plain"
          disabled={wallet.loading}
          onClick={wallet.wrongChain ? wallet.switchChain : wallet.login}
          className="mt-5 h-auto rounded-[10px] bg-[#6E56E8] px-4 py-3 text-[15px] font-semibold text-white"
        >
          {wallet.loading ? "Loading…" : wallet.wrongChain ? `Switch to ${chain.name}` : "Connect wallet"}
        </Button>
      </div>
    );
  }

  // Same pick as the header avatar: the first Chog this wallet owns.
  const first = chogs[0];
  const copy = () =>
    navigator.clipboard.writeText(address).then(
      () => toast.success("Address copied", { description: short(address) }),
      () => toast.error("Couldn’t copy address"),
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
            <Button variant="plain" onClick={copy} aria-label="Copy address" className="size-8 rounded-lg text-[#6B6185] hover:bg-[#F1EEFB]">
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[13px]">
            <span className="rounded-lg bg-[#F1EEFB] px-3 py-1.5">{wallet.chogBalance == null ? "—" : fmt(wallet.chogBalance)} $CHOG</span>
            <span className="rounded-lg border border-[#ECE8F3] bg-white px-3 py-1.5">{wallet.monBalance == null ? "—" : fmt(wallet.monBalance)} MON</span>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-[20px] font-semibold tracking-[-.01em]">
          Your Chogs{!loading && <span className="ml-2 font-normal text-[#8E85A3]">{chogs.length}</span>}
        </h2>
        {chogs.length > 0 && (
          <Link {...getNftLink} className="rounded-lg border border-[#DCD5EC] bg-white px-3 py-2 text-[14px] font-medium hover:bg-[#FAF9FC]">
            Get another
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading your Chogs">
          {[0, 1, 2].map((k) => <div key={k} className="aspect-square animate-pulse rounded-xl bg-[#F1EEFB] motion-reduce:animate-none" />)}
        </div>
      ) : chogs.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#DCD5EC] bg-white px-6 py-10 text-center">
          <p className="m-0 text-[15px] text-[#6B6185]">No Chogs in this wallet yet.</p>
          <Link {...getNftLink} className="mt-4 inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]">
            {wallet.isTestnet ? "Get one from the faucet" : "Buy one on OpenSea"}
          </Link>
        </div>
      ) : (
        <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {chogs.map((c) => (
            <li key={String(c.id)}>
              <button
                type="button"
                onClick={() => setOpen(c)}
                className="group block w-full cursor-pointer overflow-hidden rounded-xl border border-[#ECE8F3] bg-white text-left outline-none focus-visible:ring-3 focus-visible:ring-[#6E56E8]/40"
              >
                {c.meta ? (
                  <img src={ipfs(c.meta.image)} alt={c.meta.name} loading="lazy" className="aspect-square w-full bg-[#F1EEFB] object-cover transition-[scale] duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                ) : (
                  <div className="aspect-square w-full animate-pulse bg-[#F1EEFB] motion-reduce:animate-none" />
                )}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-[14px]">
                  <span className="truncate font-semibold">{c.meta?.name ?? `Chog #${c.id}`}</span>
                  <span className="shrink-0 text-[12px] text-[#8E85A3]">{c.meta?.attributes?.find((a) => a.trait_type === "Tier")?.value}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[460px]">
          {open && (
            <>
              <img src={open.meta ? ipfs(open.meta.image) : "/chog-1044.png"} alt="" className="aspect-square w-full bg-[#F1EEFB] object-cover" />
              <div className="p-6">
                <SheetTitle className="text-[22px] font-semibold tracking-[-.02em]">{open.meta?.name ?? `Chog #${open.id}`}</SheetTitle>
                <SheetDescription className="mt-1">{wallet.isTestnet ? "Test Chog Genesis" : "Chog Genesis"} on {chain.name}</SheetDescription>
                <dl className="mt-5 grid grid-cols-2 gap-2">
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
