"use client";

import { fmtMoney, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from "../charts";

// Compact charts render inline; large is the same chart at dialog scale
// (bigger height, same responsive width) for the "expand" view.
export type ChartSize = "compact" | "large";

// Recharts payload shape for a hovered tooltip entry — loose because the
// library types this as `any` internally; we only touch these fields.
export interface TooltipEntry {
  readonly name?: string;
  readonly value?: number | string;
  readonly color?: string;
  readonly dataKey?: string | number;
  readonly payload?: Record<string, unknown>;
}

// Custom tooltip content so every value is paired with the same swatch color
// the chart draws it in — Recharts' default tooltip lets a `contentStyle`
// override strip that color-coding, which is the thing this replaces.
// `colorFor` lets a chart override the color per row (e.g. BudgetChart's
// "Actual" bar, which is red only when it exceeds budget — a fact the
// tooltip can't get from the series' own static fill).
//
// `sort`:
// - "value-desc" (default) — biggest value first. Right for series that can
//   cross each other (e.g. multiple department lines): at any given point the
//   line drawn highest on screen has the highest value, so ranking the
//   tooltip rows by value top-to-bottom matches what's visually on top.
// - "none" — keep the order Recharts reports (which is declaration order:
//   left-to-right for grouped bars, legend order for a composed chart,
//   bottom-to-top for a stack). Use this whenever that native order already
//   carries meaning — reordering by value would break the correspondence
//   between the tooltip row and the bar/segment position it describes.
export function ChartTooltip({
  active,
  colorFor,
  label,
  labelFormatter,
  payload,
  sort = "value-desc",
  valueFormatter = fmtMoney,
}: {
  readonly active?: boolean;
  readonly colorFor?: (item: TooltipEntry, payload: readonly TooltipEntry[]) => string | undefined;
  readonly label?: string | number;
  readonly labelFormatter?: (label: string | number) => string;
  readonly payload?: readonly TooltipEntry[];
  readonly sort?: "value-desc" | "none";
  readonly valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const sorted =
    sort === "value-desc" ? [...payload].sort((a, b) => Number(b.value) - Number(a.value)) : payload;
  return (
    <div style={{ ...TOOLTIP_CONTENT_STYLE, minWidth: 160 }}>
      {label !== undefined ? (
        <p style={TOOLTIP_LABEL_STYLE}>{labelFormatter ? labelFormatter(label) : label}</p>
      ) : null}
      <div className="flex flex-col gap-1">
        {sorted.map((item, i) => (
          <div className="flex items-center gap-2" key={item.dataKey ?? i}>
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor?.(item, payload) ?? item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {valueFormatter(Number(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
