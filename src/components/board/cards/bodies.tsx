"use client";

import { useEffect, useState } from "react";
import { FIELD_TIPS } from "@/lib/copy";
import {
  ACCOUNT_TYPES,
  accountTypeOf,
  cardName,
  clamp,
  fmtBytes,
  FILING,
  monthLabel,
  newId,
  num,
  payoff,
  paycheckTax,
  plural,
  projectAccount,
  propertyRateFor,
  salesRateFor,
  STATE_CODES,
  STATES,
  TAX_YEAR,
  tone,
  type AccountType,
  type BoardSettings,
  type Card,
  type CardMap,
  type Filing,
  type Flows,
  type TaxMode,
} from "@/lib/engine";
import { Icon } from "@/components/ui/Icon";
import { Delta, Field, FreqSelect, NumberInput, Segmented, TextInput } from "@/components/ui/inputs";
import { useMoney } from "@/components/ui/prefs";
import { MonthPicker, Select, type Option } from "@/components/ui/Select";

export interface BodyProps {
  c: Card;
  cards: CardMap;
  flows: Flows;
  settings: BoardSettings;
  up: (patch: Partial<Card>) => void;
  onImport: (c: Card) => void;
  fileUrl: (path: string) => Promise<string | null>;
}

const stateOptions = (none: string): Option<string>[] => [{ value: "", label: none }, ...STATE_CODES.map((k) => ({ value: k, label: STATES[k].name }))];
const filingOptions: Option<Filing>[] = (Object.keys(FILING) as Filing[]).map((k) => ({ value: k, label: FILING[k] }));

function Foot({ c, flows, label }: { c: Card; flows: Flows; label?: string }) {
  const fmt = useMoney();
  const out = flows.out[c.id] ?? 0;
  const n = (flows.inputs[c.id] ?? []).length;
  const inSum = flows.inSum[c.id] ?? 0;
  const sp = flows.splitPct[c.id] ?? 0;
  return (
    <div className="card-foot">
      <div>
        <div className="eyebrow">{label ?? "Flows on per month"}</div>
        {n ? <div className="foot-sub">Includes {fmt.signed(inSum)} from {plural(n, "linked card")}</div> : <div className="foot-sub">Drag the dot on the right to link it</div>}
        {sp > 0 && c.kind !== "account" ? <div className="foot-sub">{Math.min(sp, 100)}% goes to splits, the rest flows on</div> : null}
      </div>
      <div className={`flow ${tone(out)}`}>{fmt.signed(out)}</div>
    </div>
  );
}

function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <div className="disclaimer" role="note">
      <Icon n="info" s={16} />
      <span>{children}</span>
    </div>
  );
}

function IncomeSpendBody({ c, flows, up }: BodyProps) {
  const isIn = c.kind === "income";
  return (
    <>
      <div className="card-body">
        <div className="fields">
          <Field label={isIn ? "Amount" : "Budget"} tip={isIn ? FIELD_TIPS.incomeAmount : FIELD_TIPS.spendAmount}>
            <NumberInput label={isIn ? "Amount" : "Budget"} value={c.amount} onCommit={(v) => up({ amount: v })} />
          </Field>
          <Field label="How often">
            <FreqSelect value={c.freq} onChange={(v) => up({ freq: v })} only={isIn ? undefined : ["weekly", "monthly", "annual"]} />
          </Field>
        </div>
      </div>
      <Foot c={c} flows={flows} />
    </>
  );
}

function RecurringBody({ c, flows, up }: BodyProps) {
  const items = Array.isArray(c.items) ? c.items : [];
  const setItems = (next: typeof items) => up({ items: next });
  const counts: Record<string, number> = {};
  for (const i of items) {
    const k = String(i.name ?? "").trim().toLowerCase();
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }
  return (
    <>
      <div className="card-body">
        <div className="items">
          {items.map((i) => {
            const k = String(i.name ?? "").trim().toLowerCase();
            const nm = i.name || "Payment";
            return (
              <div className="item" key={i.id}>
                <TextInput className={`name${!k || counts[k] > 1 ? " bad" : ""}`} label="Payment name" placeholder="Name this payment" max={40} value={i.name} onCommit={(v) => setItems(items.map((x) => (x === i ? { ...x, name: v } : x)))} />
                <NumberInput size="sm" label={`${nm} amount`} value={i.amount} onCommit={(v) => setItems(items.map((x) => (x === i ? { ...x, amount: v } : x)))} />
                <FreqSelect size="sm" label={`${nm} frequency`} value={i.freq} onChange={(v) => setItems(items.map((x) => (x === i ? { ...x, freq: v } : x)))} />
                <button className="icon-btn" aria-label={`Remove ${nm}`} onClick={() => setItems(items.filter((x) => x !== i))}>
                  <Icon n="x" s={16} />
                </button>
              </div>
            );
          })}
        </div>
        {items.length < 30 ? (
          <button className="add-row" onClick={() => setItems([...items, { id: newId(), name: "", amount: 0, freq: "monthly" }])}>
            <Icon n="plus" s={18} />
            Add payment
          </button>
        ) : (
          <div className="hint">30 payments is the most a card holds. Start another Recurring card.</div>
        )}
      </div>
      <Foot c={c} flows={flows} />
    </>
  );
}

function AccountBody({ c, flows, settings, up }: BodyProps) {
  const fmt = useMoney();
  const t = accountTypeOf(c);
  const pr = projectAccount(c, flows, settings);
  const setType = (nt: AccountType) => {
    const p: Partial<Card> = { atype: nt };
    if ((nt === "savings" || nt === "cd") && c.apy == null) p.apy = 4;
    if (nt === "cd") {
      if (!c.term) p.term = 12;
      if (!c.opened) {
        const d = new Date();
        p.opened = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    if (nt === "investment") {
      if (c.ret == null) p.ret = 6;
      if (c.fees == null) p.fees = 0.2;
      if (num(c.horizon) < 60) p.horizon = 120;
    }
    if (nt !== "investment" && num(c.horizon) > 24) p.horizon = 12;
    up(p);
  };
  const typeSeg = <Segmented label="Account type" value={t} onChange={setType} options={(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((k) => [k, ACCOUNT_TYPES[k]])} />;
  const pct = (v: number) => `${Math.round(v * 10) / 10}%`;

  if (t === "cd" && pr.cd) {
    const cd = pr.cd;
    return (
      <div className="card-body">
        {typeSeg}
        <div>
          <div className="eyebrow">{cd.matured ? "Matured at" : "Worth at maturity"}</div>
          <div className="hero">{fmt.money(cd.maturity)}</div>
        </div>
        <div className="hint">
          {c.opened
            ? cd.matured
              ? `Matured in ${monthLabel(cd.left)}.`
              : `Matures ${monthLabel(cd.left)}, in ${plural(cd.left, "month")}. Worth about ${fmt.money(cd.now)} today.`
            : "Set the month it opened to see when it matures."}
          {num(c.taxPct) > 0 ? ` After ${num(c.taxPct)}% tax on interest.` : ""}
        </div>
        <div className="fields">
          <Field label="Deposit">
            <NumberInput label="Deposit" value={c.balance} onCommit={(v) => up({ balance: v })} />
          </Field>
          <Field label="APY" tip={FIELD_TIPS.apy}>
            <NumberInput rule="apy" suffix="%" label="APY" value={c.apy} onCommit={(v) => up({ apy: v })} />
          </Field>
          <Field label="Term" tip={FIELD_TIPS.term}>
            <Select label="Term" value={c.term ?? 12} searchable={false} options={[3, 6, 9, 12, 18, 24, 36, 48, 60].map((m) => ({ value: m, label: `${m} months` }))} onChange={(v) => up({ term: v })} />
          </Field>
          <Field label="Opened" tip={FIELD_TIPS.opened}>
            <MonthPicker label="Opened" value={c.opened} onChange={(v) => up({ opened: v })} />
          </Field>
        </div>
        <Field label="Tax on interest" tip={FIELD_TIPS.taxPct}>
          <NumberInput rule="taxPct" suffix="%" label="Tax on interest" value={c.taxPct} onCommit={(v) => up({ taxPct: v })} />
        </Field>
        <Disclaimer>Taking money out before a CD matures usually costs a penalty, often several months of interest.</Disclaimer>
      </div>
    );
  }

  const hs: [number, string][] = t === "investment" ? [[12, "1 yr"], [60, "5 yr"], [120, "10 yr"], [240, "20 yr"]] : [[3, "3 mo"], [6, "6 mo"], [12, "12 mo"], [24, "24 mo"]];
  const hLabel = pr.h > 24 ? `${pr.h / 12} years` : `${pr.h} months`;
  return (
    <>
      <div className="card-body">
        {typeSeg}
        <div>
          <div className="eyebrow">{t === "investment" ? `Expected in ${hLabel}` : `Balance in ${hLabel}`}</div>
          <div className={`hero${pr.end < 0 ? " neg" : ""}`}>{fmt.money(pr.end)}</div>
        </div>
        {t === "investment" ? (
          <div className="range-row">
            <div>
              <span>If {pct(pr.rate * 100 - 3)} a year</span>
              <b>{fmt.money(pr.low)}</b>
            </div>
            <div>
              <span>If {pct(pr.rate * 100 + 3)} a year</span>
              <b>{fmt.money(pr.high)}</b>
            </div>
          </div>
        ) : null}
        <Segmented label="Projection length" value={pr.h} onChange={(m) => up({ horizon: m })} options={hs} />
        <Field label="Balance today" tip={FIELD_TIPS.balance}>
          <NumberInput label="Balance today" rule="balance" value={c.balance} onCommit={(v) => up({ balance: v })} />
        </Field>
        {t === "savings" ? (
          <div className="fields">
            <Field label="APY" tip={FIELD_TIPS.apy}>
              <NumberInput rule="apy" suffix="%" label="APY" value={c.apy} onCommit={(v) => up({ apy: v })} />
            </Field>
            <Field label="Tax on interest" tip={FIELD_TIPS.taxPct}>
              <NumberInput rule="taxPct" suffix="%" label="Tax on interest" value={c.taxPct} onCommit={(v) => up({ taxPct: v })} />
            </Field>
          </div>
        ) : null}
        {t === "investment" ? (
          <>
            <div className="fields">
              <Field label="Yearly return" tip={FIELD_TIPS.ret}>
                <NumberInput rule="ret" suffix="%" label="Yearly return" value={c.ret} onCommit={(v) => up({ ret: v })} />
              </Field>
              <Field label="Fees" tip={FIELD_TIPS.fees}>
                <NumberInput rule="fees" suffix="%" label="Fees per year" value={c.fees} onCommit={(v) => up({ fees: v })} />
              </Field>
            </div>
            <Field label="Tax on gains" tip={FIELD_TIPS.taxPct}>
              <NumberInput rule="taxPct" suffix="%" label="Tax on gains" value={c.taxPct} onCommit={(v) => up({ taxPct: v })} />
            </Field>
          </>
        ) : null}
        <div className="row">
          <span className="eyebrow">Net flowing in</span>
          <Delta v={pr.inflow} />
        </div>
        {pr.toSplits ? (
          <div className="row">
            <span className="eyebrow">Sent to splits</span>
            <Delta v={-pr.toSplits} />
          </div>
        ) : null}
        {t !== "checking" ? (
          <div className="row">
            <span className="eyebrow">
              {t === "investment" ? "Growth" : "Interest"} over {hLabel}
            </span>
            <Delta v={pr.earned} />
          </div>
        ) : null}
        {settings.inflation > 0 && pr.inflow < 0 ? <div className="hint">Money going out rises {settings.inflation}% a year in this projection.</div> : null}
        {pr.end < 0 ? (
          <div className="warn">
            <Icon n="alert" s={18} />
            This account runs out of money within {hLabel}.
          </div>
        ) : pr.firstBelow != null ? (
          <div className="warn">
            <Icon n="alert" s={18} />
            Drops below your {fmt.money(settings.buffer)} buffer in month {pr.firstBelow}.
          </div>
        ) : null}
        {t === "investment" ? (
          <Disclaimer>Projection, not a promise. It assumes a steady average return after fees and before inflation. Real returns change from year to year and can be negative. This isn’t investment advice.</Disclaimer>
        ) : null}
      </div>
      <Foot c={c} flows={flows} label="Available to split" />
    </>
  );
}

function DebtBody({ c, flows, up }: BodyProps) {
  const fmt = useMoney();
  const bal = num(c.balance);
  const min = num(c.payment);
  const extra = num(c.extra);
  const withExtra = payoff(bal, c.apr, min + extra);
  const minOnly = payoff(bal, c.apr, min);
  const saves = extra > 0 && !withExtra.never && !minOnly.never ? { interest: (minOnly.interest ?? 0) - (withExtra.interest ?? 0), months: (minOnly.months ?? 0) - (withExtra.months ?? 0) } : null;
  const never = withExtra.never && bal > 0;
  return (
    <>
      <div className="card-body">
        <div>
          <div className="eyebrow">{bal <= 0 ? "Paid off" : never ? "Payoff date" : "Debt-free by"}</div>
          <div className={`hero${never ? " neg" : ""}`} style={{ fontSize: never ? 34 : 46 }}>
            {bal <= 0 ? "Done" : never ? "Never at this rate" : monthLabel(withExtra.months ?? 0)}
          </div>
        </div>
        {bal > 0 && !never ? (
          <div className="hint">
            {plural(withExtra.months ?? 0, "month")}, {fmt.money(withExtra.interest)} in interest
          </div>
        ) : null}
        {never ? (
          <div className="warn">
            <Icon n="alert" s={18} />
            The payment doesn’t cover the {fmt.money(withExtra.firstInterest)} of interest each month.
          </div>
        ) : null}
        {saves ? (
          <div className="save-line">
            <Icon n="check" s={18} w={2.25} />
            Paying {fmt.money(extra)} extra saves {fmt.money(saves.interest)} in interest and {plural(saves.months, "month")}.
          </div>
        ) : null}
        {extra > 0 && minOnly.never && !withExtra.never ? (
          <div className="save-line">
            <Icon n="check" s={18} w={2.25} />
            Without the extra payment this debt would never be paid off.
          </div>
        ) : null}
        <div className="fields">
          <Field label="Balance" tip={FIELD_TIPS.debtBalance}>
            <NumberInput rule="debt" label="Balance owed" value={c.balance} onCommit={(v) => up({ balance: v })} />
          </Field>
          <Field label="Rate (APR)" tip={FIELD_TIPS.apr}>
            <NumberInput rule="apr" suffix="%" label="Interest rate" value={c.apr} onCommit={(v) => up({ apr: v })} />
          </Field>
          <Field label="Minimum" tip={FIELD_TIPS.payment}>
            <NumberInput label="Minimum payment" value={c.payment} onCommit={(v) => up({ payment: v })} />
          </Field>
          <Field label="Extra / mo" tip={FIELD_TIPS.extra}>
            <NumberInput label="Extra payment" value={c.extra} onCommit={(v) => up({ extra: v })} />
          </Field>
        </div>
      </div>
      <Foot c={c} flows={flows} label="Payment per month" />
    </>
  );
}

function TaxBody({ c, flows, up }: BodyProps) {
  const fmt = useMoney();
  const mode: TaxMode = c.mode ?? "paycheck";
  const st = STATES[c.state ?? ""];
  const TITLES: Record<TaxMode, string> = { paycheck: "Paycheck", property: "Property tax", sales: "Sales tax" };
  const setMode = (m: TaxMode) => up({ mode: m, ...(!c.title || Object.values(TITLES).includes(c.title) ? { title: TITLES[m] } : {}) });
  const modeSeg = <Segmented label="Tax type" value={mode} onChange={setMode} options={[["paycheck", "Paycheck"], ["property", "Property"], ["sales", "Sales"]]} />;
  const stateField = (
    <Field label="State">
      <Select label="State" placeholder="Choose a state" value={c.state ?? ""} options={stateOptions("No state selected")} onChange={(v) => up({ state: v })} />
    </Field>
  );
  const note = <Disclaimer>Estimate from {TAX_YEAR} rates (IRS, Tax Foundation). It leaves out local taxes, credits and itemized deductions. Not tax advice.</Disclaimer>;
  const row = (label: string, v: number, total?: boolean) => (
    <div className={`bd-row${total ? " total" : ""}`}>
      <span>{label}</span>
      <b>{fmt.money(v)}</b>
    </div>
  );

  if (mode === "paycheck") {
    const r = paycheckTax(c.gross, c.pretax, c.state, c.filing);
    return (
      <>
        <div className="card-body">
          {modeSeg}
          <div>
            <div className="eyebrow">Take-home per month</div>
            <div className="hero">{fmt.money(r.takeHome / 12)}</div>
          </div>
          {r.gross > 0 ? (
            <div className="hint">
              {Math.round(r.effectiveRate * 100)}% of pay goes to tax. Top federal bracket {r.federalMarginal}%
              {st ? (st.income ? `, ${st.name} ${r.stateMarginal}%` : `, no ${st.name} income tax`) : ""}.
            </div>
          ) : null}
          <div className="fields">
            <Field label="Salary / yr" tip={FIELD_TIPS.gross}>
              <NumberInput label="Salary per year" value={c.gross} onCommit={(v) => up({ gross: v })} />
            </Field>
            <Field label="Pre-tax / yr" tip={FIELD_TIPS.pretax}>
              <NumberInput label="Pre-tax deductions per year" value={c.pretax} onCommit={(v) => up({ pretax: v })} />
            </Field>
            {stateField}
            <Field label="Filing">
              <Select label="Filing status" value={c.filing ?? "single"} searchable={false} options={filingOptions} onChange={(v) => up({ filing: v })} />
            </Field>
          </div>
          {r.gross > 0 ? (
            <div className="bd" aria-label="Yearly breakdown">
              <div className="eyebrow">Each year</div>
              {row("Federal income tax", r.federal)}
              {row("Social Security", r.socialSecurity)}
              {row("Medicare", r.medicare)}
              {st && !st.income ? (
                <div className="bd-row">
                  <span>{st.name} income tax</span>
                  <b>None</b>
                </div>
              ) : (
                row("State income tax", r.state)
              )}
              {r.pretax ? row("Pre-tax deductions", r.pretax) : null}
              {row("Take-home pay", r.takeHome, true)}
            </div>
          ) : null}
          {note}
        </div>
        <Foot c={c} flows={flows} label="Take-home per month" />
      </>
    );
  }
  if (mode === "property") {
    const rate = propertyRateFor(c);
    const annual = (num(c.homeValue) * rate) / 100;
    const custom = c.propRate != null;
    return (
      <>
        <div className="card-body">
          {modeSeg}
          <div>
            <div className="eyebrow">Property tax per month</div>
            <div className="hero">{fmt.money(annual / 12)}</div>
          </div>
          <div className="hint">
            {fmt.money(annual)} a year at {Math.round(rate * 100) / 100}%{custom ? " (your rate)" : st ? ` (${st.name} average)` : ""}.
          </div>
          <div className="fields">
            <Field label="Home value" tip={FIELD_TIPS.homeValue}>
              <NumberInput label="Home value" value={c.homeValue} onCommit={(v) => up({ homeValue: v })} />
            </Field>
            {stateField}
          </div>
          <Field label="Effective rate" tip={FIELD_TIPS.propRate}>
            <NumberInput rule="propRate" suffix="%" label="Effective property tax rate" value={rate} onCommit={(v) => up({ propRate: v })} />
          </Field>
          {custom && st ? (
            <button className="add-row" onClick={() => up({ propRate: null })}>
              Use the {st.name} average ({st.propertyRate}%)
            </button>
          ) : null}
          {note}
        </div>
        <Foot c={c} flows={flows} label="Property tax per month" />
      </>
    );
  }
  const rate = salesRateFor(c);
  const tax = (num(c.spend) * rate) / 100;
  const custom = c.salesRate != null;
  return (
    <div className="card-body">
      {modeSeg}
      <div>
        <div className="eyebrow">Sales tax per month</div>
        <div className="hero">{fmt.money(tax)}</div>
      </div>
      <div className="hint">
        About {fmt.money(tax * 12)} a year at {rate}%{custom ? " (your rate)" : st ? ` (${st.name} average)` : ""}. For reference only: prices you pay already include it, so it isn’t added to your totals.
      </div>
      <div className="fields">
        <Field label="Taxable / mo" tip={FIELD_TIPS.salesSpend}>
          <NumberInput label="Taxable spending per month" value={c.spend} onCommit={(v) => up({ spend: v })} />
        </Field>
        {stateField}
      </div>
      <Field label="Combined rate" tip={FIELD_TIPS.salesRate}>
        <NumberInput rule="salesRate" suffix="%" label="Sales tax rate" value={rate} onCommit={(v) => up({ salesRate: v })} />
      </Field>
      {custom && st ? (
        <button className="add-row" onClick={() => up({ salesRate: null })}>
          Use the {st.name} average ({st.salesRate}%)
        </button>
      ) : null}
      {note}
    </div>
  );
}

function SplitBody({ c, cards, flows, up }: BodyProps) {
  const fmt = useMoney();
  const pct = clamp(num(c.pct), 0, 100);
  const inSum = flows.inSum[c.id] ?? 0;
  return (
    <>
      <div className="card-body">
        <Field label="Share to send" tip={FIELD_TIPS.pct}>
          <NumberInput suffix="%" rule="pct" label="Share to send" value={pct} onCommit={(v) => up({ pct: v })} />
        </Field>
        <input className="range" type="range" min={0} max={100} step={5} value={pct} aria-label="Share to send" onChange={(e) => up({ pct: Number(e.target.value) })} />
        <div className="hint">
          {pct}% of {fmt.signed(inSum)} coming in
        </div>
        {(flows.inputs[c.id] ?? []).map((src) => {
          const total = flows.splitPct[src] ?? 0;
          return (
            <div key={src} className={`hint${total > 100 ? " neg" : ""}`}>
              All splits from {cardName(cards[src])}: {total}% of 100%
            </div>
          );
        })}
      </div>
      <Foot c={c} flows={flows} />
    </>
  );
}

function GoalBody({ c, flows, up }: BodyProps) {
  const fmt = useMoney();
  const target = num(c.target);
  const saved = num(c.saved);
  const per = flows.inSum[c.id] ?? 0;
  const left = Math.max(0, target - saved);
  const done = target > 0 && left === 0;
  const months = per > 0 && !done ? Math.ceil(left / per) : null;
  const pct = target > 0 ? clamp((saved / target) * 100, 0, 100) : 0;
  return (
    <div className="card-body">
      {done ? (
        <span className="done-pill">
          <Icon n="check" s={16} w={2.25} />
          Target reached
        </span>
      ) : null}
      <div>
        <div className="eyebrow">{done ? "Saved" : months != null ? "You get there by" : "Not funded yet"}</div>
        <div className="hero" style={{ fontSize: months != null || done ? 46 : 30 }}>
          {done ? fmt.money(saved) : months != null ? monthLabel(months) : "Link money in"}
        </div>
      </div>
      {months != null ? (
        <div className="hint">
          {plural(months, "month")} at {fmt.money(per)} a month, {fmt.money(left)} to go
        </div>
      ) : null}
      {months == null && !done ? <div className="hint">Link an account or a split into this card to see when you’ll reach it.</div> : null}
      <div className="bar" role="progressbar" aria-label="Saved so far" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="fields">
        <Field label="Target" tip={FIELD_TIPS.target}>
          <NumberInput rule="target" label="Target" value={c.target} onCommit={(v) => up({ target: v })} />
        </Field>
        <Field label="Saved" tip={FIELD_TIPS.saved}>
          <NumberInput label="Saved so far" value={c.saved} onCommit={(v) => up({ saved: v })} />
        </Field>
      </div>
    </div>
  );
}

function FileBody({ c, onImport, fileUrl }: BodyProps) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = /^image\//.test(c.type ?? "");
  const isCsv = /csv/.test(c.type ?? "") || /\.csv$/i.test(c.name ?? "");
  useEffect(() => {
    let alive = true;
    if (c.path) void fileUrl(c.path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [c.path, fileUrl]);
  return (
    <div className="card-body">
      {/* A signed, short-lived URL from storage; next/image can't optimise these. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {isImg && url ? <img className="file-thumb" src={url} alt={c.name || "Uploaded image"} draggable={false} /> : null}
      <div className="file-name">{c.name || "Untitled file"}</div>
      <div className="file-meta">
        {(String(c.name ?? "").split(".").pop() || "file").toUpperCase()} · {fmtBytes(num(c.size))}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {url ? (
          <a className="file-open" href={url} target="_blank" rel="noopener noreferrer">
            Open file
          </a>
        ) : null}
        {isCsv && c.path ? (
          <button className="btn-sm" onClick={() => onImport(c)}>
            <Icon n="importIcon" s={16} />
            Import transactions
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CardBody(props: BodyProps) {
  switch (props.c.kind) {
    case "income":
    case "spend":
      return <IncomeSpendBody {...props} />;
    case "recurring":
      return <RecurringBody {...props} />;
    case "account":
      return <AccountBody {...props} />;
    case "debt":
      return <DebtBody {...props} />;
    case "tax":
      return <TaxBody {...props} />;
    case "split":
      return <SplitBody {...props} />;
    case "goal":
      return <GoalBody {...props} />;
    case "file":
      return <FileBody {...props} />;
    default:
      return null;
  }
}
