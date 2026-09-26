import { describe, expect, it } from "vitest";
import { analyzeStatement, buildTransactions, guessColumns, parseAmount, parseCSV, parseDate, sampleStatement } from "./statement";

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes and semicolons", () => {
    expect(parseCSV('a,"b, c","say ""hi"""\n1,2,3')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
    expect(parseCSV("Date;Amount\n2026-01-02;-4,50")).toEqual([
      ["Date", "Amount"],
      ["2026-01-02", "-4,50"],
    ]);
  });
  it("reads amounts in common bank formats", () => {
    expect(parseAmount("(45.00)")).toBe(-45);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("45.00 DR")).toBe(-45);
    expect(parseAmount("abc")).toBeNull();
  });
  it("reads dates without mistaking merchant names for dates", () => {
    expect(parseDate("2026-06-05")?.getMonth()).toBe(5);
    expect(parseDate("25/12/2025")?.getDate()).toBe(25);
    expect(parseDate("SAFEWAY 1123")).toBeNull();
  });
});

describe("statement analysis", () => {
  it("finds the paycheck, recurring bills and spending in the sample", () => {
    const rows = parseCSV(sampleStatement(new Date(2026, 8, 26)));
    const map = guessColumns(rows);
    expect(map).toMatchObject({ date: 0, desc: 1, amount: 2, sign: "negOut" });
    const { txs, skipped } = buildTransactions(rows, map);
    expect(skipped).toBe(0);
    const a = analyzeStatement(txs)!;
    expect(a.transfers).toBe(3);
    expect(a.income[0]).toMatchObject({ freq: "biweekly" });
    expect(a.income[0].amount).toBe(2413);
    const bills = a.recurring.map((r) => r.name);
    expect(bills).toEqual(expect.arrayContaining(["Rent Payment Oakwood", "Netflix Com", "Spotify Usa", "Geico Auto Insurance"]));
    expect(bills.some((b) => /coffee|trader|safeway/i.test(b))).toBe(false);
    expect(a.spend.map((s) => s.name)).toContain("Groceries");
  });
});
