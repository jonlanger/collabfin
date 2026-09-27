"use client";

import { useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!EMAIL.test(addr)) return setErr("Enter an email address, like you@example.com.");
    const sb = getBrowserSupabase();
    if (!sb) return setErr("Sign-in isn’t available right now.");
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) return setErr(/rate|many/i.test(error.message) ? "Too many sign-in emails. Wait a minute and try again." : "The sign-in email couldn’t be sent. Check the address and try again.");
    setSent(true);
  };
  if (sent) {
    return (
      <div className="ok-box" role="status">
        <Icon n="check" s={20} w={2.25} />
        <span>Check {email.trim()} for a sign-in link. It works once and expires in an hour.</span>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate>
      <label className="eyebrow" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        className={`text-in${err ? " bad" : ""}`}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErr(null);
        }}
        aria-invalid={Boolean(err)}
        aria-describedby={err ? "email-err" : undefined}
      />
      {err ? (
        <span id="email-err" className="field-err" role="alert">
          {err}
        </span>
      ) : null}
      <button className="cta" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
