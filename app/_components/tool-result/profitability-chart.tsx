"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProfitByDept } from "@/agent/lib/finance.types";
import {
  AXIS,
  CRITICAL,
  fmtMoney,
  GOOD,
  GRID,
  MUTED,
  scopeSuffix,
  SERIES,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_CURSOR_FILL,
  TOOLTIP_LABEL_STYLE,
} from "../charts";
import type { ChartSize } from "./chart-tooltip";
import { ChartHeader, EmptyState, LegendSwatch } from "./panel";

// Income vs. expense bars per department, sorted most-profitable-first by the
// lib. The net gap between the two bars is the profitability story; the
// tooltip spells the net out (with sign colour) since it isn't a bar itself.
export function ProfitabilityChart({
  action,
  caption,
  departments,
  rows,
  size = "compact",
}: {
  readonly action?: React.ReactNode;
  readonly caption?: string;
  readonly departments?: readonly string[];
  readonly rows: ProfitByDept[];
  readonly size?: ChartSize;
}) {
  const title = `Profitability by department${scopeSuffix([departments])}`;

  if (rows.length === 0) {
    return (
      <div>
        <ChartHeader action={action} caption={caption} title={title} />
        <EmptyState message="No data for this range." />
      </div>
    );
  }

  const netPositive = rows.filter((r) => r.net > 0).length;
  const summary = `${netPositive} of ${rows.length} net-positive`;

  return (
    <div>
      <ChartHeader action={action} caption={caption} title={title} />
      <p className="mb-2 text-muted-foreground text-xs">{summary}</p>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <LegendSwatch color={SERIES[0]} label="Income" />
        <LegendSwatch color={SERIES[1]} label="Expense" />
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
          <Tooltip content={<ProfitTooltip />} cursor={TOOLTIP_CURSOR_FILL} />
          <Bar dataKey="income" fill={SERIES[0]} name="Income" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill={SERIES[1]} name="Expense" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Dedicated tooltip: the two bars plus a net line (green/red by sign) and the
// margin when the department actually booked revenue.
function ProfitTooltip({
  active,
  label,
  payload,
}: {
  readonly active?: boolean;
  readonly label?: string | number;
  readonly payload?: readonly { readonly payload?: ProfitByDept }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const netTone = row.net >= 0 ? GOOD : CRITICAL;
  return (
    <div style={{ ...TOOLTIP_CONTENT_STYLE, minWidth: 180 }}>
      <p style={TOOLTIP_LABEL_STYLE}>{label}</p>
      <div className="flex flex-col gap-1">
        <TooltipRow color={SERIES[0]} label="Income" value={fmtMoney(row.income)} />
        <TooltipRow color={SERIES[1]} label="Expense" value={fmtMoney(row.expense)} />
        <TooltipRow color={netTone} label="Net" value={fmtMoney(row.net)} />
        {row.margin !== null ? (
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-2.5 shrink-0" />
            <span className="text-muted-foreground">Margin</span>
            <span className="ml-auto font-medium tabular-nums">
              {new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(
                row.margin,
              )}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  readonly color: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  );
}
