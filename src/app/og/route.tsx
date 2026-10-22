import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ShareCard, WinCard } from "@/features/betting/share-card";
import { mirror } from "@/features/profile/nft";

// Duel share card. Every field is a query param, e.g.
// /og?asset=MON&now=$0.02&call=above $0.025&when=by month end&stake=1 MON&win=1.9, plus &chog=1044 for that Chog's art, &rival=212 for a challenge, &dare=… for a Last Word duel, and &theme=dark.
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

// A Chog's art never changes, so each one is fetched once per server instance; a failed fetch is dropped so the next request retries.
// ponytail: unbounded, but capped by the collection size.
const arts = new Map<string, Promise<string>>();
function chogArt(id: string, grey = false) {
  if (!/^\d+$/.test(id)) return;
  const key = `${id}:${grey}`;
  if (!arts.has(key)) arts.set(key, fetchArt(id, grey).catch((e) => { arts.delete(key); throw e; }));
  return arts.get(key);
}
// Straight from the Supabase mirror, skipping the tokenURI read and IPFS metadata hop: MockChogNFT gives Chog #n the
// collection's n.json, whose art is n.webp (wrapping past 1969 like its tokenURI does).
// ponytail: mainnet Chog Genesis shuffled art at mint (#1 is 1462.webp), so mainnet needs a stored id → file map.
async function fetchArt(id: string, grey: boolean) {
  const res = await fetch(`${mirror}/${(Number(id) - 1) % 1969 + 1}.webp`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Chog #${id} art: ${res.status}`);
  return png(Buffer.from(await res.arrayBuffer()), grey);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("chog") ?? "";
  const rival = q.get("rival") ?? "";
  const vs = q.get("vs") ?? "";
  const won = q.get("won");
  // no art: keep the mascot
  let missed = false; // an asked-for Chog that fell back to the mascot shouldn't stick in caches
  const [art, rivalArt, vsArt] = await Promise.all([chogArt(id), chogArt(rival), won ? chogArt(vs, true) : undefined].map((p) => p?.catch(() => { missed = true; return undefined; })));

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
      cta={q.get("cta") ?? "Fade me →"}
      dare={q.get("dare") ?? undefined}
      art={art ?? mascot}
      chog={art ? id : undefined}
      rival={/^\d+$/.test(rival) ? { id: rival, art: rivalArt ?? mascot } : undefined}
      dark={q.get("theme") === "dark"}
    />,
    {
      width: 1200,
      height: 630,
      // Everything on the card is in the URL, so a given URL always draws the same image.
      headers: { "cache-control": missed ? "no-store" : "public, max-age=31536000, s-maxage=31536000, immutable" },
      fonts: [
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 600, style: "normal" },
      ],
    },
  );
}
