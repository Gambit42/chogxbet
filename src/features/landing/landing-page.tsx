import LandingHeader from "./components/landing-header";
import HeroSection from "./components/hero-section";
import HowItWorksSection from "./components/how-it-works-section";
import BurnSection from "./components/burn-section";
import ShareSection from "./components/share-section";
import FaqSection from "./components/faq-section";
import CtaSection from "./components/cta-section";
import LandingFooter from "./components/landing-footer";

export default function LandingPage() {
  return (
    <div className="bg-[#faf9fc] font-sans leading-normal text-[#1a1130] antialiased [&_a:focus-visible]:outline-[3px] [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-[#6e56e8] [&_a:hover]:brightness-[.92]">
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <BurnSection />
        <ShareSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
