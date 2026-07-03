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
  "Which department is closest to going over budget, and how does it compare to Finance?",
  "Any unusual expenses in the last year, and are they likely to recur?",
  "What were total income and expenses this year?",
  "How is our cash flow trending?",
  "Break down every expense category for the last year — what's driving the total?",
  "Compare monthly expenses across all departments — which one is the biggest driver?",
  "Which revenue category has grown the fastest, and where is it headed next quarter?",
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

// Fixed department roster (see AGENTS.md: exactly 5, several places assume
// this) — used to pick a second department to contrast mostOverBudgetDept
// against, so the budget question exercises get_budget_status's
// `departments` filter (a tight 2-bar comparison) instead of dumping all 5.
const DEPARTMENTS = ["Engineering", "Marketing", "Sales", "Operations", "Finance"] as const;

// Deterministic questions grounded in the real seeded data (date coverage,
// the biggest detected anomaly, the department that's over budget most
// often) — no extra model round-trip, so there's no risk of the model
// looping on a "suggest more" instruction.
function buildQuestions(h: Highlights): readonly string[] {
  const trend = `Show me the revenue trend from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}.`;
  const budget = h.mostOverBudgetDept
    ? (() => {
        // Prefer contrasting against Finance (typically the most controlled
        // budget); fall back to the first department that isn't the
        // over-budget one, in case Finance itself is the one struggling.
        const contrast =
          DEPARTMENTS.find((d) => d === "Finance" && d !== h.mostOverBudgetDept?.department) ??
          DEPARTMENTS.find((d) => d !== h.mostOverBudgetDept?.department) ??
          "Finance";
        return `Why does ${h.mostOverBudgetDept.department} keep going over budget, and how does that compare to ${contrast}?`;
      })()
    : `Which departments are over budget in ${fmtMonthLong(h.latestMonth)}?`;
  const anomaly = h.topAnomaly
    ? `Why was there a ${fmtMoneyShort(h.topAnomaly.amount)} ${h.topAnomaly.category} spike in ${h.topAnomaly.department}, and is it likely to happen again?`
    : `Any unusual expenses from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const summary = `What were total income and expenses from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const cashflow = `How did cash flow evolve from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const breakdown = `Break down every expense category from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)} — what's driving the total?`;
  // Distinct from `trend`: forces groupBy: "department" so the chart renders
  // multiple lines instead of one, showing off the whole data range.
  const deptTrend = `Compare monthly expenses across all departments from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)} — which one is the biggest driver?`;
  // fastestGrowingCategory is computed server-side from real first-half vs.
  // second-half totals (see getHighlights) — not a guess at what's growing.
  const growth = h.fastestGrowingCategory
    ? `${h.fastestGrowingCategory.category} grew ${h.fastestGrowingCategory.multiple.toFixed(1)}x — show me the trend and where it's headed next quarter.`
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
