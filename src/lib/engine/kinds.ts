import { newId } from "./money";
import type { AccountType, BoardSettings, Card, CardKind } from "./types";

export interface KindInfo {
  label: string;
  desc: string;
  inPort: boolean;
  outPort: boolean;
  w: number;
}

export const KINDS: Record<CardKind, KindInfo> = {
  income: { label: "Income", desc: "Paychecks and money coming in", inPort: true, outPort: true, w: 272 },
  account: { label: "Account", desc: "Checking, savings, CD or investing", inPort: true, outPort: true, w: 320 },
  recurring: { label: "Recurring payments", desc: "Rent, bills, subscriptions, loans", inPort: true, outPort: true, w: 368 },
  spend: { label: "Spend", desc: "A budget for everyday spending", inPort: true, outPort: true, w: 272 },
  debt: { label: "Debt", desc: "A loan or card balance with a payoff date", inPort: false, outPort: true, w: 320 },
  tax: { label: "Taxes", desc: "Take-home pay, property or sales tax", inPort: false, outPort: true, w: 340 },
  split: { label: "Split", desc: "Send a percentage onward", inPort: true, outPort: true, w: 264 },
  goal: { label: "Savings goal", desc: "See when you will reach it", inPort: true, outPort: false, w: 288 },
  note: { label: "Note", desc: "A sticky note for the team", inPort: false, outPort: false, w: 232 },
  file: { label: "File", desc: "A file shared on the board", inPort: false, outPort: false, w: 256 },
};
export const PALETTE: CardKind[] = ["income", "account", "recurring", "spend", "debt", "tax", "split", "goal", "note"];
export const isKind = (k: unknown): k is CardKind => typeof k === "string" && k in KINDS;

export const ACCOUNT_TYPES: Record<AccountType, string> = { checking: "Checking", savings: "Savings", cd: "CD", investment: "Investing" };
export const accountTypeOf = (c: Card): AccountType => (c.atype && c.atype in ACCOUNT_TYPES ? c.atype : "checking");

export function portsFor(c: Card): { inPort: boolean; outPort: boolean } {
  const k = KINDS[c.kind];
  if (!k) return { inPort: false, outPort: false };
  if (c.kind === "account" && accountTypeOf(c) === "cd") return { inPort: false, outPort: false };
  if (c.kind === "tax" && c.mode === "sales") return { inPort: false, outPort: false };
  return { inPort: k.inPort, outPort: k.outPort };
}

export function cardName(c: Card | undefined): string {
  if (!c) return "a card";
  if (c.kind === "note") return "a note";
  if (c.kind === "file") return c.name || "a file";
  return c.title || KINDS[c.kind]?.label || "a card";
}

export function kindLabel(c: Card): string {
  return c.kind === "account" ? `${ACCOUNT_TYPES[accountTypeOf(c)]} account` : KINDS[c.kind].label;
}

export function newCard(kind: CardKind, x: number, y: number, s?: Partial<BoardSettings>): Card {
  const base = { id: newId(), kind, x: Math.round(x), y: Math.round(y) };
  switch (kind) {
    case "income":
      return { ...base, title: "Paycheck", amount: 0, freq: "monthly" };
    case "account":
      return { ...base, title: "Checking", atype: "checking", balance: 0, horizon: s?.horizon ?? 12 };
    case "recurring":
      return { ...base, title: "Bills", items: [{ id: newId(), name: "Rent", amount: 0, freq: "monthly" }] };
    case "spend":
      return { ...base, title: "Everyday spending", amount: 0, freq: "monthly" };
    case "debt":
      return { ...base, title: "Credit card", balance: 0, apr: 22, payment: 0, extra: 0 };
    case "tax":
      return { ...base, title: "Paycheck", mode: "paycheck", gross: 0, pretax: 0, state: s?.state ?? "", filing: s?.filing ?? "single", homeValue: 0, spend: 0 };
    case "split":
      return { ...base, title: "Save a share", pct: 20 };
    case "goal":
      return { ...base, title: "Emergency fund", target: 10000, saved: 0 };
    case "note":
      return { ...base, text: "" };
    default:
      return base;
  }
}
