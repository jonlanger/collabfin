"use client";

import { getBrowserSupabase } from "@/lib/supabase/client";
import { CloudStore } from "./cloud";
import { LocalStore } from "./local";
import type { Store } from "./types";

export * from "./types";

let store: Store | null = null;

/** The app's data store: Supabase when configured, otherwise this browser. One instance per tab. */
export function getStore(): Store {
  if (store) return store;
  const sb = getBrowserSupabase();
  store = sb ? new CloudStore(sb) : new LocalStore();
  return store;
}
