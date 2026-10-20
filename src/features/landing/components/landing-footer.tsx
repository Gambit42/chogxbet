import { Container } from "@/components/ui/container";
/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function LandingFooter() {
  return (
    <footer className="border-t border-[#ECE8F3] bg-[#FAF9FC]">
      <Container className="flex flex-wrap items-center gap-6 py-7 text-[14px] text-[#8E85A3]">
        <span className="flex items-center gap-2 font-semibold text-[#1A1130]">
          <img alt="ChogXBet logo" src="/chog-logo.png" className="size-12 shrink-0 rounded-xl" />
          ChogXBet
        </span>
        <a href="https://x.com/ChogNFT" className="text-[#6B6185]">X</a>
        <a href="https://discord.com/invite/chog" className="text-[#6B6185]">Discord</a>
        <a href="https://mint.chog.xyz/" className="text-[#6B6185]">Chog Mint</a>
        <span className="ml-auto max-sm:ml-0 max-sm:w-full">Not financial advice. Only stake what you can lose.</span>
      </Container>
    </footer>
  );
}
