"use client";
/* eslint-disable @next/next/no-img-element -- Use the supplied Chog artwork. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { erc20Abi, formatUnits, parseEventLogs, zeroAddress, type Hex } from "viem";
import { useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { burned, cleanAmount, DEADLINES, duelAbi, feedAbi, MIN_LEAD, fmt, parseStake, payout, pot, TARGET_DECIMALS, toUnits } from "./duel";
import Link from "next/link";
import { NETWORKS } from "./networks";
import { StepAction, useOnboarding } from "./onboarding";
import { useWallet } from "./wallet";

// Each asset settles on its Chainlink feed (networks.ts); an asset only shows on networks that have one.
const ASSETS = {
  MON: { name: "Monad", eg: "0.02", bg: "#836EF9", mark: <path transform="translate(6.6 6.4) scale(.8)" fill="#fff" d="M11.7375 0C8.34799 0 0 8.53443 0 11.9999C0 15.4654 8.34799 24 11.7375 24C15.1271 24 23.4752 15.4653 23.4752 11.9999C23.4752 8.53458 15.1272 0 11.7375 0ZM9.90843 18.8619C8.47911 18.4637 4.63621 11.5912 5.02577 10.1299C5.41532 8.66856 12.1374 4.73984 13.5667 5.1381C14.9961 5.5363 18.839 12.4087 18.4494 13.87C18.0599 15.3314 11.3378 19.2602 9.90843 18.8619Z" /> },
  BTC: { name: "Bitcoin", eg: "85,000", bg: "#F7931A", mark: <text x="16" y="22" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">₿</text> },
  SOL: { name: "Solana", eg: "110", bg: "#14111F", mark: <g fill="#14F195"><path d="M11 10h12l-2 2.6H9z" /><path d="M9 14.7h12l2 2.6H11z" fill="#9AA5F8" /><path d="M11 19.4h12l-2 2.6H9z" fill="#C86DFF" /></g> },
  ETH: { name: "Ethereum", eg: "2,500", bg: "#627EEA", mark: <g fill="#fff"><path fillOpacity=".6" d="M16.5 4v8.87l7.5 3.35z" /><path d="M16.5 4 9 16.22l7.5-3.35z" /><path fillOpacity=".6" d="M16.5 21.97V28l7.5-10.38z" /><path d="M16.5 28v-6.03L9 17.62z" /><path fillOpacity=".2" d="m16.5 20.57 7.5-4.35-7.5-3.35z" /><path fillOpacity=".6" d="m9 16.22 7.5 4.35v-7.7z" /></g> },
};
type Asset = keyof typeof ASSETS;
const Coin = ({ a }: { a: Asset }) => (
  <svg viewBox="0 0 32 32" className="size-6 shrink-0" aria-hidden><circle cx="16" cy="16" r="16" fill={ASSETS[a].bg} />{ASSETS[a].mark}</svg>
);
// Each duel is staked in one token; the acceptor matches it. The first preset is the default stake. $CHOG fees are burned, MON fees fund $CHOG buybacks.
const TOKENS = {
  MON: { label: "MON", icon: "/monad-mark.svg", presets: [1, 5, 10, 50], fee: "Buyback fund (5%)" },
  CHOG: { label: "$CHOG", icon: "/chog-coin.avif", presets: [10, 100, 1000, 5000], fee: "Burned (5%)" },
};
type Token = keyof typeof TOKENS;

export function CreateCall() {
  const w = useWallet();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const { required, next } = useOnboarding();
  // Until the wallet can duel, the form sits blurred behind its next onboarding step.
  const gate = w.ready ? next : required[0];
  const assets = (Object.keys(ASSETS) as Asset[]).filter((a) => w.net.feeds[a]);
  const [picked, setAsset] = useState<Asset>("MON");
  // Falls back to the first asset this network has a feed for (testnet has no MON).
  const asset = assets.includes(picked) ? picked : assets[0];
  const [dir, setDir] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("Month end");
  const [custom, setCustom] = useState(""); // datetime-local value, used when deadline is "Custom"
  const [token, setToken] = useState<Token>("MON");
  const [stakeText, setStakeText] = useState("1");
  // The created duel's share link; set once its create transaction confirms.
  const [link, setLink] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const stake = parseStake(stakeText);
  const t = TOKENS[token];
  const balance = token === "MON" ? w.monBalance : w.chogBalance;
  const pickToken = (k: Token) => { setToken(k); setStakeText(String(TOKENS[k].presets[0])); setLink(undefined); };
  // Any edit unlocks the preview so the share card never shows a stale call.
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLink(undefined); };

  const { chain, chog, duel } = w.net;
  const stakeUnits = toUnits(stakeText, 18); // MON and $CHOG both have 18 decimals
  const targetUnits = toUnits(target, TARGET_DECIMALS);
  const allowance = useReadContract({
    address: chog, abi: erc20Abi, functionName: "allowance", args: [w.address!, duel!], chainId: chain.id,
    query: { enabled: token === "CHOG" && !!chog && !!duel && !!w.address },
  });
  // The live price from mainnet Chainlink on both networks: testnet duels settle on FeedMirror copies of it, which hold only settled rounds.
  const latest = useReadContract({
    address: NETWORKS.mainnet.feeds[asset], abi: feedAbi, functionName: "latestRoundData", chainId: NETWORKS.mainnet.chain.id,
    query: { refetchInterval: 15_000 },
  });
  const price = latest.data && Number(formatUnits(latest.data[1], TARGET_DECIMALS));
  const needsApproval = token === "CHOG" && (allowance.data ?? BigInt(0)) < stakeUnits;
  const short = balance != null && stake > balance;
  // Called only at lock time: presets count from the click, and reading the clock during render breaks prerendering.
  const deadlineAt = () => deadline === "Custom" ? Math.floor(new Date(custom).getTime() / 1000) : DEADLINES[deadline].at();
  const when = deadline !== "Custom" ? DEADLINES[deadline].phrase : !custom ? "…" : "by " + new Date(custom).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) + " UTC";
  const problem = !duel ? "Duels aren't live on this network yet" : deadline === "Custom" && !custom ? "Pick a deadline" : !(targetUnits > BigInt(0)) ? "Enter a target price" : !(stakeUnits > BigInt(0)) ? "Enter a stake" : short ? `Not enough ${t.label}` : null;
  const lockLabel = busy ?? (link ? "Locked ✓" : problem ?? `${needsApproval ? "Approve & lock" : "Lock"} ${fmt(stake)} ${t.label} & get link`);
  const claim = `${asset} will be ${dir} $${target || "…"} ${when}.`;

  const lock = async () => {
    if (!duel || (token === "CHOG" && !chog)) return;
    if (!(deadlineAt() >= Date.now() / 1000 + MIN_LEAD)) return void toast.error(`Deadline must be at least ${MIN_LEAD / 60} min out`);
    // One click may need two transactions for $CHOG: approve the escrow, then create.
    const send = async (label: string, write: () => Promise<Hex>) => {
      setBusy("Confirm in wallet…");
      const hash = await write();
      setBusy(label);
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      return receipt;
    };
    try {
      if (needsApproval) {
        await send("Approving…", () => writeContractAsync({ address: chog!, abi: erc20Abi, functionName: "approve", args: [duel, stakeUnits], chainId: chain.id }));
      }
      const receipt = await send("Locking…", () =>
        writeContractAsync({
          address: duel,
          abi: duelAbi,
          functionName: "create",
          args: [token === "MON" ? zeroAddress : chog!, stakeUnits, w.net.feeds[asset]!, dir === "above", targetUnits, BigInt(deadlineAt())],
          value: token === "MON" ? stakeUnits : undefined,
          chainId: chain.id,
        }),
      );
      const [created] = parseEventLogs({ abi: duelAbi, eventName: "DuelCreated", logs: receipt.logs });
      setLink(`${location.origin}/d/${created.args.id}`);
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed");
    } finally {
      setBusy(undefined);
    }
  };
  const copyLink = () => link && navigator.clipboard.writeText(link).then(() => toast.success("Link copied"), () => {});
  const seg = (on: boolean, fg = "#1A1130") => ({ background: on ? "#fff" : "transparent", color: on ? fg : "#8E85A3" });

  return (
    <div className="grid grid-cols-1 items-start gap-10 min-[901px]:grid-cols-[minmax(0,1fr)_440px]">
      <div>
        <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Make a call</h1>
        <p className="mt-1.5 text-[15px] text-[#6B6185]">Your stake is held in escrow until someone accepts or the deadline passes.</p>
        <Card className="relative mt-7 overflow-hidden rounded-2xl border border-[#ECE8F3] bg-white p-0 ring-0">
          {gate && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 p-6">
              <div className="flex max-w-[340px] flex-col items-center rounded-2xl border border-[#ECE8F3] bg-white px-7 py-8 text-center shadow-[0_12px_40px_rgba(26,17,48,.12)]">
                <img alt="" src="/chog-logo.png" className="size-12 rounded-xl" />
                <p className="mt-4 font-mono text-[12px] font-medium text-[#8E85A3]">STEP {required.indexOf(gate) + 1} OF {required.length}</p>
                <p className="mt-1 text-[17px] font-semibold">{gate.title}</p>
                <p className="mt-1.5 text-[14px] leading-normal text-[#6B6185]">{gate.blurb}</p>
                {gate.action && <StepAction action={gate.action} className="mt-5 w-full justify-center p-3 text-[15px]" />}
              </div>
            </div>
          )}
          <div inert={!!gate} aria-hidden={!!gate} className={`flex flex-col gap-[22px] p-6 transition-[filter] ${gate ? "pointer-events-none blur-[3px] select-none" : ""}`}>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
              Asset
              <Select value={asset} onValueChange={(v) => v && edit(setAsset)(v as Asset)}>
                <SelectTrigger aria-label="Asset" className="h-12 w-full data-[size=default]:h-12 rounded-[10px] border-[#DCD5EC] bg-white px-3 py-0 text-[15px] font-medium text-[#1A1130] hover:border-[#C9BFE3]">
                  <SelectValue>{(v: Asset) => <><Coin a={v} />{v}</>}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} sideOffset={6} className="rounded-xl bg-white p-1 shadow-lg ring-[#ECE8F3]">
                  {assets.map((a) => (
                    <SelectItem key={a} value={a} className="gap-2.5 rounded-lg py-2 pl-2 text-[15px] text-[#1A1130]">
                      <Coin a={a} />
                      <span className="font-medium">{a}</span>
                      <span className="text-[#8E85A3]">{ASSETS[a].name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
              Deadline
              <div className="grid h-12 grid-cols-5 gap-1 rounded-[10px] bg-[#F4F1FA] p-1">
                {[...Object.keys(DEADLINES), "Custom"].map((d) => (
                  <Button key={d} variant="plain" onClick={() => edit(setDeadline)(d)} style={seg(deadline === d)} className="h-full rounded-[7px] px-1 py-0 text-[13px] font-medium whitespace-nowrap">
                    {d}
                  </Button>
                ))}
              </div>
              {deadline === "Custom" && (
                <Input type="datetime-local" value={custom} onChange={(e) => edit(setCustom)(e.target.value)} className="h-auto rounded-[10px] border-[#DCD5EC] p-3 font-mono text-[15px] text-[#1A1130]" />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
            I think it will be
            <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#F4F1FA] p-1">
              <Button variant="plain" onClick={() => edit(setDir)("above")} style={seg(dir === "above", "#1A8A55")} className="h-auto rounded-[7px] p-2.5 text-[14px] font-semibold">Above</Button>
              <Button variant="plain" onClick={() => edit(setDir)("below")} style={seg(dir === "below", "#C43A52")} className="h-auto rounded-[7px] p-2.5 text-[14px] font-semibold">Below</Button>
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
            <span className="flex justify-between">Target price (USD){price != null && <span className="font-mono text-[#1A1130]">{asset} now ${fmt(price)}</span>}</span>
            <div className="flex items-center rounded-[10px] border border-[#DCD5EC] px-3 focus-within:border-[#C9BFE3]">
              <span className="font-mono text-[17px] font-medium text-[#8E85A3]">$</span>
              <Input value={target} placeholder={price != null ? fmt(price) : ASSETS[asset].eg} inputMode="decimal" onChange={(e) => edit(setTarget)(cleanAmount(e.target.value, TARGET_DECIMALS))} className="h-auto flex-1 border-0 bg-transparent py-3 pr-0 pl-1 font-mono text-[17px] font-medium text-[#1A1130] shadow-none focus-visible:ring-0" />
            </div>
          </label>
          <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
            Stake in
            <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#F4F1FA] p-1">
              {(Object.keys(TOKENS) as Token[]).map((k) => (
                <Button key={k} variant="plain" onClick={() => pickToken(k)} style={seg(token === k)} className="h-auto gap-2 rounded-[7px] p-2.5 text-[14px] font-semibold">
                  <img alt="" src={TOKENS[k].icon} className="size-5 rounded-full" />
                  {TOKENS[k].label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
            <div className="flex justify-between">
              <span>Your stake</span>
              <span>Balance {w.ready && balance != null ? `${fmt(balance)} ${t.label}` : "—"}</span>
            </div>
            <div className={`flex items-center rounded-[10px] border px-3 ${short ? "border-[#E8A3AF]" : "border-[#DCD5EC]"}`}>
              <Input value={stakeText} placeholder="0" inputMode="decimal" onChange={(e) => edit(setStakeText)(cleanAmount(e.target.value, 18))} className="h-auto flex-1 border-0 bg-transparent px-0 py-3 font-mono text-[17px] font-medium text-[#1A1130] shadow-none focus-visible:ring-0" />
              <span className="font-mono text-[13px] font-medium text-[#8E85A3]">{t.label}</span>
            </div>
            {short && (
              <p className="m-0 text-[13px] text-[#C43A52]">
                You have {fmt(balance)} {t.label}.{" "}
                {w.isTestnet ? (
                  <Link href="/app/faucet" className="font-semibold text-[#6E56E8] underline-offset-2 hover:underline">Get more from the faucet</Link>
                ) : token === "CHOG" && (
                  <a href={w.net.getChog} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#6E56E8] underline-offset-2 hover:underline">Buy on nad.fun</a>
                )}
              </p>
            )}
            <div className="flex gap-1.5">
              {t.presets.map((p) => (
                <Button key={p} variant="plain" onClick={() => edit(setStakeText)(String(p))} className="h-auto rounded-[7px] border border-[#ECE8F3] bg-white px-2.5 py-1.5 font-mono text-[12px] font-medium text-[#4A4063]">
                  {fmt(p)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-xl bg-[#FAF9FC] p-4 text-[14px]">
            <div className="flex justify-between"><span className="text-[#6B6185]">Pot if accepted</span><span className="font-mono">{fmt(pot(stake))} {t.label}</span></div>
            <div className="flex justify-between"><span className="text-[#6B6185]">{t.fee}</span><span className="font-mono text-[#C43A52]">−{fmt(burned(stake))} {t.label}</span></div>
            <div className="flex justify-between"><span className="text-[#6B6185]">Settles</span><span className="font-mono">{when}</span></div>
            <div className="flex justify-between border-t border-[#ECE8F3] pt-2.5 font-semibold"><span>You receive if right</span><span className="font-mono text-[#6E56E8]">{fmt(payout(stake))} {t.label}</span></div>
          </div>
          <Button variant="plain" disabled={!!problem || !!busy || !!link} onClick={lock} className="h-auto rounded-[11px] bg-[#6E56E8] p-[15px] text-[16px] font-semibold text-white disabled:bg-[#C9BFE3] disabled:opacity-100">
            {lockLabel}
          </Button>
          </div>
        </Card>
      </div>
      <div className="sticky top-24 flex flex-col gap-3">
        <div className="font-mono text-[12px] font-medium text-[#8E85A3]">SHARE CARD PREVIEW</div>
        <div className="overflow-hidden rounded-2xl border border-[#ECE8F3] bg-white">
          <div className="bg-[#1A1130] p-6 text-white">
            <div className="flex justify-between font-mono text-[12px] font-medium text-[#B9A8FF]"><span>CHOGXBET · DUEL</span><span>{fmt(stake)} {t.label}</span></div>
            <div className="mt-[18px] flex items-center gap-2.5">
              <img alt="" src="/chog-1044.png" className="size-9 rounded-[9px]" />
              <span className="text-[14px] text-[#C9C0E6]">Chog #1044 · 9W 3L</span>
            </div>
            <div className="mt-3.5 text-[26px] leading-[1.15] font-semibold tracking-[-.02em] text-pretty">{claim}</div>
            <div className="mt-[22px] flex items-center justify-between">
              <span className="text-[14px] text-[#C9C0E6]">Seat open for a challenger</span>
              <span className="rounded-full bg-[#A391FF] px-3 py-[7px] text-[13px] font-semibold text-[#140A2A]">Take the bet →</span>
            </div>
          </div>
          <div className="px-3.5 py-2.5 text-[13px] text-[#8E85A3]">{link ? link.replace(/^https?:\/\//, "") : "conviction.chog.xyz/d/new"}</div>
        </div>
        {link && (
          <div className="flex flex-col gap-2.5 rounded-xl bg-[#E3F6EC] p-4 text-[14px] text-[#1A8A55]">
            <span className="font-semibold">Call locked. Share it.</span>
            <div className="flex gap-2">
              <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(claim)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg bg-[#1A1130] p-2.5 text-center font-semibold text-white">Post on X</a>
              <Button variant="plain" onClick={copyLink} className="h-auto rounded-lg border border-[#B8E3CC] bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#1A8A55]">Copy link</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
