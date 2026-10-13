"use client";

import { useEffect } from "react";
import { installPaletteVars } from "@/lib/palette";

/**
 * Runs once on the client to:
 * 1. Inject palette CSS variables (design-system card colors).
 * 2. Apply the persisted dark/light theme class to <html>.
 *
 * Replaces the inline bootstrap code that previously lived in main.tsx.
 */
export function PaletteInstaller() {
  useEffect(() => {
    // Install card palette CSS vars on :root
    installPaletteVars();

    // Apply persisted theme
    const theme = localStorage.getItem("theme") ?? "system";
    if (
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return null;
}
