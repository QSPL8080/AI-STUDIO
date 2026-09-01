import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Contact,
  DigitalTwin,
  Faq,
  Footer,
  FloatingWhatsAppButton,
  Header,
  Hero,
  Industries,
  LeadFormSection,
  Portfolio,
  Pricing,
  Process,
  QuotePopupModal,
  Samples,
  Services,
  TrustStrip,
  UseCases,
  WhatsAppCtaSection,
  WhyAiVideo,
  WhyUs,
} from "@/components/site/sections";

const title = "Quickupp AI Studio | AI Video Production, UGC & Digital Avatars";
const description =
  "Quickupp AI Studio provides professional AI video production services including AI UGC, AI avatar, cartoon, hyper-realistic and digital twin videos for businesses.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  // Ensure page always starts at top when loading/refreshing and handle smooth anchor clicks
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a[href^="#"]');
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href === "#") return;

      const targetId = href.slice(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", href);
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  return (
    <div id="top" className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Samples />
        <Services />
        <WhyAiVideo />
        <Pricing />
        <DigitalTwin />
        <Industries />
        <UseCases />
        <Process />
        <WhyUs />
        <Portfolio />
        <Faq />
        <WhatsAppCtaSection />
        <LeadFormSection />
        <Contact />
      </main>
      <Footer />
      <FloatingWhatsAppButton />
      <QuotePopupModal />
    </div>
  );
}
