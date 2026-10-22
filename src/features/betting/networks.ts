import type { Address } from "viem";
import { monad, monadTestnet } from "viem/chains";

const MAINNET_CHOG = "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777";

// Everything that differs between networks. `getChog` / `getNft` are where onboarding sends a wallet that has none.
// Mainnet addresses checked on-chain (name/symbol: "Chog"/CHOG ERC-20, "Chog Genesis" ERC-721) on 2026-10-21.
export const NETWORKS = {
  mainnet: {
    chain: monad,
    chog: MAINNET_CHOG as Address | undefined,
    nft: "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763" as Address | undefined,
    // ChogDuel escrow (contracts/src); not on mainnet until it has settlement and a review.
    duel: undefined as Address | undefined,
    duelFromBlock: BigInt(0),
    // LastWord (contracts/src): the no-stakes mode where the loser's Chog wears the dare. Testnet only for now.
    lastWord: undefined as Address | undefined,
    // Chainlink USD price feeds (8 decimals) the escrow allowlists; checked on-chain 2026-10-21.
    feeds: {
      MON: "0xBcD78f76005B7515837af6b50c7C52BCf73822fb",
      BTC: "0xc1d4C3331635184fA4C3c22fb92211B2Ac9E0546",
      SOL: "0x16F8008c3e89f62e5e2b909Ce70999370D38F4F2",
      ETH: "0x1B1414782B859871781bA3E4B0979b9ca57A0A04",
    } as Partial<Record<string, Address>>,
    getChog: `https://nad.fun/tokens/${MAINNET_CHOG}`,
    getNft: "https://opensea.io/collection/chog-genesis",
  },
  testnet: {
    chain: monadTestnet,
    chog: process.env.NEXT_PUBLIC_CHOG_ADDRESS as Address | undefined,
    nft: process.env.NEXT_PUBLIC_CHOG_NFT_ADDRESS as Address | undefined,
    duel: process.env.NEXT_PUBLIC_DUEL_ADDRESS as Address | undefined,
    lastWord: process.env.NEXT_PUBLIC_LASTWORD_ADDRESS as Address | undefined,
    // Deployment block of 0xaeBb...43c0 (2026-10-22).
    duelFromBlock: BigInt(73204505),
    // FeedMirrors (contracts/src/testnet) the settle cron fills with mainnet Chainlink rounds; deployed by DeployDuel.s.sol 2026-10-21.
    feeds: {
      MON: "0x597152837F69f4186F36f9ed21446D9E56AaC509",
      BTC: "0xaB07228F732742B55faACC91737caFD2308E9Bc0",
      SOL: "0x5aD5803fED64aAE5110E3d5F32FeC9Ed0913f492",
      ETH: "0xf36469dc7C31FD14F1DA65978d8b5F680149D882",
    } as Partial<Record<string, Address>>,
    getChog: "/faucet",
    getNft: "/faucet",
  },
};
export type Network = keyof typeof NETWORKS;

export const networkOf = (chainId: number) => Object.values(NETWORKS).find((n) => n.chain.id === chainId);
