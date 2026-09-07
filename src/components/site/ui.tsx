import type { ReactNode } from "react";

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-[72px] px-4 py-8 sm:px-6 sm:py-10 md:py-12 lg:py-14 ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  highlight,
  description,
  center = true,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-8 sm:mb-10 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <span className="eyebrow">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neon shadow-[0_0_8px_#c850ff]"></span>
        </span>
        {eyebrow}
      </span>
      <h2 className="mt-3.5 font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl text-white">
        {title}{" "}
        {highlight ? (
          <span className="font-serif italic font-bold text-gradient-brand inline-block pr-1.5">
            {highlight}
          </span>
        ) : null}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function NeonButton({
  href,
  children,
  variant = "solid",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost" | "primary";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses =
    size === "sm"
      ? "px-4 py-2 text-xs"
      : size === "lg"
      ? "px-8 py-3.5 text-base"
      : "px-6 py-3 text-sm";
  const base =
    `inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 cursor-pointer ${sizeClasses}`;
  const styles =
    variant === "ghost"
      ? "border border-border text-foreground hover:border-neon hover:text-neon"
      : "bg-gradient-brand text-neon-foreground glow-neon hover:brightness-110 active:scale-95";
  return (
    <a href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </a>
  );
}
