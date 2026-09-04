import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Footer, FloatingWhatsAppButton } from "@/components/site/sections";

const policyItems = [
  {
    num: "01",
    title: "Payment Terms",
    content:
      "70% advance payment is required to start the project. The remaining 30% balance payment is payable before final delivery.",
  },
  {
    num: "02",
    title: "Script Approval",
    content:
      "Production begins after final script/concept approval. Changes after approval may incur additional charges.",
  },
  {
    num: "03",
    title: "Changes",
    content:
      "Changes within the approved concept are allowed. Major changes to the script, concept, visuals, or duration may be charged separately.",
  },
  {
    num: "04",
    title: "Revision",
    content:
      "1 revision is included in the standard package. Additional revisions or major changes may incur extra charges.",
  },
  {
    num: "05",
    title: "Delivery",
    content:
      "Standard delivery is 48–72 working hours after payment, script approval, and receipt of all required materials. Client delays may extend the timeline.",
  },
  {
    num: "06",
    title: "Client Materials",
    content:
      "The client must provide accurate materials and ensure they have the necessary rights and permissions to use them.",
  },
  {
    num: "07",
    title: "Refund",
    content:
      "Payments may be non-refundable once production has started. Any eligible refund will be considered based on the project stage and agreed terms.",
  },
  {
    num: "08",
    title: "Additional Charges",
    content:
      "Extra charges may apply for additional revisions, major changes, longer videos, extra scenes, premium AI tools, voice cloning, digital twins, or urgent delivery.",
  },
  {
    num: "09",
    title: "Final Delivery",
    content:
      "The final video will be delivered after completion of the agreed scope and applicable payment. Changes requested after final approval may be chargeable.",
  },
  {
    num: "10",
    title: "AI Variations",
    content:
      "AI-generated content may have minor visual or audio variations, and exact replication cannot always be guaranteed. Clients must review and approve the final output before use.",
  },
];

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms, Privacy & Policy Guidelines | Quickupp AI Studio" },
      {
        name: "description",
        content:
          "Official Terms, Conditions and Policy Guidelines for Quickupp AI Studio video production services.",
      },
    ],
  }),
  component: TermsPage,
});

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-neon selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link
            to="/"
            className="-ml-3 sm:-ml-5 flex items-center transition-opacity hover:opacity-90"
          >
            <img
              src="/images/logo.png"
              alt="Quickupp AI Studio logo"
              className="h-9 md:h-10 w-auto object-contain"
              width={125}
              height={40}
            />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/50 px-4 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-neon hover:text-neon sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area - Full-Width 2-Column Split */}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:py-14">
        {/* Document Header */}
        <div className="border-b border-border/60 pb-7">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-neon" />
            Policy &amp; Guidelines
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Terms, Conditions &amp;{" "}
            <span className="font-serif italic text-gradient-brand inline-block pr-1.5">
              Privacy Policy
            </span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Please review the following terms, operational policies, and guidelines applicable to
            all AI video production services provided by Quickupp AI Studio.
          </p>
        </div>

        {/* 2-Column Responsive Grid Layout (Clean & Open without Cards) */}
        <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2 lg:gap-x-16">
          {policyItems.map((item) => (
            <article
              key={item.num}
              className="group flex items-start gap-4 sm:gap-5 border-l-2 border-border/60 pl-4 sm:pl-5 transition-colors hover:border-neon"
            >
              <span className="shrink-0 text-xl font-bold font-mono text-neon tracking-tight sm:text-2xl">
                {item.num}
              </span>
              <div className="space-y-1.5">
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {item.title}
                </h2>
                <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground group-hover:text-foreground/90 transition-colors">
                  {item.content}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom Help Notice */}
        <div className="mt-14 rounded-2xl border border-border/70 bg-surface/30 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                Have questions about these terms or a custom project?
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Our team is available to clarify any project requirements, custom scopes, or
                turnaround schedules.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <a
                href="https://wa.me/919172785916?text=Hi%20Quickupp%20AI%20Studio%2C%20I%20have%20a%20question%20regarding%20the%20Terms%20and%20Policies."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-xs font-bold text-neon-foreground shadow-md transition-all hover:brightness-110 sm:text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition-all hover:border-neon hover:text-neon sm:text-sm"
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsAppButton />
    </div>
  );
}
