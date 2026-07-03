"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CashflowPoint } from "@/agent/lib/finance.types";
import { AXIS, fmtDate, fmtMoney, GRID, monthRange, MUTED, SERIES, TOOLTIP_CURSOR_FILL } from "../charts";
import { ChartTooltip, type ChartSize } from "./chart-tooltip";
import { ChartHeader, EmptyState } from "./panel";

// Monthly income vs. expense bars with the cumulative net position overlaid
// as a line — shows both the rhythm and where the balance is heading.
export function CashflowChart({
  action,
  points,
  size = "compact",
}: {
  readonly action?: React.ReactNode;
  readonly points: CashflowPoint[];
  readonly size?: ChartSize;
}) {
  if (points.length === 0) {
    return (
      <div>
        <ChartHeader action={action} title="Cash flow" />
        <EmptyState message="No data for this range." />
      </div>
    );
  }

  const caption = monthRange(points.map((p) => p.period));
  const endNet = points.at(-1)?.cumulativeNet ?? 0;

  return (
    <div>
      <ChartHeader
        action={action}
        caption={caption}
        title={`Cash flow — cumulative net ${fmtMoney(endNet)}`}
      />
      <ResponsiveContainer debounce={200} height={size === "large" ? 640 : 360} width="100%">
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
            content={<ChartTooltip labelFormatter={(v) => fmtDate(String(v))} sort="none" />}
            cursor={TOOLTIP_CURSOR_FILL}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
