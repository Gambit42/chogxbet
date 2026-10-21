/* eslint-disable @next/next/no-img-element -- Satori renders plain <img>, and the preview shows IPFS art. */
import { ASSETS, type Asset } from "./coins";

// The duel share card at its 1200×630 OG size. Inline styles only, so app/og (Satori) and the create-call preview draw the same card.
// An open call shows the creator's Chog; a challenge (`rival`) puts the called-out Chog opposite it.
export type Card = {
  asset: string; now?: string; call: string; when: string; stake: string; win: string; cta: string;
  art: string; chog?: string; rival?: { id: string; art?: string }; dark?: boolean; // no rival art: still loading (preview only)
};

const THEMES = {
  light: { bg: "#FFFFFF", fg: "#1A1130", muted: "#6B6185", hi: "#6E56E8", panel: "#F1EEFB", btn: "#6E56E8", badge: "#FFFFFF" },
  dark: { bg: "#121116", fg: "#F5F3FA", muted: "#8A8698", hi: "#A391FF", panel: "#1D1B25", btn: "#8B74F5", badge: "#141218" },
};
// Satori matches the font names registered in app/og; the browser falls through to the next/font variables.
const sans = "Geist, var(--font-geist)";
const mono = "Geist Mono, var(--font-geist-mono)";

export function ShareCard(card: Card) {
  if (card.rival) return <Callout {...card} rival={card.rival} />;
  const { asset, now, call, when, stake, win, cta, art, chog, dark } = card;
  const t = dark ? THEMES.dark : THEMES.light;
  const coin = Object.hasOwn(ASSETS, asset) ? ASSETS[asset as Asset] : undefined;
  const words = `${asset} will be ${call} ${when}.`.split(" ");
  const hi = call.split(" ").length; // the call's words sit right after "<asset> will be"
  const size = words.join(" ").length > 48 ? 56 : 68;
  const label = { fontFamily: mono, fontWeight: 500, fontSize: 20, letterSpacing: 2, color: t.muted };
  return (
    <div style={{ display: "flex", width: 1200, height: 630, background: t.bg, color: t.fg, fontFamily: sans, fontWeight: 700 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "44px 38px 38px 50px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width={56} height={56} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill={coin?.bg ?? t.panel} />{coin?.mark}</svg>
          <span style={{ marginLeft: 16, fontSize: 28 }}>{asset}</span>
          {now && <span style={{ ...label, marginLeft: 16, fontSize: 24, letterSpacing: 0 }}>{`now ${now}`}</span>}
          <span style={{ ...label, marginLeft: "auto", fontSize: 22, color: t.hi }}>CHOGXBET</span>
        </div>
        {/* One span per word: Satori can't flow text across differently styled spans, but it can wrap flex items. */}
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: Math.round(size * 0.26), marginTop: 22, fontSize: size, lineHeight: 1.08, letterSpacing: -2 }}>
          {words.map((w, i) => <span key={i} style={{ color: i >= 3 && i < 3 + hi ? t.hi : t.fg }}>{w}</span>)}
        </div>
        {/* Sized so the CTA fits "Calling out #1969" (Chog ids top out at 4 digits). */}
        <div style={{ display: "flex", alignItems: "center", marginTop: "auto", padding: "16px 12px 16px 24px", borderRadius: 20, background: t.panel }}>
          {[["STAKE", stake, t.fg], ["WINNER", win, t.hi]].map(([k, v, color]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", minWidth: 120, marginRight: 24 }}>
              <span style={label}>{k}</span>
              <span style={{ ...label, marginTop: 8, fontSize: 28, letterSpacing: 0, color, whiteSpace: "nowrap" }}>{v}</span>
            </div>
          ))}
          <span style={{ marginLeft: "auto", padding: "22px 24px", borderRadius: 16, background: t.btn, color: "#fff", fontSize: 26, whiteSpace: "nowrap", flexShrink: 0 }}>{cta}</span>
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", width: 402, flexShrink: 0 }}>
        <img src={art} width={402} height={630} style={{ objectFit: "cover" }} alt="" />
        {chog && <span style={{ ...label, position: "absolute", left: 24, bottom: 38, padding: "12px 18px", borderRadius: 12, background: t.badge, fontSize: 22, color: t.fg }}>{`CHOG #${chog}`}</span>}
      </div>
    </div>
  );
}

// A challenge: the creator's Chog on the left, the called-out Chog on the right, the call between them.
function Callout({ asset, call, when, stake, win, cta, art, chog, rival, dark }: Card & { rival: { id: string; art?: string } }) {
  const t = dark ? THEMES.dark : THEMES.light;
  const words = `${asset} ${call} ${when}.`.split(" ");
  const hi = call.split(" ").length; // the target price, the call's last word
  const size = words.join(" ").length > 40 ? 46 : 56;
  const me = chog ? `#${chog}` : "ANON";
  const label = { fontFamily: mono, fontWeight: 600, fontSize: 22, letterSpacing: 2, color: t.muted };
  const badge = { ...label, position: "absolute", bottom: 24, padding: "12px 18px", borderRadius: 12, color: t.fg, background: t.badge } as const;
  return (
    <div style={{ display: "flex", width: 1200, height: 630, background: t.bg, color: t.fg, fontFamily: sans, fontWeight: 700 }}>
      <div style={{ display: "flex", position: "relative", width: 300, flexShrink: 0 }}>
        <img src={art} width={300} height={630} style={{ objectFit: "cover" }} alt="" />
        <span style={{ ...badge, left: 22 }}>{`${me} · ${call.split(" ")[0].toUpperCase()}`}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, padding: "40px 36px 34px" }}>
        <span style={{ ...label, letterSpacing: 3, color: t.hi }}>CHOGXBET · CALLOUT</span>
        <div style={{ display: "flex", marginTop: 20, ...label, fontSize: 30, letterSpacing: 1 }}>
          <span>{me}</span><span style={{ margin: "0 16px", color: t.hi }}>VS</span><span>{`#${rival.id}`}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: Math.round(size * 0.26), marginTop: 18, fontSize: size, lineHeight: 1.1, letterSpacing: -1.5 }}>
          {words.map((w, i) => <span key={i} style={{ color: i === hi ? t.hi : t.fg }}>{w}</span>)}
        </div>
        <span style={{ ...label, marginTop: "auto", letterSpacing: 1 }}>{`${stake} EACH · WINNER ${win}`.toUpperCase()}</span>
        <span style={{ display: "flex", justifyContent: "center", alignSelf: "stretch", marginTop: 18, padding: "22px 24px", borderRadius: 16, background: t.btn, color: "#fff", fontSize: 28, whiteSpace: "nowrap" }}>{cta}</span>
      </div>
      <div style={{ display: "flex", position: "relative", width: 300, flexShrink: 0, border: `6px solid ${t.hi}`, background: t.panel }}>
        {rival.art ? <img src={rival.art} width={288} height={618} style={{ objectFit: "cover" }} alt="" />
          : <span className="animate-pulse motion-reduce:animate-none" style={{ width: 288, height: 618, background: t.badge }} />}
        <span style={{ ...badge, right: 18, color: "#fff", background: t.btn }}>{`#${rival.id} · ?`}</span>
      </div>
    </div>
  );
}

// A settled duel from the winner's side: their Chog and winnings, and the beaten opponent (art arrives greyed out from app/og).
export type WinCardProps = { won: string; unit: string; beat: string; result: string; art: string; chog?: string; vsArt: string; dark?: boolean };
export function WinCard({ won, unit, beat, result, art, chog, vsArt, dark }: WinCardProps) {
  const t = dark ? THEMES.dark : THEMES.light;
  const label = { fontFamily: mono, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: t.hi };
  const badge = { ...label, position: "absolute", left: 30, padding: "12px 18px", borderRadius: 12, fontSize: 24, letterSpacing: 2 } as const;
  return (
    <div style={{ display: "flex", width: 1200, height: 630, background: t.bg, color: t.fg, fontFamily: sans, fontWeight: 700 }}>
      <div style={{ display: "flex", position: "relative", width: 542, flexShrink: 0 }}>
        <img src={art} width={542} height={630} style={{ objectFit: "cover" }} alt="" />
        <span style={{ ...badge, top: 30, background: t.btn, color: "#fff" }}>WINNER</span>
        {chog && <span style={{ ...badge, bottom: 30, background: t.badge, color: t.fg }}>{`CHOG #${chog}`}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "50px 54px 50px 52px" }}>
        <span style={label}>CHOGXBET · CALLOUT SETTLED</span>
        <span style={{ fontFamily: mono, fontWeight: 600, fontSize: won.length > 6 ? 104 : 132, lineHeight: 1, marginTop: 24, color: t.fg }}>{`+${won}`}</span>
        <span style={{ ...label, fontSize: 34, letterSpacing: 1, marginTop: 22 }}>{`${unit.replace("$", "")} WON`}</span>
        <div style={{ display: "flex", alignItems: "center", marginTop: "auto", padding: 20, borderRadius: 20, background: t.panel }}>
          <img src={vsArt} width={104} height={104} style={{ borderRadius: 14, objectFit: "cover", flexShrink: 0 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, marginLeft: 24 }}>
            <span style={{ fontSize: 28 }}>{`Beat ${beat}`}</span>
            <span style={{ fontSize: 22, marginTop: 6, color: t.muted, lineHeight: 1.3 }}>{result}</span>
          </div>
          <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 22, letterSpacing: 1, color: "#D9445A", border: "2px solid #D9445A", borderRadius: 8, padding: "8px 14px", marginLeft: 16, flexShrink: 0 }}>REKT</span>
        </div>
      </div>
    </div>
  );
}
