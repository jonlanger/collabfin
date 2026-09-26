"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES, validateName, type BoardSettings } from "@/lib/engine";
import type { BoardSummary, PlanInfo, Store } from "@/lib/data";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { sayError } from "@/components/ui/toast";
import { ago } from "./people";

export type NavTarget = "home" | "templates" | "import" | "history" | "settings" | "keys" | "share" | "newPlan" | "compare";

/** Where a new board starts: blank, a template id, or a bank statement. */
export type BoardStart = "blank" | "import" | `tpl:${string}`;

export function NewBoardForm({ existing, onCreate, onCancel }: { existing: string[]; onCreate: (name: string, start: BoardStart) => void; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState<BoardStart>("blank");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const why = validateName(name, { label: "board", max: 60, existing });
    if (why) return setErr(why);
    onCreate(name.trim(), start);
  };
  return (
    <form className="new-board" onSubmit={submit}>
      <label className="eyebrow" htmlFor="nb-name">
        Board name
      </label>
      <input
        id="nb-name"
        className={`text-in${err ? " bad" : ""}`}
        autoFocus
        maxLength={80}
        value={name}
        placeholder="Wedding budget"
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
      <span className="eyebrow">Start with</span>
      <Select<string>
        label="Start with"
        value={start}
        searchable={false}
        options={[{ value: "blank", label: "A blank board" }, { value: "import", label: "A bank statement" }, ...TEMPLATES.map((t) => ({ value: `tpl:${t.id}`, label: t.name, hint: "Template" }))]}
        onChange={(v) => setStart(v as BoardStart)}
      />
      <div className="row-btns">
        <button className="btn-sm primary" type="submit">
          Create board
        </button>
        {onCancel ? (
          <button className="btn-sm" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function BoardsDrawer({ store, boardId, boardName, settings, plans, planId, onOpenPlan, onClose, onNav }: { store: Store; boardId: string; boardName: string; settings: BoardSettings; plans: PlanInfo[]; planId: string | null; onOpenPlan: (id: string) => void; onClose: () => void; onNav: (k: NavTarget) => void }) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    let alive = true;
    store.listBoards().then((b) => alive && setBoards(b), sayError);
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", k);
    requestAnimationFrame(() => ref.current?.querySelector("button")?.focus({ preventScroll: true }));
    return () => {
      alive = false;
      window.removeEventListener("keydown", k);
    };
  }, [store]);
  const list = (boards ?? []).map((b) => (b.id === boardId ? { ...b, name: boardName } : b));
  const create = async (name: string, start: BoardStart) => {
    try {
      // New boards keep this board's currency, tax and budget rules.
      const { boardId: id } = await store.createBoard(name, settings);
      onClose();
      router.push(`/boards/${id}${start !== "blank" ? `?start=${encodeURIComponent(start)}` : ""}`);
    } catch (e) {
      sayError(e);
    }
  };
  const remove = async (id: string) => {
    try {
      await store.deleteBoard(id);
      setBoards((b) => (b ?? []).filter((x) => x.id !== id));
      setConfirm(null);
      if (id === boardId) router.push("/boards");
    } catch (e) {
      sayError(e);
    }
  };
  const links: [NavTarget, IconName, string][] = [
    ["home", "home", "Home"],
    ["share", "users", "Share this board"],
    ["templates", "grid", "Templates"],
    ["import", "importIcon", "Import a statement"],
    ["history", "clock", "History"],
    ["settings", "sliders", "Settings"],
    ["keys", "keyboard", "Keyboard shortcuts"],
  ];
  return (
    <>
      <div className="scrim drawer-scrim" onClick={onClose} />
      <aside className="drawer" ref={ref} role="dialog" aria-modal="true" aria-label="Boards and plans">
        <div className="drawer-head">
          <h2>Your boards</h2>
          <button className="close" aria-label="Close boards and plans" onClick={onClose}>
            <Icon n="x" />
          </button>
        </div>
        <div className="drawer-body">
          {!creating ? (
            <button className="cta block" onClick={() => setCreating(true)}>
              <Icon n="plus" s={20} />
              New board
            </button>
          ) : (
            <NewBoardForm existing={list.map((b) => b.name)} onCreate={create} onCancel={() => setCreating(false)} />
          )}
          <nav aria-label="Boards" className="board-list">
            {boards == null ? <p className="muted">Loading your boards…</p> : null}
            {list.map((b) => {
              const on = b.id === boardId;
              return (
                <div key={b.id} className={`board-item${on ? " on" : ""}`}>
                  <div className="board-row">
                    <button
                      className="board-open"
                      aria-current={on ? "page" : undefined}
                      onClick={() => {
                        onClose();
                        if (!on) router.push(`/boards/${b.id}`);
                      }}
                    >
                      <span className="b-ico">
                        <Icon n="grid" s={18} />
                      </span>
                      <span className="b-text">
                        <b>{b.name}</b>
                        <small>
                          {on ? "Open now" : `Updated ${ago(b.updatedAt)}`}
                          {b.role !== "owner" ? ` · ${b.role === "editor" ? "Can edit" : "View only"}` : ""}
                        </small>
                      </span>
                    </button>
                    {b.role === "owner" ? (
                      <button className="icon-btn" aria-label={`Delete ${b.name}`} data-tip="Delete board" onClick={() => setConfirm(b.id)}>
                        <Icon n="trash" s={16} />
                      </button>
                    ) : null}
                  </div>
                  {confirm === b.id ? (
                    <div className="confirm" role="alert">
                      <p>Delete “{b.name}”, its plans and its history for everyone? This can’t be undone.</p>
                      <div className="row-btns">
                        <button className="btn-sm danger" onClick={() => remove(b.id)}>
                          Delete board
                        </button>
                        <button className="btn-sm" onClick={() => setConfirm(null)}>
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {on ? (
                    <div className="plans" role="group" aria-label={`Plans in ${b.name}`}>
                      <span className="eyebrow">Plans</span>
                      {plans.map((p) => (
                        <button
                          key={p.id}
                          className={`plan-item${p.id === planId ? " on" : ""}`}
                          aria-current={p.id === planId ? "true" : undefined}
                          onClick={() => {
                            onOpenPlan(p.id);
                            onClose();
                          }}
                        >
                          <span className="ck">{p.id === planId ? <Icon n="check" s={16} w={2.25} /> : null}</span>
                          {p.name}
                        </button>
                      ))}
                      <button
                        className="plan-item muted-item"
                        onClick={() => {
                          onNav("newPlan");
                          onClose();
                        }}
                      >
                        <span className="ck">
                          <Icon n="plus" s={16} />
                        </span>
                        New plan
                      </button>
                      {plans.length > 1 ? (
                        <button
                          className="plan-item muted-item"
                          onClick={() => {
                            onNav("compare");
                            onClose();
                          }}
                        >
                          <span className="ck">
                            <Icon n="compare" s={16} />
                          </span>
                          Compare plans
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <nav className="drawer-links" aria-label="Go to">
            {links.map(([k, ic, l]) => (
              <button
                key={k}
                className="plan-item"
                onClick={() => {
                  onNav(k);
                  onClose();
                }}
              >
                <span className="ck">
                  <Icon n={ic} s={18} />
                </span>
                {l}
              </button>
            ))}
            {store.mode === "cloud" ? (
              <form action="/auth/signout" method="post">
                <button className="plan-item" type="submit">
                  <span className="ck">
                    <Icon n="logout" s={18} />
                  </span>
                  Sign out
                </button>
              </form>
            ) : null}
          </nav>
          {store.mode === "local" ? <p className="muted">Boards are saved in this browser because accounts aren’t set up. Connect Supabase to share boards and work together live.</p> : null}
        </div>
      </aside>
    </>
  );
}
