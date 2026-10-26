import { parseAbi } from "viem";

// Server-safe half of chogs.ts: the og route and duel metadata import these directly.
export const nftAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function nextId() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
]);

// Mirror only this collection's artwork; tokenURI metadata stays on IPFS behind free public gateways (no key).
export const mirror = "https://kjagkzhddpetwqrosbhj.supabase.co/storage/v1/object/public/chog";
const gateways = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/", "https://dweb.link/ipfs/", "https://apac.orbitor.dev/ipfs/"];
export const ipfs = (uri: string) => uri
  .replace("ipfs://bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e/", `${mirror}/`)
  .replace(/^ipfs:\/\//, gateways[0]);

export type Meta = { name: string; image: string; attributes?: { trait_type: string; value: string }[] };

// Public gateways rate-limit and go down, so try each in turn before giving up.
// ponytail: worst case waits 8s per gateway; mirror all 1969 n.json to Supabase if they keep failing.
export async function fetchMeta(uri: string): Promise<Meta> {
  for (const g of gateways) {
    try {
      const res = await fetch(uri.replace(/^ipfs:\/\//, g), { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json();
    } catch {
      // timed out or blocked; next gateway
    }
  }
  throw new Error(`No gateway served ${uri}`);
}
