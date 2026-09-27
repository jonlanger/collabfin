"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { validateName } from "@/lib/engine";
import type { PlanInfo } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";

export function PlanMenu({ planId, plans, canEdit, onSwitch, onCreate, onRename, onDelete, onCompare, onClose }: { planId: string; plans: PlanInfo[]; canEdit: boolean; onSwitch: (id: string) => void; onCreate: (name: string) => void; onRename: (name: string) => void; onDelete: () => void; onCompare: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<null | "new" | "rename" | "delete">(null);
  const cur = plans.find((p) => p.id === planId) ?? plans[0];
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current && !ref.current.contains(t) && !t.closest(".scen-btn") && !t.closest(".sel-pop")) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key);
    };
  }, []);
  // Opens under the plan button; nudge sideways if that would run off either edge of a narrow screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.translate = "";
    const r = el.getBoundingClientRect();
    const zoom = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
    const gap = 12;
    const shift = r.right > window.innerWidth - gap ? window.innerWidth - gap - r.right : r.left < gap ? gap - r.left : 0;
    if (shift) el.style.translate = `${Math.max(shift, gap - r.left) / zoom}px 0`;
  }, [mode]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const why = validateName(name, { label: "plan", max: 40, existing: plans.filter((p) => mode !== "rename" || p.id !== planId).map((p) => p.name) });
    if (why) return setErr(why);
    if (mode === "new" && plans.length >= 8) return setErr("A board can have 8 plans. Delete one to add another.");
    if (mode === "new") onCreate(name.trim());
    else onRename(name.trim());
    onClose();
  };
  if (!cur) return null;
  return (
    <div className="menu" ref={ref} role="menu" aria-label="Plans">
      <div className="menu-title eyebrow">Plans</div>
      {plans.map((p) => (
        <button
          key={p.id}
          className="menu-item"
          role="menuitemradio"
          aria-checked={p.id === planId}
          onClick={() => {
            onSwitch(p.id);
            onClose();
          }}
        >
          <span className="ck">{p.id === planId ? <Icon n="check" s={18} w={2.25} /> : null}</span>
          <span className="grow">{p.name}</span>
        </button>
      ))}
      <div className="menu-sep" />
      {mode === "new" || mode === "rename" ? (
        <form className="menu-form" onSubmit={submit}>
          <label className="eyebrow" htmlFor="plan-name">
            {mode === "new" ? `Copy “${cur.name}” as` : `Rename “${cur.name}”`}
          </label>
          <input
            id="plan-name"
            className={`text-in${err ? " bad" : ""}`}
            autoFocus
            value={name}
            maxLength={60}
            placeholder="What if we move?"
            onChange={(e) => {
              setName(e.target.value);
              setErr(null);
            }}
          />
          {err ? (
            <span className="field-err" role="alert">
              {err}
            </span>
          ) : null}
          <div className="row-btns">
            <button className="btn-sm primary" type="submit">
              {mode === "new" ? "Create plan" : "Rename"}
            </button>
            <button className="btn-sm" type="button" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : mode === "delete" ? (
        <div className="menu-form">
          <div className="confirm">
            <p>Delete “{cur.name}” and all its cards for everyone? This can’t be undone.</p>
            <div className="row-btns">
              <button
                className="btn-sm danger"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
              >
                Delete plan
              </button>
              <button className="btn-sm" onClick={() => setMode(null)}>
                Keep it
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {canEdit ? (
            <button
              className="menu-item"
              onClick={() => {
                setMode("new");
                setName("");
              }}
            >
              <span className="ck">
                <Icon n="plus" s={18} />
              </span>
              <span className="grow">New plan from “{cur.name}”</span>
            </button>
          ) : null}
          <button
            className="menu-item"
            onClick={() => {
              onCompare();
              onClose();
            }}
          >
            <span className="ck">
              <Icon n="compare" s={18} />
            </span>
            <span className="grow">Compare plans</span>
          </button>
          {canEdit ? (
            <button
              className="menu-item"
              onClick={() => {
                setMode("rename");
                setName(cur.name);
              }}
            >
              <span className="ck">
                <Icon n="pencil" s={18} />
              </span>
              <span className="grow">Rename “{cur.name}”</span>
            </button>
          ) : null}
          {canEdit && !cur.isMain ? (
            <button className="menu-item danger" onClick={() => setMode("delete")}>
              <span className="ck">
                <Icon n="trash" s={18} />
              </span>
              <span className="grow">Delete “{cur.name}”</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
