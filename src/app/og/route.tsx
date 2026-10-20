/* eslint-disable @next/next/no-img-element -- Satori renders plain <img>, not next/image. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Duel share card. Every field is a query param, e.g.
// /og?title=$MON ≥ $1.50&sub=by Dec 31&stake=25K $CHOG
const file = (p: string) => readFile(join(process.cwd(), p));
const [bold, mono, logo, avatar] = await Promise.all([
  file("assets/fonts/Geist-Bold.ttf"),
  file("assets/fonts/GeistMono-SemiBold.ttf"),
  file("public/chog-logo.png"),
  file("public/chog-1044.png"),
]);
const png = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = q.get("title") ?? "$MON ≥ $1";
  const sub = q.get("sub") ?? "by Dec 31";
  const stake = q.get("stake") ?? "25K $CHOG";

  return new ImageResponse(
    (
      // Background matches the logo's own purple so the mascot blends in.
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#6C57E6", color: "#fff", fontFamily: "Geist" }}>
        <img src={png(logo)} width={760} height={760} style={{ position: "absolute", right: -170, bottom: -230 }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", padding: "56px 64px 128px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34 }}>
            <img src={png(avatar)} width={52} height={52} style={{ borderRadius: 12 }} alt="" />
            ChogXBet
          </div>
          <span style={{ marginTop: 56, fontSize: 132, lineHeight: 1, letterSpacing: -5 }}>{title}</span>
          <span style={{ marginTop: 12, fontSize: 60, color: "#E3DEFB", letterSpacing: -2 }}>{sub}</span>
          <span style={{ marginTop: "auto", alignSelf: "flex-start", padding: "12px 28px", borderRadius: 999, background: "#fff", color: "#1A1130", fontFamily: "Geist Mono", fontSize: 36 }}>{stake}</span>
        </div>
      </div>
    ),
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
