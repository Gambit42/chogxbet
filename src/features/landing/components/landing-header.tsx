/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function LandingHeader() {
    return (<header className="landing-header" style={{ "position": "sticky", "top": "0", "zIndex": "10", "background": "rgba(255,255,255,.9)", "backdropFilter": "blur(10px)", "borderBottom": "1px solid #ECE8F3" }}>
  <div style={{ "maxWidth": "1200px", "margin": "0 auto", "padding": "14px 24px", "display": "flex", "alignItems": "center", "gap": "32px" }}>
    <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontWeight": "600", "fontSize": "16px" }}><img alt="ChogXBet logo" src="/chog-logo.png" style={{ "width": "64px", "height": "64px", "borderRadius": "14px", "flexShrink": "0" }}/>ChogXBet</div>
    <nav aria-label="Main navigation" style={{ "display": "flex", "gap": "24px", "fontSize": "14px" }}><a href="#how" style={{ "color": "#6B6185" }}>How it works</a><a href="#burn" style={{ "color": "#6B6185" }}>The burn</a><a href="#duels" style={{ "color": "#6B6185" }}>Live duels</a><a href="#faq" style={{ "color": "#6B6185" }}>FAQ</a></nav>
    <div style={{ "marginLeft": "auto", "display": "flex", "gap": "10px" }}><a href="https://nad.fun/tokens/0x350035555E10d9AfAF1566AaebfCeD5BA6C27777" style={{ "padding": "9px 14px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "14px" }}>Get $Chog</a><button type="button" disabled title="App coming soon" style={{ "padding": "9px 16px", "borderRadius": "8px", "background": "#6E56E8", "color": "#fff", "fontWeight": "600", "fontSize": "14px" }}>App coming soon</button></div>
  </div>
    </header>);
}
