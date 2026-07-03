"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import { useEffect, useState } from "react";

// Index-aligned with the [trend, budget, anomaly, summary, cashflow,
// breakdown, deptTrend, growth] question order from buildQuestions.
export const QUESTION_TOPICS = [
  "Revenue",
  "Budgets",
  "Anomalies",
  "P&L",
  "Cash flow",
  "Spend mix",
  "By department",
  "Growth",
] as const;

// Shown before the /api/finance/highlights fetch resolves, or if it fails —
// generic but always answerable.
const FALLBACK_QUESTIONS = [
  "Show me the revenue trend for the last 6 months.",
  "Which departments are over budget this month?",
  "Any unusual expenses in the last year?",
  "What were total income and expenses this year?",
  "How is our cash flow trending?",
  "What do we spend the most on?",
  "Compare Engineering and Sales spending over the last 2 years.",
  "Which revenue category has grown the fastest?",
];

// timeZone: "UTC" — seed dates are date-only ISO strings; parsing them as UTC
// midnight and formatting in local time would shift them back a day (e.g.
// 2025-01-01 rendering as "Dec 2024" west of Greenwich).
const fmtMonthLong = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );

export const fmtMonthShort = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );

export const fmtMoneyShort = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

// Deterministic questions grounded in the real seeded data (date coverage,
// the biggest detected anomaly, the department that's over budget most
// often) — no extra model round-trip, so there's no risk of the model
// looping on a "suggest more" instruction.
function buildQuestions(h: Highlights): readonly string[] {
  const trend = `Show me the revenue trend from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}.`;
  const budget = h.mostOverBudgetDept
    ? `Why does ${h.mostOverBudgetDept.department} keep going over budget?`
    : `Which departments are over budget in ${fmtMonthLong(h.latestMonth)}?`;
  const anomaly = h.topAnomaly
    ? `Why was there a ${fmtMoneyShort(h.topAnomaly.amount)} ${h.topAnomaly.category} spike in ${h.topAnomaly.department}?`
    : `Any unusual expenses from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const summary = `What were total income and expenses from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const cashflow = `How did cash flow evolve from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const breakdown = `What did we spend the most on from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  // Distinct from `trend`: forces groupBy: "department" so the chart renders
  // multiple lines instead of one, showing off the whole data range.
  const deptTrend = `Compare monthly expenses across departments from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}.`;
  // fastestGrowingCategory is computed server-side from real first-half vs.
  // second-half totals (see getHighlights) — not a guess at what's growing.
  const growth = h.fastestGrowingCategory
    ? `${h.fastestGrowingCategory.category} grew ${h.fastestGrowingCategory.multiple.toFixed(1)}x — show me how.`
    : "Which revenue category has grown the fastest?";
  return [trend, budget, anomaly, summary, cashflow, breakdown, deptTrend, growth];
}

export function useFinanceHighlights(): {
  readonly highlights: Highlights | undefined;
  readonly questions: readonly string[];
} {
  const [highlights, setHighlights] = useState<Highlights>();
  const [questions, setQuestions] = useState<readonly string[]>(FALLBACK_QUESTIONS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/finance/highlights")
      .then((res) => (res.ok ? (res.json() as Promise<Highlights>) : undefined))
      .then((data) => {
        if (data && !cancelled) {
          setHighlights(data);
          setQuestions(buildQuestions(data));
        }
      })
      .catch(() => {
        // Keep the fallback list — still fully usable without a live DB.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { highlights, questions };
}
