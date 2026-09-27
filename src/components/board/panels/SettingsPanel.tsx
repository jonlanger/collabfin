"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ACCOUNT_TYPES, accountTypeOf, CURRENCIES, FILING, plural, STATE_CODES, STATES, TAX_SOURCES, TAX_YEAR, type AutomationSettings, type BoardSettings, type CardMap, type Filing } from "@/lib/engine";
import { FIELD_TIPS } from "@/lib/copy";
import { Icon } from "@/components/ui/Icon";
import { NumberInput, Segmented, Switch } from "@/components/ui/inputs";
import { Panel } from "@/components/ui/Panel";
import { A11Y_RESET, usePrefs } from "@/components/ui/prefs";
import { Select } from "@/components/ui/Select";
import { Info } from "@/components/ui/tips";

function Row({ label, sub, tip, children }: { label: string; sub?: string; tip?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-label">
        <span>
          {label}
          {sub ? <small>{sub}</small> : null}
        </span>
        {tip ? <Info label={label} text={tip} /> : null}
      </div>
      {children}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Arrow keys", "Move around the board (hold Shift to go faster)"],
  ["+ and −", "Zoom in and out"],
  ["0", "Fit the whole board on screen"],
  ["V / H", "Select tool / pan tool (or hold Space)"],
  ["Tab", "Move between cards and fields. Focusing a card selects it."],
  ["Link to…", "Connect the selected card without dragging, then pick the card to send money to"],
  ["Ctrl or ⌘ + Z", "Undo (add Shift to redo)"],
  ["Ctrl or ⌘ + D", "Duplicate the selected card"],
  ["Delete", "Remove the selected card or link"],
  ["Esc", "Deselect, cancel linking, close a menu or panel"],
  ["?", "Open these settings"],
];

export function SettingsPanel({
  settings: s,
  cards,
  canEdit,
  onSettings,
  onClose,
  onArrange,
  onClear,
  planName,
  focusA11y,
}: {
  settings: BoardSettings;
  cards: CardMap;
  canEdit: boolean;
  onSettings: (patch: Partial<BoardSettings>) => void;
  onClose: () => void;
  onArrange: () => void;
  onClear: () => void;
  planName: string;
  focusA11y: number;
}) {
  const { prefs, setPrefs } = usePrefs();
  const [confirm, setConfirm] = useState(false);
  const accounts = Object.values(cards).filter((c) => c.kind === "account");
  const count = Object.keys(cards).length;
  const setAuto = (k: keyof AutomationSettings, v: boolean) => onSettings({ auto: { ...s.auto, [k]: v } });
  useEffect(() => {
    if (!focusA11y) return;
    const el = document.getElementById("a11y-settings");
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
      el.querySelector("button")?.focus({ preventScroll: true });
    });
  }, [focusA11y]);

  const autos: [keyof AutomationSettings, ReactNode, string][] = [
    ["linkOutflows", <><b>When you add a Spend, Recurring or Debt card,</b> link it to the main account.</>, "Link new spending, bills and debts to the main account"],
    ["linkIncome", <><b>When you add an Income card,</b> link it to the main account.</>, "Link new income to the main account"],
    ["payYourselfFirst", <><b>When you add an Income card,</b> also send {s.savingsTarget}% to your first savings goal through a Split.</>, "Pay yourself first from new income"],
    ["notifyChecks", <><b>When a change causes a new problem,</b> tell me right away.</>, "Tell me about new problems"],
    ["goalAlert", <><b>When a goal’s saved amount reaches its target,</b> tell everyone on the board.</>, "Celebrate reached goals"],
  ];
  return (
    <Panel title="Settings" sub="Board settings apply to everyone and every plan on this board. Display and Accessibility are just for you." onClose={onClose}>
      {!canEdit ? <p className="muted">You can view this board, so its settings are read-only for you.</p> : null}
      <section className="group">
        <div className="eyebrow">Money</div>
        <Row label="Currency" tip="Changes how amounts are shown. It doesn’t convert them.">
          <span className="set-control">
            <Select label="Currency" value={s.currency} searchable={false} disabled={!canEdit} options={Object.entries(CURRENCIES).map(([k, v]) => ({ value: k, label: `${k} · ${v}` }))} onChange={(v) => onSettings({ currency: v })} />
          </span>
        </Row>
        <Row label="Default projection" tip={`${FIELD_TIPS.horizon} New Account cards and plan comparisons use this.`}>
          <span className="set-control">
            <Select label="Default projection" value={s.horizon} searchable={false} disabled={!canEdit} options={[3, 6, 12, 24].map((m) => ({ value: m, label: `${m} months` }))} onChange={(v) => onSettings({ horizon: v })} />
          </span>
        </Row>
      </section>
      <section className="group">
        <div className="eyebrow">Taxes</div>
        <Row label="Home state" tip="New Taxes cards and the salary template start with this state.">
          <span className="set-control wide">
            <Select label="Home state" placeholder="Not set" value={s.state} disabled={!canEdit} options={[{ value: "", label: "Not set" }, ...STATE_CODES.map((k) => ({ value: k, label: STATES[k].name }))]} onChange={(v) => onSettings({ state: v })} />
          </span>
        </Row>
        <Row label="Filing status" tip="Sets the federal and state brackets on new Taxes cards. Head of household uses single brackets for state tax.">
          <span className="set-control wide">
            <Select label="Filing status" value={s.filing} searchable={false} disabled={!canEdit} options={(Object.keys(FILING) as Filing[]).map((k) => ({ value: k, label: FILING[k] }))} onChange={(v) => onSettings({ filing: v })} />
          </span>
        </Row>
        <p className="muted">
          Rates are for {TAX_YEAR}. Federal brackets and deductions come from the{" "}
          <a href={TAX_SOURCES.federal} target="_blank" rel="noopener noreferrer">
            IRS
          </a>
          . State income, sales and property rates come from the{" "}
          <a href={TAX_SOURCES.stateIncome} target="_blank" rel="noopener noreferrer">
            Tax Foundation
          </a>
          . Estimates only, not tax advice.
        </p>
      </section>
      <section className="group">
        <div className="eyebrow">Budget rules</div>
        <Row label="Savings target" sub="Share of income into goals" tip="Many planners suggest saving at least 20% of take-home pay. Start lower and raise it each time your income goes up.">
          <span className="set-control">
            <NumberInput suffix="%" rule="settingPct" label="Savings target" value={s.savingsTarget} disabled={!canEdit} onCommit={(v) => onSettings({ savingsTarget: v })} />
          </span>
        </Row>
        <Row label="Fixed bills limit" sub="Bills and debt payments, as a share of income" tip="Keeping fixed bills and debt payments under about half of take-home pay leaves room for savings and surprises.">
          <span className="set-control">
            <NumberInput suffix="%" rule="settingPct" label="Fixed bills limit" value={s.billsCap} disabled={!canEdit} onCommit={(v) => onSettings({ billsCap: v })} />
          </span>
        </Row>
        <Row label="Cash buffer" sub="Warn when an account drops below" tip="A buffer of about one month of expenses in checking covers timing gaps between paydays and bills.">
          <span className="set-control">
            <NumberInput rule="buffer" label="Cash buffer" value={s.buffer} disabled={!canEdit} onCommit={(v) => onSettings({ buffer: v })} />
          </span>
        </Row>
        <Row label="Yearly price increase" sub="Applied to money going out in projections" tip="Rent, insurance and subscriptions tend to go up every year. 3% is a common planning figure.">
          <span className="set-control">
            <NumberInput suffix="%" rule="inflation" label="Yearly price increase" value={s.inflation} disabled={!canEdit} onCommit={(v) => onSettings({ inflation: v })} />
          </span>
        </Row>
      </section>
      <section className="group">
        <div className="eyebrow">
          <Icon n="zap" s={14} />
          Automations
        </div>
        <Row label="Main account" tip="Where automations link new cards. Leave it on the first account to use whichever account is furthest left.">
          <span className="set-control wide">
            <Select
              label="Main account"
              disabled={!canEdit}
              value={s.primaryAccount && cards[s.primaryAccount] ? s.primaryAccount : ""}
              options={[{ value: "", label: "First account on the board" }, ...accounts.map((a) => ({ value: a.id, label: a.title || "Account", hint: ACCOUNT_TYPES[accountTypeOf(a)] }))]}
              onChange={(v) => onSettings({ primaryAccount: v })}
            />
          </span>
        </Row>
        <div>
          {autos.map(([k, text, name]) => (
            <div key={k} className="auto">
              <div className="auto-text">{text}</div>
              <Switch on={s.auto[k]} label={name} onChange={(v) => canEdit && setAuto(k, v)} />
            </div>
          ))}
        </div>
        <button className="btn-sm" style={{ alignSelf: "flex-start" }} onClick={onArrange}>
          <Icon n="arrange" s={16} />
          Arrange cards by flow
        </button>
      </section>
      <section className="group">
        <div className="eyebrow">Display, just for you</div>
        <Row label="Info tips" sub="Show the (i) icons">
          <Switch on={prefs.showTips} label="Show info tips" onChange={(v) => setPrefs({ showTips: v })} />
        </Row>
        <Row label="Amounts on links" sub="Show what flows along each link">
          <Switch on={prefs.showAmounts} label="Show amounts on links" onChange={(v) => setPrefs({ showAmounts: v })} />
        </Row>
      </section>
      <section className="group" id="a11y-settings">
        <div className="eyebrow">Accessibility, just for you</div>
        <Row label="Theme" tip="System follows your device. Light or Dark overrides it in this browser.">
          <span className="set-control">
            <Select label="Theme" value={prefs.theme} searchable={false} options={[{ value: "system", label: "Match system" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(v) => setPrefs({ theme: v as typeof prefs.theme })} />
          </span>
        </Row>
        <Row label="Text size" sub="Toolbars, panels and menus" tip="Makes the text around the board bigger. To enlarge the cards themselves, zoom the canvas with + or pinch.">
          <Segmented className="set-control" label="Text size" value={prefs.textSize} onChange={(v) => setPrefs({ textSize: v })} options={[[100, "100%"], [115, "115%"], [130, "130%"]]} />
        </Row>
        <Row label="High contrast" sub="Darker text and stronger borders" tip="Raises text to at least 7:1 contrast against its background and makes borders and controls stand out more, in light and dark.">
          <Switch on={prefs.contrast} label="High contrast" onChange={(v) => setPrefs({ contrast: v })} />
        </Row>
        <Row label="Colour-blind-safe colours" sub="Gains in blue, losses in orange" tip="Replaces green and red, which many people can’t tell apart, with blue and orange. Gains and losses always keep their + and − signs and arrows too.">
          <Switch on={prefs.cbSafe} label="Colour-blind-safe colours" onChange={(v) => setPrefs({ cbSafe: v })} />
        </Row>
        <Row label="Reduce motion" sub="Turn off animations and slides" tip="Stops menus, progress bars and cursors from animating. If your device is set to reduce motion, that is always respected too.">
          <Switch on={prefs.reduceMotion} label="Reduce motion" onChange={(v) => setPrefs({ reduceMotion: v })} />
        </Row>
        <Row label="Extra text spacing" sub="More room between letters, words and lines" tip="Adds letter, word and line spacing, which many people with dyslexia find easier to read.">
          <Switch on={prefs.spacing} label="Extra text spacing" onChange={(v) => setPrefs({ spacing: v })} />
        </Row>
        <Row label="Stronger focus outline" sub="A thicker ring on the focused control" tip="Makes it easier to see where you are when moving through the board with the keyboard.">
          <Switch on={prefs.focusStrong} label="Stronger focus outline" onChange={(v) => setPrefs({ focusStrong: v })} />
        </Row>
        <Row label="Hide other people’s cursors" sub="Less movement on the board" tip="Other people still see yours, and the card they are editing is still outlined.">
          <Switch on={prefs.hideCursors} label="Hide other people’s cursors" onChange={(v) => setPrefs({ hideCursors: v })} />
        </Row>
        <Row label="Announce changes" sub="For screen readers" tip="Reads out the new monthly left-over figure and the number of problems when they change, including changes other people make.">
          <Switch on={prefs.announce} label="Announce changes" onChange={(v) => setPrefs({ announce: v })} />
        </Row>
        <div className="group">
          <div className="eyebrow">Keyboard shortcuts</div>
          <dl className="keys">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="key-row">
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <button className="btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setPrefs(A11Y_RESET)}>
          Reset accessibility settings
        </button>
      </section>
      {canEdit ? (
        <section className="group">
          <div className="eyebrow">This plan</div>
          {!confirm ? (
            <button className="btn-sm" style={{ alignSelf: "flex-start" }} disabled={!count} onClick={() => setConfirm(true)}>
              <Icon n="trash" s={16} />
              Clear “{planName}”
            </button>
          ) : (
            <div className="confirm" role="alert">
              <p>
                Delete all {plural(count, "card")} in “{planName}” for everyone? You can undo this.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-sm danger"
                  onClick={() => {
                    onClear();
                    setConfirm(false);
                  }}
                >
                  Delete the cards
                </button>
                <button className="btn-sm" onClick={() => setConfirm(false)}>
                  Keep them
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </Panel>
  );
}
