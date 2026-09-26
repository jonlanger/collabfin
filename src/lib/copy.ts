import type { CardKind } from "@/lib/engine";

export interface Tip {
  what: string;
  best: string;
}

/** "How it works" and "Best practice" for each card, shown in its (i) tip. */
export const TIPS: Record<CardKind | "savings" | "cd" | "investment", Tip> = {
  income: { what: "Money coming in. The amount is converted to a monthly figure from how often it arrives.", best: "Use take-home pay after tax and deductions. If your income varies, plan on a typical slow month, not your best one." },
  spend: { what: "A budget for spending that changes month to month, counted as money going out.", best: "Check your last two months of statements before you pick a number, or import them. Weekly budgets are easier to stick to for groceries and dining." },
  recurring: { what: "Bills that repeat. Each line has its own schedule, and quarterly or yearly bills are spread across the months.", best: "Include yearly and quarterly bills such as insurance and renewals. Those are the ones that catch people out. Review subscriptions twice a year." },
  account: { what: "Adds up everything linked into it and projects the balance. Money sent on through Split cards leaves the account.", best: "Keep at least one month of expenses in checking as a buffer. You can set the buffer in Settings." },
  savings: { what: "Grows with interest, compounded monthly from the APY, plus anything linked in.", best: "A high-yield savings account suits an emergency fund. Compare rates every few months. Interest counts as taxable income." },
  cd: { what: "A fixed deposit that earns a set APY until it matures. You can’t add money after it opens, so it takes no links.", best: "Only lock up money you won’t need before the maturity date, since cashing out early usually costs several months of interest. Staggering CDs (a ladder) keeps some money coming free every few months." },
  investment: { what: "Projects growth at an average yearly return you choose, minus fees, plus anything linked in. It also shows a lower and a higher case.", best: "This is a projection, not a promise. Markets rise and fall, and any single year can be negative. Money you’ll need within about five years is usually kept out of stocks." },
  debt: { what: "Your monthly payment counts as money going out. The card works out the payoff date and total interest from the balance and rate.", best: "Pay the minimum on every debt, then put any extra on the highest rate first (the avalanche method). It saves the most interest." },
  tax: { what: "Estimates taxes from 2026 federal rates and your state’s rates. Paycheck mode turns a salary into monthly take-home pay you can link to an account.", best: "Check the result against a recent pay stub and adjust the pre-tax deductions until it roughly matches. This is an estimate, not tax advice." },
  split: { what: "Sends a percentage of what comes into the card before it. The card before keeps the rest. Splits from one card can add up to 100% at most.", best: "Pay yourself first by moving savings on payday, before you spend. 50/30/20 (needs, wants, savings) is a common starting point." },
  goal: { what: "Shows when you reach the target at the rate money flows in.", best: "An emergency fund usually covers 3 to 6 months of expenses. Keep it in a separate savings account so it isn’t spent by accident." },
  note: { what: "A sticky note. It doesn’t affect any totals.", best: "Use notes for decisions and reminders, like when a bill renews." },
  file: { what: "A file shared with everyone on the board.", best: "Export bank statements as CSV so you can import them into cards." },
};

export const FIELD_TIPS = {
  incomeAmount: "Take-home amount for each payment, after tax.",
  spendAmount: "How much you plan to spend in each period. Pick weekly for groceries and dining.",
  balance: "What the account holds today. Use a minus sign if it’s overdrawn.",
  pct: "The share of money coming into this card that it sends on. The card before keeps the rest.",
  target: "The total you want to have saved.",
  saved: "What is already set aside for this goal.",
  horizon: "How far ahead to project the balance.",
  debtBalance: "What you still owe today.",
  apr: "The yearly interest rate (APR) from your statement.",
  payment: "The minimum you must pay each month.",
  extra: "Anything you pay on top of the minimum. Even small amounts shorten the payoff a lot.",
  apy: "The annual percentage yield your bank quotes. It already includes compounding.",
  term: "How long the money is locked in.",
  opened: "The month the CD started. The maturity date is worked out from this.",
  ret: "The average yearly return you want to assume. The card also shows 3 points lower and higher.",
  fees: "Yearly fund and advisory fees (the expense ratio). They come off the return.",
  taxPct: "Tax on interest or gains, as a share of what you earn. Use 0 for a 401(k), IRA or other tax-advantaged account.",
  gross: "Yearly salary or wages before any tax or deductions.",
  pretax: "Yearly 401(k), HSA and health premiums taken out before tax. These lower your income tax.",
  homeValue: "What the home is worth, or its assessed value if you know it.",
  propRate: "Filled in with your state’s average effective rate. Replace it with the rate from your tax bill if you have one.",
  salesRate: "Your state’s average combined state and local rate. Your city’s rate may differ.",
  salesSpend: "Monthly spending on things that are taxed. Groceries and services often aren’t.",
} as const;
