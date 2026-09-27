"use client";

import { useMemo } from "react";
import { computeFlows, KINDS, materialize, TEMPLATES, tone, type Template } from "@/lib/engine";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { useMoney } from "@/components/ui/prefs";

export function TemplatesPanel({ onClose, onAdd, onImport }: { onClose: () => void; onAdd: (t: Template) => void; onImport: () => void }) {
  const fmt = useMoney();
  const previews = useMemo(
    () =>
      TEMPLATES.map((t) => {
        const b = materialize(t);
        const cards = Object.fromEntries(b.cards.map((c) => [c.id, c]));
        const links = Object.fromEntries(b.links.map((l) => [l.id, l]));
        return { kinds: b.cards.map((c) => c.kind), net: computeFlows(cards, links).net };
      }),
    [],
  );
  return (
    <Panel title="Templates" sub="Starter plans you can edit. They are added next to your cards, and nothing is replaced." onClose={onClose}>
      <div className="import-cta">
        <Icon n="importIcon" s={28} />
        <div>
          <b>Start from your bank statement</b>
          Turn a CSV export into income, bills and spending cards.
        </div>
        <button className="btn-sm primary" onClick={onImport}>
          Import
        </button>
      </div>
      {TEMPLATES.map((t, i) => (
        <article key={t.id} className="tpl">
          <h3>{t.name}</h3>
          <p>{t.desc}</p>
          <div className="tpl-meta">
            <div className="chips" aria-label={`${previews[i].kinds.length} cards`}>
              {previews[i].kinds.map((k, n) => (
                <span key={n} className={`pal pal-${k}`} title={KINDS[k].label}>
                  <Icon n={k} s={14} />
                </span>
              ))}
            </div>
            <div className="tpl-net">
              <span className="eyebrow">Left over / mo</span>
              <b className={tone(previews[i].net)}>{fmt.signed(previews[i].net)}</b>
            </div>
          </div>
          <button className="btn-sm primary" style={{ alignSelf: "flex-start" }} onClick={() => onAdd(t)}>
            <Icon n="plus" s={16} />
            Add to board
          </button>
        </article>
      ))}
    </Panel>
  );
}
