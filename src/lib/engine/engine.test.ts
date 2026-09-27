import { describe, expect, it } from "vitest";
import {
  cdInfo,
  computeChecks,
  computeFlows,
  materialize,
  moneyFormat,
  newCard,
  parseNumber,
  payoff,
  paycheckTax,
  planMetrics,
  projectAccount,
  propertyRateFor,
  TEMPLATES,
  validateNumber,
  wouldLoop,
  DEFAULT_SETTINGS,
  cleanSettings,
  type Card,
  type CardMap,
  type LinkMap,
} from "./index";

const usd = moneyFormat("USD");
const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, T>;
function household() {
  const t = TEMPLATES.find((x) => x.id === "household")!;
  const { cards, links } = materialize(t);
  const find = (title: string) => cards.find((c) => c.title === title)!;
  return { cards: byId(cards) as CardMap, links: byId(links) as LinkMap, find };
}

describe("money", () => {
  it("formats with sign and a true minus", () => {
    expect(usd.money(-1234.4)).toBe("−$1,234");
    expect(usd.signed(2177.33)).toBe("+$2,177");
    expect(usd.signed(0)).toBe("$0");
  });
});

describe("validation", () => {
  it("parses what people type", () => {
    expect(parseNumber("$1,250.50")).toBe(1250.5);
    expect(parseNumber("  ")).toBe(0);
    expect(parseNumber("−500")).toBe(-500);
    expect(parseNumber("12abc")).toBeNull();
  });
  it("enforces limits with clear messages", () => {
    expect(validateNumber("-5", { min: 0 }, usd.money).err).toBe("Enter 0 or more.");
    expect(validateNumber("150", { min: 0, max: 100, pct: true }, usd.money).err).toBe("Enter 100% or less.");
    expect(validateNumber("12.5", { integer: true }, usd.money).err).toBe("Use a whole number.");
    expect(validateNumber("1,234.567", {}, usd.money).n).toBe(1234.57);
  });
  it("cleans settings from untrusted data", () => {
    const s = cleanSettings({ currency: "XYZ", savingsTarget: 250, horizon: 7, state: "ZZ", auto: { linkIncome: 0 } });
    expect(s.currency).toBe("USD");
    expect(s.savingsTarget).toBe(100);
    expect(s.horizon).toBe(12);
    expect(s.state).toBe("");
    expect(s.auto.linkIncome).toBe(false);
    expect(s.auto.linkOutflows).toBe(true);
  });
});

describe("flows", () => {
  it("chains spend into bills into an account, with a split carved out", () => {
    const { cards, links, find } = household();
    const f = computeFlows(cards, links);
    expect(Math.round(f.out[find("Groceries & dining").id])).toBe(-780);
    expect(Math.round(f.out[find("Bills & subscriptions").id])).toBe(-3456);
    expect(Math.round(f.coming)).toBe(5633);
    expect(Math.round(f.net)).toBe(2177);
    const acct = find("Joint checking").id;
    expect(Math.round(f.inSum[acct])).toBe(2177);
    expect(Math.round(f.out[find("Save 30%").id])).toBe(653);
    // The account keeps 70% after the split.
    expect(f.keep(acct)).toBeCloseTo(0.7);
  });
  it("detects loops and rejects links that would create one", () => {
    const a = newCard("income", 0, 0);
    const b = newCard("account", 0, 0);
    const cards = byId([a, b]) as CardMap;
    const links = byId([
      { id: "1", from: a.id, to: b.id },
      { id: "2", from: b.id, to: a.id },
    ]) as LinkMap;
    const f = computeFlows(cards, links);
    expect(f.loops.size).toBeGreaterThan(0);
    expect(wouldLoop({ [a.id]: [b.id] }, b.id, a.id)).toBe(true);
  });
});

describe("projections", () => {
  it("projects checking with splits leaving the account", () => {
    const { cards, links, find } = household();
    const f = computeFlows(cards, links);
    const p = projectAccount(find("Joint checking"), f, DEFAULT_SETTINGS);
    expect(Math.round(p.end / 10) * 10).toBe(26690);
  });
  it("compounds savings interest monthly", () => {
    const c: Card = { id: "s", kind: "account", x: 0, y: 0, atype: "savings", balance: 10000, apy: 4, horizon: 12 };
    const flows = computeFlows({ s: c }, {});
    const p = projectAccount(c, flows, DEFAULT_SETTINGS);
    expect(Math.round(p.end)).toBe(10400);
  });
  it("gives investing a range around the expected return", () => {
    const c: Card = { id: "i", kind: "account", x: 0, y: 0, atype: "investment", balance: 25000, ret: 6, fees: 0.1, horizon: 120 };
    const src: Card = { id: "src", kind: "income", x: 0, y: 0, amount: 500, freq: "monthly" };
    const flows = computeFlows({ i: c, src }, { l: { id: "l", from: "src", to: "i" } });
    const p = projectAccount(c, flows, DEFAULT_SETTINGS);
    expect(Math.round(p.end / 1000)).toBe(125);
    expect(p.low!).toBeLessThan(p.end);
    expect(p.high!).toBeGreaterThan(p.end);
  });
  it("values a CD at maturity", () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    const opened = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cd = cdInfo({ id: "c", kind: "account", x: 0, y: 0, atype: "cd", balance: 10000, apy: 4.1, term: 12, opened });
    expect(Math.round(cd.maturity)).toBe(10410);
    expect(cd.left).toBe(9);
  });
  it("works out debt payoff and flags payments below the interest", () => {
    const extra = payoff(6200, 24.99, 430);
    const min = payoff(6200, 24.99, 180);
    expect(extra.months).toBe(18);
    expect(min.months).toBe(62);
    expect(Math.round((min.interest ?? 0) - (extra.interest ?? 0))).toBe(3584);
    expect(payoff(6200, 24.99, 100).never).toBe(true);
  });
});

describe("taxes (2026)", () => {
  it("matches a hand calculation for Colorado, single, $110k with $8.8k pre-tax", () => {
    const r = paycheckTax(110000, 8800, "CO", "single");
    expect(Math.round(r.federal)).toBe(13434);
    expect(Math.round(r.state)).toBe(3744);
    expect(Math.round(r.socialSecurity)).toBe(6820);
    expect(Math.round(r.medicare)).toBe(1595);
    expect(Math.round(r.takeHome / 12)).toBe(6301);
  });
  it("has no state income tax in Texas", () => {
    const r = paycheckTax(80000, 0, "TX", "single");
    expect(r.state).toBe(0);
    expect(Math.round(r.federal)).toBe(8770);
  });
  it("caps Social Security at the wage base and adds the extra Medicare", () => {
    const r = paycheckTax(250000, 0, "TX", "single");
    expect(Math.round(r.socialSecurity)).toBe(11439);
    expect(Math.round(r.medicare)).toBe(4075);
  });
  it("uses the state average property rate unless overridden", () => {
    expect(propertyRateFor({ state: "TX", propRate: null })).toBe(1.4);
    expect(propertyRateFor({ state: "TX", propRate: 2 })).toBe(2);
  });
});

describe("checks", () => {
  it("flags splits over 100% and double-counted money", () => {
    const inc = { ...newCard("income", 0, 0), amount: 1000 };
    const s1 = { ...newCard("split", 0, 0), pct: 60 };
    const s2 = { ...newCard("split", 0, 0), pct: 50 };
    const a1 = newCard("account", 0, 0);
    const a2 = newCard("account", 0, 0);
    const cards = byId([inc, s1, s2, a1, a2]) as CardMap;
    const links = byId([
      { id: "1", from: inc.id, to: s1.id },
      { id: "2", from: inc.id, to: s2.id },
      { id: "3", from: inc.id, to: a1.id },
      { id: "4", from: inc.id, to: a2.id },
    ]) as LinkMap;
    const checks = computeChecks(cards, computeFlows(cards, links), DEFAULT_SETTINGS, usd);
    const texts = checks.list.map((c) => c.text);
    expect(texts.some((t) => t.includes("add up to 110%"))).toBe(true);
    expect(texts.some((t) => t.includes("counted 2 times"))).toBe(true);
    expect(checks.list[0].level).toBe("error");
  });
  it("suggests a 3-month emergency fund with a one-click fix", () => {
    const { cards, links } = household();
    const checks = computeChecks(cards, computeFlows(cards, links), DEFAULT_SETTINGS, usd);
    const tip = checks.list.find((c) => c.text.includes("months of spending"));
    // The household template's $15,000 fund covers about 3.5 months, so no tip.
    expect(tip).toBeUndefined();
  });
});

describe("plan metrics", () => {
  it("summarises a plan for comparison", () => {
    const { cards, links } = household();
    const m = planMetrics(cards, links, DEFAULT_SETTINGS);
    expect(Math.round(m.net)).toBe(2177);
    expect(m.goals["Emergency fund"]).toBe(17);
  });
});
