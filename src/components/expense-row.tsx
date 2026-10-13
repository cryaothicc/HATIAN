import { useEffect, useRef, useState } from "react";
import {
  IconCircleFilled,
  IconDots,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  currencySymbol,
  MAX_AMOUNT_INPUT_LENGTH,
  MAX_EXPENSE_LABEL_LENGTH,
  validateAmount,
  type CurrencyCode,
  type Expense,
  type Person,
} from "@/lib/split";

// Avoid the missing `icon-sm` size (see spec): a ghost icon button at 28px.
const iconBtn = "h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground";

export interface ExpenseRowProps {
  expense: Expense;
  /** Every person currently in the bill — one sharer chip per person. */
  persons: Person[];
  /** Name of the person who paid — shown at rest ("paid by"). */
  payerName: string;
  currency: CurrencyCode;
  /** True when this is the one open row (progressive disclosure, §4 bill-screen). */
  expanded: boolean;
  /** Ask the page to make this the open row (focus or click). */
  /** Open this row (id) or close it (null). */
  onOpen: (id: string | null) => void;
  onLabelChange: (id: string, label: string) => void;
  onAmountChange: (id: string, rawAmount: string) => void;
  onToggleSharer: (expenseId: string, personId: string) => void;
  onDelete: (id: string) => void;
}

/**
 * One editable expense inside a payer card.
 *
 * At rest: label · amount · paid by, plus the amber "not shared by everyone"
 * dot — which never hides, because it is the only way to spot an unequal
 * expense without opening the row. Focused or open, the row expands to reveal
 * the sharer chips (`toggle-group`, last chip can't be turned off) and the
 * remove controls. Only one row is open at a time; the page owns that state.
 */
export function ExpenseRow({
  expense,
  persons,
  payerName,
  currency,
  expanded,
  onOpen,
  onLabelChange,
  onAmountChange,
  onToggleSharer,
  onDelete,
}: ExpenseRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockedChip, setBlockedChip] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // An open row closes on a click outside it — on "click", not pointerdown, so
  // the row never collapses (and shifts the layout) under a button mid-press (menus/tooltips live in portals and
  // are ignored so their own clicks still work).
  useEffect(() => {
    if (!expanded || menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || t === document.body || t === document.documentElement) return;
      if (rowRef.current?.contains(t)) return;
      if (t.closest("[data-radix-popper-content-wrapper],[role=menu]")) return;
      onOpen(null);
    };
    document.addEventListener("click", onDown);
    return () => document.removeEventListener("click", onDown);
  }, [expanded, menuOpen, onOpen]);

  const amountError = validateAmount(expense.rawAmount);
  const sharedByAll =
    persons.length > 0 && persons.every((p) => expense.sharerIds.includes(p.id));
  const activeCount = expense.sharerIds.length;

  const handleChip = (personId: string) => {
    const isActive = expense.sharerIds.includes(personId);
    if (isActive && activeCount <= 1) {
      // Last remaining sharer — refuse and explain (no divide-by-zero possible).
      setBlockedChip(personId);
      window.setTimeout(() => setBlockedChip(null), 2500);
      return;
    }
    onToggleSharer(expense.id, personId);
  };

  const deleteItem = (
    <>
      <IconTrash />
      Delete
    </>
  );

  return (
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild>
        <div
          ref={rowRef}
          data-state={menuOpen ? "open" : "closed"}
          onKeyDown={(e) => {
            if (e.key === "Escape" && expanded && !menuOpen) {
              e.stopPropagation();
              onOpen(null);
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            }
          }}
          onFocusCapture={() => onOpen(expense.id)}
          onClick={() => onOpen(expense.id)}
          className={cn(
            "rounded-xl px-2 py-2 transition-colors",
            expanded && "bg-muted/40",
            menuOpen && "outline outline-2 outline-primary/40",
          )}
        >
          {/* Line 1: label · amount · (× · ⋯ when open) */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={expense.label}
              maxLength={MAX_EXPENSE_LABEL_LENGTH}
              placeholder="What was it for?"
              onChange={(e) => onLabelChange(expense.id, e.target.value)}
              className="h-8 flex-1 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
              aria-label="Expense label"
            />
            <div
              className="relative min-w-28 max-w-[50%] shrink-0"
              style={{ width: `calc(${expense.rawAmount.length}ch + 2.75rem)` }}
            >
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currencySymbol(currency)}
              </span>
              <Input
                type="text"
                inputMode="decimal"
                value={expense.rawAmount}
                maxLength={MAX_AMOUNT_INPUT_LENGTH}
                placeholder="0.00"
                onChange={(e) => onAmountChange(expense.id, e.target.value)}
                aria-label="Amount"
                aria-invalid={amountError ? true : undefined}
                className={cn(
                  "h-8 pl-7 pr-2 text-right tabular-nums",
                  amountError && "border-destructive focus-visible:ring-destructive",
                )}
              />
            </div>
            {expanded ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={iconBtn}
                  onClick={() => onDelete(expense.id)}
                  aria-label="Remove expense"
                >
                  <IconX />
                </Button>
                <DropdownMenu onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={iconBtn}
                      aria-label="Actions"
                    >
                      <IconDots />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => onDelete(expense.id)}
                    >
                      {deleteItem}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </div>

          {amountError ? (
            <p className="mt-1 pl-2 text-xs text-destructive">{amountError}</p>
          ) : null}

          {/* Line 2 at rest: paid by + the amber marker (never hidden). */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-2 text-xs text-muted-foreground">
            <span className="min-w-0 [overflow-wrap:anywhere]">Paid by {payerName || "Unnamed"}</span>
            {!sharedByAll ? (
              <span className="flex items-center gap-1">
                <IconCircleFilled className="size-3 text-amber-500" />
                Not shared by everyone
              </span>
            ) : null}
          </div>

          {/* Revealed on focus / open: the sharer chips. */}
          {expanded ? (
            <div className="mt-2 rounded-lg bg-secondary/60 px-2 py-2">
              <p className="px-1 text-xs font-medium text-foreground">
                Sino ang kasali? · Who shares this?
              </p>
              <p className="px-1 text-xs text-muted-foreground">
                Blue = kasali (pays a part). Tap a name to take them out or put them back.
              </p>
            <ToggleGroup
              type="multiple"
              value={expense.sharerIds}
              onValueChange={() => {}}
              className="mt-1.5 flex flex-wrap justify-start gap-1.5"
            >
              {persons.map((p) => (
                <Tooltip key={p.id} open={blockedChip === p.id}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value={p.id}
                      size="sm"
                      variant="outline"
                      onClick={() => handleChip(p.id)}
                      className="h-7 rounded-full px-3 text-xs aria-[pressed=false]:text-muted-foreground aria-[pressed=false]:line-through aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
                    >
                      {expense.sharerIds.includes(p.id) ? "✓ " : ""}
                      {p.name || "Unnamed"}
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>An expense needs at least one person.</TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                {sharedByAll
                  ? `Hati-hati lahat · split equally by all ${activeCount}`
                  : `Hati ng ${activeCount} lang · split by ${activeCount} of ${persons.length} only`}
              </p>
            </div>
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onDelete(expense.id)}
        >
          {deleteItem}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
