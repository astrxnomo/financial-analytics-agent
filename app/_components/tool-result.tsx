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
import type { Anomaly, BudgetRow, Summary, TrendPoint } from "@/agent/lib/finance.types";
import { AXIS, CRITICAL, fmtMoney, GRID, MUTED, SERIES } from "./charts";

const TOOL_NAMES = new Set([
  "get_summary",
  "get_trend",
  "get_budget_status",
  "get_anomalies",
]);

export function isFinanceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export function ToolResult({ name, output }: { readonly name: string; readonly output: unknown }) {
  if (name === "get_summary") return <SummaryTiles s={output as Summary} />;
  if (name === "get_trend") return <TrendChart points={output as TrendPoint[]} />;
  if (name === "get_budget_status") return <BudgetChart rows={output as BudgetRow[]} />;
  if (name === "get_anomalies") return <AnomalyList rows={output as Anomaly[]} />;
  return null;
}

function SummaryTiles({ s }: { readonly s: Summary }) {
  const tiles = [
    { label: "Income", value: s.income },
    { label: "Expense", value: s.expense },
    { label: "Net", value: s.net },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {tiles.map((t) => (
        <div className="min-w-36 rounded-lg border px-4 py-3" key={t.label}>
          <div className="text-muted-foreground text-xs">{t.label}</div>
          <div className="font-semibold text-xl tabular-nums">{fmtMoney(t.value)}</div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ points }: { readonly points: TrendPoint[] }) {
  const byDept = points.some((p) => p.department);

  if (!byDept) {
    return (
      <ResponsiveContainer height={280} width="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            axisLine={{ stroke: AXIS }}
            dataKey="period"
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
          <Tooltip formatter={(v) => fmtMoney(Number(v))} />
          <Line dataKey="value" dot={false} stroke={SERIES[0]} strokeWidth={2} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const depts = [...new Set(points.map((p) => p.department as string))];
  const periods = [...new Set(points.map((p) => p.period))];
  const data = periods.map((period) => {
    const row: Record<string, number | string> = { period };
    for (const d of depts) {
      row[d] = points.find((p) => p.period === period && p.department === d)?.value ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer height={300} width="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          axisLine={{ stroke: AXIS }}
          dataKey="period"
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
        <Tooltip formatter={(v) => fmtMoney(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {depts.map((d, i) => (
          <Line
            dataKey={d}
            dot={false}
            key={d}
            stroke={SERIES[i % SERIES.length]}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BudgetChart({ rows }: { readonly rows: BudgetRow[] }) {
  return (
    <ResponsiveContainer height={300} width="100%">
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
        <Tooltip formatter={(v) => fmtMoney(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="budget" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" radius={[4, 4, 0, 0]}>
          {rows.map((r, i) => (
            <Cell fill={r.actual > r.budget ? CRITICAL : SERIES[1]} key={r.department ?? i} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AnomalyList({ rows }: { readonly rows: Anomaly[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">No anomalies found.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr>
            {["Date", "Department", "Category", "Amount", "Category avg"].map((h) => (
              <th className="border-b px-3 py-2 text-left font-medium text-muted-foreground" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">{r.date}</td>
              <td className="px-3 py-2">{r.department}</td>
              <td className="px-3 py-2">{r.category}</td>
              <td className="px-3 py-2 font-medium tabular-nums" style={{ color: CRITICAL }}>
                {fmtMoney(r.amount)}
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">{fmtMoney(r.categoryMean)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
