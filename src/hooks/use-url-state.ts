import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Encode/decode one value to a query-param string. Provide a codec per key for
 * non-scalar shapes (objects, tuples). For array-valued keys the codec encodes
 * a SINGLE element — the hook repeats the param for each element.
 */
export interface UrlCodec<T> {
  encode: (value: T) => string;
  decode: (raw: string) => T;
}

/**
 * Encode/decode a WHOLE array into ONE query param. Prefer this over a
 * per-element `UrlCodec` for list state: repeated params (`?d=…&d=…`) can be
 * lossy when the URL is round-tripped by certain shells that keep only the LAST
 * value of a repeated param.
 */
export interface UrlListCodec<A> {
  encodeList: (value: A) => string;
  decodeList: (raw: string) => A;
}

type ElementOf<T> = T extends readonly (infer E)[] ? E : T;
type AnyCodec<V> = UrlCodec<ElementOf<V>> | UrlListCodec<V>;
type Codecs<S> = Partial<{ [K in keyof S]: AnyCodec<S[K]> }>;
const MAX_URL_VALUE_LENGTH = 4_096;
const MAX_URL_ARRAY_ITEMS = 500;

const isListCodec = <V,>(c: AnyCodec<V> | undefined): c is UrlListCodec<V> =>
  !!c && typeof (c as UrlListCodec<V>).encodeList === "function";

/** Coerce a raw string back to the primitive type of its default. */
function coerceScalar(raw: string, sample: unknown): unknown {
  if (typeof sample === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? sample : n;
  }
  if (typeof sample === "boolean") return raw === "true";
  return raw;
}


/**
 * Sync a plain state object to the URL query string — the "share is the URL"
 * pattern for client-only calculators (no backend, no saved records). Encodes
 * on change (debounced), decodes on first load, and falls back to `defaults`
 * for any missing key. Array-valued keys encode as REPEATED params
 * (`?d=…&d=…`), so a list of rows round-trips through a shareable link.
 *
 * @example
 * const [state, patch, { copyShareLink }] = useUrlState(
 *   { price: 400000, downPct: 20, debts: [] as Debt[] },
 *   { debts: { encode: d => `${d.name},${d.balance}`, decode: s => parseDebt(s) } }
 * );
 */
export function useUrlState<S extends Record<string, unknown>>(
  defaults: S,
  codecs: Codecs<S> = {},
): [S, (patch: Partial<S>) => void, { copyShareLink: () => Promise<boolean> }] {
  const decode = useCallback((): S => {
    if (typeof window === "undefined") return defaults;
    const params = new URLSearchParams(window.location.search);
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof S)[]) {
      const raw = params.getAll(String(key));
      if (raw.length === 0) continue;
      const codec = codecs[key];
      if (isListCodec(codec)) {
        // Whole-array codec: one param holds the list. Old links may still carry
        // repeated params — decode each and concatenate so nothing is dropped.
        const parts = raw
          .slice(0, MAX_URL_ARRAY_ITEMS)
          .filter((value) => value.length <= MAX_URL_VALUE_LENGTH)
          .flatMap((value) => {
            try {
              return [codec.decodeList(value)];
            } catch {
              return [];
            }
          });
        if (parts.length === 0) continue;
        next[key] = (parts.length === 1
          ? parts[0]
          : (parts.flatMap((p) => (Array.isArray(p) ? p : [p])) as unknown)) as S[typeof key];
      } else if (Array.isArray(defaults[key])) {
        // Per-element codec arrays ALSO travel as one param (a JSON array of
        // encoded elements) — see serialize. Legacy links may carry repeated
        // params, and a repeated-param URL that an embedding shell already
        // collapsed still decodes (to whatever survived) instead of crashing.
        let parts: string[] = raw.slice(0, MAX_URL_ARRAY_ITEMS);
        if (raw.length === 1 && raw[0].startsWith("[")) {
          try {
            if (raw[0].length > MAX_URL_VALUE_LENGTH * MAX_URL_ARRAY_ITEMS) continue;
            const parsed = JSON.parse(raw[0]) as unknown;
            if (Array.isArray(parsed)) parts = parsed.slice(0, MAX_URL_ARRAY_ITEMS).map(String);
          } catch {
            /* not a JSON wrapper — treat as a single legacy element */
          }
        }
        parts = parts.filter((value) => value.length <= MAX_URL_VALUE_LENGTH);
        next[key] = (codec
          ? parts.flatMap((value) => {
              try {
                return [codec.decode(value)];
              } catch {
                return [];
              }
            })
          : parts) as S[typeof key];
      } else {
        if (raw[0].length > MAX_URL_VALUE_LENGTH) continue;
        try {
          next[key] = (codec ? codec.decode(raw[0]) : coerceScalar(raw[0], defaults[key])) as S[typeof key];
        } catch {
          /* malformed custom value — keep the default */
        }
      }
    }

    return next;
  }, [defaults, codecs]);

    // Decode synchronously for the initial state so the URL wins on the very first
  // render — nothing can race a mount effect and overwrite a shared link.
  const [state, setState] = useState<S>(decode);

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialize = useCallback((s: S): string => {
    const params = new URLSearchParams();
    for (const key of Object.keys(s) as (keyof S)[]) {
      const value = s[key];
      const codec = codecs[key];
      if (isListCodec(codec)) {
        params.set(String(key), codec.encodeList(value));
      } else if (Array.isArray(value)) {
        // ONE param per array, always — never repeated params. Arrays travel
        // as a JSON array of per-element encodings.
        params.set(
          String(key),
          JSON.stringify(value.map((el) => (codec ? codec.encode(el) : String(el)))),
        );
      } else {
        params.set(String(key), codec ? codec.encode(value as ElementOf<S[typeof key]>) : String(value));
      }

    }
    return params.toString();
  }, [codecs]);

  const patch = useCallback((delta: Partial<S>) => {
    setState((prev) => {
      const next = { ...prev, ...delta };
      if (typeof window !== "undefined") {
        if (writeTimer.current) clearTimeout(writeTimer.current);
        writeTimer.current = setTimeout(() => {
          const qs = serialize(next);
          const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
          window.history.replaceState(null, "", url);
        }, 400);
      }
      return next;
    });
  }, [serialize]);

  useEffect(() => () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
  }, []);

  const copyShareLink = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    const qs = serialize(state);
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, [serialize, state]);

  return [state, patch, { copyShareLink }];
}
