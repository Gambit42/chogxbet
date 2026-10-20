import { Container } from "@/components/ui/container";
export default function HowItWorksSection() {
    return (<section id="how" data-screen-label="How it works" style={{ "background": "#fff", "borderTop": "1px solid #ECE8F3", "borderBottom": "1px solid #ECE8F3" }}>
  <Container style={{ "paddingTop": "88px", "paddingBottom": "88px" }}>
    <div style={{ "fontSize": "14px", "fontWeight": "600", "color": "#6E56E8" }}>How it works</div>
    <h2 style={{ "margin": "10px 0 0", "maxWidth": "620px", "font": "600 44px/1.05 var(--font-geist)", "letterSpacing": "-.035em" }}>From hot take to settled bet in three steps.</h2>
    <div style={{ "display": "grid", "gridTemplateColumns": "repeat(auto-fit,minmax(280px,1fr))", "gap": "20px", "marginTop": "48px" }}>
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "24px", "background": "#FAF9FC" }}>
        <div style={{ "font": "500 13px var(--font-geist-mono)", "color": "#8E85A3" }}>01</div><div style={{ "marginTop": "12px", "fontWeight": "600", "fontSize": "20px" }}>Make your call</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.55", "color": "#6B6185" }}>Pick an asset, a target and a deadline. Your $CHOG stake goes into escrow on-chain.</p>
        <div style={{ "marginTop": "22px", "display": "flex", "flexWrap": "wrap", "gap": "6px", "fontSize": "14px" }}><span style={{ "padding": "5px 10px", "borderRadius": "7px", "background": "#F1EEFB", "fontWeight": "600" }}>BTC</span><span style={{ "padding": "5px 10px", "borderRadius": "7px", "background": "#E3F6EC", "color": "#1A8A55", "fontWeight": "600" }}>above</span><span style={{ "padding": "5px 10px", "borderRadius": "7px", "background": "#F1EEFB", "fontFamily": "var(--font-geist-mono)" }}>$100,000</span><span style={{ "padding": "5px 10px", "borderRadius": "7px", "background": "#F1EEFB", "fontWeight": "600" }}>Dec 31</span></div>
      </div>
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "24px", "background": "#FAF9FC" }}>
        <div style={{ "font": "500 13px var(--font-geist-mono)", "color": "#8E85A3" }}>02</div><div style={{ "marginTop": "12px", "fontWeight": "600", "fontSize": "20px" }}>Share the link</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.55", "color": "#6B6185" }}>Post it on X or in Discord. The first wallet to match your stake takes the other side.</p>
        <div style={{ "marginTop": "22px", "display": "flex", "alignItems": "center", "gap": "8px", "padding": "10px 12px", "border": "1px solid #ECE8F3", "borderRadius": "10px", "background": "#fff", "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}><span style={{ "flex": "1" }}>conviction.chog.xyz/d/7f3k</span><span style={{ "color": "#6E56E8", "fontFamily": "var(--font-geist)", "fontWeight": "600" }}>Copy</span></div>
      </div>
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "24px", "background": "#FAF9FC" }}>
        <div style={{ "font": "500 13px var(--font-geist-mono)", "color": "#8E85A3" }}>03</div><div style={{ "marginTop": "12px", "fontWeight": "600", "fontSize": "20px" }}>The clock settles it</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.55", "color": "#6B6185" }}>At the deadline the oracle price decides. The winner is paid out and the burn is sent to the dead address.</p>
        <div style={{ "marginTop": "22px", "display": "flex", "justifyContent": "space-between", "alignItems": "center", "padding": "10px 12px", "borderRadius": "10px", "background": "#E3F6EC", "fontSize": "14px" }}><span style={{ "color": "#1A8A55", "fontWeight": "600" }}>Chog #1044 won</span><span style={{ "fontFamily": "var(--font-geist-mono)", "color": "#1A8A55" }}>+47,500 $CHOG</span></div>
      </div>
    </div>
  </Container>
    </section>);
}
