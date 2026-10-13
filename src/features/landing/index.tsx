"use client";

import { useEffect, useState } from "react";
import { IconReceipt2, IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import { CalcCanvas } from "@/components/tools/calc-canvas";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { BillChooser } from "@/components/bill-chooser";
import { PayerCard } from "@/components/payer-card";
import { SettlementPanel } from "@/components/settlement-panel";
import { SplitExplainer } from "@/components/split-explainer";
import { ShareRow } from "@/components/share-row";
import { ReceiptScanner } from "@/components/receipt-scanner";
import { PocketCalculator } from "@/components/pocket-calculator";
import { MAX_PERSONS, useBill } from "@/hooks/use-bill";
import { MAX_BILL_NAME_LENGTH, MAX_PERSON_NAME_LENGTH } from "@/lib/split";

/**
 * Hatian (`/`) — the single route; this tool is its own landing (D1).
 *
 * Live, backend-free split calculator. All state lives in `useBill()` (URL +
 * localStorage); every number is derived synchronously — no Calculate button.
 * The seed bill loads on first visit so the page is never blank.
 */
/** Bill keys `useUrlState` writes — any of them means "this URL carries a bill". */
const BILL_KEYS = ["name", "currency", "persons", "expenses"];

function urlHasBill(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  // New format: single `b=` param. Legacy format: individual keys.
  return params.has("b") || BILL_KEYS.some((k) => params.has(k));
}

export default function Hatian() {
  const [hasBill, setHasBill] = useState(false);

  useEffect(() => {
    setHasBill(urlHasBill());
  }, []);

  const goHome = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("b");
    // Also clear legacy params in case an old link is open.
    BILL_KEYS.forEach((k) => url.searchParams.delete(k));
    window.history.pushState(null, "", url.pathname);
    setHasBill(false);
  };

  if (!hasBill) {
    return (
      <TooltipProvider delayDuration={200}>
        <CalcCanvas
          appName="Hatian"
          tint="manila"
          icon={<IconReceipt2 className="size-5" />}
          className="max-w-6xl"
        >
          <BillChooser />
        </CalcCanvas>
        <Toaster />
      </TooltipProvider>
    );
  }

  return <BillScreen onGoHome={goHome} />;
}

/** The bill screen — live recalc, no wizard, no Calculate button. */
function BillScreen({ onGoHome }: { onGoHome: () => void }) {
  const { bill, settlement, actions, copyShareLink } = useBill();
  const [newPerson, setNewPerson] = useState("");
  /** Progressive disclosure: exactly one expense row is open at a time. */
  const [openExpenseId, setOpenExpenseId] = useState<string | null>(null);

  // The bill name drives the document title live (no submit).
  useEffect(() => {
    document.title = bill.name ? `${bill.name} · Hatian` : "Hatian";
  }, [bill.name]);

  const paidById = new Map(settlement.balances.map((b) => [b.personId, b.paid]));


  const commitNewPerson = () => {
    const name = newPerson.trim();
    if (!name) return;
    if (!actions.addPerson(name)) {
      toast(`A bill can have at most ${MAX_PERSONS} people.`);
      return;
    }
    setNewPerson("");
  };

  const handleRemovePerson = (id: string) => {
    const person = bill.persons.find((p) => p.id === id);
    const owned = bill.expenses.filter((e) => e.payerId === id).length;
    const snapshot = actions.removePerson(id);
    const label =
      owned === 0
        ? `Removed ${person?.name ?? "person"}`
        : `Removed ${person?.name ?? "person"} and ${owned} expense${owned === 1 ? "" : "s"}`;
    toast(label, {
      action: { label: "Undo", onClick: () => actions.restorePerson(snapshot) },
    });
  };

  const backButton = (
    <button
      onClick={onGoHome}
      className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="Back to home"
    >
      <IconArrowLeft className="size-4" />
      Back
    </button>
  );

  const topBarActions = (
    <>
      {backButton}
      <Input
        type="text"
        value={bill.name}
        maxLength={MAX_BILL_NAME_LENGTH}
        placeholder="hal. Boracay trip"
        onChange={(e) => actions.setBillName(e.target.value)}
        aria-label="Bill name"
        className="h-9 w-[200px] min-w-0 max-w-[50vw] border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
      />
    </>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <CalcCanvas
        appName="Hatian"
        tint="manila"
        icon={<IconReceipt2 className="size-5" />}
        actions={topBarActions}
        onHome={onGoHome}
        className="max-w-6xl"
      >
        <h1 className="sr-only">{bill.name ? `${bill.name} — bill` : "Bill"}</h1>
        <div className="grid gap-8 md:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
          {/* People & expenses */}
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sino ang nagbayad? · People &amp; expenses
            </h2>
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] px-1 pb-1 -mx-1">
              {bill.persons.map((person) => (
                <PayerCard
                  key={person.id}
                  person={person}
                  expenses={bill.expenses.filter((e) => e.payerId === person.id)}
                  persons={bill.persons}
                  currency={bill.currency}
                  paidTotal={paidById.get(person.id) ?? 0}
                  onNameChange={actions.updatePersonName}
                  onAddExpense={actions.addExpense}
                  onRemovePerson={handleRemovePerson}
                  onLabelChange={actions.updateExpenseLabel}
                  onAmountChange={actions.updateExpenseAmount}
                  onToggleSharer={actions.toggleSharer}
                  onDeleteExpense={actions.removeExpense}
                  openExpenseId={openExpenseId}
                  onOpenExpense={setOpenExpenseId}
                />
              ))}
              <Input
                type="text"
                value={newPerson}
                maxLength={MAX_PERSON_NAME_LENGTH}
                placeholder="Add tropa… (type a name, press Enter)"
                aria-label="Add person"
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitNewPerson();
                  }
                }}
                onBlur={commitNewPerson}
                className="h-11 border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
              <ReceiptScanner persons={bill.persons} onAdd={actions.addExpenses} />
            </div>
          </section>

          {/* Settlement */}
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Hatian · Settlement
            </h2>
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] px-1 pb-1 -mx-1">
              <SettlementPanel
                settlement={settlement}
                persons={bill.persons}
                currency={bill.currency}
              />
              <SplitExplainer bill={bill} settlement={settlement} />
            </div>
          </section>
        </div>

        <ShareRow
          bill={bill}
          settlement={settlement}
          copyShareLink={copyShareLink}
          onReset={actions.reset}
          onUndoReset={actions.replaceBill}
        />
      </CalcCanvas>
      <PocketCalculator />
      <Toaster />
    </TooltipProvider>
  );
}
