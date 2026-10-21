import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { createPublicClient, http, zeroAddress, type Address } from "viem";
import { DuelPage, DuelSkeleton } from "@/features/betting/duel-page";
import { cardQuery, duelAbi, feedAbi, findSettledBlock, winQuery } from "@/features/betting/duel";
import { NETWORKS } from "@/features/betting/networks";
import { nftAbi } from "@/features/profile/nft";

// ponytail: the network is a client-side pick, so the server assumes the one network with an escrow; once mainnet has one, put the network in the link.
const net = Object.values(NETWORKS).find((n) => n.duel);
const one = (v: string | string[] | undefined) => (typeof v === "string" && /^\d+$/.test(v) ? v : undefined);

// The link preview is the /og card for this duel, with the creator's Chog when the link names one they hold (?chog=) and the theme they picked (?theme=dark).
// Once settled with a winner it's the winner card instead: the winner's Chog (?chog=) and the loser's (?vs=), again only when they hold them.
export async function generateMetadata({ params, searchParams }: PageProps<"/app/duels/[id]">): Promise<Metadata> {
  const [{ id }, sp, h] = await Promise.all([params, searchParams, headers()]);
  if (!net?.duel || !one(id)) return {};
  const duel = net.duel;
  const client = createPublicClient({ chain: net.chain, transport: http() });
  const holds = async (chog: string | undefined, who: Address) => {
    if (!chog || !net.nft) return;
    const owner = await client.readContract({ address: net.nft, abi: nftAbi, functionName: "ownerOf", args: [BigInt(chog)] }).catch(() => undefined);
    return owner?.toLowerCase() === who.toLowerCase() ? chog : undefined;
  };
  const card = (q: URLSearchParams, title: string): Metadata => {
    if (sp.theme === "dark") q.set("theme", "dark");
    const image = { url: `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/og?${q}`, width: 1200, height: 630 };
    return { title, openGraph: { title, images: image }, twitter: { card: "summary_large_image", title, images: image } };
  };
  try {
    const [creator, deadline, above, status, opponent, token, feed, stake, target, rival] = await client.readContract({ address: duel, abi: duelAbi, functionName: "duels", args: [BigInt(id)] });
    const asset = Object.entries(net.feeds).find(([, f]) => f?.toLowerCase() === feed.toLowerCase())?.[0] ?? "?";
    if (status === 3) {
      const block = await findSettledBlock(client, duel, BigInt(id), net.duelFromBlock).catch(() => undefined);
      const [log] = block ? await client.getContractEvents({ address: duel, abi: duelAbi, eventName: "DuelSettled", args: { id: BigInt(id) }, fromBlock: block, toBlock: block, strict: true }) : [];
      if (log && log.args.winner !== zeroAddress) {
        const { winner, price } = log.args;
        const creatorWon = winner.toLowerCase() === creator.toLowerCase();
        const loser = creatorWon ? opponent : creator;
        // The first candidate each side still holds: the link's picks (an old callout link's ?chog= is the creator's), then the challenged Chog.
        const first = async (who: Address, ...ids: (string | undefined)[]) => (await Promise.all(ids.map((c) => holds(c, who)))).find(Boolean);
        const challenged = rival ? String(rival) : undefined;
        const [chog, vs] = await Promise.all([first(winner, one(sp.chog), challenged), first(loser, one(sp.vs), one(sp.chog), challenged)]);
        const q = winQuery({ target, stake, token }, asset, price, loser, chog, vs);
        return card(q, `+${q.get("won")} ${q.get("unit")} on ${asset} · ChogXBet`);
      }
    }
    // The live price comes from mainnet Chainlink, which testnet feeds mirror.
    const main = NETWORKS.mainnet.feeds[asset as keyof typeof NETWORKS.mainnet.feeds];
    const latest = main && (await createPublicClient({ chain: NETWORKS.mainnet.chain, transport: http() }).readContract({ address: main, abi: feedAbi, functionName: "latestRoundData" }).catch(() => undefined));
    const q = cardQuery({ above, target, deadline: Number(deadline), stake, token, status, rival }, asset, latest ? latest[1] : undefined);
    const chog = await holds(one(sp.chog), creator);
    if (chog) q.set("chog", chog);
    return card(q, `${asset} ${q.get("call")} ${q.get("when")} · ChogXBet`);
  } catch {
    return {}; // unknown duel or RPC down: fall back to the site card
  }
}

// The id is only known at request time, so it's read inside Suspense (Cache Components).
export default function Page({ params, searchParams }: PageProps<"/app/duels/[id]">) {
  return (
    <Suspense fallback={<DuelSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => <DuelPage id={id} chog={one(sp.chog)} />)}
    </Suspense>
  );
}
