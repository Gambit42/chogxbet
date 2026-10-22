"use client";
/* eslint-disable @next/next/no-img-element -- Use the supplied Chog artwork. */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, XIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import { erc20Abi, formatUnits, parseEther, parseEventLogs, zeroAddress, type Hex } from "viem";
import { useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { burned, cardQuery, cleanAmount, DEADLINES, duelAbi, feedAbi, MIN_LEAD, fmt, parseStake, payout, pot, shareKey, TARGET_DECIMALS, toUnits } from "./duel";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { ipfs, useChogMeta, useProfileChog } from "@/features/profile/chogs";
import { clipDare, DARE_IDEAS, dareBytes, lastWordAbi, LW_CHOG_FEE, LW_FEE, MAX_DARE } from "@/features/lastword/lastword";
import { ChogPicker } from "./arena";
import { ASSETS, Coin, type Asset } from "./coins";
import { NETWORKS } from "./networks";
import { ShareCard } from "./share-card";
import { StepAction, useOnboarding } from "./onboarding";
import { useWallet } from "./wallet";

// Each duel is staked in one token; the acceptor matches it. The first preset is the default stake. $CHOG fees are burned, MON fees fund $CHOG buybacks.
const TOKENS = {
  MON: { label: "MON", icon: "/monad-mark.svg", presets: [1, 5, 10, 50], fee: "Buyback fund (5%)" },
  CHOG: { label: "$CHOG", icon: "/chog-coin.avif", presets: [10, 100, 1000, 5000], fee: "Burned (5%)" },
};
type Token = keyof typeof TOKENS;
// Two ways to play: real stakes into the ChogDuel escrow, or Last Word, where a flat fee buys a dare the loser's Chog wears.
type Mode = "stakes" | "lastword";
// The form reads like the call itself: what you think, what you put on it, then one look before locking.
const STEPS = ["Your call", "Stake", "Review"];
const LW_STEPS = ["Your call", "Dare", "Review"];
// A blank form. Anything else is kept as a draft per wallet and network until the call is locked.
const BLANK = { mode: "stakes" as Mode, picked: "MON" as Asset, dir: "above" as "above" | "below", target: "", deadline: "Month end", custom: "", token: "MON" as Token, lwToken: "CHOG" as Token, stakeText: "1", challenge: false, rival: "", chog: "", dare: "", step: 0 };
type Draft = typeof BLANK;
// A datetime-local value ("2026-10-23T14:00") for a timestamp, in the viewer's own time zone.
const localInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const BLANK_JSON = JSON.stringify(BLANK);
// Every field is checked, so a stale or hand-edited draft falls back to blank values instead of breaking the form.
const parseDraft = (raw: string | null): Draft | null => {
  let d: Record<string, unknown>;
  try { d = JSON.parse(raw ?? ""); } catch { return null; }
  if (!d || typeof d !== "object") return null;
  const s = (v: unknown, ok: (v: string) => boolean = () => true) => (typeof v === "string" && ok(v) ? v : undefined);
  return {
    mode: d.mode === "lastword" ? "lastword" : "stakes",
    picked: (s(d.picked, (v) => Object.hasOwn(ASSETS, v)) ?? BLANK.picked) as Asset,
    dir: d.dir === "below" ? "below" : "above",
    target: cleanAmount(s(d.target) ?? "", TARGET_DECIMALS),
    deadline: s(d.deadline, (v) => Object.hasOwn(DEADLINES, v) || v === "Custom") ?? BLANK.deadline,
    custom: s(d.custom) ?? "",
    token: (s(d.token, (v) => Object.hasOwn(TOKENS, v)) ?? BLANK.token) as Token,
    lwToken: (s(d.lwToken, (v) => Object.hasOwn(TOKENS, v)) ?? BLANK.lwToken) as Token,
    stakeText: cleanAmount(s(d.stakeText) ?? BLANK.stakeText, 18),
    challenge: d.challenge === true,
    rival: (s(d.rival) ?? "").replace(/\D/g, "").replace(/^0+/, ""),
    chog: (s(d.chog) ?? "").replace(/\D/g, ""),
    dare: s(d.dare) ?? "",
    step: typeof d.step === "number" && STEPS[d.step] ? d.step : 0,
  };
};
const noop = () => () => {};
const skel = "block animate-pulse bg-[#F1EEFB] motion-reduce:animate-none";
// The mode bar is already lavender, so its placeholders need a shade darker to show.
const skelTint = "block animate-pulse bg-[#E3DCF6] motion-reduce:animate-none";
// The old step leaves one side while the next enters from the other; d is 1 forward, -1 back.
const slide = {
  enter: (d: number) => ({ x: `${d * 100}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: `${d * -100}%`, opacity: 0 }),
};

// `preset` comes from the link: ?mode=stake|lastword picks the starting mode.
export function CreateCall({ preset }: { preset?: { lastWord: boolean } }) {
  const w = useWallet();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const router = useRouter();
  const { required, next } = useOnboarding();
  // Until the wallet can duel, the form sits blurred behind its next onboarding step.
  const gate = w.ready ? next : required[0];
  // Session restoring or balances still loading: show a skeleton form, not "Connect wallet" or an unlocked form.
  const checking = w.loading || (w.ready && required.some((s) => s.done === undefined));
  const assets = (Object.keys(ASSETS) as Asset[]).filter((a) => w.net.feeds[a]);
  const [picked, setAsset] = useState(BLANK.picked);
  // Falls back to the first asset this network has a feed for (testnet has no MON).
  const asset = assets.includes(picked) ? picked : assets[0];
  const [dir, setDir] = useState(BLANK.dir);
  const [target, setTarget] = useState(BLANK.target);
  const [deadline, setDeadline] = useState(BLANK.deadline);
  const [custom, setCustom] = useState(BLANK.custom); // datetime-local value, used when deadline is "Custom"
  const [pickOpen, setPickOpen] = useState(false);
  const [token, setToken] = useState(BLANK.token);
  const [lwToken, setLwToken] = useState(BLANK.lwToken); // Last Word's fee token; $CHOG by default (burned), MON goes to the treasury
  const [stakeText, setStakeText] = useState(BLANK.stakeText);
  const [challenge, setChallenge] = useState(BLANK.challenge); // open to any Chog holder, or only to one Chog's holder
  const [rival, setRival] = useState(BLANK.rival); // that Chog's id
  const [chogPick, setChogPick] = useState(BLANK.chog); // the Chog the creator enters with; "" = their profile Chog
  const [mode, setMode] = useState<Mode>(preset?.lastWord ? "lastword" : BLANK.mode);
  // The mode rides the URL (?mode=stake | lastword), so the link opens the same game. The native history API, not the router:
  // a router navigation would remount the form (the page keys it by its search params) and lose what was typed.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    q.set("mode", mode === "lastword" ? "lastword" : "stake");
    window.history.replaceState(null, "", `${location.pathname}?${q}`);
  }, [mode]);
  const lw = mode === "lastword";
  const steps = lw ? LW_STEPS : STEPS;
  const [dare, setDare] = useState(BLANK.dare); // Last Word: what the losing Chog wears
  const [busy, setBusy] = useState<string>();
  const [step, setStep] = useState(BLANK.step); // index into STEPS
  const [slideDir, setSlideDir] = useState(1); // 1 forward, -1 back: which way the steps slide
  const go = (n: number) => { setSlideDir(n < step ? -1 : 1); setStep(n); };

  // Once a wallet connects, a draft it left behind waits behind "Continue / Start new"; until then nothing is saved over it.
  const draftKey = w.address && `chogxbet:create-draft:${w.net.chain.id}:${w.address.toLowerCase()}`;
  const saved = useSyncExternalStore(noop, () => { try { return draftKey ? localStorage.getItem(draftKey) : null; } catch { return null; } }, () => null);
  const [settled, setSettled] = useState<string>(); // the draftKey whose stored draft was continued or dropped
  const stored = draftKey && settled !== draftKey ? parseDraft(saved) : null;
  if (draftKey && settled !== draftKey && !stored) setSettled(draftKey); // nothing to ask about: start saving
  const blocked = !!(gate || stored);
  const pickUp = (d: Draft) => {
    setMode(d.mode); setDare(clipDare(d.dare)); setAsset(d.picked); setDir(d.dir); setTarget(d.target); setDeadline(d.deadline); setCustom(d.custom);
    setToken(d.token); setLwToken(d.lwToken); setStakeText(d.stakeText); setChallenge(d.challenge); setRival(d.rival); setChogPick(d.chog);
    setSlideDir(1); setStep(d.step); setSettled(draftKey);
  };
  const draftJson = JSON.stringify({ mode, picked, dir, target, deadline, custom, token, lwToken, stakeText, challenge, rival, chog: chogPick, dare, step } satisfies Draft);
  useEffect(() => {
    if (!draftKey || settled !== draftKey) return;
    try {
      if (draftJson === BLANK_JSON) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, draftJson);
    } catch {}
  }, [draftKey, settled, draftJson]);
  const stake = parseStake(stakeText);
  const t = TOKENS[token];
  const balance = token === "MON" ? w.monBalance : w.chogBalance;
  const pickToken = (k: Token) => { setToken(k); setStakeText(String(TOKENS[k].presets[0])); };

  const { chain, chog, duel } = w.net;
  // The Chog the creator enters with (the profile Chog unless another is picked): the duel's result goes on its record, and it's the one on the share card.
  const { chogs: owned, chog: profileChog, loading: chogsLoading } = useProfileChog(w.address, chain.id);
  const [dark, setDark] = useState(false);
  // The card is drawn at its 1200px OG size and scaled to the column.
  const [scale, setScale] = useState(0);
  const fit = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1200));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mine = owned.find((c) => String(c.id) === chogPick) ?? profileChog;
  // A challenge puts the called-out Chog on the card's right. An unminted id fails at once, so Continue isn't enabled for seconds.
  const { uri: rivalUri, meta: rivalMeta } = useChogMeta(challenge && rival ? BigInt(rival) : undefined, chain.id);
  const previewLoading = checking || (w.ready && (chogsLoading || !!mine?.pending));
  const stakeUnits = toUnits(stakeText, 18); // MON and $CHOG both have 18 decimals
  const targetUnits = toUnits(target, TARGET_DECIMALS);
  // $CHOG is pulled by the contract this mode pays: the escrow takes the stake, Last Word the flat fee.
  const payToken = lw ? lwToken : token;
  const spender = lw ? w.net.lastWord : duel;
  const chogNeeded = lw ? parseEther(String(LW_CHOG_FEE)) : stakeUnits;
  const lwFeeText = lwToken === "MON" ? `${LW_FEE} MON` : `${LW_CHOG_FEE} $CHOG`;
  const allowance = useReadContract({
    address: chog, abi: erc20Abi, functionName: "allowance", args: [w.address!, spender!], chainId: chain.id,
    query: { enabled: payToken === "CHOG" && !!chog && !!spender && !!w.address },
  });
  // The live price from mainnet Chainlink on both networks: testnet duels settle on FeedMirror copies of it, which hold only settled rounds.
  const latest = useReadContract({
    address: NETWORKS.mainnet.feeds[asset], abi: feedAbi, functionName: "latestRoundData", chainId: NETWORKS.mainnet.chain.id,
    query: { refetchInterval: 15_000 },
  });
  const price = latest.data && Number(formatUnits(latest.data[1], TARGET_DECIMALS));
  const needsApproval = payToken === "CHOG" && (allowance.data ?? BigInt(0)) < chogNeeded;
  const short = balance != null && stake > balance;
  // Called only at lock time: presets count from the click, and reading the clock during render breaks prerendering.
  const deadlineAt = () => deadline === "Custom" ? Math.floor(new Date(custom).getTime() / 1000) : DEADLINES[deadline].at();
  // The custom deadline is typed in local time; it's always shown back in UTC, like every other deadline.
  const customUtc = new Date(custom).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) + " UTC";
  const when = deadline !== "Custom" ? DEADLINES[deadline].phrase : !custom ? "…" : "by " + customUtc;
  const callProblem = deadline === "Custom" && !custom ? "Pick a deadline" : !(targetUnits > BigInt(0)) ? "Enter a target price" : null;
  // The contract rejects an unminted Chog or one the creator holds; catch both before locking.
  const rivalProblem = !challenge ? null : !rival ? "Enter a Chog number" : rivalUri.isError ? `No Chog #${rival}` : owned.some((c) => String(c.id) === rival) ? "That's your own Chog" : !rivalUri.data ? "Finding Chog…" : null;
  const dareProblem = !dare.trim() ? "Write the dare" : dareBytes(dare.trim()) > MAX_DARE ? "Dare is too long"
    : lwToken === "MON" ? (w.monBalance != null && w.monBalance < LW_FEE ? "Not enough MON" : null)
    : w.chogBalance != null && w.chogBalance < LW_CHOG_FEE ? "Not enough $CHOG" : null;
  // The middle step: the stake for real stakes, the dare for Last Word.
  const stakeProblem = rivalProblem ?? (lw ? dareProblem : !(stakeUnits > BigInt(0)) ? "Enter a stake" : short ? `Not enough ${t.label}` : null);
  const live = lw ? w.net.lastWord : duel;
  const problem = !live ? `${lw ? "Last Word isn't" : "Duels aren't"} live on this network yet` : chogsLoading ? "Finding your Chogs…" : !mine ? "You need a Chog" : callProblem ?? stakeProblem;
  const stepProblem = [callProblem, stakeProblem, problem][step];
  const lockLabel = busy ?? problem ?? (lw ? `${needsApproval ? "Approve & throw down" : "Throw down"} · ${lwFeeText} & get link` : `${needsApproval ? "Approve & lock" : "Lock"} ${fmt(stake)} ${t.label} & get link`);
  const claim = `${asset} will be ${dir} $${target || "…"} ${when}.`;
  // A custom deadline that's already too close is caught here rather than after the stake is picked.
  const advance = () => {
    if (step === 0 && deadline === "Custom" && !(deadlineAt() >= Date.now() / 1000 + MIN_LEAD)) return void toast.error(`Deadline must be at least ${MIN_LEAD / 60} min out`);
    go(step + 1);
  };

  // Last Word: the flat fee in MON (one transaction) or $CHOG (approve first if needed); the dare goes on-chain with the call.
  const lockLastWord = async (at: number, rivalId: bigint) => {
    const lastWord = w.net.lastWord;
    if (!lastWord || (lwToken === "CHOG" && !chog)) return;
    try {
      if (needsApproval) {
        setBusy("Confirm in wallet…");
        const approval = await writeContractAsync({ address: chog!, abi: erc20Abi, functionName: "approve", args: [lastWord, chogNeeded], chainId: chain.id });
        setBusy("Approving…");
        if ((await waitForTransactionReceipt(config, { hash: approval, chainId: chain.id })).status !== "success") throw new Error("Approval reverted");
      }
      setBusy("Confirm in wallet…");
      const hash = await writeContractAsync({
        address: lastWord, abi: lastWordAbi, functionName: "create", chainId: chain.id, value: lwToken === "MON" ? parseEther(String(LW_FEE)) : undefined,
        args: [w.net.feeds[asset]!, dir === "above", targetUnits, BigInt(at), rivalId, mine!.id, dare.trim(), lwToken === "MON" ? zeroAddress : chog!],
      });
      setBusy("Locking…");
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      const [created] = parseEventLogs({ abi: lastWordAbi, eventName: "DuelCreated", logs: receipt.logs });
      queryClient.invalidateQueries();
      try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
      // The page's link is what gets shared (Copy link), so it carries the card theme the creator picked.
      router.push(`/last-word/${created.args.id}${dark ? "?theme=dark" : ""}`);
    } catch (e) {
      toast.error((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed");
    } finally {
      setBusy(undefined);
    }
  };
  const lock = async () => {
    const at = deadlineAt();
    if (!(at >= Date.now() / 1000 + MIN_LEAD)) return void toast.error(`Deadline must be at least ${MIN_LEAD / 60} min out`);
    const rivalId = challenge ? BigInt(rival) : BigInt(0);
    if (lw) return lockLastWord(at, rivalId);
    if (!duel || (token === "CHOG" && !chog)) return;
    const tokenAddr = token === "MON" ? zeroAddress : chog!;
    const now = latest.data?.[1];
    // Everything on the share card is known before the tx, so /og starts drawing it while the wallet confirms; the duel page asks for the same URL.
    const pick = new URLSearchParams({ ...(mine && { chog: String(mine.id) }), ...(dark && { theme: "dark" }) });
    preload(`/og?${cardQuery({ above: dir === "above", target: targetUnits, deadline: at, stake: stakeUnits, token: tokenAddr, status: 0, rival: rivalId }, asset, now)}${pick.size ? `&${pick}` : ""}`, { as: "image" });
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
          args: [tokenAddr, stakeUnits, w.net.feeds[asset]!, dir === "above", targetUnits, BigInt(at), rivalId, mine!.id],
          value: token === "MON" ? stakeUnits : undefined,
          chainId: chain.id,
        }),
      );
      const [created] = parseEventLogs({ abi: duelAbi, eventName: "DuelCreated", logs: receipt.logs });
      queryClient.invalidateQueries();
      try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
      // The duel page is where the creator shares the link; it adds this theme and price to the shared link, keeping the page's own URL clean.
      try { localStorage.setItem(shareKey(chain.id, created.args.id), JSON.stringify({ dark, now: now?.toString() })); } catch {}
      router.push(`/duels/${created.args.id}`);
    } catch (e) {
      toast.error((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed");
    } finally {
      setBusy(undefined);
    }
  };
  const seg = (on: boolean, fg = "#1A1130") => ({ background: on ? "#fff" : "transparent", color: on ? fg : "#8E85A3" });

  return (
    <>
      <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Make a call</h1>
      <p className="mt-1.5 text-[15px] text-[#6B6185]">
        {lw ? `No pot. Each side pays ${LW_CHOG_FEE} $CHOG (burned) or ${LW_FEE} MON to play, and the loser's Chog wears your line.` : "Both sides stake the same. The winner takes the pot, minus a 5% fee."}
      </p>
      <div className="mt-6 grid grid-cols-1 items-start gap-10 min-[901px]:grid-cols-[minmax(0,1fr)_440px]">
        <div>
          {checking ? (
            <div aria-busy="true" aria-label="Loading" className="overflow-hidden rounded-2xl border border-[#ECE8F3] bg-white">
              <div className="flex items-center gap-3 border-b border-[#ECE8F3] bg-[#F0ECFB] px-5 py-3">
                <span className={`size-12 shrink-0 rounded-xl ${skelTint}`} />
                <div className="flex flex-col gap-1.5">
                  <span className={`h-2.5 w-20 rounded ${skelTint}`} />
                  <span className={`h-4 w-56 max-w-[40vw] rounded ${skelTint}`} />
                </div>
                <span className={`ml-auto h-10 w-[190px] rounded-[10px] ${skelTint}`} />
              </div>
              <div className="flex items-center gap-3 border-b border-[#ECE8F3] px-6 py-4">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex flex-1 items-center gap-3 last:flex-none">
                    <span className={`size-6 rounded-full ${skel}`} />
                    <span className={`h-3.5 w-16 rounded ${skel}`} />
                    {i < STEPS.length - 1 && <span className="h-px flex-1 bg-[#ECE8F3]" />}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-[22px] p-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <span className={`h-3.5 w-20 rounded ${skel}`} />
                    <span className={`h-12 w-full rounded-[10px] ${skel}`} />
                  </div>
                ))}
                <span className={`h-12 w-full rounded-[11px] ${skel}`} />
              </div>
            </div>
          ) : (
          <Card className="relative overflow-hidden rounded-2xl border border-[#ECE8F3] bg-white p-0 ring-0">
            {blocked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 p-6">
                <div className="flex max-w-[340px] flex-col items-center rounded-2xl border border-[#ECE8F3] bg-white px-7 py-8 text-center shadow-[0_12px_40px_rgba(26,17,48,.12)]">
                  <img alt="" src="/chog-logo.png" className="size-12 rounded-xl" />
                  {gate ? (
                    <>
                      <p className="mt-4 font-mono text-[12px] font-medium text-[#8E85A3]">STEP {required.indexOf(gate) + 1} OF {required.length}</p>
                      <p className="mt-1 text-[17px] font-semibold">{gate.title}</p>
                      <p className="mt-1.5 text-[14px] leading-normal text-[#6B6185]">{gate.blurb}</p>
                      {gate.action && <StepAction action={gate.action} className="mt-5 w-full justify-center p-3 text-[15px]" />}
                    </>
                  ) : stored && (
                    <>
                      <p className="mt-4 text-[17px] font-semibold">Pick up where you left off?</p>
                      <p className="mt-1.5 text-[14px] leading-normal text-[#6B6185] wrap-anywhere">
                        You were calling {stored.picked} {stored.dir} ${stored.target || "…"}, {stored.mode === "lastword" ? `daring “${stored.dare || "…"}”` : `staking ${stored.stakeText || "0"} ${TOKENS[stored.token].label}`}.
                      </p>
                      <Button variant="plain" onClick={() => pickUp(stored)} className="mt-5 h-auto w-full rounded-[11px] bg-[#6E56E8] p-3 text-[15px] font-semibold text-white">Continue</Button>
                      <Button variant="plain" onClick={() => pickUp({ ...BLANK, mode })} className="mt-2 h-auto px-3 py-1.5 text-[14px] font-medium text-[#8E85A3] hover:text-[#1A1130]">Start new</Button>
                    </>
                  )}
                </div>
              </div>
            )}
            <div inert={blocked} aria-hidden={blocked} className={`transition-[filter] ${blocked ? "pointer-events-none blur-[3px] select-none" : ""}`}>
              <ModeBar mode={mode} onPick={(m) => { if (m !== mode) { setMode(m); go(0); } }} disabled={!!busy} />
              <ol className="m-0 flex list-none items-center gap-3 border-b border-[#ECE8F3] px-6 py-4">
                {steps.map((s, i) => (
                  <li key={s} className="flex flex-1 items-center gap-3 last:flex-none">
                    <button type="button" disabled={i >= step || !!busy} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
                      className="flex cursor-pointer items-center gap-2 text-[13px] font-medium whitespace-nowrap disabled:cursor-default">
                      <span className={`grid size-6 place-items-center rounded-full font-mono text-[12px] ${i <= step ? "bg-[#6E56E8] text-white" : "bg-[#F4F1FA] text-[#8E85A3]"}`}>{i < step ? "✓" : i + 1}</span>
                      <span className={i === step ? "text-[#1A1130]" : "text-[#8E85A3]"}>{s}</span>
                    </button>
                    {i < steps.length - 1 && <span className="h-px flex-1 bg-[#ECE8F3]" />}
                  </li>
                ))}
              </ol>
              <div className="flex flex-col gap-[22px] p-6">
              <MotionConfig reducedMotion="user">
              <AnimatePresence mode="popLayout" initial={false} custom={slideDir}>
              <motion.div key={step} custom={slideDir} variants={slide} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }} className="flex flex-col gap-[22px]">
              {step === 0 && (
                <>
                  <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
                    Asset
                    <Select value={asset} onValueChange={(v) => v && setAsset(v as Asset)}>
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
                    I think it will be
                    <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#F4F1FA] p-1">
                      <Button variant="plain" onClick={() => setDir("above")} style={seg(dir === "above", "#1A8A55")} className="h-auto rounded-[7px] p-2.5 text-[14px] font-semibold">Above</Button>
                      <Button variant="plain" onClick={() => setDir("below")} style={seg(dir === "below", "#C43A52")} className="h-auto rounded-[7px] p-2.5 text-[14px] font-semibold">Below</Button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
                    <span className="flex justify-between">Target price (USD){price != null && <span className="font-mono text-[#1A1130]">{asset} now ${fmt(price)}</span>}</span>
                    <div className="flex items-center rounded-[10px] border border-[#DCD5EC] px-3 focus-within:border-[#C9BFE3]">
                      <span className="font-mono text-[17px] font-medium text-[#8E85A3]">$</span>
                      <Input value={target} placeholder={price != null ? fmt(price) : ASSETS[asset].eg} inputMode="decimal" onChange={(e) => setTarget(cleanAmount(e.target.value, TARGET_DECIMALS))} className="h-auto flex-1 border-0 bg-transparent py-3 pr-0 pl-1 font-mono text-[17px] font-medium text-[#1A1130] shadow-none focus-visible:ring-0" />
                    </div>
                  </label>
                  <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
                    Deadline
                    <div className="grid h-12 grid-cols-5 gap-1 rounded-[10px] bg-[#F4F1FA] p-1">
                      {[...Object.keys(DEADLINES), "Custom"].map((d) => (
                        <Button key={d} variant="plain" onClick={() => { setDeadline(d); if (d === "Custom" && !custom) setCustom(localInput(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 86_400_000)); }} style={seg(deadline === d)} className="h-full gap-1 rounded-[7px] px-1 py-0 text-[13px] font-medium whitespace-nowrap">
                          {DEADLINES[d]?.blitz && <ZapIcon aria-hidden className="size-3.5 fill-[#F5A524] text-[#F5A524]" />}
                          {d}
                        </Button>
                      ))}
                    </div>
                    {deadline === "Custom" && (
                      // Calendar for the day, a plain time field for the hour; both edit the one datetime-local string in `custom`.
                      <div className="grid grid-cols-[1fr_8rem] gap-2">
                        <Popover open={pickOpen} onOpenChange={setPickOpen}>
                          <PopoverTrigger render={
                            <Button variant="plain" className="h-auto justify-between rounded-[10px] border-[#DCD5EC] bg-white p-3 font-mono text-[15px] font-normal text-[#1A1130]">
                              {custom ? new Date(custom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Pick a date"}
                              <ChevronDownIcon aria-hidden className="text-[#6B6185]" />
                            </Button>
                          } />
                          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                            <Calendar mode="single" selected={custom ? new Date(custom) : undefined} defaultMonth={custom ? new Date(custom) : undefined}
                              disabled={{ before: new Date() }}
                              onSelect={(day) => { if (day) setCustom(localInput(day.getTime()).slice(0, 10) + (custom.slice(10) || "T12:00")); setPickOpen(false); }} />
                          </PopoverContent>
                        </Popover>
                        <Input type="time" value={custom.slice(11, 16)} onChange={(e) => setCustom((custom.slice(0, 10) || localInput(Date.now()).slice(0, 10)) + "T" + e.target.value)}
                          className="h-auto appearance-none rounded-[10px] border-[#DCD5EC] p-3 font-mono text-[15px] text-[#1A1130] [&::-webkit-calendar-picker-indicator]:hidden" />
                      </div>
                    )}
                    {deadline === "Custom" && custom && !isNaN(new Date(custom).getTime()) && (
                      <span className="text-[12px]">That&apos;s <span className="font-mono text-[#1A1130]">{customUtc}</span></span>
                    )}
                  </div>
                </>
              )}
              {step === 1 && lw && (
                <div className="flex flex-col gap-3 text-[16px] text-[#6B6185]">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="dare" className="text-[18px] text-[#1A1130]">Loser&apos;s Chog says</label>
                    <span className={`font-mono text-[16px] ${dareBytes(dare.trim()) > MAX_DARE ? "text-[#C43A52]" : "text-[#8E85A3]"}`}>{dareBytes(dare.trim())}/{MAX_DARE}</span>
                  </div>
                  <Input id="dare" value={dare} placeholder="I bought the top." onChange={(e) => setDare(clipDare(e.target.value))}
                    className="h-auto rounded-[14px] border-[#DCD5EC] bg-white px-[18px] py-4 text-[20px] font-semibold text-[#1A1130] md:text-[20px] focus-visible:border-[#C9BFE3] focus-visible:ring-0" />
                  <span className="mt-0.5 font-mono text-[12px] tracking-[.16em] text-[#8E85A3]">OR TAP ONE</span>
                  <div className="-mt-1 flex flex-wrap gap-1.5">
                    {DARE_IDEAS.map((idea) => (
                      <Button key={idea} variant="plain" onClick={() => setDare(idea)} className="h-auto rounded-full bg-[#F4F0FF] px-4 py-2 text-[16px] font-normal text-[#5024D9] hover:bg-[#EAE2FF]">
                        {idea}
                      </Button>
                    ))}
                  </div>
                  <p className="m-0 mt-0.5 leading-7">Whoever loses wears it until their Chog wins a Last Word duel back.<br />Taking the duel means agreeing to it.</p>
                  <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
                    Pay to play in
                    <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#F4F1FA] p-1">
                      {(["CHOG", "MON"] as Token[]).map((k) => (
                        <Button key={k} variant="plain" onClick={() => setLwToken(k)} style={seg(lwToken === k)} className="h-auto gap-2 rounded-[7px] p-2.5 text-[14px] font-semibold">
                          <img alt="" src={TOKENS[k].icon} className="size-5 rounded-full" />
                          {k === "MON" ? `${LW_FEE} MON` : `${LW_CHOG_FEE} $CHOG`}
                        </Button>
                      ))}
                    </div>
                    <span>{lwToken === "MON" ? "Each side pays the same; both fees go to the treasury." : "Each side pays the same; both fees are burned."}</span>
                  </div>
                </div>
              )}
              {step === 1 && (
                <>
                  {!lw && <>
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
                      <Input value={stakeText} placeholder="0" inputMode="decimal" onChange={(e) => setStakeText(cleanAmount(e.target.value, 18))} className="h-auto flex-1 border-0 bg-transparent px-0 py-3 font-mono text-[17px] font-medium text-[#1A1130] shadow-none focus-visible:ring-0" />
                      <span className="font-mono text-[13px] font-medium text-[#8E85A3]">{t.label}</span>
                    </div>
                    {short && (
                      <p className="m-0 text-[13px] text-[#C43A52]">
                        You have {fmt(balance)} {t.label}.{" "}
                        {w.isTestnet ? (
                          <Link href="/faucet" className="font-semibold text-[#6E56E8] underline-offset-2 hover:underline">Get more from the faucet</Link>
                        ) : token === "CHOG" && (
                          <a href={w.net.getChog} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#6E56E8] underline-offset-2 hover:underline">Buy on nad.fun</a>
                        )}
                      </p>
                    )}
                    <div className="flex gap-1.5">
                      {t.presets.map((p) => (
                        <Button key={p} variant="plain" onClick={() => setStakeText(String(p))} className="h-auto rounded-[7px] border border-[#ECE8F3] bg-white px-2.5 py-1.5 font-mono text-[12px] font-medium text-[#4A4063]">
                          {fmt(p)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  </>}
                  <div className="flex flex-col gap-1.5 text-[13px] text-[#6B6185]">
                    Who can take it
                    <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#F4F1FA] p-1">
                      {/* A crowd of Chogs for anyone, one Chog (the called-out one once it loads) for a challenge. */}
                      <Button variant="plain" onClick={() => setChallenge(false)} style={seg(!challenge)} className="h-auto gap-2 rounded-[7px] p-2.5 text-[14px] font-semibold">
                        <span className="flex -space-x-2">
                          {["/chog-1044.png", "/chog-111.webp", "/chog-logo.png"].map((src) => <img key={src} alt="" src={src} className="size-6 rounded-full bg-[#F1EEFB] object-cover ring-2 ring-white" />)}
                        </span>
                        Open duel
                      </Button>
                      <Button variant="plain" onClick={() => setChallenge(true)} style={seg(challenge)} className="h-auto gap-2 rounded-[7px] p-2.5 text-[14px] font-semibold">
                        <img alt="" src={challenge && rivalMeta.data ? ipfs(rivalMeta.data.image) : "/chog-1044.png"} className="size-6 rounded-full bg-[#F1EEFB] object-cover ring-2 ring-white" />
                        Specific Chog
                      </Button>
                    </div>
                    {challenge && <div className="flex items-center rounded-[10px] border border-[#DCD5EC] px-3 focus-within:border-[#C9BFE3]">
                      <span className="font-mono text-[17px] font-medium text-[#8E85A3]">#</span>
                      <Input value={rival} placeholder="1" aria-label="Chog number" inputMode="numeric" maxLength={4} onChange={(e) => setRival(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4))} className="h-auto flex-1 border-0 bg-transparent py-3 pr-0 pl-1 font-mono text-[17px] font-medium text-[#1A1130] shadow-none focus-visible:ring-0" />
                      {rivalMeta.data && !rivalProblem && <>
                        <span className="mr-2 truncate text-[13px] font-medium text-[#6B6185]">{rivalMeta.data.name}</span>
                        <img alt="" src={ipfs(rivalMeta.data.image)} className="size-8 shrink-0 rounded-md bg-[#F1EEFB] object-cover" />
                      </>}
                    </div>}
                    <span>{challenge ? "Only the wallet holding that Chog can take the other side." : "Any Chog holder can take the other side."}</span>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="rounded-xl border border-[#ECE8F3] p-4">
                    <p className="m-0 font-mono text-[12px] font-medium text-[#8E85A3]">YOUR CALL</p>
                    <p className="mt-1.5 mb-0 text-[20px] leading-snug font-semibold tracking-[-.01em] text-[#1A1130] text-pretty">{claim}</p>
                  </div>
                  {lw ? (
                  <div className="flex flex-col gap-2.5 rounded-xl bg-[#FAF9FC] p-4 text-[14px]">
                    <div className="flex justify-between gap-4"><span className="shrink-0 text-[#6B6185]">Loser&apos;s Chog says</span><span className="text-right font-medium">“{dare.trim()}”</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Your Chog</span><span className="font-mono">{mine ? `#${mine.id}` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Who can take it</span><span className="font-mono">{challenge ? `Chog #${rival}` : "Any Chog"}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Entry, each side</span><span className="font-mono">{lwFeeText}{lwToken === "CHOG" ? " · burned" : ""}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Settles</span><span className="font-mono">{when}</span></div>
                    <div className="flex justify-between border-t border-[#ECE8F3] pt-2.5 font-semibold"><span>Winner gets</span><span className="text-[#6E56E8]">The last word</span></div>
                  </div>
                  ) : (
                  <div className="flex flex-col gap-2.5 rounded-xl bg-[#FAF9FC] p-4 text-[14px]">
                    <div className="flex justify-between"><span className="text-[#6B6185]">Your stake</span><span className="font-mono">{fmt(stake)} {t.label}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Your Chog</span><span className="font-mono">{mine ? `#${mine.id}` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Who can take it</span><span className="font-mono">{challenge ? `Chog #${rival}` : "Any Chog"}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Pot if accepted</span><span className="font-mono">{fmt(pot(stake))} {t.label}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">{t.fee}</span><span className="font-mono text-[#C43A52]">−{fmt(burned(stake))} {t.label}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B6185]">Settles</span><span className="font-mono">{when}</span></div>
                    <div className="flex justify-between border-t border-[#ECE8F3] pt-2.5 font-semibold"><span>You receive if right</span><span className="font-mono text-[#6E56E8]">{fmt(payout(stake))} {t.label}</span></div>
                  </div>
                  )}
                </>
              )}
              </motion.div>
              </AnimatePresence>
              </MotionConfig>
              <div className="flex flex-col items-center gap-2">
                <Button variant="plain" disabled={!!stepProblem || !!busy} onClick={step === 2 ? lock : advance} className="h-auto w-full rounded-[11px] bg-[#6E56E8] p-[15px] text-[16px] font-semibold text-white disabled:bg-[#C9BFE3] disabled:opacity-100">
                  {step === 2 ? lockLabel : stepProblem ?? "Continue"}
                </Button>
                {step > 0 && (
                  <Button variant="plain" disabled={!!busy} onClick={() => go(step - 1)} className="h-auto px-3 py-1.5 text-[14px] font-medium text-[#8E85A3] hover:text-[#1A1130]">Back</Button>
                )}
              </div>
              </div>
            </div>
          </Card>
          )}
        </div>
        <div className="sticky top-24 flex flex-col gap-3">
          {!previewLoading && owned.length > 0 && (
            <>
              <div className="flex justify-between font-mono text-[12px] font-medium text-[#8E85A3]">PICK YOUR CHOG{mine && <span className="text-[#1A1130]">{mine.meta?.name ?? `Chog #${mine.id}`}</span>}</div>
              <ChogPicker chogs={owned} value={mine?.id} onPick={(id) => setChogPick(String(id))} />
              <p className="m-0 text-[13px] text-[#6B6185]">It enters the duel with you. The win, loss or tie goes on its record.</p>
            </>
          )}
          <div className={`font-mono text-[12px] font-medium text-[#8E85A3] ${!previewLoading && owned.length > 0 ? "mt-2" : ""}`}>SHARE CARD PREVIEW</div>
          {previewLoading ? (
            <span aria-busy="true" aria-label="Loading preview" className={`aspect-[40/21] rounded-md ${skel}`} />
          ) : (
          <>
            <div ref={fit} role="img" aria-label={claim} className="aspect-[40/21] overflow-hidden rounded-md border border-[#ECE8F3]">
              <div style={{ width: 1200, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                <ShareCard
                  dare={lw ? dare.trim() : undefined}
                  asset={asset} now={price != null ? `$${fmt(price)}` : undefined} call={`${dir} $${target || "…"}`} when={when}
                  stake={`${fmt(stake)} ${t.label}`} win={fmt(payout(stake))} cta={challenge && rival ? `#${rival}, accept →` : lw ? "Take the dare →" : "Fade me →"}
                  art={mine?.meta ? ipfs(mine.meta.image) : "/chog-logo.png"} chog={mine && String(mine.id)} dark={dark}
                  rival={challenge && rival ? { id: rival, art: rivalMeta.data ? ipfs(rivalMeta.data.image) : rivalUri.isError || rivalMeta.isError ? "/chog-logo.png" : undefined } : undefined}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#F4F1FA] p-1">
              <Button variant="plain" onClick={() => setDark(false)} style={seg(!dark)} className="h-auto rounded-[7px] p-2 text-[14px] font-semibold">Light</Button>
              <Button variant="plain" onClick={() => setDark(true)} style={seg(dark)} className="h-auto rounded-[7px] p-2 text-[14px] font-semibold">Dark</Button>
            </div>
          </>
          )}
        </div>
      </div>
    </>
  );
}

// The top of the form card: which game this call is, and the switch between the two.
function ModeBar({ mode, onPick, disabled }: { mode: Mode; onPick: (m: Mode) => void; disabled: boolean }) {
  const lw = mode === "lastword";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#ECE8F3] bg-[#F0ECFB] px-5 py-3 text-[#1A1130]">
      <span aria-hidden="true" className="relative size-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5">
        <img src={lw ? "/chog-1044.png" : "/chog-logo.png"} alt="" className="size-full object-cover" />
        {lw && <span className="absolute top-[54%] left-[61%] grid size-3.5 place-items-center rounded-sm bg-[#FFE5ED] text-[#C43A52]"><XIcon className="size-3.5" strokeWidth={3.5} /></span>}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="m-0 font-mono text-[11px] font-medium tracking-[.14em] text-[#8E85A3]">GAME MODE</p>
        <p className="m-0 mt-0.5 text-[16px] font-semibold">{lw ? "Last Word · Loser wears your line" : "Real stakes · Winner takes the pot"}</p>
      </div>
      <div role="radiogroup" aria-label="Game mode" className="ml-auto grid grid-cols-2 gap-1 rounded-[10px] bg-[#E3DCF6] p-1">
        {(["stakes", "lastword"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={disabled} onClick={() => onPick(m)}
            className={`cursor-pointer rounded-[7px] px-3 py-1.5 text-[14px] font-semibold whitespace-nowrap disabled:cursor-default ${mode === m ? "bg-[#6E56E8] text-white shadow-[0_2px_8px_rgba(110,86,232,.35)]" : "text-[#8E85A3] hover:bg-white/70 hover:text-[#1A1130]"}`}>
            {m === "lastword" ? "Last Word" : "Real stakes"}
          </button>
        ))}
      </div>
    </div>
  );
}
