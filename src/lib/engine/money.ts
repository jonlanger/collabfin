import type { Freq } from "./types";

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export const FREQ: Record<Freq, number> = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 };
export const FREQ_LABEL: Record<Freq, string> = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Quarterly", annual: "Yearly" };
export const FREQ_SHORT: Record<Freq, string> = { weekly: "per wk", biweekly: "per 2 wk", monthly: "per mo", quarterly: "per qtr", annual: "per yr" };
export const isFreq = (f: unknown): f is Freq => typeof f === "string" && f in FREQ;
export const perMonth = (amount: unknown, freq: unknown) => num(amount) * (isFreq(freq) ? FREQ[freq] : 1);

export const CURRENCIES: Record<string, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
  INR: "Indian rupee",
  JPY: "Japanese yen",
};

const MINUS = "−";

/** Plain number with up to two decimals, for showing values inside inputs. */
export const nfTwo = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export interface MoneyFormat {
  currency: string;
  symbol: string;
  /** $1,234 or −$1,234 */
  money(v: unknown): string;
  /** +$1,234, −$1,234 or $0 */
  signed(v: unknown): string;
}

const cache = new Map<string, MoneyFormat>();
export function moneyFormat(currency: string): MoneyFormat {
  const code = CURRENCIES[currency] ? currency : "USD";
  const hit = cache.get(code);
  if (hit) return hit;
  const f = new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const symbol = f.formatToParts(0).find((p) => p.type === "currency")?.value ?? "$";
  const fmt: MoneyFormat = {
    currency: code,
    symbol,
    money(v) {
      const r = Math.round(num(v));
      return (r < 0 ? MINUS : "") + f.format(Math.abs(r));
    },
    signed(v) {
      const r = Math.round(num(v));
      return (r > 0 ? "+" : r < 0 ? MINUS : "") + f.format(Math.abs(r));
    },
  };
  cache.set(code, fmt);
  return fmt;
}

export type Tone = "pos" | "neg" | "zero";
export const tone = (v: unknown): Tone => {
  const r = Math.round(num(v));
  return r > 0 ? "pos" : r < 0 ? "neg" : "zero";
};

export const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** The month `months` from now, as "Mar 2027". */
export const monthLabel = (months: number, from = new Date()) =>
  new Date(from.getFullYear(), from.getMonth() + months, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
