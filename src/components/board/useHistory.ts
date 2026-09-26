"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cardName, cleanSettings, describeUpdate, type BoardSettings, type Card, type CardMap, type Link, type LinkMap, type MoneyFormat } from "@/lib/engine";
import type { Store } from "@/lib/data";
import { say, sayError } from "@/components/ui/toast";

interface Op {
  label: string;
  log?: boolean;
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
}
interface Group {
  label: string;
  ops: Op[];
  tx?: boolean;
}

export interface BoardOps {
  addCards(cards: Card[], links?: Link[]): void;
  updateCard(id: string, patch: Partial<Card>): void;
  removeCard(id: string): void;
  addLink(l: Link): void;
  removeLink(id: string): void;
  renameBoard(name: string): void;
  setSettings(patch: Partial<BoardSettings>): void;
}

interface Ctx {
  store: Store;
  boardId: string;
  planId: string | null;
  canEdit: boolean;
  cards: () => CardMap;
  links: () => LinkMap;
  settings: () => BoardSettings;
  boardName: () => string;
  fmt: () => MoneyFormat;
  log: (text: string) => void;
}

/**
 * Every change made through these ops is recorded with its reverse, so it can be undone. Changes
 * made together inside `tx()` undo as one step. Undo only covers your own changes in this tab.
 */
export function useHistory(ctx: Ctx) {
  const undoS = useRef<Group[]>([]);
  const redoS = useRef<Group[]>([]);
  const cur = useRef<Group | null>(null);
  const [version, bump] = useState(0);
  const c = useRef(ctx);
  useLayoutEffect(() => {
    c.current = ctx;
  });

  const push = useCallback((g: Group) => {
    undoS.current.push(g);
    if (undoS.current.length > 100) undoS.current.shift();
    redoS.current = [];
    bump((n) => n + 1);
    if (g.tx || g.ops.some((o) => o.log !== false)) c.current.log(g.label);
  }, []);
  const record = useCallback(
    (op: Op) => {
      if (cur.current) cur.current.ops.push(op);
      else push({ label: op.label, ops: [op] });
    },
    [push],
  );
  const guard = useCallback(() => {
    if (!c.current.canEdit) {
      say("You can view this board but not change it.");
      return false;
    }
    if (!c.current.planId) return false;
    return true;
  }, []);
  const fire = (p: Promise<unknown>) => void p.catch(sayError);

  const tx = useCallback(<T,>(label: string, fn: () => T): T => {
    if (cur.current) return fn();
    cur.current = { label, ops: [], tx: true };
    try {
      return fn();
    } finally {
      const g = cur.current;
      cur.current = null;
      if (g.ops.length) push(g);
    }
  }, [push]);

  const ops: BoardOps = useMemo(
    () => ({
      addCards(cards, links = []) {
        if (!guard() || !cards.length) return;
        const { store, boardId, planId } = c.current;
        const pid = planId!;
        fire(store.addCards(boardId, pid, cards, links));
        record({
          label: cards.length === 1 ? `Added ${cardName(cards[0])}` : `Added ${cards.length} cards`,
          redo: () => store.addCards(boardId, pid, cards, links),
          undo: () => Promise.all(cards.map((x) => store.deleteCard(x.id))),
        });
      },
      updateCard(id, patch) {
        if (!guard()) return;
        const { store } = c.current;
        const card = c.current.cards()[id];
        if (!card) return;
        const prev: Partial<Card> = {};
        for (const k of Object.keys(patch) as (keyof Card)[]) (prev as Record<string, unknown>)[k] = k in card ? card[k] : null;
        const moveOnly = Object.keys(patch).every((k) => k === "x" || k === "y");
        fire(store.patchCard(id, patch));
        record({ label: describeUpdate(card, patch, c.current.fmt()), log: !moveOnly, redo: () => store.patchCard(id, patch), undo: () => store.patchCard(id, prev) });
      },
      removeCard(id) {
        if (!guard()) return;
        const { store, boardId, planId } = c.current;
        const card = c.current.cards()[id];
        if (!card) return;
        const links = Object.values(c.current.links()).filter((l) => l.from === id || l.to === id);
        fire(store.deleteCard(id));
        record({ label: `Deleted ${cardName(card)}`, redo: () => store.deleteCard(id), undo: () => store.addCards(boardId, planId!, [card], links) });
      },
      addLink(l) {
        if (!guard()) return;
        const { store, boardId, planId } = c.current;
        const cards = c.current.cards();
        fire(store.addLink(boardId, planId!, l));
        record({ label: `Linked ${cardName(cards[l.from])} to ${cardName(cards[l.to])}`, redo: () => store.addLink(boardId, planId!, l), undo: () => store.deleteLink(l.id) });
      },
      removeLink(id) {
        if (!guard()) return;
        const { store, boardId, planId } = c.current;
        const l = c.current.links()[id];
        if (!l) return;
        const cards = c.current.cards();
        fire(store.deleteLink(id));
        record({ label: `Unlinked ${cardName(cards[l.from])} from ${cardName(cards[l.to])}`, redo: () => store.deleteLink(id), undo: () => store.addLink(boardId, planId!, l) });
      },
      renameBoard(name) {
        if (!guard()) return;
        const { store, boardId } = c.current;
        const prev = c.current.boardName();
        fire(store.renameBoard(boardId, name));
        record({ label: `Renamed the board to “${name}”`, redo: () => store.renameBoard(boardId, name), undo: () => store.renameBoard(boardId, prev) });
      },
      setSettings(patch) {
        if (!guard()) return;
        const { store, boardId } = c.current;
        const prev = c.current.settings();
        const next = cleanSettings({ ...prev, ...patch, auto: { ...prev.auto, ...(patch.auto ?? {}) } });
        const names: Record<string, string> = { currency: "currency", horizon: "default projection", savingsTarget: "savings target", billsCap: "bills limit", buffer: "cash buffer", inflation: "yearly price increase", primaryAccount: "main account", state: "home state", filing: "filing status" };
        const what = patch.auto ? "automations" : Object.keys(patch).map((k) => names[k] ?? k).join(", ");
        fire(store.updateSettings(boardId, next));
        record({ label: `Changed the ${what}`, redo: () => store.updateSettings(boardId, next), undo: () => store.updateSettings(boardId, prev) });
      },
    }),
    [guard, record],
  );

  const undo = useCallback(() => {
    const g = undoS.current.pop();
    if (!g) return say("Nothing to undo.");
    void (async () => {
      try {
        for (const o of [...g.ops].reverse()) await o.undo();
      } catch (e) {
        sayError(e);
      }
    })();
    redoS.current.push(g);
    bump((n) => n + 1);
    say(`Undid: ${g.label}`);
    c.current.log(`Undid: ${g.label}`);
  }, []);
  const redo = useCallback(() => {
    const g = redoS.current.pop();
    if (!g) return say("Nothing to redo.");
    void (async () => {
      try {
        for (const o of g.ops) await o.redo();
      } catch (e) {
        sayError(e);
      }
    })();
    undoS.current.push(g);
    bump((n) => n + 1);
    say(`Redid: ${g.label}`);
    c.current.log(`Redid: ${g.label}`);
  }, []);
  const clear = useCallback(() => {
    undoS.current = [];
    redoS.current = [];
    bump((n) => n + 1);
  }, []);
  const peek = () => ({ undo: undoS.current.at(-1), redo: redoS.current.at(-1) });

  return { ops, tx, undo, redo, clear, peek, version };
}
