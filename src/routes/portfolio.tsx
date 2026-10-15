import React, { useState, useEffect, useRef } from "react";
import { IndiaCheckoutModal } from "@/components/site/india-checkout";
import { createFileRoute } from "@tanstack/react-router";
import {
  Header,
  Footer,
  FloatingWhatsAppButton,
  QuotePopupModal,
} from "@/components/site/sections";
import {
  Clock,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Film,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio | Quickupp AI Studio" },
      {
        name: "description",
        content:
          "Explore AI-powered video concepts created across interior architecture, luxury real estate, heritage commercial, animated storytelling, and lifestyle fitness categories.",
      },
    ],
  }),
  component: PortfolioPage,
});

export interface PortfolioReelItem {
  id: string;
  category: "AI UGC" | "AI Avatar" | "Hyper-Realistic" | "AI Cartoon" | "Digital Twin";
  title: string;
  subtitle: string;
  industry: string;
  videoUrl: string;
  fallbackUrl: string;
  /** First-frame image shown instantly while the video loads. */
  posterUrl: string;
  duration: string;
  gradient: string;
}

const PORTFOLIO_REELS: PortfolioReelItem[] = [
  {
    id: "reel-1",
    category: "AI UGC",
    title: "Bharat Stone Lifestyle",
    subtitle: "High-impact creator-led demonstration reel highlighting luxury architectural stone surfaces",
    industry: "Interior Architecture & Luxury",
    videoUrl: "/media/page-1.mp4",
    fallbackUrl: "/videos/page-1.mp4",
    posterUrl: "/videos/posters/page-1.jpg",
    duration: "42s",
    gradient: "from-purple-900/40 via-violet-950/30 to-black/80",
  },
  {
    id: "home-cartoon",
    category: "AI Cartoon",
    title: "3D Character Animation",
    subtitle: "Expressive 3D character animation and storytelling reel for creative brands and entertainment",
    industry: "Creative Brands & Entertainment",
    videoUrl: "/media/cartoon-portfolio.mp4",
    fallbackUrl: "/videos/cartoon-portfolio.mp4",
    posterUrl: "/videos/posters/cartoon-portfolio.jpg",
    duration: "20s",
    gradient: "from-amber-900/40 via-orange-950/30 to-black/80",
  },
  {
    id: "reel-2",
    category: "AI Avatar",
    title: "Architectural Stone Presenter",
    subtitle: "Studio-grade AI avatar presenter demonstrating modern residential & commercial stone finishes",
    industry: "Real Estate & Home Decor",
    videoUrl: "/media/page-2.mp4",
    fallbackUrl: "/videos/page-2.mp4",
    posterUrl: "/videos/posters/page-2.jpg",
    duration: "45s",
    gradient: "from-blue-900/40 via-indigo-950/30 to-black/80",
  },
  {
    id: "home-ugc",
    category: "AI UGC",
    title: "Creator-Led Product Review",
    subtitle: "Authentic creator-led AI UGC product review and demonstration reel designed for high conversions",
    industry: "D2C & Consumer Brands",
    videoUrl: "/media/ugc-portfolio.mp4",
    fallbackUrl: "/videos/ugc-portfolio.mp4",
    posterUrl: "/videos/posters/ugc-portfolio.jpg",
    duration: "29s",
    gradient: "from-purple-900/40 via-violet-950/30 to-black/80",
  },
  {
    id: "reel-3",
    category: "Hyper-Realistic",
    title: "Royal Heritage & Saree",
    subtitle: "Cinematic commercial reel with grand heritage palace architecture and traditional elegance",
    industry: "Luxury Fashion & Heritage",
    videoUrl: "/media/page-3.mp4",
    fallbackUrl: "/videos/page-3.mp4",
    posterUrl: "/videos/posters/page-3.jpg",
    duration: "45s",
    gradient: "from-rose-900/40 via-purple-950/30 to-black/80",
  },
  {
    id: "home-digital-twin",
    category: "Digital Twin",
    title: "Founder Brand Update",
    subtitle: "Founder-led brand update reel powered by a hyper-realistic digital twin, no camera or studio needed",
    industry: "Founders & Personal Brands",
    videoUrl: "/media/digital-twin-sample.mp4",
    fallbackUrl: "/videos/digital-twin-sample.mp4",
    posterUrl: "/videos/posters/digital-twin-sample.jpg",
    duration: "78s",
    gradient: "from-emerald-900/40 via-teal-950/30 to-black/80",
  },
  {
    id: "reel-4",
    category: "AI Cartoon",
    title: "3D Character Explainer",
    subtitle: "Engaging animated mascot storytelling engineered for viral social engagement & brand recall",
    industry: "Animated Brands & EdTech",
    videoUrl: "/media/page-4.mp4",
    fallbackUrl: "/videos/page-4.mp4",
    posterUrl: "/videos/posters/page-4.jpg",
    duration: "40s",
    gradient: "from-amber-900/40 via-orange-950/30 to-black/80",
  },
  {
    id: "home-avatar",
    category: "AI Avatar",
    title: "Interior Design Growth Presenter",
    subtitle: "AI avatar presenter reel showcasing 360° growth solutions and premium client acquisition for interior designers",
    industry: "Interior Design & Architecture",
    videoUrl: "/media/avatar-portfolio.mp4",
    fallbackUrl: "/videos/avatar-portfolio.mp4",
    posterUrl: "/videos/posters/avatar-portfolio.jpg",
    duration: "71s",
    gradient: "from-blue-900/40 via-indigo-950/30 to-black/80",
  },
  {
    id: "reel-5",
    category: "Digital Twin",
    title: "Founder Keynote Clone",
    subtitle: "Ultra-realistic voice clone & lip-sync model for scalable executive branding & content",
    industry: "Personal Brand & Leadership",
    videoUrl: "/media/page-5.mp4",
    fallbackUrl: "/videos/page-5.mp4",
    posterUrl: "/videos/posters/page-5.jpg",
    duration: "37s",
    gradient: "from-emerald-900/40 via-teal-950/30 to-black/80",
  },
  {
    id: "home-jewellery",
    category: "Hyper-Realistic",
    title: "Luxury Jewellery Collection",
    subtitle: "Cinematic product advertisement for a luxury jewellery collection",
    industry: "Jewellery & Luxury",
    videoUrl: "/media/jewellery-portfolio.mp4",
    fallbackUrl: "/videos/jewellery-portfolio.mp4",
    posterUrl: "/videos/posters/jewellery-portfolio.jpg",
    duration: "49s",
    gradient: "from-rose-900/40 via-purple-950/30 to-black/80",
  },
  {
    id: "reel-6",
    category: "AI UGC",
    title: "Activewear Performance Demo",
    subtitle: "Dynamic vertical reel demonstration engineered for high conversions across Meta & TikTok ads",
    industry: "Fitness, Health & Apparel",
    videoUrl: "/media/page-6.mp4",
    fallbackUrl: "/videos/page-6.mp4",
    posterUrl: "/videos/posters/page-6.jpg",
    duration: "39s",
    gradient: "from-cyan-900/40 via-blue-950/30 to-black/80",
  },
  {
    id: "home-production",
    category: "Hyper-Realistic",
    title: "Cinematic AI Production",
    subtitle: "Professional AI-powered video production reel showcasing cinematic quality and brand storytelling",
    industry: "Brand Storytelling",
    videoUrl: "/media/portfolio-6.mp4",
    fallbackUrl: "/videos/portfolio-6.mp4",
    posterUrl: "/videos/posters/portfolio-6.jpg",
    duration: "58s",
    gradient: "from-cyan-900/40 via-blue-950/30 to-black/80",
  },
];

interface PortfolioReelCardProps {
  reel: PortfolioReelItem;
  /** True for the one reel the visitor unmuted; all other reels stay muted. */
  hasSound: boolean;
  onSound: (id: string | null) => void;
}

function PortfolioReelCard({ reel, hasSound, onSound }: PortfolioReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);
  const userPausedRef = useRef(false);
  const isMuted = !hasSound;

  // Every reel autoplays (muted) while it is on screen and pauses when scrolled away.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.defaultMuted = true;
    video.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (!userPausedRef.current) video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [hasError]);

  // Sound: only the reel the visitor chose plays with sound; every other reel stays muted.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !hasSound;
    if (hasSound && video.paused) {
      userPausedRef.current = false;
      video.play().catch(() => {
        // Browser refused audio playback: fall back to muted.
        video.muted = true;
        onSound(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSound]);

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
      if (isBuffering) setIsBuffering(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      userPausedRef.current = false;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSound(hasSound ? null : reel.id);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * video.duration;
    video.currentTime = Math.max(0, Math.min(newTime, video.duration));
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <article
      onClick={togglePlay}
      className={`group relative flex aspect-[9/16] w-full max-w-[360px] flex-col justify-between overflow-hidden rounded-[26px] border bg-[#0c0919] shadow-2xl transition-all duration-300 cursor-pointer ${
        hasSound
          ? "border-neon shadow-[0_0_40px_rgba(200,80,255,0.35)] scale-[1.01]"
          : "border-border/70 hover:border-neon/60 hover:shadow-[0_0_25px_rgba(200,80,255,0.2)]"
      }`}
    >
      {/* Background HTML5 Video element with direct src to avoid black frames */}
      {!hasError ? (
        <video
          ref={videoRef}
          key={reel.id}
          src={reel.videoUrl}
          poster={reel.posterUrl}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          onTimeUpdate={onTimeUpdate}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onCanPlay={() => setIsBuffering(false)}
          onError={() => setHasError(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        >
          <source src={reel.videoUrl} type="video/mp4" />
          <source src={reel.fallbackUrl} type="video/mp4" />
        </video>
      ) : (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b ${reel.gradient} p-6 text-center`}>
          <Film className="w-10 h-10 text-neon/60" />
          <p className="text-xs font-semibold text-white/80 font-heading">Reel preview offline</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[11px] text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Cinematic Soft Gradient Overlays for contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/60 pointer-events-none z-10" />

      {/* Top Header Bar: Category Tag & Controls */}
      <div className="relative z-20 flex items-center justify-between p-4 sm:p-5 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-neon/40 text-neon shadow-md font-heading">
          <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
          {reel.category}
        </span>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white/90 shadow transition-all duration-200 hover:scale-110 hover:border-neon hover:text-neon cursor-pointer"
            title={isMuted ? "Unmute audio" : "Mute audio"}
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-white/80" />
            ) : (
              <Volume2 className="w-4 h-4 text-neon" />
            )}
          </button>

        </div>
      </div>

      {/* Center Buffering Spinner or Play/Pause Indicator */}
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          isBuffering || !isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {isBuffering ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 backdrop-blur-md border border-neon/50 text-neon shadow-[0_0_20px_rgba(200,80,255,0.5)]">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : (
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-brand text-neon-foreground shadow-[0_0_30px_rgba(217,70,239,0.7)] backdrop-blur-md border border-white/20 transition-transform duration-200">
            {isPlaying ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="ml-0.5 h-6 w-6 text-white fill-white" />
            )}
          </div>
        )}
      </div>

      {/* Bottom Container: Info Card & Scrubbable Progress Line */}
      <div className="relative z-20 flex flex-col pointer-events-none">
        {/* Info Card with frosted backing */}
        <div className="p-4 sm:p-5">
          <div className="space-y-1 rounded-2xl bg-black/80 p-3 sm:p-3.5 backdrop-blur-md border border-white/10 shadow-xl">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wide">
              <span className="text-neon uppercase font-heading">{reel.industry}</span>
              <span className="text-muted-foreground flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-neon" /> {reel.duration} Reel
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight font-heading">
              {reel.title}
            </h3>
            <p className="text-[11px] sm:text-xs text-white/80 line-clamp-2 leading-relaxed font-sans">
              {reel.subtitle}
            </p>
          </div>
        </div>

        {/* Live Scrubbable Progress Bar */}
        <div
          onClick={handleSeek}
          className="relative w-full h-1.5 bg-white/15 cursor-pointer pointer-events-auto group/progress transition-all hover:h-2.5"
          title="Click to seek"
        >
          <div
            className="h-full bg-gradient-brand shadow-[0_0_12px_rgba(217,70,239,0.9)] transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function PortfolioPage() {
  const [soundId, setSoundId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-background text-foreground antialiased selection:bg-neon selection:text-black">
      <Header />

      {/* Main Content: generous padding so the fixed navbar with announcement bar never covers content */}
      <main className="pt-36 sm:pt-40 md:pt-44 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          {/* Eyebrow badge matching website brand style */}
          <div className="mb-4 sm:mb-5">
            <span className="eyebrow">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neon shadow-[0_0_8px_#c850ff]" />
              </span>
              Portfolio Showcase
            </span>
          </div>

          {/* Headline matching exact site hero typography from Image 2 */}
          <h1 className="font-[var(--font-google-sans)] text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">
            See What AI Creative{" "}
            <span className="font-serif italic font-bold text-gradient-brand whitespace-nowrap inline-block pr-1.5">
              Can Look Like
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-sans">
            Explore 12 high-converting AI-powered video concepts created across interior architecture, luxury real estate, heritage commercial, jewellery, D2C brands, animated storytelling, founder branding and lifestyle fitness.
          </p>
        </div>

        {/* Reels grid in true 9:16 vertical format: the 6 portfolio-page reels with the 6 home page reels in between */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto justify-items-center">
          {PORTFOLIO_REELS.map((reel) => (
            <PortfolioReelCard
              key={reel.id}
              reel={reel}
              hasSound={soundId === reel.id}
              onSound={setSoundId}
            />
          ))}
        </div>

        {/* Bottom CTA Box */}
        <div className="mt-16 text-center max-w-2xl mx-auto p-8 rounded-3xl border border-border/80 bg-secondary/30 backdrop-blur-xl">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-heading">
            Need Custom AI Videos for Your Brand?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-sans">
            We produce custom AI UGC, Avatar, Cartoon, and Hyper-Realistic video ads tailored specifically for your target audience.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/#contact"
              className="px-6 py-2.5 rounded-full bg-gradient-brand text-neon-foreground text-xs font-bold shadow-lg hover:brightness-110 transition-all cursor-pointer font-heading"
            >
              Get Custom Video Quote
            </a>
            <a
              href={`https://wa.me/918055679162?text=${encodeURIComponent(
                "Hello Quickupp AI Studio Team,\n\nI visited your portfolio page and would like to explore custom AI video creation for my business.\n\nWebsite: https://quickuppaistudio.in/\nEmail: info@quickuppaistudio.in"
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-2.5 rounded-full border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer font-heading"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsAppButton />
      <QuotePopupModal />
      <IndiaCheckoutModal />
    </div>
  );
}
