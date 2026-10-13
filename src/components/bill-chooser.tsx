import { useState } from "react";
import { IconArrowRight, IconMinus, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEED_BILL } from "@/data/seed";
import { hueForId } from "@/lib/palette";
import { MAX_BILL_NAME_LENGTH, type Bill } from "@/lib/split";
import { encodeBill } from "@/hooks/use-bill-url";

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 12;


function openBill(bill: Bill): void {
  window.location.search = `?b=${encodeBill(bill)}`;
}

/**
 * The first of the two doors on `/` (bill-screen.md §1): shown only when the
 * query string carries no bill state. Either door ends the same way — bill state
 * written into the URL, which is the single source of truth. A shared link never
 * sees this, because it already has state.
 */
export function BillChooser() {
  const [people, setPeople] = useState(3);
  /** What the field shows while typing — clamped only on blur / Go. */
  const [draft, setDraft] = useState("3");
  const clamp = (n: number) => Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, n));
  const commitDraft = (): number => {
    const n = Number.parseInt(draft, 10);
    const next = Number.isNaN(n) ? people : clamp(n);
    setPeople(next);
    setDraft(String(next));
    return next;
  };
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);

  const start = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const count = commitDraft();
    const stamp = Date.now().toString(36);
    const persons = Array.from({ length: count }, (_, i) => {
      const id = `p${stamp}${i}`;
      return { id, name: "", color: hueForId(id) as string };
    });
    openBill({ name: name.trim(), currency: "PHP", persons, expenses: [] });
  };

  const step = (delta: number) => {
    const base = Number.parseInt(draft, 10);
    const next = clamp((Number.isNaN(base) ? people : base) + delta);
    setPeople(next);
    setDraft(String(next));
  };

  const steps = [
    { n: 1, title: "Ilagay ang mga kasama", sub: "Add the people splitting the bill." },
    { n: 2, title: "Ilista ang gastos", sub: "Type expenses or scan a receipt, and pick who shares each one." },
    { n: 3, title: "Tingnan kung sino ang magbabayad", sub: "Hatian shows the fewest payments to settle up." },
  ];

  return (
    <div className="flex min-h-[80vh] items-start justify-center px-4 pt-4 pb-10">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <h1 className="sr-only">Hatian</h1>
              <p className="mt-6 text-center text-sm text-muted-foreground">
            Gusto mo munang subukan?{" "}
            <button type="button" onClick={() => openBill(SEED_BILL)} className="font-semibold text-primary underline-offset-4 hover:underline">
              View the example bill
            </button>
          </p>
        </div>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {s.n}
              </span>
              <p className="mt-3 font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.sub}</p>
            </li>
          ))}
        </ol>

      <div className="mt-6 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-sm sm:px-10">
        <div>
          <h2 className="type-micro font-semibold uppercase tracking-widest text-muted-foreground">
            Ilan kayo? · How many people
          </h2>

          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Fewer people"
              onClick={() => step(-1)}
              className="size-14 rounded-full border-border bg-secondary text-primary hover:bg-secondary/70"
            >
              <IconMinus size={28} />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_PEOPLE}
              max={MAX_PEOPLE}
              value={draft}
              aria-label="Number of people"
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              onBlur={commitDraft}
              className="border-input bg-background h-16 w-24 text-center text-3xl font-semibold tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="More people"
              onClick={() => step(1)}
              className="size-14 rounded-full border-border bg-secondary text-primary hover:bg-secondary/70"
            >
              <IconPlus size={28} />
            </Button>
          </div>

          <p className="type-small mt-4 text-muted-foreground">
            People can be excluded from single expenses later.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Input
              type="text"
              value={name}
              maxLength={MAX_BILL_NAME_LENGTH}
              placeholder="Bill name (required) · hal. Boracay trip"
              aria-label="Bill name"
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
              required
              aria-invalid={nameError}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  start();
                }
              }}
              className="border-input bg-background h-14 flex-1 max-w-xs text-base aria-[invalid=true]:border-destructive"
            />
            <Button
              type="button"
              size="lg"
              onClick={start}
              className="flex h-12 items-center rounded-full px-7 text-base font-semibold"
            >
              Go
              <IconArrowRight size={22} />
            </Button>
          </div>
          {nameError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              Lagyan ng pangalan ang bill · Please name your bill first.
            </p>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}
