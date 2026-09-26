"use client";

import type { ActivityEntry } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { ago, colorFor, initials } from "../people";

export function HistoryPanel({
  entries,
  onClose,
  undoLabel,
  canRedo,
  onUndo,
  onRedo,
  nameOf,
  meId,
  planNames,
}: {
  entries: ActivityEntry[];
  onClose: () => void;
  undoLabel?: string;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  nameOf: (id: string | null) => string;
  meId: string | null;
  planNames: Record<string, string>;
}) {
  return (
    <Panel title="History" sub="Changes made on this board, newest first." onClose={onClose}>
      <section className="group">
        <div className="eyebrow">Your changes</div>
        <div className="undo-box">
          <button className="btn-sm" disabled={!undoLabel} onClick={onUndo}>
            <Icon n="undo" s={16} />
            {undoLabel ? `Undo: ${undoLabel.slice(0, 36)}` : "Nothing to undo"}
          </button>
          {canRedo ? (
            <button className="btn-sm" onClick={onRedo}>
              <Icon n="redo" s={16} />
              Redo
            </button>
          ) : null}
        </div>
        <p className="muted">Undo reverses your own changes in this session, newest first. It won’t undo other people’s changes.</p>
      </section>
      <section className="group">
        <div className="eyebrow">Everyone’s changes</div>
        {!entries.length ? <p className="muted">No changes yet. Edits, links, imports and templates show up here.</p> : null}
        <div>
          {entries.map((e) => {
            const who = e.userId && e.userId === meId ? "You" : nameOf(e.userId) || "Someone";
            return (
              <div key={e.id} className="hist-row">
                <span className={`av p${colorFor(e.userId ?? "x")}`}>{initials(who)}</span>
                <div>
                  <div className="hist-text">
                    <b>{who}</b> · {e.text}
                  </div>
                  <div className="hist-meta">
                    {ago(e.at)}
                    {e.planId && planNames[e.planId] ? <span className="scen-tag">{planNames[e.planId]}</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Panel>
  );
}
