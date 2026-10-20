"use client";
import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { needWallet, useWallet, walletLabel } from "./wallet";

type Action = { label: string; href?: string; onClick?: () => void; disabled?: boolean };
/** `done` is undefined while the wallet or a balance is still loading. Optional steps never block duelling. */
export type Step = { title: string; blurb: string; done?: boolean; optional?: boolean; action?: Action };

// What a wallet needs before it can duel, in order. Edit copy and links here.
export function useOnboarding() {
  const w = useWallet();
  const { isTestnet, net } = w;
  const has = (n?: number) => (!w.ready ? false : n === undefined ? undefined : n > 0);
  const steps: Step[] = [
    {
      title: w.wrongChain ? `Switch to ${net.chain.name}` : "Connect a wallet",
      blurb: w.wrongChain
        ? "Your wallet is on another network."
        : isTestnet
          ? "Use a burner: log in with email and we make a fresh wallet just for testing."
          : "Log in with email or bring your own wallet.",
      done: w.loading ? undefined : w.ready,
      action: { label: walletLabel(w), onClick: () => needWallet(w), disabled: w.loading },
    },
    {
      title: isTestnet ? "Get test MON" : "Get MON",
      blurb: isTestnet
        ? "Free from Monad's faucet. Pays the gas, and you can stake it on calls."
        : "Pays the gas, and you can stake it on calls. Buy it on an exchange and send it to your wallet.",
      done: has(w.monBalance),
      action: isTestnet ? { label: "Open faucet", href: "/app/faucet" } : undefined,
    },
    ...(net.nft
      ? [{
          title: "Hold a Chog NFT",
          blurb: "Your ticket into the Arena. Both sides of every duel need one.",
          done: has(w.chogNfts),
          action: isTestnet ? { label: "Mint a test Chog", href: net.getNft } : { label: "Buy on OpenSea", href: net.getNft },
        }]
      : []),
    ...(net.chog
      ? [{
          title: isTestnet ? "Get test $CHOG" : "Get $CHOG",
          blurb: "Stake in $CHOG instead of MON if you like.",
          done: has(w.chogBalance),
          optional: true,
          action: isTestnet ? { label: "Open faucet", href: net.getChog } : { label: "Buy on nad.fun", href: net.getChog },
        }]
      : []),
  ];
  const required = steps.filter((s) => !s.optional);
  // No `next` until every required step is known, so nothing flashes while balances load.
  const next = required.every((s) => s.done !== undefined) ? required.find((s) => !s.done) : undefined;
  return { steps, required, next };
}

export function StepAction({ action, quiet, className = "" }: { action: Action; quiet?: boolean; className?: string }) {
  const { href, label } = action;
  const btn = `inline-flex h-auto items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold ${
    quiet ? "border border-[#DCD5EC] bg-white text-[#1A1130] hover:bg-[#F7F5FB]" : "bg-[#6E56E8] text-white hover:brightness-[.96]"
  }`;
  if (href?.startsWith("/")) return <Link href={href} className={`${btn} ${className}`}>{label}</Link>;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${btn} ${className}`}>
        {label}
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    );
  }
  return (
    <Button variant="plain" disabled={action.disabled} onClick={action.onClick} className={`${btn} ${className}`}>
      {label}
    </Button>
  );
}

// Pages that already walk the user through these steps themselves.
const HIDDEN = ["/app/faucet", "/app/create"];

/** Checklist above every app page until a connected wallet can duel. Logged-out visitors get a Connect wallet button instead. */
export function Onboarding() {
  const pathname = usePathname();
  const w = useWallet();
  const { steps, required, next } = useOnboarding();
  if (!w.connected || !next || HIDDEN.includes(pathname)) return null;
  const count = required.filter((s) => s.done).length;

  return (
    <section aria-labelledby="onboarding-title" className="mb-8 rounded-2xl border border-[#ECE8F3] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="onboarding-title" className="m-0 text-[17px] font-semibold tracking-[-.01em]">Get ready to duel</h2>
        <span className="font-mono text-[13px] text-[#8E85A3]">{count} of {required.length} done</span>
      </div>
      <p className="mt-1 text-[14px] text-[#6B6185]">
        {w.isTestnet ? (
          "You're on testnet. Everything here is free and worth nothing, so try things out."
        ) : (
          <>
            Just looking?{" "}
            <button type="button" onClick={() => w.setNetwork("testnet")} className="cursor-pointer font-semibold text-[#6E56E8] underline-offset-2 hover:underline">
              Try it on testnet
            </button>{" "}
            with a burner wallet and free tokens first.
          </>
        )}
      </p>
      <ol className="m-0 mt-4 grid list-none gap-3 p-0 md:auto-cols-fr md:grid-flow-col">
        {steps.map((s, i) => {
          const current = s === next;
          return (
            <li
              key={s.title}
              aria-current={current ? "step" : undefined}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${current ? "border-[#6E56E8] shadow-[0_0_0_4px_#F1EEFB]" : "border-[#ECE8F3]"}`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-[12px] font-semibold ${
                    s.done ? "border-[#6E56E8] bg-[#6E56E8] text-white" : current ? "border-[#6E56E8] text-[#6E56E8]" : "border-[#DCD5EC] text-[#8E85A3]"
                  }`}
                >
                  {s.done ? <Check className="size-3.5" strokeWidth={3} aria-label="Done" /> : s.optional ? "+" : i + 1}
                </span>
                <h3 className={`m-0 text-[15px] font-semibold ${s.done ? "text-[#8E85A3]" : ""}`}>{s.title}</h3>
                {s.optional && <span className="ml-auto rounded-full bg-[#F4F1FA] px-2 py-0.5 text-[11px] font-medium text-[#8E85A3]">Optional</span>}
              </div>
              <p className="m-0 text-[14px] leading-normal text-[#6B6185]">{s.blurb}</p>
              {s.action && (current || (s.optional && s.done === false && w.ready)) && (
                <StepAction action={s.action} quiet={!current} className="mt-auto self-start" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
