import type { Bill } from "@/lib/split";

/**
 * The seed bill — the first-run experience for every visitor (there is no auth,
 * so every user is a first-time user). It loads on first visit and is restored
 * by Reset. It is not "demo data for a separate route" — it IS the tool's first
 * state, so the calculator is never blank (calculator-family rule, D2).
 *
 * The one partial share (Jill excluded from "Present for Jill") makes the
 * exclusion feature — the whole reason this tool exists — visible in the first
 * second without any explanation.
 */
export const SEED_BILL: Bill = {
  name: "Boracay trip",
  currency: "PHP",
  persons: [
    { id: "ju", name: "Juan", color: "blue" },
    { id: "ma", name: "Maria", color: "green" },
    { id: "pa", name: "Paolo", color: "purple" },
  ],
  expenses: [
    { id: "e1", payerId: "ju", label: "Lechon dinner", rawAmount: "3000", sharerIds: ["ju", "ma", "pa"] },
    // Maria excluded — amber "Not shared by everyone" dot renders on this row.
    { id: "e2", payerId: "ju", label: "Pasalubong for Maria", rawAmount: "1500", sharerIds: ["ju", "pa"] },
    { id: "e3", payerId: "pa", label: "Resort", rawAmount: "6000", sharerIds: ["ju", "ma", "pa"] },
  ],
};

/**
 * The seed's known-correct answer — the test fixture in `split.test.ts`.
 * - Lechon dinner ₱3,000 ÷ 3 = ₱1,000 each
 * - Pasalubong for Maria ₱1,500 ÷ 2 = ₱750 each (Juan, Paolo)
 * - Resort ₱6,000 ÷ 3 = ₱2,000 each
 */
export const SEED_EXPECTED = {
  totalSpent: 10500,
  toSettle: 3000,
  balances: [
    { personId: "ju", paid: 4500, owes: 3750, net: 750 },
    { personId: "ma", paid: 0, owes: 3000, net: -3000 },
    { personId: "pa", paid: 6000, owes: 3750, net: 2250 },
  ],
  transfers: [
    { fromId: "ma", toId: "pa", amount: 2250 },
    { fromId: "ma", toId: "ju", amount: 750 },
  ],
} as const;
