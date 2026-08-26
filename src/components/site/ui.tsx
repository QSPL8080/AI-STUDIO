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
    <section id={id} className={`scroll-mt-[72px] px-4 py-8 sm:px-6 sm:py-10 md:py-12 lg:py-14 ${className}`}>
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
        <span className="h-1.5 w-1.5 rounded-full bg-neon" />
        {eyebrow}
      </span>
      <h2 className="mt-3.5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
        {title}{" "}
        {highlight ? (
          <span className="font-serif italic text-gradient-brand">{highlight}</span>
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
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200";
  const styles =
    variant === "solid"
      ? "bg-gradient-brand text-neon-foreground glow-neon hover:brightness-110"
      : "border border-border text-foreground hover:border-neon hover:text-neon";
  return (
    <a href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </a>
  );
}
