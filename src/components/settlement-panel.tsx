import { IconArrowRight, IconConfetti } from "@tabler/icons-react";
import { ResultHero } from "@/components/tools/result-hero";
import { Reveal, RevealItem } from "@/components/tools/reveal";
import { Badge, type BadgeColor } from "@/components/base/badge";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  type CurrencyCode,
  type Person,
  type Settlement,
} from "@/lib/split";

export interface SettlementPanelProps {
  settlement: Settlement;
  persons: Person[];
  currency: CurrencyCode;
}

/**
 * The live answer: two `result-hero` tiles (Total spent / To settle), a
 * per-person verdict pill row and the fewest-transfers payment list — all inside
 * a `reveal` so values cascade when they change. Handles both empty states:
 * State A (no amounts yet → lesson block) and State B (all square → confetti).
 */
export function SettlementPanel({ settlement, persons, currency }: SettlementPanelProps) {
  const { totalSpent, toSettle, balances, transfers } = settlement;
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name || "Unnamed";

  const hasData = totalSpent > 0.005;
  const allSquare = hasData && toSettle <= 0.005;

  const fmt = (n: number) => formatCurrency(n, currency);
  // Two tiles side by side only fit short totals on a phone; long ones stack.
  const isLongTotal = fmt(totalSpent).length > 12;

  return (
    <Reveal immediate className="flex flex-col gap-5">
      <RevealItem>
        <div className={cn("grid gap-3", isLongTotal ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2")}>
          <ResultHero label="Kabuuan · Total" countTo={totalSpent} format={fmt} fitValue className="px-4 py-8" />
          <ResultHero
            label="Babayaran · To settle"
            countTo={toSettle}
            format={fmt}
            celebrate={allSquare}
            fitValue
            className="px-4 py-8"
          />
        </div>
      </RevealItem>

      {!hasData ? (
        // State A — no amounts entered yet. The one place the exclusion feature
        // is taught. Plain text, no card, no shadow (empty-state rule).
        <RevealItem>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">Paano gamitin? · How it works</h3>
            <p className="text-sm text-muted-foreground">
              Open an expense to see its name chips —{" "}
              <span className="font-semibold text-foreground">tap a chip to leave that person out</span>{" "}
              of that one expense.
            </p>
            <p className="text-sm text-muted-foreground">
              An amber dot on a row means it isn&apos;t shared by everyone. The settlement appears
              here as soon as you enter an amount.
            </p>
          </div>
        </RevealItem>
      ) : (
        <>
          <RevealItem>
            <div className="flex flex-wrap gap-2">
              {balances.map((b) => {
                let color: BadgeColor = "gray";
                let text = `${nameOf(b.personId)} · settled`;
                if (b.net > 0.005) {
                  color = "green";
                  text = `${nameOf(b.personId)} · gets back ${fmt(b.net)}`;
                } else if (b.net < -0.005) {
                  color = "red";
                  text = `${nameOf(b.personId)} · owes ${fmt(-b.net)}`;
                }
                return (
                  <Badge
                    key={b.personId}
                    color={color}
                    className="max-w-full whitespace-normal text-sm [overflow-wrap:anywhere]"
                  >
                    {text}
                  </Badge>
                );
              })}
            </div>
          </RevealItem>

          <RevealItem>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sino ang magbabayad kanino · Payments</h3>
              {allSquare ? (
                <p className="flex items-center gap-2 text-base font-medium text-foreground">
                  Quits na! All square
                  <IconConfetti className="size-5" />
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {transfers.map((t, i) => (
                    <li
                      key={`${t.fromId}-${t.toId}-${i}`}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
                    >
                      <span className="min-w-0 max-w-full break-words font-medium" title={nameOf(t.fromId)}>
                        {nameOf(t.fromId)}
                      </span>
                      <IconArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-lg font-semibold tabular-nums text-primary">{fmt(t.amount)}</span>
                      <span className="min-w-0 max-w-full break-words font-medium" title={nameOf(t.toId)}>
                        {nameOf(t.toId)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </RevealItem>
        </>
      )}
    </Reveal>
  );
}
