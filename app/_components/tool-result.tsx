"use client";

import { SearchXIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Anomaly, BudgetRow, Summary, TrendPoint } from "@/agent/lib/finance.types";
import {
  AXIS,
  CRITICAL,
  fmtDate,
  fmtMoney,
  fmtSigma,
  GOOD,
  GRID,
  monthRange,
  MUTED,
  SERIES,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_CURSOR_FILL,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from "./charts";

const TOOL_NAMES = new Set([
  "get_summary",
  "get_trend",
  "get_budget_status",
  "get_anomalies",
]);

export function isFinanceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export function ToolResultSkeleton() {
  return (
    <div aria-hidden className="h-[280px] w-full animate-pulse rounded-lg bg-muted/50" />
  );
}

export const ToolResult = memo(
  function ToolResult({ name, output }: { readonly name: string; readonly output: unknown }) {
    if (name === "get_summary") return <SummaryTiles s={output as Summary} />;
    if (name === "get_trend") return <TrendChart points={output as TrendPoint[]} />;
    if (name === "get_budget_status") return <BudgetChart rows={output as BudgetRow[]} />;
    if (name === "get_anomalies") return <AnomalyList rows={output as Anomaly[]} />;
    return null;
  },
  (prev, next) => prev.name === next.name && prev.output === next.output,
);

function ChartHeader({
  title,
  caption,
}: {
  readonly title: string;
  readonly caption?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="font-medium text-sm">{title}</h3>
      {caption ? <span className="text-muted-foreground text-xs">{caption}</span> : null}
    </div>
  );
}

function EmptyState({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
      <SearchXIcon className="size-5 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function SummaryTiles({ s }: { readonly s: Summary }) {
  const netIsPositive = s.net >= 0;
  const tiles = [
    { label: "Income", value: s.income },
    { label: "Expense", value: s.expense },
    {
      icon: netIsPositive ? TrendingUpIcon : TrendingDownIcon,
      label: "Net",
      tone: netIsPositive ? GOOD : CRITICAL,
      value: s.net,
    },
  ];
  return (
    <div>
      <ChartHeader caption={`${fmtDate(s.from)} – ${fmtDate(s.to)}`} title="Summary" />
      <div className="flex flex-wrap gap-3">
        {tiles.map((t) => (
          <div className="min-w-36 rounded-lg border px-4 py-3" key={t.label}>
            <div className="text-muted-foreground text-xs">{t.label}</div>
            <div
              className="flex items-center gap-1 font-semibold text-xl tabular-nums"
              style={t.tone ? { color: t.tone } : undefined}
            >
              {t.icon ? <t.icon className="size-4 shrink-0" /> : null}
              {fmtMoney(t.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ points }: { readonly points: TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div>
        <ChartHeader title="Monthly trend" />
        <EmptyState message="No data for this range." />
      </div>
    );
  }

  const byDept = points.some((p) => p.department);
  const periods = [...new Set(points.map((p) => p.period))];
  const caption = monthRange(periods);

  // A single time bucket has nothing to draw a line between — compare
  // categories with bars instead (see dataviz skill: form follows the job).
  if (periods.length <= 1) {
    if (!byDept) {
      return (
        <div>
          <ChartHeader caption={caption} title="Amount" />
          <div className="w-fit min-w-36 rounded-lg border px-4 py-3">
            <div className="font-semibold text-2xl tabular-nums">
              {fmtMoney(points[0]?.value ?? 0)}
            </div>
          </div>
        </div>
      );
    }

    const rows = points.map((p) => ({ department: p.department ?? "—", value: p.value }));
    return (
      <div>
        <ChartHeader caption={caption} title="Totals by department" />
        <ResponsiveContainer debounce={200} height={280} width="100%">
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
              contentStyle={TOOLTIP_CONTENT_STYLE}
              cursor={TOOLTIP_CURSOR_FILL}
              formatter={(v) => fmtMoney(Number(v))}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => (
                <Cell fill={SERIES[i % SERIES.length]} key={r.department} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (!byDept) {
    return (
      <div>
        <ChartHeader caption={caption} title="Monthly trend" />
        <ResponsiveContainer debounce={200} height={280} width="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              axisLine={{ stroke: AXIS }}
              dataKey="period"
              stroke={MUTED}
              tick={{ fontSize: 12, fill: MUTED }}
              tickFormatter={(v) => fmtDate(String(v))}
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
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={(v) => fmtMoney(Number(v))}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelFormatter={(v) => fmtDate(String(v))}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Line
              dataKey="value"
              dot={false}
              name="Amount"
              stroke={SERIES[0]}
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const depts = [...new Set(points.map((p) => p.department as string))];
  const data = periods.map((period) => {
    const row: Record<string, number | string> = { period };
    for (const d of depts) {
      row[d] = points.find((p) => p.period === period && p.department === d)?.value ?? 0;
    }
    return row;
  });

  return (
    <div>
      <ChartHeader caption={caption} title="Monthly trend by department" />
      <ResponsiveContainer debounce={200} height={300} width="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            axisLine={{ stroke: AXIS }}
            dataKey="period"
            stroke={MUTED}
            tick={{ fontSize: 12, fill: MUTED }}
            tickFormatter={(v) => fmtDate(String(v))}
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
            contentStyle={TOOLTIP_CONTENT_STYLE}
            formatter={(v) => fmtMoney(Number(v))}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelFormatter={(v) => fmtDate(String(v))}
            labelStyle={TOOLTIP_LABEL_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {depts.map((d, i) => (
            <Line
              dataKey={d}
              dot={false}
              key={d}
              name={d}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BudgetChart({ rows }: { readonly rows: BudgetRow[] }) {
  if (rows.length === 0) {
    return (
      <div>
        <ChartHeader title="Budget vs. actual" />
        <EmptyState message="No budget data for this month." />
      </div>
    );
  }

  const overCount = rows.filter((r) => r.actual > r.budget).length;
  const caption =
    overCount === 0
      ? "All departments within budget"
      : `${overCount} of ${rows.length} over budget`;

  return (
    <div>
      <ChartHeader caption={caption} title="Budget vs. actual" />
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <LegendSwatch color={SERIES[0]} label="Budget" />
        <LegendSwatch color={SERIES[1]} label="Actual" />
        <LegendSwatch color={CRITICAL} label="Over budget" />
      </div>
      <ResponsiveContainer debounce={200} height={300} width="100%">
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
            contentStyle={TOOLTIP_CONTENT_STYLE}
            cursor={TOOLTIP_CURSOR_FILL}
            formatter={(v) => fmtMoney(Number(v))}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
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

function LegendSwatch({ color, label }: { readonly color: string; readonly label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function AnomalyList({ rows }: { readonly rows: Anomaly[] }) {
  if (rows.length === 0) {
    return (
      <div>
        <ChartHeader title="Unusual transactions" />
        <EmptyState message="No anomalies found in this range." />
      </div>
    );
  }

  return (
    <div>
      <ChartHeader
        caption={monthRange(rows.map((r) => r.date))}
        title={`${rows.length} unusual ${rows.length === 1 ? "transaction" : "transactions"}`}
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              {["Date", "Department", "Category", "Amount", "Category avg", "Deviation"].map(
                (h) => (
                  <th
                    className="border-b px-3 py-2 text-left font-medium text-muted-foreground"
                    key={h}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{fmtDate(r.date)}</td>
                <td className="px-3 py-2">{r.department}</td>
                <td className="px-3 py-2">{r.category}</td>
                <td className="px-3 py-2 font-medium tabular-nums" style={{ color: CRITICAL }}>
                  {fmtMoney(r.amount)}
                </td>
                <td className="px-3 py-2 text-muted-foreground tabular-nums">
                  {fmtMoney(r.categoryMean)}
                </td>
                <td className="px-3 py-2 tabular-nums" style={{ color: CRITICAL }}>
                  {fmtSigma(r.amount, r.categoryMean, r.categoryStdDev) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
