"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo } from "react";
import type {
  Anomaly,
  BudgetRow,
  CashflowPoint,
  CategorySlice,
  DataOverview,
  ProfitByDept,
  Summary,
  TrendPoint,
} from "@/agent/lib/finance.types";
import { fmtDate, metricLabel, scopeSuffix } from "../charts";
import { AnomalyList } from "./anomaly-list";
import { BudgetChart } from "./budget-chart";
import { CashflowChart } from "./cashflow-chart";
import { CategoryBreakdownChart } from "./category-breakdown-chart";
import { ChartPanel, Panel } from "./panel";
import { ProfitabilityChart } from "./profitability-chart";
import { DataOverviewTiles, SummaryTiles } from "./summary-tiles";
import { TrendChart } from "./trend-chart";

const TOOL_NAMES = new Set([
  "get_summary",
  "get_trend",
  "get_budget_status",
  "get_anomalies",
  "get_category_breakdown",
  "get_cashflow",
  "get_profitability",
  "get_data_overview",
]);

export function isFinanceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export function ToolResultSkeleton() {
  return (
    <div aria-hidden className="h-[280px] w-full animate-pulse rounded-xl border border-border/60 bg-card/40" />
  );
}

// Crossfades the loading skeleton into the real chart/panel once the tool
// call resolves. `layout` animates the height change between the fixed
// 280px skeleton and the chart's natural height instead of letting it jump.
export function FinanceToolSlot({
  input,
  name,
  output,
  state,
}: {
  readonly input?: unknown;
  readonly name: string;
  readonly output: unknown;
  readonly state: "input-available" | "output-available";
}) {
  const shouldReduceMotion = useReducedMotion();

  if (!isFinanceTool(name)) return null;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {state === "output-available" ? (
        <motion.div
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key="result"
          layout
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
        >
          <ToolResult input={input} name={name} output={output} />
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key="skeleton"
          layout
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
        >
          <ToolResultSkeleton />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const ToolResult = memo(
  function ToolResult({
    input,
    name,
    output,
  }: {
    readonly input?: unknown;
    readonly name: string;
    readonly output: unknown;
  }) {
    if (name === "get_summary") return <Panel><SummaryTiles s={output as Summary} /></Panel>;
    if (name === "get_trend") {
      const trendInput = input as { metric?: "income" | "expense"; departments?: string[] } | undefined;
      return (
        <ChartPanel
          render={(size, action) => (
            <TrendChart
              action={action}
              departments={trendInput?.departments}
              metric={trendInput?.metric}
              points={output as TrendPoint[]}
              size={size}
            />
          )}
          title={`${metricLabel(trendInput?.metric) ?? "Monthly"} trend${scopeSuffix([trendInput?.departments])}`}
        />
      );
    }
    if (name === "get_budget_status") {
      const budgetInput = input as { month?: string; departments?: string[] } | undefined;
      return (
        <ChartPanel
          render={(size, action) => (
            <BudgetChart
              action={action}
              departments={budgetInput?.departments}
              month={budgetInput?.month}
              rows={output as BudgetRow[]}
              size={size}
            />
          )}
          title={`Budget vs. actual${scopeSuffix([budgetInput?.departments])}`}
        />
      );
    }
    if (name === "get_anomalies") {
      const anomalyInput = input as { departments?: string[]; categories?: string[] } | undefined;
      return (
        <Panel>
          <AnomalyList
            categories={anomalyInput?.categories}
            departments={anomalyInput?.departments}
            rows={output as Anomaly[]}
          />
        </Panel>
      );
    }
    if (name === "get_category_breakdown") {
      const { slices } = output as { slices: CategorySlice[]; otherCategories: string[] };
      const breakdownInput = input as
        | { metric?: "income" | "expense"; department?: string; category?: string }
        | undefined;
      return (
        <ChartPanel
          render={(size, action) => (
            <CategoryBreakdownChart
              action={action}
              category={breakdownInput?.category}
              department={breakdownInput?.department}
              metric={breakdownInput?.metric}
              size={size}
              slices={slices}
            />
          )}
          title={`${metricLabel(breakdownInput?.metric) ?? "Expense"} breakdown${scopeSuffix([
            breakdownInput?.department,
            breakdownInput?.category,
          ])}`}
        />
      );
    }
    if (name === "get_cashflow")
      return (
        <ChartPanel
          render={(size, action) => <CashflowChart action={action} points={output as CashflowPoint[]} size={size} />}
          title="Cash flow"
        />
      );
    if (name === "get_profitability") {
      const profitInput = input as { from?: string; to?: string; departments?: string[] } | undefined;
      const caption =
        profitInput?.from && profitInput?.to
          ? `${fmtDate(profitInput.from)} – ${fmtDate(profitInput.to)}`
          : undefined;
      return (
        <ChartPanel
          render={(size, action) => (
            <ProfitabilityChart
              action={action}
              caption={caption}
              departments={profitInput?.departments}
              rows={output as ProfitByDept[]}
              size={size}
            />
          )}
          title={`Profitability by department${scopeSuffix([profitInput?.departments])}`}
        />
      );
    }
    if (name === "get_data_overview")
      return <Panel><DataOverviewTiles o={output as DataOverview} /></Panel>;
    return null;
  },
  (prev, next) =>
    prev.name === next.name && prev.output === next.output && prev.input === next.input,
);
