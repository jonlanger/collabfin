"use client";

import { memo, useState } from "react";
import { TIPS } from "@/lib/copy";
import { accountTypeOf, KINDS, kindLabel, plural, portsFor, type BoardSettings, type Card as CardT, type CardMap, type Flows, type Level } from "@/lib/engine";
import { Icon } from "@/components/ui/Icon";
import { TextInput } from "@/components/ui/inputs";
import { Info } from "@/components/ui/tips";
import { CardBody } from "./bodies";

const LV_ICON = { error: "alert", warn: "alert", tip: "bulb" } as const;

export interface CardProps {
  c: CardT;
  cards: CardMap;
  x: number;
  y: number;
  flows: Flows;
  settings: BoardSettings;
  selected: boolean;
  hot: boolean;
  lifted: boolean;
  badge?: { count: number; level: Level };
  editor?: { name: string; color: number };
  onBadge: (id: string) => void;
  onPatch: (id: string, patch: Partial<CardT>) => void;
  onImport: (c: CardT) => void;
  fileUrl: (path: string) => Promise<string | null>;
}

function NoteText({ c, onPatch }: { c: CardT; onPatch: CardProps["onPatch"] }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <textarea
      className="note-text"
      aria-label="Note"
      maxLength={2000}
      placeholder="Write a note for the team"
      value={draft ?? c.text ?? ""}
      onFocus={() => setDraft(c.text ?? "")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null && draft !== (c.text ?? "")) onPatch(c.id, { text: draft.slice(0, 2000) });
        setDraft(null);
      }}
    />
  );
}

function CardView(p: CardProps) {
  const { c } = p;
  const K = KINDS[c.kind];
  if (!K) return null;
  const ports = portsFor(c);
  const up = (patch: Partial<CardT>) => p.onPatch(c.id, patch);
  const tip = c.kind === "account" && accountTypeOf(c) !== "checking" ? TIPS[accountTypeOf(c) as "savings" | "cd" | "investment"] : TIPS[c.kind];
  const cls = ["card", `k-${c.kind}`, p.selected && "sel", p.hot && "hot", p.lifted && "lifted", p.badge?.level === "error" && "has-error", p.editor && "peer-edit", p.editor && `f${p.editor.color}`].filter(Boolean).join(" ");
  return (
    <div className={cls} data-card={c.id} style={{ left: p.x, top: p.y, width: K.w }}>
      {p.editor ? <span className={`edit-tag p${p.editor.color}`}>{p.editor.name} is editing</span> : null}
      {ports.inPort ? <div className="port in" aria-hidden="true" /> : null}
      {ports.outPort ? <div className="port out" data-port="out" data-card={c.id} title="Drag to link" aria-hidden="true" /> : null}
      {c.kind === "note" ? (
        <>
          <div className="note-grip" />
          <NoteText c={c} onPatch={p.onPatch} />
        </>
      ) : (
        <>
          <div className="card-head">
            <span className="kind">
              <Icon n={c.kind} />
            </span>
            <div className="head-text">
              <span className="eyebrow">{kindLabel(c)}</span>
              {c.kind === "file" ? (
                <span className="title-input" style={{ cursor: "grab" }}>
                  {c.name}
                </span>
              ) : (
                <TextInput className="title-input" required label={`${K.label} name`} value={c.title} onCommit={(v) => up({ title: v })} />
              )}
            </div>
            {p.badge ? (
              <button className={`chk lv-${p.badge.level}`} aria-label={`${plural(p.badge.count, "check")} on this card`} onClick={() => p.onBadge(c.id)}>
                <Icon n={LV_ICON[p.badge.level]} s={14} w={2} />
                {p.badge.count}
              </button>
            ) : null}
            <Info label={kindLabel(c)} text={tip} />
          </div>
          <CardBody c={c} cards={p.cards} flows={p.flows} settings={p.settings} up={up} onImport={p.onImport} fileUrl={p.fileUrl} />
        </>
      )}
    </div>
  );
}

export const Card = memo(CardView);
