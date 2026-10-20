"use client";
import { useQueries } from "@tanstack/react-query";
import { parseAbi, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { networkOf } from "@/features/betting/networks";

export const nftAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function nextId() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
]);

export const ipfs = (uri: string) => uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");

export type Meta = { name: string; image: string; attributes?: { trait_type: string; value: string }[] };
/** `pending` stays true until the metadata loads or fails, so callers can hold a placeholder. */
export type Owned = { id: bigint; meta?: Meta; pending: boolean };

// ponytail: neither collection is enumerable, so this checks ownerOf for every id (1..count) in one multicall.
// That's 1,969 calls on mainnet; if that gets slow, read Transfer logs or use an indexer.
export function useOwnedChogs(owner: Address | undefined, chainId: number) {
  const nft = networkOf(chainId)?.nft;
  // The testnet mock counts with nextId; the real collection only has totalSupply. Ids start at 1 on both.
  const count = useReadContracts({
    contracts: [
      { address: nft!, abi: nftAbi, functionName: "nextId", chainId },
      { address: nft!, abi: nftAbi, functionName: "totalSupply", chainId },
    ],
    query: { enabled: !!nft && !!owner },
  });
  const [nextId, supply] = count.data ?? [];
  const n = nextId?.result !== undefined ? Number(nextId.result) - 1 : supply?.result !== undefined ? Number(supply.result) : 0;
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const owners = useReadContracts({
    contracts: ids.map((id) => ({ address: nft!, abi: nftAbi, functionName: "ownerOf", args: [id], chainId }) as const),
    query: { enabled: ids.length > 0 },
  });
  const mine = ids.filter((_, i) => (owners.data?.[i]?.result as string | undefined)?.toLowerCase() === owner?.toLowerCase());
  const uris = useReadContracts({
    contracts: mine.map((id) => ({ address: nft!, abi: nftAbi, functionName: "tokenURI", args: [id], chainId }) as const),
    query: { enabled: mine.length > 0 },
  });
  const metas = useQueries({
    queries: mine.map((_, i) => {
      const uri = uris.data?.[i]?.result as string | undefined;
      return {
        queryKey: ["chog-meta", uri],
        queryFn: async (): Promise<Meta> => (await fetch(ipfs(uri!))).json(),
        enabled: !!uri,
        staleTime: Infinity,
      };
    }),
  });
  const loading = !!owner && !!nft && (count.isLoading || owners.isLoading);
  const chogs = mine.map((id, i): Owned => ({ id, meta: metas[i]?.data, pending: !metas[i]?.data && !metas[i]?.isError && !uris.isError }));
  return { loading, chogs };
}

/** The wallet's first Chog's art: `loading` while that's unknown, no `src` if it owns none. */
export function useChogAvatar(owner: Address | undefined, chainId: number) {
  const { loading, chogs } = useOwnedChogs(owner, chainId);
  const first = chogs[0];
  return { loading: loading || !!first?.pending, src: first?.meta && ipfs(first.meta.image) };
}
