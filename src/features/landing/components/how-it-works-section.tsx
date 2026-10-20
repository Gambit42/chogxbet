import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

const chip = "rounded-[7px] px-2.5 py-[5px]";

const STEPS: { title: string; body: string; demo: ReactNode }[] = [
  {
    title: "Make your call",
    body: "Pick an asset, a target and a deadline. Your $CHOG stake goes into escrow on-chain.",
    demo: (
      <div className="flex flex-wrap gap-1.5 text-[14px]">
        <span className={`${chip} bg-[#F1EEFB] font-semibold`}>BTC</span>
        <span className={`${chip} bg-[#E3F6EC] font-semibold text-[#1A8A55]`}>above</span>
        <span className={`${chip} bg-[#F1EEFB] font-mono`}>$100,000</span>
        <span className={`${chip} bg-[#F1EEFB] font-semibold`}>Dec 31</span>
      </div>
    ),
  },
  {
    title: "Share the link",
    body: "Post it on X or in Discord. The first wallet to match your stake takes the other side.",
    demo: (
      <div className="flex items-center gap-2 rounded-[10px] border border-[#ECE8F3] bg-white px-3 py-2.5 font-mono text-[13px] text-[#6B6185]">
        <span className="flex-1">conviction.chog.xyz/d/7f3k</span>
        <span className="font-sans font-semibold text-[#6E56E8]">Copy</span>
      </div>
    ),
  },
  {
    title: "The clock settles it",
    body: "At the deadline the oracle price decides. The winner is paid out and the burn is sent to the dead address.",
    demo: (
      <div className="flex items-center justify-between rounded-[10px] bg-[#E3F6EC] px-3 py-2.5 text-[14px] text-[#1A8A55]">
        <span className="font-semibold">Chog #1044 won</span>
        <span className="font-mono">+47,500 $CHOG</span>
      </div>
    ),
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how" data-screen-label="How it works" className="scroll-mt-[100px] border-y border-[#ECE8F3] bg-white">
      <Container className="py-[88px] max-sm:py-14">
        <div className="text-[14px] font-semibold text-[#6E56E8]">How it works</div>
        <h2 className="mt-2.5 max-w-[620px] text-[44px] leading-[1.05] font-semibold tracking-[-.035em]">From hot take to settled bet in three steps.</h2>
        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-[#ECE8F3] bg-[#FAF9FC] p-6">
              <div className="font-mono text-[13px] font-medium text-[#8E85A3]">0{i + 1}</div>
              <div className="mt-3 text-[20px] font-semibold">{s.title}</div>
              <p className="mt-2 text-[15px] leading-[1.55] text-[#6B6185]">{s.body}</p>
              <div className="mt-[22px]">{s.demo}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
