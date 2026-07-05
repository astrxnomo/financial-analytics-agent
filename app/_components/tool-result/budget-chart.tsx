"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BudgetRow } from "@/agent/lib/finance.types";
import { AXIS, CRITICAL, fmtMoney, fmtMonth, GRID, MUTED, scopeSuffix, SERIES, TOOLTIP_CURSOR_FILL } from "../charts";
import { ChartTooltip, type ChartSize } from "./chart-tooltip";
import { ChartHeader, EmptyState, LegendSwatch } from "./panel";

export function BudgetChart({
  action,
  departments,
  month,
  rows,
  size = "compact",
}: {
  readonly action?: React.ReactNode;
  readonly departments?: readonly string[];
  readonly month?: string;
  readonly rows: BudgetRow[];
  readonly size?: ChartSize;
}) {
  // get_budget_status only ever covers a single month (there's no multi-month
  // aggregation in the lib) — the caption always names that exact month so a
  // "this year" question can never read as if it were an annual total.
  const caption = month ? fmtMonth(month) : undefined;
  const title = `Budget vs. actual${scopeSuffix([departments])}`;

  if (rows.length === 0) {
    return (
      <div>
        <ChartHeader action={action} caption={caption} title={title} />
        <EmptyState message="No budget data for this month." />
      </div>
    );
  }

  const overCount = rows.filter((r) => r.actual > r.budget).length;
  const overBudgetSummary =
    overCount === 0 ? "All departments within budget" : `${overCount} of ${rows.length} over budget`;

  return (
    <div>
      <ChartHeader action={action} caption={caption} title={title} />
      <p className="mb-2 text-muted-foreground text-xs">{overBudgetSummary}</p>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <LegendSwatch color={SERIES[0]} label="Budget" />
        <LegendSwatch color={SERIES[1]} label="Actual" />
        <LegendSwatch color={CRITICAL} label="Over budget" />
      </div>
      <ResponsiveContainer debounce={200} height={size === "large" ? 640 : 360} width="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            axisLine={{ stroke: AXIS }}
            dataKey="department"
            stroke={MUTED}
            tick={{ fontSize: 12, fill: MUTED }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            stroke={MUTED}
            tick={{ fontSize: 12, fill: MUTED }}
            tickFormatter={(v) => fmtMoney(Number(v))}
            tickLine={false}
            width={72}
          />
          <Tooltip
            content={
              <ChartTooltip
                colorFor={(item) => {
                  if (item.dataKey !== "actual") return item.color;
                  const row = item.payload as { actual?: number; budget?: number } | undefined;
                  return row && row.actual !== undefined && row.budget !== undefined && row.actual > row.budget
                    ? CRITICAL
                    : SERIES[1];
                }}
                sort="none"
              />
            }
            cursor={TOOLTIP_CURSOR_FILL}
          />
          <Bar dataKey="budget" fill={SERIES[0]} name="Budget" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" fill={SERIES[1]} name="Actual" radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => (
              <Cell fill={r.actual > r.budget ? CRITICAL : SERIES[1]} key={r.department ?? i} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
