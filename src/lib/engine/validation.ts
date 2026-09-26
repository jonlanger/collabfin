export const MAX_MONEY = 10_000_000;

export interface NumberRule {
  min?: number;
  max?: number;
  integer?: boolean;
  /** Format limits as percentages in error messages. */
  pct?: boolean;
}

export const RULES = {
  amount: { min: 0, max: MAX_MONEY },
  balance: { min: -MAX_MONEY, max: MAX_MONEY },
  debt: { min: 0, max: MAX_MONEY },
  target: { min: 1, max: MAX_MONEY },
  pct: { min: 0, max: 100, integer: true, pct: true },
  apr: { min: 0, max: 100, pct: true },
  settingPct: { min: 0, max: 100, integer: true, pct: true },
  inflation: { min: 0, max: 20, pct: true },
  buffer: { min: 0, max: MAX_MONEY },
  apy: { min: 0, max: 20, pct: true },
  ret: { min: -20, max: 30, pct: true },
  fees: { min: 0, max: 5, pct: true },
  taxPct: { min: 0, max: 60, pct: true },
  propRate: { min: 0, max: 10, pct: true },
  salesRate: { min: 0, max: 15, pct: true },
} satisfies Record<string, NumberRule>;
export type RuleName = keyof typeof RULES;

/** Parses what someone typed: allows a currency symbol, commas, spaces, % and a leading minus. Empty is 0. */
export function parseNumber(s: unknown, symbol = "$"): number | null {
  if (s == null) return null;
  const t = String(s).trim().split(symbol).join("").replace(/[,\s%$]/g, "").replace("−", "-");
  if (t === "") return 0;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

export type Validation = { n: number; err?: undefined } | { err: string; n?: undefined };

export function validateNumber(text: unknown, rule: NumberRule, formatMoney: (v: number) => string, symbol = "$"): Validation {
  const r = { min: 0, max: MAX_MONEY, ...rule };
  const n = parseNumber(text, symbol);
  const fmt = (v: number) => (r.pct ? `${v}%` : formatMoney(v));
  if (n == null) return { err: r.pct ? "Enter a number, like 20." : "Enter a number, like 1,250." };
  if (n < r.min) return { err: r.min === 0 ? "Enter 0 or more." : `Enter ${fmt(r.min)} or more.` };
  if (n > r.max) return { err: `Enter ${fmt(r.max)} or less.` };
  if (r.integer && !Number.isInteger(n)) return { err: "Use a whole number." };
  return { n: r.integer ? Math.round(n) : Math.round(n * 100) / 100 };
}

export function validateName(value: string, opts: { label: string; max: number; existing?: string[] }): string | null {
  const t = value.trim();
  if (!t) return `Give the ${opts.label} a name.`;
  if (t.length > opts.max) return `Keep the name under ${opts.max} characters.`;
  if (opts.existing?.some((e) => e.trim().toLowerCase() === t.toLowerCase())) return `There’s already a ${opts.label} with that name.`;
  return null;
}
