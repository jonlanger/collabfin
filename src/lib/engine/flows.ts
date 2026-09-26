import { clamp, num, perMonth } from "./money";
import { KINDS } from "./kinds";
import { paycheckTax, propertyRateFor } from "./tax";
import type { Card, CardMap, LinkMap } from "./types";

/** What a card adds to (positive) or takes from (negative) the monthly flow on its own. */
export function ownFlow(c: Card): number {
  switch (c.kind) {
    case "income":
      return perMonth(c.amount, c.freq);
    case "spend":
      return -perMonth(c.amount, c.freq);
    case "recurring":
      return -(Array.isArray(c.items) ? c.items : []).reduce((s, i) => s + perMonth(i?.amount, i?.freq), 0);
    case "debt":
      return num(c.balance) > 0 ? -(num(c.payment) + num(c.extra)) : 0;
    case "tax":
      if (c.mode === "property") return (-num(c.homeValue) * propertyRateFor(c)) / 100 / 12;
      if (c.mode === "sales") return 0;
      return paycheckTax(c.gross, c.pretax, c.state, c.filing).takeHome / 12;
    default:
      return 0;
  }
}

export interface Flows {
  /** Monthly amount each card passes on. */
  out: Record<string, number>;
  /** Sum of everything flowing into each card. */
  inSum: Record<string, number>;
  posIn: Record<string, number>;
  negIn: Record<string, number>;
  inputs: Record<string, string[]>;
  outgoing: Record<string, string[]>;
  /** Total percentage of a card's money that its Split cards take. */
  splitPct: Record<string, number>;
  /** Share a card keeps after its splits (0..1). */
  keep: (id: string) => number;
  /** The amount travelling along the link from → to. */
  linkValue: (from: string, to: string) => number;
  loops: Set<string>;
  coming: number;
  going: number;
  net: number;
  goalIn: number;
  billsOut: number;
}

/**
 * Money flows through links. A Split card takes a percentage of what reaches the card before it;
 * any other linked card receives the remainder. Loops are detected and treated as zero.
 */
export function computeFlows(cards: CardMap, links: LinkMap): Flows {
  const inputs: Record<string, string[]> = {};
  const outgoing: Record<string, string[]> = {};
  for (const l of Object.values(links)) {
    if (!cards[l.from] || !cards[l.to] || l.from === l.to) continue;
    (inputs[l.to] ??= []).push(l.from);
    (outgoing[l.from] ??= []).push(l.to);
  }
  const splitPct: Record<string, number> = {};
  for (const f in outgoing) splitPct[f] = outgoing[f].reduce((s, t) => s + (cards[t].kind === "split" ? clamp(num(cards[t].pct), 0, 100) : 0), 0);
  const keep = (f: string) => 1 - Math.min(100, splitPct[f] ?? 0) / 100;

  const out: Record<string, number> = {};
  const inSum: Record<string, number> = {};
  const posIn: Record<string, number> = {};
  const negIn: Record<string, number> = {};
  const state: Record<string, 1 | 2> = {};
  const loops = new Set<string>();

  const linkValue = (f: string, to: string): number => {
    const o = visit(f);
    return cards[to].kind === "split" ? o : o * keep(f);
  };
  function visit(id: string): number {
    if (state[id] === 2) return out[id];
    if (state[id] === 1) {
      loops.add(id);
      return 0;
    }
    state[id] = 1;
    const c = cards[id];
    let s = 0;
    let p = 0;
    let n = 0;
    for (const f of inputs[id] ?? []) {
      const v = linkValue(f, id);
      s += v;
      if (v > 0) p += v;
      else n += v;
    }
    inSum[id] = s;
    posIn[id] = p;
    negIn[id] = n;
    let o: number;
    if (c.kind === "split") o = (s * clamp(num(c.pct), 0, 100)) / 100;
    else if (c.kind === "goal" || c.kind === "note" || c.kind === "file") o = 0;
    else o = ownFlow(c) + s;
    out[id] = o;
    state[id] = 2;
    return o;
  }
  for (const id in cards) if (KINDS[cards[id].kind]) visit(id);

  let coming = 0;
  let going = 0;
  let goalIn = 0;
  let billsOut = 0;
  for (const c of Object.values(cards)) {
    if (!KINDS[c.kind]) continue;
    const f = ownFlow(c);
    if (f > 0) coming += f;
    else going += f;
    if (c.kind === "goal") goalIn += Math.max(0, inSum[c.id] ?? 0);
    if (c.kind === "recurring" || c.kind === "debt" || (c.kind === "tax" && c.mode === "property")) billsOut += -f;
  }
  return { out, inSum, posIn, negIn, inputs, outgoing, splitPct, keep, linkValue, loops, coming, going, net: coming + going, goalIn, billsOut };
}

/** Would adding from → to create a cycle? */
export function wouldLoop(outgoing: Record<string, string[]>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of outgoing[n] ?? []) stack.push(m);
  }
  return false;
}
