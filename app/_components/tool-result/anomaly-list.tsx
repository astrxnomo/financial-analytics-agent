"use client";

import type { Anomaly } from "@/agent/lib/finance.types";
import { CRITICAL, fmtDate, fmtMoney, fmtSigma, monthRange, scopeSuffix } from "../charts";
import { ChartHeader, EmptyState } from "./panel";

export function AnomalyList({
  categories,
  departments,
  rows,
}: {
  readonly categories?: readonly string[];
  readonly departments?: readonly string[];
  readonly rows: Anomaly[];
}) {
  const scope = scopeSuffix([departments, categories]);

  if (rows.length === 0) {
    return (
      <div>
        <ChartHeader title={`Unusual transactions${scope}`} />
        <EmptyState message="No anomalies found in this range." />
      </div>
    );
  }

  return (
    <div>
      <ChartHeader
        caption={monthRange(rows.map((r) => r.date))}
        title={`${rows.length} unusual ${rows.length === 1 ? "transaction" : "transactions"}${scope}`}
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
