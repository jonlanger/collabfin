"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  cardName,
  computeChecks,
  computeFlows,
  DEFAULT_SETTINGS,
  KINDS,
  mainAccount,
  materialize,
  moneyFormat,
  newCard,
  newId,
  num,
  PALETTE,
  plural,
  portsFor,
  TEMPLATES,
  tone,
  wouldLoop,
  clamp,
  type Card as CardT,
  type CardKind,
  type CardMap,
  type Fix,
  type Link,
  type LinkMap,
  type Template,
} from "@/lib/engine";
import { getStore, type ActivityEntry, type BoardMeta, type Me, type PeerState, type PlanInfo, type PresenceHandle } from "@/lib/data";
import { CURSOR_PATH, Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { MoneyProvider, usePrefs } from "@/components/ui/prefs";
import { TextInput } from "@/components/ui/inputs";
import { Info } from "@/components/ui/tips";
import { say, sayError } from "@/components/ui/toast";
import { Card } from "./cards/Card";
import { BoardsDrawer, type NavTarget } from "./BoardsDrawer";
import { PlanMenu } from "./PlanMenu";
import { ChecksPanel } from "./panels/ChecksPanel";
import { ComparePanel } from "./panels/ComparePanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import { ImportPanel, type ImportResult } from "./panels/ImportPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { SharePanel } from "./panels/SharePanel";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { colorFor, initials } from "./people";
import { useHistory } from "./useHistory";

type PanelName = "add" | "checks" | "templates" | "settings" | "history" | "compare" | "import" | "share";
interface View {
  x: number;
  y: number;
  k: number;
}
interface Gesture {
  pointers: Record<number, { x: number; y: number }>;
  mode: null | "pan" | "drag" | "wire" | "pinch";
  id?: string;
  from?: string;
  start?: { x: number; y: number };
  orig?: { x: number; y: number };
  moved?: boolean;
  dist?: number;
  mid?: { x: number; y: number };
}

const PORT_Y = 30;
const portOut = (c: CardT, pos: { x: number; y: number }) => ({ x: pos.x + (KINDS[c.kind] ?? KINDS.income).w, y: pos.y + PORT_Y });
const portIn = (pos: { x: number; y: number }) => ({ x: pos.x, y: pos.y + PORT_Y });
function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  const mid = { x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x, y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y };
  return { d: `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x - 8},${b.y}`, mid };
}
const nowMs = () => Date.now();
const TYPE_BY_EXT: Record<string, string> = { csv: "text/csv", md: "text/markdown", json: "application/json", txt: "text/plain", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export function BoardApp({ boardId, initialPlanId, start }: { boardId: string; initialPlanId?: string; start?: string }) {
  const router = useRouter();
  const store = useMemo(() => getStore(), []);
  const { prefs, setPrefs } = usePrefs();

  /* ---------- data ---------- */
  const [me, setMe] = useState<Me | null>(null);
  const [meta, setMeta] = useState<BoardMeta | null | undefined>(undefined);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [chosenPlan, setPlanId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardMap>({});
  const [links, setLinks] = useState<LinkMap>({});
  const [readyPlan, setReadyPlan] = useState<string | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [peers, setPeers] = useState<PeerState[]>([]);

  useEffect(() => {
    store.me().then(setMe, () => setMe(null));
  }, [store]);
  useEffect(() => store.watchBoard(boardId, { meta: setMeta, plans: setPlans }), [store, boardId]);
  // The plan shown: the one picked, else the one in the URL, else the main plan (if it still exists).
  const planId = useMemo(() => {
    if (!plans.length) return null;
    const want = chosenPlan ?? initialPlanId;
    return (plans.find((p) => p.id === want) ?? plans.find((p) => p.isMain) ?? plans[0]).id;
  }, [plans, chosenPlan, initialPlanId]);
  const ready = planId != null && readyPlan === planId;
  useEffect(() => {
    if (!planId) return;
    return store.watchPlan(boardId, planId, {
      data: (c, l) => {
        setCards(c);
        setLinks(l);
      },
      ready: () => setReadyPlan(planId),
    });
  }, [store, boardId, planId]);
  useEffect(() => store.watchActivity(boardId, setEntries), [store, boardId]);
  useEffect(() => {
    const missing = [...new Set(entries.map((e) => e.userId).concat(peers.map((p) => p.userId)))].filter((id): id is string => Boolean(id) && !(id! in names));
    if (!missing.length) return;
    store.profiles(missing).then((p) => setNames((n) => ({ ...n, ...Object.fromEntries(missing.map((id) => [id, p[id] ?? ""])) })), () => undefined);
  }, [entries, peers, names, store]);

  const settings = meta?.settings ?? DEFAULT_SETTINGS;
  const fmt = useMemo(() => moneyFormat(settings.currency), [settings.currency]);
  const canEdit = meta ? meta.role !== "viewer" : false;
  const plan = plans.find((p) => p.id === planId);
  const planName = plan?.name ?? "Current plan";
  const planNames = Object.fromEntries(plans.map((p) => [p.id, p.name]));

  const cardsRef = useRef(cards);
  const linksRef = useRef(links);
  const settingsRef = useRef(settings);
  const metaRef = useRef(meta);
  useEffect(() => {
    cardsRef.current = cards;
    linksRef.current = links;
    settingsRef.current = settings;
    metaRef.current = meta;
  });

  const hist = useHistory({
    store,
    boardId,
    planId,
    canEdit,
    cards: () => cardsRef.current,
    links: () => linksRef.current,
    settings: () => settingsRef.current,
    boardName: () => metaRef.current?.name ?? "",
    fmt: () => fmt,
    log: (text) => void store.log(boardId, planId, text),
  });
  const ops = hist.ops;

  /* ---------- presence ---------- */
  const presence = useRef<PresenceHandle | null>(null);
  useEffect(() => {
    if (!me) return;
    const h = store.presence(boardId, me, colorFor(me.id));
    presence.current = h;
    if (!h) return;
    const off = h.onPeers(setPeers);
    return () => {
      off();
      h.leave();
      presence.current = null;
    };
  }, [store, boardId, me]);
  const tellPresence = useCallback((patch: Partial<PeerState>) => presence.current?.update(patch), []);
  useEffect(() => tellPresence({ planId: planId ?? undefined }), [planId, tellPresence]);

  /* ---------- view state ---------- */
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [sel, setSel] = useState<{ type: "card" | "link"; id: string } | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number; over: string | null } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [panel, setPanel] = useState<PanelName | null>(start === "import" ? "import" : null);
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [ghost, setGhost] = useState<{ kind: CardKind; x: number; y: number } | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string; size: number; x: number; y: number }[]>([]);
  const [dropOver, setDropOver] = useState(false);
  const [importPreload, setImportPreload] = useState<{ text: string; name: string } | null>(null);
  const [a11yFocus, setA11yFocus] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const vp = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef(view);
  const dragRef = useRef(drag);
  useEffect(() => {
    viewRef.current = view;
    dragRef.current = drag;
  });
  const G = useRef<Gesture>({ pointers: {}, mode: null });
  const spaceDown = useRef(false);
  const addCount = useRef(0);
  const fitted = useRef(false);
  const quietUntil = useRef(0);
  const quiet = () => {
    quietUntil.current = nowMs() + 2500;
  };

  const flows = useMemo(() => computeFlows(cards, links), [cards, links]);
  const flowsRef = useRef(flows);
  useEffect(() => {
    flowsRef.current = flows;
  });
  const checks = useMemo(() => computeChecks(cards, flows, settings, fmt), [cards, flows, settings, fmt]);
  const posOf = (id: string) => (drag && drag.id === id ? drag : cards[id]);

  /* ---------- geometry ---------- */
  const rect = () => vp.current!.getBoundingClientRect();
  const toWorld = (cx: number, cy: number) => {
    const r = rect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  };
  const centerWorld = () => {
    const r = rect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  };
  const zoomAt = useCallback(
    (f: number, cx?: number, cy?: number) =>
      setView((v) => {
        const r = vp.current!.getBoundingClientRect();
        const px = cx == null ? r.width / 2 : cx - r.left;
        const py = cy == null ? r.height / 2 : cy - r.top;
        const k = clamp(v.k * f, 0.2, 2.5);
        const s = k / v.k;
        return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
      }),
    [],
  );
  const nodeOf = (id: string) => vp.current?.querySelector<HTMLElement>(`.card[data-card="${id}"]`) ?? null;
  const fit = useCallback((only?: string[]) => {
    const el = vp.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nodes = Array.from(el.querySelectorAll<HTMLElement>(".card[data-card]"));
    if (only) nodes = nodes.filter((n) => only.includes(n.dataset.card!));
    if (!nodes.length) return setView({ x: r.width / 2, y: r.height / 2, k: 1 });
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of nodes) {
      const c = cardsRef.current[n.dataset.card!];
      if (!c) continue;
      x0 = Math.min(x0, c.x);
      y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + n.offsetWidth);
      y1 = Math.max(y1, c.y + n.offsetHeight);
    }
    if (!Number.isFinite(x0)) return;
    const phone = r.width < 720;
    const L = phone ? 16 : 84;
    const T = phone ? 128 : 104;
    const B = phone ? 100 : 72;
    const aw = r.width - L - 16;
    const ah = r.height - T - B;
    const k = clamp(Math.min(aw / (x1 - x0), ah / (y1 - y0)), phone ? 0.3 : 0.2, 1);
    setView({ k, x: L + (aw - (x1 - x0) * k) / 2 - x0 * k, y: T + Math.max(0, (ah - (y1 - y0) * k) / 2) - y0 * k });
  }, []);
  const focusCard = (id: string) => {
    const n = nodeOf(id);
    const c = cardsRef.current[id];
    if (!n || !c) return;
    const r = rect();
    const phone = r.width < 720;
    const k = clamp(Math.max(viewRef.current.k, 0.8), 0.3, 1);
    const cx = phone ? r.width / 2 : (r.width - (panel ? 424 : 0) + 72) / 2;
    const cy = phone ? r.height * 0.3 : r.height / 2;
    setView({ k, x: cx - (c.x + n.offsetWidth / 2) * k, y: cy - (c.y + Math.min(n.offsetHeight, 400) / 2) * k });
    setSel({ type: "card", id });
    if (phone) setPanel(null);
  };
  useEffect(() => {
    if (ready && !fitted.current) {
      fitted.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => fit()));
    }
  }, [ready, fit]);
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest("textarea") && !e.ctrlKey) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /* ---------- presence: pointing, selecting, editing ---------- */
  useEffect(() => tellPresence({ sel: sel?.type === "card" ? sel.id : null }), [sel, tellPresence]);
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const fin = (e: FocusEvent) => {
      const c = (e.target as Element).closest?.("[data-card]") as HTMLElement | null;
      tellPresence({ edit: c?.dataset.card ?? null });
      if (c?.dataset.card && !G.current.mode) setSel((cur) => (cur?.type === "card" && cur.id === c.dataset.card ? cur : { type: "card", id: c.dataset.card! }));
    };
    const fout = () => tellPresence({ edit: null });
    el.addEventListener("focusin", fin);
    el.addEventListener("focusout", fout);
    return () => {
      el.removeEventListener("focusin", fin);
      el.removeEventListener("focusout", fout);
    };
  }, [tellPresence]);
  // Other people looking at this same plan (your own other tabs are left out).
  const others = peers.filter((p) => p.userId !== me?.id && p.planId === planId);
  const peerName = (p: PeerState) => names[p.userId] || p.name || "Someone";
  const editors: Record<string, { name: string; color: number }> = {};
  for (const p of others) if (p.edit) editors[p.edit] = { name: peerName(p), color: p.color };

  /* ---------- automations: new problems and screen reader announcements ---------- */
  const seenChecks = useRef<Set<string> | null>(null);
  useEffect(() => {
    seenChecks.current = null;
  }, [planId]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const keys = new Set(checks.list.filter((x) => x.level !== "tip").map((x) => x.key));
      if (seenChecks.current && settingsRef.current.auto.notifyChecks && nowMs() > quietUntil.current) {
        const fresh = checks.list.find((x) => x.level !== "tip" && !seenChecks.current!.has(x.key));
        if (fresh) say(fresh.text, "Check");
      }
      seenChecks.current = keys;
    }, 1200);
    return () => clearTimeout(t);
  }, [checks, ready]);
  const lastSaid = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const probs = checks.list.filter((x) => x.level !== "tip").length;
      const key = `${Math.round(flows.net)}|${probs}`;
      if (lastSaid.current !== null && lastSaid.current !== key && prefs.announce) {
        setAnnouncement(`Left over per month is now ${fmt.signed(flows.net)}. ${probs ? `${plural(probs, "problem")} to check.` : "No problems."}`);
      }
      lastSaid.current = key;
    }, 1500);
    return () => clearTimeout(t);
  }, [flows.net, checks, ready, prefs.announce, fmt]);

  /* ---------- links, with constraints ---------- */
  const linkRule = (from: string, to: string): string | null => {
    const a = cardsRef.current[from];
    const b = cardsRef.current[to];
    if (!a || !b || from === to) return "skip";
    if (!portsFor(a).outPort) return `${cardName(a)} can’t send money on.${a.kind === "account" ? " CDs hold money until they mature." : ""}`;
    if (!portsFor(b).inPort) return `${cardName(b)} can’t take money in.${b.kind === "account" ? " CDs don’t accept deposits after they open." : ""}`;
    const f = flowsRef.current;
    if ((f.outgoing[from] ?? []).includes(to)) return "Those cards are already linked.";
    if ((f.outgoing[to] ?? []).includes(from)) return "Those cards are already linked the other way. Remove that link first.";
    if (wouldLoop(f.outgoing, from, to)) return "That link would make a loop, so it wasn’t added.";
    if (b.kind !== "split" && (f.outgoing[from] ?? []).some((t) => cardsRef.current[t] && cardsRef.current[t].kind !== "split")) return `${cardName(a)} already sends its money to a card. Add a Split card to divide it.`;
    return null;
  };
  const tryLink = (from: string, to: string) => {
    const why = linkRule(from, to);
    if (why) {
      if (why !== "skip") say(why);
      return false;
    }
    ops.addLink({ id: newId(), from, to });
    return true;
  };

  /* ---------- adding cards (runs the automations) ---------- */
  const runAutomations = (c: CardT) => {
    const s = settingsRef.current;
    const all = { ...cardsRef.current, [c.id]: c };
    const acct = mainAccount(all, s);
    const acctName = acct ? cardName(all[acct]) : "";
    const done: string[] = [];
    if (acct && s.auto.linkOutflows && ["spend", "recurring", "debt"].includes(c.kind)) {
      ops.addLink({ id: newId(), from: c.id, to: acct });
      done.push(`linked it to ${acctName}`);
    }
    if (c.kind === "income") {
      if (s.auto.payYourselfFirst) {
        let goal = Object.values(all)
          .filter((x) => x.kind === "goal")
          .sort((p, q) => p.x - q.x)[0];
        const extra: CardT[] = [];
        if (!goal) {
          goal = { ...newCard("goal", c.x + 700, c.y + 240, s), title: "Savings" };
          extra.push(goal);
        }
        const sp = { ...newCard("split", c.x + KINDS.income.w + 80, c.y + 240, s), title: "Pay yourself first", pct: s.savingsTarget };
        extra.push(sp);
        ops.addCards(extra, [
          { id: newId(), from: c.id, to: sp.id },
          { id: newId(), from: sp.id, to: goal.id },
        ]);
        done.push(`sent ${s.savingsTarget}% to ${cardName(goal)}`);
      }
      if (acct && s.auto.linkIncome) {
        ops.addLink({ id: newId(), from: c.id, to: acct });
        done.push(`linked it to ${acctName}`);
      }
    }
    if (done.length) say(`New ${KINDS[c.kind].label.toLowerCase()}: ${done.join(" and ")}.`, "Automation");
  };
  const addCardAt = (kind: CardKind, at: { x: number; y: number }) => {
    if (!canEdit) return say("You can view this board but not change it.");
    quiet();
    const c = newCard(kind, at.x - KINDS[kind].w / 2, at.y - 80, settingsRef.current);
    hist.tx(`Added ${cardName(c)}`, () => {
      ops.addCards([c]);
      runAutomations(c);
    });
    setSel({ type: "card", id: c.id });
    setTool("select");
  };
  const addCardCenter = (kind: CardKind) => {
    const n = addCount.current++ % 6;
    const p = centerWorld();
    addCardAt(kind, { x: p.x + n * 28, y: p.y + n * 28 });
  };
  const patchCard = useCallback(
    (id: string, patch: Partial<CardT>) => {
      const prev = cardsRef.current[id];
      ops.updateCard(id, patch);
      if (prev?.kind === "goal" && settingsRef.current.auto.goalAlert) {
        const next = { ...prev, ...patch };
        const t = num(next.target);
        if (t > 0 && num(next.saved) >= t && num(prev.saved) < num(prev.target)) say(`${cardName(next)} reached its ${fmt.money(t)} target.`, "Goal reached");
      }
    },
    [ops, fmt],
  );
  const duplicate = (id: string) => {
    const c = cardsRef.current[id];
    if (!c) return;
    quiet();
    const copy: CardT = { ...structuredClone(c), id: newId(), x: c.x + 32, y: c.y + 32 };
    if (copy.title) copy.title = `${copy.title} copy`.slice(0, 60);
    ops.addCards([copy]);
    setSel({ type: "card", id: copy.id });
  };
  const removeSel = () => {
    if (!sel) return;
    if (sel.type === "card") ops.removeCard(sel.id);
    else ops.removeLink(sel.id);
    setSel(null);
  };
  const placeRight = (newCards: CardT[]) => {
    const cs = Object.values(cardsRef.current);
    const tx0 = Math.min(...newCards.map((c) => c.x));
    const ty0 = Math.min(...newCards.map((c) => c.y));
    if (!cs.length) return { dx: -tx0, dy: -ty0 };
    return { dx: Math.max(...cs.map((c) => c.x + (KINDS[c.kind]?.w ?? 260))) + 240 - tx0, dy: Math.min(...cs.map((c) => c.y)) - ty0 };
  };
  const addTemplate = (t: Template) => {
    if (!canEdit) return say("You can view this board but not change it.");
    quiet();
    const { dx, dy } = placeRight(materialize(t, 0, 0, settingsRef.current).cards);
    const b = materialize(t, dx, dy, settingsRef.current);
    hist.tx(`Added the “${t.name}” template`, () => ops.addCards(b.cards, b.links));
    say(`Added “${t.name}” to the board.`);
    if (rect().width < 720) setPanel(null);
    const ids = b.cards.map((c) => c.id);
    requestAnimationFrame(() => requestAnimationFrame(() => fit(ids)));
  };
  const addImport = (r: ImportResult) => {
    if (!canEdit) return say("You can view this board but not change it.");
    quiet();
    const s = settingsRef.current;
    const inc = r.income.filter((x) => x.on);
    const rec = r.recurring.filter((x) => x.on);
    const sp = r.spend.filter((x) => x.on);
    const made: CardT[] = [];
    let y = 0;
    for (const x of inc) {
      made.push({ ...newCard("income", 0, y, s), title: x.name.slice(0, 60), amount: x.amount, freq: x.freq });
      y += 260;
    }
    if (rec.length) {
      made.push({ ...newCard("recurring", -48, y, s), title: "Bills from statement", items: rec.slice(0, 30).map((x) => ({ id: newId(), name: x.name.slice(0, 40), amount: x.amount, freq: x.freq })) });
      y += 120 + rec.length * 42 + 140;
    }
    for (const x of sp) {
      made.push({ ...newCard("spend", 0, y, s), title: x.name, amount: x.amount, freq: "monthly" });
      y += 260;
    }
    let acct = mainAccount(cardsRef.current, s);
    let acctCard: CardT | null = null;
    if (!acct) {
      acctCard = { ...newCard("account", 500, 0, s), title: "Checking" };
      acct = acctCard.id;
    }
    const all = acctCard ? [...made, acctCard] : made;
    const { dx, dy } = placeRight(made);
    for (const c of all) {
      c.x += dx;
      c.y += dy;
    }
    const newLinks: Link[] = made.map((c) => ({ id: newId(), from: c.id, to: acct! }));
    hist.tx(`Imported ${plural(inc.length + rec.length + sp.length, "item")} from a statement`, () => ops.addCards(all, newLinks));
    say(`Added ${plural(all.length, "card")} from your statement${acctCard ? " and a Checking account for them." : `, linked to ${cardName(cardsRef.current[acct])}.`}`);
    setPanel(null);
    setImportPreload(null);
    const ids = all.map((c) => c.id);
    requestAnimationFrame(() => requestAnimationFrame(() => fit(ids)));
  };
  const openImportFromFile = async (c: CardT) => {
    try {
      const url = c.path ? await store.fileUrl(c.path) : null;
      if (!url) throw new Error();
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setImportPreload({ text: await res.text(), name: c.name ?? "statement.csv" });
      setPanel("import");
    } catch {
      say(`${c.name ?? "The file"} couldn’t be opened. Try uploading it again.`);
    }
  };
  const arrange = () => {
    if (!canEdit) return say("You can view this board but not change it.");
    quiet();
    const all = cardsRef.current;
    const f = flowsRef.current;
    const flowCards = Object.values(all).filter((c) => KINDS[c.kind] && ((f.inputs[c.id] ?? []).length || (f.outgoing[c.id] ?? []).length));
    const loose = Object.values(all).filter((c) => KINDS[c.kind] && !flowCards.includes(c));
    const depth: Record<string, number> = {};
    const busy: Record<string, boolean> = {};
    const d = (id: string): number => {
      if (depth[id] != null) return depth[id];
      if (busy[id]) return 0;
      busy[id] = true;
      const v = Math.max(-1, ...(f.inputs[id] ?? []).map(d)) + 1;
      busy[id] = false;
      depth[id] = v;
      return v;
    };
    flowCards.forEach((c) => d(c.id));
    const layers: CardT[][] = [];
    for (const c of flowCards) (layers[depth[c.id]] ??= []).push(c);
    const x0 = Math.min(0, ...Object.values(all).map((c) => c.x));
    const y0 = Math.min(0, ...Object.values(all).map((c) => c.y));
    let x = x0;
    let maxY = y0;
    const h = (c: CardT) => nodeOf(c.id)?.offsetHeight ?? 280;
    hist.tx("Arranged the cards by flow", () => {
      for (const layer of layers) {
        if (!layer) continue;
        layer.sort((a, b) => a.y - b.y);
        let y = y0;
        let w = 0;
        for (const c of layer) {
          ops.updateCard(c.id, { x: Math.round(x), y: Math.round(y) });
          y += h(c) + 48;
          w = Math.max(w, KINDS[c.kind].w);
        }
        maxY = Math.max(maxY, y);
        x += w + 140;
      }
      let lx = x0;
      for (const c of loose) {
        ops.updateCard(c.id, { x: Math.round(lx), y: Math.round(maxY + 60) });
        lx += KINDS[c.kind].w + 48;
      }
    });
    say(`Arranged ${plural(flowCards.length + loose.length, "card")} by how money flows.`, "Automation");
    requestAnimationFrame(() => requestAnimationFrame(() => fit()));
  };
  const clearPlan = () => {
    quiet();
    hist.tx(`Cleared “${planName}”`, () => Object.keys(cardsRef.current).forEach((id) => ops.removeCard(id)));
    setSel(null);
    say("The cards were deleted. Undo brings them back.");
  };
  const applyFix = (fx: Fix) => {
    if (fx.type === "link") {
      if (tryLink(fx.from, fx.to)) say("Linked.");
    } else {
      patchCard(fx.id, fx.patch);
      say("Updated.");
    }
  };

  /* ---------- plans ---------- */
  const switchPlan = (id: string) => {
    if (id === planId) return;
    hist.clear();
    setSel(null);
    setDrag(null);
    setWire(null);
    setConnectFrom(null);
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    router.replace(`/boards/${boardId}${p && !p.isMain ? `?plan=${id}` : ""}`, { scroll: false });
    say(`Showing “${p?.name ?? "plan"}”.`);
  };
  const createPlan = async (name: string) => {
    if (!planId) return;
    try {
      const id = await store.createPlan(planId, name);
      void store.log(boardId, id, `Created the plan “${name}” from “${planName}”`);
      hist.clear();
      setSel(null);
      setPlanId(id);
      router.replace(`/boards/${boardId}?plan=${id}`, { scroll: false });
      say(`Created “${name}”. Changes here don’t affect “${planName}”.`);
    } catch (e) {
      sayError(e);
    }
  };
  const renamePlan = (name: string) => {
    if (!planId) return;
    store.renamePlan(planId, name).then(() => store.log(boardId, planId, `Renamed the plan “${planName}” to “${name}”`), sayError);
  };
  const deletePlan = async () => {
    if (!planId || plan?.isMain) return;
    const name = planName;
    const id = planId;
    const main = plans.find((p) => p.isMain);
    if (main) switchPlan(main.id);
    try {
      await store.deletePlan(id);
      void store.log(boardId, null, `Deleted the plan “${name}”`);
      say(`Deleted “${name}”.`);
    } catch (e) {
      sayError(e);
    }
  };

  /* ---------- starting a new board ---------- */
  const started = useRef(false);
  useEffect(() => {
    if (!start || !ready || started.current || !meta) return;
    started.current = true;
    if (start.startsWith("tpl:")) {
      const t = TEMPLATES.find((x) => `tpl:${x.id}` === start);
      if (t && !Object.keys(cardsRef.current).length) addTemplate(t);
    }
    router.replace(`/boards/${boardId}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, ready, meta]);

  /* ---------- files ---------- */
  const uploadFiles = (list: FileList | File[] | null, at: { x: number; y: number }) => {
    const files = Array.from(list ?? []);
    if (!files.length || !planId) return;
    if (!canEdit) return say("You can view this board but not change it.");
    if (store.mode === "local") return say("File uploads need an account. Sign in to share files on a board.");
    files.forEach(async (f, i) => {
      const pid = newId();
      const p = { id: pid, name: f.name, size: f.size, x: Math.round(at.x - 128 + i * 28), y: Math.round(at.y - 60 + i * 28) };
      setPending((l) => [...l, p]);
      try {
        const ext = (f.name.split(".").pop() ?? "").toLowerCase();
        const typed = TYPE_BY_EXT[ext] && f.type !== TYPE_BY_EXT[ext] ? new File([f], f.name, { type: TYPE_BY_EXT[ext] }) : f;
        const r = await store.uploadFile(boardId, typed);
        const c: CardT = { id: newId(), kind: "file", x: p.x, y: p.y, name: f.name.slice(0, 160), size: r.size, type: r.type, path: r.path };
        ops.addCards([c]);
        setSel({ type: "card", id: c.id });
      } catch (e) {
        sayError(e);
      } finally {
        setPending((l) => l.filter((x) => x.id !== pid));
      }
    });
  };

  /* ---------- pointer handling ---------- */
  const onPointerDown = (e: RPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    const g = G.current;
    const el = vp.current!;
    const t = e.target as Element;
    const port = t.closest<HTMLElement>('[data-port="out"]');
    const cardEl = t.closest<HTMLElement>("[data-card]");
    const cid = cardEl?.dataset.card;
    const linkEl = t.closest<HTMLElement>("[data-link]");
    if (connectFrom) {
      if (cid && cid !== connectFrom) tryLink(connectFrom, cid);
      setConnectFrom(null);
      if (cid) return;
    }
    if (t.closest("input,textarea,select,button,a,label") && !port) {
      if (cid) setSel({ type: "card", id: cid });
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && el.contains(active)) active.blur();
    g.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Some pointers can't be captured (e.g. already released); the gesture still works.
    }
    const ids = Object.keys(g.pointers);
    if (ids.length === 2) {
      const a = g.pointers[+ids[0]];
      const b = g.pointers[+ids[1]];
      g.mode = "pinch";
      g.dist = Math.hypot(a.x - b.x, a.y - b.y);
      g.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setDrag(null);
      setWire(null);
      return;
    }
    const panTool = tool === "hand" || e.button === 1 || spaceDown.current;
    if (port && !panTool && canEdit) {
      const w = toWorld(e.clientX, e.clientY);
      g.mode = "wire";
      g.from = port.dataset.card;
      setWire({ from: g.from!, x: w.x, y: w.y, over: null });
      setSel({ type: "card", id: g.from! });
      return;
    }
    if (linkEl && !panTool) {
      setSel({ type: "link", id: linkEl.dataset.link! });
      delete g.pointers[e.pointerId];
      return;
    }
    if (cid && !panTool) {
      const c = cardsRef.current[cid];
      if (!c) return;
      setSel({ type: "card", id: cid });
      if (!canEdit) return;
      g.mode = "drag";
      g.id = cid;
      g.start = { x: e.clientX, y: e.clientY };
      g.orig = { x: c.x, y: c.y };
      g.moved = false;
      return;
    }
    setSel(null);
    g.mode = "pan";
    g.start = { x: e.clientX, y: e.clientY };
    g.orig = { x: viewRef.current.x, y: viewRef.current.y };
    setPanning(true);
  };
  const onPointerMove = (e: RPointerEvent) => {
    const g = G.current;
    if (e.pointerType === "mouse" || g.pointers[e.pointerId]) {
      const w = toWorld(e.clientX, e.clientY);
      tellPresence({ cx: Math.round(w.x), cy: Math.round(w.y) });
    }
    if (!g.pointers[e.pointerId]) return;
    g.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (g.mode === "pinch") {
      const ids = Object.keys(g.pointers);
      if (ids.length < 2) return;
      const a = g.pointers[+ids[0]];
      const b = g.pointers[+ids[1]];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dx = m.x - g.mid!.x;
      const dy = m.y - g.mid!.y;
      zoomAt(d / g.dist!, m.x, m.y);
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      g.dist = d;
      g.mid = m;
    } else if (g.mode === "pan") {
      setView((v) => ({ ...v, x: g.orig!.x + e.clientX - g.start!.x, y: g.orig!.y + e.clientY - g.start!.y }));
    } else if (g.mode === "drag") {
      const k = viewRef.current.k;
      const dx = e.clientX - g.start!.x;
      const dy = e.clientY - g.start!.y;
      if (!g.moved && Math.hypot(dx, dy) < 4) return;
      g.moved = true;
      setDrag({ id: g.id!, x: g.orig!.x + dx / k, y: g.orig!.y + dy / k });
    } else if (g.mode === "wire") {
      const w = toWorld(e.clientX, e.clientY);
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-card]");
      setWire((v) => v && { ...v, x: w.x, y: w.y, over: over && over.dataset.card !== v.from ? over.dataset.card! : null });
    }
  };
  const onPointerUp = (e: RPointerEvent) => {
    const g = G.current;
    if (!g.pointers[e.pointerId]) return;
    delete g.pointers[e.pointerId];
    if (g.mode === "drag" && g.moved && dragRef.current) {
      const d = dragRef.current;
      ops.updateCard(d.id, { x: Math.round(d.x), y: Math.round(d.y) });
      setDrag(null);
    }
    if (g.mode === "wire") {
      const to = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-card]");
      if (to && to.dataset.card !== g.from) tryLink(g.from!, to.dataset.card!);
      setWire(null);
    }
    if (!Object.keys(g.pointers).length) {
      g.mode = null;
      setPanning(false);
    } else if (g.mode === "pinch") g.mode = null;
  };
  const paletteDown = (kind: CardKind, e: RPointerEvent) => {
    if (e.button && e.button !== 0) return;
    const start0 = { x: e.clientX, y: e.clientY };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start0.x, ev.clientY - start0.y) < 6) return;
      moved = true;
      setGhost({ kind, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setGhost(null);
      if (!moved) return addCardCenter(kind);
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (under && vp.current?.contains(under)) addCardAt(kind, toWorld(ev.clientX, ev.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (drawer) return;
      const t = e.target as Element | null;
      const typing = t?.closest?.('input,textarea,select,[contenteditable="true"],[role="listbox"],.sel-pop');
      if (e.key === " " && !typing && !t?.closest?.("button")) {
        spaceDown.current = true;
        e.preventDefault();
        return;
      }
      if (typing) return;
      const k = e.key;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (k === "z" || k === "Z")) {
        e.preventDefault();
        return e.shiftKey ? hist.redo() : hist.undo();
      }
      if (mod && (k === "y" || k === "Y")) {
        e.preventDefault();
        return hist.redo();
      }
      if (mod && (k === "d" || k === "D")) {
        if (sel?.type === "card") {
          e.preventDefault();
          duplicate(sel.id);
        }
        return;
      }
      if (mod || e.altKey) return;
      if (k === "?") {
        e.preventDefault();
        setPanel("settings");
        setA11yFocus((n) => n + 1);
        return;
      }
      if (k === "Delete" || k === "Backspace") {
        if (sel) {
          e.preventDefault();
          removeSel();
        }
      } else if (k === "Escape") {
        setSel(null);
        setConnectFrom(null);
        setTool("select");
      } else if (k === "+" || k === "=") zoomAt(1.2);
      else if (k === "-" || k === "_") zoomAt(1 / 1.2);
      else if (k === "0") fit();
      else if (k === "v" || k === "V") setTool("select");
      else if (k === "h" || k === "H") setTool("hand");
      else if (k.startsWith("Arrow")) {
        const s = e.shiftKey ? 200 : 60;
        setView((v) => ({ ...v, x: v.x + (k === "ArrowLeft" ? s : k === "ArrowRight" ? -s : 0), y: v.y + (k === "ArrowUp" ? s : k === "ArrowDown" ? -s : 0) }));
      }
    };
    const upKey = (e: KeyboardEvent) => {
      if (e.key === " ") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", upKey);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", upKey);
    };
  });

  const closePanel = () => {
    setPanel(null);
    setImportPreload(null);
  };
  const closeDrawer = () => setDrawer(false);
  const togglePanel = (p: PanelName) => setPanel((cur) => (cur === p ? null : p));
  const onNav = (k: NavTarget) => {
    if (k === "home") return router.push("/");
    if (k === "keys") {
      setPanel("settings");
      setA11yFocus((n) => n + 1);
    } else if (k === "newPlan") setMenu(true);
    else setPanel(k);
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  /* ---------- render ---------- */
  if (meta === null) {
    return (
      <main className="page-center">
        <div className="page-card">
          <h1>This board isn’t available</h1>
          <p>It may have been deleted, or you don’t have access. Ask the owner for an invite link.</p>
          <button className="cta" onClick={() => router.push("/boards")}>
            Go to your boards
          </button>
        </div>
      </main>
    );
  }

  const cardList = Object.values(cards).filter((c) => KINDS[c.kind] && Number.isFinite(c.x) && Number.isFinite(c.y));
  const linkList = Object.values(links).filter((l) => cards[l.from] && cards[l.to]);
  const selCard = sel?.type === "card" ? cards[sel.id] : undefined;
  const grid = 24 * view.k;
  const empty = ready && cardList.length === 0 && pending.length === 0;
  const wireFrom = wire ? cards[wire.from] : undefined;
  const worst = checks.list[0]?.level;
  const problems = checks.list.filter((x) => x.level !== "tip").length;
  const pk = hist.peek();
  const avatars: { key: string; name: string; color: number; where: string | null }[] = [];
  const seenWho = new Set<string>();
  for (const p of peers) {
    if (p.userId === me?.id || seenWho.has(p.userId)) continue;
    seenWho.add(p.userId);
    avatars.push({ key: p.userId, name: peerName(p), color: p.color, where: p.planId && p.planId !== planId ? (planNames[p.planId] ?? "another plan") : null });
  }
  const railTip = (label: string) => (prefs.railOpen ? undefined : label);
  const title = meta?.name ?? "";

  return (
    <MoneyProvider value={fmt}>
      <div className="board-page">
        <div
          ref={vp}
          className={["vp", tool === "hand" && "hand", panning && "panning", (wire || connectFrom) && "wiring"].filter(Boolean).join(" ")}
          style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
          tabIndex={-1}
          role="application"
          aria-label="Budget canvas. Drag the ground to pan, pinch or Ctrl and scroll to zoom. Drag from a card's right dot to another card to link them."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => tellPresence({ cx: null, cy: null })}
          onDragOver={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            if (!dropOver) setDropOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(false);
          }}
          onDrop={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            setDropOver(false);
            uploadFiles(e.dataTransfer.files, toWorld(e.clientX, e.clientY));
          }}
        >
          <div className="world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}>
            <svg className="links" aria-hidden="true">
              {linkList.map((l) => {
                const a = portOut(cards[l.from], posOf(l.from));
                const b = portIn(posOf(l.to));
                const cv = curve(a, b);
                const on = sel?.type === "link" && sel.id === l.id;
                return (
                  <g key={l.id} className={`link${on ? " on" : ""}`}>
                    <path className="link-hit" data-link={l.id} d={cv.d} />
                    <path className="link-line" d={cv.d} />
                    <path className="link-arrow" d={`M${b.x - 10},${b.y - 6} L${b.x},${b.y} L${b.x - 10},${b.y + 6} Z`} />
                  </g>
                );
              })}
              {wire && wireFrom ? <path className="wire" d={curve(portOut(wireFrom, posOf(wire.from)), { x: wire.x + 8, y: wire.y }).d} /> : null}
            </svg>
            {cardList.map((c) => {
              const p = posOf(c.id);
              return (
                <Card
                  key={c.id}
                  c={c}
                  cards={cards}
                  x={p.x}
                  y={p.y}
                  flows={flows}
                  settings={settings}
                  onPatch={patchCard}
                  badge={checks.byCard[c.id]}
                  onBadge={(id) => {
                    setSel({ type: "card", id });
                    setPanel("checks");
                  }}
                  editor={editors[c.id]}
                  onImport={openImportFromFile}
                  fileUrl={store.fileUrl.bind(store)}
                  selected={sel?.type === "card" && sel.id === c.id}
                  hot={wire?.over === c.id}
                  lifted={drag?.id === c.id}
                />
              );
            })}
            {pending.map((p) => (
              <div key={p.id} className="card k-file pending" style={{ left: p.x, top: p.y, width: KINDS.file.w }}>
                <div className="card-head">
                  <span className="kind">
                    <Icon n="upload" />
                  </span>
                  <div className="head-text">
                    <span className="eyebrow">Uploading</span>
                    <span className="title-input">{p.name}</span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="bar" role="progressbar" aria-label={`Uploading ${p.name}`}>
                    <span />
                  </div>
                </div>
              </div>
            ))}
            {linkList.map((l) => {
              const on = sel?.type === "link" && sel.id === l.id;
              if (!prefs.showAmounts && !on) return null;
              const mid = curve(portOut(cards[l.from], posOf(l.from)), portIn(posOf(l.to))).mid;
              const v = flows.linkValue(l.from, l.to) || 0;
              return (
                <div key={`t${l.id}`} className={`link-tag${on ? " on" : " no-x"}`} data-link={l.id} style={{ left: mid.x, top: mid.y }}>
                  <span className={tone(v)}>{fmt.signed(v)}</span>
                  {on && canEdit ? (
                    <button
                      aria-label="Remove link"
                      onClick={() => {
                        ops.removeLink(l.id);
                        setSel(null);
                      }}
                    >
                      <Icon n="x" s={14} w={2} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {prefs.hideCursors
              ? null
              : others.map((p) =>
                  typeof p.cx === "number" && typeof p.cy === "number" ? (
                    <div key={p.key} className="cursor" style={{ left: p.cx, top: p.cy, transform: `scale(${1 / view.k})` }} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" className={`f${p.color}`}>
                        <path d={CURSOR_PATH} />
                      </svg>
                      <span className={`cursor-tag p${p.color}`}>{peerName(p)}</span>
                    </div>
                  ) : null,
                )}
            {selCard && !drag && !wire && canEdit ? (
              <div className="ctx-anchor" style={{ left: posOf(selCard.id).x, top: posOf(selCard.id).y - 12 / view.k }}>
                <div className="ctx" style={{ transform: `scale(${1 / view.k})` }}>
                  {portsFor(selCard).outPort ? (
                    <button
                      onClick={() => {
                        setConnectFrom(selCard.id);
                        setSel(null);
                      }}
                    >
                      <Icon n="link" s={18} />
                      Link to…
                    </button>
                  ) : null}
                  <button onClick={() => duplicate(selCard.id)}>
                    <Icon n="copy" s={18} />
                    Duplicate
                  </button>
                  <button className="danger" onClick={removeSel}>
                    <Icon n="trash" s={18} />
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="top">
          <div className="board-wrap">
            <div className="pill board">
              <button className="icon-btn2" aria-label="Boards and plans" data-tip="Boards and plans" data-tip-side="bottom" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}>
                <Icon n="menu" />
              </button>
              <button className="wordmark" aria-label="Collabfin home" data-tip="Home" data-tip-side="bottom" onClick={() => router.push("/")}>
                Collabfin
              </button>
              <span className="divider" />
              <TextInput className="board-title" required label="Board name" value={title} disabled={!canEdit} onCommit={(v) => ops.renameBoard(v)} />
              <div className="scen-wrap">
                <button className="scen-btn" aria-haspopup="menu" aria-expanded={menu} aria-label={`Plan: ${planName}`} onClick={() => setMenu(!menu)} data-tip="Plans in this board" data-tip-side="bottom">
                  <Icon n="layers" s={16} />
                  <span>{planName}</span>
                  <Icon n="chevron" s={16} />
                </button>
                {menu && planId ? <PlanMenu planId={planId} plans={plans} canEdit={canEdit} onSwitch={switchPlan} onCreate={createPlan} onRename={renamePlan} onDelete={deletePlan} onCompare={() => setPanel("compare")} onClose={() => setMenu(false)} /> : null}
              </div>
              <span className={`status${store.mode === "local" ? " local" : ""}`} tabIndex={0} data-tip={store.mode === "cloud" ? (canEdit ? "Live: everyone with access sees changes as they happen" : "Live, view only") : "Saved in this browser only"} data-tip-side="bottom">
                <i />
                <span className="sr">{store.mode === "cloud" ? "Live" : "Saved in this browser"}</span>
              </span>
              {avatars.length ? (
                <div className="peers" aria-label={`${plural(avatars.length, "other person")} here`}>
                  {avatars.slice(0, 3).map((a) => (
                    <span key={a.key} className={`av p${a.color}`} data-tip={a.name + (a.where ? `, in ${a.where}` : "")} data-tip-side="bottom">
                      {initials(a.name)}
                    </span>
                  ))}
                  {avatars.length > 3 ? <span className="av more">+{avatars.length - 3}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
          <span className="spacer" />
          <div className="pill actions-pill">
            <button className="top-btn undo-top" disabled={!pk.undo} data-tip={pk.undo ? `Undo: ${pk.undo.label}` : "Nothing to undo"} data-tip-side="bottom" aria-label="Undo" onClick={hist.undo}>
              <Icon n="undo" />
            </button>
            <button className="top-btn undo-top" disabled={!pk.redo} data-tip={pk.redo ? `Redo: ${pk.redo.label}` : "Nothing to redo"} data-tip-side="bottom" aria-label="Redo" onClick={hist.redo}>
              <Icon n="redo" />
            </button>
            <button className={`top-btn${panel === "share" ? " on" : ""}`} aria-label="Share" data-tip="Share" data-tip-side="bottom" onClick={() => togglePanel("share")}>
              <Icon n="users" />
            </button>
            <button className={`top-btn${panel === "history" ? " on" : ""}`} aria-label="History" data-tip="History" data-tip-side="bottom" onClick={() => togglePanel("history")}>
              <Icon n="clock" />
            </button>
            <button className={`top-btn${panel === "checks" ? " on" : ""}`} aria-label={`Checks, ${problems ? plural(problems, "problem") : "no problems"}`} data-tip="Checks" data-tip-side="bottom" onClick={() => togglePanel("checks")}>
              <Icon n="shield" />
              <span className={`count ${problems ? `lv-${worst}` : checks.list.length ? "lv-tip" : "ok"}`}>{problems || (checks.list.length ? checks.list.length : "✓")}</span>
            </button>
          </div>
          <div className="summary" aria-label="Monthly summary">
            <div className="sum-item">
              <span className="eyebrow">Coming in</span>
              <span className="sum-fig pos">{fmt.signed(flows.coming)}</span>
            </div>
            <div className="sum-item">
              <span className="eyebrow">Going out</span>
              <span className="sum-fig neg">{fmt.signed(flows.going)}</span>
            </div>
            <div className="sum-item net">
              <span className="eyebrow">
                Left over / mo
                <Info label="Left over" text={`Coming in minus going out, per month. Money moved into goals still counts as left over. You’re saving ${flows.coming > 0 ? Math.round((flows.goalIn / flows.coming) * 100) : 0}% of income into goals, against a target of ${settings.savingsTarget}%.`} />
              </span>
              <span className={`sum-fig ${tone(flows.net)}`}>{fmt.signed(flows.net)}</span>
            </div>
          </div>
        </div>

        <nav className={`rail${prefs.railOpen ? " open" : ""}`} aria-label="Tools and menu">
          <button className="tool rail-toggle" aria-expanded={prefs.railOpen} aria-label={prefs.railOpen ? "Hide labels" : "Show labels"} data-tip={railTip("Show labels")} data-tip-side="right" onClick={() => setPrefs({ railOpen: !prefs.railOpen })}>
            <Icon n={prefs.railOpen ? "panelClose" : "panelOpen"} />
            <span className="lbl">Hide labels</span>
          </button>
          <div className="rail-sep" />
          <span className="rail-h">Tools</span>
          <button className={`tool${tool === "select" ? " on" : ""}`} data-tip={railTip("Select (V)")} data-tip-side="right" aria-label="Select" aria-pressed={tool === "select"} onClick={() => setTool("select")}>
            <Icon n="cursor" />
            <span className="lbl">Select</span>
            <kbd className="lbl">V</kbd>
          </button>
          <button className={`tool${tool === "hand" ? " on" : ""}`} data-tip={railTip("Pan (H or hold Space)")} data-tip-side="right" aria-label="Pan" aria-pressed={tool === "hand"} onClick={() => setTool("hand")}>
            <Icon n="hand" />
            <span className="lbl">Pan</span>
            <kbd className="lbl">H</kbd>
          </button>
          {canEdit ? (
            <>
              <div className="rail-sep" />
              <span className="rail-h">Add a card</span>
              {PALETTE.map((k) => (
                <button
                  key={k}
                  className="tool"
                  data-tip={railTip(`Add ${KINDS[k].label.toLowerCase()} (drag or click)`)}
                  data-tip-side="right"
                  aria-label={`Add ${KINDS[k].label}`}
                  onPointerDown={(e) => paletteDown(k, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      addCardCenter(k);
                    }
                  }}
                >
                  <span className={`pal pal-${k}`}>
                    <Icon n={k} s={18} />
                  </span>
                  <span className="lbl">{KINDS[k].label}</span>
                </button>
              ))}
              <div className="rail-sep" />
              <span className="rail-h">Board</span>
              <button className={`tool${panel === "templates" ? " on" : ""}`} data-tip={railTip("Templates")} data-tip-side="right" aria-label="Templates" onClick={() => togglePanel("templates")}>
                <Icon n="grid" />
                <span className="lbl">Templates</span>
              </button>
              <button className={`tool${panel === "import" ? " on" : ""}`} data-tip={railTip("Import a bank statement")} data-tip-side="right" aria-label="Import a bank statement" onClick={() => togglePanel("import")}>
                <Icon n="importIcon" />
                <span className="lbl">Import a statement</span>
              </button>
              <button className="tool" data-tip={railTip("Arrange cards by flow")} data-tip-side="right" aria-label="Arrange cards by flow" onClick={arrange}>
                <Icon n="arrange" />
                <span className="lbl">Arrange by flow</span>
              </button>
              {store.mode === "cloud" ? (
                <button className="tool upload" data-tip={railTip("Upload files")} data-tip-side="right" aria-label="Upload files" onClick={() => fileRef.current?.click()}>
                  <Icon n="upload" />
                  <span className="lbl">Upload files</span>
                </button>
              ) : null}
            </>
          ) : null}
          <div className="rail-sep" />
          <button className={`tool${panel === "settings" ? " on" : ""}`} data-tip={railTip("Settings")} data-tip-side="right" aria-label="Settings" onClick={() => togglePanel("settings")}>
            <Icon n="sliders" />
            <span className="lbl">Settings</span>
          </button>
        </nav>

        <div className="zoombar">
          <button className="tool" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.2)}>
            <Icon n="minus" />
          </button>
          <button className="zoom-pct" aria-label="Fit to content" data-tip="Fit to content (0)" onClick={() => fit()}>
            {Math.round(view.k * 100)}%
          </button>
          <button className="tool" aria-label="Zoom in" onClick={() => zoomAt(1.2)}>
            <Icon n="plus" />
          </button>
        </div>

        <div className="dock">
          <button className="tool" aria-label="Undo" disabled={!pk.undo} onClick={hist.undo}>
            <Icon n="undo" />
          </button>
          {canEdit ? (
            <button className="cta" onClick={() => setPanel("add")}>
              <Icon n="plus" s={22} />
              Add card
            </button>
          ) : (
            <span className="muted" style={{ flex: 1, textAlign: "center" }}>
              View only
            </span>
          )}
          <button className={`tool${tool === "hand" ? " on" : ""}`} aria-label="Pan mode" aria-pressed={tool === "hand"} onClick={() => setTool(tool === "hand" ? "select" : "hand")}>
            <Icon n="hand" />
          </button>
          <button className="tool" aria-label="Fit to content" onClick={() => fit()}>
            <Icon n="fit" />
          </button>
        </div>

        {panel === "add" ? (
          <Panel title="Add a card" sub="Link cards together to see where your money goes each month." onClose={closePanel}>
            <div className="sheet-grid">
              {PALETTE.map((k) => (
                <button
                  key={k}
                  className="pal-item"
                  onClick={() => {
                    addCardCenter(k);
                    setPanel(null);
                  }}
                >
                  <span className={`pal pal-${k}`}>
                    <Icon n={k} />
                  </span>
                  <b>{KINDS[k].label}</b>
                  <span>{KINDS[k].desc}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-sm" onClick={() => setPanel("import")}>
                <Icon n="importIcon" s={16} />
                Import a statement
              </button>
              <button className="btn-sm" onClick={() => setPanel("templates")}>
                <Icon n="grid" s={16} />
                Browse templates
              </button>
              {store.mode === "cloud" ? (
                <button
                  className="btn-sm"
                  onClick={() => {
                    setPanel(null);
                    fileRef.current?.click();
                  }}
                >
                  <Icon n="upload" s={16} />
                  Upload a file
                </button>
              ) : null}
            </div>
          </Panel>
        ) : null}
        {panel === "checks" ? <ChecksPanel checks={checks} cards={cards} onClose={closePanel} onShow={focusCard} onFix={applyFix} /> : null}
        {panel === "templates" ? <TemplatesPanel onClose={closePanel} onAdd={addTemplate} onImport={() => setPanel("import")} /> : null}
        {panel === "settings" ? <SettingsPanel settings={settings} cards={cards} canEdit={canEdit} onSettings={ops.setSettings} onClose={closePanel} onArrange={arrange} onClear={clearPlan} planName={planName} focusA11y={a11yFocus} /> : null}
        {panel === "history" ? (
          <HistoryPanel entries={entries} onClose={closePanel} undoLabel={pk.undo?.label} canRedo={Boolean(pk.redo)} onUndo={hist.undo} onRedo={hist.redo} nameOf={(id) => (id ? names[id] ?? "" : "")} meId={me?.id ?? null} planNames={planNames} />
        ) : null}
        {panel === "compare" && planId ? <ComparePanel onClose={closePanel} store={store} planId={planId} cards={cards} links={links} settings={settings} plans={plans} onSwitch={switchPlan} /> : null}
        {panel === "import" ? <ImportPanel onClose={closePanel} onAdd={addImport} preload={importPreload} /> : null}
        {panel === "share" ? <SharePanel store={store} boardId={boardId} boardName={title} role={meta?.role ?? "viewer"} onClose={closePanel} /> : null}
        {drawer ? <BoardsDrawer store={store} boardId={boardId} boardName={title} settings={settings} plans={plans} planId={planId} onOpenPlan={switchPlan} onClose={closeDrawer} onNav={onNav} /> : null}

        {empty && !panel && canEdit ? (
          <div className="empty">
            <span className="eyebrow">{plan?.isMain === false ? "Empty plan" : "New board"}</span>
            <h1>Map where your money goes.</h1>
            <p>Add income, bills and spending as cards, then link them into your accounts. Totals update as you edit, for everyone on the board.</p>
            <div className="actions">
              <button className="cta" onClick={() => setPanel("templates")}>
                <Icon n="grid" s={22} />
                Choose a template
              </button>
              <button className="btn2" onClick={() => setPanel("import")}>
                <Icon n="importIcon" />
                Import a statement
              </button>
            </div>
          </div>
        ) : null}
        {!ready ? (
          <div className="loading" role="status">
            Loading your board…
          </div>
        ) : null}
        {connectFrom && cards[connectFrom] ? (
          <div className="banner" role="status">
            Tap a card to send {cardName(cards[connectFrom])} there
            <button onClick={() => setConnectFrom(null)}>Cancel</button>
          </div>
        ) : null}
        {dropOver ? (
          <div className="dropzone">
            <Icon n="upload" s={32} />
            {store.mode === "cloud" ? "Drop to place on the board" : "Sign in to upload files"}
          </div>
        ) : null}
        {ghost ? (
          <div className="ghost" style={{ left: ghost.x, top: ghost.y }}>
            <span className={`pal pal-${ghost.kind}`}>
              <Icon n={ghost.kind} s={16} />
            </span>
            {KINDS[ghost.kind].label}
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept=".csv,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json"
          onChange={(e) => {
            uploadFiles(e.target.files, centerWorld());
            e.target.value = "";
          }}
        />
        <div className="sr" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </MoneyProvider>
  );
}
