"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { clamp } from "@/lib/engine";
import { Icon } from "./Icon";

export interface Option<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface SelectProps<V extends string | number> {
  value: V | null | undefined;
  onChange: (v: V) => void;
  options: Option<V>[];
  label: string;
  size?: "sm";
  placeholder?: string;
  className?: string;
  id?: string;
  /** Defaults to on for lists longer than 10 options. */
  searchable?: boolean;
  disabled?: boolean;
}

/** The Collabfin dropdown: a trigger button and a floating listbox (shadcn-style), keyboard friendly. */
export function Select<V extends string | number>({ value, onChange, options, label, size, placeholder, className, id, searchable, disabled }: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ s: "", t: 0 });
  const base = useId();
  const canSearch = searchable ?? options.length > 10;
  const same = (a: unknown, b: unknown) => String(a) === String(b);
  const shown = canSearch && q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const cur = options.find((o) => same(o.value, value));
  const activeId = shown[active] ? `${base}-o${active}` : undefined;

  const place = () => {
    const r = btn.current!.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 208), vw - 16);
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    setPos({ left: clamp(r.left, 8, vw - width - 8), width, top: up ? undefined : r.bottom + 6, bottom: up ? vh - r.top + 6 : undefined, maxH: clamp(up ? above : below, 160, 320) });
  };
  const openList = () => {
    if (disabled) return;
    place();
    setQ("");
    setActive(Math.max(0, options.findIndex((o) => same(o.value, value))));
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };
  const pick = (o: Option<V> | undefined) => {
    if (!o || o.disabled) return;
    close(true);
    if (!same(o.value, value)) onChange(o.value);
  };

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => btn.current?.contains(t as Node) || list.current?.parentElement?.contains(t as Node);
    const away = (e: Event) => {
      if (!inside(e.target)) close(false);
    };
    const resize = () => close(false);
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("wheel", away, true);
    window.addEventListener("resize", resize);
    requestAnimationFrame(() => (canSearch ? search.current : list.current)?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("wheel", away, true);
      window.removeEventListener("resize", resize);
    };
  }, [open, canSearch]);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, q]);

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowDown") setActive((a) => Math.min(shown.length - 1, a + 1));
    else if (k === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (k === "Home" && !canSearch) setActive(0);
    else if (k === "End" && !canSearch) setActive(shown.length - 1);
    else if (k === "Enter" || (k === " " && !canSearch)) pick(shown[active]);
    else if (k === "Escape") close(true);
    else if (k === "Tab") {
      close(false);
      return;
    } else if (!canSearch && k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const t = typed.current;
      t.s = (now - t.t < 700 ? t.s : "") + k.toLowerCase();
      t.t = now;
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(t.s));
      if (i >= 0) setActive(i);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        id={id}
        disabled={disabled}
        className={["sel-trigger", size, open && "open", className].filter(Boolean).join(" ")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${base}-list`}
        aria-label={label}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            openList();
          }
        }}
      >
        <span className={`sel-value${cur ? "" : " ph"}`}>{cur ? cur.label : (placeholder ?? "Choose…")}</span>
        <Icon n="chevron" s={16} />
      </button>
      {open && pos
        ? createPortal(
            <div className="sel-pop" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}>
              {canSearch ? (
                <div className="sel-search">
                  <Icon n="search" s={16} />
                  <input
                    ref={search}
                    value={q}
                    placeholder={`Search ${label.toLowerCase()}`}
                    aria-label={`Search ${label}`}
                    role="combobox"
                    aria-expanded
                    aria-controls={`${base}-list`}
                    aria-activedescendant={activeId}
                    aria-autocomplete="list"
                    onChange={(e) => {
                      setQ(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKey}
                  />
                </div>
              ) : null}
              <div
                ref={list}
                id={`${base}-list`}
                className="sel-list"
                role="listbox"
                aria-label={label}
                tabIndex={canSearch ? -1 : 0}
                aria-activedescendant={canSearch ? undefined : activeId}
                style={{ maxHeight: pos.maxH - (canSearch ? 45 : 0) }}
                onKeyDown={canSearch ? undefined : onKey}
              >
                {shown.length ? (
                  shown.map((o, i) => (
                    <div
                      key={String(o.value)}
                      id={`${base}-o${i}`}
                      data-i={i}
                      role="option"
                      aria-selected={same(o.value, value)}
                      aria-disabled={o.disabled || undefined}
                      className={["sel-opt", i === active && "active", o.disabled && "disabled"].filter(Boolean).join(" ")}
                      onPointerMove={() => active !== i && setActive(i)}
                      onClick={() => pick(o)}
                    >
                      <span className="sel-check">{same(o.value, value) ? <Icon n="check" s={16} w={2.25} /> : null}</span>
                      <span className="sel-text">
                        {o.label}
                        {o.hint ? <small>{o.hint}</small> : null}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="sel-empty">No matches for “{q}”</div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month and year as two dropdowns, stored as YYYY-MM (Safari has no native month picker). */
export function MonthPicker({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label: string }) {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  const y = m ? +m[1] : null;
  const mo = m ? +m[2] : null;
  const nowY = new Date().getFullYear();
  const years: Option<number>[] = [];
  for (let yy = nowY + 1; yy >= nowY - 10; yy--) years.push({ value: yy, label: String(yy) });
  if (y && !years.some((o) => o.value === y)) years.push({ value: y, label: String(y) });
  const set = (yy: number, mm: number) => onChange(`${yy}-${String(mm).padStart(2, "0")}`);
  return (
    <div className="pair">
      <Select size="sm" label={`${label} month`} placeholder="Month" value={mo} options={MONTHS.map((n, i) => ({ value: i + 1, label: n }))} searchable={false} onChange={(v) => set(y ?? nowY, v)} />
      <Select size="sm" label={`${label} year`} placeholder="Year" value={y} options={years} searchable={false} onChange={(v) => set(v, mo ?? new Date().getMonth() + 1)} />
    </div>
  );
}
