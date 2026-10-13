import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Confetti } from "@/components/tools/confetti";

export interface ResultHeroProps {
  /** Small uppercase eyebrow above the value, e.g. "Debt-free date". */
  label: string;
  /** The big display value. Ignored when `countTo` is set. */
  value?: ReactNode;
  /** Sub-line under the value (e.g. "▲ 14 months sooner"). */
  sub?: ReactNode;
  /** When set, count-up animates 0 → this number and renders it via `format`. */
  countTo?: number;
  /** Formats the counted number (default: locale integer). */
  format?: (n: number) => string;
  /** Fire a one-shot confetti burst on mount — the wizard "reveal" payoff. Default off. */
  celebrate?: boolean;
  /** Fit the display value to the panel width while preserving the largest possible size. */
  fitValue?: boolean;
  className?: string;
}

const DURATION_MS = 900;
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface FittedValueProps {
  children: ReactNode;
}

function FittedValue({ children }: FittedValueProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(72);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const value = valueRef.current;
    if (!container || !value) return;

    const fit = () => {
      value.style.fontSize = "72px";
      const availableWidth = container.clientWidth;
      const naturalWidth = value.scrollWidth;
      const nextSize = naturalWidth > availableWidth
        ? Math.max(12, Math.floor((72 * availableWidth) / naturalWidth))
        : 72;
      value.style.fontSize = `${nextSize}px`;
      setFontSize(nextSize);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span ref={containerRef} className="block w-full overflow-hidden">
      <span
        ref={valueRef}
        className="inline-block whitespace-nowrap font-bold leading-[0.9] tabular-nums text-primary"
        style={{ fontSize }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * The results "reveal" for a step-flow calculator (the debt-payoff shape): one
 * big `tabular-nums` number on the tinted hero panel, optionally counting up,
 * with an optional confetti burst. For a single-page live-recalc calculator
 * (mortgage), use a plain shadcn `card` instead — a celebration on every
 * keystroke would be wrong.
 */
export function ResultHero({ label, value, sub, countTo, format, celebrate = false, fitValue = false, className }: ResultHeroProps) {
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());
  const [display, setDisplay] = useState<number>(countTo !== undefined && !prefersReducedMotion() ? 0 : (countTo ?? 0));
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (countTo === undefined || prefersReducedMotion()) {
      if (countTo !== undefined) setDisplay(countTo);
      return;
    }
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const progress = Math.min(1, (t - startRef.current) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(countTo * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [countTo]);

  return (
    <div className={cn("relative flex flex-col items-center gap-2 rounded-3xl border border-border bg-card px-8 py-12 text-center shadow-sm", className)}>
      {celebrate ? <Confetti /> : null}
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      {fitValue ? (
        <FittedValue>{countTo !== undefined ? fmt(display) : value}</FittedValue>
      ) : (
        <span className="type-hsuper tabular-nums text-primary">
          {countTo !== undefined ? fmt(display) : value}
        </span>
      )}
      {sub ? <span className="text-base font-medium text-muted-foreground">{sub}</span> : null}
    </div>
  );
}
