"use client";
import Link from "next/link";
import { useWallet } from "./wallet";

const btn = "inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]";

// Open calls will come from the duel escrow contract once it's deployed; until then the Arena is empty.
export function Arena() {
  const calls: unknown[] = [];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">Open calls</h1>
          <p className="mt-1.5 text-[15px] text-[#6B6185]">Pick a call you disagree with. Match the stake to take the other side.</p>
        </div>
        {/* The empty state has its own button, so this only shows once there are calls. */}
        {calls.length > 0 && <CallCta label="＋ Make a call" />}
      </div>
      {calls.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#DCD5EC] bg-white px-6 py-16 text-center">
          <p className="m-0 text-[17px] font-semibold">No open calls yet</p>
          <p className="mx-auto mt-1.5 max-w-[44ch] text-[15px] text-[#6B6185]">
            Calls people make show up here for anyone to take the other side.
          </p>
          <CallCta label="Make the first call" className="mt-5" />
        </div>
      )}
    </>
  );
}

// Logged-out visitors are asked to connect before making a call; a skeleton holds the spot while the session restores.
function CallCta({ label, className = "" }: { label: string; className?: string }) {
  const w = useWallet();
  if (w.loading) return <span className={`inline-flex h-[41px] w-36 animate-pulse rounded-[10px] bg-[#F1EEFB] motion-reduce:animate-none ${className}`} />;
  if (w.connected) return <Link href="/app/create" className={`${btn} ${className}`}>{label}</Link>;
  return (
    <button type="button" onClick={() => w.login()} className={`cursor-pointer ${btn} ${className}`}>
      Connect wallet
    </button>
  );
}
