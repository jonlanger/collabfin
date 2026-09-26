import { KINDS } from "./kinds";
import { num } from "./money";
import { computeFlows } from "./flows";
import { payoff, projectAccount } from "./projections";
import type { BoardSettings, CardMap, LinkMap } from "./types";

export interface PlanMetrics {
  coming: number;
  going: number;
  net: number;
  savingsRate: number;
  accounts: Record<string, number>;
  /** Months until each goal is reached; 0 = reached, null = never at this rate. */
  goals: Record<string, number | null>;
  /** Months until each debt is paid off; null = never at this rate. */
  debts: Record<string, number | null>;
}

/** The headline figures used to compare plans side by side. Cards are matched across plans by title. */
export function planMetrics(cards: CardMap, links: LinkMap, s: BoardSettings): PlanMetrics {
  const f = computeFlows(cards, links);
  const m: PlanMetrics = {
    coming: f.coming,
    going: f.going,
    net: f.net,
    savingsRate: f.coming > 0 ? Math.round((f.goalIn / f.coming) * 100) : 0,
    accounts: {},
    goals: {},
    debts: {},
  };
  for (const c of Object.values(cards)) {
    const t = c.title || KINDS[c.kind]?.label || "Card";
    if (c.kind === "account") m.accounts[t] = projectAccount(c, f, s, s.horizon).end;
    if (c.kind === "goal") {
      const left = Math.max(0, num(c.target) - num(c.saved));
      const per = f.inSum[c.id] ?? 0;
      m.goals[t] = left === 0 ? 0 : per > 0 ? Math.ceil(left / per) : null;
    }
    if (c.kind === "debt") {
      const p = payoff(c.balance, c.apr, num(c.payment) + num(c.extra));
      m.debts[t] = p.never ? null : (p.months ?? 0);
    }
  }
  return m;
}
