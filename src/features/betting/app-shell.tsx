"use client";
/* eslint-disable @next/next/no-img-element -- Use the supplied Chog artwork. */
import { Copy, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { Suspense, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmt } from "./duel";
import { useChogAvatar } from "@/features/profile/chogs";
import { Onboarding } from "./onboarding";
import { appId, NETWORK_TOGGLE, useWallet, WalletProviders } from "./wallet";

// The app's pages. Add a route under src/app/app/ and list it here to put it in the header.
const NAV = [
  { href: "/app", label: "Arena" },
  { href: "/app/create", label: "Make a call" },
  { href: "/app/duels", label: "My duels", walletOnly: true },
  { href: "/app/faucet", label: "Faucet", testnetOnly: true },
];

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function AppShell({ children }: { children: ReactNode }) {
  if (!appId) {
    return (
      <Container as="main" className="py-16 text-[15px] text-[#6B6185]">
        Set <code>NEXT_PUBLIC_PRIVY_APP_ID</code> in <code>.env</code> to use the app.
      </Container>
    );
  }
  return (
    <WalletProviders>
      <div className="flex min-h-screen flex-col bg-[#faf9fc] font-sans leading-normal text-[#1a1130] antialiased">
        <Header />
        <Container as="main" className="flex-1 pt-8 pb-16">
          {/* Onboarding and the nav read the pathname, which dynamic routes (/app/duels/[id]) only know at request time. */}
          <Suspense>
            <Onboarding />
          </Suspense>
          {children}
        </Container>
      </div>
    </WalletProviders>
  );
}

function Header() {
  const { isTestnet } = useWallet();
  return (
    <header className="sticky top-0 z-5 border-b border-[#ECE8F3] bg-white">
      <Container className="flex flex-wrap items-center gap-7 py-3 min-[901px]:flex-nowrap">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-.01em] text-[#1A1130]">
          <img src="/chog-logo.png" alt="ChogXBet logo" className="size-10 shrink-0 rounded-[10px]" />
          ChogXBet
          {isTestnet && (
            <span className="flex items-center gap-1.5 rounded-full border border-[#F2D7A6] bg-[#FDF5E6] px-2 py-0.5 text-[12px] font-semibold tracking-normal text-[#9A6412]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#E8A33D]" />
              Testnet
            </span>
          )}
        </Link>
        <Suspense fallback={<Nav pathname="" />}>
          <ActiveNav />
        </Suspense>
        <div className="ml-auto flex items-center gap-2.5">
          {NETWORK_TOGGLE && <NetworkToggle />}
          {/* The toploader's router reads the pathname too. */}
          <Suspense fallback={walletSkeleton}>
            <WalletControls />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}

// Header balances: 100K, 10K, 1.1K (the exact figure sits in the hover title).
const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
const ActiveNav =() => <Nav pathname={usePathname()} />;

function Nav({ pathname }: { pathname: string }) {
  const { isTestnet, connected } = useWallet();
  return (
    <nav aria-label="App" className="order-3 flex w-full gap-1 min-[901px]:order-none min-[901px]:w-auto">
      {NAV.filter((n) => (isTestnet || !n.testnetOnly) && (connected || !n.walletOnly)).map(({ href, label }) => {
        const active = href === "/app" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-[15px] font-medium ${active ? "bg-[#F1EEFB] text-[#6E56E8]" : "text-[#6B6185] hover:text-[#1A1130]"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function NetworkToggle() {
  const w = useWallet();
  return (
    <div role="radiogroup" aria-label="Network" className="flex gap-0.5 rounded-lg bg-[#F4F1FA] p-0.5 text-[13px] font-medium">
      {(["mainnet", "testnet"] as const).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={w.network === n}
          onClick={() => w.setNetwork(n)}
          className={`rounded-md px-2.5 py-1.5 capitalize ${w.network === n ? "bg-white text-[#1A1130] shadow-[0_1px_2px_rgba(26,17,48,.08)]" : "text-[#8E85A3] hover:text-[#1A1130]"}`}
        >
          {n === "testnet" && w.network === n && <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-[#E8A33D] align-middle" />}
          {n}
        </button>
      ))}
    </div>
  );
}

const walletSkeleton = (
  <div aria-busy="true" aria-label="Loading wallet" className="flex items-center gap-2.5">
    {/* Same footprint as the connected balance pill + address button, so nothing jumps when it resolves. */}
    <span className="h-[34px] w-[220px] animate-pulse rounded-lg bg-[#F1EEFB] motion-reduce:animate-none" />
    <span className="flex h-[38px] w-[142px] animate-pulse items-center gap-2 rounded-lg border border-[#ECE8F3] p-[5px] motion-reduce:animate-none">
      <span className="size-[26px] rounded-md bg-[#F1EEFB]" />
      <span className="h-3 flex-1 rounded bg-[#F1EEFB]" />
    </span>
  </div>
);

function WalletControls() {
  const w = useWallet();
  const router = useRouter();
  const avatar = useChogAvatar(w.ready ? w.address : undefined, w.net.chain.id);

  if (w.loading) return walletSkeleton;

  if (!w.ready || !w.address) {
    return (
      <>
        <Button
          variant="plain"
          onClick={w.connected ? w.switchChain : w.login}
          className="h-auto rounded-lg bg-[#6E56E8] px-4 py-[9px] text-[14px] font-semibold text-white"
        >
          {w.connected ? `Switch to ${w.net.chain.name}` : "Connect wallet"}
        </Button>
      </>
    );
  }

  const address = w.address;
  const copy = () =>
    navigator.clipboard.writeText(address).then(
      () => toast.success("Address copied", { description: short(address) }),
      () => toast.error("Couldn’t copy address"),
    );

  return (
    <>
      <span className="flex flex-none items-center gap-3 rounded-lg bg-[#F1EEFB] px-3 py-[7px] font-mono text-[13px] font-medium whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <img alt="" src="/chog-coin.avif" className="size-4 rounded-full" />
          {w.chogBalance == null ? "—" : <span title={fmt(w.chogBalance)}>{compact(w.chogBalance)}</span>}<span className="max-sm:sr-only"> $CHOG</span>
        </span>
        <span aria-hidden className="h-3.5 w-px bg-[#D6CEEC]" />
        <span className="flex items-center gap-1.5">
          <img alt="" src="/monad-mark.svg" className="size-4 rounded-full" />
          {w.monBalance == null ? "—" : <span title={fmt(w.monBalance)}>{compact(w.monBalance)}</span>}<span className="max-sm:sr-only"> MON</span>
        </span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="plain"
              className="h-auto flex-none gap-2 rounded-lg border border-[#DCD5EC] bg-white py-[5px] pr-3 pl-[5px] font-mono text-[13px] font-medium whitespace-nowrap text-[#1A1130]"
            />
          }
        >
          {avatar.loading ? (
            <span className="size-[26px] animate-pulse rounded-md bg-[#F1EEFB] motion-reduce:animate-none" />
          ) : (
            <img alt="" src={avatar.src ?? "/chog-1044.png"} className="size-[26px] rounded-md bg-[#F1EEFB] object-cover" />
          )}
          {short(address)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-48">
          <DropdownMenuItem className="px-2.5 py-2" onClick={() => router.push("/app/profile")}>
            <UserRound />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="px-2.5 py-2" onClick={copy}>
            <Copy />
            Copy address
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="px-2.5 py-2" variant="destructive" onClick={w.logout}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
