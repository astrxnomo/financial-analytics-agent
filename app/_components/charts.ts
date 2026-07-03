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

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
