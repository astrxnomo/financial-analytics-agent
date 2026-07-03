"use client";

import { memo } from "react";
import type {
  Anomaly,
  BudgetRow,
  CashflowPoint,
  CategorySlice,
  DataOverview,
  Summary,
  TrendPoint,
} from "@/agent/lib/finance.types";
import { AnomalyList } from "./anomaly-list";
import { BudgetChart } from "./budget-chart";
import { CashflowChart } from "./cashflow-chart";
import { CategoryBreakdownChart } from "./category-breakdown-chart";
import { ChartPanel, Panel } from "./panel";
import { DataOverviewTiles, SummaryTiles } from "./summary-tiles";
import { TrendChart } from "./trend-chart";

const TOOL_NAMES = new Set([
  "get_summary",
  "get_trend",
  "get_budget_status",
  "get_anomalies",
  "get_category_breakdown",
  "get_cashflow",
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

export const ToolResult = memo(
  function ToolResult({ name, output }: { readonly name: string; readonly output: unknown }) {
    if (name === "get_summary") return <Panel><SummaryTiles s={output as Summary} /></Panel>;
    if (name === "get_trend")
      return (
        <ChartPanel
          render={(size, action) => <TrendChart action={action} points={output as TrendPoint[]} size={size} />}
          title="Trend"
        />
      );
    if (name === "get_budget_status")
      return (
        <ChartPanel
          render={(size, action) => <BudgetChart action={action} rows={output as BudgetRow[]} size={size} />}
          title="Budget vs. actual"
        />
      );
    if (name === "get_anomalies") return <Panel><AnomalyList rows={output as Anomaly[]} /></Panel>;
    if (name === "get_category_breakdown") {
      const { slices } = output as { slices: CategorySlice[]; otherCategories: string[] };
      return (
        <ChartPanel
          render={(size, action) => <CategoryBreakdownChart action={action} size={size} slices={slices} />}
          title="Category breakdown"
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
    if (name === "get_data_overview")
      return <Panel><DataOverviewTiles o={output as DataOverview} /></Panel>;
    return null;
  },
  (prev, next) => prev.name === next.name && prev.output === next.output,
);
