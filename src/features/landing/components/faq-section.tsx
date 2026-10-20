const FAQ = [
  { q: "What do I need to play?", a: "A wallet on Monad holding at least one Chog and enough $CHOG to cover your stake plus gas." },
  { q: "Where does the burned $CHOG go?", a: "5% of every settled pot is sent to the dead address. It is permanent and visible on-chain." },
  { q: "What if nobody accepts my call?", a: "Your stake stays in escrow until the deadline, then it is refunded in full. Nothing is burned." },
  { q: "How is the price decided?", a: "Duels settle against an oracle price at the exact deadline you set when making the call." },
  { q: "Can I cancel a call?", a: "Yes, any time before someone accepts it." },
];

export default function FaqSection() {
  return (
    <section id="faq" data-screen-label="FAQ" className="scroll-mt-[100px] border-t border-[#ECE8F3] bg-white">
      <div className="mx-auto max-w-[820px] px-6 py-[88px] max-sm:py-14">
        <h2 className="text-[40px] leading-[1.05] font-semibold tracking-[-.035em]">Questions</h2>
        <div className="mt-8 border-t border-[#ECE8F3]">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="border-b border-[#ECE8F3] py-5">
              <div className="text-[17px] font-semibold">{q}</div>
              <p className="mt-2 text-[15px] leading-[1.6] text-[#6B6185]">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
