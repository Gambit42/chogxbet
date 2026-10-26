"use client";
/* eslint-disable @next/next/no-img-element -- Use the supplied Chog artwork. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatEther, parseAbi, parseEther, parseEventLogs, type Abi, type Address, type Chain } from "viem";
import { useBalance, useConfig, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NETWORKS } from "@/features/betting/networks";
import { useWallet, type AppWallet } from "@/features/betting/wallet";
import { fetchMeta, ipfs, nftAbi, useChogAvatar, type Meta } from "@/features/profile/chogs";

const balanceOf = "function balanceOf(address) view returns (uint256)";
// Both mock contracts cap mints per wallet (contracts/src); `minted` is how much of the cap is used.
const minted = "function minted(address) view returns (uint256)";
const transferAbi = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
// The faucet only ever mints on testnet, whichever network the header is set to.
const { chain, chog, nft } = NETWORKS.testnet;
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

type Step = {
  title: string;
  blurb: string;
  cta: string;
  image: string; // square artwork in /public
  showOwnedChog?: boolean; // swap the artwork for the wallet's own Chog once it has one
  optional?: boolean; // not needed to play: shown under Extras and doesn't count toward "ready"
  format?: (balance: bigint) => string;
} & (
  | { href: string }
  | {
      contract?: Address; abi: Abi; args: (to: Address) => readonly unknown[];
      limit: bigint; // claims divide it evenly, so reaching it means no claim fits
      limitText: (minted: bigint) => string;
      reveal?: boolean; // open the minted NFT with a reveal
    }
);

// The faucet, in the order people need it (gas, then the Chog every duel requires). Edit copy, amounts and links here.
// Minted items call the mock contracts' open mint(); their addresses come from .env.
const STEPS: Step[] = [
  {
    title: "Testnet MON",
    blurb: "Pays gas, and you can stake it on calls. From Monad's faucet. We copy your address.",
    cta: "Get MON",
    image: "/monad-mark.svg",
    format: (b) => `${fmt(Number(formatEther(b)))} MON`,
    href: "https://faucet.monad.xyz",
  },
  {
    title: "A Chog NFT",
    blurb: "A test Chog Genesis with the real collection's art and traits. Up to 5 per wallet.",
    cta: "Mint my Chog",
    image: "/chog-1044.png",
    showOwnedChog: true,
    contract: nft,
    abi: parseAbi(["function mint(address to) returns (uint256)", balanceOf, minted]),
    args: (to) => [to],
    limit: BigInt(5),
    limitText: (m) => `${m} / 5 minted`,
    reveal: true,
  },
  {
    title: "$CHOG",
    optional: true,
    blurb: "Only if you want to stake in $CHOG. MON works for every call.",
    cta: "Claim 1,000 $CHOG",
    image: "/chog-coin.avif",
    format: (b) => `${fmt(Number(formatEther(b)))} $CHOG`,
    contract: chog,
    abi: parseAbi(["function mint(address to, uint256 amount)", balanceOf, minted]),
    args: (to) => [to, parseEther("1000")],
    limit: parseEther("10000"),
    limitText: (m) => `${fmt(Number(formatEther(m)))} / 10,000 claimed today`,
  },
];

export function FaucetPanel() {
  const wallet = useWallet();
  const { address } = wallet;
  const mon = useBalance({ address, chainId: chain.id, query: { enabled: !!address } });
  const tokens = useReadContracts({
    contracts: STEPS.flatMap((s) =>
      "contract" in s && s.contract
        ? (["balanceOf", "minted"] as const).map((functionName) => ({ address: s.contract, abi: s.abi, functionName, args: [address], chainId: chain.id }))
        : [],
    ),
    query: { enabled: !!address },
  });
  let i = 0;
  const read = () => tokens.data?.[i++]?.result as bigint | undefined;
  const reads = STEPS.map((s) => ("href" in s ? { balance: mon.data?.value } : "contract" in s && s.contract ? { balance: read(), minted: read() } : {}));
  const balances = reads.map((r) => r.balance);
  const ready = wallet.isTestnet && wallet.ready && !!address;
  const done = balances.map((b) => ready && b !== undefined && b > BigInt(0));
  const total = STEPS.filter((s) => !s.optional).length;
  const count = done.filter((d, n) => d && !STEPS[n].optional).length;
  const allDone = ready && count === total;
  const next = ready ? done.findIndex((d, n) => !d && !STEPS[n].optional) : -1;
  const ownChog = useChogAvatar(ready ? address : undefined, chain.id).src;

  if (!wallet.isTestnet) {
    return (
      <div data-screen-label="Faucet" className="max-w-[440px]">
        <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Faucet</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6185]">
          The faucet hands out free test tokens, so it only works on testnet. Switch over to try ChogXBet with a burner wallet and nothing at stake.
        </p>
        <Button variant="plain" onClick={() => wallet.setNetwork("testnet")} className="mt-5 h-auto rounded-[10px] bg-[#6E56E8] px-4 py-3 text-[15px] font-semibold text-white">
          Switch to testnet
        </Button>
      </div>
    );
  }

  return (
    <div data-screen-label="Faucet">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className={`inline-flex items-center gap-2 rounded-full py-1 pr-3 text-[14px] font-semibold ${allDone ? "bg-[#E3F5EC] pl-1 text-[#1F8A55]" : "bg-[#F1EEFB] pl-3 text-[#6E56E8]"}`}>
            {allDone && (
              <span className="grid size-6 place-items-center rounded-full bg-[#1F8A55] text-white">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            )}
            {count} of {total} ready
          </span>
          <h1 className="m-0 mt-4 text-[32px] leading-[1.1] font-semibold tracking-[-.03em] sm:text-[40px]">Get set up to duel</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-[#6B6185]">
            {allDone
              ? "You're ready to play. Pick a call you disagree with and take the other side."
              : "Two things and you're in the Arena. Testnet only, no real value."}
          </p>
        </div>
        {allDone && (
          <Link href="/" className="flex w-full justify-center rounded-[10px] bg-[#6E56E8] px-4 py-3 text-[15px] font-semibold text-white hover:brightness-[.96] sm:w-auto">
            Go to the Arena
          </Link>
        )}
      </div>
      <ol className="m-0 mt-8 grid list-none gap-6 p-0 lg:grid-cols-3">
        {STEPS.map((step, n) => (
          <StepCard
            key={step.title}
            step={step}
            n={n + 1}
            image={(step.showOwnedChog && ownChog) || step.image}
            balance={balances[n]}
            minted={reads[n].minted}
            done={done[n]}
            current={n === next}
            wallet={wallet}
            ready={ready}
            chain={chain}
          />
        ))}
      </ol>
    </div>
  );
}

const label = "font-mono text-[12px] tracking-[.12em] text-[#8E85A3] uppercase";
const mono = "font-mono text-[14px] text-[#6B6185]";

function StepCard({ step, n, image, balance, minted, done, current, wallet, ready, chain }: {
  step: Step; n: number; image: string; balance?: bigint; minted?: bigint; done: boolean; current: boolean; wallet: AppWallet; ready: boolean; chain: Chain;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [revealId, setRevealId] = useState<bigint>();

  const claim = async () => {
    if (!("contract" in step) || !step.contract || !wallet.address) return;
    let id: string | number | undefined;
    try {
      const hash = await writeContractAsync({ address: step.contract, abi: step.abi, functionName: "mint", args: step.args(wallet.address), chainId: chain.id });
      id = toast.loading("Confirming on Monad Testnet…");
      const { logs, status } = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
      if (status !== "success") throw new Error();
      const [mint] = step.reveal ? parseEventLogs({ abi: transferAbi, eventName: "Transfer", logs }) : [];
      if (mint) {
        toast.dismiss(id);
        setRevealId(mint.args.tokenId);
      } else {
        // Token claims' cta names the amount ("Claim 1,000 $CHOG").
        toast.success(`+${step.cta.replace(/^Claim /, "")}`, {
          id,
          description: "It's in your wallet.",
          action: { label: "View tx", onClick: () => window.open(`${chain.blockExplorers?.default.url}/tx/${hash}`, "_blank", "noopener") },
        });
      }
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as { shortMessage?: string }).shortMessage ?? "Transaction failed", { id });
    }
  };

  const getMon = async () => {
    if (wallet.address) {
      await navigator.clipboard.writeText(wallet.address).then(
        () => toast.success("Address copied", { description: "Paste it on the Monad faucet." }),
        () => {},
      );
    }
    window.open("href" in step ? step.href : undefined, "_blank", "noopener");
  };

  let action;
  if ("href" in step) action = { label: step.cta, onClick: getMon, external: true };
  else if (!step.contract) action = { label: "Not deployed", disabled: true };
  else if (wallet.loading) action = { label: "Loading…", disabled: true };
  else if (!wallet.connected) action = { label: "Connect wallet", onClick: wallet.login };
  else if (wallet.wrongChain) action = { label: "Switch network", onClick: wallet.switchChain };
  else if ("limit" in step && minted !== undefined && minted >= step.limit) action = { label: "Limit reached", disabled: true };
  else if (isPending) action = { label: "Confirm in wallet…", disabled: true };
  else action = { label: step.cta, onClick: claim };

  const formatted = ready && balance !== undefined && step.format ? step.format(balance) : "—";
  const limitText = ready && minted !== undefined && "limitText" in step ? step.limitText(minted) : undefined;
  const button = (
    <Button
      variant="plain"
      disabled={action.disabled}
      onClick={action.onClick}
      className={`h-auto w-full rounded-[10px] px-4 py-3 text-[15px] font-semibold ${current ? "bg-[#6E56E8] text-white" : "border border-[#DCD5EC] bg-white text-[#1A1130]"}`}
    >
      {action.label}
      {action.external && <ExternalLink className="size-3.5" aria-hidden />}
    </Button>
  );
  if (step.optional) {
    return (
      <li className="flex flex-col rounded-2xl bg-[#F4F1FA] p-6 sm:p-7">
        <p className={`m-0 ${label}`}>Extras · Optional</p>
        <div className="mt-5 flex items-center gap-4">
          <img src={image} alt="" className="size-14 rounded-xl bg-[#ECE8F3] object-cover" />
          <div>
            <h2 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{step.title}</h2>
            <span className={mono}>{formatted}</span>
          </div>
        </div>
        <p className="mt-4 text-[16px] leading-normal text-[#6B6185]">{step.blurb}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[14px] text-[#6B6185]">
          <span className="rounded-lg bg-white px-3 py-2">
            Stake in MON<b className="block font-semibold text-[#1A1130]">Always</b>
          </span>
          <span className="rounded-lg bg-white px-3 py-2">
            Stake in {step.title}<b className="block font-semibold text-[#1A1130]">{done ? "Ready" : "Needs claim"}</b>
          </span>
        </div>
        <div className="mt-auto pt-6">
          {limitText && <p className={`mt-0 mb-3 ${mono}`}>{limitText}</p>}
          {button}
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex flex-col rounded-2xl border bg-white p-6 transition-[border-color,box-shadow] duration-300 sm:p-7 ${current ? "border-[#6E56E8] shadow-[0_12px_32px_-16px_rgba(110,86,232,.45)]" : "border-[#ECE8F3]"}`}
    >
      <div className="flex items-start justify-between">
        <img src={image} alt="" className="size-16 rounded-2xl bg-[#F1EEFB] object-cover" />
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F5EC] px-3 py-1 text-[14px] font-semibold text-[#1F8A55]">
            <Check className="size-4" strokeWidth={3} aria-hidden />
            Done
          </span>
        ) : (
          current && <span className="rounded-full bg-[#F1EEFB] px-3 py-1 text-[14px] font-semibold text-[#6E56E8]">Next</span>
        )}
      </div>
      <p className={`mt-6 mb-0 ${label}`}>Step {n}</p>
      <h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-.01em]">{step.title}</h2>
      <p className="mt-2 text-[16px] leading-normal text-[#6B6185]">{step.blurb}</p>
      <div className="mt-auto pt-6">
        {"href" in step && done ? (
          <div className="flex items-center justify-between border-t border-[#ECE8F3] pt-5">
            <span className={mono}>{formatted}</span>
            <button type="button" onClick={getMon} className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#6E56E8] hover:underline">
              Top up
              <ArrowUpRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <p className={`mt-0 mb-3 ${mono}`}>{limitText ?? formatted}</p>
            {button}
          </>
        )}
      </div>
      {revealId !== undefined && <Reveal key={String(revealId)} id={revealId} onClose={() => setRevealId(undefined)} />}
    </li>
  );
}

/** A freshly minted Chog arrives sealed, then reveals its art and traits on its own once the art loads. */
function Reveal({ id, onClose }: { id: bigint; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  useEffect(() => {
    if (revealed) return;
    // The mint is confirmed; unavailable metadata or artwork must not hold up the user.
    const timeout = setTimeout(() => setArtFailed(true), 15000);
    return () => clearTimeout(timeout);
  }, [revealed]);
  const uri = useReadContract({ address: nft, abi: nftAbi, functionName: "tokenURI", args: [id], chainId: chain.id });
  const meta = useQuery({
    queryKey: ["chog-meta", uri.data],
    queryFn: async (): Promise<Meta> => fetchMeta(uri.data!),
    enabled: !!uri.data,
    staleTime: Infinity,
  });
  const failed = uri.isError || meta.isError || artFailed;
  const traits = meta.data?.attributes?.slice(0, 6) ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 rounded-2xl bg-white p-5 sm:max-w-[380px]">
        <DialogTitle className="text-[19px] font-semibold tracking-[-.01em] text-[#1A1130]">
          {revealed ? (meta.data?.name ?? `Chog #${id}`) : `Chog #${id} is yours`}
        </DialogTitle>
        <DialogDescription className="mt-1 text-[14px] text-[#6B6185]">
          {revealed ? "Your ticket into the Arena." : failed ? "Mint complete. The artwork is unavailable right now. You can continue playing." : "Summoning your Chog…"}
        </DialogDescription>
        <div className="relative mt-4 aspect-square overflow-hidden rounded-xl bg-[#1A1130]">
          {meta.data && (
            <img
              src={ipfs(meta.data.image)}
              alt={revealed ? meta.data.name : ""}
              // Hold the sealed "?" a beat so the reveal reads as one, even when the art is cached.
              onLoad={() => setTimeout(() => setRevealed(true), 300)}
              onError={() => setArtFailed(true)}
              className={`size-full object-cover transition-[filter,scale] duration-700 ease-out motion-reduce:transition-none ${revealed ? "scale-100" : "scale-110 blur-2xl brightness-0"}`}
            />
          )}
          {!revealed && (
            <span aria-hidden className={`absolute inset-0 grid place-items-center text-[88px] font-semibold text-[#A391FF] ${failed ? "" : "animate-pulse"}`}>?</span>
          )}
        </div>
        {revealed && traits.length > 0 && (
          <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-1.5 p-0 animate-in fade-in-0 slide-in-from-bottom-2 delay-700 duration-500 fill-mode-both">
            {traits.map((t) => (
              <li key={t.trait_type} className="rounded-lg bg-[#F4F1FA] px-2.5 py-1.5">
                <span className="block text-[11px] text-[#8E85A3]">{t.trait_type}</span>
                <span className="block truncate text-[13px] font-semibold text-[#1A1130]">{t.value}</span>
              </li>
            ))}
          </ul>
        )}
        {(revealed || failed) && (
          <div className="mt-4 grid grid-cols-2 gap-2 animate-in fade-in-0 delay-700 duration-500 fill-mode-both">
            <Link href="/profile" className="rounded-[10px] border border-[#DCD5EC] bg-white p-3 text-center text-[15px] font-semibold text-[#1A1130] hover:bg-[#F7F5FB]">
              View profile
            </Link>
            <Link href="/create" className="rounded-[10px] bg-[#6E56E8] p-3 text-center text-[15px] font-semibold text-white hover:brightness-[.96]">
              Make a call
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
