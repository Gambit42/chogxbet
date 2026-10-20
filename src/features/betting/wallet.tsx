"use client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { erc20Abi, formatUnits, type Address } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { fallback, http, useAccount, useBalance, useReadContract, useReadContracts, useSwitchChain } from "wagmi";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { nftAbi } from "@/features/profile/chogs";
import { NETWORKS, type Network } from "./networks";

export const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// The network the viewer picked: testnet by default (the hackathon demo; judges rarely own a Chog), remembered per browser. Kept in memory too in case storage is blocked.
const NETWORK_KEY = "chogxbet:network";
let picked: Network | undefined;
const listeners = new Set<() => void>();
const readNetwork = (): Network => {
  if (!picked) {
    try {
      picked = localStorage.getItem(NETWORK_KEY) === "mainnet" ? "mainnet" : "testnet";
    } catch {
      picked = "testnet";
    }
  }
  return picked;
};
const saveNetwork = (n: Network) => {
  picked = n;
  try {
    localStorage.setItem(NETWORK_KEY, n);
  } catch {}
  listeners.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
// Hackathon build: testnet only. Set to true to bring back the header's Mainnet | Testnet toggle.
export const NETWORK_TOGGLE = false;
const useNetwork = (): Network => {
  const picked = useSyncExternalStore(subscribe, readNetwork, () => "testnet" as const);
  return NETWORK_TOGGLE ? picked : "testnet";
};

const wagmiConfig = createConfig({
  chains: [monad, monadTestnet],
  // Testnet: optional private URL (else Monad's free public RPC, 50 rps), then Ankr's free RPC if that one errors or rate-limits.
  transports: { [monad.id]: http(), [monadTestnet.id]: fallback([http(process.env.NEXT_PUBLIC_TESTNET_RPC_URL), http("https://rpc.ankr.com/monad_testnet")]) },
});
const queryClient = new QueryClient();

export type AppWallet = {
  network: Network;
  /** The picked network's chain and contract addresses. */
  net: (typeof NETWORKS)[Network];
  isTestnet: boolean;
  /** Pick a network; a connected wallet is asked to switch to it. */
  setNetwork: (n: Network) => void;
  /** Privy restores the session first, then the wagmi address; don't offer login in between. */
  loading: boolean;
  connected: boolean;
  address?: Address;
  wrongChain: boolean;
  /** Connected and on the app's chain. */
  ready: boolean;
  chogBalance?: number;
  monBalance?: number;
  /** Chog NFTs held; undefined while loading or when no NFT address is configured. */
  chogNfts?: number;
  login: () => void;
  logout: () => void;
  switchChain: () => void;
};

/** Label and action for a button that needs a connected wallet on the right chain. */
export const walletLabel = (w: AppWallet) => (w.loading ? "Loading…" : w.connected ? `Switch to ${w.net.chain.name}` : "Connect wallet");
export const needWallet = (w: AppWallet) => (w.loading ? undefined : w.connected ? w.switchChain() : w.login());

const WalletContext = createContext<AppWallet | null>(null);

export function useWallet() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside <WalletProviders>");
  return wallet;
}

function WalletState({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const network = useNetwork();
  const net = NETWORKS[network];
  const { chain, chog, nft } = net;
  const { data } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: chog, abi: erc20Abi, functionName: "balanceOf", args: [address!], chainId: chain.id },
      { address: chog, abi: erc20Abi, functionName: "decimals", chainId: chain.id },
    ],
    query: { enabled: !!chog && !!address },
  });
  const nfts = useReadContract({ address: nft, abi: nftAbi, functionName: "balanceOf", args: [address!], chainId: chain.id, query: { enabled: !!nft && !!address } });
  const mon = useBalance({ address, chainId: chain.id, query: { enabled: !!address } });
  const connected = authenticated && !!address;
  const wrongChain = connected && chainId !== chain.id;
  const wallet: AppWallet = {
    network,
    net,
    isTestnet: network === "testnet",
    setNetwork: (n) => {
      saveNetwork(n);
      if (connected) switchChain({ chainId: NETWORKS[n].chain.id });
    },
    loading: !ready || (authenticated && !address),
    connected,
    address,
    wrongChain,
    ready: connected && !wrongChain,
    chogBalance: data && Number(formatUnits(data[0], data[1])),
    chogNfts: nfts.data === undefined ? undefined : Number(nfts.data),
    monBalance: mon.data && Number(formatUnits(mon.data.value, mon.data.decimals)),
    login,
    logout,
    switchChain: () => switchChain({ chainId: chain.id }),
  };
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

export function WalletProviders({ children }: { children: ReactNode }) {
  const network = useNetwork();
  return (
    <PrivyProvider
      appId={appId!}
      config={{
        appearance: { theme: "light", accentColor: "#6E56E8", logo: "/chog-logo.png" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: NETWORKS[network].chain,
        supportedChains: [monad, monadTestnet],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <WalletState>{children}</WalletState>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
