"use client";

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { DataOverview, Summary } from "@/agent/lib/finance.types";
import { CRITICAL, fmtDate, fmtMoney, GOOD } from "../charts";
import { ChartHeader } from "./panel";

export function SummaryTiles({ s }: { readonly s: Summary }) {
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

// Row counts, not money — a distinct visual language from SummaryTiles so
// "how much data do we have" reads as a different kind of answer than "how
// much did we earn/spend".
export function DataOverviewTiles({ o }: { readonly o: DataOverview }) {
  const tiles = [
    { label: "Transactions", value: o.transactions },
    { label: "Budget rows", value: o.budgets },
    { label: "Departments", value: o.departments },
    {
      label: "Categories",
      sub: `${o.categories.revenue} revenue · ${o.categories.expense} expense`,
      value: o.categories.total,
    },
  ];
  return (
    <div>
      <ChartHeader caption={`${fmtDate(o.dataFrom)} – ${fmtDate(o.dataTo)}`} title="Dataset overview" />
      <div className="flex flex-wrap gap-3">
        {tiles.map((t) => (
          <div className="min-w-36 flex-1 rounded-lg bg-muted/40 px-4 py-3" key={t.label}>
            <div className="text-muted-foreground text-xs">{t.label}</div>
            <div className="font-semibold text-xl tabular-nums">{t.value.toLocaleString()}</div>
            {t.sub ? <div className="text-muted-foreground text-xs">{t.sub}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
