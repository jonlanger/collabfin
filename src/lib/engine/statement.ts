import { newId } from "./money";
import type { Freq } from "./types";

/* Bank statement import. Everything here runs in the browser; transactions are never stored. */

export function parseCSV(text: string, maxRows = 20000): string[][] {
  const nl = text.indexOf("\n");
  const first = text.slice(0, nl > 0 ? nl : text.length);
  const count = (d: string) => first.split(d).length;
  const delim = count(";") > count(",") ? ";" : count("\t") > count(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(f);
      f = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
      if (rows.length > maxRows) break;
    } else f += ch;
  }
  if (f !== "" || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

export function parseDate(input: unknown): Date | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    const [mo, d] = a > 12 ? [b, a] : [a, b];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d);
  }
  // Written-out dates such as "Sep 3, 2026" or "3 September 2026" only.
  if (!/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b/i.test(s) || !/\b(19|20)\d{2}\b/.test(s)) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return d.getFullYear() >= 1990 && d.getFullYear() <= 2100 ? d : null;
}

/** "1,234.56", "(45.00)", "-45", "45.00 DR", "1.234,56" (European) */
export function parseAmount(input: unknown): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s) || /-|−/.test(s) || /\bDR\b/i.test(s);
  if (/\bCR\b/i.test(s)) neg = false;
  const t = s.replace(/[^\d.,]/g, "");
  if (!t) return null;
  const european = /,\d{2}$/.test(t) && !/\.\d{2}$/.test(t);
  const n = Number(european ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export interface ColumnMap {
  headerRow: number;
  date: number;
  desc: number;
  amount: number;
  debit: number;
  credit: number;
  /** negOut: money out is negative. posOut: money out is positive. */
  sign: "negOut" | "posOut";
}

export function guessColumns(rows: string[][]): ColumnMap {
  let headerRow = rows.findIndex((r) => r.filter((c) => c && parseAmount(c) == null && !parseDate(c)).length >= 2);
  if (headerRow < 0 || headerRow > 10) headerRow = 0;
  const h = (rows[headerRow] ?? []).map((x) => x.toLowerCase());
  const find = (re: RegExp, not?: RegExp) => h.findIndex((x) => re.test(x) && !(not && not.test(x)));
  const map: ColumnMap = {
    headerRow,
    date: find(/date|posted|time/),
    desc: find(/desc|payee|merchant|name|memo|details|narrative|reference|transaction/, /date|type|amount/),
    amount: find(/^amount|amount$|^value|sum/),
    debit: find(/debit|withdraw|money out|paid out/),
    credit: find(/credit|deposit|money in|paid in/, /card/),
    sign: "negOut",
  };
  if (map.amount >= 0) {
    const vals = rows.slice(headerRow + 1, headerRow + 60).map((r) => parseAmount(r[map.amount])).filter((v): v is number => v != null);
    if (vals.length && vals.filter((v) => v < 0).length / vals.length < 0.1) map.sign = "posOut";
  }
  return map;
}

export interface Transaction {
  date: Date;
  desc: string;
  /** Positive = money in, negative = money out. */
  amt: number;
}

export function buildTransactions(rows: string[][], map: ColumnMap): { txs: Transaction[]; skipped: number } {
  const txs: Transaction[] = [];
  let skipped = 0;
  for (const r of rows.slice(map.headerRow + 1)) {
    const date = parseDate(r[map.date]);
    let amt: number | null = null;
    if (map.amount >= 0) {
      amt = parseAmount(r[map.amount]);
      if (amt != null && map.sign === "posOut") amt = -amt;
    } else {
      const d = parseAmount(r[map.debit]);
      const c = parseAmount(r[map.credit]);
      if (d != null || c != null) amt = Math.abs(c ?? 0) - Math.abs(d ?? 0);
    }
    if (!date || amt == null || amt === 0) {
      skipped++;
      continue;
    }
    txs.push({ date, desc: String(map.desc >= 0 ? r[map.desc] ?? "" : "").slice(0, 120), amt });
  }
  return { txs, skipped };
}

const TRANSFER_RE = /transfer|xfer|to savings|from savings|credit card payment|card payment|payment thank you|autopay payment|online pmt|zelle to self/i;
const INCOME_RE = /payroll|salary|direct dep|dir dep|paycheck|payrl|wages|employer/i;
export const CATEGORIES: [string, RegExp][] = [
  ["Groceries", /grocer|market|safeway|kroger|whole foods|trader joe|aldi|costco|publix|wegmans|heb|lidl|tesco|sainsbury/i],
  ["Dining & coffee", /restaurant|cafe|coffee|starbucks|doordash|uber eats|ubereats|grubhub|pizza|burger|taco|sushi|bar\b|grill|kitchen|deli|bakery|chipotle|mcdonald/i],
  ["Transport", /uber|lyft|shell|chevron|exxon|bp\b|gas|fuel|transit|parking|metro|toll|train|airline|airlines/i],
  ["Shopping", /amazon|target|walmart|ikea|best buy|etsy|ebay|apple\.com|store|shop/i],
  ["Health", /pharmacy|cvs|walgreens|dental|doctor|clinic|hospital|gym|fitness/i],
  ["Entertainment", /netflix|spotify|hulu|disney|cinema|theater|theatre|steam|playstation|xbox|ticket/i],
];

export function merchantKey(desc: string): string {
  return String(desc || "")
    .toLowerCase()
    .replace(/^(pos|debit card|debit|purchase|card purchase|ach|recurring|visa|mc)\s+/g, "")
    .replace(/\b(sq|tst|pp|paypal|sp)\s?\*/g, "")
    .replace(/[#*]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z&' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}
const pretty = (k: string) => k.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ") || "Unknown";
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export function freqFromInterval(days: number): Freq | null {
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 12 && days <= 16) return "biweekly";
  if (days >= 25 && days <= 35) return "monthly";
  if (days >= 80 && days <= 100) return "quarterly";
  if (days >= 340 && days <= 390) return "annual";
  return null;
}

export interface Finding {
  id: string;
  name: string;
  amount: number;
  freq: Freq;
  count: number;
  on: boolean;
}
export interface StatementAnalysis {
  from: Date;
  to: Date;
  months: number;
  count: number;
  transfers: number;
  income: Finding[];
  recurring: Finding[];
  spend: Finding[];
}

/** Finds paychecks, recurring bills and spending categories in a list of transactions. */
export function analyzeStatement(all: Transaction[]): StatementAnalysis | null {
  const transfers = all.filter((t) => TRANSFER_RE.test(t.desc));
  const use = all.filter((t) => !TRANSFER_RE.test(t.desc));
  if (!use.length) return null;
  const times = use.map((t) => t.date.getTime());
  const from = new Date(Math.min(...times));
  const to = new Date(Math.max(...times));
  const months = Math.max(1, ((to.getTime() - from.getTime()) / 864e5 + 1) / 30.44);
  const groups: Record<string, Transaction[]> = {};
  for (const t of use) (groups[(t.amt > 0 ? "in:" : "out:") + merchantKey(t.desc)] ??= []).push(t);
  const income: Finding[] = [];
  const recurring: Finding[] = [];
  const used = new Set<Transaction>();
  for (const [k, g] of Object.entries(groups)) {
    const isIn = k.startsWith("in:");
    const key = k.slice(k.indexOf(":") + 1);
    const amts = g.map((t) => Math.abs(t.amt));
    const med = median(amts);
    const monthsSeen = new Set(g.map((t) => `${t.date.getFullYear()}-${t.date.getMonth()}`)).size;
    const sorted = [...g].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps = sorted.slice(1).map((t, i) => (t.date.getTime() - sorted[i].date.getTime()) / 864e5);
    const freq = gaps.length ? freqFromInterval(median(gaps)) : null;
    const steady = amts.filter((a) => Math.abs(a - med) <= med * 0.15).length / amts.length >= 0.8;
    const total = amts.reduce((s, a) => s + a, 0);
    if (isIn) {
      if (INCOME_RE.test(g[0].desc) || (freq && steady && g.length >= 2)) {
        income.push({ id: newId(), name: pretty(key), amount: Math.round(freq && steady ? med : total / months), freq: freq && steady ? freq : "monthly", count: g.length, on: true });
        g.forEach((t) => used.add(t));
      }
      continue;
    }
    const perMonthCount = g.length / months;
    const maxPer = freq === "biweekly" ? 2.6 : 1.6;
    const everyday = CATEGORIES.slice(0, 3).some(([, re]) => re.test(g[0].desc));
    if (g.length >= 2 && monthsSeen >= 2 && steady && freq && freq !== "weekly" && perMonthCount <= maxPer && !everyday) {
      recurring.push({ id: newId(), name: pretty(key), amount: Math.round(med * 100) / 100, freq, count: g.length, on: true });
      g.forEach((t) => used.add(t));
    }
  }
  let otherIn = 0;
  const cats: Record<string, { total: number; count: number }> = {};
  for (const t of use) {
    if (used.has(t)) continue;
    if (t.amt > 0) {
      otherIn += t.amt;
      continue;
    }
    const cat = (CATEGORIES.find(([, re]) => re.test(t.desc)) ?? ["Other spending"])[0];
    const c = (cats[cat] ??= { total: 0, count: 0 });
    c.total += -t.amt;
    c.count++;
  }
  const spend = Object.entries(cats)
    .map(([name, c]) => ({ id: newId(), name, amount: Math.round(c.total / months / 10) * 10, freq: "monthly" as Freq, count: c.count, on: true }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (otherIn / months >= 50) income.push({ id: newId(), name: "Other money in", amount: Math.round(otherIn / months / 10) * 10, freq: "monthly", count: 0, on: false });
  recurring.sort((a, b) => b.amount - a.amount);
  return { from, to, months, count: use.length, transfers: transfers.length, income, recurring, spend };
}

/** A realistic three-month statement, clearly labelled as a sample in the UI. Deterministic. */
export function sampleStatement(now = new Date()): string {
  const rows: string[][] = [["Date", "Description", "Amount"]];
  const d0 = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const day = (n: number) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + n);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const add = (date: Date, desc: string, amt: number) => rows.push([iso(date), desc, amt.toFixed(2)]);
  for (let n = 4; n < 90; n += 14) add(day(n), "ACME CORP PAYROLL DIR DEP", 2412.56);
  for (let m = 0; m < 3; m++) {
    add(day(m * 30 + 1), "RENT PAYMENT OAKWOOD APTS", -1850);
    add(day(m * 30 + 6), "COMCAST INTERNET", -69.99);
    add(day(m * 30 + 9), "NETFLIX.COM", -15.49);
    add(day(m * 30 + 12), "SPOTIFY USA", -11.99);
    add(day(m * 30 + 15), "VERIZON WIRELESS", -85);
    add(day(m * 30 + 20), "GEICO AUTO INSURANCE", -142.3);
    add(day(m * 30 + 22), "ONLINE TRANSFER TO SAVINGS", -500);
  }
  const shops: [string, number, number][] = [
    ["TRADER JOE'S #552", 60, 95],
    ["SAFEWAY 1123", 40, 120],
    ["STARBUCKS STORE 8812", 5, 9],
    ["SQ *BLUE BOTTLE COFFEE", 5, 8],
    ["DOORDASH*THAI HOUSE", 28, 45],
    ["SHELL OIL 5543", 38, 55],
    ["AMAZON MKTP US", 12, 80],
    ["CHIPOTLE 1932", 11, 16],
    ["UBER *TRIP", 12, 30],
    ["CVS PHARMACY", 8, 35],
  ];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let n = 0; n < 90; n++) {
    if (rnd() < 0.65) {
      const s = shops[Math.floor(rnd() * shops.length)];
      add(day(n), s[0], -(s[1] + rnd() * (s[2] - s[1])));
    }
  }
  return rows.map((r) => r.map((c) => (/[,"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
}
