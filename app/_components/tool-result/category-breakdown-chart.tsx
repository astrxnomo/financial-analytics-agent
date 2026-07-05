"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORY_BREAKDOWN_TOP_N, type CategorySlice } from "@/agent/lib/finance.types";
import { AXIS, fmtDate, fmtMoney, GRID, metricLabel, monthRange, MUTED, scopeSuffix, SERIES } from "../charts";
import { ChartTooltip, type ChartSize } from "./chart-tooltip";
import { ChartHeader, EmptyState } from "./panel";

const OTHER_COLOR = "var(--chart-muted)";
const MAX_STACK_CATEGORIES = CATEGORY_BREAKDOWN_TOP_N;

// Stacked area of monthly totals per category; a single month renders as a
// donut instead (no time axis to stack along).
export function CategoryBreakdownChart({
  action,
  category,
  department,
  metric,
  size = "compact",
  slices,
}: {
  readonly action?: React.ReactNode;
  readonly category?: string;
  readonly department?: string;
  readonly metric?: "income" | "expense";
  readonly size?: ChartSize;
  readonly slices: CategorySlice[];
}) {
  // get_category_breakdown defaults to "expense" server-side when metric is
  // omitted, so the title defaults the same way instead of falling back to a
  // vague "Monthly" the way the trend chart does.
  const mixWord = metricLabel(metric) ?? "Expense";
  const scope = scopeSuffix([department, category]);

  if (slices.length === 0) {
    return (
      <div>
        <ChartHeader action={action} title={`${mixWord} breakdown${scope}`} />
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
        <ChartHeader action={action} caption={caption} title={`${mixWord} mix${scope}`} />
        <ResponsiveContainer debounce={200} height={size === "large" ? 620 : 340} width="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={size === "large" ? 110 : 70}
              nameKey="name"
              outerRadius={size === "large" ? 220 : 120}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell fill={d.fill} key={d.name} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip colorFor={(item) => item.payload?.fill as string | undefined} sort="none" />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        {hasOther ? <OtherNote categories={ranked.slice(top.length)} /> : null}
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
      <ChartHeader action={action} caption={caption} title={`${mixWord} breakdown${scope}`} />
      <ResponsiveContainer debounce={200} height={size === "large" ? 640 : 360} width="100%">
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
            content={<ChartTooltip labelFormatter={(v) => fmtDate(String(v))} sort="none" />}
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
      {hasOther ? <OtherNote categories={ranked.slice(top.length)} /> : null}
    </div>
  );
}

// The stacked/pie chart only draws the top MAX_STACK_CATEGORIES by total —
// past that, everything folds into a single "Other" band (a deliberate
// dataviz-skill limit: past ~5 categorical hues, series stop being reliably
// distinguishable). This makes that fold-in legible instead of opaque, since
// the agent's text answer can't see the rendered chart and has no way to
// know a viewer is looking at an unlabeled "Other" slice.
function OtherNote({ categories }: { readonly categories: readonly string[] }) {
  if (categories.length === 0) return null;
  return (
    <p className="mt-2 text-muted-foreground text-xs">
      <span className="font-medium">Other</span> includes: {categories.join(", ")}.
    </p>
  );
}
