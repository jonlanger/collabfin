import { accountTypeOf, KINDS, portsFor } from "./kinds";
import { num, plural, type MoneyFormat } from "./money";
import { payoff, projectAccount } from "./projections";
import { STATES } from "./tax";
import type { Flows } from "./flows";
import type { BoardSettings, Card, CardMap } from "./types";

export type Level = "error" | "warn" | "tip";
export type Fix =
  | { label: string; type: "link"; from: string; to: string }
  | { label: string; type: "patch"; id: string; patch: Partial<Card> };
export interface Check {
  key: string;
  level: Level;
  cardId: string | null;
  text: string;
  fix?: Fix | null;
}
export interface Checks {
  list: Check[];
  byCard: Record<string, { count: number; level: Level }>;
}

export const LEVEL_ORDER: Record<Level, number> = { error: 0, warn: 1, tip: 2 };

export function mainAccount(cards: CardMap, s: Pick<BoardSettings, "primaryAccount">): string | null {
  if (s.primaryAccount && cards[s.primaryAccount]?.kind === "account") return s.primaryAccount;
  const accts = Object.values(cards)
    .filter((c) => c.kind === "account")
    .sort((a, b) => a.x - b.x || a.y - b.y);
  return accts[0]?.id ?? null;
}

/** Validation and best-practice checks for a plan. Pure: same input, same list. */
export function computeChecks(cards: CardMap, flows: Flows, s: BoardSettings, fmt: MoneyFormat): Checks {
  const list: Check[] = [];
  const { money } = fmt;
  const name = (c: Card) => c.title || KINDS[c.kind].label;
  const add = (level: Level, cardId: string | null, text: string, fix?: Fix | null) => list.push({ key: `${level}|${cardId ?? ""}|${text}`, level, cardId, text, fix });
  const acct = mainAccount(cards, s);
  const debts: Card[] = [];

  for (const c of Object.values(cards)) {
    if (!KINDS[c.kind]) continue;
    const id = c.id;
    const outs = flows.outgoing[id] ?? [];
    const ins = flows.inputs[id] ?? [];
    if (flows.loops.has(id)) add("error", id, `${name(c)} is part of a loop, so its total can’t be worked out. Remove one of its links.`);
    if ((c.kind === "income" || c.kind === "spend") && num(c.amount) <= 0) add("warn", id, `${name(c)} has no amount yet.`);
    if (c.kind === "recurring") {
      const items = Array.isArray(c.items) ? c.items : [];
      if (!items.length) add("warn", id, `${name(c)} has no payments yet.`);
      const zero = items.filter((i) => num(i.amount) <= 0).length;
      if (zero) add("warn", id, `${plural(zero, "payment")} in ${name(c)} ${zero === 1 ? "has" : "have"} no amount.`);
      const unnamed = items.filter((i) => !String(i.name ?? "").trim()).length;
      if (unnamed) add("warn", id, `${plural(unnamed, "payment")} in ${name(c)} need${unnamed === 1 ? "s" : ""} a name.`);
      const seen: Record<string, number> = {};
      for (const i of items) {
        const k = String(i.name ?? "").trim().toLowerCase();
        if (k) seen[k] = (seen[k] ?? 0) + 1;
      }
      for (const k of Object.keys(seen).filter((k) => seen[k] > 1)) {
        const first = items.find((i) => String(i.name).trim().toLowerCase() === k)!;
        add("warn", id, `“${first.name}” is listed ${seen[k]} times in ${name(c)}. Check it isn’t counted twice.`);
      }
    }
    if ((["income", "spend", "recurring", "split", "debt"].includes(c.kind) || (c.kind === "tax" && c.mode !== "sales")) && !outs.length) {
      add(
        "warn",
        id,
        `${name(c)} isn’t linked to anything, so it isn’t counted in an account.`,
        acct && c.kind !== "split" ? { label: `Link to ${name(cards[acct])}`, type: "link", from: id, to: acct } : null,
      );
    }
    const plain = outs.filter((t) => cards[t].kind !== "split");
    if (plain.length > 1) add("error", id, `${name(c)} sends its money to ${plain.length} cards, so it’s counted ${plain.length} times. Use Split cards to divide it.`);
    if ((flows.splitPct[id] ?? 0) > 100) add("error", id, `Splits from ${name(c)} add up to ${flows.splitPct[id]}%, more than it has.`);
    if (!portsFor(c).outPort && outs.length) add("error", id, `${name(c)} can’t send money on, so its outgoing link is ignored. Remove the link.`);

    if (c.kind === "split") {
      if (num(c.pct) <= 0) add("warn", id, `${name(c)} is set to 0%, so nothing moves through it.`);
      if (!ins.length) add("warn", id, `${name(c)} has nothing coming in. Link income or an account into it.`);
      else if ((flows.inSum[id] ?? 0) < 0) add("warn", id, `${name(c)} is splitting money going out. Link it after income or an account with money left over.`);
    }
    if (c.kind === "account") {
      const t = accountTypeOf(c);
      const pr = projectAccount(c, flows, s);
      if (t === "cd") {
        if (ins.length) add("error", id, `${name(c)} is a CD, so it can’t take deposits. Link that money to a savings or checking account instead.`);
        if (num(c.apy) <= 0) add("warn", id, `${name(c)} has no APY yet.`);
        if (!c.opened) add("warn", id, `Set the month ${name(c)} opened to see when it matures.`);
        else if (pr.cd?.matured) add("tip", id, `${name(c)} has matured. Move the money or renew it before the bank rolls it over.`);
        else if ((pr.cd?.left ?? 99) <= 1) add("tip", id, `${name(c)} matures next month. Decide whether to renew it or move the money.`);
      } else {
        if (!ins.length && t === "checking") add("tip", id, `Nothing flows into ${name(c)} yet. Link income and bills to it.`);
        if (num(c.balance) < 0 && t !== "investment") add("error", id, `${name(c)} is overdrawn today.`);
        if (pr.end < 0) add("error", id, `${name(c)} is projected at ${money(pr.end)} in ${pr.h} months.`);
        else if (pr.firstBelow != null) add("warn", id, `${name(c)} drops below your ${money(s.buffer)} buffer in month ${pr.firstBelow}.`);
        if (t === "savings" && num(c.apy) <= 0) add("warn", id, `${name(c)} has no APY yet, so it earns nothing in the projection.`);
        if (t === "savings" && num(c.apy) > 6) add("warn", id, `${name(c)} earns ${num(c.apy)}% APY, which is unusually high. Check the rate with your bank.`);
        if (t === "investment" && num(c.ret) > 10) add("warn", id, `A ${num(c.ret)}% average yearly return is optimistic for planning. Try a lower figure for a more cautious projection.`);
        if (t === "investment" && pr.h < 60) add("tip", id, `Investments can drop in value over short periods, so the ${pr.h}-month projection for ${name(c)} could be far off.`);
      }
    }
    if (c.kind === "tax") {
      const mode = c.mode ?? "paycheck";
      if (!STATES[c.state ?? ""]) {
        add("warn", id, `Pick a state for ${name(c)} so state rates are included.`, s.state ? { label: `Use ${STATES[s.state].name}`, type: "patch", id, patch: { state: s.state } } : null);
      }
      if (mode === "paycheck" && num(c.gross) <= 0) add("warn", id, `${name(c)} has no salary yet.`);
      if (mode === "paycheck" && num(c.pretax) > num(c.gross)) add("error", id, `Pre-tax deductions in ${name(c)} are more than the salary.`);
      if (mode === "property" && num(c.homeValue) <= 0) add("warn", id, `${name(c)} has no home value yet.`);
    }
    if (c.kind === "debt" && num(c.balance) > 0) {
      debts.push(c);
      const pay = num(c.payment) + num(c.extra);
      const p = payoff(c.balance, c.apr, pay);
      if (pay <= 0) add("error", id, `${name(c)} has no payment, so the balance never goes down.`);
      else if (p.never) {
        const fixPay = Math.ceil(((p.firstInterest ?? 0) * 1.5) / 10) * 10;
        add("error", id, `${name(c)}’s payment of ${money(pay)} doesn’t cover the ${money(p.firstInterest)} monthly interest. The balance grows every month.`, {
          label: `Pay ${money(fixPay)} a month`,
          type: "patch",
          id,
          patch: { payment: fixPay },
        });
      }
      if (num(c.apr) >= 20) add("tip", id, `${name(c)} charges ${num(c.apr)}% interest. Paying extra here first saves the most.`);
    }
    if (c.kind === "goal") {
      const target = num(c.target);
      const saved = num(c.saved);
      const expenses = -flows.going;
      if (target <= 0) add("error", id, `${name(c)} needs a target above zero.`);
      else if (saved >= target) add("tip", id, `${name(c)} has reached its target. Raise it or point the money somewhere new.`);
      else if ((flows.inSum[id] ?? 0) <= 0) add("warn", id, `${name(c)} has no money flowing in, so it won’t grow.`);
      if (/emergency|rainy|safety/i.test(name(c)) && expenses > 0 && target > 0 && target < expenses * 3) {
        add(
          "tip",
          id,
          `${name(c)} covers ${(target / expenses).toFixed(1)} months of spending. 3 to 6 months (${money(expenses * 3)} to ${money(expenses * 6)}) is typical.`,
          { label: "Set to 3 months", type: "patch", id, patch: { target: Math.ceil((expenses * 3) / 100) * 100 } },
        );
      }
    }
  }

  if (debts.length > 1) {
    const top = [...debts].sort((a, b) => num(b.apr) - num(a.apr))[0];
    const extraElsewhere = debts.find((d) => d !== top && num(d.extra) > 0);
    if (extraElsewhere) add("tip", extraElsewhere.id, `You pay extra on ${name(extraElsewhere)}, but ${name(top)} has a higher rate (${num(top.apr)}%). Moving the extra there saves more interest.`);
  }
  const all = Object.values(cards);
  if (all.some((c) => c.kind === "tax" && (c.mode ?? "paycheck") === "paycheck") && all.some((c) => c.kind === "income")) {
    add("tip", null, "You have a Taxes paycheck card and an Income card. If the Income card is the same job’s take-home pay, that income is counted twice.");
  }
  if (flows.coming > 0 || flows.going < 0) {
    if (flows.net < 0) add("error", null, `You spend ${money(-flows.net)} more than comes in each month.`);
    if (flows.coming > 0) {
      const rate = Math.round((flows.goalIn / flows.coming) * 100);
      if (rate < s.savingsTarget) add("tip", null, `You’re saving ${rate}% of income into goals. Your target is ${s.savingsTarget}%.`);
      const bills = Math.round((flows.billsOut / flows.coming) * 100);
      if (bills > s.billsCap) add("warn", null, `Fixed bills and debt payments take ${bills}% of income, above your ${s.billsCap}% limit.`);
    }
  }

  list.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const byCard: Checks["byCard"] = {};
  for (const x of list) {
    if (!x.cardId) continue;
    const b = (byCard[x.cardId] ??= { count: 0, level: "tip" });
    b.count++;
    if (LEVEL_ORDER[x.level] < LEVEL_ORDER[b.level]) b.level = x.level;
  }
  return { list, byCard };
}
