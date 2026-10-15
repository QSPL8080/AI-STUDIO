import { useEffect } from "react";
import { IndiaCheckoutModal } from "@/components/site/india-checkout";
import { createFileRoute } from "@tanstack/react-router";
import {
  Contact,
  DigitalTwin,
  Faq,
  Footer,
  FloatingWhatsAppButton,
  Header,
  Hero,
  HeroOverview,
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

    // Arriving from another page with a section link (e.g. /#pricing from the footer):
    // go to that section; otherwise start at the top.
    const initialId = decodeURIComponent(window.location.hash.slice(1));
    if (initialId) {
      const go = () => document.getElementById(initialId)?.scrollIntoView({ behavior: "auto" });
      requestAnimationFrame(go);
      setTimeout(go, 400); // again after images / videos have settled the layout
    } else {
      window.scrollTo(0, 0);
    }

    // Smooth-scroll for "#section" and "/#section" links on this page.
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a[href^="#"], a[href^="/#"]');
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href === "#" || href === "/#") return;

      const targetId = href.slice(href.indexOf("#") + 1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", `#${targetId}`);
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  return (
    <div id="top" className="min-h-screen w-full overflow-x-clip bg-background text-foreground">
      <Header />
      <main id="main-content">
        <Hero />
        <HeroOverview />
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
      <IndiaCheckoutModal />
    </div>
  );
}
