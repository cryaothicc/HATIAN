"use client";

import { useRef, useState } from "react";
import { IconCamera, IconTrash, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_EXPENSE_LABEL_LENGTH, type Person } from "@/lib/split";

export interface ScannedItem {
  label: string;
  rawAmount: string;
}

interface ScanResult {
  isReceipt: boolean;
  items: { label: string; amount: number }[];
  tax: number | null;
  serviceCharge: number | null;
  total: number | null;
}

/** Shrink the photo before upload so big phone pictures stay fast and under the size limit. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const money = (n: number) => (Math.round(n * 100) / 100).toString();

export function ReceiptScanner({
  persons,
  onAdd,
}: {
  persons: Person[];
  onAdd: (payerId: string, items: ScannedItem[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [payerId, setPayerId] = useState<string>("");
  const payer = persons.some((p) => p.id === payerId) ? payerId : persons[0]?.id ?? "";

  const scan = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo of the receipt.");
      return;
    }
    setLoading(true);
    try {
      const image = await toDataUrl(file);
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = await res.json() as ScanResult & { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Couldn't read that receipt. Try a clearer photo.");
        return;
      }
      if (!data.isReceipt || data.items.length === 0) {
        toast.error("That doesn't look like a receipt — try another photo.");
        return;
      }

      const next: ScannedItem[] = data.items.map((i) => ({
        label: i.label.slice(0, MAX_EXPENSE_LABEL_LENGTH),
        rawAmount: money(i.amount),
      }));
      if (data.serviceCharge) next.push({ label: "Service charge", rawAmount: money(data.serviceCharge) });
      setItems(next);
      setTotal(data.total);
    } catch {
      toast.error("Couldn't read that receipt. Check your connection and try again.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const update = (i: number, patch: Partial<ScannedItem>) =>
    setItems((prev) => prev?.map((it, j) => (j === i ? { ...it, ...patch } : it)) ?? null);

  const sum = (items ?? []).reduce((a, it) => a + (Number.parseFloat(it.rawAmount) || 0), 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              I-scan ang resibo · Scan receipt
            </p>
            <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a photo — AI reads the items and prices so you can check them before adding.
          </p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Receipt photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void scan(f);
        }}
      />
      {!items ? (
        <Button
          type="button"
          variant="secondary"
          className="rounded-full"
          disabled
          title="Receipt scanning coming soon — API key not configured"
        >
          <IconCamera className="size-4" />
          Upload receipt photo
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={it.label}
                maxLength={MAX_EXPENSE_LABEL_LENGTH}
                aria-label={`Item ${i + 1} name`}
                onChange={(e) => update(i, { label: e.target.value })}
                className="h-9 min-w-0 flex-1"
              />
              <Input
                value={it.rawAmount}
                inputMode="decimal"
                aria-label={`Item ${i + 1} amount`}
                onChange={(e) => update(i, { rawAmount: e.target.value.slice(0, 16) })}
                className="h-9 w-24 text-right tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => setItems((prev) => prev?.filter((_, j) => j !== i) ?? null)}
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start rounded-full"
            onClick={() => setItems((prev) => [...(prev ?? []), { label: "", rawAmount: "" }])}
          >
            <IconPlus className="size-4" /> Add line
          </Button>
          <p className="text-xs text-muted-foreground tabular-nums">
            Sum ₱{money(sum)}
            {total !== null ? ` · receipt total ₱${money(total)}` : ""} — prices already include VAT; a printed service charge is added as its own line.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Paid by</span>
            <Select value={payer} onValueChange={setPayerId}>
              <SelectTrigger aria-label="Paid by" className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="rounded-full"
              disabled={!payer || items.length === 0}
              onClick={() => {
                onAdd(payer, items.filter((it) => it.label.trim() || it.rawAmount.trim()));
                toast(`Added ${items.length} expense${items.length === 1 ? "" : "s"} from the receipt`);
                setItems(null);
                setTotal(null);
              }}
            >
              Add to bill
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setItems(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
