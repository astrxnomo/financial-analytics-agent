"use client";

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
import type { TrendPoint } from "@/agent/lib/finance.types";
import { AXIS, fmtDate, fmtMoney, GRID, monthRange, MUTED, SERIES, TOOLTIP_CURSOR_FILL } from "../charts";
import { ChartTooltip, type ChartSize } from "./chart-tooltip";
import { ChartHeader, EmptyState } from "./panel";

export function TrendChart({
  action,
  points,
  size = "compact",
}: {
  readonly action?: React.ReactNode;
  readonly points: TrendPoint[];
  readonly size?: ChartSize;
}) {
  if (points.length === 0) {
    return (
      <div>
        <ChartHeader action={action} title="Monthly trend" />
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
          <ChartHeader action={action} caption={caption} title="Amount" />
          <div className="w-fit min-w-36 rounded-lg bg-muted/40 px-4 py-3">
            <div className="font-semibold text-2xl tabular-nums">
              {fmtMoney(points[0]?.value ?? 0)}
            </div>
          </div>
        </div>
      );
    }

    const rows = points.map((p) => ({ department: p.department ?? "—", value: p.value }));
    const rowColor = (department: string) =>
      SERIES[rows.findIndex((r) => r.department === department) % SERIES.length];
    return (
      <div>
        <ChartHeader action={action} caption={caption} title="Totals by department" />
        <ResponsiveContainer debounce={200} height={size === "large" ? 640 : 320} width="100%">
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
                  colorFor={(item) => rowColor(String(item.payload?.department ?? ""))}
                />
              }
              cursor={TOOLTIP_CURSOR_FILL}
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
        <ChartHeader action={action} caption={caption} title="Monthly trend" />
        <ResponsiveContainer debounce={200} height={size === "large" ? 640 : 320} width="100%">
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
              content={<ChartTooltip labelFormatter={(v) => fmtDate(String(v))} />}
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
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
      <ChartHeader action={action} caption={caption} title="Monthly trend by department" />
      <ResponsiveContainer debounce={200} height={size === "large" ? 680 : 360} width="100%">
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
            content={<ChartTooltip labelFormatter={(v) => fmtDate(String(v))} />}
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
