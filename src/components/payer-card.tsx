import { useRef, useState, type ElementType } from "react";
import { IconDots, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ExpenseRow } from "@/components/expense-row";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  MAX_PERSON_NAME_LENGTH,
  type CurrencyCode,
  type Expense,
  type Person,
} from "@/lib/split";
import { HUES, readableTextColor, token, type Hue } from "@/lib/palette";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export interface PayerCardProps {
  person: Person;
  /** This person's own expenses, in creation order. */
  expenses: Expense[];
  /** Every person in the bill — passed through to each expense's sharer chips. */
  persons: Person[];
  currency: CurrencyCode;
  /** Sum of this person's expense amounts (parsed). */
  paidTotal: number;
  onNameChange: (id: string, name: string) => void;
  onAddExpense: (payerId: string) => void;
  onRemovePerson: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onAmountChange: (id: string, rawAmount: string) => void;
  onToggleSharer: (expenseId: string, personId: string) => void;
  onDeleteExpense: (id: string) => void;
  /** The one expense row open across the whole bill, if it is in this card. */
  openExpenseId: string | null;
  onOpenExpense: (id: string | null) => void;
}

/**
 * One person's card: coloured initial avatar, inline-editable name, live paid
 * total, the ⋯ menu (Rename… / Remove, same actions on right-click per the item
 * rule) and the person's expense rows with a full-width "+ Add expense".
 */
export function PayerCard({
  person,
  expenses,
  persons,
  currency,
  paidTotal,
  onNameChange,
  onAddExpense,
  onRemovePerson,
  onLabelChange,
  onAmountChange,
  onToggleSharer,
  onDeleteExpense,
  openExpenseId,
  onOpenExpense,
}: PayerCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const hue: Hue = HUES.includes(person.color as Hue) ? (person.color as Hue) : "blue";
  const avatarBg = token(hue, "bright");
  const avatarFg = readableTextColor(avatarBg);

  const startRename = () => {
    // Rename… puts the cursor in the inline name field (no separate dialog).
    window.requestAnimationFrame(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    });
  };

  const menuItems = (Item: ElementType, Separator: ElementType) => (
    <>
      <Item onSelect={startRename}>
        <IconPencil />
        Rename…
      </Item>
      <Separator />
      <Item
        className="text-destructive focus:text-destructive"
        onSelect={() => onRemovePerson(person.id)}
      >
        <IconTrash />
        Remove
      </Item>
    </>
  );

  return (
    <ContextMenu onOpenChange={setMenuOpen}>
      <Card
        data-state={menuOpen ? "open" : "closed"}
        className={cn(
          "border-0 p-4 transition-shadow",
          menuOpen && "outline outline-2 outline-primary/50",
        )}
      >
        {/* Header: avatar · name · paid total · ⋯ — right-click here opens the
            same menu as the ⋯ button (scoped to the header so it never nests
            with an expense row's own context menu). */}
        <ContextMenuTrigger asChild>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: avatarBg, color: avatarFg }}
            >
              {initialsOf(person.name)}
            </div>
            <Input
              ref={nameRef}
              type="text"
              value={person.name}
              maxLength={MAX_PERSON_NAME_LENGTH}
              placeholder="Name"
              onChange={(e) => onNameChange(person.id, e.target.value)}
              aria-label="Person name"
              className="h-8 flex-1 border-transparent bg-transparent px-1 text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
            />
            <span className="shrink-0 tabular-nums font-semibold">
              {formatCurrency(paidTotal, currency)}
            </span>
            <DropdownMenu onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Actions"
                >
                  <IconDots />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {menuItems(ContextMenuItem, ContextMenuSeparator)}
        </ContextMenuContent>

        {/* Body: the create tile leads the list (empty-state.md), then the rows */}
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => onAddExpense(person.id)}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <IconPlus className="size-4" />
            Add expense
          </button>
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              persons={persons}
              payerName={person.name}
              currency={currency}
              expanded={openExpenseId === expense.id}
              onOpen={onOpenExpense}
              onLabelChange={onLabelChange}
              onAmountChange={onAmountChange}
              onToggleSharer={onToggleSharer}
              onDelete={onDeleteExpense}
            />
          ))}
        </div>
      </Card>
    </ContextMenu>
  );
}
