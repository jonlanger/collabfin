"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { moneyFormat, type MoneyFormat } from "@/lib/engine";

/* Per-person preferences, kept in this browser: display and accessibility. */

export interface Prefs {
  showTips: boolean;
  showAmounts: boolean;
  railOpen: boolean;
  theme: "system" | "light" | "dark";
  textSize: 100 | 115 | 130;
  contrast: boolean;
  cbSafe: boolean;
  reduceMotion: boolean;
  spacing: boolean;
  focusStrong: boolean;
  hideCursors: boolean;
  announce: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  showTips: true,
  showAmounts: true,
  railOpen: false,
  theme: "system",
  textSize: 100,
  contrast: false,
  cbSafe: false,
  reduceMotion: false,
  spacing: false,
  focusStrong: false,
  hideCursors: false,
  announce: false,
};
export const A11Y_RESET: Partial<Prefs> = {
  theme: "system",
  textSize: 100,
  contrast: false,
  cbSafe: false,
  reduceMotion: false,
  spacing: false,
  focusStrong: false,
  hideCursors: false,
  announce: false,
};

const KEY = "collabfin-prefs-v2";

function load(): Prefs {
  try {
    const p = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") } as Prefs;
    if (![100, 115, 130].includes(p.textSize)) p.textSize = 100;
    if (!["system", "light", "dark"].includes(p.theme)) p.theme = "system";
    return p;
  } catch {
    return DEFAULT_PREFS;
  }
}

interface PrefsCtx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
}
const Ctx = createContext<PrefsCtx>({ prefs: DEFAULT_PREFS, setPrefs: () => {} });
export const usePrefs = () => useContext(Ctx);

/** Loads preferences and applies the theme and accessibility choices to the whole page. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  const loaded = useRef(false);
  useEffect(() => {
    loaded.current = true;
    // Preferences live in this browser, so they can only be read after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(load());
  }, []);
  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setState((old) => {
      const next = { ...old, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private mode or storage blocked: keep the choice for this visit.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const r = document.documentElement;
    if (prefs.theme === "system") r.removeAttribute("data-theme");
    else r.setAttribute("data-theme", prefs.theme);
    const flag = (k: string, on: boolean, v: string) => (on ? r.setAttribute(k, v) : r.removeAttribute(k));
    flag("data-contrast", prefs.contrast, "high");
    flag("data-cb", prefs.cbSafe, "safe");
    flag("data-motion", prefs.reduceMotion, "reduce");
    flag("data-spacing", prefs.spacing, "wide");
    flag("data-focus", prefs.focusStrong, "strong");
    r.style.setProperty("--ui-zoom", String(prefs.textSize / 100));
  }, [prefs.theme, prefs.contrast, prefs.cbSafe, prefs.reduceMotion, prefs.spacing, prefs.focusStrong, prefs.textSize]);

  return <Ctx.Provider value={{ prefs, setPrefs }}>{children}</Ctx.Provider>;
}

/* The board's currency, available to every card and panel. */
const MoneyCtx = createContext<MoneyFormat>(moneyFormat("USD"));
export const MoneyProvider = MoneyCtx.Provider;
export const useMoney = () => useContext(MoneyCtx);

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.getAttribute("data-motion") === "reduce" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
