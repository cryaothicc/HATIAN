import {
  computeBalances,
  parseAmount,
  personCodec,
  expenseCodec,
  validateAmount,
  type Bill,
} from "@/lib/split";
import { SEED_BILL, SEED_EXPECTED } from "@/data/seed";

describe("parseAmount", () => {
  it("treats blank as 0", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("   ")).toBe(0);
  });

  it("reads a plain integer", () => {
    expect(parseAmount("120")).toBe(120);
  });

  it("takes the last comma as the decimal separator (European)", () => {
    expect(parseAmount("60,00")).toBe(60);
    expect(parseAmount("30,4")).toBeCloseTo(30.4, 5);
  });

  it("takes the last dot as the decimal separator", () => {
    expect(parseAmount("60.50")).toBeCloseTo(60.5, 5);
  });

  it("handles grouped thousands in both conventions", () => {
    expect(parseAmount("1,234.56")).toBeCloseTo(1234.56, 5);
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56, 5);
  });

  it("strips currency symbols", () => {
    expect(parseAmount("$20")).toBe(20);
    expect(parseAmount("€1.234,50")).toBeCloseTo(1234.5, 5);
  });
});

describe("validateAmount", () => {
  it("rejects negatives with a recovery message", () => {
    expect(validateAmount("-20")).toBe("Amounts can't be negative.");
  });
  it("accepts valid amounts", () => {
    expect(validateAmount("60")).toBeNull();
    expect(validateAmount("$20")).toBeNull();
    expect(validateAmount("30,4")).toBeNull();
  });
  it("rejects excessively large or long amounts", () => {
    expect(validateAmount("1000000001")).toBe("Amount is too large.");
    expect(validateAmount("1".repeat(33))).toBe("Enter a shorter amount.");
  });
});

describe("computeBalances (seed fixture)", () => {
  const settlement = computeBalances(SEED_BILL);

  it("totals match the known-correct answer", () => {
    expect(settlement.totalSpent).toBe(SEED_EXPECTED.totalSpent);
    expect(settlement.toSettle).toBe(SEED_EXPECTED.toSettle);
  });

  it("per-person balances match ($15 / $45 / −$60)", () => {
    for (const expected of SEED_EXPECTED.balances) {
      const actual = settlement.balances.find((b) => b.personId === expected.personId)!;
      expect(actual.paid).toBeCloseTo(expected.paid, 5);
      expect(actual.owes).toBeCloseTo(expected.owes, 5);
      expect(actual.net).toBeCloseTo(expected.net, 5);
    }
  });

  it("produces the fewest-transfers list (Maria→Paolo ₱2,250, Maria→Juan ₱750)", () => {
    expect(settlement.transfers).toEqual([
      { fromId: "ma", toId: "pa", amount: 2250 },
      { fromId: "ma", toId: "ju", amount: 750 },
    ]);
  });

  it("is all-square when nothing is owed", () => {
    const zeroed: Bill = {
      ...SEED_BILL,
      expenses: SEED_BILL.expenses.map((e) => ({ ...e, rawAmount: "0" })),
    };
    const s = computeBalances(zeroed);
    expect(s.toSettle).toBe(0);
    expect(s.transfers).toHaveLength(0);
  });

  it("ignores unsafe ids and invalid amount magnitudes without prototype collisions", () => {
    const hostile: Bill = {
      name: "Hostile",
      currency: "USD",
      persons: [
        { id: "__proto__", name: "One", color: "red" },
        { id: "constructor", name: "Two", color: "blue" },
      ],
      expenses: [
        { id: "__proto__", payerId: "__proto__", sharerIds: ["__proto__", "constructor"], rawAmount: "1000000001", label: "" },
      ],
    };
    const result = computeBalances(hostile);
    expect(result.totalSpent).toBe(0);
    expect(result.balances).toHaveLength(2);
    expect(result.balances.every((balance) => balance.net === 0)).toBe(true);
  });
});

describe("URL codecs round-trip", () => {
  it("decode(encode(person)) === person", () => {
    for (const p of SEED_BILL.persons) {
      expect(personCodec.decode(personCodec.encode(p))).toEqual(p);
    }
  });

  it("decode(encode(expense)) === expense", () => {
    for (const e of SEED_BILL.expenses) {
      expect(expenseCodec.decode(expenseCodec.encode(e))).toEqual(e);
    }
  });

  it("survives a name that contains the delimiter", () => {
    const p = { id: "zz", name: "A: B: C", color: "red" };
    expect(personCodec.decode(personCodec.encode(p))).toEqual(p);
  });

  it("does not crash on malformed percent encoding", () => {
    expect(personCodec.decode("id:%E0%A4%A:blue").name).toBe("");
    expect(expenseCodec.decode("e1:p1:p1:10:%E0%A4%A").label).toBe("");
  });
});

import { formatCurrency } from "@/lib/split";

describe("Philippine peso", () => {
  it("formats PHP with ₱ and two decimals", () => {
    expect(formatCurrency(1234.5, "PHP")).toBe("₱1,234.50");
  });
});
