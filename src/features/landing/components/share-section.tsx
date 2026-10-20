import { Container } from "@/components/ui/container";

const POINTS = ["Your win/loss record is on every card", "Open to anyone, or lock it to one wallet", "Unaccepted calls refund at the deadline"];

/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function ShareSection() {
  return (
    <section data-screen-label="Share" className="border-y border-[#ECE8F3] bg-white">
      <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-16 py-24 max-sm:py-14">
        <div className="w-full max-w-[500px] min-w-0 justify-self-center rounded-[18px] border border-[#ECE8F3] bg-[#FAF9FC] p-5">
          <div className="flex items-center gap-2.5">
            <img alt="Chog #1044" src="/chog-1044.png" className="size-10 shrink-0 rounded-full object-cover" />
            <div>
              <div className="text-[15px] font-semibold">chog1044</div>
              <div className="text-[13px] text-[#8E85A3]">@chog1044</div>
            </div>
          </div>
          <div className="mt-3 text-[16px] leading-[1.45]">BTC above $100k by Dec 31. 25k $CHOG on it. Anyone want to tell me I&apos;m wrong?</div>
          <div className="mt-3.5 overflow-hidden rounded-[14px] border border-[#ECE8F3] bg-white">
            <div className="bg-[#1A1130] p-[22px] text-white">
              <div className="flex justify-between font-mono text-[12px] font-medium text-[#B9A8FF]">
                <span>CHOGXBET · DUEL</span>
                <span>25,000 $CHOG</span>
              </div>
              <div className="mt-3.5 text-[26px] leading-[1.15] font-semibold tracking-[-.02em]">Chog #1044 says BTC &gt; $100,000 by Dec 31.</div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-[14px] text-[#C9C0E6]">Seat open for a challenger</span>
                <span className="rounded-full bg-[#A391FF] px-3 py-[7px] text-[13px] font-semibold text-[#140A2A]">Take the bet →</span>
              </div>
            </div>
            <div className="px-3.5 py-[9px] text-[13px] text-[#8E85A3]">conviction.chog.xyz/d/7f3k</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#6E56E8]">Built to be shared</div>
          <h2 className="mt-2.5 text-[44px] leading-[1.05] font-semibold tracking-[-.035em] text-balance">Your call unfurls as a card wherever you post it.</h2>
          <p className="mt-[18px] max-w-[460px] text-[17px] leading-[1.55] text-[#6B6185]">
            Drop the link on X, Discord, Telegram or anywhere else. The card shows your Chog, your claim and the stake. Anyone who clicks lands on the accept screen with their wallet ready.
          </p>
          <ul className="mt-7 flex list-none flex-col gap-3 p-0 text-[15px] text-[#4A4063]">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <span className="size-1.5 flex-none rounded-full bg-[#6E56E8]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
