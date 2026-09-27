"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { cleanSettings, isKind, newId, type BoardSettings, type Card, type CardMap, type Link, type LinkMap } from "@/lib/engine";
import { StoreError, type ActivityEntry, type BoardMeta, type BoardSummary, type Me, type PeerState, type PlanInfo, type PresenceHandle, type Role, type Store } from "./types";

type Row = Record<string, unknown>;
interface CardRow {
  id: string;
  plan_id: string;
  data: Record<string, unknown>;
}
interface LinkRow {
  id: string;
  plan_id: string;
  from_card: string;
  to_card: string;
}

const BUCKET = "board-files";

/** Turns a Supabase/Postgres error into a sentence for the person using the app. */
function friendly(e: unknown): StoreError {
  if (e instanceof StoreError) return e;
  const err = (e ?? {}) as { code?: string; message?: string; status?: number };
  const code = err.code ?? "";
  if (code === "P0001" || code === "P0002") return new StoreError(err.message ?? "That didn’t work.", code);
  if (code === "42501" || code === "PGRST301" || err.status === 401 || err.status === 403) return new StoreError("You can view this board but not change it.", code);
  if (code === "23503" || code === "23514") return new StoreError("Someone else changed this at the same time. The board has been refreshed.", code);
  if (code === "23505") return new StoreError("That already exists.", code);
  if (/fetch|network|Failed to fetch/i.test(err.message ?? "")) return new StoreError("That change didn’t save. Check your connection and try again.", "network");
  return new StoreError("That change didn’t save. Try again in a moment.", code);
}
async function run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw friendly(error);
  return data;
}
const toCard = (r: CardRow): Card | null => {
  const d = r.data ?? {};
  return isKind(d.kind) ? ({ ...d, id: r.id } as Card) : null;
};
const cardData = (c: Card) => {
  const { id: _id, ...rest } = c;
  void _id;
  return rest;
};

interface PlanWatch {
  boardId: string;
  planId: string;
  cards: CardMap;
  links: LinkMap;
  emit: () => void;
  reload: () => Promise<void>;
}

export class CloudStore implements Store {
  readonly mode = "cloud" as const;
  /** Writes run one at a time, in order, so a link is never sent before the card it points to. */
  private queue: Promise<unknown> = Promise.resolve();
  private watches = new Set<PlanWatch>();
  private cardPlan = new Map<string, PlanWatch>();

  constructor(private sb: SupabaseClient) {}

  private write<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }
  /** After a failed write, reload the affected plans so the screen matches the database again. */
  private async recover(e: unknown): Promise<never> {
    await Promise.all([...this.watches].map((w) => w.reload().catch(() => undefined)));
    throw friendly(e);
  }
  private watchFor(planId: string) {
    return [...this.watches].filter((w) => w.planId === planId);
  }
  private mutateLocal(planId: string, fn: (w: PlanWatch) => void) {
    for (const w of this.watchFor(planId)) {
      fn(w);
      w.emit();
    }
  }

  async me(): Promise<Me | null> {
    const { data } = await this.sb.auth.getUser();
    const u = data.user;
    if (!u) return null;
    const { data: p } = await this.sb.from("profiles").select("display_name").eq("id", u.id).maybeSingle();
    const name = (p?.display_name as string) || (u.user_metadata?.full_name as string) || u.email?.split("@")[0] || "You";
    return { id: u.id, name, email: u.email ?? undefined };
  }
  async signOut() {
    await this.sb.auth.signOut();
  }

  /* ---------- boards ---------- */
  async listBoards(): Promise<BoardSummary[]> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) return [];
    const rows = await run(this.sb.from("board_members").select("role, boards(id, name, updated_at)").eq("user_id", auth.user.id));
    return ((rows ?? []) as unknown as { role: Role; boards: { id: string; name: string; updated_at: string } | null }[])
      .filter((r) => r.boards)
      .map((r) => ({ id: r.boards!.id, name: r.boards!.name, role: r.role, updatedAt: Date.parse(r.boards!.updated_at) }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async createBoard(name: string, settings: BoardSettings) {
    const rows = await run(this.sb.rpc("create_board", { p_name: name, p_settings: cleanSettings({ ...settings, primaryAccount: "" }) }));
    const r = (Array.isArray(rows) ? rows[0] : rows) as { board_id: string; plan_id: string };
    return { boardId: r.board_id, planId: r.plan_id };
  }
  async renameBoard(boardId: string, name: string) {
    await this.write(() => run(this.sb.from("boards").update({ name: name.slice(0, 60) }).eq("id", boardId)));
  }
  async deleteBoard(boardId: string) {
    await this.write(() => run(this.sb.from("boards").delete().eq("id", boardId)));
  }
  async updateSettings(boardId: string, settings: BoardSettings) {
    await this.write(() => run(this.sb.from("boards").update({ settings: cleanSettings(settings) }).eq("id", boardId)));
  }
  watchBoard(boardId: string, cb: { meta(m: BoardMeta | null): void; plans(p: PlanInfo[]): void }) {
    let alive = true;
    let role: Role = "viewer";
    let board: Row | null = null;
    let plans: PlanInfo[] = [];
    const sendMeta = () => cb.meta(board ? { id: boardId, name: String(board.name), settings: cleanSettings(board.settings), role } : null);
    const toPlan = (p: Row): PlanInfo => ({ id: String(p.id), name: String(p.name), isMain: Boolean(p.is_main), createdAt: Date.parse(String(p.created_at)) });
    const sortPlans = () => plans.sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.createdAt - b.createdAt);
    const load = async () => {
      const { data: auth } = await this.sb.auth.getUser();
      const [b, m, p] = await Promise.all([
        this.sb.from("boards").select("id, name, settings").eq("id", boardId).maybeSingle(),
        this.sb.from("board_members").select("role").eq("board_id", boardId).eq("user_id", auth.user?.id ?? "").maybeSingle(),
        this.sb.from("plans").select("id, name, is_main, created_at").eq("board_id", boardId),
      ]);
      if (!alive) return;
      board = (b.data as Row) ?? null;
      role = ((m.data as Row | null)?.role as Role) ?? "viewer";
      plans = ((p.data as Row[]) ?? []).map(toPlan);
      sortPlans();
      sendMeta();
      cb.plans([...plans]);
    };
    void load();
    const ch = this.sb
      .channel(`board-meta:${boardId}:${newId()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` }, (e) => {
        board = { ...(board ?? {}), ...(e.new as Row) };
        sendMeta();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "boards" }, (e) => {
        if ((e.old as Row)?.id === boardId) {
          board = null;
          sendMeta();
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "plans", filter: `board_id=eq.${boardId}` }, (e) => {
        const p = toPlan(e.new as Row);
        plans = plans.filter((x) => x.id !== p.id).concat(p);
        sortPlans();
        cb.plans([...plans]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "plans", filter: `board_id=eq.${boardId}` }, (e) => {
        const p = toPlan(e.new as Row);
        plans = plans.map((x) => (x.id === p.id ? p : x));
        cb.plans([...plans]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "plans" }, (e) => {
        const id = (e.old as Row)?.id;
        if (plans.some((x) => x.id === id)) {
          plans = plans.filter((x) => x.id !== id);
          cb.plans([...plans]);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      alive = false;
      void this.sb.removeChannel(ch);
    };
  }

  /* ---------- plans ---------- */
  private async fetchPlan(planId: string) {
    const [c, l] = await Promise.all([
      run(this.sb.from("cards").select("id, plan_id, data").eq("plan_id", planId)),
      run(this.sb.from("links").select("id, plan_id, from_card, to_card").eq("plan_id", planId)),
    ]);
    const cards: CardMap = {};
    for (const r of (c ?? []) as CardRow[]) {
      const card = toCard(r);
      if (card) cards[card.id] = card;
    }
    const links: LinkMap = {};
    for (const r of (l ?? []) as LinkRow[]) links[r.id] = { id: r.id, from: r.from_card, to: r.to_card };
    return { cards, links };
  }
  async loadPlan(planId: string) {
    return this.fetchPlan(planId);
  }
  watchPlan(boardId: string, planId: string, cb: { data(cards: CardMap, links: LinkMap): void; ready(): void }) {
    let alive = true;
    let readySent = false;
    const w: PlanWatch = {
      boardId,
      planId,
      cards: {},
      links: {},
      emit: () => alive && cb.data({ ...w.cards }, { ...w.links }),
      reload: async () => {
        const d = await this.fetchPlan(planId);
        if (!alive) return;
        w.cards = d.cards;
        w.links = d.links;
        for (const id of Object.keys(d.cards)) this.cardPlan.set(id, w);
        w.emit();
        if (!readySent) {
          readySent = true;
          cb.ready();
        }
      },
    };
    this.watches.add(w);
    const ch: RealtimeChannel = this.sb
      .channel(`plan:${planId}:${newId()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cards", filter: `plan_id=eq.${planId}` }, (e) => {
        const card = toCard(e.new as CardRow);
        if (!card) return;
        w.cards[card.id] = card;
        this.cardPlan.set(card.id, w);
        w.emit();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cards", filter: `plan_id=eq.${planId}` }, (e) => {
        const card = toCard(e.new as CardRow);
        if (!card) return;
        w.cards[card.id] = card;
        w.emit();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cards" }, (e) => {
        const id = String((e.old as Row)?.id ?? "");
        if (!w.cards[id]) return;
        delete w.cards[id];
        for (const [lid, l] of Object.entries(w.links)) if (l.from === id || l.to === id) delete w.links[lid];
        w.emit();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "links", filter: `plan_id=eq.${planId}` }, (e) => {
        const r = e.new as LinkRow;
        w.links[r.id] = { id: r.id, from: r.from_card, to: r.to_card };
        w.emit();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "links" }, (e) => {
        const id = String((e.old as Row)?.id ?? "");
        if (!w.links[id]) return;
        delete w.links[id];
        w.emit();
      })
      .subscribe((status) => {
        // Load after subscribing, and again after any reconnect, so no change is missed.
        if (status === "SUBSCRIBED") void w.reload().catch(() => undefined);
      });
    return () => {
      alive = false;
      this.watches.delete(w);
      void this.sb.removeChannel(ch);
    };
  }
  async createPlan(fromPlanId: string, name: string) {
    return this.write(async () => String(await run(this.sb.rpc("duplicate_plan", { p_plan: fromPlanId, p_name: name }))));
  }
  async renamePlan(planId: string, name: string) {
    await this.write(() => run(this.sb.from("plans").update({ name: name.slice(0, 40) }).eq("id", planId)));
  }
  async deletePlan(planId: string) {
    await this.write(() => run(this.sb.from("plans").delete().eq("id", planId)));
  }

  /* ---------- cards and links (optimistic, then written in order) ---------- */
  async addCards(boardId: string, planId: string, cards: Card[], links: Link[] = []) {
    this.mutateLocal(planId, (w) => {
      for (const c of cards) {
        w.cards[c.id] = c;
        this.cardPlan.set(c.id, w);
      }
      for (const l of links) w.links[l.id] = l;
    });
    return this.write(async () => {
      try {
        if (cards.length) await run(this.sb.from("cards").insert(cards.map((c) => ({ id: c.id, plan_id: planId, board_id: boardId, data: cardData(c) }))));
        if (links.length) await run(this.sb.from("links").insert(links.map((l) => ({ id: l.id, plan_id: planId, board_id: boardId, from_card: l.from, to_card: l.to }))));
      } catch (e) {
        await this.recover(e);
      }
    });
  }
  async patchCard(cardId: string, patch: Partial<Card>) {
    const w = this.cardPlan.get(cardId);
    if (w) {
      this.mutateLocal(w.planId, (x) => {
        const cur = x.cards[cardId];
        if (!cur) return;
        const next = { ...cur, ...patch } as Record<string, unknown>;
        for (const [k, v] of Object.entries(patch)) if (v === null) delete next[k];
        x.cards[cardId] = next as unknown as Card;
      });
    }
    const { id: _id, ...rest } = patch;
    void _id;
    return this.write(async () => {
      try {
        await run(this.sb.rpc("patch_card", { p_id: cardId, p_patch: rest }));
      } catch (e) {
        await this.recover(e);
      }
    });
  }
  async deleteCard(cardId: string) {
    const w = this.cardPlan.get(cardId);
    if (w) {
      this.mutateLocal(w.planId, (x) => {
        delete x.cards[cardId];
        for (const [lid, l] of Object.entries(x.links)) if (l.from === cardId || l.to === cardId) delete x.links[lid];
      });
    }
    return this.write(async () => {
      try {
        await run(this.sb.from("cards").delete().eq("id", cardId));
      } catch (e) {
        await this.recover(e);
      }
    });
  }
  async addLink(boardId: string, planId: string, link: Link) {
    this.mutateLocal(planId, (w) => {
      w.links[link.id] = link;
    });
    return this.write(async () => {
      try {
        await run(this.sb.from("links").insert({ id: link.id, plan_id: planId, board_id: boardId, from_card: link.from, to_card: link.to }));
      } catch (e) {
        await this.recover(e);
      }
    });
  }
  async deleteLink(linkId: string) {
    for (const w of this.watches) {
      if (w.links[linkId]) {
        delete w.links[linkId];
        w.emit();
      }
    }
    return this.write(async () => {
      try {
        await run(this.sb.from("links").delete().eq("id", linkId));
      } catch (e) {
        await this.recover(e);
      }
    });
  }

  /* ---------- activity and people ---------- */
  async log(boardId: string, planId: string | null, text: string) {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return;
    await this.write(() => run(this.sb.from("activity").insert({ board_id: boardId, plan_id: planId, user_id: data.user!.id, text: text.slice(0, 200) }))).catch(() => undefined);
  }
  watchActivity(boardId: string, cb: (entries: ActivityEntry[]) => void) {
    let alive = true;
    let entries: ActivityEntry[] = [];
    const toEntry = (r: Row): ActivityEntry => ({
      id: String(r.id),
      planId: (r.plan_id as string) ?? null,
      userId: (r.user_id as string) ?? null,
      text: String(r.text),
      at: Date.parse(String(r.created_at)),
    });
    const load = async () => {
      const { data } = await this.sb.from("activity").select("id, plan_id, user_id, text, created_at").eq("board_id", boardId).order("created_at", { ascending: false }).limit(100);
      if (!alive) return;
      entries = ((data as Row[]) ?? []).map(toEntry);
      cb(entries);
    };
    const ch = this.sb
      .channel(`activity:${boardId}:${newId()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity", filter: `board_id=eq.${boardId}` }, (e) => {
        entries = [toEntry(e.new as Row), ...entries.filter((x) => x.id !== String((e.new as Row).id))].slice(0, 100);
        cb(entries);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      alive = false;
      void this.sb.removeChannel(ch);
    };
  }
  async profiles(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return {};
    const { data } = await this.sb.from("profiles").select("id, display_name").in("id", unique);
    return Object.fromEntries(((data as Row[]) ?? []).map((r) => [String(r.id), String(r.display_name ?? "")]));
  }

  /* ---------- files ---------- */
  async uploadFile(boardId: string, file: File) {
    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
    const path = `${boardId}/${newId()}-${safe}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) {
      const msg = String(error.message ?? "");
      if (/size|large/i.test(msg)) throw new StoreError(`${file.name} is too large. Files can be up to 20 MB.`);
      if (/mime|type/i.test(msg)) throw new StoreError(`${file.name} can’t be uploaded. Use CSV, PDF, an image or a text file.`);
      throw friendly(error);
    }
    return { path, size: file.size, type: file.type };
  }
  async fileUrl(path: string) {
    const { data } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }

  /* ---------- presence ---------- */
  presence(boardId: string, me: Me, color: number): PresenceHandle {
    const key = newId();
    let state: PeerState = { key, userId: me.id, name: me.name, color };
    const listeners = new Set<(p: PeerState[]) => void>();
    let peers: PeerState[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let joined = false;
    const ch = this.sb.channel(`board:${boardId}`, { config: { private: true, presence: { key } } });
    const push = () => {
      timer = null;
      if (joined) void ch.track(state);
    };
    ch.on("presence", { event: "sync" }, () => {
      const all = ch.presenceState<PeerState>();
      peers = Object.values(all)
        .flat()
        .filter((p) => p.key !== key);
      listeners.forEach((l) => l(peers));
    });
    void this.sb.realtime.setAuth().then(() =>
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          joined = true;
          push();
        }
      }),
    );
    return {
      update(patch) {
        state = { ...state, ...patch };
        // Presence is shared about 12 times a second at most, which is plenty for cursors.
        if (!timer) timer = setTimeout(push, 80);
      },
      onPeers(cb) {
        listeners.add(cb);
        cb(peers);
        return () => void listeners.delete(cb);
      },
      leave: () => {
        if (timer) clearTimeout(timer);
        void this.sb.removeChannel(ch);
      },
    };
  }

  /* ---------- sharing ---------- */
  async createInvite(boardId: string, role: Exclude<Role, "owner">) {
    const { data } = await this.sb.auth.getUser();
    const row = await run(this.sb.from("board_invites").insert({ board_id: boardId, role, created_by: data.user?.id }).select("token").single());
    return String((row as Row).token);
  }
  async acceptInvite(token: string) {
    return String(await run(this.sb.rpc("accept_invite", { p_token: token })));
  }
}
