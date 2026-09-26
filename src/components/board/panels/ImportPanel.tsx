"use client";

import { useMemo, useRef, useState } from "react";
import { analyzeStatement, buildTransactions, FREQ_LABEL, guessColumns, parseCSV, plural, sampleStatement, type ColumnMap, type Finding, type StatementAnalysis } from "@/lib/engine";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { useMoney } from "@/components/ui/prefs";
import { Select } from "@/components/ui/Select";

export type ImportResult = StatementAnalysis & { skipped: number };

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function ImportPanel({ onClose, onAdd, preload }: { onClose: () => void; onAdd: (r: ImportResult) => void; preload?: { text: string; name: string } | null }) {
  const fmt = useMoney();
  const [text, setText] = useState<string | null>(preload?.text ?? null);
  const [fileName, setFileName] = useState(preload?.name ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [mapOverride, setMapOverride] = useState<ColumnMap | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => (text ? parseCSV(text) : null), [text]);
  const guessed = useMemo(() => (rows && rows.length >= 2 ? guessColumns(rows) : null), [rows]);
  const map = mapOverride ?? guessed;
  const emptyFile = rows != null && rows.length < 2;

  const reset = (t: string | null, name: string) => {
    setText(t);
    setFileName(name);
    setMapOverride(null);
    setResult(null);
    setErr(null);
  };
  const readFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(csv|txt|tsv)$/i.test(f.name) && !/csv|text/.test(f.type)) return setErr(`${f.name} isn’t a CSV. Export your statement as CSV from your bank’s website.`);
    if (f.size > 5 * 1048576) return setErr(`${f.name} is larger than 5 MB. Export a shorter date range.`);
    f.text().then(
      (t) => reset(t, f.name),
      () => setErr(`${f.name} couldn’t be read. Try exporting it again.`),
    );
  };
  const header = rows && map ? (rows[map.headerRow] ?? []) : [];
  const colOptions = (optional: boolean) => [...(optional ? [{ value: -1, label: "Not in this file" }] : []), ...header.map((h, i) => ({ value: i, label: h || `Column ${i + 1}` }))];
  const setCol = (key: keyof ColumnMap, v: number) => {
    setMapOverride({ ...map!, [key]: v });
    setResult(null);
  };
  const analyze = () => {
    if (!rows || !map) return;
    if (map.date < 0) return setErr("Pick the column that holds the date.");
    if (map.amount < 0 && map.debit < 0 && map.credit < 0) return setErr("Pick the column that holds the amount, or the money in and money out columns.");
    const { txs, skipped } = buildTransactions(rows, map);
    if (txs.length < 5) return setErr(`Only ${txs.length} rows had a date and an amount. Check the columns above.`);
    const a = analyzeStatement(txs);
    if (!a) return setErr("Every row looked like a transfer between accounts, so there was nothing to import.");
    setErr(null);
    setResult({ ...a, skipped });
  };
  const toggle = (group: "income" | "recurring" | "spend", id: string) => setResult((r) => (r ? { ...r, [group]: r[group].map((x) => (x.id === id ? { ...x, on: !x.on } : x)) } : r));
  const chosen = result ? (["income", "recurring", "spend"] as const).reduce((n, k) => n + result[k].filter((x) => x.on).length, 0) : 0;
  const group = (k: "income" | "recurring" | "spend", title: string, sub?: string) =>
    result && result[k].length ? (
      <section className="group">
        <div className="eyebrow">
          {title} · {result[k].length}
        </div>
        {sub ? <p className="muted">{sub}</p> : null}
        <div className="rv">
          {result[k].map((x: Finding) => (
            <label key={x.id} className="rv-row">
              <input type="checkbox" checked={x.on} onChange={() => toggle(k, x.id)} />
              <span className="n">
                {x.name}
                <small>
                  {x.count ? plural(x.count, "transaction") : "Not regular"}
                  {x.freq !== "monthly" ? ` · ${FREQ_LABEL[x.freq].toLowerCase()}` : ""}
                </small>
              </span>
              <b>
                {fmt.money(x.amount)}
                {x.freq === "monthly" ? "/mo" : ""}
              </b>
            </label>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <Panel title="Import a statement" sub="Turn a bank or card CSV into cards. Review everything before it’s added." onClose={onClose}>
      <p className="privacy">
        <Icon n="lock" s={18} />
        Your statement is read in this browser. Only the totals you choose become cards. The transactions themselves aren’t saved or shared.
      </p>
      {!text ? (
        <div
          className={`drop-mini${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            readFile(e.dataTransfer.files[0]);
          }}
        >
          <Icon n="importIcon" s={32} />
          <b>Drop a CSV statement</b>
          <span className="muted">Most banks offer “Export” or “Download transactions” as CSV.</span>
          <button className="cta" style={{ height: 48 }} onClick={() => input.current?.click()}>
            Choose a CSV file
          </button>
          <button className="btn-sm" onClick={() => reset(sampleStatement(), "sample-statement.csv")}>
            Try a sample statement
          </button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".csv,.tsv,.txt,text/csv"
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="row">
          <span className="muted">
            {fileName} · {rows ? plural(Math.max(0, rows.length - 1), "row") : ""}
          </span>
          <button className="btn-sm" onClick={() => reset(null, "")}>
            Choose another file
          </button>
        </div>
      )}
      {err || emptyFile ? (
        <div className="warn" role="alert">
          <Icon n="alert" s={18} />
          {err ?? "That file has no transactions in it."}
        </div>
      ) : null}
      {map && rows && !result ? (
        <section className="group">
          <div className="eyebrow">Check the columns</div>
          <div className="map-grid">
            <label htmlFor="map-date">Date</label>
            <Select id="map-date" label="Date" value={map.date} options={colOptions(false)} onChange={(v) => setCol("date", v)} />
            <label htmlFor="map-desc">Description</label>
            <Select id="map-desc" label="Description" value={map.desc} options={colOptions(true)} onChange={(v) => setCol("desc", v)} />
            <label htmlFor="map-amount">Amount</label>
            <Select id="map-amount" label="Amount" value={map.amount} options={colOptions(true)} onChange={(v) => setCol("amount", v)} />
            {map.amount < 0 ? (
              <>
                <label htmlFor="map-debit">Money out</label>
                <Select id="map-debit" label="Money out" value={map.debit} options={colOptions(true)} onChange={(v) => setCol("debit", v)} />
                <label htmlFor="map-credit">Money in</label>
                <Select id="map-credit" label="Money in" value={map.credit} options={colOptions(true)} onChange={(v) => setCol("credit", v)} />
              </>
            ) : (
              <>
                <label htmlFor="map-sign">Money out shows as</label>
                <Select
                  id="map-sign"
                  label="Money out shows as"
                  value={map.sign}
                  searchable={false}
                  options={[
                    { value: "negOut", label: "Negative numbers (−45.00)" },
                    { value: "posOut", label: "Positive numbers (45.00)" },
                  ]}
                  onChange={(v) => setMapOverride({ ...map, sign: v as ColumnMap["sign"] })}
                />
              </>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="preview-tbl">
              <tbody>
                {rows.slice(map.headerRow + 1, map.headerRow + 4).map((r, i) => (
                  <tr key={i}>
                    {[map.date, map.desc, map.amount >= 0 ? map.amount : map.debit]
                      .filter((x) => x >= 0)
                      .map((c, j) => (
                        <td key={j}>{r[c]}</td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="cta" style={{ height: 48, alignSelf: "flex-start" }} onClick={analyze}>
            Find income, bills and spending
          </button>
        </section>
      ) : null}
      {result ? (
        <>
          <div className="stats">
            <div className="stat">
              <span className="eyebrow">Transactions</span>
              <b>{result.count}</b>
            </div>
            <div className="stat">
              <span className="eyebrow">Months</span>
              <b>{result.months.toFixed(1)}</b>
            </div>
            <div className="stat">
              <span className="eyebrow">Transfers skipped</span>
              <b>{result.transfers}</b>
            </div>
          </div>
          <p className="muted">
            {fmtDate(result.from)} to {fmtDate(result.to)}.{result.skipped ? ` ${plural(result.skipped, "row")} without a date or amount were skipped.` : ""} Amounts are monthly averages unless a schedule was found.
          </p>
          {result.months < 1.5 ? (
            <div className="warn">
              <Icon n="alert" s={18} />
              This covers less than 2 months, so bills that repeat may not be spotted. Export 3 months or more if you can.
            </div>
          ) : null}
          {group("income", "Income")}
          {group("recurring", "Recurring payments", "Charges that repeat at a steady amount. They become one Recurring payments card.")}
          {group("spend", "Spending", "Everything else, grouped by type. Each becomes a Spend card.")}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="cta" style={{ height: 48 }} disabled={!chosen} onClick={() => onAdd(result)}>
              Add {plural(chosen, "item")} to the board
            </button>
            <button className="btn-sm" onClick={() => setResult(null)}>
              Back to columns
            </button>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
