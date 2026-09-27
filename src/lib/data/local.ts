"use client";

import { cleanSettings, materialize, newId, TEMPLATES, type BoardSettings, type Card, type CardMap, type Link, type LinkMap } from "@/lib/engine";
import { StoreError, type ActivityEntry, type BoardMeta, type BoardSummary, type Me, type PlanInfo, type Store } from "./types";

/* A complete single-user store kept in localStorage. Used when Supabase isn't configured, so the app
   always runs (local development, previews, demos). Changes in one tab reach other tabs through the
   storage event. */

interface Db {
  v: 1;
  boards: Record<string, { id: string; name: string; settings: BoardSettings; createdAt: number; updatedAt: number }>;
  plans: Record<string, { id: string; boardId: string; name: string; isMain: boolean; createdAt: number }>;
  cards: Record<string, Card & { planId: string; boardId: string }>;
  links: Record<string, Link & { planId: string; boardId: string }>;
  activity: (ActivityEntry & { boardId: string })[];
}

const KEY = "collabfin-local-v1";
const ME: Me = { id: "local-user", name: "You" };

function empty(): Db {
  return { v: 1, boards: {}, plans: {}, cards: {}, links: {}, activity: [] };
}

export class LocalStore implements Store {
  readonly mode = "local" as const;
  private db: Db = empty();
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window === "undefined") return;
    this.db = this.read();
    if (!Object.keys(this.db.boards).length) this.seed();
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      this.db = this.read();
      this.emit();
    });
  }

  private read(): Db {
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? (JSON.parse(raw) as Db) : null;
      return d && d.v === 1 ? d : empty();
    } catch {
      return empty();
    }
  }
  private write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.db));
    } catch {
      // Storage full or blocked: keep working in memory for this visit.
    }
    this.emit();
  }
  private emit() {
    queueMicrotask(() => this.listeners.forEach((l) => l()));
  }
  private listen(fn: () => void) {
    this.listeners.add(fn);
    queueMicrotask(fn);
    return () => void this.listeners.delete(fn);
  }
  private seed() {
    const now = Date.now();
    const boardId = newId();
    const planId = newId();
    this.db.boards[boardId] = { id: boardId, name: "Household budget", settings: cleanSettings({}), createdAt: now, updatedAt: now };
    this.db.plans[planId] = { id: planId, boardId, name: "Current plan", isMain: true, createdAt: now };
    const t = materialize(TEMPLATES[0]);
    for (const c of t.cards) this.db.cards[c.id] = { ...c, planId, boardId };
    for (const l of t.links) this.db.links[l.id] = { ...l, planId, boardId };
    this.write();
  }
  private touch(boardId: string) {
    const b = this.db.boards[boardId];
    if (b) b.updatedAt = Date.now();
  }

  async me() {
    return ME;
  }
  async signOut() {}

  async listBoards(): Promise<BoardSummary[]> {
    return Object.values(this.db.boards)
      .map((b) => ({ id: b.id, name: b.name, role: "owner" as const, updatedAt: b.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async createBoard(name: string, settings: BoardSettings) {
    if (Object.keys(this.db.boards).length >= 50) throw new StoreError("You can keep up to 50 boards. Delete one to add another.");
    const now = Date.now();
    const boardId = newId();
    const planId = newId();
    this.db.boards[boardId] = { id: boardId, name: name.slice(0, 60), settings: cleanSettings({ ...settings, primaryAccount: "" }), createdAt: now, updatedAt: now };
    this.db.plans[planId] = { id: planId, boardId, name: "Current plan", isMain: true, createdAt: now };
    this.write();
    return { boardId, planId };
  }
  async renameBoard(boardId: string, name: string) {
    const b = this.db.boards[boardId];
    if (!b) return;
    b.name = name.slice(0, 60);
    this.touch(boardId);
    this.write();
  }
  async deleteBoard(boardId: string) {
    delete this.db.boards[boardId];
    for (const [id, p] of Object.entries(this.db.plans)) if (p.boardId === boardId) delete this.db.plans[id];
    for (const [id, c] of Object.entries(this.db.cards)) if (c.boardId === boardId) delete this.db.cards[id];
    for (const [id, l] of Object.entries(this.db.links)) if (l.boardId === boardId) delete this.db.links[id];
    this.db.activity = this.db.activity.filter((a) => a.boardId !== boardId);
    this.write();
  }
  async updateSettings(boardId: string, settings: BoardSettings) {
    const b = this.db.boards[boardId];
    if (!b) return;
    b.settings = cleanSettings(settings);
    this.write();
  }
  watchBoard(boardId: string, cb: { meta(m: BoardMeta | null): void; plans(p: PlanInfo[]): void }) {
    return this.listen(() => {
      const b = this.db.boards[boardId];
      cb.meta(b ? { id: b.id, name: b.name, settings: cleanSettings(b.settings), role: "owner" } : null);
      cb.plans(
        Object.values(this.db.plans)
          .filter((p) => p.boardId === boardId)
          .map(({ id, name, isMain, createdAt }) => ({ id, name, isMain, createdAt }))
          .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.createdAt - b.createdAt),
      );
    });
  }

  private planData(planId: string) {
    const cards: CardMap = {};
    const links: LinkMap = {};
    for (const c of Object.values(this.db.cards)) {
      if (c.planId !== planId) continue;
      const { planId: _p, boardId: _b, ...card } = c;
      void _p;
      void _b;
      cards[c.id] = card;
    }
    for (const l of Object.values(this.db.links)) if (l.planId === planId) links[l.id] = { id: l.id, from: l.from, to: l.to };
    return { cards, links };
  }
  watchPlan(_boardId: string, planId: string, cb: { data(cards: CardMap, links: LinkMap): void; ready(): void }) {
    let first = true;
    return this.listen(() => {
      const d = this.planData(planId);
      cb.data(d.cards, d.links);
      if (first) {
        first = false;
        cb.ready();
      }
    });
  }
  async loadPlan(planId: string) {
    return this.planData(planId);
  }
  async createPlan(fromPlanId: string, name: string) {
    const src = this.db.plans[fromPlanId];
    if (!src) throw new StoreError("That plan no longer exists.");
    if (Object.values(this.db.plans).filter((p) => p.boardId === src.boardId).length >= 8) throw new StoreError("A board can have 8 plans. Delete one to add another.");
    const id = newId();
    this.db.plans[id] = { id, boardId: src.boardId, name: name.slice(0, 40), isMain: false, createdAt: Date.now() };
    const map: Record<string, string> = {};
    for (const c of Object.values(this.db.cards)) {
      if (c.planId !== fromPlanId) continue;
      const nid = newId();
      map[c.id] = nid;
      this.db.cards[nid] = { ...structuredClone(c), id: nid, planId: id };
    }
    for (const l of Object.values(this.db.links)) {
      if (l.planId !== fromPlanId || !map[l.from] || !map[l.to]) continue;
      const nid = newId();
      this.db.links[nid] = { id: nid, from: map[l.from], to: map[l.to], planId: id, boardId: src.boardId };
    }
    this.write();
    return id;
  }
  async renamePlan(planId: string, name: string) {
    const p = this.db.plans[planId];
    if (p) p.name = name.slice(0, 40);
    this.write();
  }
  async deletePlan(planId: string) {
    const p = this.db.plans[planId];
    if (!p || p.isMain) return;
    delete this.db.plans[planId];
    for (const [id, c] of Object.entries(this.db.cards)) if (c.planId === planId) delete this.db.cards[id];
    for (const [id, l] of Object.entries(this.db.links)) if (l.planId === planId) delete this.db.links[id];
    this.write();
  }

  async addCards(boardId: string, planId: string, cards: Card[], links: Link[] = []) {
    for (const c of cards) this.db.cards[c.id] = { ...structuredClone(c), planId, boardId };
    for (const l of links) this.db.links[l.id] = { ...l, planId, boardId };
    this.touch(boardId);
    this.write();
  }
  async patchCard(cardId: string, patch: Partial<Card>) {
    const c = this.db.cards[cardId];
    if (!c) return;
    const next = { ...c, ...structuredClone(patch) } as Record<string, unknown>;
    for (const k of Object.keys(patch)) if ((patch as Record<string, unknown>)[k] === null) delete next[k];
    this.db.cards[cardId] = next as unknown as Db["cards"][string];
    this.write();
  }
  async deleteCard(cardId: string) {
    delete this.db.cards[cardId];
    for (const [id, l] of Object.entries(this.db.links)) if (l.from === cardId || l.to === cardId) delete this.db.links[id];
    this.write();
  }
  async addLink(boardId: string, planId: string, link: Link) {
    if (!this.db.cards[link.from] || !this.db.cards[link.to]) return;
    this.db.links[link.id] = { ...link, planId, boardId };
    this.write();
  }
  async deleteLink(linkId: string) {
    delete this.db.links[linkId];
    this.write();
  }

  async log(boardId: string, planId: string | null, text: string) {
    this.db.activity.unshift({ id: newId(), boardId, planId, userId: ME.id, text: text.slice(0, 200), at: Date.now() });
    this.db.activity = this.db.activity.slice(0, 500);
    this.touch(boardId);
    this.write();
  }
  watchActivity(boardId: string, cb: (entries: ActivityEntry[]) => void) {
    return this.listen(() => cb(this.db.activity.filter((a) => a.boardId === boardId).slice(0, 100)));
  }
  async profiles(ids: string[]) {
    return Object.fromEntries(ids.map((id) => [id, id === ME.id ? ME.name : ""]));
  }

  async uploadFile(): Promise<{ path: string; size: number; type: string }> {
    throw new StoreError("File uploads need an account. Sign in to share files on a board.");
  }
  async fileUrl() {
    return null;
  }
  presence() {
    return null;
  }
  async createInvite(): Promise<string> {
    throw new StoreError("Sharing needs an account. This board is saved in this browser only.");
  }
  async acceptInvite(): Promise<string> {
    throw new StoreError("Sign in to accept an invite.");
  }
}
