import { Container } from "@/components/ui/container";
/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[#ECE8F3] bg-white/90 backdrop-blur-[10px]">
      {/* Same height as the app header (py-3 around the 40px logo), so moving between the two doesn't jump. */}
      <Container className="flex items-center gap-8 py-3 max-[900px]:flex-wrap max-[900px]:gap-4 max-sm:gap-2.5">
        <div className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-.01em]">
          <img alt="ChogXBet logo" src="/chog-logo.png" className="size-10 shrink-0 rounded-[10px]" />
          ChogXBet
        </div>
        <nav aria-label="Main navigation" className="flex gap-6 text-[15px] font-medium text-[#6B6185] max-[900px]:order-3 max-[900px]:w-full max-[900px]:flex-wrap max-[900px]:justify-center max-[900px]:gap-5">
          <a href="#how">How it works</a>
          <a href="#burn">The burn</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a href="/app" className="ml-auto rounded-lg bg-[#6E56E8] px-4 py-[9px] text-[14px] font-semibold text-white max-sm:px-2.5 max-sm:py-2">
          Launch app
        </a>
      </Container>
    </header>
  );
}
