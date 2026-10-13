import { useCallback, useEffect, useRef, useState } from "react";
import type { Bill } from "@/lib/split";

const PARAM = "b";

/** Encode a Bill to a URL-safe Base64 string. */
export function encodeBill(bill: Bill): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(bill))));
}

/** Decode a Base64 string back to a Bill object (throws on failure). */
export function decodeBill(raw: string): Bill {
  return JSON.parse(decodeURIComponent(escape(atob(raw)))) as Bill;
}

/** Build a `?b=…` search string for a given bill. */
export function billToSearch(bill: Bill): string {
  const params = new URLSearchParams();
  params.set(PARAM, encodeBill(bill));
  return `?${params.toString()}`;
}

/** Returns true if the URL carries a `b=` param (new format). */
export function urlHasBill(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(PARAM);
}

/**
 * Read the bill from the URL (`?b=…`), write it back on every patch (debounced).
 * Returns [bill | null, patch, copyShareLink].
 * `bill` is null when there is no `b=` param in the URL.
 */
export function useBillUrl(
  onBillChange: (bill: Bill) => void,
): {
  readFromUrl: () => Bill | null;
  writeToUrl: (bill: Bill) => void;
  copyShareLink: (bill: Bill) => Promise<boolean>;
} {
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readFromUrl = useCallback((): Bill | null => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get(PARAM);
    if (!raw) return null;
    try {
      return decodeBill(raw);
    } catch {
      return null;
    }
  }, []);

  const writeToUrl = useCallback((bill: Bill) => {
    if (typeof window === "undefined") return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      const url = `${window.location.pathname}${billToSearch(bill)}`;
      window.history.replaceState(null, "", url);
    }, 400);
  }, []);

  const copyShareLink = useCallback(async (bill: Bill): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    const url = `${window.location.origin}${window.location.pathname}${billToSearch(bill)}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
  }, []);

  return { readFromUrl, writeToUrl, copyShareLink };
}
