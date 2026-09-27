import { CURRENCIES, clamp, num } from "./money";
import { STATES, isFiling } from "./tax";
import type { AutomationSettings, BoardSettings } from "./types";

export const HORIZONS = [3, 6, 12, 24] as const;

export const DEFAULT_SETTINGS: BoardSettings = {
  currency: "USD",
  horizon: 12,
  savingsTarget: 20,
  billsCap: 50,
  buffer: 1000,
  inflation: 0,
  primaryAccount: "",
  state: "",
  filing: "single",
  auto: { linkOutflows: true, linkIncome: true, payYourselfFirst: false, notifyChecks: true, goalAlert: true },
};

/** Settings come from the database and other clients, so every field is checked and clamped. */
export function cleanSettings(input: unknown): BoardSettings {
  const s = (input && typeof input === "object" ? input : {}) as Partial<BoardSettings> & Record<string, unknown>;
  const a = { ...DEFAULT_SETTINGS.auto, ...(s.auto && typeof s.auto === "object" ? s.auto : {}) } as Record<string, unknown>;
  const auto = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.auto).map((k) => [k, !!a[k]])) as unknown as AutomationSettings;
  return {
    currency: typeof s.currency === "string" && CURRENCIES[s.currency] ? s.currency : "USD",
    horizon: (HORIZONS as readonly number[]).includes(num(s.horizon)) ? num(s.horizon) : 12,
    savingsTarget: clamp(Math.round(num(s.savingsTarget ?? 20)), 0, 100),
    billsCap: clamp(Math.round(num(s.billsCap ?? 50)), 0, 100),
    buffer: clamp(num(s.buffer ?? 1000), 0, 10_000_000),
    inflation: clamp(num(s.inflation), 0, 20),
    primaryAccount: typeof s.primaryAccount === "string" ? s.primaryAccount : "",
    state: typeof s.state === "string" && STATES[s.state] ? s.state : "",
    filing: isFiling(s.filing) ? s.filing : "single",
    auto,
  };
}
