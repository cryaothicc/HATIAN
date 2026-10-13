import {
  IconDownload,
  IconLink,
  IconRotate,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  expenseCodec,
  formatCurrency,
  personCodec,
  type Bill,
  type Settlement,
} from "@/lib/split";

export interface ShareRowProps {
  bill: Bill;
  settlement: Settlement;
  copyShareLink: () => Promise<boolean>;
  onReset: () => Bill;
  onUndoReset: (previous: Bill) => void;
}

/** Approximate the query-string length the share link will produce. */
function approxUrlLength(bill: Bill): number {
  const params = new URLSearchParams({
    name: bill.name,
    currency: bill.currency,
    p: JSON.stringify(bill.persons.map(personCodec.encode)),
    e: JSON.stringify(bill.expenses.map(expenseCodec.encode)),
  });
  return params.toString().length;
}

const AVATAR_HEX: Record<string, string> = {
  blue: "#2563eb", green: "#16a34a", purple: "#7c3aed", orange: "#ea580c",
  pink: "#db2777", teal: "#0d9488", red: "#dc2626", yellow: "#ca8a04",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Draw the settlement as a receipt-style card and download it. Canvas cannot read
 * CSS tokens, so the brand colours are repeated here as hex (the one exception).
 */
function saveImage(bill: Bill, settlement: Settlement): void {
  const person = (id: string) => bill.persons.find((p) => p.id === id);
  const nameOf = (id: string) => person(id)?.name || "Unnamed";
  const colorOf = (id: string) => AVATAR_HEX[person(id)?.color ?? ""] ?? "#0b3d91";
  const money = (n: number) => formatCurrency(n, bill.currency);
  const transfers = settlement.transfers;

  const scale = 2;
  const W = 560;
  const pad = 28;
  const rowH = 64;
  const listTop = 300;
  const rows = transfers.length;
  const H = listTop + rows * rowH + 40;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  const heading = "Sora, system-ui, sans-serif";
  const body = "Manrope, system-ui, sans-serif";

  // Page + card
  ctx.fillStyle = "#e8edf5";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fafaf7";
  roundRect(ctx, 16, 16, W - 32, H - 32, 24);
  ctx.fill();

  // Header band
  ctx.save();
  roundRect(ctx, 16, 16, W - 32, 120, 24);
  ctx.clip();
  ctx.fillStyle = "#0b3d91";
  ctx.fillRect(16, 16, W - 32, 140);
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 13px ${body}`;
  ctx.fillText("HATIAN", pad + 16, 56);
  ctx.font = `700 28px ${heading}`;
  ctx.fillText(bill.name || "Bill", pad + 16, 98, W - 2 * pad - 32);

  // Totals
  const boxW = (W - 2 * pad - 32 - 12) / 2;
  [["KABUUAN · TOTAL", settlement.totalSpent], ["BABAYARAN · TO SETTLE", settlement.toSettle]].forEach(([label, val], i) => {
    const x = pad + 16 + i * (boxW + 12);
    ctx.fillStyle = "#e8edf5";
    roundRect(ctx, x, 156, boxW, 92, 16);
    ctx.fill();
    ctx.fillStyle = "#5b6475";
    ctx.font = `600 11px ${body}`;
    ctx.fillText(label as string, x + 16, 182);
    ctx.fillStyle = "#0b3d91";
    ctx.font = `700 26px ${heading}`;
    ctx.fillText(money(val as number), x + 16, 226, boxW - 32);
  });

  ctx.fillStyle = "#1a1a1a";
  ctx.font = `700 15px ${heading}`;
  ctx.fillText("Sino ang magbabayad · Who pays whom", pad + 16, 282);

  const avatar = (id: string, cx: number, cy: number) => {
    ctx.fillStyle = colorOf(id);
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 13px ${body}`;
    ctx.textAlign = "center";
    ctx.fillText(nameOf(id).charAt(0).toUpperCase(), cx, cy + 5);
    ctx.textAlign = "left";
  };

  transfers.forEach((t, i) => {
    const y = listTop + i * rowH;
    const cy = y + 32;
    avatar(t.fromId, pad + 32, cy);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `600 15px ${body}`;
    const from = nameOf(t.fromId);
    ctx.fillText(from, pad + 54, cy + 5, 120);
    const fw = Math.min(120, ctx.measureText(from).width);
    ctx.fillStyle = "#5b6475";
    ctx.fillText("→", pad + 62 + fw, cy + 5);
    avatar(t.toId, pad + 98 + fw, cy);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(nameOf(t.toId), pad + 120 + fw, cy + 5, 130);
    ctx.fillStyle = "#0b3d91";
    ctx.font = `700 17px ${heading}`;
    ctx.textAlign = "right";
    ctx.fillText(money(t.amount), W - pad - 16, cy + 6);
    ctx.textAlign = "left";
    if (i < transfers.length - 1) {
      ctx.strokeStyle = "#d5dbe6";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad + 16, y + rowH);
      ctx.lineTo(W - pad - 16, y + rowH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });


  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "hatian.png";
  a.click();
}

/**
 * The one and only sharing surface (D10): Copy link, Save image and
 * Reset — outline buttons with `sonner` confirmations — plus the snapshot
 * disclaimer. Nowhere else in the app copies or shares.
 */
export function ShareRow({ bill, settlement, copyShareLink, onReset, onUndoReset }: ShareRowProps) {

  const handleCopyLink = async () => {
    const ok = await copyShareLink();
    if (!ok) {
      toast.error("Couldn't copy the link — copy it from the address bar instead.");
      return;
    }
    if (approxUrlLength(bill) > 1800) {
      toast("This bill is too big to fit in a link — save it as an image instead.");
    } else {
      toast("Link copied");
    }
  };

  const handleSaveImage = () => {
    saveImage(bill, settlement);
    toast("Image saved");
  };

  const handleReset = () => {
    const previous = onReset();
    toast("Reset to example bill", {
      action: { label: "Undo", onClick: () => onUndoReset(previous) },
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-full text-foreground" onClick={handleCopyLink}>
          <IconLink />
          Copy link
        </Button>
        <Button variant="outline" size="sm" className="rounded-full text-foreground" onClick={handleSaveImage}>
          <IconDownload />
          Save image
        </Button>
        <Button variant="outline" size="sm" className="rounded-full text-foreground" onClick={handleReset}>
          <IconRotate />
          Reset
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A link is a snapshot. Edits after you send it stay with you.
      </p>
    </div>
  );
}
