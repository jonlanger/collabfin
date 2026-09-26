import { ACCOUNT_TYPES, cardName } from "./kinds";
import { FREQ_LABEL, isFreq, type MoneyFormat } from "./money";
import { FILING, STATES, isFiling } from "./tax";
import type { AccountType, Card } from "./types";

/** A plain-English line for the History panel describing a change to a card. */
export function describeUpdate(c: Card, patch: Partial<Card>, fmt: MoneyFormat): string {
  const n = cardName(c);
  const { money } = fmt;
  const k = Object.keys(patch);
  if (k.every((x) => x === "x" || x === "y")) return `Moved ${n}`;
  if ("title" in patch) return `Renamed “${c.title ?? ""}” to “${patch.title}”`;
  if ("amount" in patch) return `Set ${n} to ${money(patch.amount)}`;
  if ("freq" in patch) return `Changed ${n} to ${isFreq(patch.freq) ? FREQ_LABEL[patch.freq].toLowerCase() : "a new schedule"}`;
  if ("items" in patch) return `Edited the payments in ${n}`;
  if ("atype" in patch) return `Made ${n} a ${(ACCOUNT_TYPES[patch.atype as AccountType] ?? "checking").toLowerCase()} account`;
  if ("balance" in patch) return `Set the balance of ${n} to ${money(patch.balance)}`;
  if ("pct" in patch) return `Set ${n} to ${patch.pct}%`;
  if ("target" in patch) return `Set the target of ${n} to ${money(patch.target)}`;
  if ("saved" in patch) return `Set the saved amount of ${n} to ${money(patch.saved)}`;
  if ("apr" in patch) return `Set the rate of ${n} to ${patch.apr}%`;
  if ("payment" in patch) return `Set the payment on ${n} to ${money(patch.payment)}`;
  if ("extra" in patch) return `Set the extra payment on ${n} to ${money(patch.extra)}`;
  if ("apy" in patch) return `Set the APY of ${n} to ${patch.apy}%`;
  if ("term" in patch) return `Set the term of ${n} to ${patch.term} months`;
  if ("opened" in patch) return `Set when ${n} opened`;
  if ("ret" in patch) return `Assumed a ${patch.ret}% return for ${n}`;
  if ("fees" in patch) return `Set the fees on ${n} to ${patch.fees}%`;
  if ("taxPct" in patch) return `Set the tax on ${n} to ${patch.taxPct}%`;
  if ("gross" in patch) return `Set the salary in ${n} to ${money(patch.gross)}`;
  if ("pretax" in patch) return `Set pre-tax deductions in ${n} to ${money(patch.pretax)}`;
  if ("state" in patch) return `Set the state for ${n} to ${STATES[patch.state ?? ""]?.name ?? "none"}`;
  if ("filing" in patch) return `Set filing status for ${n} to ${isFiling(patch.filing) ? FILING[patch.filing].toLowerCase() : "single"}`;
  if ("mode" in patch) return `Switched ${n} to ${patch.mode} tax`;
  if ("homeValue" in patch) return `Set the home value in ${n} to ${money(patch.homeValue)}`;
  if ("propRate" in patch || "salesRate" in patch) return `Changed the tax rate in ${n}`;
  if ("horizon" in patch) return `Projected ${n} over ${patch.horizon} months`;
  if ("text" in patch) return "Edited a note";
  return `Edited ${n}`;
}
