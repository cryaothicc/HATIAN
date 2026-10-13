import { useEffect, useRef } from "react";
import { palette } from "@/lib/palette";

const COLORS = [
  palette.purple.bright,
  palette.green.bright,
  palette.orange.bright,
  palette.yellow.bright,
  palette.pink.bright,
  palette.blue.bright,
];

/**
 * A one-shot confetti burst in the palette colors — a delight moment for
 * success states. Fills its (relatively-positioned) parent, ignores pointer
 * events, and does nothing under `prefers-reduced-motion`.
 */
export function Confetti({ count = 48 }: { count?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
      const d = document.createElement("div");
      const w = 6 + Math.random() * 8;
      d.style.cssText = `position:absolute;top:-16px;left:${Math.random() * 100}%;width:${w}px;height:${w * 0.6}px;background:${COLORS[i % COLORS.length]};border-radius:2px;`;
      host.appendChild(d);
      els.push(d);
      const dx = (Math.random() - 0.5) * 260;
      d.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, 560px) rotate(${(Math.random() * 4 - 2) * 360}deg)`, opacity: 0 },
        ],
        { duration: 1600 + Math.random() * 1400, delay: Math.random() * 250, easing: "cubic-bezier(0.2,0.6,0.3,1)", fill: "forwards" },
      );
    }
    return () => els.forEach((e) => e.remove());
  }, [count]);

  return <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" />;
}
