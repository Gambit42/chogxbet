import { parseAbi } from "viem";

// Server-safe half of chogs.ts: the og route and duel metadata import these directly.
export const nftAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function nextId() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
]);

// Mirror only this collection's artwork; tokenURI metadata stays on IPFS.
const mirror = "https://kjagkzhddpetwqrosbhj.supabase.co/storage/v1/object/public/chog";
export const ipfs = (uri: string) => uri
  .replace("ipfs://bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e/", `${mirror}/`)
  .replace(/^ipfs:\/\//, "https://apac.orbitor.dev/ipfs/");

export type Meta = { name: string; image: string; attributes?: { trait_type: string; value: string }[] };
