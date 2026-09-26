"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Tip } from "@/lib/copy";
import { clamp } from "@/lib/engine";
import { Icon } from "./Icon";
import { usePrefs } from "./prefs";

type Side = "top" | "bottom" | "left" | "right";

/** A tooltip rendered on top of everything and placed so it always stays on screen. */
export function FloatTip({ anchor, side = "top", id, rich, children, onEnter, onLeave }: { anchor: Element; side?: Side; id?: string; rich?: boolean; children: ReactNode; onEnter?: () => void; onLeave?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999, placed: "" });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const fits: Record<Side, boolean> = { top: r.top - h - gap >= 8, bottom: r.bottom + h + gap <= vh - 8, right: r.right + w + gap <= vw - 8, left: r.left - w - gap >= 8 };
    const s: Side = fits[side] ? side : ((["top", "bottom", "right", "left"] as Side[]).find((k) => fits[k]) ?? "bottom");
    let left: number;
    let top: number;
    if (s === "top" || s === "bottom") {
      left = r.left + r.width / 2 - w / 2;
      top = s === "top" ? r.top - h - gap : r.bottom + gap;
    } else {
      top = r.top + r.height / 2 - h / 2;
      left = s === "right" ? r.right + gap : r.left - w - gap;
    }
    left = Math.round(clamp(left, 8, vw - w - 8));
    top = Math.round(clamp(top, 8, vh - h - 8));
    // Measuring needs the rendered size, so the position is set after layout. It only changes when
    // the anchor, side or content changes, so this runs once per tip.
    setPos((p) => (p.left === left && p.top === top && p.placed === s ? p : { left, top, placed: s }));
  }, [anchor, side, children]);
  return createPortal(
    <div ref={ref} id={id} role="tooltip" className={`ftip${rich ? " rich" : ""}`} style={{ left: pos.left, top: pos.top }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </div>,
    document.body,
  );
}

/** Short labels: any element with data-tip="…" (and optional data-tip-side) gets one on hover or keyboard focus. */
export function TipLayer() {
  const [tip, setTip] = useState<{ el: Element; text: string; side: Side } | null>(null);
  useEffect(() => {
    let cur: Element | null = null;
    const show = (el: Element) => {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      cur = el;
      setTip({ el, text, side: (el.getAttribute("data-tip-side") as Side) || "top" });
    };
    const hide = () => {
      cur = null;
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-tip]") ?? null;
      if (el === cur) return;
      if (el) show(el);
      else if (cur) hide();
    };
    const focus = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-tip]");
      if (el && el.matches(":focus-visible")) show(el);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", hide);
    };
  }, []);
  if (!tip || !document.body.contains(tip.el)) return null;
  return (
    <FloatTip anchor={tip.el} side={tip.side}>
      {tip.text}
    </FloatTip>
  );
}

/** The (i) button with a "How it works / Best practice" tip, or a plain sentence. */
export function Info({ label, text }: { label: string; text: string | Tip }) {
  const { prefs } = usePrefs();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = document.getElementById(id);
      if (btn.current && !btn.current.contains(e.target as Node) && !(t && t.contains(e.target as Node))) setAnchor(null);
    };
    const other = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setAnchor(null);
    };
    const off = () => setAnchor(null);
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("cf-tip", other);
    window.addEventListener("scroll", off, true);
    window.addEventListener("wheel", off, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("cf-tip", other);
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("wheel", off, true);
    };
  }, [open, id]);
  if (!prefs.showTips) return null;
  const show = () => {
    if (closeT.current) clearTimeout(closeT.current);
    setAnchor(btn.current);
    window.dispatchEvent(new CustomEvent("cf-tip", { detail: id }));
  };
  const later = () => {
    if (closeT.current) clearTimeout(closeT.current);
    closeT.current = setTimeout(() => setAnchor(null), 140);
  };
  return (
    <span className="info-wrap">
      <button
        type="button"
        ref={btn}
        className="info"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={later}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          show();
        }}
        onFocus={show}
        onBlur={later}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setAnchor(null);
          }
        }}
      >
        <Icon n="info" s={16} />
      </button>
      {anchor ? (
        <FloatTip anchor={anchor} id={id} rich side="bottom" onEnter={show} onLeave={later}>
          {typeof text === "string" ? (
            <p>{text}</p>
          ) : (
            <>
              <b>How it works</b>
              <p>{text.what}</p>
              <b>Best practice</b>
              <p>{text.best}</p>
            </>
          )}
        </FloatTip>
      ) : null}
    </span>
  );
}
