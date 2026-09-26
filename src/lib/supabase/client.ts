"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isCloudConfigured } from "./env";

let client: SupabaseClient | null = null;

/** The browser Supabase client, or null when Supabase isn't configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isCloudConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
