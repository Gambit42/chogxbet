import { Container } from "@/components/ui/container";
/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function LiveDuelsSection() {
    return (<Container as="section" id="duels" data-screen-label="Live duels" style={{ "paddingTop": "88px", "paddingBottom": "88px" }}>
  <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "flex-end", "gap": "24px", "flexWrap": "wrap" }}><div><div style={{ "fontSize": "14px", "fontWeight": "600", "color": "#6E56E8" }}>Live now</div><h2 style={{ "margin": "10px 0 0", "font": "600 44px/1.05 var(--font-geist)", "letterSpacing": "-.035em" }}>Calls waiting for a challenger</h2></div><a href="/app" style={{ "fontWeight": "600", "fontSize": "15px" }}>See all in app →</a></div>
  <div style={{ "display": "grid", "gridTemplateColumns": "repeat(auto-fill,minmax(min(100%,340px),1fr))", "gap": "16px", "marginTop": "40px" }}>
    
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "20px", "background": "#fff", "display": "flex", "flexDirection": "column", "gap": "16px" }}>
        <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontSize": "14px" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "30px", "height": "30px", "borderRadius": "8px" }}/><span style={{ "fontWeight": "600" }}>Chog #232</span><span style={{ "marginLeft": "auto", "font": "400 12px var(--font-geist-mono)", "color": "#8E85A3" }}>21h left</span></div>
        <div style={{ "font": "600 20px/1.3 var(--font-geist)", "letterSpacing": "-.01em", "textWrap": "pretty" }}>“MON touches $0.05 before Oct 20”</div>
        <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingTop": "14px", "borderTop": "1px solid #ECE8F3" }}><span style={{ "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}>10,000 $CHOG</span><a href="/app" style={{ "padding": "8px 12px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "13px" }}>Take the other side</a></div>
      </div>
    
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "20px", "background": "#fff", "display": "flex", "flexDirection": "column", "gap": "16px" }}>
        <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontSize": "14px" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "30px", "height": "30px", "borderRadius": "8px" }}/><span style={{ "fontWeight": "600" }}>Chog #88</span><span style={{ "marginLeft": "auto", "font": "400 12px var(--font-geist-mono)", "color": "#8E85A3" }}>3d left</span></div>
        <div style={{ "font": "600 20px/1.3 var(--font-geist)", "letterSpacing": "-.01em", "textWrap": "pretty" }}>“ETH closes under $3,000 Friday”</div>
        <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingTop": "14px", "borderTop": "1px solid #ECE8F3" }}><span style={{ "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}>25,000 $CHOG</span><a href="/app" style={{ "padding": "8px 12px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "13px" }}>Take the other side</a></div>
      </div>
    
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "20px", "background": "#fff", "display": "flex", "flexDirection": "column", "gap": "16px" }}>
        <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontSize": "14px" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "30px", "height": "30px", "borderRadius": "8px" }}/><span style={{ "fontWeight": "600" }}>Chog #1710</span><span style={{ "marginLeft": "auto", "font": "400 12px var(--font-geist-mono)", "color": "#8E85A3" }}>5d left</span></div>
        <div style={{ "font": "600 20px/1.3 var(--font-geist)", "letterSpacing": "-.01em", "textWrap": "pretty" }}>“SOL above $200 by end of week”</div>
        <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingTop": "14px", "borderTop": "1px solid #ECE8F3" }}><span style={{ "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}>5,000 $CHOG</span><a href="/app" style={{ "padding": "8px 12px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "13px" }}>Take the other side</a></div>
      </div>
    
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "20px", "background": "#fff", "display": "flex", "flexDirection": "column", "gap": "16px" }}>
        <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontSize": "14px" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "30px", "height": "30px", "borderRadius": "8px" }}/><span style={{ "fontWeight": "600" }}>Chog #401</span><span style={{ "marginLeft": "auto", "font": "400 12px var(--font-geist-mono)", "color": "#8E85A3" }}>12d left</span></div>
        <div style={{ "font": "600 20px/1.3 var(--font-geist)", "letterSpacing": "-.01em", "textWrap": "pretty" }}>“BTC dips below $90,000 this month”</div>
        <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingTop": "14px", "borderTop": "1px solid #ECE8F3" }}><span style={{ "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}>50,000 $CHOG</span><a href="/app" style={{ "padding": "8px 12px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "13px" }}>Take the other side</a></div>
      </div>
    
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "20px", "background": "#fff", "display": "flex", "flexDirection": "column", "gap": "16px" }}>
        <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontSize": "14px" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "30px", "height": "30px", "borderRadius": "8px" }}/><span style={{ "fontWeight": "600" }}>Chog #9</span><span style={{ "marginLeft": "auto", "font": "400 12px var(--font-geist-mono)", "color": "#8E85A3" }}>12d left</span></div>
        <div style={{ "font": "600 20px/1.3 var(--font-geist)", "letterSpacing": "-.01em", "textWrap": "pretty" }}>“MON flips $0.06 by month end”</div>
        <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingTop": "14px", "borderTop": "1px solid #ECE8F3" }}><span style={{ "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}>15,000 $CHOG</span><a href="/app" style={{ "padding": "8px 12px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "13px" }}>Take the other side</a></div>
      </div>
    
      <div style={{ "border": "1px solid #ECE8F3", "borderRadius": "16px", "padding": "20px", "background": "#fff", "display": "flex", "flexDirection": "column", "gap": "16px" }}>
        <div style={{ "display": "flex", "alignItems": "center", "gap": "10px", "fontSize": "14px" }}><img alt="Chog #1044" src="/chog-1044.png" style={{ "width": "30px", "height": "30px", "borderRadius": "8px" }}/><span style={{ "fontWeight": "600" }}>Chog #1044</span><span style={{ "marginLeft": "auto", "font": "400 12px var(--font-geist-mono)", "color": "#8E85A3" }}>61d left</span></div>
        <div style={{ "font": "600 20px/1.3 var(--font-geist)", "letterSpacing": "-.01em", "textWrap": "pretty" }}>“BTC above $100,000 by Dec 31”</div>
        <div style={{ "display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingTop": "14px", "borderTop": "1px solid #ECE8F3" }}><span style={{ "font": "400 13px var(--font-geist-mono)", "color": "#6B6185" }}>25,000 $CHOG</span><a href="/app" style={{ "padding": "8px 12px", "borderRadius": "8px", "border": "1px solid #DCD5EC", "background": "#fff", "color": "#1A1130", "fontWeight": "500", "fontSize": "13px" }}>Take the other side</a></div>
      </div>
    
  </div>
    </Container>);
}
