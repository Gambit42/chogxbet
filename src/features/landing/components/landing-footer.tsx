/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function LandingFooter() {
    return (<footer style={{ "borderTop": "1px solid #ECE8F3", "background": "#FAF9FC" }}>
  <div style={{ "maxWidth": "1200px", "margin": "0 auto", "padding": "28px 24px", "display": "flex", "alignItems": "center", "gap": "24px", "flexWrap": "wrap", "fontSize": "14px", "color": "#8E85A3" }}>
    <span style={{ "display": "flex", "alignItems": "center", "gap": "8px", "color": "#1A1130", "fontWeight": "600" }}><img alt="ChogXBet logo" src="/chog-logo.png" style={{ "width": "48px", "height": "48px", "borderRadius": "12px", "flexShrink": "0" }}/>ChogXBet</span>
    <a href="https://x.com/ChogNFT" style={{ "color": "#6B6185" }}>X</a><a href="https://discord.com/invite/chog" style={{ "color": "#6B6185" }}>Discord</a><a href="https://mint.chog.xyz/" style={{ "color": "#6B6185" }}>Chog Mint</a>
    <span style={{ "marginLeft": "auto" }}>Not financial advice. Only stake what you can lose.</span>
  </div>
    </footer>);
}
