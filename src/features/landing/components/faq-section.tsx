export default function FaqSection() {
    return (<section id="faq" data-screen-label="FAQ" style={{ "background": "#fff", "borderTop": "1px solid #ECE8F3" }}>
  <div style={{ "maxWidth": "820px", "margin": "0 auto", "padding": "88px 24px" }}>
    <h2 style={{ "margin": "0", "font": "600 40px/1.05 var(--font-geist)", "letterSpacing": "-.035em" }}>Questions</h2>
    <div style={{ "marginTop": "32px", "borderTop": "1px solid #ECE8F3" }}>
      
        <div style={{ "padding": "20px 0", "borderBottom": "1px solid #ECE8F3" }}><div style={{ "fontWeight": "600", "fontSize": "17px" }}>What do I need to play?</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.6", "color": "#6B6185" }}>A wallet on Monad holding at least one Chog and enough $CHOG to cover your stake plus gas.</p></div>
      
        <div style={{ "padding": "20px 0", "borderBottom": "1px solid #ECE8F3" }}><div style={{ "fontWeight": "600", "fontSize": "17px" }}>Where does the burned $CHOG go?</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.6", "color": "#6B6185" }}>5% of every settled pot is sent to the dead address. It is permanent and visible on-chain.</p></div>
      
        <div style={{ "padding": "20px 0", "borderBottom": "1px solid #ECE8F3" }}><div style={{ "fontWeight": "600", "fontSize": "17px" }}>What if nobody accepts my call?</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.6", "color": "#6B6185" }}>Your stake stays in escrow until the deadline, then it is refunded in full. Nothing is burned.</p></div>
      
        <div style={{ "padding": "20px 0", "borderBottom": "1px solid #ECE8F3" }}><div style={{ "fontWeight": "600", "fontSize": "17px" }}>How is the price decided?</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.6", "color": "#6B6185" }}>Duels settle against an oracle price at the exact deadline you set when making the call.</p></div>
      
        <div style={{ "padding": "20px 0", "borderBottom": "1px solid #ECE8F3" }}><div style={{ "fontWeight": "600", "fontSize": "17px" }}>Can I cancel a call?</div><p style={{ "margin": "8px 0 0", "fontSize": "15px", "lineHeight": "1.6", "color": "#6B6185" }}>Yes, any time before someone accepts it.</p></div>
      
    </div>
  </div>
    </section>);
}
