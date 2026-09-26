"use client";

import type { CardMap, Checks, Fix, Level } from "@/lib/engine";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";

const LV_ICON = { error: "alert", warn: "alert", tip: "bulb" } as const;
const GROUPS: [Level, string][] = [
  ["error", "Needs fixing"],
  ["warn", "Worth a look"],
  ["tip", "Best practice"],
];

export function ChecksPanel({ checks, cards, onClose, onShow, onFix }: { checks: Checks; cards: CardMap; onClose: () => void; onShow: (id: string) => void; onFix: (f: Fix) => void }) {
  return (
    <Panel title="Checks" sub="Problems with your numbers and tips from common budgeting practice. Updated as you edit." onClose={onClose}>
      {!checks.list.length ? (
        <div className="all-good">
          <Icon n="check" s={28} w={2.25} />
          <b>Everything checks out.</b>
          <span>No problems found in your cards or links.</span>
        </div>
      ) : null}
      {GROUPS.map(([lv, label]) => {
        const rows = checks.list.filter((x) => x.level === lv);
        if (!rows.length) return null;
        return (
          <section key={lv} className="group">
            <div className="eyebrow">
              {label} · {rows.length}
            </div>
            {rows.map((x) => (
              <div key={x.key} className={`check lv-${lv}`}>
                <span className="lv-ico">
                  <Icon n={LV_ICON[lv]} s={16} w={2} />
                </span>
                <p>{x.text}</p>
                {(x.cardId && cards[x.cardId]) || x.fix ? (
                  <div className="check-actions">
                    {x.cardId && cards[x.cardId] ? (
                      <button className="btn-sm" onClick={() => onShow(x.cardId!)}>
                        <Icon n="eye" s={16} />
                        Show card
                      </button>
                    ) : null}
                    {x.fix ? (
                      <button className="btn-sm primary" onClick={() => onFix(x.fix!)}>
                        {x.fix.label}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        );
      })}
    </Panel>
  );
}
