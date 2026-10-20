import { Container } from "@/components/ui/container";
export default function BurnSection() {
    return (<Container as="section" id="burn" data-screen-label="The burn" style={{ "paddingTop": "96px", "paddingBottom": "96px", "display": "grid", "gridTemplateColumns": "repeat(auto-fit,minmax(min(100%,420px),1fr))", "gap": "64px", "alignItems": "center" }}>
  <div>
    <div style={{ "fontSize": "14px", "fontWeight": "600", "color": "#6E56E8" }}>The burn</div>
    <h2 style={{ "margin": "10px 0 0", "font": "600 44px/1.05 var(--font-geist)", "letterSpacing": "-.035em", "textWrap": "balance" }}>Every duel takes $CHOG out of circulation.</h2>
    <p style={{ "margin": "18px 0 0", "maxWidth": "460px", "fontSize": "17px", "lineHeight": "1.55", "color": "#6B6185" }}>When a duel settles, 5% of the pot is burned. The other 95% goes to the winner. Calls nobody accepts are refunded in full.</p>
  </div>
  <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "18px", "background": "#fff", "padding": "28px" }}>
    <div style={{ "display": "flex", "justifyContent": "space-between", "fontSize": "14px", "color": "#6B6185" }}><span>Example pot</span><span style={{ "fontFamily": "var(--font-geist-mono)", "color": "#1A1130" }}>50,000 $CHOG</span></div>
    <div style={{ "display": "flex", "height": "14px", "marginTop": "18px", "borderRadius": "7px", "overflow": "hidden", "gap": "3px" }}><div style={{ "flex": "95", "background": "#6E56E8" }}></div><div style={{ "flex": "5", "background": "#F0647A" }}></div></div>
    <div style={{ "display": "flex", "flexDirection": "column", "gap": "14px", "marginTop": "22px", "fontSize": "15px" }}>
      <div style={{ "display": "flex", "alignItems": "center", "gap": "10px" }}><span style={{ "width": "10px", "height": "10px", "borderRadius": "3px", "background": "#6E56E8" }}></span>Winner<span style={{ "marginLeft": "auto", "fontFamily": "var(--font-geist-mono)" }}>47,500</span><span style={{ "width": "44px", "textAlign": "right", "color": "#8E85A3", "fontFamily": "var(--font-geist-mono)", "fontSize": "13px" }}>95%</span></div>
      <div style={{ "display": "flex", "alignItems": "center", "gap": "10px" }}><span style={{ "width": "10px", "height": "10px", "borderRadius": "3px", "background": "#F0647A" }}></span>Burned<span style={{ "marginLeft": "auto", "fontFamily": "var(--font-geist-mono)" }}>2,500</span><span style={{ "width": "44px", "textAlign": "right", "color": "#8E85A3", "fontFamily": "var(--font-geist-mono)", "fontSize": "13px" }}>5%</span></div>
    </div>
    <div style={{ "marginTop": "22px", "paddingTop": "18px", "borderTop": "1px solid #ECE8F3", "font": "400 13px var(--font-geist-mono)", "color": "#8E85A3" }}>Burn address 0x000…dEaD · verifiable on MonadScan</div>
  </div>
    </Container>);
}
