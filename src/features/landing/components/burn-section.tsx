import { Container } from "@/components/ui/container";

const SPLIT = [
  { label: "Winner", amount: "47,500", pct: "95%", color: "bg-[#6E56E8]", grow: "flex-[95]" },
  { label: "Burned", amount: "2,500", pct: "5%", color: "bg-[#F0647A]", grow: "flex-[5]" },
];

export default function BurnSection() {
  return (
    <Container
      as="section"
      id="burn"
      data-screen-label="The burn"
      className="grid scroll-mt-[100px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-16 py-24 max-sm:py-14"
    >
      <div>
        <div className="text-[14px] font-semibold text-[#6E56E8]">The burn</div>
        <h2 className="mt-2.5 text-[44px] leading-[1.05] font-semibold tracking-[-.035em] text-balance">Every duel takes $CHOG out of circulation.</h2>
        <p className="mt-[18px] max-w-[460px] text-[17px] leading-[1.55] text-[#6B6185]">
          When a duel settles, 5% of the pot is burned. The other 95% goes to the winner. Calls nobody accepts are refunded in full.
        </p>
      </div>
      <div className="min-w-0 rounded-[18px] border border-[#ECE8F3] bg-white p-7">
        <div className="flex justify-between text-[14px] text-[#6B6185]">
          <span>Example pot</span>
          <span className="font-mono text-[#1A1130]">50,000 $CHOG</span>
        </div>
        <div className="mt-[18px] flex h-3.5 gap-[3px] overflow-hidden rounded-[7px]">
          {SPLIT.map((s) => <div key={s.label} className={`${s.grow} ${s.color}`} />)}
        </div>
        <div className="mt-[22px] flex flex-col gap-3.5 text-[15px]">
          {SPLIT.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <span className={`size-2.5 rounded-[3px] ${s.color}`} />
              {s.label}
              <span className="ml-auto font-mono">{s.amount}</span>
              <span className="w-11 text-right font-mono text-[13px] text-[#8E85A3]">{s.pct}</span>
            </div>
          ))}
        </div>
        <div className="mt-[22px] border-t border-[#ECE8F3] pt-[18px] font-mono text-[13px] text-[#8E85A3]">Burn address 0x000…dEaD · verifiable on MonadScan</div>
      </div>
    </Container>
  );
}
