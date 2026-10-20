import { Container } from "@/components/ui/container";
export default function CtaSection() {
  return (
    <section data-screen-label="CTA" className="bg-white px-6 pb-[88px] max-sm:pb-14">
      <Container className="flex flex-wrap items-center justify-between gap-8 rounded-3xl bg-[#1A1130] py-16 text-white max-sm:py-8">
        <div>
          <h2 className="text-[44px] leading-[1.05] font-semibold tracking-[-.035em]">Got a take? Stake it.</h2>
          <p className="mt-3 text-[17px] text-[#C9C0E6]">Connect a wallet holding a Chog and $CHOG to start.</p>
        </div>
        <a href="/app" className="rounded-[10px] bg-[#A391FF] px-6 py-[15px] text-[16px] font-semibold text-[#140A2A]">Launch app</a>
      </Container>
    </section>
  );
}
