"use client";

import { Fragment, useEffect, useState } from "react";
import { monthLabel, planMetrics, plural, tone, type BoardSettings, type CardMap, type LinkMap, type PlanMetrics } from "@/lib/engine";
import type { PlanInfo, Store } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { useMoney } from "@/components/ui/prefs";

export function ComparePanel({ onClose, store, planId, cards, links, settings, plans, onSwitch }: { onClose: () => void; store: Store; planId: string; cards: CardMap; links: LinkMap; settings: BoardSettings; plans: PlanInfo[]; onSwitch: (id: string) => void }) {
  const fmt = useMoney();
  const [data, setData] = useState<(PlanInfo & { m: PlanMetrics })[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const shown = plans.slice(0, 4);
  const key = shown.map((p) => p.id).join();
  const [tick, setTick] = useState(0);
  const load = () => {
    setErr(null);
    setTick((n) => n + 1);
  };
  useEffect(() => {
    let alive = true;
    Promise.all(shown.map((p) => (p.id === planId ? Promise.resolve({ cards, links }) : store.loadPlan(p.id)).then((d) => ({ ...p, m: planMetrics(d.cards, d.links, settings) }))))
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr("The plans couldn’t be loaded. Try again."));
    return () => {
      alive = false;
    };
    // `shown` is rebuilt every render; `key` holds its ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, cards, links, settings, key, store, tick]);

  if (plans.length < 2) {
    return (
      <Panel title="Compare plans" onClose={onClose}>
        <p className="muted">You only have one plan. Create a new plan from the menu next to the board name, change it, then compare it here.</p>
      </Panel>
    );
  }
  const base = data?.[0];
  const cell = (id: string) => (id === planId ? "cur" : "");
  const moneyRow = (label: string, get: (m: PlanMetrics) => number | null, signed = true) => (
    <tr>
      <td>{label}</td>
      {data!.map((s, i) => {
        const v = get(s.m);
        const b = base ? get(base.m) : null;
        return (
          <td key={s.id} className={cell(s.id)}>
            {v == null ? "—" : signed ? fmt.signed(v) : fmt.money(v)}
            {i > 0 && v != null && b != null && Math.round(v - b) !== 0 ? <span className={`d ${tone(v - b)}`}>{fmt.signed(v - b)} vs first</span> : null}
          </td>
        );
      })}
    </tr>
  );
  const monthsRow = (label: string, get: (m: PlanMetrics) => number | null | undefined) => (
    <tr>
      <td>{label}</td>
      {data!.map((s, i) => {
        const v = get(s.m);
        const b = base ? get(base.m) : undefined;
        const txt = v === undefined ? "—" : v === null ? "Never" : v === 0 ? "Done" : monthLabel(v);
        const diff = i > 0 && v != null && b != null ? v - b : 0;
        return (
          <td key={s.id} className={cell(s.id)}>
            {txt}
            {diff ? <span className={`d ${diff < 0 ? "pos" : "neg"}`}>{diff < 0 ? `${plural(-diff, "month")} sooner` : `${plural(diff, "month")} later`}</span> : null}
          </td>
        );
      })}
    </tr>
  );
  const keys = (k: "accounts" | "goals" | "debts") => (data ? [...new Set(data.flatMap((s) => Object.keys(s.m[k])))] : []);
  return (
    <Panel wide title="Compare plans" sub={`Monthly figures and projections at ${settings.horizon} months. Differences are against the first column.`} onClose={onClose}>
      {err ? (
        <div className="warn">
          <Icon n="alert" s={18} />
          {err}
          <button className="btn-sm" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}
      {!data && !err ? <p className="muted">Loading plans…</p> : null}
      {data ? (
        <>
          <div className="cmp-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th>Plan</th>
                  {data.map((s) => (
                    <th key={s.id} className={cell(s.id)}>
                      {s.name}
                      <br />
                      {s.id === planId ? (
                        <span className="eyebrow">Showing</span>
                      ) : (
                        <button className="btn-sm" onClick={() => onSwitch(s.id)}>
                          Open
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="sec">
                  <td colSpan={data.length + 1}>Each month</td>
                </tr>
                {moneyRow("Coming in", (m) => m.coming)}
                {moneyRow("Going out", (m) => m.going)}
                {moneyRow("Left over", (m) => m.net)}
                <tr>
                  <td>Saving into goals</td>
                  {data.map((s) => (
                    <td key={s.id} className={cell(s.id)}>
                      {s.m.savingsRate}%
                    </td>
                  ))}
                </tr>
                {keys("accounts").length ? (
                  <tr className="sec">
                    <td colSpan={data.length + 1}>Accounts in {settings.horizon} months</td>
                  </tr>
                ) : null}
                {keys("accounts").map((k) => (
                  <Fragment key={`a${k}`}>{moneyRow(k, (m) => m.accounts[k] ?? null, false)}</Fragment>
                ))}
                {keys("goals").length ? (
                  <tr className="sec">
                    <td colSpan={data.length + 1}>Goals reached</td>
                  </tr>
                ) : null}
                {keys("goals").map((k) => (
                  <Fragment key={`g${k}`}>{monthsRow(k, (m) => (k in m.goals ? m.goals[k] : undefined))}</Fragment>
                ))}
                {keys("debts").length ? (
                  <tr className="sec">
                    <td colSpan={data.length + 1}>Debts paid off</td>
                  </tr>
                ) : null}
                {keys("debts").map((k) => (
                  <Fragment key={`d${k}`}>{monthsRow(k, (m) => (k in m.debts ? m.debts[k] : undefined))}</Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {plans.length > 4 ? <p className="muted">Showing the first 4 of {plans.length} plans.</p> : null}
          <button className="btn-sm" style={{ alignSelf: "flex-start" }} onClick={load}>
            Refresh
          </button>
        </>
      ) : null}
    </Panel>
  );
}
