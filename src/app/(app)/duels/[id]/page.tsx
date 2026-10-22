import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { createPublicClient, http, zeroAddress } from "viem";
import { DuelPage, DuelSkeleton } from "@/features/betting/duel-page";
import { cardQuery, duelAbi, feedAbi, findSettledBlock, winQuery } from "@/features/betting/duel";
import { NETWORKS } from "@/features/betting/networks";

// ponytail: the network is a client-side pick, so the server assumes the one network with an escrow; once mainnet has one, put the network in the link.
const net = Object.values(NETWORKS).find((n) => n.duel);
const one = (v: string | string[] | undefined) => (typeof v === "string" && /^\d+$/.test(v) ? v : undefined);

// The link preview is the /og card for this duel, with the Chog the creator entered with and the theme they picked (?theme=dark).
// Once settled with a winner it's the winner card instead: the winner's Chog and the loser's, as recorded on-chain.
export async function generateMetadata({ params, searchParams }: PageProps<"/duels/[id]">): Promise<Metadata> {
  const [{ id }, sp, h] = await Promise.all([params, searchParams, headers()]);
  if (!net?.duel || !one(id)) return {};
  const duel = net.duel;
  const client = createPublicClient({ chain: net.chain, transport: http() });
  const card = (q: URLSearchParams, title: string): Metadata => {
    if (sp.theme === "dark") q.set("theme", "dark");
    const image = { url: `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/og?${q}`, width: 1200, height: 630 };
    return { title, openGraph: { title, images: image }, twitter: { card: "summary_large_image", title, images: image } };
  };
  try {
    const [creator, deadline, above, status, opponent, token, feed, stake, target, rival, creatorChog, opponentChog] = await client.readContract({ address: duel, abi: duelAbi, functionName: "duels", args: [BigInt(id)] });
    const asset = Object.entries(net.feeds).find(([, f]) => f?.toLowerCase() === feed.toLowerCase())?.[0] ?? "?";
    if (status === 3) {
      const block = await findSettledBlock(client, duel, BigInt(id), net.duelFromBlock).catch(() => undefined);
      const [log] = block ? await client.getContractEvents({ address: duel, abi: duelAbi, eventName: "DuelSettled", args: { id: BigInt(id) }, fromBlock: block, toBlock: block, strict: true }) : [];
      if (log && log.args.winner !== zeroAddress) {
        const { winner, price } = log.args;
        const creatorWon = winner.toLowerCase() === creator.toLowerCase();
        const loser = creatorWon ? opponent : creator;
        const [chog, vs] = (creatorWon ? [creatorChog, opponentChog] : [opponentChog, creatorChog]).map(String);
        const q = winQuery({ target, stake, token }, asset, price, loser, chog, vs);
        return card(q, `+${q.get("won")} ${q.get("unit")} on ${asset} · ChogXBet`);
      }
    }
    // "now" is the price the creator's card showed (?now=), so this is the same /og URL they already loaded; without it, the live
    // price from mainnet Chainlink, which testnet feeds mirror.
    // ponytail: ?now= is display-only and unchecked, so an edited link can show a wrong "now" but never a wrong call, stake or Chog.
    const main = NETWORKS.mainnet.feeds[asset as keyof typeof NETWORKS.mainnet.feeds];
    const linkNow = one(sp.now);
    const now = linkNow ? BigInt(linkNow) : main && await createPublicClient({ chain: NETWORKS.mainnet.chain, transport: http() }).readContract({ address: main, abi: feedAbi, functionName: "latestRoundData" }).then((r) => r[1], () => undefined);
    const q = cardQuery({ above, target, deadline: Number(deadline), stake, token, status, rival }, asset, now);
    q.set("chog", String(creatorChog));
    return card(q, `${asset} ${q.get("call")} ${q.get("when")} · ChogXBet`);
  } catch {
    return {}; // unknown duel or RPC down: fall back to the site card
  }
}

// The id is only known at request time, so it's read inside Suspense (Cache Components).
export default function Page({ params }: PageProps<"/duels/[id]">) {
  return (
    <Suspense fallback={<DuelSkeleton />}>
      {params.then(({ id }) => <DuelPage id={id} />)}
    </Suspense>
  );
}
