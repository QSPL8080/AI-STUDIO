import { useEffect, useRef, useState } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isTextInput, setIsTextInput] = useState(false);

  useEffect(() => {
    // Only run on client side and on devices that support hover / fine pointers (desktop/mouse)
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mediaQuery.matches) return;

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let animFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!visible) {
        setVisible(true);
        ringX = mouseX;
        ringY = mouseY;
      }

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }

      // Check if target is an interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest(
          "a, button, input, textarea, select, label, [role='button'], .cursor-pointer, [data-cursor='hover']"
        );
        const textElem = target.closest(
          "input[type='text'], input[type='email'], input[type='tel'], input[type='number'], textarea"
        );

        setHovered(Boolean(interactive && !textElem));
        setIsTextInput(Boolean(textElem));
      }
    };

    const onMouseDown = () => setClicked(true);
    const onMouseUp = () => setClicked(false);
    const onMouseLeave = () => setVisible(false);
    const onMouseEnter = () => setVisible(true);

    const render = () => {
      // Smooth lerp for trailing aura ring
      const ease = 0.18;
      ringX += (mouseX - ringX) * ease;
      ringY += (mouseY - ringY) * ease;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }

      animFrameId = requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    animFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      cancelAnimationFrame(animFrameId);
    };
  }, [visible]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[999999] overflow-hidden transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      } hidden md:block`}
    >
      {/* Trailing Aura Ring / Focus Glow */}
      <div
        ref={ringRef}
        className={`pointer-events-none fixed left-0 top-0 will-change-transform transition-[width,height,border-color,background-color,box-shadow,border-radius] duration-200 ease-out flex items-center justify-center ${
          isTextInput
            ? "h-7 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] border-none"
            : hovered
            ? "h-12 w-12 rounded-full border border-fuchsia-400/90 bg-fuchsia-500/15 shadow-[0_0_24px_rgba(217,70,239,0.45),inset_0_0_12px_rgba(6,182,212,0.25)] backdrop-blur-[1px]"
            : clicked
            ? "h-7 w-7 rounded-full border border-cyan-300 bg-cyan-400/20 shadow-[0_0_16px_rgba(6,182,212,0.6)]"
            : "h-9 w-9 rounded-full border border-white/30 bg-transparent shadow-[0_0_10px_rgba(217,70,239,0.2)]"
        }`}
      >
        {hovered && !isTextInput && (
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
        )}
      </div>

      {/* Sharp Precision Core Dot */}
      <div
        ref={dotRef}
        className={`pointer-events-none fixed left-0 top-0 will-change-transform transition-[width,height,opacity,transform] duration-150 ease-out rounded-full ${
          isTextInput
            ? "opacity-0"
            : clicked
            ? "h-3 w-3 bg-cyan-300 shadow-[0_0_14px_#38bdf8]"
            : hovered
            ? "h-2 w-2 bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-pink-500 shadow-[0_0_12px_#d946ef]"
            : "h-2 w-2 bg-gradient-to-r from-cyan-400 to-fuchsia-500 shadow-[0_0_8px_#38bdf8]"
        }`}
      />
    </div>
  );
}
