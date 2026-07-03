"use client";

import { SearchXIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { memo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Anomaly,
  BudgetRow,
  CashflowPoint,
  CategorySlice,
  Summary,
  TrendPoint,
} from "@/agent/lib/finance.types";
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
  "get_category_breakdown",
  "get_cashflow",
]);

export function isFinanceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export function ToolResultSkeleton() {
  return (
    <div aria-hidden className="h-[280px] w-full animate-pulse rounded-xl border border-border/60 bg-card/40" />
  );
}

// Report-style panel so charts and tables read as documents, not floating
// fragments.
function Panel({ children }: { readonly children: React.ReactNode }) {
  return <div className="rounded-xl border border-border/60 bg-card/40 p-4">{children}</div>;
}

export const ToolResult = memo(
  function ToolResult({ name, output }: { readonly name: string; readonly output: unknown }) {
    if (name === "get_summary") return <Panel><SummaryTiles s={output as Summary} /></Panel>;
    if (name === "get_trend") return <Panel><TrendChart points={output as TrendPoint[]} /></Panel>;
    if (name === "get_budget_status")
      return <Panel><BudgetChart rows={output as BudgetRow[]} /></Panel>;
    if (name === "get_anomalies") return <Panel><AnomalyList rows={output as Anomaly[]} /></Panel>;
    if (name === "get_category_breakdown")
      return <Panel><CategoryBreakdownChart slices={output as CategorySlice[]} /></Panel>;
    if (name === "get_cashflow")
      return <Panel><CashflowChart points={output as CashflowPoint[]} /></Panel>;
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
          <div className="min-w-36 flex-1 rounded-lg bg-muted/40 px-4 py-3" key={t.label}>
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
          <div className="w-fit min-w-36 rounded-lg bg-muted/40 px-4 py-3">
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

const OTHER_COLOR = "var(--chart-muted)";
const MAX_STACK_CATEGORIES = 5;

// Stacked area of monthly totals per category; a single month renders as a
// donut instead (no time axis to stack along).
function CategoryBreakdownChart({ slices }: { readonly slices: CategorySlice[] }) {
  if (slices.length === 0) {
    return (
      <div>
        <ChartHeader title="Category breakdown" />
        <EmptyState message="No data for this range." />
      </div>
    );
  }

  const periods = [...new Set(slices.map((s) => s.period))].sort();
  const caption = monthRange(periods);

  // Rank categories by total; everything past the palette folds into Other.
  const totals = new Map<string, number>();
  for (const s of slices) totals.set(s.category, (totals.get(s.category) ?? 0) + s.value);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const top = ranked.slice(0, MAX_STACK_CATEGORIES);
  const hasOther = ranked.length > top.length;

  if (periods.length <= 1) {
    const data = top.map((name, i) => ({
      fill: SERIES[i % SERIES.length],
      name,
      value: totals.get(name) ?? 0,
    }));
    if (hasOther) {
      const otherTotal = ranked.slice(top.length).reduce((sum, n) => sum + (totals.get(n) ?? 0), 0);
      data.push({ fill: OTHER_COLOR, name: "Other", value: otherTotal });
    }
    return (
      <div>
        <ChartHeader caption={caption} title="Category mix" />
        <ResponsiveContainer debounce={200} height={280} width="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={60}
              nameKey="name"
              outerRadius={100}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell fill={d.fill} key={d.name} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={(v) => fmtMoney(Number(v))}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const data = periods.map((period) => {
    const row: Record<string, number | string> = { period };
    for (const name of top) row[name] = 0;
    if (hasOther) row.Other = 0;
    for (const s of slices) {
      if (s.period !== period) continue;
      const key = top.includes(s.category) ? s.category : "Other";
      row[key] = (row[key] as number) + s.value;
    }
    return row;
  });

  return (
    <div>
      <ChartHeader caption={caption} title="Category breakdown" />
      <ResponsiveContainer debounce={200} height={300} width="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
          {top.map((name, i) => (
            <Area
              dataKey={name}
              fill={SERIES[i % SERIES.length]}
              fillOpacity={0.35}
              key={name}
              stackId="mix"
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={1.5}
              type="monotone"
            />
          ))}
          {hasOther ? (
            <Area
              dataKey="Other"
              fill={OTHER_COLOR}
              fillOpacity={0.25}
              stackId="mix"
              stroke={OTHER_COLOR}
              strokeWidth={1.5}
              type="monotone"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Monthly income vs. expense bars with the cumulative net position overlaid
// as a line — shows both the rhythm and where the balance is heading.
function CashflowChart({ points }: { readonly points: CashflowPoint[] }) {
  if (points.length === 0) {
    return (
      <div>
        <ChartHeader title="Cash flow" />
        <EmptyState message="No data for this range." />
      </div>
    );
  }

  const caption = monthRange(points.map((p) => p.period));
  const endNet = points.at(-1)?.cumulativeNet ?? 0;

  return (
    <div>
      <ChartHeader
        caption={caption}
        title={`Cash flow — cumulative net ${fmtMoney(endNet)}`}
      />
      <ResponsiveContainer debounce={200} height={300} width="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
            cursor={TOOLTIP_CURSOR_FILL}
            formatter={(v) => fmtMoney(Number(v))}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelFormatter={(v) => fmtDate(String(v))}
            labelStyle={TOOLTIP_LABEL_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" fill={SERIES[1]} name="Income" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill={SERIES[2]} name="Expense" radius={[4, 4, 0, 0]} />
          <Line
            dataKey="cumulativeNet"
            dot={false}
            name="Cumulative net"
            stroke={SERIES[4]}
            strokeWidth={2}
            type="monotone"
          />
        </ComposedChart>
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
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/30">
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
              <tr className="transition-colors hover:bg-muted/20" key={r.id}>
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
