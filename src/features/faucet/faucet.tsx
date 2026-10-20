"use client";
/* eslint-disable @next/next/no-img-element -- Use the supplied Chog artwork. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatEther, parseAbi, parseEther, parseEventLogs, type Abi, type Address, type Chain } from "viem";
import { useBalance, useConfig, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NETWORKS } from "@/features/betting/networks";
import { useWallet, type AppWallet } from "@/features/betting/wallet";
import { ipfs, nftAbi, useChogAvatar, type Meta } from "@/features/profile/chogs";

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
  format: (balance: bigint) => string;
} & (
  | { href: string }
  | {
      contract?: Address; abi: Abi; args: (to: Address) => readonly unknown[];
      limit: bigint; // claims divide it evenly, so reaching it means no claim fits
      limitText: (minted: bigint) => string;
      reveal?: boolean; // open the minted NFT with a reveal
    }
);

// The faucet, in the order people need it (gas first). Edit copy, amounts and links here.
// Minted items call the mock contracts' open mint(); their addresses come from .env.
const STEPS: Step[] = [
  {
    title: "Testnet MON",
    blurb: "Pays the gas for every transaction, and you can stake it on calls too. Comes from Monad's own faucet, which asks for your address. We copy it for you.",
    cta: "Get MON",
    image: "/monad-mark.svg",
    format: (b) => `${fmt(Number(formatEther(b)))} MON`,
    href: "https://faucet.monad.xyz",
  },
  {
    title: "1,000 tCHOG",
    blurb: "Test $CHOG to stake on calls in the Arena. Claim again when you run low, up to 10,000 a day.",
    cta: "Get tCHOG",
    image: "/chog-coin.avif",
    format: (b) => `${fmt(Number(formatEther(b)))} tCHOG`,
    contract: chog,
    abi: parseAbi(["function mint(address to, uint256 amount)", balanceOf, minted]),
    args: (to) => [to, parseEther("1000")],
    limit: parseEther("10000"),
    limitText: (m) => `${fmt(Number(formatEther(m)))} / 10,000 claimed today`,
  },
  {
    title: "A Chog NFT",
    blurb: "A test Chog Genesis with the real collection's art and traits. Up to 5 per wallet.",
    cta: "Get NFT",
    image: "/chog-1044.png",
    showOwnedChog: true,
    format: (b) => `${b} ${b === BigInt(1) ? "NFT" : "NFTs"}`,
    contract: nft,
    abi: parseAbi(["function mint(address to) returns (uint256)", balanceOf, minted]),
    args: (to) => [to],
    limit: BigInt(5),
    limitText: (m) => `${m} / 5 minted`,
    reveal: true,
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
  const count = done.filter(Boolean).length;
  const next = ready ? done.indexOf(false) : -1;
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
    <div data-screen-label="Faucet" className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
      <div className="self-start lg:sticky lg:top-28">
        <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Faucet</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6185]">
          {!ready
            ? "Free test tokens to try ChogXBet on Monad Testnet. Get them in order, gas first. tCHOG is optional; you can stake MON instead."
            : count === STEPS.length
              ? "You have everything. Pick a call you disagree with and take the other side."
              : `${count} of ${STEPS.length} ready. Get them in order, gas first.`}
        </p>
        {ready && count === STEPS.length && (
          <Link href="/app" className="mt-5 inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-3 text-[15px] font-semibold text-white hover:brightness-[.96]">
            Go to the Arena
          </Link>
        )}
        <p className="mt-6 border-t border-[#ECE8F3] pt-4 text-[13px] leading-relaxed text-[#8E85A3]">
          Testnet only. These tokens have no value and never reach mainnet.
        </p>
      </div>
      <ol className="m-0 list-none overflow-hidden rounded-2xl border border-[#ECE8F3] bg-white p-0">
        {STEPS.map((step, n) => (
          <StepRow
            key={step.title}
            step={step}
            n={n + 1}
            last={n === STEPS.length - 1}
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

function StepRow({ step, n, last, image, balance, minted, done, current, wallet, ready, chain }: {
  step: Step; n: number; last: boolean; image: string; balance?: bigint; minted?: bigint; done: boolean; current: boolean; wallet: AppWallet; ready: boolean; chain: Chain;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [revealId, setRevealId] = useState<bigint>();
  const [receivedTx, setReceivedTx] = useState<string>();

  const claim = async () => {
    if (!("contract" in step) || !step.contract || !wallet.address) return;
    let id: string | number | undefined;
    try {
      const hash = await writeContractAsync({ address: step.contract, abi: step.abi, functionName: "mint", args: step.args(wallet.address), chainId: chain.id });
      id = toast.loading("Confirming on Monad Testnet…");
      const { logs, status } = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
      if (status !== "success") throw new Error();
      const [mint] = step.reveal ? parseEventLogs({ abi: transferAbi, eventName: "Transfer", logs }) : [];
      toast.dismiss(id);
      if (mint) setRevealId(mint.args.tokenId);
      else setReceivedTx(`${chain.blockExplorers?.default.url}/tx/${hash}`);
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

  const dot = done
    ? "border-[#6E56E8] bg-[#6E56E8] text-white"
    : current
      ? "border-[#6E56E8] bg-white text-[#6E56E8] shadow-[0_0_0_4px_#F1EEFB]"
      : "border-[#DCD5EC] bg-white text-[#8E85A3]";

  return (
    <li className="relative grid grid-cols-[28px_48px_minmax(0,1fr)] items-start gap-x-4 gap-y-4 border-[#ECE8F3] px-5 py-6 sm:px-6 md:grid-cols-[28px_48px_minmax(0,1fr)_auto] [&+&]:border-t">
      {/* Line to the next step's dot; draws down once this step is done. */}
      {!last && (
        <span aria-hidden className="absolute top-[48px] left-[33px] h-full w-0.5 bg-[#ECE8F3] sm:left-[37px]">
          <span
            className={`block h-full w-full origin-top bg-[#6E56E8] transition-[scale] duration-700 ease-[cubic-bezier(.34,1.3,.64,1)] motion-reduce:transition-none ${done ? "scale-y-100" : "scale-y-0"}`}
          />
        </span>
      )}
      <span
        className={`relative z-10 mt-2.5 grid size-7 place-items-center rounded-full border-2 text-[13px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-300 ${dot}`}
      >
        {done ? <Check className="size-4" strokeWidth={3} aria-label="Done" /> : n}
      </span>
      <img src={image} alt="" className="size-12 rounded-xl bg-[#F1EEFB] object-cover" />
      <div className="min-w-0">
        <h2 className="m-0 text-[17px] font-semibold tracking-[-.01em]">{step.title}</h2>
        <p className="mt-1 max-w-[52ch] text-[14px] leading-normal text-[#6B6185]">{step.blurb}</p>
      </div>
      <div className="col-start-3 flex flex-wrap items-center gap-x-4 gap-y-2 md:col-start-auto md:flex-col md:items-end md:self-center">
        <span className="flex flex-col md:items-end">
          <span className="font-mono text-[13px] text-[#6B6185]">{ready && balance !== undefined ? step.format(balance) : "—"}</span>
          {ready && minted !== undefined && "limitText" in step && <span className="text-[12px] text-[#8E85A3]">{step.limitText(minted)}</span>}
        </span>
        <Button
          variant="plain"
          disabled={action.disabled}
          onClick={action.onClick}
          className={`h-auto min-w-[136px] rounded-[10px] px-4 py-2.5 text-[14px] font-semibold ${current ? "bg-[#6E56E8] text-white" : "border border-[#DCD5EC] bg-white text-[#1A1130]"}`}
        >
          {action.label}
          {action.external && <ExternalLink className="size-3.5" aria-hidden />}
        </Button>
      </div>
      {revealId !== undefined && <Reveal key={String(revealId)} id={revealId} onClose={() => setRevealId(undefined)} />}
      {receivedTx && <Received title={step.title} image={step.image} txUrl={receivedTx} onClose={() => setReceivedTx(undefined)} />}
    </li>
  );
}

/** Celebrates a token claim: the coin pops in with the amount. */
function Received({ title, image, txUrl, onClose }: { title: string; image: string; txUrl: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 rounded-2xl bg-white p-6 text-center sm:max-w-[340px]">
        <img src={image} alt="" className="mx-auto size-24 rounded-full shadow-[0_0_0_10px_#F1EEFB] animate-in zoom-in-50 spin-in-12 duration-700 ease-out fill-mode-both motion-reduce:animate-none" />
        <DialogTitle className="mt-6 text-[24px] font-semibold tracking-[-.02em] text-[#1A1130]">+{title}</DialogTitle>
        <DialogDescription className="mt-1.5 text-[14px] text-[#6B6185]">Congrats, it&apos;s in your wallet. Stake it on a call you believe in.</DialogDescription>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <a href={txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#DCD5EC] bg-white p-3 text-[15px] font-semibold text-[#1A1130] hover:bg-[#F7F5FB]">
            View tx
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <Link href="/app/create" className="rounded-[10px] bg-[#6E56E8] p-3 text-[15px] font-semibold text-white hover:brightness-[.96]">
            Make a call
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A freshly minted Chog arrives sealed; the owner taps to reveal its art and traits. */
function Reveal({ id, onClose }: { id: bigint; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const uri = useReadContract({ address: nft, abi: nftAbi, functionName: "tokenURI", args: [id], chainId: chain.id });
  const meta = useQuery({
    queryKey: ["chog-meta", uri.data],
    queryFn: async (): Promise<Meta> => (await fetch(ipfs(uri.data!))).json(),
    enabled: !!uri.data,
    staleTime: Infinity,
  });
  const failed = uri.isError || meta.isError;
  const traits = meta.data?.attributes?.slice(0, 6) ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 rounded-2xl bg-white p-5 sm:max-w-[380px]">
        <DialogTitle className="text-[19px] font-semibold tracking-[-.01em] text-[#1A1130]">
          {revealed ? (meta.data?.name ?? `Chog #${id}`) : `Chog #${id} is yours`}
        </DialogTitle>
        <DialogDescription className="mt-1 text-[14px] text-[#6B6185]">
          {revealed ? "Your ticket into the Arena." : "Fresh from the faucet. Who did you get?"}
        </DialogDescription>
        <div className="relative mt-4 aspect-square overflow-hidden rounded-xl bg-[#1A1130]">
          {meta.data && (
            <img
              src={ipfs(meta.data.image)}
              alt={revealed ? meta.data.name : ""}
              onLoad={() => setLoaded(true)}
              className={`size-full object-cover transition-[filter,scale] duration-[1400ms] ease-out motion-reduce:transition-none ${revealed ? "scale-100" : "scale-110 blur-2xl brightness-0"}`}
            />
          )}
          {!revealed && (
            <span aria-hidden className={`absolute inset-0 grid place-items-center text-[88px] font-semibold text-[#A391FF] ${loaded || failed ? "" : "animate-pulse"}`}>?</span>
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
        {revealed ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/app/profile" className="rounded-[10px] border border-[#DCD5EC] bg-white p-3 text-center text-[15px] font-semibold text-[#1A1130] hover:bg-[#F7F5FB]">
              View profile
            </Link>
            <Link href="/app/create" className="rounded-[10px] bg-[#6E56E8] p-3 text-center text-[15px] font-semibold text-white hover:brightness-[.96]">
              Make a call
            </Link>
          </div>
        ) : (
          <Button
            variant="plain"
            disabled={!loaded && !failed}
            onClick={() => (failed ? onClose() : setRevealed(true))}
            className="mt-4 h-auto w-full rounded-[10px] bg-[#6E56E8] p-3 text-[15px] font-semibold text-white disabled:bg-[#C9BFE3] disabled:opacity-100"
          >
            {failed ? "Couldn't load the art. See it on your profile" : loaded ? "Reveal" : "Summoning your Chog…"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
