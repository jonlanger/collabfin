"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Tip } from "@/lib/copy";
import { FREQ, FREQ_LABEL, FREQ_SHORT, RULES, isFreq, nfTwo, num, tone, validateNumber, type Freq, type RuleName } from "@/lib/engine";
import { Icon } from "./Icon";
import { useMoney } from "./prefs";
import { Select } from "./Select";
import { Info } from "./tips";
import { say } from "./toast";

/** A number box that checks what's typed against a rule and only commits valid values. */
export function NumberInput({ value, onCommit, label, size, suffix, rule = "amount", placeholder, disabled }: { value: unknown; onCommit: (n: number) => void; label: string; size?: "sm"; suffix?: string; rule?: RuleName; placeholder?: string; disabled?: boolean }) {
  const fmt = useMoney();
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cancel = useRef(false);
  const r = RULES[rule];
  const shown = draft ?? (num(value) ? nfTwo.format(num(value)) : "");
  const live = draft != null ? validateNumber(draft, r, fmt.money, fmt.symbol).err : undefined;
  const commit = () => {
    if (cancel.current) {
      cancel.current = false;
      setDraft(null);
      return;
    }
    const v = validateNumber(draft, r, fmt.money, fmt.symbol);
    if (v.err !== undefined) {
      setErr(v.err);
      if (size === "sm") say(`${label}: ${v.err}`);
      setDraft(null);
      return;
    }
    if (v.n !== num(value)) onCommit(v.n);
    setDraft(null);
  };
  const bad = err || live;
  return (
    <span className="mi">
      <span className={["box", size, bad && "bad"].filter(Boolean).join(" ")}>
        {suffix === "%" ? null : <span className="pre">{fmt.symbol}</span>}
        <input
          inputMode="decimal"
          aria-label={label}
          aria-invalid={Boolean(bad)}
          disabled={disabled}
          value={shown}
          placeholder={placeholder ?? "0"}
          onFocus={(e) => {
            setErr(null);
            setDraft(num(value) ? String(num(value)) : "");
            const t = e.target;
            requestAnimationFrame(() => t.select());
          }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancel.current = true;
              e.currentTarget.blur();
            }
          }}
          onBlur={commit}
        />
        {suffix ? <span className="suf">{suffix}</span> : null}
      </span>
      {size !== "sm" && bad ? (
        <span className="field-err" role="alert">
          {bad}
        </span>
      ) : null}
    </span>
  );
}

/** A text box that commits on blur or Enter, and can't be emptied when required. */
export function TextInput({ value, onCommit, className, label, placeholder, required, max = 60, disabled }: { value?: string; onCommit: (v: string) => void; className?: string; label: string; placeholder?: string; required?: boolean; max?: number; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={className}
      aria-label={label}
      placeholder={placeholder}
      maxLength={max}
      disabled={disabled}
      value={draft ?? value ?? ""}
      onFocus={() => setDraft(value ?? "")}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          const t = e.currentTarget;
          requestAnimationFrame(() => t.blur());
        }
      }}
      onBlur={() => {
        if (draft == null) return;
        const t = draft.trim().slice(0, max);
        if (required && !t) {
          say(`${label} can’t be empty, so the old name was kept.`);
          setDraft(null);
          return;
        }
        if (t !== (value ?? "")) onCommit(t);
        setDraft(null);
      }}
    />
  );
}

export function Field({ label, tip, children }: { label: string; tip?: string | Tip; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">
        {label}
        {tip ? <Info label={label} text={tip} /> : null}
      </span>
      {children}
    </div>
  );
}

export function Delta({ v }: { v: number }) {
  const fmt = useMoney();
  const t = tone(v);
  return (
    <span className={`delta ${t}`}>
      {t !== "zero" ? <Icon n={t === "pos" ? "up" : "down"} s={14} w={2.25} /> : null}
      <span className="sr">{t === "pos" ? "Up" : t === "neg" ? "Down" : "Flat"}</span>
      {fmt.signed(v)}
    </span>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function FreqSelect({ value, onChange, size, only, label = "How often" }: { value: unknown; onChange: (f: Freq) => void; size?: "sm"; only?: Freq[]; label?: string }) {
  const opts = only ?? (Object.keys(FREQ) as Freq[]);
  return <Select size={size} label={label} value={isFreq(value) ? value : "monthly"} searchable={false} options={opts.map((f) => ({ value: f, label: size === "sm" ? FREQ_SHORT[f] : FREQ_LABEL[f] }))} onChange={onChange} />;
}

export function Segmented<V extends string | number>({ value, options, onChange, label, className }: { value: V; options: [V, string][]; onChange: (v: V) => void; label: string; className?: string }) {
  return (
    <div className={`seg${className ? ` ${className}` : ""}`} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" className={v === value ? "on" : ""} aria-pressed={v === value} onClick={() => v !== value && onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
