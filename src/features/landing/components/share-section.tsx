import { Container } from "@/components/ui/container";
/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function ShareSection() {
    return (<section data-screen-label="Share" style={{ "background": "#fff", "borderTop": "1px solid #ECE8F3", "borderBottom": "1px solid #ECE8F3" }}>
  <Container style={{ "paddingTop": "96px", "paddingBottom": "96px", "display": "grid", "gridTemplateColumns": "repeat(auto-fit,minmax(min(100%,420px),1fr))", "gap": "64px", "alignItems": "center" }}>
    <div style={{ "background": "#FAF9FC", "border": "1px solid #ECE8F3", "borderRadius": "18px", "padding": "20px", "maxWidth": "500px", "width": "100%", "justifySelf": "center" }}>
      <div style={{ "display": "flex", "gap": "10px", "alignItems": "center" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "40px", "height": "40px", "borderRadius": "50%" }}/><div><div style={{ "fontWeight": "600", "fontSize": "15px" }}>chog1044</div><div style={{ "fontSize": "13px", "color": "#8E85A3" }}>@chog1044</div></div></div>
      <div style={{ "marginTop": "12px", "fontSize": "16px", "lineHeight": "1.45" }}>BTC above $100k by Dec 31. 25k $CHOG on it. Anyone want to tell me I&apos;m wrong?</div>
      <div style={{ "marginTop": "14px", "border": "1px solid #ECE8F3", "borderRadius": "14px", "overflow": "hidden", "background": "#fff" }}>
        <div style={{ "padding": "22px", "background": "#1A1130", "color": "#fff" }}>
          <div style={{ "display": "flex", "justifyContent": "space-between", "font": "500 12px var(--font-geist-mono)", "color": "#B9A8FF" }}><span>CHOGXBET · DUEL</span><span>25,000 $CHOG</span></div>
          <div style={{ "marginTop": "14px", "font": "600 26px/1.15 var(--font-geist)", "letterSpacing": "-.02em" }}>Chog #1044 says BTC &gt; $100,000 by Dec 31.</div>
          <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "marginTop": "20px" }}><span style={{ "fontSize": "14px", "color": "#C9C0E6" }}>Seat open for a challenger</span><span style={{ "padding": "7px 12px", "borderRadius": "999px", "background": "#A391FF", "color": "#140A2A", "fontSize": "13px", "fontWeight": "600" }}>Take the bet →</span></div>
        </div>
        <div style={{ "padding": "9px 14px", "fontSize": "13px", "color": "#8E85A3" }}>conviction.chog.xyz/d/7f3k</div>
      </div>
    </div>
    <div>
      <div style={{ "fontSize": "14px", "fontWeight": "600", "color": "#6E56E8" }}>Built to be shared</div>
      <h2 style={{ "margin": "10px 0 0", "font": "600 44px/1.05 var(--font-geist)", "letterSpacing": "-.035em", "textWrap": "balance" }}>Your call unfurls as a card on X.</h2>
      <p style={{ "margin": "18px 0 0", "maxWidth": "460px", "fontSize": "17px", "lineHeight": "1.55", "color": "#6B6185" }}>Each duel shows your Chog, your claim and the stake. Anyone who clicks lands on the accept screen with their wallet ready.</p>
      <div style={{ "display": "flex", "flexDirection": "column", "gap": "12px", "marginTop": "28px", "fontSize": "15px", "color": "#4A4063" }}>
        <div style={{ "display": "flex", "gap": "10px", "alignItems": "center" }}><span style={{ "width": "6px", "height": "6px", "borderRadius": "50%", "background": "#6E56E8", "flex": "none" }}></span>Your win/loss record is on every card</div>
        <div style={{ "display": "flex", "gap": "10px", "alignItems": "center" }}><span style={{ "width": "6px", "height": "6px", "borderRadius": "50%", "background": "#6E56E8", "flex": "none" }}></span>Open to anyone, or lock it to one wallet</div>
        <div style={{ "display": "flex", "gap": "10px", "alignItems": "center" }}><span style={{ "width": "6px", "height": "6px", "borderRadius": "50%", "background": "#6E56E8", "flex": "none" }}></span>Unaccepted calls refund at the deadline</div>
      </div>
    </div>
  </Container>
    </section>);
}
