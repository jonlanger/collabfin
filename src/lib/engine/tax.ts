import data from "@/lib/tax/2026.json";
import { clamp, num } from "./money";
import type { Card, Filing } from "./types";

type Brackets = [number, number][];
interface StateIncome {
  single: Brackets;
  married: Brackets;
  standardDeduction: [number, number];
  exemption: [number, number];
  credit: [number, number];
}
export interface StateTax {
  name: string;
  salesRate: number;
  propertyRate: number;
  income: StateIncome | null;
}

export const TAX_YEAR: number = data.year;
export const TAX_SOURCES: Record<string, string> = data.sources;
export const STATES = data.states as unknown as Record<string, StateTax>;
export const STATE_CODES = Object.keys(STATES).sort((a, b) => STATES[a].name.localeCompare(STATES[b].name));
export const FILING: Record<Filing, string> = { single: "Single", married: "Married filing jointly", hoh: "Head of household" };
export const isFiling = (f: unknown): f is Filing => typeof f === "string" && f in FILING;
const FED = data.federal as unknown as Record<Filing, { std: number; brackets: Brackets }>;
const FICA = data.fica;

/** Tax on `income` across progressive brackets given as [threshold, ratePercent]. */
export function bracketTax(income: number, brackets: Brackets): number {
  let t = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i][0];
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (income > lo) t += ((Math.min(income, hi) - lo) * brackets[i][1]) / 100;
  }
  return t;
}
export function marginalRate(income: number, brackets: Brackets): number {
  let r = 0;
  for (const [lo, rate] of brackets) if (income > lo) r = rate;
  return r;
}

export interface PaycheckResult {
  gross: number;
  pretax: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  state: number;
  total: number;
  takeHome: number;
  effectiveRate: number;
  federalMarginal: number;
  stateMarginal: number;
}

/**
 * Estimated yearly taxes on wages. Pre-tax deductions (401(k), HSA, premiums) reduce income tax but
 * not FICA. State tax uses the state's single or married brackets (head of household uses single),
 * standard deduction and personal exemption, then subtracts any per-filer credit.
 */
export function paycheckTax(grossIn: unknown, pretaxIn: unknown, state: unknown, filingIn: unknown): PaycheckResult {
  const filing: Filing = isFiling(filingIn) ? filingIn : "single";
  const gross = clamp(num(grossIn), 0, 10_000_000);
  const pretax = clamp(num(pretaxIn), 0, gross);
  const f = FED[filing];
  const fedTaxable = Math.max(0, gross - pretax - f.std);
  const federal = bracketTax(fedTaxable, f.brackets);
  const socialSecurity = (Math.min(gross, FICA.socialSecurityWageBase) * FICA.socialSecurityRate) / 100;
  const addl = FICA.additionalMedicareThreshold[filing];
  const medicare = (gross * FICA.medicareRate) / 100 + (Math.max(0, gross - addl) * FICA.additionalMedicareRate) / 100;
  const st = typeof state === "string" ? STATES[state] : undefined;
  let stateTax = 0;
  let stateMarginal = 0;
  if (st?.income) {
    const i = filing === "married" ? 1 : 0;
    const brackets = i ? st.income.married : st.income.single;
    const taxable = Math.max(0, gross - pretax - st.income.standardDeduction[i] - st.income.exemption[i]);
    stateTax = Math.max(0, bracketTax(taxable, brackets) - st.income.credit[i]);
    stateMarginal = marginalRate(taxable, brackets);
  }
  const total = federal + socialSecurity + medicare + stateTax;
  return {
    gross,
    pretax,
    federal,
    socialSecurity,
    medicare,
    state: stateTax,
    total,
    takeHome: Math.max(0, gross - pretax - total),
    effectiveRate: gross > 0 ? total / gross : 0,
    federalMarginal: marginalRate(fedTaxable, f.brackets),
    stateMarginal,
  };
}

const hasOverride = (v: unknown) => v !== null && v !== undefined && v !== "";
export const propertyRateFor = (c: Pick<Card, "propRate" | "state">) =>
  hasOverride(c.propRate) ? clamp(num(c.propRate), 0, 10) : STATES[c.state ?? ""]?.propertyRate ?? 0;
export const salesRateFor = (c: Pick<Card, "salesRate" | "state">) =>
  hasOverride(c.salesRate) ? clamp(num(c.salesRate), 0, 15) : STATES[c.state ?? ""]?.salesRate ?? 0;
