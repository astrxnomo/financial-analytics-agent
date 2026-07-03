// Palette roles map to CSS custom properties defined in app/globals.css
// (dataviz skill reference palette, slots 1-5 in fixed categorical order).
export const SERIES = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
];
export const CRITICAL = "var(--chart-critical)";
export const GOOD = "var(--chart-good)";
export const GRID = "var(--chart-grid)";
export const AXIS = "var(--chart-axis)";
export const MUTED = "var(--chart-muted)";

export const TOOLTIP_CONTENT_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
  padding: "8px 12px",
};
export const TOOLTIP_LABEL_STYLE = {
  color: "var(--popover-foreground)",
  fontWeight: 600,
  marginBottom: 4,
};
export const TOOLTIP_ITEM_STYLE = { color: "var(--popover-foreground)" };

// Recharts' default bar-hover cursor is a light gray rect that clashes with
// the dark theme; themed to a faint tint of the foreground instead.
export const TOOLTIP_CURSOR_FILL = { fill: "var(--muted)", opacity: 0.5 };

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

// timeZone: "UTC" — tool results carry date-only ISO strings; formatting the
// UTC-midnight parse in local time would render them one day early west of
// Greenwich (2025-01-01 → "Dec 31, 2024").
export const fmtMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

export const fmtPercent = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(n);

export const fmtSigma = (amount: number, mean: number, stdDev: number) =>
  stdDev === 0 ? null : `${((amount - mean) / stdDev).toFixed(1)}σ`;

export const monthRange = (periods: readonly string[]): string | undefined => {
  if (periods.length === 0) return undefined;
  const sorted = [...periods].sort();
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return undefined;
  return first === last ? fmtMonth(first) : `${fmtMonth(first)} – ${fmtMonth(last)}`;
};
