export type Freq = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
export type CardKind = "income" | "account" | "recurring" | "spend" | "debt" | "tax" | "split" | "goal" | "note" | "file";
export type AccountType = "checking" | "savings" | "cd" | "investment";
export type TaxMode = "paycheck" | "property" | "sales";
export type Filing = "single" | "married" | "hoh";

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  freq: Freq;
}

/**
 * A card on a plan. Every kind shares the base fields; the rest are optional so data written by
 * other clients (or older versions) never breaks the engine. The engine always reads numbers
 * through `num()` and treats missing fields as defaults.
 */
export interface Card {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  title?: string;
  // income, spend
  amount?: number;
  freq?: Freq;
  // recurring
  items?: RecurringItem[];
  // account
  atype?: AccountType;
  balance?: number;
  horizon?: number;
  apy?: number;
  term?: number;
  opened?: string; // YYYY-MM
  ret?: number;
  fees?: number;
  taxPct?: number;
  // debt
  apr?: number;
  payment?: number;
  extra?: number;
  // tax
  mode?: TaxMode;
  gross?: number;
  pretax?: number;
  state?: string;
  filing?: Filing;
  homeValue?: number;
  propRate?: number | null;
  spend?: number;
  salesRate?: number | null;
  // split
  pct?: number;
  // goal
  target?: number;
  saved?: number;
  // note
  text?: string;
  // file
  name?: string;
  size?: number;
  type?: string;
  path?: string;
}

export interface Link {
  id: string;
  from: string;
  to: string;
}

export type CardMap = Record<string, Card>;
export type LinkMap = Record<string, Link>;

export interface AutomationSettings {
  linkOutflows: boolean;
  linkIncome: boolean;
  payYourselfFirst: boolean;
  notifyChecks: boolean;
  goalAlert: boolean;
}

export interface BoardSettings {
  currency: string;
  horizon: number;
  savingsTarget: number;
  billsCap: number;
  buffer: number;
  inflation: number;
  primaryAccount: string;
  state: string;
  filing: Filing;
  auto: AutomationSettings;
}
