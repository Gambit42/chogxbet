import { Bookmark, ChartNoAxesColumn, Heart, Image as ImageIcon, MessageCircle, Repeat2, Share, Smile, X } from "lucide-react";
import { Container } from "@/components/ui/container";

// The attached card is the real /og image; change these params to change both the hero and what X unfurls.
const card = {
  title: "$MON ≥ $1.50",
  sub: "by Dec 31",
  stake: "25K $CHOG",
};
const stats = [
  { Icon: MessageCircle, n: "41" },
  { Icon: Repeat2, n: "96" },
  { Icon: Heart, n: "530" },
  { Icon: ChartNoAxesColumn, n: "4.8K" },
];

/* eslint-disable @next/next/no-img-element -- Preserve the supplied artwork at its original dimensions. */
export default function HeroSection() {
  return (
    <Container
      as="section"
      data-screen-label="Hero"
      className="grid min-h-[calc(100svh-69px)] grid-cols-1 content-center items-center gap-12 py-4 max-sm:py-12 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,600px)]"
    >
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ECE8F3] bg-white py-1.5 pr-3 pl-2 text-[13px] text-[#6B6185]">
          <span className="flex items-center gap-1.5 rounded-full bg-[#FDF5E6] px-2 py-0.5 font-semibold text-[#9A6412]">
            <span aria-hidden className="size-1.5 rounded-full bg-[#E8A33D]" />
            Monad Testnet
          </span>
          1v1 price duels in MON or $CHOG
        </span>
        <h1 className="mt-6 text-[clamp(40px,5vw,64px)] leading-none font-semibold tracking-[-.045em] text-balance">Bullpost with conviction.</h1>
        <p className="mt-[22px] max-w-[460px] text-[19px] leading-normal text-pretty text-[#6B6185]">
          Call your $MON target, stake $CHOG on it, and let another Chog take the other side. One wins the pot, but we&apos;re all rooting for Monad.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5 text-[16px]">
          <a href="/app/create" className="rounded-[10px] bg-[#6E56E8] px-[22px] py-3.5 font-semibold text-white">Make a call</a>
          <a href="/app" className="rounded-[10px] border border-[#DCD5EC] bg-white px-[22px] py-3.5 font-medium">Browse open duels</a>
        </div>
      </div>
      <div className="w-full max-w-[600px] justify-self-center rounded-[22px] border border-[#ECE8F3] bg-white px-5 py-[18px] text-[15px] shadow-[0_30px_60px_-30px_rgba(40,20,90,.3)]">
        <div className="flex items-center gap-2.5">
          <img alt="" src="/chog-111.webp" className="size-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0 leading-[1.3]">
            <div>
              <b>chog111</b> <span className="text-[#8E85A3]">@chog111 · Oct 19</span>
            </div>
            $MON is hitting $1 before the year ends. not even a debate
          </div>
          <span className="ml-auto self-start rounded-full bg-[#1A1130] px-3.5 py-[5px] text-[13px] font-semibold text-white">Follow</span>
        </div>
        <div className="mt-2.5 flex justify-between border-y border-[#ECE8F3] py-1.5 text-[13px] text-[#8E85A3]">
          {stats.map(({ Icon, n }) => (
            <span key={n} className="flex items-center gap-[5px]">
              <Icon size={16} aria-hidden />
              {n}
            </span>
          ))}
          <span className="flex gap-3">
            <Bookmark size={16} aria-hidden />
            <Share size={16} aria-hidden />
          </span>
        </div>
        <div className="mt-3 flex gap-2.5">
          <img alt="" src="/chog-1044.png" className="size-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="pt-2.5">
              <span className="text-[#6E56E8]">@chog111</span> $1? that&apos;s the floor ser. 25k $CHOG says $1.50
            </div>
            <div className="relative mt-2.5 overflow-hidden rounded-2xl border border-[#ECE8F3]">
              <img alt={`${card.title} ${card.sub}, ${card.stake} duel`} src={`/og?${new URLSearchParams(card)}`} width={1200} height={630} className="block h-auto w-full" />
              <span className="absolute top-2 right-2 grid size-[26px] place-items-center rounded-full bg-[rgba(15,10,30,.75)] text-white">
                <X size={14} aria-hidden />
              </span>
              <span className="absolute bottom-2 left-2.5 rounded bg-black/77 px-1.5 py-0.5 text-[12px] text-white">1v1 duel · 25K $CHOG</span>
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3.5 border-t border-[#ECE8F3] pt-2.5 text-[#6E56E8]">
          <ImageIcon size={18} aria-hidden />
          <Smile size={18} aria-hidden />
          <span className="ml-auto rounded-full bg-[#6E56E8] px-4 py-[7px] text-[14px] font-semibold text-white">Post</span>
        </div>
      </div>
    </Container>
  );
}
