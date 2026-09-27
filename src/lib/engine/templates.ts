import { newId } from "./money";
import type { BoardSettings, Card, CardKind, Freq, Link, RecurringItem } from "./types";

type TCard = Omit<Card, "id"> & { key: string };
export interface Template {
  id: string;
  name: string;
  desc: string;
  build: (s: Partial<BoardSettings>) => { cards: TCard[]; links: [string, string][] };
}

const item = (name: string, amount: number, freq: Freq = "monthly"): RecurringItem => ({ id: newId(), name, amount, freq });
const k = (key: string, kind: CardKind, x: number, y: number, rest: Partial<Card>): TCard => ({ key, kind, x, y, ...rest });
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const TEMPLATES: Template[] = [
  {
    id: "household",
    name: "Household budget",
    desc: "One paycheck, bills and groceries flowing into a joint account, with 30% saved toward an emergency fund.",
    build: () => ({
      cards: [
        k("inc", "income", 0, -60, { title: "Paychecks", amount: 2600, freq: "biweekly" }),
        k("spd", "spend", 0, 330, { title: "Groceries & dining", amount: 180, freq: "weekly" }),
        k("bil", "recurring", 360, 200, { title: "Bills & subscriptions", items: [item("Rent", 1850), item("Car loan", 389), item("Car insurance", 720, "quarterly"), item("Internet", 70), item("Phones", 85), item("Streaming", 42)] }),
        k("acc", "account", 800, -20, { title: "Joint checking", atype: "checking", balance: 8400, horizon: 12 }),
        k("spl", "split", 1180, 20, { title: "Save 30%", pct: 30 }),
        k("gol", "goal", 1520, -20, { title: "Emergency fund", target: 15000, saved: 4200 }),
        k("nte", "note", 820, 470, { text: "Car insurance renews in March. Get two quotes before then." }),
      ],
      links: [["spd", "bil"], ["bil", "acc"], ["inc", "acc"], ["acc", "spl"], ["spl", "gol"]],
    }),
  },
  {
    id: "salary",
    name: "Salary, savings and investing",
    desc: "A salary turned into take-home pay with 2026 tax rates for your home state, plus property tax, a high-yield savings account, a CD and a long-term investing account.",
    build: (s) => {
      const st = s.state || "CO";
      return {
        cards: [
          k("pay", "tax", 0, 0, { title: "Salary after tax", mode: "paycheck", gross: 110000, pretax: 8800, state: st, filing: s.filing || "single", homeValue: 0, spend: 0 }),
          k("prop", "tax", 0, 780, { title: "Property tax", mode: "property", gross: 0, pretax: 0, state: st, filing: "single", homeValue: 450000, spend: 0 }),
          k("bil", "recurring", -30, 1320, { title: "Home & bills", items: [item("Mortgage", 2350), item("Home insurance", 1800, "annual"), item("Utilities", 210), item("Phone & internet", 130)] }),
          k("acc", "account", 480, 160, { title: "Checking", atype: "checking", balance: 6000, horizon: 12 }),
          k("s1", "split", 900, 0, { title: "Emergency savings 10%", pct: 10 }),
          k("hy", "account", 1240, -80, { title: "High-yield savings", atype: "savings", balance: 9000, apy: 4, taxPct: 22, horizon: 24 }),
          k("s2", "split", 900, 460, { title: "Invest 25%", pct: 25 }),
          k("inv", "account", 1240, 560, { title: "Brokerage account", atype: "investment", balance: 25000, ret: 6, fees: 0.1, taxPct: 15, horizon: 120 }),
          k("cd", "account", 480, 900, { title: "12-month CD", atype: "cd", balance: 10000, apy: 4.1, term: 12, opened: monthsAgo(3), taxPct: 22 }),
        ],
        links: [["pay", "acc"], ["prop", "acc"], ["bil", "acc"], ["acc", "s1"], ["s1", "hy"], ["acc", "s2"], ["s2", "inv"]],
      };
    },
  },
  {
    id: "debt",
    name: "Debt payoff plan",
    desc: "Two debts paid from checking, with extra going to the highest rate first. See how much interest the extra saves.",
    build: () => ({
      cards: [
        k("inc", "income", 0, 0, { title: "Take-home pay", amount: 2450, freq: "biweekly" }),
        k("bil", "recurring", -60, 300, { title: "Bills", items: [item("Rent", 1600), item("Utilities", 140), item("Phone", 65), item("Insurance", 130)] }),
        k("cc", "debt", 20, 640, { title: "Credit card", balance: 6200, apr: 24.99, payment: 180, extra: 250 }),
        k("car", "debt", 20, 1060, { title: "Car loan", balance: 14000, apr: 6.9, payment: 389, extra: 0 }),
        k("acc", "account", 480, 120, { title: "Checking", atype: "checking", balance: 2500, horizon: 12 }),
        k("spd", "spend", 480, 620, { title: "Groceries & everyday", amount: 150, freq: "weekly" }),
        k("nte", "note", 880, 140, { text: "Extra goes to the credit card first because it has the highest rate. Once it’s paid off, roll that payment onto the car loan." }),
      ],
      links: [["inc", "acc"], ["bil", "acc"], ["cc", "acc"], ["car", "acc"], ["spd", "acc"]],
    }),
  },
  {
    id: "503020",
    name: "50/30/20 starter",
    desc: "Take-home pay split into needs, wants and savings. A simple rule to start from and adjust.",
    build: () => ({
      cards: [
        k("inc", "income", 0, 260, { title: "Take-home pay", amount: 4500, freq: "monthly" }),
        k("sn", "split", 400, 0, { title: "Needs 50%", pct: 50 }),
        k("sw", "split", 400, 320, { title: "Wants 30%", pct: 30 }),
        k("ss", "split", 400, 640, { title: "Savings 20%", pct: 20 }),
        k("bil", "recurring", 20, -420, { title: "Needs", items: [item("Rent", 1450), item("Utilities", 160), item("Insurance", 140), item("Transit pass", 90)] }),
        k("an", "account", 780, -80, { title: "Bills account", atype: "checking", balance: 1500, horizon: 12 }),
        k("fun", "spend", 400, 960, { title: "Fun & dining", amount: 1100, freq: "monthly" }),
        k("aw", "account", 780, 330, { title: "Spending account", atype: "checking", balance: 400, horizon: 12 }),
        k("gol", "goal", 780, 760, { title: "Emergency fund", target: 12000, saved: 1000 }),
      ],
      links: [["inc", "sn"], ["inc", "sw"], ["inc", "ss"], ["sn", "an"], ["bil", "an"], ["sw", "aw"], ["fun", "aw"], ["ss", "gol"]],
    }),
  },
  {
    id: "freelance",
    name: "Freelancer with taxes",
    desc: "Client income into a business account, with tax set aside first and a steady owner paycheck.",
    build: () => ({
      cards: [
        k("inc", "income", 0, 0, { title: "Client invoices", amount: 7500, freq: "monthly" }),
        k("biz", "recurring", -60, 300, { title: "Business costs", items: [item("Software", 180), item("Coworking desk", 300), item("Accountant", 1200, "annual")] }),
        k("ab", "account", 420, 0, { title: "Business checking", atype: "checking", balance: 12000, horizon: 12 }),
        k("tax", "split", 820, -120, { title: "Tax set-aside 30%", pct: 30 }),
        k("gt", "goal", 1180, -160, { title: "Quarterly taxes", target: 6300, saved: 2100 }),
        k("pay", "split", 820, 240, { title: "Owner pay 55%", pct: 55 }),
        k("ap", "account", 1180, 280, { title: "Personal checking", atype: "checking", balance: 3000, horizon: 12 }),
        k("per", "recurring", 740, 580, { title: "Personal bills", items: [item("Rent", 1700), item("Utilities", 150), item("Phone", 60), item("Health insurance", 420)] }),
        k("nte", "note", 420, 440, { text: "Estimated tax payments are due Jan 15, Apr 15, Jun 15 and Sep 15." }),
      ],
      links: [["inc", "ab"], ["biz", "ab"], ["ab", "tax"], ["tax", "gt"], ["ab", "pay"], ["pay", "ap"], ["per", "ap"]],
    }),
  },
  {
    id: "roommates",
    name: "Shared apartment",
    desc: "Two people put the same share of each paycheck into a house account for rent, bills and groceries.",
    build: () => ({
      cards: [
        k("ia", "income", 0, 0, { title: "Alex’s pay", amount: 3400, freq: "monthly" }),
        k("is", "income", 0, 340, { title: "Sam’s pay", amount: 2800, freq: "monthly" }),
        k("sa", "split", 380, 0, { title: "Alex puts in 55%", pct: 55 }),
        k("ss", "split", 380, 340, { title: "Sam puts in 55%", pct: 55 }),
        k("hs", "account", 760, 140, { title: "House account", atype: "checking", balance: 800, horizon: 6 }),
        k("bil", "recurring", 700, 560, { title: "Shared bills", items: [item("Rent", 2300), item("Electric", 110), item("Internet", 65), item("Renters’ insurance", 30)] }),
        k("gro", "spend", 300, 680, { title: "Groceries", amount: 160, freq: "weekly" }),
        k("nte", "note", 1140, 160, { text: "The same percentage of each paycheck keeps things fair when incomes differ." }),
      ],
      links: [["ia", "sa"], ["is", "ss"], ["sa", "hs"], ["ss", "hs"], ["bil", "hs"], ["gro", "hs"]],
    }),
  },
];

/** Turns a template into cards and links with fresh ids, offset by (dx, dy). */
export function materialize(t: Template, dx = 0, dy = 0, s: Partial<BoardSettings> = {}): { cards: Card[]; links: Link[] } {
  const b = t.build(s);
  const map: Record<string, string> = {};
  const cards = b.cards.map(({ key, ...c }) => {
    const id = newId();
    map[key] = id;
    return { ...c, id, x: c.x + dx, y: c.y + dy } as Card;
  });
  const links = b.links.map(([f, to]) => ({ id: newId(), from: map[f], to: map[to] }));
  return { cards, links };
}
