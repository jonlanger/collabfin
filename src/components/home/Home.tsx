"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { TAX_SOURCES } from "@/lib/engine";
import { Icon, type IconName } from "@/components/ui/Icon";
import { A11yIllo, ChecksIllo, CollabIllo, DebtIllo, FlowIllo, GrowthIllo, HeroCanvas, ImportIllo, ScenarioIllo, TaxIllo } from "./illustrations";

interface Feature {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  example: string;
  note?: string;
  Illo: ComponentType;
}

const FEATURES: Feature[] = [
  { id: "flow", eyebrow: "Money flow", title: "See exactly where every dollar goes.", body: "Drop income, bills, spending and accounts onto the canvas and link them. Every card shows what it passes on, and every total updates the moment anything changes.", example: "A $2,600 paycheck every two weeks is $5,633 a month. After $3,456 of bills and groceries, $2,177 is left, and a Split card moves 30% of it to the emergency fund.", Illo: FlowIllo },
  { id: "tax", eyebrow: "Taxes built in", title: "Know your real take-home pay.", body: "Taxes cards use 2026 federal brackets and every state’s income, property and sales tax rates to turn a salary into monthly take-home pay you can plan with.", example: "$110,000 in Colorado, filing single, with $8,800 into a 401(k): about $6,301 a month after federal, state, Social Security and Medicare.", Illo: TaxIllo },
  { id: "grow", eyebrow: "Savings, CDs and investing", title: "Watch your money grow, honestly.", body: "Savings compound from the APY, CDs show their maturity date and value, and investing accounts project a range, not a single promise.", example: "$25,000 invested plus $500 a month at an assumed 6%, less 0.1% fees, projects to about $125,000 in 10 years, somewhere between $103,000 and $153,000.", note: "Projections assume steady average returns. Real markets rise and fall. This isn’t investment advice.", Illo: GrowthIllo },
  { id: "debt", eyebrow: "Debt payoff", title: "See what an extra payment is worth.", body: "Debt cards work out the payoff date and total interest, then show exactly how much paying a little more saves you.", example: "$6,200 on a card at 24.99%: paying $250 on top of the $180 minimum clears it in 18 months instead of 62 and saves $3,584 in interest.", Illo: DebtIllo },
  { id: "checks", eyebrow: "Checks and best practice", title: "Catch mistakes before they cost you.", body: "Collabfin checks every card as you edit: money counted twice, splits over 100%, accounts dipping below your buffer, unrealistic returns. Many problems come with a one-click fix.", example: "Info tips on every card explain how it works and the best practice behind it, like keeping 3 to 6 months of expenses in an emergency fund.", Illo: ChecksIllo },
  { id: "import", eyebrow: "Bank statement import", title: "Start from what you actually spend.", body: "Drop in a CSV export from your bank. Collabfin finds your paycheck, spots recurring bills and groups the rest into spending categories for you to review.", example: "From 86 transactions over three months it found a biweekly paycheck, six bills from rent to Spotify, and five spending categories. The transactions never leave your browser.", Illo: ImportIllo },
  { id: "plans", eyebrow: "Plans and what-ifs", title: "Ask “what if?” without breaking your plan.", body: "Copy any board into a new plan, change what you like, and compare plans side by side: money left over, account balances, goal dates and debt-free dates.", example: "“What if we move?” raises rent by $725. The comparison shows $725 less each month and the emergency fund arriving 8 months later.", Illo: ScenarioIllo },
  { id: "live", eyebrow: "Live together", title: "Plan with the people you share money with.", body: "Everyone on a board sees the same numbers, live, with cursors, who’s editing what, and a full history of changes. Undo takes back your own edits in one keystroke.", example: "Sam updates the grocery budget while Priya checks the rent. Both see the new total as it changes, and History shows who did what.", Illo: CollabIllo },
  { id: "a11y", eyebrow: "Made for everyone", title: "Comfortable to use, whoever you are.", body: "Bigger text, high contrast, colour-blind-safe colours, reduced motion, extra spacing, screen-reader announcements and full keyboard control. Each person chooses their own settings.", example: "Gains and losses always show a sign and an arrow, so colour never carries the meaning on its own.", Illo: A11yIllo },
];

const CAPABILITIES: [IconName, string, string][] = [
  ["grid", "Templates", "Household, 50/30/20, freelancer, roommates, debt payoff and salary plans to start from."],
  ["zap", "Automations", "New cards link themselves, and savings can be paid first automatically."],
  ["undo", "Undo and history", "Take back any change, and see who changed what."],
  ["upload", "Files on the board", "Keep statements, receipts and PDFs next to the numbers."],
  ["shield", "Validation", "Every amount is checked as you type, with clear messages."],
  ["layers", "Boards and plans", "Separate boards for each project, each with its own what-if plans."],
  ["users", "Invite links", "Share a board to edit or view only. Access is checked by the database itself."],
  ["keyboard", "Keyboard first", "Every action has a shortcut or a button. Press ? to see them."],
];

export function Home({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const open = signedIn ? "Open your boards" : "Get started";
  return (
    <div className="home">
      <header className={`home-nav${scrolled ? " scrolled" : ""}`}>
        <div className="wrap nav-in">
          <span className="home-logo">Collabfin</span>
          <nav className="home-links" aria-label="Page">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
          </nav>
          <Link className="cta sm" href="/boards">
            {open}
            <Icon n="arrowRight" s={18} />
          </Link>
        </div>
      </header>

      <main>
        <section className="home-hero wrap">
          <div className="hero-text">
            <span className="eyebrow">Collaborative money planning</span>
            <h1>Plan your money together, on one canvas.</h1>
            <p>Put your paycheck, bills, accounts and goals on an endless board, link them together, and watch every total update, for everyone, as you go.</p>
            <div className="hero-ctas">
              <Link className="cta lg" href="/boards">
                {open}
                <Icon n="arrowRight" s={20} />
              </Link>
              <Link className="btn2" href="/boards?new=1">
                Start from a template
              </Link>
            </div>
            <ul className="proof">
              <li>
                <Icon n="check" s={16} w={2.25} />
                2026 tax rates for all 50 states and DC
              </li>
              <li>
                <Icon n="check" s={16} w={2.25} />
                Live with the people you share money with
              </li>
              <li>
                <Icon n="check" s={16} w={2.25} />
                Works on your phone
              </li>
            </ul>
          </div>
          <HeroCanvas />
        </section>

        <section className="how wrap" id="how" aria-labelledby="how-h">
          <h2 id="how-h" className="sec-h">
            Three steps from a messy month to a clear plan.
          </h2>
          <ol className="steps">
            <li>
              <span className="step-n">1</span>
              <div>
                <h3>Add cards</h3>
                <p>Income, bills, spending, debts, taxes, accounts and goals. Or import a statement and let Collabfin make them.</p>
              </div>
            </li>
            <li>
              <span className="step-n">2</span>
              <div>
                <h3>Link them</h3>
                <p>Drag from one card to the next to show where the money goes. Splits divide it by percentage.</p>
              </div>
            </li>
            <li>
              <span className="step-n">3</span>
              <div>
                <h3>See what happens</h3>
                <p>Balances, goal dates and payoff dates project forward, and checks flag anything that doesn’t add up.</p>
              </div>
            </li>
          </ol>
        </section>

        <div id="features">
          {FEATURES.map((f, i) => (
            <section key={f.id} className={`feat wrap${i % 2 ? " flip" : ""}`} aria-labelledby={`f-${f.id}`}>
              <div className="feat-text">
                <span className="eyebrow">{f.eyebrow}</span>
                <h2 id={`f-${f.id}`}>{f.title}</h2>
                <p>{f.body}</p>
                <div className="example">
                  <span className="eyebrow">For example</span>
                  <p>{f.example}</p>
                </div>
                {f.note ? (
                  <p className="fine">
                    <Icon n="info" s={16} />
                    {f.note}
                  </p>
                ) : null}
              </div>
              <f.Illo />
            </section>
          ))}
        </div>

        <section className="caps wrap" aria-labelledby="caps-h">
          <h2 id="caps-h" className="sec-h">
            And everything around it.
          </h2>
          <div className="cap-grid">
            {CAPABILITIES.map(([ic, t, d]) => (
              <div key={t} className="cap">
                <span className="cap-ico">
                  <Icon n={ic} />
                </span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="final">
          <div className="wrap final-in">
            <h2>Put your first plan on the canvas.</h2>
            <p>It takes about five minutes with a template, or one with a bank statement.</p>
            <div className="hero-ctas">
              <Link className="cta lg inv" href="/boards">
                {open}
                <Icon n="arrowRight" s={20} />
              </Link>
              <Link className="btn2 inv" href="/boards?new=1">
                Browse templates
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="home-foot wrap">
        <p>
          Collabfin gives estimates and projections to help you plan. It isn’t financial, tax or investment advice. Tax rates are for 2026, from the{" "}
          <a href={TAX_SOURCES.federal} target="_blank" rel="noopener noreferrer">
            IRS
          </a>{" "}
          and the{" "}
          <a href={TAX_SOURCES.stateIncome} target="_blank" rel="noopener noreferrer">
            Tax Foundation
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
