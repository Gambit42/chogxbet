import { Container } from "@/components/ui/container";
export default function CtaSection() {
    return (<section data-screen-label="CTA" style={{ "padding": "0 24px 88px", "background": "#fff" }}>
  <Container style={{ "paddingTop": "64px", "paddingBottom": "64px", "borderRadius": "24px", "background": "#1A1130", "color": "#fff", "display": "flex", "justifyContent": "space-between", "alignItems": "center", "gap": "32px", "flexWrap": "wrap" }}>
    <div><h2 style={{ "margin": "0", "font": "600 44px/1.05 var(--font-geist)", "letterSpacing": "-.035em" }}>Got a take? Stake it.</h2><p style={{ "margin": "12px 0 0", "fontSize": "17px", "color": "#C9C0E6" }}>Connect a wallet holding a Chog and $CHOG to start.</p></div>
    <a href="/app" style={{ "padding": "15px 24px", "borderRadius": "10px", "background": "#A391FF", "color": "#140A2A", "fontWeight": "600", "fontSize": "16px" }}>Launch app</a>
  </Container>
    </section>);
}
