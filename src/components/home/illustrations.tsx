"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "@/components/ui/Icon";
import { prefersReducedMotion } from "@/components/ui/prefs";

/* Each illustration shows its finished picture at rest and plays once when scrolled into view. */

function useInView(ref: RefObject<Element | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function useCountUp(target: number, play: boolean, ms = 1400) {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (!play || prefersReducedMotion()) return;
    let raf = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [play, target, ms]);
  return v;
}
function useMoving() {
  const [moving, setMoving] = useState(false);
  // Decided after mounting so the server and first client render match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMoving(!prefersReducedMotion()), []);
  return moving;
}

const usd = (v: number) => `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;

export function HeroCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const moving = useMoving();
  const bal = useCountUp(26690, seen, 1800);
  return (
    <div className="illo hero-illo" ref={ref} aria-hidden="true">
      <svg viewBox="0 0 640 440" className={`hero-svg${seen ? " play" : ""}`}>
        <path className="lk lk1" d="M232 88 C 300 88, 300 186, 356 186" />
        <path className="lk lk2" d="M232 300 C 300 300, 300 214, 356 214" />
        <path className="lk lk3" d="M588 200 C 610 200, 610 330, 560 356" />
        <path className="lk-flow" d="M232 88 C 300 88, 300 186, 356 186" />
        <path className="lk-flow" d="M232 300 C 300 300, 300 214, 356 214" />
        {moving ? (
          <>
            <circle r="5" className="coin">
              <animateMotion dur="2.4s" repeatCount="indefinite" path="M232 88 C 300 88, 300 186, 356 186" />
            </circle>
            <circle r="5" className="coin out">
              <animateMotion dur="2.4s" begin="1.2s" repeatCount="indefinite" path="M232 300 C 300 300, 300 214, 356 214" />
            </circle>
          </>
        ) : null}
        <g className="hc hc1">
          <rect x="24" y="40" width="208" height="112" rx="16" className="card-r" />
          <rect x="40" y="56" width="30" height="30" rx="9" className="w-gain" />
          <text x="82" y="68" className="t-eye">INCOME</text>
          <text x="82" y="86" className="t-title">Paychecks</text>
          <text x="40" y="132" className="t-big pos">+$5,633</text>
          <text x="150" y="132" className="t-small">/ mo</text>
        </g>
        <g className="hc hc2">
          <rect x="24" y="236" width="208" height="128" rx="16" className="card-r peer" />
          <rect x="40" y="252" width="30" height="30" rx="9" className="w-loss" />
          <text x="82" y="264" className="t-eye">RECURRING</text>
          <text x="82" y="282" className="t-title">Bills</text>
          <rect x="40" y="298" width="176" height="18" rx="6" className="row-r" />
          <rect x="40" y="320" width="130" height="18" rx="6" className="row-r" />
          <text x="40" y="354" className="t-big neg">−$3,456</text>
          <rect x="24" y="210" width="118" height="22" rx="11" className="p3f" />
          <text x="34" y="225" className="t-tag">Priya is editing</text>
        </g>
        <g className="hc hc3">
          <rect x="356" y="120" width="232" height="164" rx="18" className="card-r strong" />
          <rect x="372" y="136" width="30" height="30" rx="9" className="w-brand" />
          <text x="414" y="148" className="t-eye">CHECKING ACCOUNT</text>
          <text x="414" y="166" className="t-title">Joint checking</text>
          <text x="372" y="198" className="t-eye">BALANCE IN 12 MONTHS</text>
          <text x="372" y="244" className="t-hero">{usd(bal)}</text>
          <rect x="372" y="256" width="96" height="20" rx="10" className="pill-gain" />
          <text x="382" y="270" className="t-pill pos">↑ +$2,177</text>
        </g>
        <g className="hc hc4">
          <rect x="408" y="324" width="208" height="92" rx="16" className="card-r" />
          <rect x="424" y="340" width="30" height="30" rx="9" className="w-acc" />
          <text x="466" y="352" className="t-eye">SAVINGS GOAL</text>
          <text x="466" y="370" className="t-title">Emergency fund</text>
          <text x="424" y="404" className="t-big">Feb 2028</text>
        </g>
        <g className="tag-g">
          <rect x="262" y="118" width="68" height="22" rx="11" className="tag-r" />
          <text x="296" y="133" className="t-tagc pos">+$5,633</text>
          <rect x="262" y="262" width="68" height="22" rx="11" className="tag-r" />
          <text x="296" y="277" className="t-tagc neg">−$3,456</text>
        </g>
        <g className="cur cur1">
          <path d="M0 0 L14 7 L8 9 L6 15 Z" className="p2f cur-a" />
          <rect x="12" y="14" width="46" height="20" rx="10" className="p2f" />
          <text x="35" y="28" className="t-tagc on">Sam</text>
        </g>
        <g className="cur cur2">
          <path d="M0 0 L14 7 L8 9 L6 15 Z" className="p3f cur-a" />
          <rect x="12" y="14" width="52" height="20" rx="10" className="p3f" />
          <text x="38" y="28" className="t-tagc on">Priya</text>
        </g>
      </svg>
    </div>
  );
}

export function FlowIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const moving = useMoving();
  const left = useCountUp(2177, seen);
  return (
    <div className="illo" ref={ref} aria-hidden="true">
      <svg viewBox="0 0 400 280" className={seen ? "play" : ""}>
        <path className="lk" d="M150 60 C 200 60, 200 130, 240 130" />
        <path className="lk" d="M150 220 C 200 220, 200 150, 240 150" />
        <path className="lk-flow" d="M150 60 C 200 60, 200 130, 240 130" />
        <path className="lk-flow" d="M150 220 C 200 220, 200 150, 240 150" />
        {moving ? (
          <>
            <circle r="4.5" className="coin">
              <animateMotion dur="2s" repeatCount="indefinite" path="M150 60 C 200 60, 200 130, 240 130" />
            </circle>
            <circle r="4.5" className="coin out">
              <animateMotion dur="2s" begin="1s" repeatCount="indefinite" path="M150 220 C 200 220, 200 150, 240 150" />
            </circle>
          </>
        ) : null}
        <g className="pop pop1">
          <rect x="16" y="24" width="134" height="72" rx="14" className="card-r" />
          <text x="30" y="48" className="t-eye">PAYCHECK</text>
          <text x="30" y="80" className="t-big pos">+$5,633</text>
        </g>
        <g className="pop pop2">
          <rect x="16" y="184" width="134" height="72" rx="14" className="card-r" />
          <text x="30" y="208" className="t-eye">BILLS + GROCERIES</text>
          <text x="30" y="240" className="t-big neg">−$3,456</text>
        </g>
        <g className="pop pop3">
          <rect x="240" y="84" width="144" height="112" rx="16" className="card-r strong" />
          <text x="256" y="110" className="t-eye">LEFT OVER / MO</text>
          <text x="256" y="152" className="t-hero s">+{usd(left).slice(1)}</text>
          <text x="256" y="180" className="t-small">30% to savings</text>
        </g>
      </svg>
    </div>
  );
}

export function TaxIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const parts: [string, number, string][] = [
    ["Take-home", 75607, "tb-home"],
    ["Federal", 13434, "tb-fed"],
    ["401(k)", 8800, "tb-pre"],
    ["Social Security + Medicare", 8415, "tb-fica"],
    ["Colorado", 3744, "tb-state"],
  ];
  const take = useCountUp(6301, seen);
  return (
    <div className="illo pad" ref={ref} aria-hidden="true">
      <div className={`tax-card${seen ? " play" : ""}`}>
        <div className="eyebrow">Take-home per month</div>
        <div className="tx-hero">{usd(take)}</div>
        <div className="tbar">
          {parts.map(([n, v, c], i) => (
            <span key={n} className={`tseg ${c}`} style={{ width: `${(v / 110000) * 100}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <ul className="tlegend">
          {parts.map(([n, v, c]) => (
            <li key={n}>
              <i className={c} />
              <span>{n}</span>
              <b>{usd(v)}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GrowthIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const pts = (end: number) => {
    const a: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const g = Math.pow(i / 10, 1.35);
      a.push([30 + i * 34, 230 - (g * (end - 25) * 190) / 180 - (25 / 180) * 190 + 26]);
    }
    return a;
  };
  const line = (arr: [number, number][]) => `M${arr.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}`;
  const mid = pts(125);
  const lo = pts(103);
  const hi = pts(153);
  const band = `${line(hi)} L${[...lo].reverse().map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")} Z`;
  return (
    <div className="illo" ref={ref} aria-hidden="true">
      <svg viewBox="0 0 400 280" className={seen ? "play" : ""}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="30" x2="370" y1={60 + i * 50} y2={60 + i * 50} className="grid-l" />
        ))}
        <path d={band} className="band" />
        <path d={line(mid)} className="gline" pathLength={1} />
        <circle cx={mid[10][0]} cy={mid[10][1]} r="6" className="gdot" />
        <text x="30" y="36" className="t-eye">INVESTING · 10 YEARS</text>
        <text x="366" y={hi[10][1] - 10} className="t-small end">$153k if 9%</text>
        <text x="366" y={mid[10][1] - 12} className="t-big end">$125k</text>
        <text x="366" y={lo[10][1] + 22} className="t-small end">$103k if 3%</text>
        <text x="30" y="266" className="t-small">Today $25k</text>
        <text x="366" y="266" className="t-small end">Year 10</text>
      </svg>
    </div>
  );
}

export function DebtIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const saved = useCountUp(3584, seen);
  return (
    <div className="illo pad" ref={ref} aria-hidden="true">
      <div className={`debt${seen ? " play" : ""}`}>
        <div className="eyebrow">Credit card · $6,200 at 24.99%</div>
        <div className="drow">
          <span>Minimum only</span>
          <div className="dtrack">
            <i className="dbar slow" style={{ width: "100%" }} />
          </div>
          <b>62 months</b>
        </div>
        <div className="drow">
          <span>+$250 a month</span>
          <div className="dtrack">
            <i className="dbar fast" style={{ width: `${(18 / 62) * 100}%` }} />
          </div>
          <b>18 months</b>
        </div>
        <div className="dsave">
          <Icon n="check" s={20} w={2.25} />
          <span>
            Saves <b>{usd(saved)}</b> in interest and 44 months
          </span>
        </div>
      </div>
    </div>
  );
}

export function ChecksIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const rows: ["error" | "warn" | "tip", string][] = [
    ["error", "Splits from Paychecks add up to 110%, more than it has."],
    ["warn", "Joint checking drops below your $1,000 buffer in month 4."],
    ["tip", "Emergency fund covers 1.8 months of spending. 3 to 6 is typical."],
  ];
  const icon = { error: "alert", warn: "alert", tip: "bulb" } as const;
  return (
    <div className="illo pad" ref={ref} aria-hidden="true">
      <div className={`chk-list${seen ? " play" : ""}`}>
        {rows.map(([lv, t], i) => (
          <div key={i} className={`chk-row lv-${lv}`} style={{ animationDelay: `${i * 220}ms` }}>
            <span className="lv-ico">
              <Icon n={icon[lv]} s={16} w={2} />
            </span>
            <p>{t}</p>
          </div>
        ))}
        <div className="chk-fix" style={{ animationDelay: "800ms" }}>
          <span className="btn-sm primary">Set to 3 months</span>
          <span className="muted">One-click fixes</span>
        </div>
      </div>
    </div>
  );
}

export function ImportIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const lines = ["2026-06-05, ACME PAYROLL DIR DEP, 2412.56", "2026-06-01, RENT OAKWOOD APTS, -1850.00", "2026-06-03, TRADER JOE'S #552, -84.12", "2026-06-06, COMCAST INTERNET, -69.99", "2026-06-09, NETFLIX.COM, -15.49"];
  const chips: ["income" | "recurring" | "spend", string, string][] = [
    ["income", "Paycheck", "$5,227/mo"],
    ["recurring", "6 bills", "$2,175/mo"],
    ["spend", "Groceries", "$270/mo"],
  ];
  return (
    <div className="illo pad" ref={ref} aria-hidden="true">
      <div className={`imp${seen ? " play" : ""}`}>
        <div className="csv">
          {lines.map((l, i) => (
            <code key={i} style={{ animationDelay: `${i * 110}ms` }}>
              {l}
            </code>
          ))}
        </div>
        <div className="imp-arrow">
          <Icon n="arrowRight" s={28} />
        </div>
        <div className="chips-col">
          {chips.map(([k, n, v], i) => (
            <div key={k} className="ichip" style={{ animationDelay: `${700 + i * 150}ms` }}>
              <span className={`pal pal-${k}`}>
                <Icon n={k} s={16} />
              </span>
              <span>{n}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScenarioIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const rows = [
    ["Left over / mo", "+$2,177", "+$1,452"],
    ["Checking in 12 mo", "$26,690", "$20,600"],
    ["Into savings / yr", "$7,836", "$5,227"],
    ["Emergency fund", "Feb 2028", "Oct 2028"],
  ];
  return (
    <div className="illo pad" ref={ref} aria-hidden="true">
      <div className={`scn${seen ? " play" : ""}`}>
        <div className="scn-head">
          <span />
          <b>Current plan</b>
          <b className="alt">What if we move?</b>
        </div>
        {rows.map(([l, a, b]) => (
          <div key={l} className="scn-row">
            <span>{l}</span>
            <em>{a}</em>
            <em className="alt">{b}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollabIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  return (
    <div className="illo" ref={ref} aria-hidden="true">
      <svg viewBox="0 0 400 280" className={`collab${seen ? " play" : ""}`}>
        <rect x="40" y="70" width="150" height="90" rx="14" className="card-r" />
        <text x="56" y="96" className="t-eye">GROCERIES</text>
        <text x="56" y="136" className="t-big neg">−$780</text>
        <rect x="216" y="120" width="150" height="100" rx="14" className="card-r peer2" />
        <text x="232" y="146" className="t-eye">JOINT CHECKING</text>
        <text x="232" y="190" className="t-big">$26,690</text>
        <rect x="216" y="94" width="110" height="22" rx="11" className="p2f" />
        <text x="271" y="109" className="t-tagc on">Sam is editing</text>
        <g className="av3">
          <circle cx="302" cy="40" r="15" className="p1f" />
          <circle cx="324" cy="40" r="15" className="p2f" />
          <circle cx="346" cy="40" r="15" className="p3f" />
          <text x="302" y="45" className="t-av">J</text>
          <text x="324" y="45" className="t-av">S</text>
          <text x="346" y="45" className="t-av">P</text>
        </g>
        <g className="cur c-a">
          <path d="M0 0 L14 7 L8 9 L6 15 Z" className="p3f cur-a" />
          <rect x="12" y="14" width="52" height="20" rx="10" className="p3f" />
          <text x="38" y="28" className="t-tagc on">Priya</text>
        </g>
        <g className="cur c-b">
          <path d="M0 0 L14 7 L8 9 L6 15 Z" className="p1f cur-a" />
          <rect x="12" y="14" width="40" height="20" rx="10" className="p1f" />
          <text x="32" y="28" className="t-tagc on">You</text>
        </g>
        <rect x="40" y="226" width="200" height="30" rx="10" className="hist-r" />
        <text x="54" y="246" className="t-small">Priya set Rent to $1,900 · just now</text>
      </svg>
    </div>
  );
}

export function A11yIllo() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const items = ["High contrast", "Colour-blind-safe colours", "Reduce motion", "Announce changes"];
  return (
    <div className="illo pad" ref={ref} aria-hidden="true">
      <div className={`a11y-demo${seen ? " play" : ""}`}>
        <div className="aa">
          <span className="a1">Aa</span>
          <span className="a2">Aa</span>
          <span className="a3">Aa</span>
        </div>
        <div className="toggles">
          {items.map((t, i) => (
            <div key={t} className="tg">
              <span>{t}</span>
              <i className="sw" style={{ animationDelay: `${300 + i * 350}ms` }} />
            </div>
          ))}
        </div>
        <div className="cbrow">
          <span className="delta gain-b">↑ +$2,177</span>
          <span className="delta loss-o">↓ −$780</span>
        </div>
      </div>
    </div>
  );
}
