import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createPublicClient, http } from "viem";
import { NETWORKS } from "@/features/betting/networks";
import { ShareCard, WinCard } from "@/features/betting/share-card";
import { ipfs, nftAbi, type Meta } from "@/features/profile/nft";

// Duel share card. Every field is a query param, e.g.
// /og?asset=MON&now=$0.02&call=above $0.025&when=by month end&stake=1 MON&win=1.9, plus &chog=1044 for that Chog's art, &rival=212 for a challenge, and &theme=dark.
// A settled duel's winner card instead: /og?won=9.5&unit=MON&beat=Chog #212&result=MON closed above $0.10&chog=7&vs=212.
const file = (p: string) => readFile(join(process.cwd(), p));
const [bold, mono, logo] = await Promise.all([
  file("assets/fonts/Geist-Bold.ttf"),
  file("assets/fonts/GeistMono-SemiBold.ttf"),
  file("public/chog-logo.png"),
]);
// Satori can't draw the collection's webp art, so art goes in as a PNG at the card's art height.
// The beaten Chog on a winner card is greyed out here, since Satori has no CSS filters.
const png = async (b: Buffer, grey = false) => `data:image/png;base64,${(await sharp(b).resize(630, 630).grayscale(grey).png().toBuffer()).toString("base64")}`;
const mascot = await png(logo);
const greyMascot = await png(logo, true);

// Same network the duel page metadata reads (see app/duels/[id]/page.tsx).
const net = Object.values(NETWORKS).find((n) => n.duel);
async function chogArt(id: string, grey = false) {
  if (!net?.nft || !/^\d+$/.test(id)) return;
  const client = createPublicClient({ chain: net.chain, transport: http() });
  const uri = await client.readContract({ address: net.nft, abi: nftAbi, functionName: "tokenURI", args: [BigInt(id)] });
  const meta: Meta = await (await fetch(ipfs(uri))).json();
  return png(Buffer.from(await (await fetch(ipfs(meta.image))).arrayBuffer()), grey);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("chog") ?? "";
  const rival = q.get("rival") ?? "";
  const vs = q.get("vs") ?? "";
  const won = q.get("won");
  // no art: keep the mascot
  const [art, rivalArt, vsArt] = await Promise.all([chogArt(id), chogArt(rival), won ? chogArt(vs, true) : undefined].map((p) => p?.catch(() => undefined)));

  return new ImageResponse(
    won ? (
      <WinCard won={won} unit={q.get("unit") ?? "MON"} beat={q.get("beat") ?? "the other side"} result={q.get("result") ?? ""}
        art={art ?? mascot} chog={art ? id : undefined} vsArt={vsArt ?? greyMascot} dark={q.get("theme") === "dark"} />
    ) : <ShareCard
      asset={q.get("asset") ?? "MON"}
      now={q.get("now") ?? undefined}
      call={q.get("call") ?? "above $1"}
      when={q.get("when") ?? "by Dec 31"}
      stake={q.get("stake") ?? "25K $CHOG"}
      win={q.get("win") ?? "47.5K"}
      cta={q.get("cta") ?? "Seat open →"}
      art={art ?? mascot}
      chog={art ? id : undefined}
      rival={/^\d+$/.test(rival) ? { id: rival, art: rivalArt ?? mascot } : undefined}
      dark={q.get("theme") === "dark"}
    />,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 600, style: "normal" },
      ],
    },
  );
}
