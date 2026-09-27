import { clamp, num } from "./money";
import { accountTypeOf } from "./kinds";
import type { Flows } from "./flows";
import type { AccountType, BoardSettings, Card } from "./types";

export const ACCOUNT_HORIZONS = [3, 6, 12, 24, 60, 120, 240];

/** Whole months from `ym` (YYYY-MM) to `now`. */
export function monthsSince(ym: string | undefined, now = new Date()): number {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
  if (!m) return 0;
  return (now.getFullYear() - +m[1]) * 12 + (now.getMonth() - (+m[2] - 1));
}

export interface CdInfo {
  principal: number;
  term: number;
  elapsed: number;
  left: number;
  now: number;
  maturity: number;
  matured: boolean;
  at: (month: number) => number;
}

export function cdInfo(c: Card, now = new Date()): CdInfo {
  const principal = Math.max(0, num(c.balance));
  const apy = clamp(num(c.apy), 0, 20) / 100;
  const term = clamp(Math.round(num(c.term) || 12), 1, 120);
  const tax = clamp(num(c.taxPct), 0, 60) / 100;
  const elapsed = monthsSince(c.opened, now);
  const at = (m: number) => {
    const mm = clamp(m, 0, term);
    const gross = principal * Math.pow(1 + apy, mm / 12);
    return principal + (gross - principal) * (1 - tax);
  };
  return { principal, term, elapsed, left: term - elapsed, now: at(elapsed), maturity: at(term), matured: term - elapsed <= 0, at };
}

export interface AccountProjection {
  h: number;
  type: AccountType;
  end: number;
  firstBelow: number | null;
  inflow: number;
  toSplits: number;
  kept: number;
  earned: number;
  added: number;
  rate: number;
  low?: number;
  high?: number;
  cd?: CdInfo;
}

/**
 * Projects an account forward month by month. Savings compound from the APY, investing accounts at
 * the assumed return minus fees (with a ±3 point range), and money going out grows by the yearly
 * price increase. Tax on earnings is taken as it is earned.
 */
export function projectAccount(c: Card, flows: Flows, s: Pick<BoardSettings, "inflation" | "buffer" | "horizon">, hOverride?: number): AccountProjection {
  const t = accountTypeOf(c);
  const bal = num(c.balance);
  const P = flows.posIn[c.id] ?? 0;
  const N = flows.negIn[c.id] ?? 0;
  const k = flows.keep(c.id);
  const g = clamp(num(s.inflation), 0, 20) / 100;
  const buf = num(s.buffer);
  const h = hOverride || (ACCOUNT_HORIZONS.includes(num(c.horizon)) ? num(c.horizon) : s.horizon);
  if (t === "cd") {
    const cd = cdInfo(c);
    const end = cd.at(cd.elapsed + h);
    return { h, type: t, end, firstBelow: null, inflow: 0, toSplits: 0, kept: 0, earned: end - cd.principal, added: 0, rate: clamp(num(c.apy), 0, 20) / 100, cd };
  }
  const rate = t === "savings" ? clamp(num(c.apy), 0, 20) / 100 : t === "investment" ? (clamp(num(c.ret), -20, 30) - clamp(num(c.fees), 0, 5)) / 100 : 0;
  const tax = t === "checking" ? 0 : clamp(num(c.taxPct), 0, 60) / 100;
  const sim = (r: number) => {
    const mr = Math.pow(1 + Math.max(r, -0.99), 1 / 12) - 1;
    let b = bal;
    let earned = 0;
    let added = 0;
    let firstBelow: number | null = null;
    for (let m = 1; m <= h; m++) {
      const gain = b > 0 ? b * mr : 0;
      const net = gain > 0 ? gain * (1 - tax) : gain;
      const flow = k * (P + N * Math.pow(1 + g, (m - 1) / 12));
      earned += net;
      added += flow;
      b += net + flow;
      if (firstBelow == null && t === "checking" && buf > 0 && b < buf && bal >= buf) firstBelow = m;
    }
    return { end: b, earned, added, firstBelow };
  };
  const main = sim(rate);
  const result: AccountProjection = {
    h,
    type: t,
    end: main.end,
    firstBelow: main.firstBelow,
    inflow: P + N,
    toSplits: (1 - k) * (P + N),
    kept: k * (P + N),
    earned: main.earned,
    added: main.added,
    rate,
  };
  if (t === "investment") {
    result.low = sim(rate - 0.03).end;
    result.high = sim(rate + 0.03).end;
  }
  return result;
}

export interface Payoff {
  months?: number;
  interest?: number;
  never?: boolean;
  firstInterest?: number;
}

/** Months and total interest to pay off `balance` at `aprPct` paying `pay` a month. */
export function payoff(balance: unknown, aprPct: unknown, pay: unknown): Payoff {
  let b = num(balance);
  const r = clamp(num(aprPct), 0, 100) / 1200;
  const p = num(pay);
  if (b <= 0) return { months: 0, interest: 0 };
  if (p <= b * r + 0.005) return { never: true, firstInterest: b * r };
  let interest = 0;
  let m = 0;
  while (b > 0.005 && m < 1200) {
    const i = b * r;
    interest += i;
    b = b + i - p;
    m++;
  }
  return m >= 1200 ? { never: true, firstInterest: num(balance) * r } : { months: m, interest };
}
