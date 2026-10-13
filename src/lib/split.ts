/**
 * Hatian — the whole "backend".
 *
 * Pure TypeScript: no React, no I/O, no Supabase, no server (D1 — client-only
 * calculator). Every derived number is computed live from the in-memory `Bill`
 * so nothing can drift and it is trivially unit-testable (see `split.test.ts`).
 * The URL (via `use-url-state`) + `localStorage` are the only persistence.
 *
 * Exports the canonical types, `parseAmount` / `validateAmount`,
 * `computeBalances`, `settle`, currency helpers, and the URL codecs that plug
 * into `useUrlState` so a whole bill round-trips through a shareable link.
 */

import type { UrlCodec } from "@/hooks/use-url-state";

/** Stable id — never a position index. */
export type PersonId = string;
export type ExpenseId = string;

/** Defensive limits for bill state loaded from editable URLs/local storage. */
export const MAX_BILL_NAME_LENGTH = 120;
export const MAX_PERSON_NAME_LENGTH = 80;
export const MAX_EXPENSE_LABEL_LENGTH = 160;
export const MAX_AMOUNT_INPUT_LENGTH = 32;
export const MAX_AMOUNT = 1_000_000_000;

export type CurrencyCode =
  | "PHP"
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "AUD"
  | "CAD"
  | "INR"
  | "SGD"
  | "AED";

export interface Person {
  /** Stable id, e.g. "al", "be", "ji". */
  id: PersonId;
  /** Editable inline; drives chip labels and pill labels. */
  name: string;
  /** Palette hue name derived from the id; never changes when the name does. */
  color: string;
}

export interface Expense {
  /** Stable id, e.g. "e1", "e2", "e3". */
  id: ExpenseId;
  /** Which person's card this expense lives in. */
  payerId: PersonId;
  /** Optional — a blank label is valid, never an error. */
  label: string;
  /** The literal text the user typed — "30,4", "$20", "120". */
  rawAmount: string;
  /** Subset of all person ids that share this expense; minimum one entry. */
  sharerIds: PersonId[];
}

/**
 * The single application state object. Declared as a `type` (not `interface`)
 * so it satisfies `useUrlState`'s `Record<string, unknown>` constraint.
 */
export type Bill = {
  /** Top-bar bill name field value. */
  name: string;
  /** Drives all display formatting; no conversion — one currency per bill. */
  currency: CurrencyCode;
  /** Ordered by creation time. */
  persons: Person[];
  /** Ordered by creation time within each payer's card. */
  expenses: Expense[];
};

/** Per-person net position — computed, never stored. */
export interface Balance {
  personId: PersonId;
  /** Sum of this person's expense amounts (parsed). */
  paid: number;
  /** Sum of their share of every expense they are in. */
  owes: number;
  /** `paid - owes`; positive = gets back, negative = owes. */
  net: number;
}

/** One payment in the fewest-transfers settlement. */
export interface Transfer {
  fromId: PersonId;
  toId: PersonId;
  /** Always positive; rounded; remainder lands on the largest debtor. */
  amount: number;
}

/** Everything the settlement panel renders. */
export interface Settlement {
  balances: Balance[];
  transfers: Transfer[];
  /** Sum of all parsed expense amounts. */
  totalSpent: number;
  /** Sum of positive nets (= magnitude of the summed negative nets). */
  toSettle: number;
}

/* ── Currencies ──────────────────────────────────────────────────────────── */

/** The nine fixed currency options, in the order shown in the top-bar select. */
export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: "PHP", symbol: "₱", label: "PHP" },
];

/** Symbol for a currency code (falls back to the code itself). */
export function currencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

const formatters = new Map<CurrencyCode, Intl.NumberFormat>();
/** Grouped number formatter using the currency's own fraction digits (JPY has none). */
function formatterFor(code: CurrencyCode): Intl.NumberFormat {
  let f = formatters.get(code);
  if (!f) {
    const digits = new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2;
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(code, f);
  }
  return f;
}

/** Display a raw number as `symbol + amount` with two decimals and grouping — no conversion. */
export function formatCurrency(amount: number, code: CurrencyCode): string {
  return `${currencySymbol(code)}${formatterFor(code).format(amount)}`;
}

/* ── Amount parsing ──────────────────────────────────────────────────────── */

/**
 * Parse a plain-text amount. The last comma or dot is the decimal separator;
 * all other separators and currency symbols are dropped; blank = 0. Handles
 * both `1,234.56` and `1.234,56` and `$20` and `30,4`. Negatives are preserved
 * here so `validateAmount` can flag them (compute treats the bill as typed).
 */
export function parseAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0;
  // Strip everything except digits, separators, and a leading minus.
  let s = raw.replace(/[^0-9,.\-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalIdx = Math.max(lastComma, lastDot);
  if (decimalIdx === -1) {
    s = s.replace(/[,.]/g, "");
  } else {
    const intPart = s.slice(0, decimalIdx).replace(/[,.]/g, "");
    const fracPart = s.slice(decimalIdx + 1).replace(/[,.]/g, "");
    s = `${intPart}.${fracPart}`;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Inline validation — called on each keystroke in the expense row. */
export function validateAmount(raw: string): string | null {
  if (raw.length > MAX_AMOUNT_INPUT_LENGTH) return "Enter a shorter amount.";
  if (parseAmount(raw) < 0) return "Amounts can't be negative.";
  if (parseAmount(raw) > MAX_AMOUNT) return "Amount is too large.";
  return null;
}

/* ── Compute ─────────────────────────────────────────────────────────────── */

/**
 * Fewest-transfers settlement: largest debtor pays largest creditor first. The
 * rounding remainder lands on the largest debtor so transfers sum to zero.
 */
export function settle(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ id: b.personId, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ id: b.personId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const payment = Math.min(creditors[ci].amount, debtors[di].amount);
    transfers.push({
      fromId: debtors[di].id,
      toId: creditors[ci].id,
      amount: Math.round(payment * 100) / 100,
    });
    creditors[ci].amount -= payment;
    debtors[di].amount -= payment;
    if (creditors[ci].amount < 0.005) ci++;
    if (debtors[di].amount < 0.005) di++;
  }
  return transfers;
}

/** Compute every derived value from a bill. Pure — same inputs, same output. */
export function computeBalances(bill: Bill): Settlement {
  const parsed = new Map<ExpenseId, number>();
  for (const exp of bill.expenses) {
    const amount = parseAmount(exp.rawAmount);
    parsed.set(exp.id, Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT ? amount : 0);
  }

  const paid = new Map<PersonId, number>();
  const owes = new Map<PersonId, number>();
  for (const p of bill.persons) {
    paid.set(p.id, 0);
    owes.set(p.id, 0);
  }

  for (const exp of bill.expenses) {
    const amount = parsed.get(exp.id) ?? 0;
    paid.set(exp.payerId, (paid.get(exp.payerId) ?? 0) + amount);
    // Guard the pathological zero-sharer case (no divide-by-zero); the UI
    // blocks removing the last sharer, so this only bites after a person removal.
    if (exp.sharerIds.length === 0) continue;
    const share = amount / exp.sharerIds.length;
    for (const sid of exp.sharerIds) {
      owes.set(sid, (owes.get(sid) ?? 0) + share);
    }
  }

  const balances: Balance[] = bill.persons.map((p) => ({
    personId: p.id,
    paid: paid.get(p.id) ?? 0,
    owes: owes.get(p.id) ?? 0,
    net: (paid.get(p.id) ?? 0) - (owes.get(p.id) ?? 0),
  }));

  const totalSpent = [...paid.values()].reduce((a, b) => a + b, 0);
  const toSettle = balances.filter((b) => b.net > 0).reduce((a, b) => a + b.net, 0);

  return { balances, transfers: settle(balances), totalSpent, toSettle };
}

/* ── URL codecs ──────────────────────────────────────────────────────────── */
//
// Each person/expense encodes to ONE string; `useUrlState` writes the whole
// array as a single JSON param (never repeated params, which some embedding
// shells collapse to last-wins) and still decodes legacy repeated-param links.
// Names/labels are percent-encoded so a `:` in a name can't break the split.

/** `id:name:color` */
function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export const personCodec: UrlCodec<Person> = {
  encode: (p) => `${p.id}:${encodeURIComponent(p.name)}:${p.color}`,
  decode: (raw) => {
    const [id, name = "", color = "gray"] = raw.split(":");
    return {
      id: id.slice(0, 64),
      name: safeDecode(name).slice(0, MAX_PERSON_NAME_LENGTH),
      color: color.slice(0, 16),
    };
  },
};

/** `id:payerId:sharerIds(+):rawAmount:label` */
export const expenseCodec: UrlCodec<Expense> = {
  encode: (e) =>
    `${e.id}:${e.payerId}:${e.sharerIds.join("+")}:${encodeURIComponent(
      e.rawAmount,
    )}:${encodeURIComponent(e.label)}`,
  decode: (raw) => {
    const [id, payerId, sharers = "", rawAmount = "", label = ""] = raw.split(":");
    return {
      id: id.slice(0, 64),
      payerId: payerId.slice(0, 64),
      sharerIds: sharers ? sharers.split("+").slice(0, 50).map((value) => value.slice(0, 64)) : [],
      rawAmount: safeDecode(rawAmount).slice(0, MAX_AMOUNT_INPUT_LENGTH),
      label: safeDecode(label).slice(0, MAX_EXPENSE_LABEL_LENGTH),
    };
  },
};
