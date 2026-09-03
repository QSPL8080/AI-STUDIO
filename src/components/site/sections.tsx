import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BadgeCheck,
  Bot,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Film,
  MapPin,
  Mail,
  Menu,
  MessageCircle,
  Palette,
  Pause,
  Phone,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  UserCheck,
  Video,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { NeonButton, Section, SectionHeading } from "./ui";
import { submitLeadServerFn } from "@/lib/lead-actions";
import {
  deliverables,
  faqs,
  formats,
  footerCopyright,
  footerDescription,
  footerEmail,
  footerIndiaAddress,
  footerIndiaMapUrl,
  footerPhone,
  footerTagline,
  footerUsaAddress,
  footerUsaMapUrl,
  heroBadges,
  industries,
  nav,
  pricingRows,
  processSteps,
  portfolioItems,
  samples,
  services,
  twinFeatures,
  useCases,
  whyAiVideo,
  whyUs,
} from "./data";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [isLogoDocked, setIsLogoDocked] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroTrack = document.getElementById("hero-scroll-track");
      if (!heroTrack) {
        setIsLogoDocked(true);
        return;
      }
      const rect = heroTrack.getBoundingClientRect();
      const scrollableDistance = heroTrack.offsetHeight - window.innerHeight;
      if (scrollableDistance <= 0) {
        setIsLogoDocked(true);
        return;
      }
      const scrolled = -rect.top;
      const progress = scrolled / scrollableDistance;
      setIsLogoDocked(progress >= 0.94);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <header id="site-nav-container" className="fixed top-0 left-0 right-0 z-50 flex flex-col">
      {/* Top Highlight Announcement Bar */}
      {showAnnouncement && (
        <div className="relative border-b border-white/15 bg-gradient-to-r from-[#7c22e8] via-[#a832e6] to-[#ec1e79] px-3 py-1.5 sm:py-2 text-white shadow-[0_2px_15px_rgba(168,50,230,0.4)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 text-xs md:text-sm font-medium">
            {/* Mobile Layout (Compact Single Row) */}
            <div className="flex flex-1 items-center justify-center gap-2 sm:hidden text-center">
              <span className="flex items-center gap-1 font-semibold text-[11.5px] leading-tight">
                <Sparkles className="h-3 w-3 text-amber-300 shrink-0 fill-amber-300/40" />
                <span>Save up to</span>
                <span className="rounded bg-black/35 px-1 py-0.2 font-extrabold text-amber-300 border border-amber-300/40 text-[11px]">
                  20% OFF
                </span>
                <span>on AI Packages!</span>
              </span>
              <a
                href="#pricing"
                className="inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-0.5 text-[10.5px] font-bold text-[#6b1cb0] shadow-sm active:scale-95 whitespace-nowrap"
              >
                <span>Plans</span>
                <span className="text-[10px]">→</span>
              </a>
            </div>

            {/* Desktop / Tablet Layout (Full SEO Row) */}
            <div className="hidden sm:flex flex-1 items-center justify-center gap-2.5 text-center flex-nowrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/40 shadow-sm whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0 fill-amber-300/30 animate-pulse" />
                <span>Special Offer</span>
              </span>

              <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                Get up to{" "}
                <strong className="font-extrabold text-amber-300 underline decoration-amber-400/60 decoration-2 underline-offset-2">
                  20% OFF
                </strong>{" "}
                on Professional AI Video Production & Avatar Packages!
              </span>

              <a
                href="#pricing"
                className="group inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-[#6b1cb0] shadow-md transition-all hover:bg-amber-300 hover:text-black hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                <span>View Packages</span>
                <span className="transition-transform duration-200 group-hover:translate-x-0.5 text-[12px]">
                  →
                </span>
              </a>
            </div>

            {/* Dismiss Announcement Button */}
            <button
              type="button"
              onClick={() => setShowAnnouncement(false)}
              className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-black/20 text-white/90 border border-white/20 transition-all hover:bg-white hover:text-black"
              aria-label="Dismiss announcement"
            >
              <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 md:py-3.5">
          <a
            href="#top"
            id="navbar-logo-anchor"
            className="-ml-3 sm:-ml-5 flex items-center transition-opacity hover:opacity-90"
            aria-label="Quickupp AI Studio Home"
          >
            <img
              src="/images/logo.png"
              alt="Quickupp AI Studio logo"
              className="h-8 sm:h-9 md:h-10 w-auto object-contain"
              width={125}
              height={40}
            />
          </a>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Main Navigation"
            className="hidden items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5 py-1.5 lg:flex"
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-white/10 hover:text-foreground active:scale-95"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right CTA */}
          <div className="flex items-center gap-3">
            <NeonButton
              href="#contact"
              variant="primary"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Get AI Video Quote
            </NeonButton>

            {/* Mobile / Tablet Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary/50 text-foreground transition-colors hover:border-neon hover:text-neon lg:hidden"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Navigation Menu Dropdown */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="border-b border-border/70 bg-[#0c0919]/98 px-5 py-5 shadow-2xl backdrop-blur-2xl lg:hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="mx-auto flex max-w-md flex-col gap-1.5">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground/90 transition-colors hover:bg-white/[0.05] hover:text-neon"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-neon/60">→</span>
                </a>
              ))}

              <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-4">
                <a
                  href="#contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-full bg-gradient-brand py-2.5 text-sm font-bold text-neon-foreground shadow-md"
                >
                  Get AI Video Quote
                </a>
                <a
                  href="https://wa.me/919970344139"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-secondary/50 py-2.5 text-sm font-semibold text-white transition-colors hover:border-neon hover:text-neon"
                >
                  <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

export function Hero() {
  const trackRef = useRef<HTMLDivElement>(null);
  const mobileHeroRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroBrandRef = useRef<HTMLDivElement>(null);
  const mediaCardRef = useRef<HTMLDivElement>(null);
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(116);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsDesktop(window.innerWidth >= 1024);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const toggleAudio = (e?: { stopPropagation?: () => void }) => {
    if (e?.stopPropagation) e.stopPropagation();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const activeVideo = isMobile ? mobileVideoRef.current : desktopVideoRef.current;
    if (activeVideo) {
      const nextMuted = !activeVideo.muted;
      activeVideo.muted = nextMuted;
      if (mobileVideoRef.current) mobileVideoRef.current.muted = nextMuted;
      if (desktopVideoRef.current) desktopVideoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        activeVideo.play().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleAutoplay = () => {
      const isMobile = window.innerWidth < 1024;
      const activeVideo = isMobile ? mobileVideoRef.current : desktopVideoRef.current;
      const inactiveVideo = isMobile ? desktopVideoRef.current : mobileVideoRef.current;

      if (inactiveVideo) {
        inactiveVideo.pause();
      }

      if (!activeVideo) return;
      activeVideo.muted = false;

      const playPromise = activeVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          activeVideo.muted = true;
          setIsMuted(true);
          activeVideo.play().catch(() => {});

          const unmuteOnInteraction = () => {
            const currentActive =
              window.innerWidth < 1024 ? mobileVideoRef.current : desktopVideoRef.current;
            if (currentActive) {
              currentActive.muted = false;
              setIsMuted(false);
              currentActive.play().catch(() => {});
            }
            window.removeEventListener("pointerdown", unmuteOnInteraction);
            window.removeEventListener("keydown", unmuteOnInteraction);
            window.removeEventListener("scroll", unmuteOnInteraction);
          };

          window.addEventListener("pointerdown", unmuteOnInteraction, { once: true });
          window.addEventListener("keydown", unmuteOnInteraction, { once: true });
          window.addEventListener("scroll", unmuteOnInteraction, { once: true });
        });
      }
    };

    handleAutoplay();
    window.addEventListener("resize", handleAutoplay);
    return () => window.removeEventListener("resize", handleAutoplay);
  }, []);

  // IntersectionObserver: automatically stop and mute when hero section is not in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isMobile = window.innerWidth < 1024;
          const targetVideo = isMobile ? mobileVideoRef.current : desktopVideoRef.current;
          if (!targetVideo) return;

          if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
            // User is on the hero section -> play
            targetVideo.play().catch(() => {});
          } else {
            // User scrolled away from hero section -> STOP AND MUTE!
            if (mobileVideoRef.current) {
              mobileVideoRef.current.pause();
              mobileVideoRef.current.muted = true;
            }
            if (desktopVideoRef.current) {
              desktopVideoRef.current.pause();
              desktopVideoRef.current.muted = true;
            }
            setIsMuted(true);
          }
        });
      },
      { threshold: [0, 0.05, 0.2] },
    );

    if (mobileHeroRef.current) {
      observer.observe(mobileHeroRef.current);
    }
    if (trackRef.current) {
      observer.observe(trackRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateHeaderHeight = () => {
      const nav = document.getElementById("site-nav-container");
      if (nav) {
        setHeaderHeight(nav.offsetHeight);
      }
    };

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);

    let observer: ResizeObserver | null = null;
    const nav = document.getElementById("site-nav-container");
    if (nav && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(nav);
    }

    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const handleMobileScroll = () => {
      if (window.innerWidth >= 1024) return;
      if (!mobileHeroRef.current || !mobileVideoRef.current) return;

      const rect = mobileHeroRef.current.getBoundingClientRect();
      // If mobile hero section has scrolled past top (leaving screen) or is below view:
      if (rect.bottom <= 60 || rect.top >= window.innerHeight) {
        if (!mobileVideoRef.current.paused) {
          mobileVideoRef.current.pause();
          mobileVideoRef.current.muted = true;
          setIsMuted(true);
        }
      } else {
        if (mobileVideoRef.current.paused) {
          mobileVideoRef.current.play().catch(() => {});
        }
      }
    };

    const handleScroll = () => {
      if (window.innerWidth < 1024) return; // Desktop cinema engine only
      if (!trackRef.current || !containerRef.current) return;

      const trackRect = trackRef.current.getBoundingClientRect();
      const trackHeight = trackRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrollableDistance = trackHeight - windowHeight;

      if (scrollableDistance <= 0) return;

      const scrolled = -trackRect.top;
      const rawP = scrolled / scrollableDistance;
      const p = Math.min(Math.max(rawP, 0), 1);

      // Expansion completes smoothly at p = 0.65, followed by a generous locked cinema hold from 0.65 to 1.0
      const expandP = Math.min(p / 0.65, 1);

      // --- 3-PHASE PINNING ENGINE: 100% immune to ancestor overflow / sticky cancellation ---
      if (scrolled <= 0) {
        // Phase 1: At top of track
        containerRef.current.style.position = "absolute";
        containerRef.current.style.top = "0px";
        containerRef.current.style.bottom = "auto";
        if (desktopVideoRef.current && desktopVideoRef.current.paused) {
          desktopVideoRef.current.play().catch(() => {});
        }
      } else if (scrolled >= scrollableDistance) {
        // Phase 3: Scrolled past hero hold, rolling up cleanly into the next section
        containerRef.current.style.position = "absolute";
        containerRef.current.style.top = "auto";
        containerRef.current.style.bottom = "0px";
        // User scrolled past hero section: STOP AND MUTE!
        if (desktopVideoRef.current && !desktopVideoRef.current.paused) {
          desktopVideoRef.current.pause();
          desktopVideoRef.current.muted = true;
          setIsMuted(true);
        }
      } else {
        // Phase 2: Active Scroll & Locked Hold — FIXED TO VIEWPORT, NEVER SCROLLS OFF OR DISAPPEARS!
        containerRef.current.style.position = "fixed";
        containerRef.current.style.top = "0px";
        containerRef.current.style.bottom = "auto";
        if (desktopVideoRef.current && desktopVideoRef.current.paused) {
          desktopVideoRef.current.play().catch(() => {});
        }
      }

      // 1. Hero Brand Logo & Subtitle: Glides smoothly UPWARDS and disappears slowly as video expands
      if (heroBrandRef.current) {
        const brandOpacity = Math.max(0, 1 - expandP * 1.5);
        const brandTransY = -expandP * 140; // Rises up smoothly as the video screen gets big
        heroBrandRef.current.style.opacity = brandOpacity.toString();
        heroBrandRef.current.style.transform = `translate3d(0, ${brandTransY}px, 0)`;
        heroBrandRef.current.style.pointerEvents = expandP > 0.5 ? "none" : "auto";
      }

      // 2. Expand Media Video Card: Starts small/compact cutting into logo, smoothly expands to TRUE 100% FULL SCREEN
      if (mediaCardRef.current) {
        const width = window.innerWidth;
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        if (isMobile) {
          // Mobile (< 640px): Starting card is 54% width, 32% height
          const startW = 54;
          const startH = 32;
          const currentW = startW + (100 - startW) * expandP;
          const currentH = startH + (100 - startH) * expandP;
          const currentRadius = 16 * (1 - expandP);
          mediaCardRef.current.style.width = expandP >= 0.98 ? "100%" : `${currentW}%`;
          mediaCardRef.current.style.height = expandP >= 0.98 ? "100%" : `${currentH}%`;
          mediaCardRef.current.style.right = expandP >= 0.98 ? "0px" : `${(1 - expandP) * 2}vw`;
          mediaCardRef.current.style.bottom = expandP >= 0.98 ? "0px" : `${(1 - expandP) * 2}vh`;
          mediaCardRef.current.style.borderRadius = `${currentRadius}px`;
          mediaCardRef.current.style.border =
            expandP >= 0.98 ? "none" : "1px solid rgba(255, 255, 255, 0.2)";
        } else if (isTablet) {
          // Tablet (640px - 1023px): Starting card is 44% width, 36% height
          const startW = 44;
          const startH = 36;
          const currentW = startW + (100 - startW) * expandP;
          const currentH = startH + (100 - startH) * expandP;
          const currentRadius = 18 * (1 - expandP);
          mediaCardRef.current.style.width = expandP >= 0.98 ? "100%" : `${currentW}%`;
          mediaCardRef.current.style.height = expandP >= 0.98 ? "100%" : `${currentH}%`;
          mediaCardRef.current.style.right = expandP >= 0.98 ? "0px" : `${(1 - expandP) * 2.5}vw`;
          mediaCardRef.current.style.bottom = expandP >= 0.98 ? "0px" : `${(1 - expandP) * 2.5}vh`;
          mediaCardRef.current.style.borderRadius = `${currentRadius}px`;
          mediaCardRef.current.style.border =
            expandP >= 0.98 ? "none" : "1px solid rgba(255, 255, 255, 0.2)";
        } else {
          // Desktop & Laptop (1024px+): Starting card is 36% width, 42% height
          const startW = 36;
          const startH = 42;
          const currentW = startW + (100 - startW) * expandP;
          const currentH = startH + (100 - startH) * expandP;
          const currentRadius = 20 * (1 - expandP);

          mediaCardRef.current.style.width = expandP >= 0.98 ? "100%" : `${currentW}%`;
          mediaCardRef.current.style.height = expandP >= 0.98 ? "100%" : `${currentH}%`;
          mediaCardRef.current.style.right = expandP >= 0.98 ? "0px" : `${(1 - expandP) * 2.5}vw`;
          mediaCardRef.current.style.bottom = expandP >= 0.98 ? "0px" : `${(1 - expandP) * 10}vh`;
          mediaCardRef.current.style.borderRadius = `${currentRadius}px`;
          mediaCardRef.current.style.border =
            expandP >= 0.98 ? "none" : "1px solid rgba(255, 255, 255, 0.2)";
        }
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        handleScroll();
        handleMobileScroll();
      });
    };

    const onResize = () => {
      handleScroll();
      handleMobileScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    handleScroll();
    handleMobileScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* 1. MOBILE & TABLET VIEW (< 1024px): Video centered in between, sentence below it */}
      <section
        id="hero-mobile-section"
        ref={mobileHeroRef}
        aria-hidden={isDesktop}
        className="block lg:hidden relative overflow-hidden bg-background w-full min-h-[calc(100vh-60px)] px-4 sm:px-6 pb-12 flex flex-col items-center justify-center text-center"
        style={{ paddingTop: `${headerHeight + 20}px` }}
      >
        {/* Ambient atmospheric brand glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-10 h-[360px] w-[360px] rounded-full opacity-35 blur-3xl"
          style={{ backgroundImage: "var(--gradient-glow)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-10 h-[300px] w-[300px] rounded-full opacity-25 blur-3xl"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(90, 160, 255, 0.25), transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center w-full max-w-md mx-auto my-auto">
          {/* Video in between (centered, high-impact vertical format) */}
          <div className="relative w-full max-w-[310px] xs:max-w-[340px] sm:max-w-[390px] aspect-[9/16] max-h-[58vh] rounded-2xl overflow-hidden border border-white/20 bg-[#0e081e] shadow-[0_0_50px_rgba(200,80,255,0.35)] glow-neon">
            <video
              ref={mobileVideoRef}
              src="/images/Hero Video.mp4"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="auto"
              onClick={toggleAudio}
              className="relative z-10 h-full w-full object-cover object-center cursor-pointer"
            >
              <source src="/images/Hero Video.mp4" type="video/mp4" />
            </video>

            {/* Audio Voice Toggle Button */}
            <div className="absolute top-2.5 left-2.5 z-30">
              <button
                type="button"
                onClick={toggleAudio}
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-neon hover:bg-neon/20 hover:scale-105 active:scale-95 cursor-pointer"
                title={isMuted ? "Click to Unmute Voice" : "Click to Mute Audio"}
                aria-label={isMuted ? "Unmute video voice" : "Mute video audio"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-red-400 group-hover:text-neon" />
                    <span className="text-white/90">Unmute Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-neon animate-pulse" />
                    <span className="text-neon font-bold">Voice Active</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Below that: The Sentence (Nothing else than that) */}
          <div className="mt-5 sm:mt-6 w-full px-2">
            <p className="text-lg sm:text-2xl font-medium leading-snug tracking-tight text-white/95">
              <span className="sr-only">Quickupp AI Studio - </span>a world-class, tech-enabled AI
              video production studio.
            </p>
          </div>
        </div>
      </section>

      {/* 2. DESKTOP VIEW (lg: 1024px+): Full Cinema Scroll & Expansion Engine */}
      <section
        id="hero-scroll-track"
        ref={trackRef}
        aria-hidden={!isDesktop}
        className="hidden lg:block relative w-full h-[280vh] bg-background"
      >
        <div
          ref={containerRef}
          className="absolute top-0 left-0 w-full h-screen overflow-hidden bg-background pointer-events-none"
        >
          {/* Ambient atmospheric background glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full opacity-35 blur-3xl"
            style={{ backgroundImage: "var(--gradient-glow)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 bottom-10 h-[450px] w-[450px] rounded-full opacity-25 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(90, 160, 255, 0.25), transparent 60%)",
            }}
          />

          {/* Top & Left Content: Cleanly positioned below navigation bar, spanning across and behind video card */}
          <div
            ref={heroBrandRef}
            className="absolute inset-0 pb-6 lg:pb-8 xl:pb-10 px-6 lg:px-12 xl:px-16 flex flex-col justify-between pointer-events-auto will-change-transform z-10"
            style={{ paddingTop: `calc(${headerHeight}px + clamp(75px, 11vh, 115px))` }}
          >
            {/* Top: Giant "AI Studio" Title spanning across the screen and extending behind video card */}
            <div className="w-full flex-shrink-0">
              <img
                src="/images/ai studio logo hero.png"
                alt="Quickupp AI Studio - Tech-Enabled AI Video Production Studio"
                title="Quickupp AI Studio"
                className="w-full max-w-[96vw] lg:max-w-[95vw] xl:max-w-[94vw] 2xl:max-w-[1720px] h-auto object-contain object-left drop-shadow-[0_4px_45px_rgba(200,80,255,0.4)] select-none"
                width={4267}
                height={730}
                loading="eager"
                fetchPriority="high"
              />
            </div>

            {/* Bottom Row: Primary Semantic H1 Headline on the left */}
            <div className="w-full max-w-md lg:max-w-lg xl:max-w-xl mb-3 lg:mb-5 pl-[3vw] lg:pl-[4vw]">
              <h1 className="text-xl lg:text-2xl xl:text-3xl font-medium leading-snug tracking-tight text-white/95">
                <span className="sr-only">Quickupp AI Studio - </span>a world-class, tech-enabled AI
                video production studio.
              </h1>
            </div>
          </div>

          {/* Media Video Showcase: Aligned directly below navigation bar to avoid cutting */}
          <div
            className="absolute bottom-0 inset-x-0 z-20 pointer-events-none overflow-hidden"
            style={{ top: `${headerHeight}px` }}
          >
            <div
              ref={mediaCardRef}
              className="pointer-events-auto absolute bg-[#0e081e] shadow-[0_0_60px_-10px_rgba(200,80,255,0.45)] will-change-transform glow-neon border border-white/20 overflow-hidden"
              style={{
                width: "36%",
                height: "42%",
                right: "2.5vw",
                bottom: "10vh",
                borderRadius: "20px",
              }}
            >
              {/* Active autoplaying video with audio default */}
              <video
                ref={desktopVideoRef}
                src="/images/Hero Video.mp4"
                autoPlay
                loop
                muted={isMuted}
                playsInline
                preload="auto"
                onClick={toggleAudio}
                className="relative z-10 h-full w-full object-cover object-center cursor-pointer"
              >
                <source src="/images/Hero Video.mp4" type="video/mp4" />
              </video>

              {/* Audio Voice Toggle Button */}
              <div className="absolute top-2.5 left-2.5 sm:top-3 sm:right-auto z-30">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-2.5 py-1 sm:px-3 sm:py-1 text-[9px] sm:text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-neon hover:bg-neon/20 hover:scale-105 active:scale-95 cursor-pointer"
                  title={isMuted ? "Click to Unmute Voice" : "Click to Mute Audio"}
                  aria-label={isMuted ? "Unmute video voice" : "Mute video audio"}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-400 group-hover:text-neon" />
                      <span className="text-white/90">Unmute Voice</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neon animate-pulse" />
                      <span className="text-neon font-bold">Voice Active</span>
                    </>
                  )}
                </button>
              </div>

              {/* Floating Formats Pills */}
              <div className="absolute bottom-2.5 sm:bottom-3 inset-x-2 sm:inset-x-4 flex flex-nowrap items-center justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1 z-20">
                {formats.map((format) => (
                  <span
                    key={format}
                    className="whitespace-nowrap rounded-full border border-white/20 bg-black/80 px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-xs font-semibold text-white/95 shadow-lg backdrop-blur-md transition-all duration-200 hover:border-neon hover:bg-neon/20 hover:scale-105"
                  >
                    {format}
                  </span>
                ))}
              </div>

              {/* Showcase Badge */}
              <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-neon/50 bg-black/75 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-xs font-bold text-white shadow-md backdrop-blur-md">
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-neon animate-pulse" />
                  <span>AI Video Showcase</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function HeroOverview() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const checklistItems = [
    "Script Included",
    "5+ AI Video Formats",
    "Up to 60-Second Videos",
    "9:16 Reel Format",
    "48–72 Hour Delivery",
    "1 Revision Included",
  ];

  return (
    <section
      id="overview"
      ref={sectionRef}
      className="relative overflow-hidden px-5 sm:px-8 lg:px-12 py-10 sm:py-14 md:py-16 border-b border-border/60 bg-background"
    >
      {/* Ambient background brand glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-20 top-0 h-[450px] w-[450px] rounded-full blur-3xl transition-all duration-1000 ease-out ${
          isVisible ? "opacity-25" : "opacity-0"
        }`}
        style={{ backgroundImage: "var(--gradient-glow)" }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -left-20 bottom-0 h-[380px] w-[380px] rounded-full blur-3xl transition-all duration-1000 ease-out ${
          isVisible ? "opacity-20" : "opacity-0"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(90, 160, 255, 0.22), transparent 60%)",
        }}
      />

      <div className="mx-auto w-full max-w-6xl relative z-10">
        <div className="grid md:grid-cols-12 gap-8 md:gap-10 lg:gap-12 items-center">
          {/* Left Column: Heading, Value Prop, Paragraphs & CTAs (7 cols on tablet/desktop) */}
          <div className="md:col-span-7 flex flex-col items-start text-left">
            {/* Brand Eyebrow Badge */}
            <div
              className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible
                  ? "opacity-100 translate-y-0 scale-100 blur-0"
                  : "opacity-0 -translate-y-3 scale-95 blur-sm"
              }`}
            >
              <span className="eyebrow text-[11px] sm:text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-neon shadow-[0_0_8px_#c850ff]"></span>
                </span>
                AI Video Production Company
              </span>
            </div>

            {/* Headline */}
            <h2
              className={`mt-3 sm:mt-4 font-[var(--font-google-sans)] text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight text-white transition-all duration-800 delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-6 blur-sm"
              }`}
            >
              AI Video Production Services for{" "}
              <span className="font-serif italic font-bold text-gradient-brand">
                Modern Businesses
              </span>
            </h2>

            {/* Subheading */}
            <h3
              className={`mt-2.5 sm:mt-3 text-sm sm:text-base md:text-lg font-semibold text-foreground/90 leading-snug transition-all duration-800 delay-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"
              }`}
            >
              Create AI UGC, AI Avatar, Cartoon, Hyper-Realistic &amp; Digital Twin Videos for Your
              Brand
            </h3>

            {/* Paragraph 1 & 2 */}
            <p
              className={`mt-2.5 sm:mt-3 text-xs sm:text-sm md:text-base leading-relaxed text-muted-foreground transition-all duration-800 delay-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"
              }`}
            >
              Create engaging and professional video content without traditional production
              complexity. Quickupp AI Studio provides professional AI video production services for
              businesses, brands, founders and marketing teams — from AI UGC videos and AI avatar
              reels to hyper-realistic AI advertisements and digital twin videos.
            </p>

            <p
              className={`mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground transition-all duration-800 delay-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"
              }`}
            >
              Our AI video production includes scripting, AI-generated visuals, voiceover, lip-sync,
              captions, background music and editing, delivered in social-media-ready 9:16 format.
            </p>

            {/* Action Buttons */}
            <div
              className={`mt-5 sm:mt-6 flex flex-wrap items-center gap-3 transition-all duration-800 delay-550 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
              }`}
            >
              <NeonButton href="#contact" className="text-xs sm:text-sm">
                Get Your AI Video Quote
              </NeonButton>
              <NeonButton
                href="#samples"
                variant="ghost"
                className="text-xs sm:text-sm inline-flex items-center gap-2"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-neon/60 bg-neon/10">
                  <Play className="h-2 w-2 fill-neon text-neon ml-0.5" />
                </span>
                <span>View Video Samples</span>
              </NeonButton>
            </div>
          </div>

          {/* Right Column: 6 Feature Cards (2 cols on mobile, 1 col on tablet/desktop) */}
          <div
            className={`md:col-span-5 w-full grid grid-cols-2 md:grid-cols-1 gap-2 sm:gap-2.5 lg:gap-3 transition-all duration-800 delay-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
            }`}
          >
            {checklistItems.map((item, idx) => (
              <div
                key={item}
                className="group flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-[#140e24]/80 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white/95 backdrop-blur-md shadow-md transition-all duration-300 hover:border-neon/60 hover:bg-neon/15 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(200,80,255,0.3)]"
                style={{ transitionDelay: isVisible ? `${450 + idx * 70}ms` : "0ms" }}
              >
                <span className="flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full bg-neon/20 text-neon border border-neon/50 shadow-[0_0_10px_rgba(200,80,255,0.35)] group-hover:scale-110 group-hover:bg-neon group-hover:text-black transition-all duration-200">
                  <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />
                </span>
                <span className="tracking-wide">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  const items = [
    { icon: Film, label: "5+ AI Video Formats" },
    { icon: Clock, label: "48–72 Hour Delivery" },
    { icon: Smartphone, label: "9:16 Reel Ready" },
    { icon: BadgeCheck, label: "Script + 1 Revision Included" },
  ];

  return (
    <section className="border-y border-border bg-surface/40">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 px-5 py-5 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-center gap-3 lg:justify-start">
            <item.icon className="h-5 w-5 shrink-0 text-neon" />
            <span className="text-sm font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Samples() {
  const [activeTab, setActiveTab] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completedMap, setCompletedMap] = useState<Record<number, boolean>>({});

  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const filters = ["All", ...formats];
  const allFiltered = useMemo(() => {
    return activeTab === "All"
      ? samples
      : samples.filter(
          (s) =>
            s.format.toLowerCase().trim() === activeTab.toLowerCase().trim() ||
            (activeTab === "AI UGC" && s.format.includes("UGC")) ||
            (activeTab === "AI Cartoon" && s.format.includes("Cartoon")) ||
            (activeTab === "AI Avatar" && s.format.includes("Avatar")) ||
            (activeTab === "Hyper-Realistic" && s.format.includes("Realistic")) ||
            (activeTab === "Digital Twin" && s.format.includes("Twin")),
        );
  }, [activeTab]);

  // Group filtered samples into pairs of 2
  const pairs = useMemo(() => {
    const list: (typeof samples)[] = [];
    for (let i = 0; i < allFiltered.length; i += 2) {
      list.push(allFiltered.slice(i, i + 2));
    }
    return list;
  }, [allFiltered]);

  // Observe cards container directly so animation plays right when cards enter the viewport
  useEffect(() => {
    const el = cardsContainerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.05, rootMargin: "60px 0px 60px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Advance to next video pair
  const handleAdvance = () => {
    if (pairs.length > 1) {
      setCompletedMap({});
      setCurrentIndex((prev) => (prev + 1) % pairs.length);
    }
  };

  const handlePrev = () => {
    if (pairs.length > 1) {
      setCompletedMap({});
      setCurrentIndex((prev) => (prev - 1 + pairs.length) % pairs.length);
    }
  };

  // Reset index and completion state whenever tab changes so it always starts from first video(s)
  useEffect(() => {
    setCurrentIndex(0);
    setCompletedMap({});
  }, [activeTab]);

  const currentPair = useMemo(() => pairs[currentIndex] || pairs[0] || [], [pairs, currentIndex]);

  // Autoplay active video pair smoothly across mobile and desktop
  useEffect(() => {
    if (!isInView) return;

    currentPair.forEach((_, idx) => {
      const video = videoRefs.current[idx];
      if (video) {
        video.defaultMuted = true;
        video.muted = true;
        video.playsInline = true;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            const onGesture = () => {
              const v = videoRefs.current[idx];
              if (v) {
                v.defaultMuted = true;
                v.muted = true;
                v.play().catch(() => {});
              }
              window.removeEventListener("touchstart", onGesture);
              window.removeEventListener("scroll", onGesture);
            };
            window.addEventListener("touchstart", onGesture, { once: true, passive: true });
            window.addEventListener("scroll", onGesture, { once: true, passive: true });
          });
        }
      }
    });
  }, [isInView, currentIndex, activeTab, currentPair]);

  const handleVideoEnded = (idx: number) => {
    setCompletedMap((prev) => {
      const updated = { ...prev, [idx]: true };
      const totalInPair = currentPair.length;
      const allDone = totalInPair > 0 && currentPair.every((_, i) => updated[i] === true);

      if (allDone && pairs.length > 1) {
        setTimeout(() => {
          handleAdvance();
        }, 700);
      }
      return updated;
    });
  };

  const handleReplay = (idx: number) => {
    setCompletedMap((prev) => ({ ...prev, [idx]: false }));
    const video = videoRefs.current[idx];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  };

  const allPairCompleted =
    currentPair.length > 0 && currentPair.every((_, i) => completedMap[i] === true);

  return (
    <Section id="samples">
      <SectionHeading
        eyebrow="AI Video Samples"
        title="Explore Our AI Video"
        highlight="Samples"
        description="See how different AI video formats can bring your brand, product or service to life."
      />
      <p className="mx-auto mb-8 -mt-6 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
        Not sure which AI video format is right for your business? Explore our video samples to
        understand the difference between AI UGC videos, AI cartoon animation, AI avatar videos,
        hyper-realistic AI videos and AI digital twin videos.
      </p>

      {/* Filter Tabs */}
      <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveTab(filter)}
            className={`rounded-full px-5 py-2 text-xs font-semibold tracking-wide transition-all duration-300 sm:text-sm ${
              activeTab === filter
                ? "bg-gradient-brand text-neon-foreground shadow-md glow-neon scale-105"
                : "border border-border/80 bg-secondary/40 text-muted-foreground hover:border-neon hover:text-foreground"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* 2 at a time Diagonal Showcase Container */}
      <div
        ref={cardsContainerRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="mx-auto max-w-5xl space-y-6 overflow-hidden py-2 min-h-[300px]"
      >
        {currentPair.map((item, idx) => {
          const isSecond = idx === 1; // Card 1 is top (left entry), Card 2 is bottom (right entry)
          const isReversed = idx % 2 === 1; // Diagonal layout: top card left-video/right-text, bottom card right-video/left-text

          const slideAnimationClass = isInView
            ? isSecond
              ? "animate-slide-in-right"
              : "animate-slide-in-left"
            : `opacity-0 ${isSecond ? "translate-x-10" : "-translate-x-10"}`;

          const isEnded = Boolean(completedMap[idx]);
          const showWatchAgain = (isEnded && !allPairCompleted) || (isEnded && pairs.length <= 1);

          return (
            <div
              key={`sample-card-${activeTab}-${currentIndex}-${idx}`}
              className={`relative overflow-hidden rounded-[28px] border border-neon/30 bg-[#090714]/95 p-5 shadow-[0_0_35px_-10px_rgba(200,80,255,0.25)] backdrop-blur-xl transition-all duration-500 hover:border-neon/70 hover:shadow-[0_0_45px_-5px_rgba(200,80,255,0.4)] sm:p-7 md:p-8 ${slideAnimationClass}`}
            >
              <div
                className={`flex flex-col items-center gap-6 md:gap-10 ${
                  isReversed ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                {/* Authentic 9:16 Vertical Reel Player with dark stylish border */}
                <div
                  onClick={() => {
                    const v = videoRefs.current[idx];
                    if (v) {
                      if (v.paused) v.play().catch(() => {});
                      else v.pause();
                    }
                  }}
                  className="relative aspect-[9/16] w-full max-w-[260px] sm:max-w-[280px] shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-[0_0_25px_-5px_rgba(0,0,0,0.8)] transition-all duration-300 hover:border-neon/60 cursor-pointer"
                >
                  <video
                    ref={(el) => {
                      videoRefs.current[idx] = el;
                      if (el) {
                        el.defaultMuted = true;
                        el.muted = true;
                        el.playsInline = true;
                      }
                    }}
                    key={item.videoUrl}
                    src={item.videoUrl}
                    autoPlay
                    muted
                    playsInline
                    preload="auto"
                    onEnded={() => handleVideoEnded(idx)}
                    className="h-full w-full object-cover"
                  />

                  {/* "Watch Again" Overlay if this video finished before other video in the pair */}
                  {showWatchAgain && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 p-3 text-center backdrop-blur-[2px] animate-in fade-in duration-300">
                      <button
                        type="button"
                        onClick={() => handleReplay(idx)}
                        className="group/btn inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-bold text-neon-foreground shadow-lg transition-all hover:scale-105 active:scale-95 glow-neon cursor-pointer"
                        aria-label={`Watch ${item.format} video again`}
                      >
                        <RotateCcw className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:-rotate-45" />
                        <span>Watch Again</span>
                      </button>
                      {pairs.length > 1 && !allPairCompleted && (
                        <span className="mt-2 text-[10px] text-white/70 font-medium tracking-wide">
                          Waiting for next video to finish...
                        </span>
                      )}
                    </div>
                  )}

                  <span className="absolute bottom-3 left-3 rounded-lg bg-black/80 border border-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-md z-10">
                    {item.format}
                  </span>
                </div>

                {/* Content Side */}
                <div className="flex flex-1 flex-col justify-between self-stretch py-1 text-left">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-neon">
                        Industry: {item.industry}
                      </span>
                      <span className="rounded-md border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-[11px] font-semibold text-neon">
                        9:16 Vertical Reel
                      </span>
                    </div>

                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {item.format}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {item.description}
                    </p>

                    {/* What's Included Deliverables Checklist */}
                    {(() => {
                      const matchedDeliverable =
                        deliverables.find(
                          (d) =>
                            d.title
                              .toLowerCase()
                              .includes(item.format.toLowerCase().replace("video", "").trim()) ||
                            item.format
                              .toLowerCase()
                              .includes(d.title.toLowerCase().replace("video", "").trim()),
                        ) || deliverables[0];

                      return (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-neon sm:text-sm">
                              ✦ What's Included in This Package:
                            </p>
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {matchedDeliverable.items.length} Deliverables
                            </span>
                          </div>

                          <ul className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs sm:text-sm text-foreground/85">
                            {matchedDeliverable.items.map((point) => (
                              <li key={point} className="flex items-center gap-2.5">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neon/20 text-[10px] font-extrabold text-neon shadow-[0_0_8px_rgba(200,80,255,0.4)]">
                                  ✓
                                </span>
                                <span className="leading-snug text-foreground/90">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Card Bottom Action & Turnaround Bar */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neon">
                        {item.format}
                      </span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-xs text-muted-foreground">⚡ 48–72h Turnaround</span>
                    </div>

                    <a
                      href="#contact"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-white transition-all hover:bg-neon hover:text-black hover:scale-105"
                    >
                      <span>Create Similar Video</span>
                      <span>→</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Indicators & Next/Prev Controls */}
      {pairs.length > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={handlePrev}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs text-white/80 transition-all hover:bg-white/15 hover:text-white"
            aria-label="Previous samples"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            {pairs.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  currentIndex === i
                    ? "w-8 bg-gradient-brand shadow-sm glow-neon"
                    : "w-2.5 bg-secondary hover:bg-muted-foreground"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={handleAdvance}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs text-white/80 transition-all hover:bg-white/15 hover:text-white"
            aria-label="Next samples"
          >
            →
          </button>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <p className="mb-4 text-xl font-semibold text-white">
          Want a Similar Video for Your Business?
        </p>
        <NeonButton href="#contact">Get Your AI Video Quote</NeonButton>
      </div>
    </Section>
  );
}

function PortfolioCard({ sample }: { sample: (typeof portfolioItems)[number] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setIsPlaying(true))
              .catch(() => {
                video.defaultMuted = true;
                video.muted = true;
                video
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => {});
                const onInteract = () => {
                  video
                    .play()
                    .then(() => setIsPlaying(true))
                    .catch(() => {});
                  window.removeEventListener("touchstart", onInteract);
                  window.removeEventListener("scroll", onInteract);
                };
                window.addEventListener("touchstart", onInteract, { once: true, passive: true });
                window.addEventListener("scroll", onInteract, { once: true, passive: true });
              });
          }
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.08, rootMargin: "40px 0px 40px 0px" },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [sample.videoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  return (
    <article className="group relative flex aspect-[9/16] w-full flex-col justify-between overflow-hidden rounded-[24px] border border-border/80 bg-black p-4 sm:p-5 shadow-2xl transition-all duration-300 hover:border-neon/60 hover:shadow-[0_0_35px_-5px_rgba(217,70,239,0.35)] sm:w-[calc(50%-0.875rem)] lg:w-[calc(33.333%-1.25rem)]">
      {/* Background Video (True 9:16 Reel Fit - No Crop) */}
      {sample.videoUrl && (
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el) {
              el.defaultMuted = true;
              el.muted = isMuted;
              el.playsInline = true;
            }
          }}
          src={sample.videoUrl}
          autoPlay
          muted={isMuted}
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      )}

      {/* Video Interactive Tap Area */}
      <button
        type="button"
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full cursor-pointer z-0 border-none bg-transparent p-0 text-left"
        aria-label={isPlaying ? `Pause ${sample.format} video` : `Play ${sample.format} video`}
      />

      {/* Cinematic Soft Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50 pointer-events-none" />

      {/* Top Badge & Sound Toggle */}
      <div className="z-10 flex items-center justify-between">
        <span className="rounded-md border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white/95 backdrop-blur-md shadow">
          {sample.format}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/90 border border-white/15 backdrop-blur-md transition-all hover:scale-110 hover:bg-neon hover:text-black shadow"
          title={isMuted ? "Unmute sound" : "Mute sound"}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Center Play/Pause indicator on hover or when paused */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          !isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-neon-foreground shadow-[0_0_20px_rgba(217,70,239,0.6)] backdrop-blur-md">
          {isPlaying ? (
            <Pause className="h-6 w-6 text-white" />
          ) : (
            <Play className="ml-0.5 h-6 w-6 text-white fill-white" />
          )}
        </div>
      </div>

      {/* Bottom Industry & Description Info with subtle frosted backing */}
      <div className="z-10 space-y-1 rounded-xl bg-black/40 p-2.5 backdrop-blur-sm pointer-events-none border border-white/5">
        <div className="text-xs font-bold text-neon sm:text-sm">Industry: {sample.industry}</div>
        <p className="text-xs text-white/90 line-clamp-2 leading-relaxed font-normal">
          {sample.description}
        </p>
      </div>
    </article>
  );
}

export function Portfolio() {
  const [active, setActive] = useState("All Videos");
  const filters = [
    "All Videos",
    "AI UGC",
    "AI Cartoon",
    "AI Avatar",
    "Hyper-Realistic",
    "Digital Twin",
  ];
  const visible =
    active === "All Videos"
      ? portfolioItems
      : portfolioItems.filter(
          (s) =>
            s.format.toLowerCase().trim() === active.toLowerCase().trim() ||
            (active === "AI UGC" && s.format.includes("UGC")) ||
            (active === "AI Cartoon" && s.format.includes("Cartoon")) ||
            (active === "AI Avatar" && s.format.includes("Avatar")) ||
            (active === "Hyper-Realistic" && s.format.includes("Realistic")) ||
            (active === "Digital Twin" && s.format.includes("Twin")),
        );

  return (
    <Section id="portfolio" className="bg-surface/30">
      <SectionHeading
        eyebrow="AI Video Portfolio"
        title="AI Video"
        highlight="Portfolio"
        description="Explore real examples of AI-powered video content created for different business requirements."
        center={true}
      />

      {/* Filter Tabs */}
      <div className="mb-10 flex flex-wrap justify-center gap-2 sm:gap-3">
        {filters.map((filter) => {
          const isActive = active === filter;
          return (
            <button
              key={filter}
              onClick={() => setActive(filter)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm ${
                isActive
                  ? "border-neon bg-neon/15 text-neon shadow-sm glow-neon"
                  : "border-border/80 bg-secondary/30 text-muted-foreground hover:border-border hover:text-white"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Video Cards Grid - Centered Flex Layout with wider cards (3 per row on desktop, 2 centered on row 2) */}
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 md:gap-7">
        {visible.map((sample) => (
          <PortfolioCard key={`portfolio-${sample.format}-${sample.industry}`} sample={sample} />
        ))}
      </div>

      {/* Buttons Group (Create a Similar Video & See More) */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#contact"
          className="inline-flex items-center justify-center rounded-full bg-gradient-brand px-8 py-3.5 text-sm font-bold tracking-wide text-neon-foreground shadow-lg glow-neon transition-all duration-200 hover:scale-105 hover:brightness-110"
        >
          Create a Similar Video
        </a>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-border/80 bg-secondary/40 px-8 py-3.5 text-sm font-semibold tracking-wide text-foreground shadow-md transition-all duration-200 hover:border-neon hover:bg-neon/10 hover:text-neon"
        >
          See More
        </button>
      </div>
    </Section>
  );
}

const serviceIcons: Record<string, typeof Sparkles> = {
  "AI UGC Video Production": Video,
  "AI Cartoon Animation Services": Palette,
  "AI Avatar Video Production": Bot,
  "Hyper-Realistic AI Video Production": Wand2,
  "AI Digital Twin & Clone Video Services": UserCheck,
};

export function Services() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="services" className="overflow-hidden">
      <SectionHeading
        eyebrow="AI Video Creation Services"
        title="Our AI Video Production"
        highlight="Services"
        description="Choose the AI video format that best fits your business and marketing goals."
      />
      <div
        ref={sectionRef}
        className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 lg:gap-7"
      >
        {services.map((service, idx) => {
          const Icon = serviceIcons[service.title] || Sparkles;
          const isFeatured = idx === 0 || idx === 3;
          const animationClass = isInView
            ? "animate-service-card"
            : "opacity-0 scale-90 translate-y-6";

          return (
            <article
              key={service.title}
              style={{ animationDelay: `${idx * 0.1}s` }}
              className={`group relative flex w-full max-w-[350px] flex-col justify-between overflow-hidden rounded-[26px] border border-white/10 bg-[#0d091a]/95 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-neon/40 hover:shadow-[0_0_25px_-5px_rgba(200,80,255,0.25)] sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.25rem)] ${animationClass}`}
            >
              <div className="relative z-10">
                {/* Header: Sparkle Icon + Full Service Title Heading */}
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-neon" />
                  </div>
                  <h3 className="mt-3 text-lg font-bold tracking-tight text-white sm:text-xl">
                    {service.title}
                  </h3>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {service.description}
                </p>

                {/* Distinct Highlighted Text (No Background) */}
                <div className="mt-4 pt-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Best For</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-amber-200/90 font-medium">
                    {service.bestFor}
                  </p>
                </div>

                {/* Bullet Points Checklist */}
                <div className="mt-4 space-y-2">
                  {service.items.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 text-xs text-foreground/80"
                    >
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-neon/15 text-[9px] font-bold text-neon">
                        ✓
                      </span>
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clean Gradient Button with Only Pricing */}
              <div className="relative z-10 mt-6 border-t border-white/10 pt-4">
                <a
                  href="#contact"
                  className="flex w-full items-center justify-center rounded-lg bg-gradient-brand py-2.5 text-sm font-bold tracking-wide text-neon-foreground shadow-md transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-95 sm:text-base"
                >
                  {service.price}
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

export function WhyAiVideo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section className="bg-surface/30">
      <SectionHeading
        eyebrow="Why AI Video"
        title="Why Businesses Are Choosing AI Video"
        highlight="Production"
        description="Traditional video production can involve actors, locations, equipment and repeated shooting requirements. AI video production gives businesses a flexible way to create engaging content at scale while reducing production complexity."
      />
      <div ref={sectionRef} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {whyAiVideo.map((item, i) => {
          const animationClass = isInView ? "animate-cyber-wave" : "opacity-0 translate-y-8";

          return (
            <article
              key={item.title}
              style={{ animationDelay: `${i * 0.12}s` }}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e0a1b]/90 p-7 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-neon/70 hover:shadow-[0_0_35px_-5px_rgba(200,80,255,0.35)] ${animationClass}`}
            >
              {/* Top Neon Scanner Accent Bar on Hover */}
              <div className="absolute left-0 top-0 h-1 w-0 bg-gradient-brand transition-all duration-500 group-hover:w-full" />

              {/* Ambient Glowing Watermark Number */}
              <span className="pointer-events-none absolute right-4 top-2 text-5xl font-black text-white/[0.03] transition-all duration-300 group-hover:text-neon/15 group-hover:scale-110">
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Number Pill Badge */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neon/30 bg-neon/10 text-xs font-bold text-neon shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:bg-neon group-hover:text-black">
                {String(i + 1).padStart(2, "0")}
              </div>

              <h3 className="mt-4 text-lg font-bold text-white transition-colors duration-200 group-hover:text-neon">
                {item.title}
              </h3>

              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {item.description}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

export function Pricing() {
  const tableRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="pricing">
      <SectionHeading
        eyebrow="AI Video Production Packages"
        title="AI Video Production Packages &"
        highlight="Pricing"
        description="Choose a single reel or save with our multi-video packages."
      />
      <div
        ref={tableRef}
        className="relative rounded-2xl border border-white/10 bg-[#0d091a]/95 p-1 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-neon/40"
      >
        <div className="overflow-x-auto md:overflow-x-visible">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-4 sm:px-6">Service</th>
                <th className="px-5 py-4 text-neon sm:px-6">Single Reel</th>
                <th className="px-5 py-4 sm:px-6">5 Reels</th>
                <th className="px-5 py-4 sm:px-6">10 Reels</th>
                <th className="px-5 py-4 sm:px-6">15 Reels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pricingRows.map((row, idx) => {
                const animationClass = isInView ? "animate-pricing-row" : "opacity-0 translate-y-3";

                return (
                  <tr
                    key={row.service}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                    className={`transition-all duration-300 hover:bg-white/[0.04] ${animationClass}`}
                  >
                    <td className="px-5 py-4 font-bold text-white sm:px-6">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon/70" />
                        <span className="whitespace-nowrap">{row.service}</span>
                      </div>
                    </td>
                    {row.prices.map((item, i) => (
                      <td
                        key={item.discounted + i}
                        className={
                          i === 0
                            ? "px-5 py-3.5 font-extrabold text-neon tracking-wide whitespace-nowrap sm:px-6"
                            : "px-5 py-3.5 whitespace-nowrap sm:px-6"
                        }
                      >
                        <div className="flex flex-col items-start gap-1">
                          {/* Discounted Price (On Top) */}
                          <span
                            className={
                              i === 0
                                ? "text-base font-black text-neon drop-shadow-[0_0_8px_rgba(200,80,255,0.45)]"
                                : "text-sm font-bold text-white tracking-wide"
                            }
                          >
                            {item.discounted}
                          </span>

                          {/* Cut Price (Below) with clean normal strikethrough and badge */}
                          {item.original ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-normal text-muted-foreground/75 line-through decoration-rose-500/70">
                                {item.original}
                              </span>
                              {item.badge ? (
                                <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/30">
                                  {item.badge}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-3xl text-center">
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Our AI video production packages are designed for businesses looking for individual
          promotional videos or scalable monthly content. Need a customized content plan? We can
          create custom AI video packages based on your industry, content volume, video style and
          marketing requirements.
        </p>
        <div className="mt-6">
          <NeonButton href="#contact">Get Custom Pricing</NeonButton>
        </div>
      </div>
    </Section>
  );
}

export function Deliverables() {
  const [open, setOpen] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="deliverables">
      <SectionHeading
        eyebrow="Deliverables"
        title="What's Included in Your"
        highlight="AI Video?"
        description="Complete AI video production from script to final 9:16 reel."
        center={true}
      />
      <div ref={containerRef} className="mx-auto max-w-4xl space-y-3 overflow-hidden">
        {deliverables.map((item, i) => {
          const isLeft = i % 2 === 0;
          const animationClass = isInView
            ? isLeft
              ? "animate-item-left"
              : "animate-item-right"
            : `opacity-0 ${isLeft ? "-translate-x-10" : "translate-x-10"}`;

          return (
            <div
              key={item.title}
              style={{ animationDelay: `${i * 0.14}s` }}
              className={`panel overflow-hidden transition-all duration-300 ${animationClass}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold transition-colors hover:bg-white/[0.02]"
                aria-expanded={open === i}
              >
                <span>{item.title}</span>
                <span className="text-neon transition-transform duration-200">
                  {open === i ? "−" : "+"}
                </span>
              </button>
              {open === i ? (
                <div className="border-t border-border/60 bg-secondary/20 px-6 py-5">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {item.items.map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function DigitalTwin() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const twinVideoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const twinSample = samples.find((s) => s.format === "Digital Twin") || samples[4];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.05, rootMargin: "50px 0px 50px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = twinVideoRef.current;
    if (!video || !isInView) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const onTouch = () => {
          if (twinVideoRef.current) {
            twinVideoRef.current.defaultMuted = true;
            twinVideoRef.current.muted = true;
            twinVideoRef.current.play().catch(() => {});
          }
          window.removeEventListener("touchstart", onTouch);
          window.removeEventListener("scroll", onTouch);
        };
        window.addEventListener("touchstart", onTouch, { once: true, passive: true });
        window.addEventListener("scroll", onTouch, { once: true, passive: true });
      });
    }
  }, [isInView, twinSample?.videoUrl]);

  return (
    <Section id="digital-twin" className="bg-surface/40 overflow-hidden">
      <div ref={sectionRef} className="grid gap-12 lg:grid-cols-12 lg:items-center">
        {/* Content Side: Enters from RIGHT */}
        <div
          className={`lg:col-span-5 transition-all duration-700 ${
            isInView ? "animate-item-right" : "opacity-0 translate-x-12"
          }`}
        >
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-neon" />
            AI Digital Twin Videos
          </span>
          <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
            Build Your AI Digital Twin Once.{" "}
            <span className="font-serif italic text-gradient-brand">
              Create Videos Again and Again.
            </span>
          </h2>
          <p className="mt-4 text-base font-medium text-foreground/90 md:text-lg">
            Turn your approved appearance and voice into a reusable AI video asset for future
            content.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            Our AI digital twin video service helps founders, doctors, coaches, consultants,
            educators and personal brands create recurring video content using an appropriately
            authorized and client-approved digital twin. Once your digital twin is configured, it
            can be used for future AI video production without requiring you to record every
            individual video.
          </p>
          <p className="mt-6 text-2xl font-bold text-gradient-brand md:text-3xl">
            ₹15,000 One-Time Setup
          </p>
          <div className="mt-6">
            <NeonButton href="#contact">Create My Digital Twin</NeonButton>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Digital twin and voice cloning services require appropriate client authorization and
            consent.
          </p>
        </div>

        {/* Card Side: Enters from LEFT with points and Reel Player side-by-side */}
        <div
          className={`panel lg:col-span-7 flex flex-col items-center justify-between gap-6 p-6 shadow-2xl transition-all duration-700 sm:flex-row sm:p-8 md:p-9 ${
            isInView ? "animate-item-left" : "opacity-0 -translate-x-12"
          }`}
        >
          {/* Checklist Points */}
          <ul className="flex flex-1 flex-col justify-between gap-3 self-stretch sm:gap-3.5">
            {twinFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-xs md:text-sm">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neon/20 text-[10px] font-bold text-neon shadow-[0_0_8px_rgba(200,80,255,0.4)]">
                  ✓
                </span>
                <span className="font-medium text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          {/* Reel Card from Right Side beside the points */}
          <div
            onClick={() => {
              if (twinVideoRef.current) {
                if (twinVideoRef.current.paused) twinVideoRef.current.play().catch(() => {});
                else twinVideoRef.current.pause();
              }
            }}
            className="relative aspect-[9/16] w-full max-w-[200px] shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-[0_0_25px_-5px_rgba(0,0,0,0.8)] transition-all duration-300 hover:border-neon/60 sm:max-w-[210px] md:max-w-[220px] cursor-pointer"
          >
            <video
              ref={(el) => {
                twinVideoRef.current = el;
                if (el) {
                  el.defaultMuted = true;
                  el.muted = true;
                  el.playsInline = true;
                }
              }}
              src={twinSample?.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              webkit-playsinline="true"
              preload="metadata"
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
              Digital Twin Reel
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function Industries() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="industries">
      <SectionHeading
        eyebrow="AI Video Production for Businesses"
        title="AI Video Production for Your"
        highlight="Industry"
        description="Create industry-specific video content designed around your audience, product and marketing goals."
      />
      <div ref={sectionRef} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {industries.map((industry, i) => {
          const animationClass = isInView ? "animate-industry-card" : "opacity-0 translate-y-6";

          const isFirstCard = i === 0;

          return (
            <article
              key={industry.name}
              style={{ animationDelay: `${(i % 6) * 0.08}s` }}
              className={`panel panel-hover relative overflow-hidden p-6 transition-all duration-300 hover:border-neon/60 hover:shadow-[0_0_30px_-5px_rgba(200,80,255,0.35)] ${animationClass}`}
            >
              {industry.image ? (
                <>
                  {/* Clearly Visible Background Image with 65% opacity */}
                  <img
                    src={industry.image}
                    alt={industry.name}
                    className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] max-w-none object-cover object-right opacity-65 transition-all duration-500 group-hover:scale-105 group-hover:opacity-80"
                  />
                  {/* Balanced directional gradient: dark on bottom/left for text, transparent on top/right to see artwork */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#0b0816]/90 via-[#0b0816]/55 to-[#0b0816]/15" />
                </>
              ) : null}

              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-lg font-bold text-white transition-colors group-hover:text-neon drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {industry.name}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-white/95 font-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    {industry.description}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  <span className="text-amber-300">✦ Recommended:</span>
                  <span className="text-white font-medium">{industry.recommended}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

export function UseCases() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section className="bg-surface/40 overflow-hidden">
      <SectionHeading
        eyebrow="Use Cases"
        title="What Can You Create With"
        highlight="AI Video?"
        description="From product promotions to educational content, AI videos can be adapted for multiple marketing and communication objectives."
        center={true}
      />
      <div
        ref={sectionRef}
        className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2.5 sm:gap-3"
      >
        {useCases.map((useCase, i) => {
          const animationClass = isInView ? "animate-pill-pop" : "opacity-0 scale-75";

          return (
            <span
              key={useCase}
              style={{ animationDelay: `${i * 0.05}s` }}
              className={`rounded-full border border-border/80 bg-secondary/50 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition-all duration-300 hover:border-neon hover:bg-neon/15 hover:text-white hover:scale-105 hover:shadow-[0_0_15px_rgba(200,80,255,0.35)] md:text-sm ${animationClass}`}
            >
              {useCase}
            </span>
          );
        })}
      </div>
    </Section>
  );
}

export function Process() {
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="process" className="overflow-hidden">
      <SectionHeading
        eyebrow="How It Works"
        title="How Our AI Video Production"
        highlight="Process Works"
        description="A streamlined 6-step production pipeline engineered for rapid turnaround and pristine quality."
      />
      <div ref={containerRef} className="relative">
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {processSteps.map((step, i) => {
            const delay = `${i * 0.12}s`;
            const animClass = isInView
              ? "animate-step-card"
              : "opacity-0 [transform:perspective(800px)_rotateX(-20deg)_translateY(25px)]";

            return (
              <li
                key={step.title}
                style={{ animationDelay: delay }}
                className={`panel group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e0a1c]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-neon/70 hover:shadow-[0_0_35px_-5px_rgba(200,80,255,0.4)] ${animClass}`}
              >
                {/* Step Top Bar Scanner Line */}
                <div className="absolute left-0 top-0 h-1 w-0 bg-gradient-brand transition-all duration-500 group-hover:w-full" />

                {/* Ambient Step Number Watermark */}
                <span className="pointer-events-none absolute right-4 top-2 text-5xl font-black text-white/[0.03] transition-all duration-300 group-hover:text-neon/15 group-hover:scale-110">
                  0{i + 1}
                </span>

                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-xs font-black text-neon-foreground shadow-[0_0_15px_rgba(200,80,255,0.4)] transition-transform duration-300 group-hover:scale-110">
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-neon/80">
                    Step {i + 1} of 6
                  </span>
                </div>

                <h3 className="mt-4 text-base font-bold text-white transition-colors duration-200 group-hover:text-neon sm:text-lg">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Turnaround Time Pill */}
        <div className="panel mx-auto mt-8 flex max-w-fit items-center justify-center gap-2 rounded-full border border-amber-400/40 bg-black/40 px-6 py-3 text-center shadow-lg transition-all duration-700">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 sm:text-sm whitespace-nowrap">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <span>48–72 Working Hours Delivery</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function WhyUs() {
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Section className="bg-surface/40 overflow-hidden">
      <SectionHeading
        eyebrow="AI Video Agency"
        title="Why Choose"
        highlight="Quickupp AI Studio?"
      />
      <div
        ref={containerRef}
        className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 [perspective:1200px]"
      >
        {whyUs.map((item, idx) => {
          const delay = `${idx * 0.1}s`;
          // Unique trajectory for each card position: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
          const animClass = isInView ? `animate-why-${idx % 6}` : "opacity-0 scale-75";

          return (
            <article
              key={item.title}
              style={{ animationDelay: delay }}
              className={`panel group relative overflow-hidden p-7 transition-all duration-300 hover:-translate-y-2 hover:border-neon/60 hover:shadow-[0_0_35px_-6px_rgba(200,80,255,0.4)] will-change-transform ${animClass}`}
            >
              {/* Dynamic Top Bar Highlight */}
              <div className="absolute left-0 top-0 h-1 w-0 bg-gradient-brand transition-all duration-500 group-hover:w-full" />

              {/* Ambient Glowing Corner Orb */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-brand opacity-10 blur-xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-25" />

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_rgba(200,80,255,0.8)]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-neon/90">
                  0{idx + 1} Benefit
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold text-white transition-colors duration-200 group-hover:text-neon sm:text-xl">
                {item.title}
              </h3>

              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {item.description}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

export function LeadFormSection() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <Section id="contact">
      <SectionHeading
        eyebrow="Get a Quote"
        title="Let's Create Your Next"
        highlight="AI Video"
        description="Tell us about your business and our team will prepare and share a tailored AI video proposal."
        center={true}
      />
      <div className="panel mx-auto max-w-3xl p-6 sm:p-10">
        {submitted ? (
          <div className="py-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <BadgeCheck className="h-7 w-7" />
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-white">
              Thank You! Requirement Submitted
            </h3>
            <p className="max-w-md mx-auto text-xs sm:text-sm text-muted-foreground">
              We have received your project details. Our production team will review your
              requirements and contact you directly shortly.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="rounded-full border border-border bg-secondary/50 px-5 py-2 text-xs font-semibold text-white hover:border-neon hover:text-neon transition-colors"
              >
                Submit Another Requirement
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const form = e.currentTarget;
              const data = new FormData(form);
              const name = String(data.get("name") || "");
              const phone = String(data.get("phone") || "");
              const email = String(data.get("email") || "");
              const business = String(data.get("business") || "");
              const industry = String(data.get("industry") || "");
              const videoType = String(data.get("videoType") || "");
              const location = String(data.get("location") || "");
              const requirement = String(data.get("requirement") || "");

              // 1. Send directly to PostgreSQL Database
              try {
                await submitLeadServerFn({
                  data: {
                    source: "Contact Form",
                    name,
                    phone,
                    email,
                    business,
                    industry,
                    videoType,
                    location,
                    requirement,
                  },
                });
              } catch (err) {
                console.error("PostgreSQL submission error:", err);
              }

              // 2. Also keep local sync for Admin fast-cache
              const newLead = {
                id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                source: "Contact Form",
                name,
                phone,
                email: email || undefined,
                business,
                industry,
                video_type: videoType,
                location: location || undefined,
                requirement,
                status: "New",
                created_at: new Date().toISOString(),
              };
              try {
                const existing = JSON.parse(localStorage.getItem("ai_studio_local_leads") || "[]");
                existing.unshift(newLead);
                localStorage.setItem("ai_studio_local_leads", JSON.stringify(existing));
              } catch (err) {
                console.error(err);
              }

              setLoading(false);
              setSubmitted(true);
              form.reset();
            }}
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">Full Name*</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Your name"
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Business Name*
                </label>
                <input
                  type="text"
                  name="business"
                  required
                  placeholder="Your business"
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  WhatsApp Number*
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="+91"
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Business Industry*
                </label>
                <div className="relative mt-1.5">
                  <select
                    name="industry"
                    required
                    className="w-full appearance-none rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 pr-10 text-sm text-foreground focus:border-neon focus:outline-none cursor-pointer"
                  >
                    <option value="">Select industry</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Clinics & Doctors">Clinics & Doctors</option>
                    <option value="D2C & E-commerce">D2C & E-commerce</option>
                    <option value="Beauty & Skincare">Beauty & Skincare</option>
                    <option value="Interior Design">Interior Design</option>
                    <option value="Restaurants & Cafes">Restaurants & Cafes</option>
                    <option value="Education & Coaching">Education & Coaching</option>
                    <option value="IT & SaaS">IT & SaaS</option>
                    <option value="Finance & Insurance">Finance & Insurance</option>
                    <option value="Travel & Tourism">Travel & Tourism</option>
                    <option value="Fitness & Wellness">Fitness & Wellness</option>
                    <option value="Jewellery & Luxury">Jewellery & Luxury</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Which AI Video Are You Interested In?*
                </label>
                <div className="relative mt-1.5">
                  <select
                    name="videoType"
                    required
                    className="w-full appearance-none rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 pr-10 text-sm text-foreground focus:border-neon focus:outline-none cursor-pointer"
                  >
                    <option value="">Select video type</option>
                    <option value="AI UGC Video">AI UGC Video</option>
                    <option value="AI Cartoon Animation">AI Cartoon Animation</option>
                    <option value="AI Avatar Video">AI Avatar Video</option>
                    <option value="Hyper-Realistic AI Video">Hyper-Realistic AI Video</option>
                    <option value="AI Digital Twin / Clone">AI Digital Twin / Clone</option>
                    <option value="Not Sure - Need Guidance">Not Sure - Need Guidance</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Location / City*
                </label>
                <input
                  type="text"
                  name="location"
                  required
                  placeholder="e.g. Pune, Mumbai, Delaware"
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Approximate Budget
                </label>
                <select
                  name="budget"
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground focus:border-neon focus:outline-none"
                >
                  <option value="">Select budget</option>
                  <option value="₹2,500 - ₹5,000">₹2,500 - ₹5,000</option>
                  <option value="₹5,000 - ₹15,000">₹5,000 - ₹15,000</option>
                  <option value="₹15,000 - ₹35,000">₹15,000 - ₹35,000</option>
                  <option value="₹35,000 - ₹75,000">₹35,000 - ₹75,000</option>
                  <option value="₹75,000+">₹75,000+</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground">
                Tell Us About Your Requirement
              </label>
              <textarea
                name="requirement"
                rows={3}
                placeholder="Product, service, audience or video idea"
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-brand py-3.5 text-sm font-semibold text-neon-foreground glow-neon transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Get My AI Video Quote"}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}

export function WhatsAppCtaSection() {
  const professionalMessage = encodeURIComponent(
    "Hello Quickupp AI Studio Team,\n\nI would like to explore AI Video Production services for my business. Please share details regarding available video formats, packages, pricing, and turnaround time.\n\nLooking forward to your response.\n\nThank you!",
  );

  return (
    <section className="border-t border-border bg-surface/40 px-5 py-12 md:py-16">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Have a Video Idea? Let's Turn It Into an{" "}
          <span className="font-serif italic font-bold text-gradient-brand whitespace-nowrap">
            AI Reel.
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Send us your product, service or video idea on WhatsApp and our team will recommend the
          right AI video format for your business.
        </p>
        <div className="mt-6 flex justify-center">
          <a
            href={`https://wa.me/919970344139?text=${professionalMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-105"
          >
            <MessageCircle className="h-4 w-4" />
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Section id="faq">
      <SectionHeading
        eyebrow="AI Video Production"
        title="Frequently Asked Questions About AI Video Production"
        center={true}
      />
      <div className="panel mx-auto max-w-4xl divide-y divide-border/60 overflow-hidden shadow-card">
        {faqs.map((faq, i) => (
          <div
            key={faq.question}
            onMouseEnter={() => setOpen(i)}
            onMouseLeave={() => setOpen(null)}
            className={`transition-colors duration-200 ${
              open === i ? "bg-secondary/30" : "hover:bg-secondary/15"
            }`}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-sm font-semibold text-foreground transition-colors hover:text-neon md:text-base cursor-pointer"
              aria-expanded={open === i}
            >
              <span className={open === i ? "text-neon" : ""}>{faq.question}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                  open === i ? "rotate-180 text-neon" : ""
                }`}
              />
            </button>
            {open === i ? (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200 px-6 pb-5 pt-1 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Contact() {
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="final-cta" className="scroll-mt-[72px] px-5 py-8 md:py-12 overflow-hidden">
      <div ref={containerRef} className="mx-auto w-full max-w-5xl">
        <div
          className={`panel relative mx-auto overflow-hidden p-6 text-center sm:p-8 md:p-12 transition-all duration-700 hover:border-neon/70 hover:shadow-[0_0_50px_-5px_rgba(200,80,255,0.45)] ${
            isInView ? "animate-cta-float" : "opacity-0 translate-y-8"
          }`}
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          {/* Ambient Glowing Orbs */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-neon/15 blur-2xl transition-all duration-700 group-hover:scale-125" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-44 w-44 rounded-full bg-[#60a5fa]/15 blur-2xl transition-all duration-700 group-hover:scale-125" />

          {/* Top Neon Scanner Bar on Hover */}
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-brand opacity-80" />

          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-neon" />
            Contact
          </span>
          <h2 className="mx-auto mt-3.5 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Ready to Create Your Next{" "}
            <span className="font-serif italic text-gradient-brand">AI Video?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-normal leading-relaxed text-foreground/90 md:text-base">
            Turn your product, service or idea into engaging AI-powered video content.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Whether you need an <span className="text-foreground font-medium">AI UGC video</span>,{" "}
            <span className="text-foreground font-medium">AI avatar reel</span>,{" "}
            <span className="text-foreground font-medium">cartoon animation</span>,{" "}
            <span className="text-foreground font-medium">hyper-realistic AI advertisement</span> or{" "}
            <span className="text-foreground font-medium">digital twin video</span>, Quickupp AI
            Studio can help you create professional video content for social media, advertising and
            brand communication.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <NeonButton href="#contact">Get Your AI Video Quote</NeonButton>
            <NeonButton href="#samples" variant="ghost">
              View Video Samples
            </NeonButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const footerGroups = [
    {
      title: "AI Video Services",
      links: [
        { label: "AI UGC Videos", href: "#services" },
        { label: "AI Cartoon Animation", href: "#services" },
        { label: "AI Avatar Videos", href: "#services" },
        { label: "Hyper-Realistic AI Videos", href: "#services" },
        { label: "AI Digital Twin Videos", href: "#services" },
        { label: "Bulk Reels Packages", href: "#pricing" },
      ],
    },
    {
      title: "Company & Links",
      links: [
        { label: "About Us", href: "#top" },
        { label: "Video Portfolio", href: "#portfolio" },
        { label: "Pricing Tiers", href: "#pricing" },
        { label: "Our Process", href: "#process" },
        { label: "FAQs", href: "#faq" },
        { label: "Get a Quote", href: "#contact" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-border/80 bg-[#08070e] px-5 pt-12 pb-8 text-foreground md:pt-16 overflow-hidden">
      {/* Seamless atmospheric radial glow covering the entire bottom of the footer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[600px] w-full select-none"
        style={{
          background:
            "radial-gradient(ellipse 110% 80% at 50% 90%, rgba(200, 50, 255, 0.35) 0%, rgba(130, 45, 255, 0.22) 40%, rgba(40, 110, 255, 0.1) 65%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex flex-col">
        {/* Main Footer Grid: 4 Clean Columns across full width */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 items-start">
          {/* Col 1: Brand & Bio ONLY */}
          <div className="flex flex-col items-start gap-3.5">
            <a href="#top" className="-ml-1 flex items-center transition-opacity hover:opacity-90">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio logo"
                className="h-9 md:h-10 w-auto object-contain"
                loading="lazy"
                width={125}
                height={40}
              />
            </a>
            <p className="text-sm font-semibold text-neon">{footerTagline}</p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {footerDescription}
            </p>
          </div>

          {/* Col 2: AI Video Services */}
          <div className="flex flex-col gap-3">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
              {footerGroups[0].title}
            </h4>
            <ul className="space-y-2.5">
              {footerGroups[0].links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-xs text-muted-foreground transition-colors hover:text-neon sm:text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Company & Quick Links */}
          <div className="flex flex-col gap-3">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
              {footerGroups[1].title}
            </h4>
            <ul className="space-y-2.5">
              {footerGroups[1].links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-xs text-muted-foreground transition-colors hover:text-neon sm:text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Locations & Contact */}
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
                Our Locations
              </h4>
              <div className="mt-2.5 flex flex-col gap-2 text-xs sm:text-sm">
                <a
                  href={footerIndiaMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-muted-foreground hover:text-neon transition-colors"
                >
                  <MapPin className="h-4 w-4 text-neon shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white group-hover:text-neon">
                      India Office:{" "}
                    </span>
                    <span>{footerIndiaAddress}</span>
                  </div>
                </a>

                <a
                  href={footerUsaMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-muted-foreground hover:text-[#60a5fa] transition-colors"
                >
                  <MapPin className="h-4 w-4 text-[#60a5fa] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white group-hover:text-[#60a5fa]">
                      USA Office:{" "}
                    </span>
                    <span>{footerUsaAddress}</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Direct Email and Phone Contact Links */}
            <div className="border-t border-white/10 pt-3 flex flex-col gap-2 text-xs sm:text-sm">
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${footerEmail}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-neon"
                title="Send email via Gmail"
              >
                <Mail className="h-4 w-4 text-neon shrink-0" />
                <span>{footerEmail}</span>
              </a>

              <a
                href={`tel:${footerPhone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-emerald-400"
                title="Call Quickupp AI Studio"
              >
                <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-mono">{footerPhone}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Brand Giant Logo seamlessly integrated inside the footer */}
        <div className="mt-10 mb-6 md:mt-12 md:mb-8 flex items-center justify-center select-none">
          <img
            src="/images/footer logo.png"
            alt="Quickupp AI Studio"
            className="w-full max-w-5xl h-auto max-h-[160px] sm:max-h-[220px] md:max-h-[300px] object-contain drop-shadow-[0_0_50px_rgba(200,50,255,0.25)]"
            loading="lazy"
          />
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 pb-2 text-center text-xs text-muted-foreground sm:flex-row">
          <p>{footerCopyright}</p>
          <div className="flex items-center gap-4">
            <a href="/privacy-policy" className="hover:text-neon transition-colors">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="/terms" className="hover:text-neon transition-colors">
              Terms & Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function FloatingWhatsAppButton() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
      {/* Scroll to Top Floating Button (Visible once user scrolls > 300px) */}
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`flex h-12 w-12 items-center justify-center rounded-full border border-neon/40 bg-[#120f20]/95 text-neon shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-neon hover:bg-neon hover:text-black hover:scale-110 hover:shadow-[0_0_20px_rgba(200,80,255,0.5)] active:scale-95 ${
          showScrollTop
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      {/* Official WhatsApp Floating Button */}
      <a
        href={`https://wa.me/919970344139?text=${encodeURIComponent(
          "Hello Quickupp AI Studio Team,\n\nI would like to explore AI Video Production services for my business. Please share details regarding available video formats, packages, pricing, and turnaround time.\n\nLooking forward to your response.\n\nThank you!",
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Quickupp AI Studio on WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(37,211,102,0.65)] active:scale-95"
      >
        {/* Official WhatsApp SVG Vector Icon */}
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm-3.6 3.63c-.2 0-.42.01-.6.04-.24.04-.52.14-.72.37-.25.28-.97.95-.97 2.32s.99 2.69 1.13 2.87c.14.19 1.95 2.98 4.73 4.18.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33-.28-.14-1.63-.8-1.88-.89-.25-.09-.44-.14-.62.14-.19.28-.72.89-.88 1.07-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.4-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.86-2.05-.22-.53-.46-.46-.62-.47z" />
        </svg>
      </a>
    </div>
  );
}

export function QuotePopupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Popup on every website refresh / load after 1.2s
    const initialTimer = setTimeout(() => {
      setIsOpen(true);
    }, 1200);

    // 2. Repeat popup every 5 minutes (300,000 ms)
    const recurringTimer = setInterval(() => {
      setIsOpen(true);
    }, 300000);

    // 3. Listen for manual trigger events across buttons
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener("open-quote-modal", handleOpenEvent);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(recurringTimer);
      window.removeEventListener("open-quote-modal", handleOpenEvent);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("ai_studio_modal_dismissed", "true");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-[4px] animate-in fade-in duration-300">
      <div className="panel relative max-h-[96vh] w-full max-w-lg overflow-y-auto overflow-x-hidden border-neon/40 p-5 shadow-2xl glow-neon sm:p-7">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-3.5 top-3.5 rounded-full border border-border bg-secondary/70 p-1.5 text-muted-foreground transition-colors hover:border-neon hover:text-neon"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3.5 animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <BadgeCheck className="h-7 w-7" />
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-white">Thank You!</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              Your video inquiry has been received. Our team will review your requirements and reach
              out to you directly with a proposal.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-full bg-gradient-brand py-2.5 text-sm font-semibold text-neon-foreground shadow-md hover:brightness-110 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="pr-6 text-center sm:pr-0">
              <span className="eyebrow py-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-neon" />
                Get a Quote
              </span>
              <h3 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                Let's Create Your Next{" "}
                <span className="font-serif italic text-gradient-brand">AI Video</span>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Fill in your details below and our team will get in touch with a customized quote.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                const form = e.currentTarget;
                const data = new FormData(form);
                const name = String(data.get("name") || "");
                const phone = String(data.get("phone") || "");
                const email = String(data.get("email") || "");
                const videoType = String(data.get("videoType") || "");
                const business = String(data.get("business") || "");
                const location = String(data.get("location") || "");
                const additional = String(data.get("additional") || "");

                // 1. Send directly to PostgreSQL Database
                try {
                  await submitLeadServerFn({
                    data: {
                      source: "Popup Modal",
                      name,
                      phone,
                      email,
                      videoType,
                      business,
                      location,
                      additional,
                    },
                  });
                } catch (err) {
                  console.error("PostgreSQL modal submission error:", err);
                }

                // 2. Also keep local sync for Admin fast-cache
                const newLead = {
                  id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  source: "Popup Modal",
                  name,
                  phone,
                  email: email || undefined,
                  business,
                  video_type: videoType,
                  location: location || undefined,
                  requirement: additional || undefined,
                  status: "New",
                  created_at: new Date().toISOString(),
                };
                try {
                  const existing = JSON.parse(
                    localStorage.getItem("ai_studio_local_leads") || "[]",
                  );
                  existing.unshift(newLead);
                  localStorage.setItem("ai_studio_local_leads", JSON.stringify(existing));
                } catch (err) {
                  console.error(err);
                }

                setLoading(false);
                setSubmitted(true);
                form.reset();
              }}
              className="mt-4 space-y-3"
            >
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Full Name <span className="text-neon">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. John Doe"
                    className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none sm:text-sm"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Phone Number <span className="text-neon">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Email Address <span className="text-neon">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@company.com"
                    className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none sm:text-sm"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Type of AI Video <span className="text-neon">*</span>
                  </label>
                  <div className="relative mt-1">
                    <select
                      name="videoType"
                      required
                      defaultValue=""
                      className="w-full appearance-none rounded-lg border border-border bg-secondary/40 px-3 py-2 pr-9 text-xs text-foreground focus:border-neon focus:outline-none sm:text-sm cursor-pointer"
                    >
                      <option value="" disabled className="bg-[#121019] text-muted-foreground">
                        Select video type...
                      </option>
                      <option value="AI UGC Video" className="bg-[#121019] text-foreground">
                        AI UGC Video
                      </option>
                      <option value="AI Cartoon Animation" className="bg-[#121019] text-foreground">
                        AI Cartoon Animation
                      </option>
                      <option value="AI Avatar Video" className="bg-[#121019] text-foreground">
                        AI Avatar Video
                      </option>
                      <option
                        value="Hyper-Realistic AI Video"
                        className="bg-[#121019] text-foreground"
                      >
                        Hyper-Realistic AI Video
                      </option>
                      <option
                        value="AI Digital Twin / Clone"
                        className="bg-[#121019] text-foreground"
                      >
                        AI Digital Twin / Clone
                      </option>
                      <option value="Monthly Bulk Package" className="bg-[#121019] text-foreground">
                        Monthly Package (5-15 Reels)
                      </option>
                      <option value="Custom Requirement" className="bg-[#121019] text-foreground">
                        Custom AI Video
                      </option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                  </div>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Your Business / Brand <span className="text-neon">*</span>
                  </label>
                  <input
                    type="text"
                    name="business"
                    required
                    placeholder="e.g. Skincare, Real Estate..."
                    className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none sm:text-sm"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Location (City / Country) <span className="text-neon">*</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    placeholder="e.g. Pune, India"
                    className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div className="w-full">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-foreground sm:text-xs">
                    Additional Notes
                  </label>
                  <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>
                </div>
                <textarea
                  name="additional"
                  rows={2}
                  placeholder="Any specific duration, language, script ideas..."
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-brand py-2.5 text-xs font-bold uppercase tracking-wider text-neon-foreground shadow-lg glow-neon transition-all hover:brightness-110 disabled:opacity-50 sm:py-3 sm:text-sm"
              >
                {loading ? "Submitting..." : "Submit & Request Quote"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
