import LandingHeader from "./components/landing-header";
import HeroSection from "./components/hero-section";
import HowItWorksSection from "./components/how-it-works-section";
import BurnSection from "./components/burn-section";
import ShareSection from "./components/share-section";
import LiveDuelsSection from "./components/live-duels-section";
import FaqSection from "./components/faq-section";
import CtaSection from "./components/cta-section";
import LandingFooter from "./components/landing-footer";
import "./landing.css";

export default function LandingPage() {
  return (
    <div className="landing">
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <BurnSection />
        <ShareSection />
        <LiveDuelsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
