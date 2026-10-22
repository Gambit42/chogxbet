import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { createPublicClient, http } from "viem";
import { NETWORKS } from "@/features/betting/networks";
import { DarePage } from "@/features/lastword/dare-page";
import { lastWordAbi, lwCardQuery } from "@/features/lastword/lastword";

// ponytail: same single-network assumption as /duels/[id].
const net = Object.values(NETWORKS).find((n) => n.lastWord);

// The link preview is the same /og card the create form previews: the call, the creator's Chog, and the dare in place of a stake.
export async function generateMetadata({ params, searchParams }: PageProps<"/last-word/[id]">): Promise<Metadata> {
  const [{ id }, sp, h] = await Promise.all([params, searchParams, headers()]);
  if (!net?.lastWord || !/^\d+$/.test(id)) return {};
  try {
    const client = createPublicClient({ chain: net.chain, transport: http() });
    const [, deadline, above, status, , feed, target, rival, creatorChog, , dare] = await client.readContract({ address: net.lastWord, abi: lastWordAbi, functionName: "duels", args: [BigInt(id)] });
    const asset = Object.entries(net.feeds).find(([, f]) => f?.toLowerCase() === feed.toLowerCase())?.[0] ?? "?";
    const q = lwCardQuery({ above, target, deadline: Number(deadline), status, rival, creatorChog, dare }, asset);
    if (sp.theme === "dark") q.set("theme", "dark");
    const title = `${asset} ${q.get("call")} ${q.get("when")} · Last Word · ChogXBet`;
    const image = { url: `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/og?${q}`, width: 1200, height: 630 };
    return { title, openGraph: { title, images: image }, twitter: { card: "summary_large_image", title, images: image } };
  } catch {
    return {}; // unknown duel or RPC down: fall back to the site card
  }
}

// The id is only known at request time, so it's read inside Suspense (Cache Components).
export default function Page({ params }: PageProps<"/last-word/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => <DarePage id={id} />)}
    </Suspense>
  );
}
