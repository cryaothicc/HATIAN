import { useEffect, useRef, useState } from "react";
import { Calculator, X } from "lucide-react";

type Op = "+" | "−" | "×" | "÷";

function apply(a: number, b: number, op: Op): number {
  if (op === "+") return a + b;
  if (op === "−") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? NaN : a / b;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  return String(Math.round(n * 1e10) / 1e10);
}

export function PocketCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const digit = (d: string) => {
    if (fresh || display === "0" || display === "Error") {
      setDisplay(d === "." ? "0." : d);
      setFresh(false);
    } else if (!(d === "." && display.includes(".")) && display.length < 14) {
      setDisplay(display + d);
    }
  };
  const operator = (next: Op) => {
    const cur = parseFloat(display);
    if (acc !== null && op && !fresh) {
      const r = apply(acc, cur, op);
      setAcc(r);
      setDisplay(fmt(r));
    } else setAcc(cur);
    setOp(next);
    setFresh(true);
  };
  const equals = () => {
    if (acc === null || !op) return;
    setDisplay(fmt(apply(acc, parseFloat(display), op)));
    setAcc(null);
    setOp(null);
    setFresh(true);
  };
  const clear = () => {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  };
  const back = () => {
    if (fresh) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const key = "h-12 rounded-xl text-lg font-semibold transition-colors active:scale-95";
  const num = `${key} bg-secondary text-secondary-foreground hover:bg-secondary/70`;
  const opk = `${key} bg-primary text-primary-foreground hover:bg-primary/90`;
  const fn = `${key} bg-muted text-muted-foreground hover:bg-muted/70`;

  return (
    <div ref={containerRef} className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-3">
      {open && (
        <div className="w-64 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="mb-3 rounded-xl bg-muted px-3 py-2 text-right">
            <div className="h-4 text-xs text-muted-foreground">
              {acc !== null && op ? `${fmt(acc)} ${op}` : ""}
            </div>
            <div className="truncate text-3xl font-semibold tabular-nums text-foreground" aria-live="polite">
              {display}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button className={fn} onClick={clear}>C</button>
            <button className={fn} onClick={back} aria-label="Backspace">⌫</button>
            <button className={fn} onClick={() => setDisplay(fmt(parseFloat(display) / 100))}>%</button>
            <button className={opk} onClick={() => operator("÷")}>÷</button>
            {["7", "8", "9"].map((d) => <button key={d} className={num} onClick={() => digit(d)}>{d}</button>)}
            <button className={opk} onClick={() => operator("×")}>×</button>
            {["4", "5", "6"].map((d) => <button key={d} className={num} onClick={() => digit(d)}>{d}</button>)}
            <button className={opk} onClick={() => operator("−")}>−</button>
            {["1", "2", "3"].map((d) => <button key={d} className={num} onClick={() => digit(d)}>{d}</button>)}
            <button className={opk} onClick={() => operator("+")}>+</button>
            <button className={`${num} col-span-2`} onClick={() => digit("0")}>0</button>
            <button className={num} onClick={() => digit(".")}>.</button>
            <button className={opk} onClick={equals}>=</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close calculator" : "Open calculator"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Calculator className="h-6 w-6" />}
      </button>
    </div>
  );
}
