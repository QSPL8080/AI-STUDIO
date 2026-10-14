import React, { useState, useEffect, useRef } from "react";
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
  Maximize2,
  X,
  RotateCcw,
  Film,
  ArrowRight,
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
    videoUrl: "/videos/page-1.mp4",
    fallbackUrl: "/videos/page%201.mp4",
    duration: "42s",
    gradient: "from-purple-900/40 via-violet-950/30 to-black/80",
  },
  {
    id: "reel-2",
    category: "AI Avatar",
    title: "Architectural Stone Presenter",
    subtitle: "Studio-grade AI avatar presenter demonstrating modern residential & commercial stone finishes",
    industry: "Real Estate & Home Decor",
    videoUrl: "/videos/page-2.mp4",
    fallbackUrl: "/videos/Page%202.mp4",
    duration: "45s",
    gradient: "from-blue-900/40 via-indigo-950/30 to-black/80",
  },
  {
    id: "reel-3",
    category: "Hyper-Realistic",
    title: "Royal Heritage & Saree",
    subtitle: "Cinematic commercial reel with grand heritage palace architecture and traditional elegance",
    industry: "Luxury Fashion & Heritage",
    videoUrl: "/videos/page-3.mp4",
    fallbackUrl: "/videos/Page%203.mp4",
    duration: "45s",
    gradient: "from-rose-900/40 via-purple-950/30 to-black/80",
  },
  {
    id: "reel-4",
    category: "AI Cartoon",
    title: "3D Character Explainer",
    subtitle: "Engaging animated mascot storytelling engineered for viral social engagement & brand recall",
    industry: "Animated Brands & EdTech",
    videoUrl: "/videos/page-4.mp4",
    fallbackUrl: "/videos/Page%204.mp4",
    duration: "40s",
    gradient: "from-amber-900/40 via-orange-950/30 to-black/80",
  },
  {
    id: "reel-5",
    category: "Digital Twin",
    title: "Founder Keynote Clone",
    subtitle: "Ultra-realistic voice clone & lip-sync model for scalable executive branding & content",
    industry: "Personal Brand & Leadership",
    videoUrl: "/videos/page-5.mp4",
    fallbackUrl: "/videos/Page%205.mp4",
    duration: "37s",
    gradient: "from-emerald-900/40 via-teal-950/30 to-black/80",
  },
  {
    id: "reel-6",
    category: "AI UGC",
    title: "Activewear Performance Demo",
    subtitle: "Dynamic vertical reel demonstration engineered for high conversions across Meta & TikTok ads",
    industry: "Fitness, Health & Apparel",
    videoUrl: "/videos/page-6.mp4",
    fallbackUrl: "/videos/Page%206.mp4",
    duration: "39s",
    gradient: "from-cyan-900/40 via-blue-950/30 to-black/80",
  },
];

interface PortfolioReelCardProps {
  reel: PortfolioReelItem;
  isActive: boolean;
  onActivate: (id: string) => void;
  onExpand: (reel: PortfolioReelItem) => void;
}

function PortfolioReelCard({ reel, isActive, onActivate, onExpand }: PortfolioReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  // Synchronize playback with active card state (ensures only 1 heavy video streams at a time)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.defaultMuted = true;
      video.muted = isMuted;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch(() => {
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    }
  }, [isActive, isMuted]);

  // Keep in view observer with relaxed margin so minor scrolls don't pause playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && isActive) {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.05, rootMargin: "150px 0px 150px 0px" }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [isActive]);

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

    if (!isActive) {
      onActivate(reel.id);
      return;
    }

    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!isActive) onActivate(reel.id);
    if (!nextMuted && video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * video.duration;
    video.currentTime = Math.max(0, Math.min(newTime, video.duration));
    if (!isActive) onActivate(reel.id);
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
        isActive
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
          muted={isMuted}
          loop
          playsInline
          preload={isActive ? "auto" : "metadata"}
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

          {/* Expand Lightbox Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(reel);
            }}
            className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white/90 shadow transition-all duration-200 hover:scale-110 hover:border-neon hover:text-neon cursor-pointer"
            title="Expand reel preview"
            aria-label="Expand reel preview"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white/80" />
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

interface ReelLightboxProps {
  reel: PortfolioReelItem | null;
  onClose: () => void;
}

function ReelLightbox({ reel, onClose }: ReelLightboxProps) {
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!reel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [reel, onClose]);

  if (!reel) return null;

  const toggleModalPlay = () => {
    const video = modalVideoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleModalMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = modalVideoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleModalSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = modalVideoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * video.duration;
    video.currentTime = Math.max(0, Math.min(newTime, video.duration));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col lg:flex-row items-center max-w-4xl w-full bg-[#0c0919] border border-white/15 rounded-3xl overflow-hidden shadow-2xl max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white/90 hover:bg-white/20 transition-all cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 9:16 Vertical Reel Player Container */}
        <div className="relative aspect-[9/16] w-full max-w-[340px] sm:max-w-[380px] bg-black flex-shrink-0 overflow-hidden">
          <video
            ref={modalVideoRef}
            src={reel.videoUrl}
            autoPlay
            loop
            playsInline
            muted={isMuted}
            preload="auto"
            onTimeUpdate={() => {
              if (modalVideoRef.current?.duration) {
                setProgress((modalVideoRef.current.currentTime / modalVideoRef.current.duration) * 100);
              }
            }}
            className="w-full h-full object-cover"
          >
            <source src={reel.videoUrl} type="video/mp4" />
            <source src={reel.fallbackUrl} type="video/mp4" />
          </video>

          {/* Tap overlay to play/pause */}
          <button
            type="button"
            onClick={toggleModalPlay}
            className="absolute inset-0 w-full h-full cursor-pointer z-10 bg-transparent border-none"
            aria-label={isPlaying ? "Pause" : "Play"}
          />

          {/* Sound Toggle (Top Left) */}
          <div className="absolute top-4 left-4 z-20">
            <button
              type="button"
              onClick={toggleModalMute}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white shadow hover:scale-110 transition-transform cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>

          {/* Center Play indicator */}
          {!isPlaying && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-gradient-brand text-neon-foreground flex items-center justify-center shadow-xl">
                <Play className="w-7 h-7 fill-white translate-x-0.5 text-white" />
              </div>
            </div>
          )}

          {/* Bottom Progress Bar */}
          <div
            onClick={handleModalSeek}
            className="absolute bottom-0 left-0 right-0 h-2 bg-white/20 cursor-pointer z-20"
          >
            <div
              className="h-full bg-gradient-brand"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Modal Side Information & Direct CTA */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto max-h-[85vh]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/60 border border-neon/30 text-neon text-xs font-bold uppercase tracking-wider mb-4 font-heading">
              <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
              {reel.category}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight font-heading">
              {reel.title}
            </h2>
            <p className="text-xs text-neon font-semibold uppercase tracking-wider mt-1 font-heading">
              Industry: {reel.industry} • Duration: {reel.duration}
            </p>

            <p className="text-sm text-muted-foreground mt-4 leading-relaxed font-sans">
              {reel.subtitle}
            </p>

            <div className="mt-6 space-y-2.5 text-xs text-muted-foreground/90 border-t border-white/10 pt-4 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon shrink-0" />
                <span>True 9:16 Vertical Reel format optimized for Instagram, TikTok & Shorts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon shrink-0" />
                <span>Ultra HD 1080x1920 crisp export with professional audio mixing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon shrink-0" />
                <span>Custom brand assets, product placements, and conversion-focused scripting</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3">
            <a
              href="/#contact"
              onClick={onClose}
              className="flex-1 py-3 px-5 rounded-full bg-gradient-brand text-neon-foreground font-bold text-xs text-center shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer font-heading"
            >
              <span>Get Reel Quote</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={`https://wa.me/918177828748?text=${encodeURIComponent(
                `Hello Quickupp AI Studio Team,\n\nI was watching the "${reel.title}" (${reel.category}) reel in your portfolio and would like to order a similar video for my brand.\n\nWebsite: https://quickuppaistudio.in/\nEmail: info@quickuppaistudio.in`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="py-3 px-5 rounded-full border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 font-semibold text-xs text-center flex items-center justify-center gap-2 transition-colors cursor-pointer font-heading"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioPage() {
  const [activePlayingId, setActivePlayingId] = useState<string>("reel-1");
  const [expandedReel, setExpandedReel] = useState<PortfolioReelItem | null>(null);

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
            Explore 6 high-converting AI-powered video concepts created across interior architecture, luxury real estate, heritage commercial, animated storytelling, and lifestyle fitness categories.
          </p>
        </div>

        {/* 6 Reels Grid in True 9:16 Vertical Reel Format (No filter bar, all 6 reels immediately accessible) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto justify-items-center">
          {PORTFOLIO_REELS.map((reel) => (
            <PortfolioReelCard
              key={reel.id}
              reel={reel}
              isActive={activePlayingId === reel.id}
              onActivate={(id) => setActivePlayingId(id)}
              onExpand={(item) => setExpandedReel(item)}
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
              href={`https://wa.me/918177828748?text=${encodeURIComponent(
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

      {/* Expanded Reel Lightbox Modal */}
      <ReelLightbox
        reel={expandedReel}
        onClose={() => setExpandedReel(null)}
      />

      <Footer />
      <FloatingWhatsAppButton />
      <QuotePopupModal />
    </div>
  );
}
