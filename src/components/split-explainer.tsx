import { IconChevronDown } from "@tabler/icons-react";
import { formatCurrency, parseAmount, type Bill, type Settlement } from "@/lib/split";

/**
 * "Paano nahati?" — a plain-language walkthrough of how the bill was split:
 * each expense's per-person share, then each person's paid − share = balance.
 * Reads only computed values, so it always matches the settlement above.
 */
export function SplitExplainer({ bill, settlement }: { bill: Bill; settlement: Settlement }) {
  if (settlement.totalSpent <= 0.005) return null;
  const fmt = (n: number) => formatCurrency(n, bill.currency);
  const nameOf = (id: string) => bill.persons.find((p) => p.id === id)?.name || "Unnamed";
  const everyone = bill.persons.length;

  const expenses = bill.expenses
    .map((e) => ({ e, base: parseAmount(e.rawAmount) }))
    .filter(({ base, e }) => base > 0 && e.sharerIds.length > 0);

  return (
    <details open className="group rounded-2xl border border-border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Paano nahati? · How it was split
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">Step by step, so everyone can check the math.</span>
        </span>
        <IconChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <ol className="mt-4 flex flex-col gap-5 text-sm">
        <li className="flex flex-col gap-2">
          <p className="font-semibold text-foreground">1. Hatiin ang bawat gastos · Split each expense</p>
          <ul className="flex flex-col gap-2">
            {expenses.map(({ e, base }) => {
              const amount = base;
              const n = e.sharerIds.length;
              return (
                <li key={e.id} className="rounded-xl bg-secondary px-3 py-2">
                  <p className="font-medium text-foreground [overflow-wrap:anywhere]">
                    {e.label || "Expense"} <span className="font-normal text-muted-foreground">· paid by {nameOf(e.payerId)}</span>
                  </p>
                  <p className="tabular-nums text-muted-foreground">
                    {fmt(amount)} ÷ {n} {n === 1 ? "person" : "people"} ={" "}
                    <span className="font-semibold text-primary">{fmt(amount / n)} each</span>
                  </p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {n === everyone ? "Shared by everyone" : `Only ${e.sharerIds.map(nameOf).join(", ")}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </li>

        <li className="flex flex-col gap-2">
          <p className="font-semibold text-foreground">2. Ibawas ang share sa binayaran · Paid minus share</p>
          <ul className="flex flex-col gap-1.5">
            {settlement.balances.map((b) => (
              <li key={b.personId} className="flex flex-wrap items-baseline justify-between gap-x-3 tabular-nums">
                <span className="font-medium text-foreground">{nameOf(b.personId)}</span>
                <span className="text-muted-foreground">
                  paid {fmt(b.paid)} − share {fmt(b.owes)} ={" "}
                  <span className="font-semibold text-foreground">
                    {b.net > 0.005 ? `gets back ${fmt(b.net)}` : b.net < -0.005 ? `owes ${fmt(-b.net)}` : "settled"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </li>

        <li className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">3. Bayaran · Settle up</p>
          <p className="text-muted-foreground">
            Whoever owes pays whoever gets money back, using the fewest payments possible — that&apos;s the list under
            &quot;Payments&quot; above.
          </p>
        </li>
      </ol>
    </details>
  );
}
