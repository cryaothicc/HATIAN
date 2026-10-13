import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CalcCanvasProps {
  appName: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tint?: string;
  children: ReactNode;
  className?: string;
  /** When set, the wordmark is a link (e.g. "/" — back to the chooser). */
  homeHref?: string;
  /** When set, the wordmark is a button that calls this instead of navigating. */
  onHome?: () => void;
}

/**
 * Full-bleed calculator page host — the calculator equivalent of `CardCanvas`.
 * Fills the chosen identity-tint gradient with white on-canvas text and hosts
 * frosted `.card-tonal` panels that lift off it. A minimal sticky top bar
 * carries the wordmark + a per-tool `actions` slot. Unlike `CardCanvas` (a
 * centered single card), this is a scrolling multi-panel layout for an input
 * panel + live outputs, or a `StepFlow` wizard. No context — panels read the
 * tint tokens directly.
 */
export function CalcCanvas({ appName, actions, tint = "green", children, className, homeHref, onHome }: CalcCanvasProps) {
  const wordmark = <span className="text-[17px] font-semibold tracking-tight">{appName}</span>;
  return (
    <div data-tint={tint} className="min-h-screen w-full bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 px-4 sm:px-6 border-b border-border bg-background/85 backdrop-blur-[14px]">
        {onHome ? (
          <button onClick={onHome} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {wordmark}
          </button>
        ) : homeHref ? (
          <Link href={homeHref} title="Start a new bill" className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {wordmark}
          </Link>
        ) : (
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {wordmark}
          </div>
        )}
        {actions ? <div className="flex min-w-0 items-center gap-3">{actions}</div> : null}
      </header>

      <main className={cn("mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10", className)}>
        {children}
      </main>
    </div>
  );
}
