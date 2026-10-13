import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { encodeBill, decodeBill, urlHasBill } from "@/hooks/use-bill-url";
import {
  computeBalances,
  CURRENCIES,
  MAX_AMOUNT_INPUT_LENGTH,
  MAX_BILL_NAME_LENGTH,
  MAX_EXPENSE_LABEL_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  type Bill,
  type CurrencyCode,
  type Expense,
  type ExpenseId,
  type Person,
  type PersonId,
  type Settlement,
} from "@/lib/split";
import { hueForId } from "@/lib/palette";
import { SEED_BILL } from "@/data/seed";

const STORAGE_KEY = "hatian-state";
export const MAX_PERSONS = 50;
const MAX_EXPENSES = 500;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Monotonic id source. Seeded from the clock so ids don't collide with the
 * seed's ("al", "e1", …) or with ids restored from a shared link across a
 * reload. Two-ish characters, base-36; the codec accepts any length.
 */
let idSeq = Math.floor(Date.now() % 1_000_000);
const makeId = (prefix: string): string => `${prefix}${(idSeq++).toString(36)}`;

/** Snapshot captured on person removal so the Undo toast can fully restore. */
export interface RemovedPersonSnapshot {
  person: Person;
  personIndex: number;
  /** The removed person's own expenses, with their original positions. */
  ownedExpenses: { expense: Expense; index: number }[];
  /** Ids of other people's expenses this person was a sharer on. */
  sharerMemberships: ExpenseId[];
}

export interface BillActions {
  setBillName(name: string): void;
  setCurrency(currency: CurrencyCode): void;
  /** Returns false when the name is blank or the 50-person limit is reached. */
  addPerson(name: string): boolean;
  removePerson(id: PersonId): RemovedPersonSnapshot;
  restorePerson(snapshot: RemovedPersonSnapshot): void;
  updatePersonName(id: PersonId, name: string): void;
  addExpense(payerId: PersonId): void;
  /** Adds several expenses (e.g. from a scanned receipt) shared by everyone. */
  addExpenses(payerId: PersonId, items: { label: string; rawAmount: string }[]): void;
  removeExpense(id: ExpenseId): void;
  updateExpenseLabel(id: ExpenseId, label: string): void;
  updateExpenseAmount(id: ExpenseId, rawAmount: string): void;
  toggleSharer(expenseId: ExpenseId, personId: PersonId): void;
  /** Replaces the bill with the example; returns the previous bill for Undo. */
  reset(): Bill;
  replaceBill(bill: Bill): void;
}

export interface UseBillResult {
  bill: Bill;
  settlement: Settlement;
  actions: BillActions;
  /** Copies the current bill's shareable URL to the clipboard. */
  copyShareLink: () => Promise<boolean>;
}

const clone = (bill: Bill): Bill => JSON.parse(JSON.stringify(bill)) as Bill;

/** Treat URL and local-storage bill data as untrusted before rendering or computing it. */
function sanitizeBill(value: unknown, fallback: Bill = SEED_BILL): Bill {
  if (!value || typeof value !== "object") return clone(fallback);
  const candidate = value as Partial<Bill>;
  const seenPeople = new Set<string>();
  const persons = (Array.isArray(candidate.persons) ? candidate.persons : [])
    .filter((person): person is Person => {
      if (!person || typeof person !== "object" || typeof person.id !== "string") return false;
      if (!SAFE_ID.test(person.id) || seenPeople.has(person.id)) return false;
      seenPeople.add(person.id);
      return true;
    })
    .slice(0, MAX_PERSONS)
    .map((person) => ({
      id: person.id,
      name: typeof person.name === "string" ? person.name.slice(0, MAX_PERSON_NAME_LENGTH) : "",
      color: typeof person.color === "string" ? person.color.slice(0, 16) : hueForId(person.id),
    }));

  const personIds = new Set(persons.map((person) => person.id));
  const seenExpenses = new Set<string>();
  const expenses = (Array.isArray(candidate.expenses) ? candidate.expenses : [])
    .filter((expense): expense is Expense => {
      if (!expense || typeof expense !== "object" || typeof expense.id !== "string") return false;
      if (!SAFE_ID.test(expense.id) || seenExpenses.has(expense.id)) return false;
      if (typeof expense.payerId !== "string" || !personIds.has(expense.payerId)) return false;
      seenExpenses.add(expense.id);
      return true;
    })
    .slice(0, MAX_EXPENSES)
    .map((expense) => {
      const sharerIds = Array.isArray(expense.sharerIds)
        ? [...new Set(expense.sharerIds.filter((id): id is string => typeof id === "string" && personIds.has(id)))].slice(0, MAX_PERSONS)
        : [];
      return {
        id: expense.id,
        payerId: expense.payerId,
        sharerIds: sharerIds.length > 0 ? sharerIds : [expense.payerId],
        rawAmount: typeof expense.rawAmount === "string" ? expense.rawAmount.slice(0, MAX_AMOUNT_INPUT_LENGTH) : "",
        label: typeof expense.label === "string" ? expense.label.slice(0, MAX_EXPENSE_LABEL_LENGTH) : "",
      };
    });

  const currency = CURRENCIES.some(({ code }) => code === candidate.currency)
    ? (candidate.currency as CurrencyCode)
    : fallback.currency;

  return {
    name: typeof candidate.name === "string" ? candidate.name.slice(0, MAX_BILL_NAME_LENGTH) : "",
    currency,
    persons,
    expenses,
  };
}

function loadStored(): Bill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return sanitizeBill(parsed);
    }
  } catch {
    /* corrupt storage — fall through to seed */
  }
  return null;
}

const WRITE_DELAY_MS = 400;

/**
 * The single stateful hook for Hatian. Reads from the URL on mount
 * (`?b=` Base64 JSON wins), falls back to `localStorage`, then to `SEED_BILL`.
 * Writes to both the URL and `localStorage` on every change — the URL is the
 * save. Derives the whole settlement synchronously via `useMemo`; there is no
 * network, no loading state, no error state.
 */
export function useBill(): UseBillResult {
  const initial = useMemo<Bill>(() => {
    // URL wins over localStorage — decode synchronously on first render.
    if (typeof window !== "undefined") {
      const raw = new URLSearchParams(window.location.search).get("b");
      if (raw) {
        try {
          const decoded = decodeBill(raw);
          return sanitizeBill(decoded);
        } catch { /* fall through */ }
      }
    }
    return loadStored() ?? clone(SEED_BILL);
  }, []);

  const [bill, setBillState] = useState<Bill>(initial);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Write to URL (debounced) and localStorage (immediate) on every change.
  const persist = useCallback((next: Bill) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }

    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      const encoded = encodeBill(next);
      const url = `${window.location.pathname}?b=${encoded}`;
      window.history.replaceState(null, "", url);
    }, WRITE_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
  }, []);

  const patch = useCallback((delta: Partial<Bill>) => {
    setBillState((prev) => {
      const next = sanitizeBill({ ...prev, ...delta }, prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const settlement = useMemo(() => computeBalances(bill), [bill]);

  const copyShareLink = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    const encoded = encodeBill(bill);
    const url = `${window.location.origin}${window.location.pathname}?b=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, [bill]);

  const actions: BillActions = {
    setBillName: (name) => patch({ name: name.slice(0, MAX_BILL_NAME_LENGTH) }),
    setCurrency: (currency) => patch({ currency }),

    addPerson: (name) => {
      const trimmed = name.trim().slice(0, MAX_PERSON_NAME_LENGTH);
      if (!trimmed || bill.persons.length >= MAX_PERSONS) return false;
      const id = makeId("p");
      const person: Person = { id, name: trimmed, color: hueForId(id) };
      patch({ persons: [...bill.persons, person] });
      return true;
    },

    removePerson: (id) => {
      const personIndex = bill.persons.findIndex((p) => p.id === id);
      const person = bill.persons[personIndex];
      const ownedExpenses = bill.expenses
        .map((expense, index) => ({ expense, index }))
        .filter((x) => x.expense.payerId === id);
      const sharerMemberships = bill.expenses
        .filter((e) => e.payerId !== id && e.sharerIds.includes(id))
        .map((e) => e.id);

      const nextExpenses = bill.expenses
        .filter((e) => e.payerId !== id)
        .map((e) =>
          e.sharerIds.includes(id)
            ? { ...e, sharerIds: e.sharerIds.filter((s) => s !== id) }
            : e,
        );

      patch({
        persons: bill.persons.filter((p) => p.id !== id),
        expenses: nextExpenses,
      });

      return { person, personIndex, ownedExpenses, sharerMemberships };
    },

    restorePerson: (snapshot) => {
      const persons = [...bill.persons];
      persons.splice(Math.min(snapshot.personIndex, persons.length), 0, snapshot.person);

      const expenses = bill.expenses.map((e) =>
        snapshot.sharerMemberships.includes(e.id) && !e.sharerIds.includes(snapshot.person.id)
          ? { ...e, sharerIds: [...e.sharerIds, snapshot.person.id] }
          : e,
      );
      for (const { expense, index } of snapshot.ownedExpenses) {
        expenses.splice(Math.min(index, expenses.length), 0, expense);
      }

      patch({ persons, expenses });
    },

    updatePersonName: (id, name) => {
      patch({
        persons: bill.persons.map((p) => (p.id === id ? { ...p, name: name.slice(0, MAX_PERSON_NAME_LENGTH) } : p)),
      });
    },

    addExpense: (payerId) => {
      if (!SAFE_ID.test(payerId) || !bill.persons.some((person) => person.id === payerId)) return;
      if (bill.expenses.length >= MAX_EXPENSES) return;
      const expense: Expense = {
        id: makeId("x"),
        payerId,
        label: "",
        rawAmount: "",
        sharerIds: bill.persons.map((p) => p.id),
      };
      patch({ expenses: [...bill.expenses, expense] });
    },

    addExpenses: (payerId, items) => {
      if (!bill.persons.some((person) => person.id === payerId)) return;
      const room = MAX_EXPENSES - bill.expenses.length;
      const added: Expense[] = items.slice(0, Math.max(0, room)).map((item) => ({
        id: makeId("x"),
        payerId,
        label: item.label.slice(0, MAX_EXPENSE_LABEL_LENGTH),
        rawAmount: item.rawAmount.slice(0, MAX_AMOUNT_INPUT_LENGTH),
        sharerIds: bill.persons.map((p) => p.id),
      }));
      patch({ expenses: [...bill.expenses, ...added] });
    },

    removeExpense: (id) => {
      patch({ expenses: bill.expenses.filter((e) => e.id !== id) });
    },

    updateExpenseLabel: (id, label) => {
      patch({
        expenses: bill.expenses.map((e) => (e.id === id ? { ...e, label: label.slice(0, MAX_EXPENSE_LABEL_LENGTH) } : e)),
      });
    },

    updateExpenseAmount: (id, rawAmount) => {
      patch({
        expenses: bill.expenses.map((e) => (e.id === id ? { ...e, rawAmount: rawAmount.slice(0, MAX_AMOUNT_INPUT_LENGTH) } : e)),
      });
    },

    toggleSharer: (expenseId, personId) => {
      patch({
        expenses: bill.expenses.map((e) => {
          if (e.id !== expenseId) return e;
          const has = e.sharerIds.includes(personId);
          if (has) {
            // Blocked when it is the only active sharer — no divide-by-zero.
            if (e.sharerIds.length <= 1) return e;
            return { ...e, sharerIds: e.sharerIds.filter((s) => s !== personId) };
          }
          return { ...e, sharerIds: [...e.sharerIds, personId] };
        }),
      });
    },

    reset: () => {
      const previous = clone(bill);
      patch(clone(SEED_BILL));
      return previous;
    },
    replaceBill: (next) => patch(sanitizeBill(next)),
  };

  return { bill, settlement, actions, copyShareLink };
}
