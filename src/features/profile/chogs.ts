"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { networkOf } from "@/features/betting/networks";
import { fetchMeta, ipfs, nftAbi, type Meta } from "./nft";

export { fetchMeta, ipfs, nftAbi, type Meta };

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
    queries: mine.map((id, i) => {
      const uri = uris.data?.[i]?.result as string | undefined;
      return {
        // The id keeps keys unique while the URIs are still loading (all undefined).
        queryKey: ["chog-meta", String(id), uri],
        queryFn: async (): Promise<Meta> => fetchMeta(uri!),
        enabled: !!uri,
        staleTime: Infinity,
      };
    }),
  });
  const loading = !!owner && !!nft && (count.isLoading || owners.isLoading);
  const chogs = mine.map((id, i): Owned => ({ id, meta: metas[i]?.data, pending: !metas[i]?.data && !metas[i]?.isError && !uris.isError }));
  return { loading, chogs };
}

/** Any Chog's tokenURI and metadata by id, whoever holds it now; same cache key as useOwnedChogs. An unminted id fails `uri` at once. */
export function useChogMeta(id: bigint | undefined, chainId: number) {
  const nft = networkOf(chainId)?.nft;
  const uri = useReadContract({ address: nft, abi: nftAbi, functionName: "tokenURI", args: [id ?? BigInt(0)], chainId, query: { enabled: !!id && !!nft, retry: false } });
  const meta = useQuery({
    queryKey: ["chog-meta", String(id), uri.data],
    queryFn: async (): Promise<Meta> => fetchMeta(uri.data!),
    enabled: !!uri.data,
    staleTime: Infinity,
  });
  return { uri, meta };
}

// ponytail: the profile pick lives in this browser only; move it server-side if it must follow the wallet across devices.
const pickKey = (owner: Address, chainId: number) => `chog-default:${chainId}:${owner.toLowerCase()}`;
const pickListeners = new Set<() => void>();

export function setDefaultChog(owner: Address, chainId: number, id: bigint) {
  try { localStorage.setItem(pickKey(owner, chainId), String(id)); } catch {}
  pickListeners.forEach((l) => l());
}

/** The Chog picked on the profile page, or the first one owned if none was picked (or it was sold). */
export function useDefaultChog(owner: Address | undefined, chainId: number, chogs: Owned[]) {
  const picked = useSyncExternalStore(
    (cb) => {
      pickListeners.add(cb);
      window.addEventListener("storage", cb);
      return () => { pickListeners.delete(cb); window.removeEventListener("storage", cb); };
    },
    () => { try { return owner ? localStorage.getItem(pickKey(owner, chainId)) : null; } catch { return null; } },
    () => null,
  );
  return chogs.find((c) => String(c.id) === picked) ?? chogs[0];
}

/** The Chog that stands for `owner`: `prefer` (a duel link's ?chog) if they still hold it, else their profile pick. */
export function useProfileChog(owner: Address | undefined, chainId: number, prefer?: string) {
  const { loading, chogs } = useOwnedChogs(owner, chainId);
  const pick = useDefaultChog(owner, chainId, chogs);
  return { loading, chogs, chog: chogs.find((c) => String(c.id) === prefer) ?? pick };
}

/** The wallet's profile Chog art: `loading` while that's unknown, no `src` if it owns none. */
export function useChogAvatar(owner: Address | undefined, chainId: number) {
  const { loading, chog } = useProfileChog(owner, chainId);
  return { loading: loading || !!chog?.pending, src: chog?.meta && ipfs(chog.meta.image) };
}
